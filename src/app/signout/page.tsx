"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { useEffect } from "react";

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-slate-600">Đang đăng xuất...</p>
      </div>
    </div>
  );
}
