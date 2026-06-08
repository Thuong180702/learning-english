import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { YoutubeTranscript } from "youtube-transcript";

interface Subtitle {
  start: number;
  end: number;
  text: string;
}

interface TranscriptItem {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  vssId?: string;
  name?: {
    simpleText?: string;
    runs?: Array<{ text?: string }>;
  };
}

interface TranscriptResult {
  subtitles: Subtitle[];
  language: string;
  autoTranslated: boolean;
}

interface PendingTranscriptResult {
  pending: true;
  provider: "assemblyai";
  transcriptId: string;
  retryAfterMs: number;
}

type TranscriptFetchResult = TranscriptResult | PendingTranscriptResult;

interface CachedTranscriptState {
  result: TranscriptResult | null;
  assemblyJob: AssemblyAIJob | null;
}

interface AssemblyAIJob {
  provider: "assemblyai";
  status: "processing";
  transcriptId: string;
  cachedAt: string;
}

interface YoutubeSession {
  cookies?: string;
  visitorData?: string;
  watchHtml?: string;
}

interface InnerTubeClientConfig {
  clientName: string;
  clientVersion: string;
  userAgent: string;
}

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const INNERTUBE_API_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const INNERTUBE_CLIENTS: InnerTubeClientConfig[] = [
  {
    clientName: "ANDROID",
    clientVersion: "20.10.38",
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
  },
  {
    clientName: "IOS",
    clientVersion: "20.10.4",
    userAgent:
      "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5 like Mac OS X)",
  },
];
const FETCH_TIMEOUT_MS = 8000;
const PROXY_TIMEOUT_MS = 15000;
const TRANSLATE_TIMEOUT_MS = 5000;
const SUPADATA_TIMEOUT_MS = 15000;
const SUPADATA_POLL_TIMEOUT_MS = 12000;
const ASSEMBLYAI_TIMEOUT_MS = 15000;
const ASSEMBLYAI_RETRY_AFTER_MS = 4000;
const FRAGMENT_MAX_GAP_SECONDS = 1;
const FRAGMENT_MIN_DURATION_SECONDS = 3.5;
const FRAGMENT_MAX_DURATION_SECONDS = 8;
const FRAGMENT_MAX_TEXT_LENGTH = 220;
const SEGMENT_GROUP_MAX_GAP_SECONDS = 1.2;
const SEGMENT_GROUP_MAX_DURATION_SECONDS = 24;
const YOUTUBE_GL = process.env.YOUTUBE_GL || "VN";
const YOUTUBE_HL = process.env.YOUTUBE_HL || "vi";
const ASSEMBLYAI_API_BASE =
  process.env.ASSEMBLYAI_API_BASE || "https://api.assemblyai.com";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export const preferredRegion = ["sin1", "hkg1", "hnd1"];

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const videoId = params.videoId;

    if (!videoId || !YOUTUBE_ID_PATTERN.test(videoId)) {
      return NextResponse.json(
        { error: "Video ID khong hop le", subtitles: [] },
        { status: 400 }
      );
    }

    const refreshProvider = request.nextUrl.searchParams.get("refresh");
    const shouldRefreshWithAssemblyAI = refreshProvider === "assemblyai";
    const cached = shouldRefreshWithAssemblyAI
      ? { result: null, assemblyJob: null }
      : await loadCachedTranscriptState(videoId);

    if (cached.result?.subtitles.length && !shouldRefreshWithAssemblyAI) {
      return NextResponse.json({ ...cached.result, source: "cache" });
    }

    if (cached.assemblyJob && !shouldRefreshWithAssemblyAI) {
      const assemblyResult = await resolveAssemblyAIJob(
        videoId,
        cached.assemblyJob
      );

      if (isPendingTranscript(assemblyResult)) {
        return NextResponse.json(
          {
            pending: true,
            provider: assemblyResult.provider,
            retryAfterMs: assemblyResult.retryAfterMs,
          },
          { status: 202 }
        );
      }

      await saveTranscriptToCache(videoId, assemblyResult);
      return NextResponse.json({ ...assemblyResult, source: "assemblyai" });
    }

    if (request.nextUrl.searchParams.get("cacheOnly") === "1") {
      return NextResponse.json(
        { error: "Khong co cache phu de", subtitles: [] },
        { status: 404 }
      );
    }

    if (shouldRefreshWithAssemblyAI) {
      const assemblyResult = await startAssemblyAITranscript(videoId);
      if (isPendingTranscript(assemblyResult)) {
        return NextResponse.json(
          {
            pending: true,
            provider: assemblyResult.provider,
            retryAfterMs: assemblyResult.retryAfterMs,
          },
          { status: 202 }
        );
      }

      await saveTranscriptToCache(videoId, assemblyResult);
      return NextResponse.json({ ...assemblyResult, source: "assemblyai" });
    }

    const result = await fetchTranscript(videoId);

    if (isPendingTranscript(result)) {
      return NextResponse.json(
        {
          pending: true,
          provider: result.provider,
          retryAfterMs: result.retryAfterMs,
        },
        { status: 202 }
      );
    }

    if (!result.subtitles.length) {
      return NextResponse.json(
        {
          error:
            "YouTube khong cung cap phu de cho video nay. Hay chon video co CC hoac auto-caption.",
          subtitles: [],
        },
        { status: 404 }
      );
    }

    await saveTranscriptToCache(videoId, result);

    return NextResponse.json({ ...result, source: "youtube" });
  } catch (error) {
    console.error("Transcript fetch error:", error);
    return NextResponse.json(
      { error: "Khong the lay phu de", subtitles: [] },
      { status: 500 }
    );
  }
}

function isPendingTranscript(
  result: TranscriptFetchResult
): result is PendingTranscriptResult {
  return "pending" in result && result.pending === true;
}

