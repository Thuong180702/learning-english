import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

interface Subtitle {
  start: number;
  end: number;
  text: string;
}

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;

    if (!videoId) {
      return NextResponse.json(
        { error: "Video ID không hợp lệ" },
        { status: 400 }
      );
    }

    let transcript: Array<{ text: string; duration: number; offset: number; lang?: string }> = [];
    let language = "vi";
    let autoTranslated = false;

    // Try Vietnamese first
    try {
      transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: "vi" });
      language = "vi";
    } catch {
      // Fallback to English
      try {
        transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
        language = "vi-translated";
        autoTranslated = true;
      } catch {
        // Last resort: try without language preference
        try {
          transcript = await YoutubeTranscript.fetchTranscript(videoId);
          language = "vi-translated";
          autoTranslated = true;
        } catch (error) {
          console.error("All transcript fetch attempts failed:", error);
          return NextResponse.json(
            {
              error: "Video này không có phụ đề",
              subtitles: [],
            },
            { status: 404 }
          );
        }
      }
    }

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: "Phụ đề trống", subtitles: [] },
        { status: 404 }
      );
    }

    // Convert to our format - youtube-transcript returns offset/duration in milliseconds
    let subtitles: Subtitle[] = transcript.map((item) => ({
      start: item.offset / 1000,
      end: (item.offset + item.duration) / 1000,
      text: decodeHtml(item.text),
    }));

    // If we got English captions, translate them to Vietnamese in batch
    if (autoTranslated) {
      subtitles = await translateBatch(subtitles, "en", "vi");
    }

    return NextResponse.json({
      subtitles,
      language,
      autoTranslated,
    });
  } catch (error) {
    console.error("Transcript fetch error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy phụ đề", subtitles: [] },
      { status: 500 }
    );
  }
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/<[^>]+>/g, "")
    .trim();
}

async function translateBatch(
  subtitles: Subtitle[],
  source: string,
  target: string
): Promise<Subtitle[]> {
  // Combine all texts with a separator that won't be translated, then split back
  const SEPARATOR = "\n|||\n";
  const combined = subtitles.map((s) => s.text).join(SEPARATOR);

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(combined)}`;
    const response = await fetch(url);
    if (!response.ok) return subtitles;

    const data = await response.json();
    if (!data || !data[0]) return subtitles;

    const translated = data[0].map((item: any) => item[0]).join("");
    const parts = translated.split(/\n\s*\|\|\|\s*\n/);

    if (parts.length === subtitles.length) {
      return subtitles.map((s, i) => ({ ...s, text: parts[i].trim() }));
    }
    return subtitles;
  } catch (error) {
    console.error("Batch translation error:", error);
    return subtitles;
  }
}
