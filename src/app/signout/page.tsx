"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function SignOut() {
  const router = useRouter();

  useEffect(() => {
    const signOut = async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    };

    signOut();
  }, [router]);

  return (
    <div className="learning-shell flex min-h-screen items-center justify-center bg-[#f8fbff]">
      <div className="rounded-[2rem] border border-slate-200 bg-white/90 px-10 py-8 text-center shadow-xl shadow-slate-200/70 backdrop-blur">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
        <p className="font-semibold text-slate-600">Đang đăng xuất...</p>
      </div>
    </div>
  );
}
