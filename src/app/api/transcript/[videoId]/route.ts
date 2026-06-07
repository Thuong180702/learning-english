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
const YOUTUBE_GL = process.env.YOUTUBE_GL || "VN";
const YOUTUBE_HL = process.env.YOUTUBE_HL || "vi";

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

    const cached = await loadCachedTranscript(videoId);
    if (cached?.subtitles.length) {
      return NextResponse.json({ ...cached, source: "cache" });
    }

    if (request.nextUrl.searchParams.get("cacheOnly") === "1") {
      return NextResponse.json(
        { error: "Khong co cache phu de", subtitles: [] },
        { status: 404 }
      );
    }

    const result = await fetchTranscript(videoId);

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

async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
  const preferredLanguages = ["vi", "en"];
  const errors: unknown[] = [];
  let session: YoutubeSession | undefined;

  try {
    const result = await fetchTranscriptViaSupadata(videoId);
    if (result?.subtitles.length) return result;
  } catch (error) {
    errors.push(error);
  }

  try {
    const result = await fetchTranscriptViaProxy(videoId);
    if (result?.subtitles.length) return result;
  } catch (error) {
    errors.push(error);
  }

  for (const language of preferredLanguages) {
    try {
      const transcript = await withTimeout(
        YoutubeTranscript.fetchTranscript(videoId, { lang: language }),
        FETCH_TIMEOUT_MS
      );
      const subtitles = normalizeTranscript(transcript, language);
      if (subtitles.length) {
        return prepareLanguageResult(subtitles, language);
      }
    } catch (error) {
      errors.push(error);
    }
  }

  try {
    const transcript = await withTimeout(
      YoutubeTranscript.fetchTranscript(videoId),
      FETCH_TIMEOUT_MS
    );
    const language = transcript[0]?.lang || "unknown";
    const subtitles = normalizeTranscript(transcript, language);
    if (subtitles.length) {
      return prepareLanguageResult(subtitles, language);
    }
  } catch (error) {
    errors.push(error);
  }

  try {
    session = await createYoutubeSession(videoId);
  } catch (error) {
    errors.push(error);
  }

  try {
    const result = await fetchTranscriptViaInnerTube(videoId, session);
    if (result.subtitles.length) return result;
  } catch (error) {
    errors.push(error);
  }

  try {
    const result = await fetchTranscriptViaTimedTextList(videoId, session);
    if (result.subtitles.length) return result;
  } catch (error) {
    errors.push(error);
  }

  try {
    const result = await fetchTranscriptViaWatchPage(videoId, session);
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
  url.searchParams.set(
    "mode",
    process.env.SUPADATA_TRANSCRIPT_MODE || "native"
  );

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
  const subtitles = normalizeSupadataTranscript(payload?.content);
  if (!subtitles.length) return null;

  const firstChunk = Array.isArray(payload?.content) ? payload.content[0] : null;
  const language =
    typeof payload?.lang === "string" && payload.lang.trim()
      ? payload.lang
      : typeof firstChunk?.lang === "string" && firstChunk.lang.trim()
        ? firstChunk.lang
        : "unknown";

  return prepareLanguageResult(subtitles, language);
}

function normalizeSupadataTranscript(content: unknown): Subtitle[] {
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

async function loadCachedTranscript(
  videoId: string
): Promise<TranscriptResult | null> {
  const supabase = createTranscriptCacheClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("videos")
      .select("subtitles")
      .eq("youtube_id", videoId)
      .maybeSingle();

    if (error) {
      console.warn("Failed to read cached transcript:", error.message);
      return null;
    }

    return parseCachedTranscript(data?.subtitles);
  } catch (error) {
    console.warn("Cached transcript lookup failed:", error);
    return null;
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

function parseCachedTranscript(value: unknown): TranscriptResult | null {
  if (Array.isArray(value)) {
    const subtitles = normalizeCachedSubtitles(value);
    return subtitles.length
      ? { subtitles, language: "vi", autoTranslated: false }
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

  return {
    subtitles,
    language: typeof cached.language === "string" ? cached.language : "vi",
    autoTranslated: cached.autoTranslated === true,
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
