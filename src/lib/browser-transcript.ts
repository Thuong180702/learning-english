export interface BrowserSubtitle {
  start: number;
  end: number;
  text: string;
}

export interface BrowserTranscriptResult {
  subtitles: BrowserSubtitle[];
  language: string;
  autoTranslated: boolean;
  source: "browser-cache" | "browser-youtube";
}

interface CaptionTrack {
  languageCode: string;
  kind?: string;
  name?: string;
}

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export async function fetchBrowserTranscript(
  videoId: string
): Promise<BrowserTranscriptResult | null> {
  if (!YOUTUBE_ID_PATTERN.test(videoId)) return null;

  const cached = readCachedTranscript(videoId);
  if (cached) return cached;

  const tracks = await fetchTimedTextTracks(videoId);
  if (!tracks.length) return null;

  const track = selectBestTrack(tracks);
  const subtitles = await fetchTimedText(videoId, track);
  if (!subtitles.length) return null;

  const result: BrowserTranscriptResult = {
    subtitles,
    language: track.languageCode || "unknown",
    autoTranslated: false,
    source: "browser-youtube",
  };

  writeCachedTranscript(videoId, result);
  return result;
}

async function fetchTimedTextTracks(videoId: string): Promise<CaptionTrack[]> {
  const url =
    `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(
      videoId
    )}` + "&hl=vi&gl=VN";
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) return [];

  const xml = await response.text();
  if (!xml.trim()) return [];

  const document = new DOMParser().parseFromString(xml, "text/xml");
  return Array.from(document.querySelectorAll("track"))
    .map((track) => ({
      languageCode:
        track.getAttribute("lang_code") || track.getAttribute("lang") || "",
      kind: track.getAttribute("kind") || undefined,
      name: track.getAttribute("name") || undefined,
    }))
    .filter((track) => track.languageCode);
}

function selectBestTrack(tracks: CaptionTrack[]) {
  return (
    tracks.find((track) => track.languageCode === "vi") ||
    tracks.find((track) => track.languageCode.toLowerCase().startsWith("vi-")) ||
    tracks.find((track) => track.languageCode === "en") ||
    tracks.find((track) => track.kind !== "asr") ||
    tracks[0]
  );
}

async function fetchTimedText(videoId: string, track: CaptionTrack) {
  const params = new URLSearchParams({
    v: videoId,
    fmt: "json3",
    lang: track.languageCode,
  });

  if (track.kind) params.set("kind", track.kind);
  if (track.name) params.set("name", track.name);

  const response = await fetch(
    `https://www.youtube.com/api/timedtext?${params.toString()}`,
    { credentials: "include" }
  );
  if (!response.ok) return [];

  const body = await response.text();
  if (!body.trim()) return [];

  try {
    return parseJson3Transcript(JSON.parse(body));
  } catch {
    return parseXmlTranscript(body);
  }
}

function parseJson3Transcript(data: any): BrowserSubtitle[] {
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
      if (!Number.isFinite(start) || !text) return null;

      return {
        start,
        end: start + Math.max(Number.isFinite(duration) ? duration : 0, 0.5),
        text: decodeHtml(text),
      };
    })
    .filter((item: BrowserSubtitle | null): item is BrowserSubtitle => item !== null)
    .sort((a: BrowserSubtitle, b: BrowserSubtitle) => a.start - b.start);
}

function parseXmlTranscript(xml: string): BrowserSubtitle[] {
  const subtitles: BrowserSubtitle[] = [];
  const paragraphRegex = /<p\s+[^>]*t="(\d+)"[^>]*d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  const classicRegex = /<text\s+[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;

  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(xml)) !== null) {
    const start = Number(match[1]) / 1000;
    const duration = Number(match[2]) / 1000;
    const text = decodeHtml(match[3].replace(/<[^>]+>/g, ""));
    if (text) subtitles.push({ start, end: start + Math.max(duration, 0.5), text });
  }

  if (subtitles.length > 0) {
    return subtitles.sort((a, b) => a.start - b.start);
  }

  while ((match = classicRegex.exec(xml)) !== null) {
    const start = Number(match[1]);
    const duration = Number(match[2]);
    const text = decodeHtml(match[3]);
    if (text) subtitles.push({ start, end: start + Math.max(duration, 0.5), text });
  }

  return subtitles.sort((a, b) => a.start - b.start);
}

function readCachedTranscript(
  videoId: string
): BrowserTranscriptResult | null {
  try {
    const raw = window.localStorage.getItem(getCacheKey(videoId));
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (
      cached?.version !== CACHE_VERSION ||
      Date.now() - Number(cached.cachedAt || 0) > CACHE_TTL_MS ||
      !Array.isArray(cached.subtitles)
    ) {
      window.localStorage.removeItem(getCacheKey(videoId));
      return null;
    }

    const subtitles = normalizeCachedSubtitles(cached.subtitles);
    if (!subtitles.length) return null;

    return {
      subtitles,
      language: typeof cached.language === "string" ? cached.language : "vi",
      autoTranslated: cached.autoTranslated === true,
      source: "browser-cache",
    };
  } catch {
    return null;
  }
}

function writeCachedTranscript(videoId: string, result: BrowserTranscriptResult) {
  try {
    window.localStorage.setItem(
      getCacheKey(videoId),
      JSON.stringify({
        version: CACHE_VERSION,
        cachedAt: Date.now(),
        subtitles: result.subtitles,
        language: result.language,
        autoTranslated: result.autoTranslated,
      })
    );
  } catch {
    // Browser storage can be unavailable or full. The transcript still works.
  }
}

function normalizeCachedSubtitles(items: unknown[]) {
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
    .filter((item): item is BrowserSubtitle => item !== null)
    .sort((a, b) => a.start - b.start);
}

function getCacheKey(videoId: string) {
  return `learnenglish:transcript:${CACHE_VERSION}:${videoId}`;
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
