import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// GET /api/subtitle-progress?videoId=<youtube_id>
// Returns the list of completed subtitle indices for the user
export async function GET(request: NextRequest) {
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

    const youtubeId = request.nextUrl.searchParams.get("videoId");
    if (!youtubeId) {
      return NextResponse.json(
        { error: "Thiếu tham số videoId" },
        { status: 400 }
      );
    }

    // Resolve youtube_id -> video.id
    const { data: video } = await supabase
      .from("videos")
      .select("id")
      .eq("youtube_id", youtubeId)
      .maybeSingle();

    if (!video) {
      return NextResponse.json({ completed: [], items: [] });
    }

    const { data, error } = await supabase
      .from("subtitle_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("video_id", video.id)
      .eq("completed", true)
      .order("subtitle_index", { ascending: true });

    if (error) {
      // Table might not exist yet - return empty list
      if (error.code === "42P01") {
        return NextResponse.json({
          completed: [],
          items: [],
          warning: "Chưa chạy migration 004_subtitle_progress.sql",
        });
      }
      throw error;
    }

    return NextResponse.json({
      completed: (data || []).map((row: any) => row.subtitle_index),
      items: data || [],
    });
  } catch (error: any) {
    console.error("Get subtitle progress error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy tiến độ phụ đề" },
      { status: 500 }
    );
  }
}

// POST /api/subtitle-progress
// Save (or upsert) progress for one subtitle
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      videoId: youtubeId,
      subtitleIndex,
      subtitleStart,
      subtitleText,
      userTranslation,
      referenceTranslation,
      matchResult,
      completed,
    } = body;

    if (!youtubeId || subtitleIndex === undefined || subtitleIndex === null) {
      return NextResponse.json(
        { error: "Thiếu tham số videoId hoặc subtitleIndex" },
        { status: 400 }
      );
    }

    // Resolve youtube_id -> video.id
    const { data: video } = await supabase
      .from("videos")
      .select("id")
      .eq("youtube_id", youtubeId)
      .maybeSingle();

    if (!video) {
      return NextResponse.json(
        { error: "Không tìm thấy video" },
        { status: 404 }
      );
    }

    // Check if record already exists
    const { data: existing } = await supabase
      .from("subtitle_progress")
      .select("attempts")
      .eq("user_id", user.id)
      .eq("video_id", video.id)
      .eq("subtitle_index", subtitleIndex)
      .maybeSingle();

    const nextRow: any = {
      user_id: user.id,
      video_id: video.id,
      subtitle_index: subtitleIndex,
      subtitle_start: subtitleStart || 0,
      subtitle_text: subtitleText || null,
      user_translation: userTranslation || null,
      reference_translation: referenceTranslation || null,
      match_result: matchResult || null,
      completed: completed !== false,
      completed_at: new Date().toISOString(),
      attempts: (existing?.attempts || 0) + 1,
    };

    const { error } = await supabase
      .from("subtitle_progress")
      .upsert(nextRow, { onConflict: "user_id,video_id,subtitle_index" });

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json(
          { error: "Chưa chạy migration 004_subtitle_progress.sql trên Supabase" },
          { status: 500 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Save subtitle progress error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lưu tiến độ phụ đề" },
      { status: 500 }
    );
  }
}

// DELETE /api/subtitle-progress?videoId=<youtube_id>&subtitleIndex=<n>
// Or delete all progress for video if subtitleIndex omitted
export async function DELETE(request: NextRequest) {
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

    const youtubeId = request.nextUrl.searchParams.get("videoId");
    const subtitleIndexParam = request.nextUrl.searchParams.get("subtitleIndex");

    if (!youtubeId) {
      return NextResponse.json(
        { error: "Thiếu tham số videoId" },
        { status: 400 }
      );
    }

    const { data: video } = await supabase
      .from("videos")
      .select("id")
      .eq("youtube_id", youtubeId)
      .maybeSingle();

    if (!video) {
      return NextResponse.json({ success: true });
    }

    let query = supabase
      .from("subtitle_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("video_id", video.id);

    if (subtitleIndexParam !== null) {
      query = query.eq("subtitle_index", Number(subtitleIndexParam));
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete subtitle progress error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xóa tiến độ phụ đề" },
      { status: 500 }
    );
  }
}
