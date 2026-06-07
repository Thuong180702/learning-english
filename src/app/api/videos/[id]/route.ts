import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const videoId = params.id;

    const { data: video, error } = await supabase
      .from("videos")
      .select("*")
      .eq("youtube_id", videoId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Đã xảy ra lỗi khi lấy thông tin video" },
        { status: 500 }
      );
    }

    if (!video) {
      // Create a new video entry if it doesn't exist
      // First fetch the title from YouTube oEmbed API
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

      const { data: newVideo, error: createError } = await supabase
        .from("videos")
        .insert({
          youtube_id: videoId,
          title: videoTitle,
        })
        .select()
        .single();

      if (createError) {
        console.error("Supabase create error:", createError);
        return NextResponse.json(
          { error: "Đã xảy ra lỗi khi tạo video" },
          { status: 500 }
        );
      }

      return NextResponse.json(newVideo);
    }

    return NextResponse.json(video);
  } catch (error) {
    console.error("Get video error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy thông tin video" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const videoId = params.id;

    // Delete from user_videos first (foreign key constraint)
    await supabase
      .from("user_videos")
      .delete()
      .eq("user_id", user.id)
      .eq("video_id", videoId);

    // Delete from videos table
    const { error } = await supabase
      .from("videos")
      .delete()
      .eq("id", videoId);

    if (error) {
      console.error("Delete video error:", error);
      return NextResponse.json(
        { error: "Đã xảy ra lỗi khi xóa video" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete video error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xóa video" },
      { status: 500 }
    );
  }
}