async function fetchTranscript(videoId: string): Promise<TranscriptFetchResult> {
  const errors: unknown[] = [];

  try {
    const result = await fetchTranscriptViaSupadata(videoId);
    if (result?.subtitles.length) return result;
  } catch (error) {
    errors.push(error);
  }

  try {
    const result = await startAssemblyAITranscript(videoId);
    if (isPendingTranscript(result)) return result;
    if (result.subtitles.length) return result;
  } catch (error) {
    errors.push(error);
  }

  console.error("All transcript fetch attempts failed:", {
    videoId,
    region: process.env.VERCEL_REGION || "local",
    errors,
  });
  return { subtitles: [], language: "unknown", autoTranslated: false };
}

async function fetchTranscriptViaSupadata(
  videoId: string
): Promise<TranscriptResult | null> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) return null;

  const preferredLanguages = ["vi", "en"];
  const errors: unknown[] = [];

  for (const language of preferredLanguages) {
    try {
      const data = await requestSupadataTranscript(videoId, language, apiKey);
      const result = await parseSupadataResult(data);
      if (result?.subtitles.length) return result;
    } catch (error) {
      errors.push(error);
    }
  }

  throw new Error(
    `Supadata transcript failed: ${errors
      .map((error) => (error instanceof Error ? error.message : String(error)))
      .join(" | ")}`
  );
}

async function requestSupadataTranscript(
  videoId: string,
  language: string,
  apiKey: string
) {
  const url = new URL("https://api.supadata.ai/v1/transcript");
  url.searchParams.set("url", buildWatchUrl(videoId));
  url.searchParams.set("lang", language);
  url.searchParams.set("text", "false");
  url.searchParams.set("mode", "native");

  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        "x-api-key": apiKey,
      },
    },
    SUPADATA_TIMEOUT_MS
  );

  const data = await response.json().catch(() => null);

  if (response.status === 202 && data?.jobId) {
    return pollSupadataJob(data.jobId, apiKey);
  }

  if (!response.ok) {
    throw new Error(
      `Supadata failed with ${response.status}: ${
        data?.error || data?.message || "unknown error"
      }`
    );
  }

  return data;
}

