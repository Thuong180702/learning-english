import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { YoutubeTranscript } from "youtube-transcript";

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const DEFAULT_ENV_FILE = ".env.local";

function usage() {
  console.log(
    [
      "Usage:",
      "  npm run cache:transcript -- <youtube_id_or_url> [more_ids_or_urls]",
      "  npm run cache:transcript -- --sql <youtube_id_or_url>",
      "",
      "Notes:",
      "  - Writing to Supabase requires SUPABASE_SERVICE_ROLE_KEY.",
      "  - Without that key, pass --sql to print an UPDATE statement for Supabase SQL Editor.",
    ].join("\n")
  );
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function extractVideoId(input) {
  const value = input.trim();
  if (YOUTUBE_ID_PATTERN.test(value)) return value;

  try {
    const url = new URL(value);
    const watchId = url.searchParams.get("v");
    if (watchId && YOUTUBE_ID_PATTERN.test(watchId)) return watchId;

    const shortId = url.pathname.split("/").filter(Boolean).pop();
    if (shortId && YOUTUBE_ID_PATTERN.test(shortId)) return shortId;
  } catch {
    return null;
  }

  return null;
}

async function fetchTranscript(videoId) {
  const attempts = ["vi", "en", undefined];
  const errors = [];

  for (const language of attempts) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(
        videoId,
        language ? { lang: language } : undefined
      );
      const subtitles = normalizeTranscript(items);
      if (subtitles.length) {
        return {
          subtitles,
          language: language || items[0]?.lang || "unknown",
          autoTranslated: false,
        };
      }
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  throw new Error(errors.join(" | ") || "Transcript not found");
}

function normalizeTranscript(items) {
  if (!Array.isArray(items)) return [];

  const maxOffset = Math.max(0, ...items.map((item) => Number(item.offset || 0)));
  const maxDuration = Math.max(
    0,
    ...items.map((item) => Number(item.duration || 0))
  );
  const valuesAreMilliseconds = maxOffset > 1000 || maxDuration > 100;
  const divisor = valuesAreMilliseconds ? 1000 : 1;

  return items
    .map((item) => {
      const start = Number(item.offset || 0) / divisor;
      const duration = Number(item.duration || 0) / divisor;
      const text = decodeHtml(String(item.text || ""));

      if (!Number.isFinite(start) || !text) return null;

      return {
        start,
        end: start + Math.max(Number.isFinite(duration) ? duration : 0, 0.5),
        text,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

function decodeHtml(text) {
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

function buildPayload(result) {
  return {
    subtitles: result.subtitles,
    language: result.language,
    autoTranslated: result.autoTranslated,
    cachedAt: new Date().toISOString(),
  };
}

function sqlString(value) {
  return String(value).replace(/'/g, "''");
}

function printSql(videoId, payload) {
  const json = JSON.stringify(payload);
  console.log(
    [
      `UPDATE public.videos`,
      `SET subtitles = '${sqlString(json)}'::jsonb,`,
      `    cached_at = '${sqlString(payload.cachedAt)}'::timestamptz`,
      `WHERE youtube_id = '${sqlString(videoId)}';`,
    ].join("\n")
  );
}

async function saveToSupabase(videoId, payload) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return {
      ok: false,
      reason:
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for direct write.",
    };
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error, count } = await supabase
    .from("videos")
    .update({
      subtitles: payload,
      cached_at: payload.cachedAt,
    })
    .eq("youtube_id", videoId)
    .select("youtube_id", { count: "exact", head: true });

  if (error) return { ok: false, reason: error.message };
  if (count === 0) return { ok: false, reason: "Video row was not found." };

  return { ok: true };
}

async function main() {
  const args = process.argv.slice(2);
  const printOnlySql = args.includes("--sql");
  const envArg = args.find((arg) => arg.startsWith("--env="));
  const envFile = envArg ? envArg.slice("--env=".length) : DEFAULT_ENV_FILE;
  const inputs = args.filter((arg) => arg !== "--sql" && !arg.startsWith("--env="));

  loadEnvFile(path.resolve(process.cwd(), envFile));

  if (!inputs.length) {
    usage();
    process.exitCode = 1;
    return;
  }

  for (const input of inputs) {
    const videoId = extractVideoId(input);
    if (!videoId) {
      console.error(`Invalid YouTube video id or URL: ${input}`);
      process.exitCode = 1;
      continue;
    }

    console.log(`Fetching transcript for ${videoId}...`);
    const result = await fetchTranscript(videoId);
    const payload = buildPayload(result);
    console.log(
      `Fetched ${payload.subtitles.length} subtitles (${payload.language}).`
    );

    if (printOnlySql) {
      printSql(videoId, payload);
      continue;
    }

    const saved = await saveToSupabase(videoId, payload);
    if (saved.ok) {
      console.log(`Cached transcript in Supabase for ${videoId}.`);
      continue;
    }

    console.warn(`Supabase cache write skipped: ${saved.reason}`);
    console.warn("Run again with --sql or add SUPABASE_SERVICE_ROLE_KEY.");
    printSql(videoId, payload);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
