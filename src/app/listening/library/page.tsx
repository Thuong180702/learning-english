"use client";

import { Headphones, Play, Video } from "lucide-react";

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
      <div className="mb-8 rounded-[2.25rem] border border-slate-200 bg-white p-7 text-slate-950 shadow-xl shadow-slate-200/60 dark:border-teal-500/25 dark:bg-gradient-to-br dark:from-slate-900 dark:via-teal-950 dark:to-slate-950 dark:text-white dark:shadow-teal-950/30">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">
          Khám phá
        </p>
        <h1 className="font-heading text-4xl font-extrabold mb-2">Kho video</h1>
        <p className="text-slate-500 text-base font-medium dark:text-slate-300">
          Khám phá thư viện video học tập phong phú
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {[
          { title: "Beginner mix", icon: Headphones, tone: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
          { title: "Daily English", icon: Video, tone: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
          { title: "Podcast short", icon: Play, tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900 dark:shadow-slate-950/30 dark:ring-slate-700"
            >
              <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full ${item.tone}`}>
                <Icon className="h-7 w-7" />
              </div>
              <h3 className="font-heading text-xl font-extrabold text-slate-950 dark:text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                Playlist mẫu sẽ được kết nối khi thư viện nội dung sẵn sàng.
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
