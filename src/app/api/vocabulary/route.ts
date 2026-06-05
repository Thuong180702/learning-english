import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "newest";

    let query = supabase
      .from("vocabulary")
      .select(`
        *,
        videos (title, youtube_id)
      `)
      .eq("user_id", user.id);

    if (search) {
      query = query.ilike("word", `%${search}%`);
    }

    if (sort === "alphabetical") {
      query = query.order("word", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data: vocabularies, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Đã xảy ra lỗi khi lấy danh sách từ vựng" },
        { status: 500 }
      );
    }

    return NextResponse.json(vocabularies);
  } catch (error) {
    console.error("Get vocabulary error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lấy danh sách từ vựng" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { word, phonetic, meaning, sentence, videoId, sentenceIndex } = body;

    if (!word) {
      return NextResponse.json(
        { error: "Từ vựng là bắt buộc" },
        { status: 400 }
      );
    }

    // Check if word already exists for this user
    const { data: existing } = await supabase
      .from("vocabulary")
      .select("id")
      .eq("user_id", user.id)
      .ilike("word", word)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Từ này đã được lưu trước đó" },
        { status: 400 }
      );
    }

    const { data: vocabulary, error } = await supabase
      .from("vocabulary")
      .insert({
        user_id: user.id,
        word,
        phonetic,
        meaning,
        sentence,
        video_id: videoId,
        sentence_index: sentenceIndex,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Đã xảy ra lỗi khi lưu từ vựng" },
        { status: 500 }
      );
    }

    return NextResponse.json(vocabulary);
  } catch (error) {
    console.error("Save vocabulary error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi lưu từ vựng" },
      { status: 500 }
    );
  }
}
