import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập" },
        { status: 401 }
      );
    }

    // Check if vocabulary exists and belongs to user
    const { data: vocabulary } = await supabase
      .from("vocabulary")
      .select("id, user_id")
      .eq("id", params.id)
      .single();

    if (!vocabulary) {
      return NextResponse.json(
        { error: "Từ vựng không tìm thấy" },
        { status: 404 }
      );
    }

    if (vocabulary.user_id !== user.id) {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa từ vựng này" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("vocabulary")
      .delete()
      .eq("id", params.id);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Đã xảy ra lỗi khi xóa từ vựng" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Xóa từ vựng thành công" });
  } catch (error) {
    console.error("Delete vocabulary error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xóa từ vựng" },
      { status: 500 }
    );
  }
}
