"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flame,
  LayoutDashboard,
  Star,
  Upload,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProgress {
  streak: number;
  weekDays: Array<{
    date: string;
    label: string;
    active: boolean;
    isToday: boolean;
  }>;
}

interface ListeningSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  progress?: SidebarProgress;
}

const NAV_ITEMS = [
  { href: "/listening/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "text-teal-300" },
  { href: "/listening/myvideo", label: "Video của tôi", icon: Upload, color: "text-sky-300" },
  { href: "/listening/library", label: "Kho video", icon: Video, color: "text-lime-300" },
  { href: "/listening/vocabulary", label: "Từ vựng", icon: BookMarked, color: "text-amber-300" },
  { href: "/listening/tests", label: "Thi Thử", icon: FileText, color: "text-fuchsia-300" },
];

export function ListeningSidebar({ collapsed, onToggle, progress }: ListeningSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const streakCount = progress?.streak || 0;
  const weekDays =
    progress?.weekDays ||
    ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => ({
      date: label,
      label,
      active: false,
      isToday: false,
    }));

  const isActive = (href: string) => {
    // /listening/myvideo also matches /listening/video/[id] (the learning page)
    if (href === "/listening/myvideo") {
      return pathname === href || pathname.startsWith("/listening/video/");
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside
      className={`${
        collapsed ? "w-20" : "w-72"
      } fixed left-0 top-0 bottom-0 z-40 flex flex-col overflow-visible border-r border-slate-200 bg-white/95 text-slate-700 shadow-2xl shadow-slate-200/70 transition-all duration-300 dark:border-slate-800 dark:bg-[#0f172a] dark:text-slate-100 dark:shadow-slate-950/40`}
    >
      <div className="absolute inset-0 opacity-40 learning-grid dark:opacity-30" />
      <div className="relative z-10 flex h-full flex-col">
        {/* Logo */}
        <div className={`${collapsed ? "px-3" : "px-5"} py-5`}>
          <Link
            href="/"
            className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}
          >
            <div className="relative h-12 w-12 shrink-0 rotate-[-5deg] rounded-[1.35rem] bg-lime-200 shadow-lg shadow-lime-400/20">
              <Image
                src="/image/logo.png"
                alt="LearnEnglish"
                fill
                className="object-contain p-1.5"
              />
            </div>
            {!collapsed && (
              <div>
                <p className="font-heading text-xl font-extrabold leading-tight text-slate-950 dark:text-white">
                  LearnEnglish
                </p>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">
                  Video lab
                </p>
              </div>
            )}
          </Link>
        </div>

        {collapsed && (
          <div className="mb-5 flex justify-center">
            <div className="streak-flame-badge">
              <Flame fill="currentColor" />
              <span>{streakCount}</span>
            </div>
          </div>
        )}

        {!collapsed && (
          <div className="relative mx-4 mb-4 overflow-hidden rounded-[2rem] border border-slate-200 bg-white/80 p-4 shadow-lg shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.08] dark:shadow-teal-950/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                  Streak
                </p>
                <p className="mt-1 font-heading text-2xl font-extrabold text-slate-950 dark:text-white">
                  {streakCount} ngày
                </p>
              </div>
              <div className="streak-flame-badge">
                <Flame fill="currentColor" />
                <span>{streakCount}</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div key={day.date} className="text-center">
                  <div
                    className={`mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full border ${
                      day.active
                        ? "border-teal-200 bg-teal-300 text-slate-900"
                        : "border-slate-200 bg-slate-100 text-slate-400 dark:border-white/20 dark:bg-white/5 dark:text-slate-400"
                    }`}
                  >
                    <Star className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] text-slate-400">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className={`${collapsed ? "px-3" : "px-4"} relative z-10 flex-1 space-y-2`}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Button
                key={item.href}
                variant="ghost"
                onClick={() => router.push(item.href)}
                className={`${
                  collapsed ? "w-14 px-0 justify-center" : "w-full justify-start"
                } h-12 rounded-[1.4rem] text-sm font-bold ${
                  active
                    ? "learning-active-pill"
                    : "text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10"
                }`}
                title={item.label}
              >
                <Icon className={`w-4 h-4 ${collapsed ? "mx-auto" : `mr-3 ${item.color}`}`} />
                {!collapsed && item.label}
              </Button>
            );
          })}
        </nav>
      </div>

      {/* Collapse Button */}
      <button
        onClick={onToggle}
        className={`${
          collapsed ? "-right-5 top-10" : "-right-4 top-10"
        } absolute z-50 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`}
        type="button"
        aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
