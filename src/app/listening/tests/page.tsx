"use client";

import { Award, BookOpen, Zap } from "lucide-react";

export default function TestsPage() {
  return (
    <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
      <div className="mb-8 rounded-[2.25rem] bg-white p-7 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900 dark:shadow-slate-950/30 dark:ring-slate-700">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">
          Kiểm tra
        </p>
        <h1 className="font-heading text-4xl font-extrabold text-slate-950 dark:text-white mb-2">
          Thi Thử
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base font-medium">
          Kiểm tra năng lực và rèn luyện kỹ năng
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {[
          { title: "Listening sprint", icon: Zap, color: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300" },
          { title: "Vocabulary check", icon: BookOpen, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
          { title: "Mini mock test", icon: Award, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900 dark:shadow-slate-950/30 dark:ring-slate-700"
            >
              <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full ${item.color}`}>
                <Icon className="h-7 w-7" />
              </div>
              <h3 className="font-heading text-xl font-extrabold text-slate-950 dark:text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                Bộ luyện tập sẽ mở khi hệ thống bài kiểm tra được bổ sung.
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
