import { NextResponse } from "next/server";
import { getLearningProgress } from "@/lib/learning-progress";
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

    const progress = await getLearningProgress(supabase, user.id);
    return NextResponse.json(progress);
  } catch (error: any) {
    console.error("Get learning progress error:", error);

    return NextResponse.json(
      {
        error:
          error?.code === "42P01"
            ? "Chưa chạy migration 003_learning_progress.sql trên Supabase"
            : "Đã xảy ra lỗi khi lấy tiến độ học tập",
      },
      { status: 500 }
    );
  }
}
