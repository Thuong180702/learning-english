"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-client";
import {
  BookOpen,
  ChevronDown,
  Headphones,
  LogOut,
  Mic,
  Moon,
  PenTool,
  Settings,
  Sun,
} from "lucide-react";

interface UserDropdownProps {
  user: User;
  compact?: boolean;
}

interface ProfileSummary {
  full_name: string | null;
  avatar_url: string | null;
}

export function UserDropdown({ user, compact = false }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!user?.id) return;

      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.warn("User profile fetch error:", error.message);
        setProfile(null);
        return;
      }

      setProfile(data as ProfileSummary | null);
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  };

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    user?.phone?.slice(-4) ||
    "Người dùng";
  const avatarUrl =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    "";
  const avatarLetter =
    displayName?.[0] ||
    user?.email?.[0] ||
    user?.phone?.slice(-4)?.[0] ||
    "U";

  return (
    <div ref={dropdownRef} className="relative z-[9999]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`learning-user-chip flex items-center gap-2 text-slate-800 transition-all duration-200 hover:-translate-y-0.5 dark:text-white ${
          compact ? "rounded-full px-3 py-1.5" : "rounded-full px-4 py-2.5"
        }`}
      >
        <div
          className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-teal-400 to-lime-300 font-bold text-slate-950 shadow-md ring-2 ring-white/80 dark:ring-slate-700 ${
            compact ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm"
          }`}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            avatarLetter.toUpperCase()
          )}
        </div>
        <span
          className={`learning-user-name truncate font-extrabold ${
            compact ? "max-w-[150px] text-sm" : "max-w-[160px] text-sm"
          }`}
        >
          {displayName}
        </span>
        <ChevronDown
          className={`text-slate-500 transition-transform duration-200 dark:text-slate-300 ${
            isOpen ? "rotate-180" : ""
          } ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`}
        />
      </button>

      {isOpen && <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />}

      {isOpen && (
        <div className="absolute right-0 z-[9999] mt-3 w-72 rounded-[1.75rem] border border-slate-200 bg-white/95 py-3 shadow-2xl shadow-slate-900/15 backdrop-blur-xl animate-fadeInDown pointer-events-auto dark:border-slate-700 dark:bg-slate-900/95">
          <div className="border-b border-slate-200 px-3 pb-3 dark:border-slate-700">
            <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Kỹ năng
            </p>
            <Link
              href="/listening"
              onClick={() => setIsOpen(false)}
              className="flex items-center rounded-2xl px-4 py-2.5 text-teal-700 transition-all hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
            >
              <Headphones className="mr-3 h-4 w-4" />
              <span className="font-medium">Listening</span>
            </Link>
            <Link
              href="/reading"
              onClick={() => setIsOpen(false)}
              className="flex items-center rounded-2xl px-4 py-2.5 text-sky-700 transition-all hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40"
            >
              <BookOpen className="mr-3 h-4 w-4" />
              <span className="font-medium">Reading</span>
            </Link>
            <Link
              href="/writing"
              onClick={() => setIsOpen(false)}
              className="flex items-center rounded-2xl px-4 py-2.5 text-emerald-700 transition-all hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              <PenTool className="mr-3 h-4 w-4" />
              <span className="font-medium">Writing</span>
            </Link>
            <Link
              href="/speaking"
              onClick={() => setIsOpen(false)}
              className="flex items-center rounded-2xl px-4 py-2.5 text-amber-700 transition-all hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
            >
              <Mic className="mr-3 h-4 w-4" />
              <span className="font-medium">Speaking</span>
            </Link>
          </div>

          <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-700">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex w-full items-center rounded-2xl px-4 py-2.5 text-slate-700 transition-all hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? (
                <Sun className="mr-3 h-4 w-4" />
              ) : (
                <Moon className="mr-3 h-4 w-4" />
              )}
              <span className="font-medium">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </button>
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center rounded-2xl px-4 py-2.5 text-slate-700 transition-all hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Settings className="mr-3 h-4 w-4" />
              <span className="font-medium">Cài đặt tài khoản</span>
            </Link>
          </div>

          <div className="px-3 pt-3">
            <Link
              href="/signout"
              onClick={() => setIsOpen(false)}
              className="flex items-center rounded-2xl px-4 py-2.5 text-red-600 transition-all hover:bg-red-50/80 dark:hover:bg-red-950/30"
            >
              <LogOut className="mr-3 h-4 w-4" />
              <span className="font-medium">Đăng xuất</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
