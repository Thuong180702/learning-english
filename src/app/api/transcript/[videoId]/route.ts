import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase-server";
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

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const INNERTUBE_API_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const INNERTUBE_CLIENT_VERSION = "20.10.38";
const FETCH_TIMEOUT_MS = 8000;
const TRANSLATE_TIMEOUT_MS = 5000;
const YOUTUBE_GL = process.env.YOUTUBE_GL || "VN";
const YOUTUBE_HL = process.env.YOUTUBE_HL || "vi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

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
    const result = await fetchTranscriptViaInnerTube(videoId);
    if (result.subtitles.length) return result;
  } catch (error) {
    errors.push(error);
  }

  try {
    const result = await fetchTranscriptViaTimedTextList(videoId);
    if (result.subtitles.length) return result;
  } catch (error) {
    errors.push(error);
  }

  try {
    const result = await fetchTranscriptViaWatchPage(videoId);
    if (result.subtitles.length) return result;
  } catch (error) {
    errors.push(error);
  }

  console.error("All transcript fetch attempts failed:", errors);
  return { subtitles: [], language: "unknown", autoTranslated: false };
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
  if (supabase) {
    const saved = await updateTranscriptCache(supabase, videoId, payload);
    if (saved) return;
  }

  try {
    const userSupabase = await createServerSupabaseClient();
    await updateTranscriptCache(userSupabase, videoId, payload);
  } catch (error) {
    console.warn("Transcript cache write failed:", error);
  }
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
  videoId: string
): Promise<TranscriptResult> {
  const response = await fetchWithTimeout(
    INNERTUBE_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildYoutubeHeaders({
          "User-Agent": `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`,
          Origin: "https://www.youtube.com",
          Referer: `https://www.youtube.com/watch?v=${videoId}`,
        }),
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: INNERTUBE_CLIENT_VERSION,
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
    throw new Error(`InnerTube failed with ${response.status}`);
  }

  const data = await response.json();
  const tracks =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error("No caption tracks found");
  }

  const track = selectBestTrack(tracks);

  const language = track.languageCode || "unknown";
  const subtitles = await fetchTimedText(track);

  if (!subtitles.length) {
    throw new Error("Timed text was empty");
  }

  return prepareLanguageResult(subtitles, language);
}

async function fetchTranscriptViaTimedTextList(
  videoId: string
): Promise<TranscriptResult> {
  const listUrl =
    `https://www.youtube.com/api/timedtext?type=list&v=${videoId}` +
    `&hl=${encodeURIComponent(YOUTUBE_HL)}&gl=${encodeURIComponent(YOUTUBE_GL)}`;
  const response = await fetchWithTimeout(
    listUrl,
    { headers: buildYoutubeHeaders() },
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
  const subtitles = await fetchTimedTextByUrl(url);

  if (!subtitles.length) {
    throw new Error("Timed text list track was empty");
  }

  return prepareLanguageResult(subtitles, track.languageCode);
}

async function fetchTranscriptViaWatchPage(
  videoId: string
): Promise<TranscriptResult> {
  const response = await fetchWithTimeout(
    `https://www.youtube.com/watch?v=${videoId}` +
      `&hl=${encodeURIComponent(YOUTUBE_HL)}&gl=${encodeURIComponent(YOUTUBE_GL)}` +
      "&persist_hl=1",
    { headers: buildYoutubeHeaders() },
    FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Watch page failed with ${response.status}`);
  }

  const html = await response.text();
  const data = extractInitialPlayerResponse(html);
  const tracks =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error("No watch page caption tracks found");
  }

  const track = selectBestTrack(tracks);
  const language = track.languageCode || "unknown";
  const subtitles = await fetchTimedText(track);

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

async function fetchTimedText(track: CaptionTrack): Promise<Subtitle[]> {
  const url = new URL(track.baseUrl);
  url.searchParams.set("fmt", "json3");

  return fetchTimedTextByUrl(url.toString());
}

async function fetchTimedTextByUrl(url: string): Promise<Subtitle[]> {
  const response = await fetchWithTimeout(
    url,
    { headers: buildYoutubeHeaders() },
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

function buildYoutubeHeaders(extra: Record<string, string> = {}) {
  const cookies = process.env.YOUTUBE_COOKIES;
  return {
    "User-Agent": USER_AGENT,
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    ...(cookies ? { Cookie: cookies } : {}),
    ...extra,
  };
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
