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
      const { data: newVideo, error: createError } = await supabase
        .from("videos")
        .insert({
          youtube_id: videoId,
          title: `Video ${videoId}`,
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