async function pollSupadataJob(jobId: string, apiKey: string) {
  const deadline = Date.now() + SUPADATA_POLL_TIMEOUT_MS;
  const url = `https://api.supadata.ai/v1/transcript/${encodeURIComponent(
    jobId
  )}`;

  while (Date.now() < deadline) {
    await sleep(1000);

    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "x-api-key": apiKey,
        },
      },
      FETCH_TIMEOUT_MS
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Supadata job failed with ${response.status}: ${
          data?.error || data?.message || "unknown error"
        }`
      );
    }

    if (data?.status === "completed") return data.result || data;
    if (data?.status === "failed") {
      throw new Error(data?.error || "Supadata job failed");
    }
  }

  throw new Error("Supadata job did not finish before timeout");
}

async function parseSupadataResult(
  data: any
): Promise<TranscriptResult | null> {
  const payload = data?.result || data;
  const rawSubtitles = parseSupadataTranscriptChunks(payload?.content);
  if (!rawSubtitles.length) return null;

  if (isPoorNativeTranscript(rawSubtitles)) {
    throw new Error("Supadata native transcript quality was too low");
  }

  const subtitles = normalizeGeneratedSubtitleSegments(rawSubtitles);

  const firstChunk = Array.isArray(payload?.content) ? payload.content[0] : null;
  const language =
    typeof payload?.lang === "string" && payload.lang.trim()
      ? payload.lang
      : typeof firstChunk?.lang === "string" && firstChunk.lang.trim()
        ? firstChunk.lang
        : "unknown";

  return prepareLanguageResult(subtitles, language);
}

function parseSupadataTranscriptChunks(content: unknown): Subtitle[] {
  if (!Array.isArray(content)) return [];

  return content
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const row = item as {
        text?: unknown;
        offset?: unknown;
        duration?: unknown;
      };
      const text = typeof row.text === "string" ? decodeHtml(row.text) : "";
      const offset = Number(row.offset || 0);
      const duration = Number(row.duration || 0);
      if (!text || !Number.isFinite(offset)) return null;

      return {
        start: offset / 1000,
        end:
          offset / 1000 +
          Math.max(Number.isFinite(duration) ? duration / 1000 : 0, 0.5),
        text,
      };
    })
    .filter((item): item is Subtitle => item !== null)
    .sort((a, b) => a.start - b.start);
}

async function startAssemblyAITranscript(
  videoId: string
): Promise<TranscriptFetchResult> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return { subtitles: [], language: "unknown", autoTranslated: false };
  }

  const audioUrl = await fetchYoutubeAudioUrl(videoId);
  const response = await fetchWithTimeout(
    `${ASSEMBLYAI_API_BASE}/v2/transcript`,
    {
      method: "POST",
      headers: buildAssemblyAIHeaders(apiKey, true),
      body: JSON.stringify({
        audio_url: audioUrl,
        speech_models: ["universal-2"],
        punctuate: true,
        format_text: true,
        ...buildAssemblyAILanguageConfig(),
      }),
    },
    ASSEMBLYAI_TIMEOUT_MS
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `AssemblyAI submit failed with ${response.status}: ${
        data?.error || data?.message || "unknown error"
      }`
    );
  }

  if (typeof data?.id !== "string" || !data.id) {
    throw new Error("AssemblyAI did not return transcript id");
  }

  await saveAssemblyAIJobToCache(videoId, data.id);

  return {
    pending: true,
    provider: "assemblyai",
    transcriptId: data.id,
    retryAfterMs: ASSEMBLYAI_RETRY_AFTER_MS,
  };
}

async function resolveAssemblyAIJob(
  videoId: string,
  job: AssemblyAIJob
): Promise<TranscriptFetchResult> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ASSEMBLYAI_API_KEY for pending transcript");
  }

  const transcript = await fetchAssemblyAITranscript(job.transcriptId, apiKey);
  if (transcript.status === "queued" || transcript.status === "processing") {
    return {
      pending: true,
      provider: "assemblyai",
      transcriptId: job.transcriptId,
      retryAfterMs: ASSEMBLYAI_RETRY_AFTER_MS,
    };
  }

  if (transcript.status === "error") {
    throw new Error(transcript.error || "AssemblyAI transcript failed");
  }

  if (transcript.status !== "completed") {
    throw new Error(`Unexpected AssemblyAI status: ${transcript.status}`);
  }

  const result = await parseAssemblyAITranscript(job.transcriptId, transcript);
  if (!result?.subtitles.length) {
    throw new Error("AssemblyAI returned empty transcript");
  }

  return result;
}

async function fetchAssemblyAITranscript(transcriptId: string, apiKey: string) {
  const response = await fetchWithTimeout(
    `${ASSEMBLYAI_API_BASE}/v2/transcript/${encodeURIComponent(transcriptId)}`,
    { headers: buildAssemblyAIHeaders(apiKey) },
    ASSEMBLYAI_TIMEOUT_MS
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `AssemblyAI get failed with ${response.status}: ${
        data?.error || data?.message || "unknown error"
      }`
    );
  }

  return data;
}

async function parseAssemblyAITranscript(transcriptId: string, transcript: any) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) return null;

  const sentences = await fetchAssemblyAISentences(transcriptId, apiKey);
  const subtitles = sentences.length
    ? normalizeAssemblyAISentences(sentences)
    : buildSubtitlesFromAssemblyAIWords(transcript.words);

  if (!subtitles.length) return null;

  const language =
    typeof transcript.language_code === "string" && transcript.language_code
      ? normalizeAssemblyAILanguage(transcript.language_code)
      : "unknown";

  return prepareLanguageResult(subtitles, language);
}

async function fetchAssemblyAISentences(
  transcriptId: string,
  apiKey: string
) {
  const response = await fetchWithTimeout(
    `${ASSEMBLYAI_API_BASE}/v2/transcript/${encodeURIComponent(
      transcriptId
    )}/sentences`,
    { headers: buildAssemblyAIHeaders(apiKey) },
    ASSEMBLYAI_TIMEOUT_MS
  );

  if (!response.ok) return [];

  const data = await response.json().catch(() => null);
  return Array.isArray(data?.sentences) ? data.sentences : [];
}

function normalizeAssemblyAISentences(sentences: unknown[]): Subtitle[] {
  return sentences
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { text?: unknown; start?: unknown; end?: unknown };
      const text = typeof row.text === "string" ? decodeHtml(row.text) : "";
      const start = Number(row.start);
      const end = Number(row.end);
      if (!text || !Number.isFinite(start) || !Number.isFinite(end)) return null;

      return {
        start: start / 1000,
        end: Math.max(end / 1000, start / 1000 + 0.5),
        text,
      };
    })
    .filter((item): item is Subtitle => item !== null)
    .sort((a, b) => a.start - b.start);
}

function buildSubtitlesFromAssemblyAIWords(words: unknown): Subtitle[] {
  if (!Array.isArray(words)) return [];

  const normalizedWords = words
    .map((word) => {
      if (!word || typeof word !== "object") return null;
      const row = word as { text?: unknown; start?: unknown; end?: unknown };
      const text = typeof row.text === "string" ? row.text.trim() : "";
      const start = Number(row.start);
      const end = Number(row.end);
      if (!text || !Number.isFinite(start) || !Number.isFinite(end)) return null;
      return { text, start: start / 1000, end: end / 1000 };
    })
    .filter(
      (item): item is { text: string; start: number; end: number } =>
        item !== null
    )
    .sort((a, b) => a.start - b.start);

  const subtitles: Subtitle[] = [];
  let current: typeof normalizedWords = [];

  const flush = () => {
    if (!current.length) return;
    subtitles.push({
      start: current[0].start,
      end: Math.max(current[current.length - 1].end, current[0].start + 0.5),
      text: current.map((word) => word.text).join(" "),
    });
    current = [];
  };

  for (const word of normalizedWords) {
    const previous = current[current.length - 1];
    const gap = previous ? Math.max(0, word.start - previous.end) : 0;
    const nextText = current.map((item) => item.text).concat(word.text).join(" ");
    const nextDuration = current.length
      ? word.end - current[0].start
      : word.end - word.start;

    if (
      previous &&
      (gap >= 0.8 ||
        nextDuration > 7 ||
        nextText.length > 160 ||
        hasSentenceEnding(previous.text))
    ) {
      flush();
    }

    current.push(word);
  }

  flush();
  return subtitles;
}

function normalizeAssemblyAILanguage(language: string) {
  return language.toLowerCase().replace("_", "-").split("-")[0] || "unknown";
}

function buildAssemblyAIHeaders(apiKey: string, json = false) {
  return {
    Authorization: apiKey,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

function buildAssemblyAILanguageConfig() {
  const language = process.env.ASSEMBLYAI_LANGUAGE_CODE || "vi";
  if (language.toLowerCase() === "auto") {
    return { language_detection: true };
  }

  return { language_code: language };
}

async function saveAssemblyAIJobToCache(videoId: string, transcriptId: string) {
  const supabase = createTranscriptCacheClient(true);
  if (!supabase) return;

  const { error } = await supabase
    .from("videos")
    .update({
      subtitles: {
        provider: "assemblyai",
        status: "processing",
        transcriptId,
        cachedAt: new Date().toISOString(),
      },
      cached_at: new Date().toISOString(),
    })
    .eq("youtube_id", videoId);

  if (error) {
    console.warn("Failed to cache AssemblyAI job:", error.message);
  }
}

async function fetchYoutubeAudioUrl(videoId: string) {
  const errors: unknown[] = [];

  for (const client of INNERTUBE_CLIENTS) {
    try {
      const response = await fetchWithTimeout(
        INNERTUBE_API_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": client.userAgent,
            Origin: "https://www.youtube.com",
            Referer: buildWatchUrl(videoId),
            "X-Youtube-Client-Version": client.clientVersion,
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: client.clientName,
                clientVersion: client.clientVersion,
                hl: YOUTUBE_HL,
                gl: YOUTUBE_GL,
              },
            },
            videoId,
            contentCheckOk: true,
            racyCheckOk: true,
          }),
        },
        FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(
          `${client.clientName} audio player failed with ${response.status}`
        );
      }

      const data = await response.json();
      const url = selectBestYoutubeAudioUrl(
        data?.streamingData?.adaptiveFormats || []
      );
      if (url) return url;

      throw new Error(`${client.clientName} returned no audio stream URL`);
    } catch (error) {
      errors.push(error);
    }
  }

  throw new Error(
    `Could not get YouTube audio stream: ${errors
      .map((error) => (error instanceof Error ? error.message : String(error)))
      .join(" | ")}`
  );
}

function selectBestYoutubeAudioUrl(formats: unknown[]) {
  return formats
    .filter((format): format is { url: string; mimeType?: string; bitrate?: number } => {
      if (!format || typeof format !== "object") return false;
      const row = format as { url?: unknown; mimeType?: unknown };
      return (
        typeof row.url === "string" &&
        typeof row.mimeType === "string" &&
        row.mimeType.startsWith("audio/")
      );
    })
    .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0]?.url;
}

async function fetchTranscriptViaProxy(
  videoId: string
): Promise<TranscriptResult | null> {
  const proxyUrl = getTranscriptProxyUrl();
  const proxySecret = process.env.TRANSCRIPT_PROXY_SECRET;
  if (!proxyUrl || !proxySecret) return null;

  const authToken =
    process.env.TRANSCRIPT_PROXY_AUTH_TOKEN ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    proxySecret;

  const response = await fetchWithTimeout(
    proxyUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        "X-Transcript-Proxy-Secret": proxySecret,
      },
      body: JSON.stringify({
        videoId,
        preferredLanguages: ["vi", "en"],
      }),
    },
    PROXY_TIMEOUT_MS
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `Transcript proxy failed with ${response.status}: ${
        data?.error || "unknown error"
      }`
    );
  }

  const subtitles = normalizeCachedSubtitles(data?.subtitles || []);
  if (!subtitles.length) {
    throw new Error("Transcript proxy returned empty subtitles");
  }

  return {
    subtitles,
    language: typeof data?.language === "string" ? data.language : "vi",
    autoTranslated: data?.autoTranslated === true,
  };
}

function getTranscriptProxyUrl() {
  if (process.env.TRANSCRIPT_PROXY_URL) {
    return process.env.TRANSCRIPT_PROXY_URL;
  }

  if (!process.env.TRANSCRIPT_PROXY_SECRET) return "";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return "";

  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/transcript-proxy`;
}

