import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { youtubeUrl } = body;

    if (!youtubeUrl) {
      return NextResponse.json(
        { error: "URL YouTube là bắt buộc" },
        { status: 400 }
      );
    }

    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: "URL YouTube không hợp lệ" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if video already exists
    const { data: existingVideo } = await supabase
      .from("videos")
      .select("*")
      .eq("youtube_id", videoId)
      .single();

    if (existingVideo) {
      return NextResponse.json(existingVideo);
    }

    // Create new video entry
    const { data: newVideo, error } = await supabase
      .from("videos")
      .insert({
        youtube_id: videoId,
        title: `Video ${videoId}`,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Đã xảy ra lỗi khi thêm video" },
        { status: 500 }
      );
    }

    return NextResponse.json(newVideo);
  } catch (error) {
    console.error("Add video error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi thêm video" },
      { status: 500 }
    );
  }
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
