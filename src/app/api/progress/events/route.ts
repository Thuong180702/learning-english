import { NextRequest, NextResponse } from "next/server";
import {
  type LearningEventType,
  getLearningProgress,
  recordLearningEvent,
} from "@/lib/learning-progress";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const EVENT_TYPES: LearningEventType[] = [
  "study_time",
  "video_added",
  "video_started",
  "video_completed",
  "word_saved",
  "test_completed",
];

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
    const type = body.type as LearningEventType;

    if (!EVENT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Loại sự kiện học tập không hợp lệ" },
        { status: 400 }
      );
    }

    const result = await recordLearningEvent(supabase, {
      type,
      userId: user.id,
      videoId: body.videoId || null,
      studySeconds: body.studySeconds,
      positionSeconds: body.positionSeconds,
      metadata: body.metadata,
    });
    const progress = await getLearningProgress(supabase, user.id);

    return NextResponse.json({ result, progress });
  } catch (error: any) {
    console.error("Record learning event error:", error);

    return NextResponse.json(
      {
        error:
          error?.code === "42P01"
            ? "Chưa chạy migration 003_learning_progress.sql trên Supabase"
            : "Đã xảy ra lỗi khi ghi tiến độ học tập",
      },
      { status: 500 }
    );
  }
}
