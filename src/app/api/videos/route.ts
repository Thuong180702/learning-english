import { NextRequest, NextResponse } from "next/server";
import { recordLearningEvent } from "@/lib/learning-progress";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập" },
        { status: 401 }
      );
    }

    const { data: userVideos, error } = await supabase
      .from("user_videos")
      .select(
        `
        created_at,
        completed,
        last_position,
        watch_seconds,
        videos (*)
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Get user videos error:", error);
      return NextResponse.json(
        {
          error:
            error.code === "42P01"
              ? "Chưa chạy migration 003_learning_progress.sql trên Supabase"
              : "Đã xảy ra lỗi khi lấy danh sách video",
        },
        { status: 500 }
      );
    }

    const videos = (userVideos || [])
      .map((item: any) => ({
        ...item.videos,
        user_video_created_at: item.created_at,
        completed: item.completed,
        last_position: item.last_position,
        watch_seconds: item.watch_seconds,
      }))
      .filter((item: any) => item?.id);

    return NextResponse.json(videos);
  } catch (error) {
    console.error("Get videos error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy danh sách video" },
      { status: 500 }
    );
  }
}

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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập" },
        { status: 401 }
      );
    }

    // Check if video already exists
    const { data: existingVideo } = await supabase
      .from("videos")
      .select("*")
      .eq("youtube_id", videoId)
      .maybeSingle();

    if (existingVideo) {
      await recordLearningEvent(supabase, {
        type: "video_added",
        userId: user.id,
        videoId: existingVideo.id,
        metadata: { youtubeId: videoId },
      });

      return NextResponse.json(existingVideo);
    }

    // Fetch video title from YouTube oEmbed API
    let videoTitle = `Video ${videoId}`;
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const oembedResponse = await fetch(oembedUrl);
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        videoTitle = oembedData.title || videoTitle;
      }
    } catch (error) {
      console.error("Failed to fetch video title:", error);
    }

    // Create new video entry
    const { data: newVideo, error } = await supabase
      .from("videos")
      .insert({
        youtube_id: videoId,
        title: videoTitle,
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

    await recordLearningEvent(supabase, {
      type: "video_added",
      userId: user.id,
      videoId: newVideo.id,
      metadata: { youtubeId: videoId },
    });

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
