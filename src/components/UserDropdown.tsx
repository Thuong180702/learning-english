"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  Moon,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";

interface UserDropdownProps {
  user: { email?: string };
  compact?: boolean;
}

export function UserDropdown({ user, compact = false }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div ref={dropdownRef} className="relative z-[9999]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 bg-gradient-to-r from-orange-50 to-rose-50 border-2 border-orange-200/60 hover:border-orange-300 hover:shadow-lg transition-all duration-200 ${
          compact
            ? "px-3 py-1 rounded-xl"
            : "px-4 py-2.5 rounded-2xl"
        }`}
      >
        <div className={`bg-gradient-to-br from-orange-500 to-rose-500 rounded-full flex items-center justify-center text-white font-bold shadow-md ${
          compact ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm"
        }`}>
          {(user?.user_metadata?.full_name?.[0] || user?.email?.[0] || user?.phone?.slice(-4)?.[0] || 'U').toUpperCase()}
        </div>
        <span className={`text-slate-700 font-medium truncate ${
          compact ? "text-xs max-w-[120px]" : "text-sm max-w-[140px]"
        }`}>
          {user?.user_metadata?.full_name || user?.email?.split('@')[0] || user?.phone?.slice(-4) || 'Người dùng'}
        </span>
        <ChevronDown
          className={`text-slate-600 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          } ${compact ? "w-3.5 h-3.5" : "w-4 h-4"}`}
        />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
      )}

      {isOpen && (
        <div className="absolute right-0 mt-3 w-72 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-orange-200/60 py-3 z-[9999] animate-fadeInDown pointer-events-auto">
          <div className="px-3 pb-3 border-b border-orange-200/50">
            <p className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
              Kỹ năng
            </p>
            <Link
              href="/listening"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2.5 text-purple-600 hover:bg-white/70 rounded-xl transition-all group"
            >
              <Headphones className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Listening</span>
            </Link>
            <Link
              href="/reading"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2.5 text-blue-600 hover:bg-white/70 rounded-xl transition-all group"
            >
              <BookOpen className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Reading</span>
            </Link>
            <Link
              href="/writing"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2.5 text-green-600 hover:bg-white/70 rounded-xl transition-all group"
            >
              <PenTool className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Writing</span>
            </Link>
            <Link
              href="/speaking"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2.5 text-orange-600 hover:bg-white/70 rounded-xl transition-all group"
            >
              <Mic className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Speaking</span>
            </Link>
          </div>

          <div className="px-3 py-3 border-b border-orange-200/50">
            <button
              type="button"
              className="w-full flex items-center px-4 py-2.5 text-slate-700 hover:bg-white/70 rounded-xl transition-all group"
            >
              <Moon className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Dark Mode</span>
            </button>
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2.5 text-slate-700 hover:bg-white/70 rounded-xl transition-all group"
            >
              <Settings className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Cài đặt tài khoản</span>
            </Link>
          </div>

          <div className="px-3 pt-3">
            <Link
              href="/signout"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2.5 text-red-600 hover:bg-red-50/80 rounded-xl transition-all group"
            >
              <LogOut className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Đăng xuất</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