async function createYoutubeSession(videoId: string): Promise<YoutubeSession> {
  const response = await fetchWithTimeout(
    buildWatchUrl(videoId),
    { headers: buildYoutubeHeaders() },
    FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`YouTube session failed with ${response.status}`);
  }

  const watchHtml = await response.text();
  const cookies = extractCookieHeader(response.headers);
  const visitorData = extractVisitorData(watchHtml);

  return { cookies, visitorData, watchHtml };
}

function createTranscriptCacheClient(write = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = write
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function loadCachedTranscriptState(
  videoId: string
): Promise<CachedTranscriptState> {
  const supabase = createTranscriptCacheClient();
  if (!supabase) return { result: null, assemblyJob: null };

  try {
    const { data, error } = await supabase
      .from("videos")
      .select("subtitles")
      .eq("youtube_id", videoId)
      .maybeSingle();

    if (error) {
      console.warn("Failed to read cached transcript:", error.message);
      return { result: null, assemblyJob: null };
    }

    return parseCachedTranscriptState(data?.subtitles);
  } catch (error) {
    console.warn("Cached transcript lookup failed:", error);
    return { result: null, assemblyJob: null };
  }
}

async function saveTranscriptToCache(
  videoId: string,
  result: TranscriptResult
): Promise<void> {
  if (!result.subtitles.length) return;

  const payload = {
    subtitles: result.subtitles,
    language: result.language,
    autoTranslated: result.autoTranslated,
    cachedAt: new Date().toISOString(),
  };

  const supabase = createTranscriptCacheClient(true);
  if (!supabase) {
    console.warn(
      "Transcript cache write skipped: missing SUPABASE_SERVICE_ROLE_KEY"
    );
    return;
  }

  await updateTranscriptCache(supabase, videoId, payload);
}

async function updateTranscriptCache(
  supabase: { from: (table: string) => any },
  videoId: string,
  payload: {
    subtitles: Subtitle[];
    language: string;
    autoTranslated: boolean;
    cachedAt: string;
  }
) {
  const { error } = await supabase
    .from("videos")
    .update({
      subtitles: payload,
      cached_at: payload.cachedAt,
    })
    .eq("youtube_id", videoId);

  if (error) {
    console.warn("Failed to cache transcript:", error.message);
    return false;
  }

  return true;
}

function parseCachedTranscriptState(value: unknown): CachedTranscriptState {
  return {
    result: parseCachedTranscript(value),
    assemblyJob: parseCachedAssemblyAIJob(value),
  };
}

function parseCachedTranscript(value: unknown): TranscriptResult | null {
  if (Array.isArray(value)) {
    const subtitles = normalizeCachedSubtitles(value);
    if (isPoorNativeTranscript(subtitles)) return null;
    return subtitles.length
      ? {
          subtitles: normalizeGeneratedSubtitleSegments(subtitles),
          language: "vi",
          autoTranslated: false,
        }
      : null;
  }

  if (!value || typeof value !== "object") return null;

  const cached = value as {
    subtitles?: unknown;
    language?: unknown;
    autoTranslated?: unknown;
  };
  if (!Array.isArray(cached.subtitles)) return null;

  const subtitles = normalizeCachedSubtitles(cached.subtitles);
  if (!subtitles.length) return null;
  if (isPoorNativeTranscript(subtitles)) return null;

  return {
    subtitles: normalizeGeneratedSubtitleSegments(subtitles),
    language: typeof cached.language === "string" ? cached.language : "vi",
    autoTranslated: cached.autoTranslated === true,
  };
}

function parseCachedAssemblyAIJob(value: unknown): AssemblyAIJob | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const cached = value as {
    provider?: unknown;
    status?: unknown;
    transcriptId?: unknown;
    cachedAt?: unknown;
  };

  if (
    cached.provider !== "assemblyai" ||
    cached.status !== "processing" ||
    typeof cached.transcriptId !== "string" ||
    !cached.transcriptId
  ) {
    return null;
  }

  return {
    provider: "assemblyai",
    status: "processing",
    transcriptId: cached.transcriptId,
    cachedAt:
      typeof cached.cachedAt === "string"
        ? cached.cachedAt
        : new Date().toISOString(),
  };
}

