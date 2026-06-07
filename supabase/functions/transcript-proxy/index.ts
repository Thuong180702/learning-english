declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;
};

interface Subtitle {
  start: number;
  end: number;
  text: string;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: {
    simpleText?: string;
    runs?: Array<{ text?: string }>;
  };
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
const FETCH_TIMEOUT_MS = 10000;
const TRANSLATE_TIMEOUT_MS = 6000;
const YOUTUBE_GL = Deno.env.get("YOUTUBE_GL") || "VN";
const YOUTUBE_HL = Deno.env.get("YOUTUBE_HL") || "vi";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-transcript-proxy-secret",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("TRANSCRIPT_PROXY_SECRET");
  const suppliedSecret = request.headers.get("x-transcript-proxy-secret");
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const videoId = String(body.videoId || "");

    if (!YOUTUBE_ID_PATTERN.test(videoId)) {
      return json({ error: "Invalid video id" }, 400);
    }

    const result = await fetchTranscript(videoId);
    if (!result.subtitles.length) {
      return json({ error: "Transcript not found", subtitles: [] }, 404);
    }

    return json(result);
  } catch (error) {
    console.error("Transcript proxy error:", error);
    return json({ error: "Unable to fetch transcript", subtitles: [] }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function fetchTranscript(videoId: string) {
  const errors: unknown[] = [];
  let session: YoutubeSession | undefined;

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

  console.error("All transcript proxy attempts failed:", { videoId, errors });
  return { subtitles: [], language: "unknown", autoTranslated: false };
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

async function fetchTranscriptViaInnerTube(
  videoId: string,
  session?: YoutubeSession
) {
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
) {
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
) {
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

  const jsonText = readJsonObject(html, start);
  return JSON.parse(jsonText);
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

async function fetchTimedTextByUrl(url: string, session?: YoutubeSession) {
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
  const cookies = Deno.env.get("YOUTUBE_COOKIES");
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

async function prepareLanguageResult(subtitles: Subtitle[], language: string) {
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

async function translateBatch(subtitles: Subtitle[], source: string, target: string) {
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

async function translateTexts(texts: string[], source: string, target: string) {
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
    .map((part: string) => part.trim());
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