function normalizeCachedSubtitles(items: unknown[]): Subtitle[] {
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { start?: unknown; end?: unknown; text?: unknown };
      const start = Number(row.start);
      const end = Number(row.end);
      const text = typeof row.text === "string" ? row.text.trim() : "";

      if (!Number.isFinite(start) || !text) return null;

      return {
        start,
        end: Number.isFinite(end) ? Math.max(end, start + 0.5) : start + 0.5,
        text,
      };
    })
    .filter((item): item is Subtitle => item !== null)
    .sort((a, b) => a.start - b.start);
}

function normalizeGeneratedSubtitleSegments(subtitles: Subtitle[]): Subtitle[] {
  if (subtitles.length < 2) return subtitles;

  const split = splitSubtitleSentences(subtitles);
  const shouldResegment = shouldResegmentSubtitles(subtitles, split);
  if (!shouldResegment) return subtitles;

  const merged = mergeGeneratedSubtitleFragments(split);
  return redistributeSubtitleTimings(merged);
}

function shouldResegmentSubtitles(
  original: Subtitle[],
  sentenceSplit: Subtitle[]
) {
  return (
    sentenceSplit.length !== original.length ||
    looksFragmented(original) ||
    hasSuspiciousDurations(original)
  );
}

function splitSubtitleSentences(subtitles: Subtitle[]): Subtitle[] {
  return subtitles.flatMap((subtitle) => {
    const parts = splitTextBySentenceEnd(subtitle.text);
    if (parts.length <= 1) return [subtitle];

    const duration = Math.max(subtitle.end - subtitle.start, 0.5);
    const totalWeight = parts.reduce(
      (sum, part) => sum + getTextTimingWeight(part),
      0
    );
    let cursor = subtitle.start;

    return parts.map((part, index) => {
      const isLast = index === parts.length - 1;
      const partDuration = isLast
        ? subtitle.end - cursor
        : duration * (getTextTimingWeight(part) / totalWeight);
      const start = cursor;
      const end = isLast
        ? subtitle.end
        : Math.min(subtitle.end, cursor + Math.max(partDuration, 0.4));

      cursor = end;
      return {
        start,
        end: Math.max(end, start + 0.4),
        text: part,
      };
    });
  });
}

function splitTextBySentenceEnd(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const parts: string[] = [];
  let start = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (!".!?".includes(char)) continue;

    const next = normalized[index + 1] || "";
    if (next && !/\s|["')\]]/.test(next)) continue;

    let end = index + 1;
    while (/["')\]]/.test(normalized[end] || "")) end += 1;

    const part = normalized.slice(start, end).trim();
    if (part) parts.push(part);
    start = end;
  }

  const tail = normalized.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.length ? parts : [normalized];
}

function mergeGeneratedSubtitleFragments(subtitles: Subtitle[]): Subtitle[] {
  if (subtitles.length < 2) return subtitles;

  const merged: Subtitle[] = [];
  let current = { ...subtitles[0] };

  for (const next of subtitles.slice(1)) {
    if (shouldMergeSubtitleFragment(current, next)) {
      current = {
        start: current.start,
        end: Math.max(current.end, next.end),
        text: joinSubtitleText(current.text, next.text),
      };
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

function looksFragmented(subtitles: Subtitle[]) {
  const durations = subtitles
    .map((subtitle) => subtitle.end - subtitle.start)
    .filter((duration) => Number.isFinite(duration) && duration > 0)
    .sort((a, b) => a - b);

  if (!durations.length) return false;

  const median = durations[Math.floor(durations.length / 2)];
  const shortCount = durations.filter((duration) => duration <= 2.4).length;
  return median <= 2.6 || shortCount / durations.length >= 0.45;
}

function hasSuspiciousDurations(subtitles: Subtitle[]) {
  return subtitles.some((subtitle) => {
    const duration = subtitle.end - subtitle.start;
    if (!Number.isFinite(duration) || duration <= 0) return false;

    const estimated = estimateSpeechDuration(subtitle.text);
    return (
      (duration >= 4 && duration > estimated * 1.8) ||
      (duration <= 1.4 && estimated >= 2.5)
    );
  });
}

function isPoorNativeTranscript(subtitles: Subtitle[]) {
  if (subtitles.length < 8) return false;

  const durations = subtitles
    .map((subtitle) => subtitle.end - subtitle.start)
    .filter((duration) => Number.isFinite(duration) && duration > 0)
    .sort((a, b) => a - b);
  if (!durations.length) return false;

  const median = durations[Math.floor(durations.length / 2)];
  const shortRatio =
    durations.filter((duration) => duration <= 1.8).length / durations.length;
  const suspiciousRatio =
    subtitles.filter((subtitle) => {
      const duration = subtitle.end - subtitle.start;
      const estimated = estimateSpeechDuration(subtitle.text);
      return (
        (duration >= 4 && duration > estimated * 2.2) ||
        (duration <= 1.2 && estimated >= 2.5)
      );
    }).length / subtitles.length;

  return median <= 1.7 || shortRatio >= 0.6 || suspiciousRatio >= 0.35;
}

function redistributeSubtitleTimings(subtitles: Subtitle[]): Subtitle[] {
  const groups = groupContinuousSubtitles(subtitles);
  return groups.flatMap((group) => redistributeSubtitleGroup(group));
}

function groupContinuousSubtitles(subtitles: Subtitle[]) {
  const groups: Subtitle[][] = [];
  let current: Subtitle[] = [];

  for (const subtitle of subtitles) {
    const previous = current[current.length - 1];
    const gap = previous ? Math.max(0, subtitle.start - previous.end) : 0;
    const groupDuration = current.length
      ? Math.max(subtitle.end, current[current.length - 1].end) - current[0].start
      : 0;

    if (
      previous &&
      (gap > SEGMENT_GROUP_MAX_GAP_SECONDS ||
        groupDuration > SEGMENT_GROUP_MAX_DURATION_SECONDS)
    ) {
      groups.push(current);
      current = [];
    }

    current.push(subtitle);
  }

  if (current.length) groups.push(current);
  return groups;
}

function redistributeSubtitleGroup(group: Subtitle[]): Subtitle[] {
  if (group.length < 2) return group;

  const start = group[0].start;
  const end = Math.max(...group.map((subtitle) => subtitle.end));
  const totalDuration = Math.max(end - start, group.length * 0.4);
  const totalWeight = group.reduce(
    (sum, subtitle) => sum + getTextTimingWeight(subtitle.text),
    0
  );

  let cursor = start;
  return group.map((subtitle, index) => {
    const isLast = index === group.length - 1;
    const duration = isLast
      ? end - cursor
      : totalDuration * (getTextTimingWeight(subtitle.text) / totalWeight);
    const itemStart = cursor;
    const itemEnd = isLast
      ? end
      : Math.min(end, cursor + Math.max(duration, 0.4));

    cursor = itemEnd;
    return {
      ...subtitle,
      start: itemStart,
      end: Math.max(itemEnd, itemStart + 0.4),
    };
  });
}

function shouldMergeSubtitleFragment(current: Subtitle, next: Subtitle) {
  const gap = Math.max(0, next.start - current.end);
  if (gap > FRAGMENT_MAX_GAP_SECONDS) return false;

  const currentDuration = current.end - current.start;
  const combinedDuration = Math.max(next.end, current.end) - current.start;
  if (combinedDuration > FRAGMENT_MAX_DURATION_SECONDS) return false;

  const combinedText = joinSubtitleText(current.text, next.text);
  if (combinedText.length > FRAGMENT_MAX_TEXT_LENGTH) return false;

  return (
    currentDuration < FRAGMENT_MIN_DURATION_SECONDS ||
    !hasSentenceEnding(current.text) ||
    startsWithLowercase(next.text)
  );
}

function hasSentenceEnding(text: string) {
  return /[.!?…。！？]["')\]]*$/.test(text.trim());
}

function startsWithLowercase(text: string) {
  const firstLetter = Array.from(text.trim()).find(
    (char) => char.toLocaleLowerCase() !== char.toLocaleUpperCase()
  );
  return !!firstLetter && firstLetter === firstLetter.toLocaleLowerCase();
}

function estimateSpeechDuration(text: string) {
  return Math.max(0.8, Math.min(10, getWordCount(text) / 2.8));
}

function getTextTimingWeight(text: string) {
  return Math.max(1, getWordCount(text) * 6, text.trim().length);
}

function getWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function joinSubtitleText(left: string, right: string) {
  const cleanLeft = left.trim();
  const cleanRight = right.trim();
  if (!cleanLeft) return cleanRight;
  if (!cleanRight) return cleanLeft;
  return `${cleanLeft} ${cleanRight}`.replace(/\s+/g, " ").trim();
}

async function fetchTranscriptViaInnerTube(
  videoId: string,
  session?: YoutubeSession
): Promise<TranscriptResult> {
  const errors: unknown[] = [];

  for (const client of INNERTUBE_CLIENTS) {
    try {
      const response = await fetchWithTimeout(
        INNERTUBE_API_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...buildYoutubeHeaders(
              {
                "User-Agent": client.userAgent,
                Origin: "https://www.youtube.com",
                Referer: buildWatchUrl(videoId),
                "X-Youtube-Client-Version": client.clientVersion,
                ...(session?.visitorData
                  ? { "X-Goog-Visitor-Id": session.visitorData }
                  : {}),
              },
              session
            ),
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: client.clientName,
                clientVersion: client.clientVersion,
                hl: YOUTUBE_HL,
                gl: YOUTUBE_GL,
                ...(session?.visitorData
                  ? { visitorData: session.visitorData }
                  : {}),
              },
            },
            videoId,
            contentCheckOk: true,
            racyCheckOk: true,
          }),
        },
        FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(
          `${client.clientName} InnerTube failed with ${response.status}`
        );
      }

      const data = await response.json();
      const tracks =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

      if (!Array.isArray(tracks) || tracks.length === 0) {
        throw new Error(`${client.clientName} returned no caption tracks`);
      }

      const track = selectBestTrack(tracks);
      const language = track.languageCode || "unknown";
      const subtitles = await fetchTimedText(track, session);

      if (!subtitles.length) {
        throw new Error(`${client.clientName} timed text was empty`);
      }

      return prepareLanguageResult(subtitles, language);
    } catch (error) {
      errors.push(error);
    }
  }

  throw new Error(
    `No InnerTube caption tracks found: ${errors
      .map((error) => (error instanceof Error ? error.message : String(error)))
      .join(" | ")}`
  );
}

async function fetchTranscriptViaTimedTextList(
  videoId: string,
  session?: YoutubeSession
): Promise<TranscriptResult> {
  const listUrl =
    `https://www.youtube.com/api/timedtext?type=list&v=${videoId}` +
    `&hl=${encodeURIComponent(YOUTUBE_HL)}&gl=${encodeURIComponent(YOUTUBE_GL)}`;
  const response = await fetchWithTimeout(
    listUrl,
    { headers: buildYoutubeHeaders({}, session) },
    FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Timed text list failed with ${response.status}`);
  }

  const xml = await response.text();
  const tracks = parseTimedTextTrackList(xml);
  if (!tracks.length) {
    throw new Error("Timed text track list was empty");
  }

  const track = selectBestTrack(tracks);
  const url =
    `https://www.youtube.com/api/timedtext?v=${videoId}` +
    `&fmt=json3&lang=${encodeURIComponent(track.languageCode)}` +
    (track.kind ? `&kind=${encodeURIComponent(track.kind)}` : "") +
    (getTrackName(track) ? `&name=${encodeURIComponent(getTrackName(track))}` : "");
  const subtitles = await fetchTimedTextByUrl(url, session);

  if (!subtitles.length) {
    throw new Error("Timed text list track was empty");
  }

  return prepareLanguageResult(subtitles, track.languageCode);
}

async function fetchTranscriptViaWatchPage(
  videoId: string,
  session?: YoutubeSession
): Promise<TranscriptResult> {
  const html =
    session?.watchHtml || (await fetchWatchPageHtml(videoId, session));
  const data = extractInitialPlayerResponse(html);
  const tracks =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error("No watch page caption tracks found");
  }

  const track = selectBestTrack(tracks);
  const language = track.languageCode || "unknown";
  const subtitles = await fetchTimedText(track, session);

  if (!subtitles.length) {
    throw new Error("Watch page timed text was empty");
  }

  return prepareLanguageResult(subtitles, language);
}

function selectBestTrack(tracks: CaptionTrack[]): CaptionTrack {
  return (
    findTrack(tracks, "vi") ||
    findTrack(tracks, "vi-VN") ||
    findTrack(tracks, "en") ||
    tracks.find((item) => item.kind !== "asr") ||
    tracks[0]
  );
}

function findTrack(tracks: CaptionTrack[], language: string) {
  return tracks.find(
    (track) =>
      track.languageCode === language ||
      track.languageCode?.toLowerCase().startsWith(`${language}-`)
  );
}

function getTrackName(track: CaptionTrack) {
  return (
    track.name?.simpleText ||
    track.name?.runs
      ?.map((run) => run.text || "")
      .join("")
      .trim() ||
    ""
  );
}

function buildWatchUrl(videoId: string) {
  return (
    `https://www.youtube.com/watch?v=${videoId}` +
    `&hl=${encodeURIComponent(YOUTUBE_HL)}&gl=${encodeURIComponent(YOUTUBE_GL)}` +
    "&persist_hl=1"
  );
}

async function fetchWatchPageHtml(videoId: string, session?: YoutubeSession) {
  const response = await fetchWithTimeout(
    buildWatchUrl(videoId),
    { headers: buildYoutubeHeaders({}, session) },
    FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Watch page failed with ${response.status}`);
  }

  return response.text();
}

function parseTimedTextTrackList(xml: string): CaptionTrack[] {
  const tracks: CaptionTrack[] = [];
  const regex = /<track\b([^>]*)\/?>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const attrs = parseXmlAttributes(match[1]);
    const languageCode = attrs.lang_code || attrs.lang;
    if (!languageCode) continue;

    tracks.push({
      baseUrl: "",
      languageCode,
      kind: attrs.kind,
      vssId: attrs.vss_id,
      name: attrs.name ? { simpleText: decodeHtml(attrs.name) } : undefined,
    });
  }

  return tracks;
}

function parseXmlAttributes(input: string) {
  const attrs: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    attrs[match[1]] = decodeHtml(match[2]);
  }

  return attrs;
}

function extractInitialPlayerResponse(html: string): any {
  const match = /ytInitialPlayerResponse\s*=/.exec(html);
  if (!match) {
    throw new Error("ytInitialPlayerResponse not found");
  }

  let start = match.index + match[0].length;
  while (/\s/.test(html[start] || "")) start += 1;

  const json = readJsonObject(html, start);
  return JSON.parse(json);
}

function readJsonObject(source: string, start: number): string {
  if (source[start] !== "{") {
    throw new Error("Expected JSON object");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error("Unterminated JSON object");
}

async function fetchTimedText(
  track: CaptionTrack,
  session?: YoutubeSession
): Promise<Subtitle[]> {
  const url = new URL(track.baseUrl);
  url.searchParams.set("fmt", "json3");

  return fetchTimedTextByUrl(url.toString(), session);
}

async function fetchTimedTextByUrl(
  url: string,
  session?: YoutubeSession
): Promise<Subtitle[]> {
  const response = await fetchWithTimeout(
    url,
    { headers: buildYoutubeHeaders({}, session) },
    FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Timed text failed with ${response.status}`);
  }

  const body = await response.text();
  if (!body.trim()) return [];

  try {
    return parseJson3Transcript(JSON.parse(body));
  } catch {
    return parseXmlTranscript(body);
  }
}

function buildYoutubeHeaders(
  extra: Record<string, string> = {},
  session?: YoutubeSession
) {
  const cookies = process.env.YOUTUBE_COOKIES;
  return {
    "User-Agent": USER_AGENT,
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    ...(cookies || session?.cookies
      ? { Cookie: mergeCookieHeaders(cookies, session?.cookies) }
      : {}),
    ...extra,
  };
}

function mergeCookieHeaders(...headers: Array<string | undefined>) {
  const cookieMap = new Map<string, string>();

  for (const header of headers) {
    if (!header) continue;
    for (const cookie of header.split(";")) {
      const trimmed = cookie.trim();
      if (!trimmed) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;

      cookieMap.set(
        trimmed.slice(0, separatorIndex),
        trimmed.slice(separatorIndex + 1)
      );
    }
  }

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function extractCookieHeader(headers: Headers) {
  const getSetCookie = (headers as any).getSetCookie;
  const setCookies: string[] =
    typeof getSetCookie === "function"
      ? getSetCookie.call(headers)
      : splitSetCookieHeader(headers.get("set-cookie"));

  return setCookies
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function splitSetCookieHeader(header: string | null) {
  if (!header) return [];
  return header.split(/,\s*(?=[^;,]+=)/);
}

function extractVisitorData(html: string) {
  const match =
    html.match(/"VISITOR_DATA"\s*:\s*"([^"]+)"/) ||
    html.match(/"visitorData"\s*:\s*"([^"]+)"/);

  if (!match?.[1]) return undefined;

  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

function normalizeTranscript(
  transcript: TranscriptItem[],
  language: string
): Subtitle[] {
  if (!Array.isArray(transcript)) return [];

  const maxOffset = Math.max(0, ...transcript.map((item) => item.offset || 0));
  const maxDuration = Math.max(
    0,
    ...transcript.map((item) => item.duration || 0)
  );
  const valuesAreMilliseconds = maxOffset > 1000 || maxDuration > 100;
  const divisor = valuesAreMilliseconds ? 1000 : 1;

  return transcript
    .map((item) => {
      const start = Number(item.offset || 0) / divisor;
      const duration = Number(item.duration || 0) / divisor;
      return {
        start,
        end: start + Math.max(duration, 0.5),
        text: decodeHtml(item.text || ""),
      };
    })
    .filter((item) => item.text.length > 0)
    .sort((a, b) => a.start - b.start);
}

function parseJson3Transcript(data: any): Subtitle[] {
  const events = Array.isArray(data?.events) ? data.events : [];

  return events
    .map((event: any) => {
      const text = (event.segs || [])
        .map((segment: any) => segment.utf8 || "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();

      const start = Number(event.tStartMs || 0) / 1000;
      const duration = Number(event.dDurationMs || 0) / 1000;

      return {
        start,
        end: start + Math.max(duration, 0.5),
        text: decodeHtml(text),
      };
    })
    .filter((item: Subtitle) => item.text.length > 0)
    .sort((a: Subtitle, b: Subtitle) => a.start - b.start);
}

function parseXmlTranscript(xml: string): Subtitle[] {
  const subtitles: Subtitle[] = [];
  const paragraphRegex = /<p\s+[^>]*t="(\d+)"[^>]*d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  const classicRegex = /<text\s+[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;

  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(xml)) !== null) {
    const start = Number(match[1]) / 1000;
    const duration = Number(match[2]) / 1000;
    const text = decodeHtml(match[3].replace(/<[^>]+>/g, ""));
    if (text) {
      subtitles.push({ start, end: start + Math.max(duration, 0.5), text });
    }
  }

  if (subtitles.length > 0) {
    return subtitles.sort((a, b) => a.start - b.start);
  }

  while ((match = classicRegex.exec(xml)) !== null) {
    const start = Number(match[1]);
    const duration = Number(match[2]);
    const text = decodeHtml(match[3]);
    if (text) {
      subtitles.push({ start, end: start + Math.max(duration, 0.5), text });
    }
  }

  return subtitles.sort((a, b) => a.start - b.start);
}

async function prepareLanguageResult(
  subtitles: Subtitle[],
  language: string
): Promise<TranscriptResult> {
  if (language.toLowerCase().startsWith("vi")) {
    return { subtitles, language: "vi", autoTranslated: false };
  }

  const translated = await translateBatch(subtitles, language, "vi");

  if (translated.translated) {
    return {
      subtitles: translated.subtitles,
      language: "vi-auto",
      autoTranslated: true,
    };
  }

  return { subtitles, language, autoTranslated: false };
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(parseInt(code, 10))
    )
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function translateBatch(
  subtitles: Subtitle[],
  source: string,
  target: string
): Promise<{ subtitles: Subtitle[]; translated: boolean }> {
  const chunks = buildTranslationChunks(subtitles);

  try {
    const translatedChunks = await Promise.all(
      chunks.map((chunk) => translateTexts(chunk.texts, source, target))
    );

    if (
      translatedChunks.some(
        (translated, index) => translated.length !== chunks[index].texts.length
      )
    ) {
      return { subtitles, translated: false };
    }

    const translatedTexts = translatedChunks.flat();

    if (translatedTexts.length !== subtitles.length) {
      return { subtitles, translated: false };
    }

    return {
      subtitles: subtitles.map((subtitle, index) => ({
        ...subtitle,
        text: translatedTexts[index] || subtitle.text,
      })),
      translated: true,
    };
  } catch (error) {
    console.error("Batch translation error:", error);
    return { subtitles, translated: false };
  }
}

function buildTranslationChunks(subtitles: Subtitle[]) {
  const chunks: Array<{ texts: string[] }> = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const subtitle of subtitles) {
    const text = subtitle.text;
    const nextLength = currentLength + text.length;

    if (current.length > 0 && (current.length >= 40 || nextLength > 3500)) {
      chunks.push({ texts: current });
      current = [];
      currentLength = 0;
    }

    current.push(text);
    currentLength += text.length;
  }

  if (current.length > 0) {
    chunks.push({ texts: current });
  }

  return chunks;
}

async function translateTexts(
  texts: string[],
  source: string,
  target: string
): Promise<string[]> {
  const separator = "\n<LE_TRANSCRIPT_SPLIT>\n";
  const combined = texts.join(separator);
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=${encodeURIComponent(source)}` +
    `&tl=${encodeURIComponent(target)}&dt=t` +
    `&q=${encodeURIComponent(combined)}`;

  const response = await fetchWithTimeout(
    url,
    { headers: { "User-Agent": USER_AGENT } },
    TRANSLATE_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Translation failed with ${response.status}`);
  }

  const data = await response.json();
  const translated = Array.isArray(data?.[0])
    ? data[0].map((item: any) => item[0]).join("")
    : "";

  return translated
    .split(/\n\s*<LE_TRANSCRIPT_SPLIT>\s*\n/)
    .map((part) => part.trim());
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
