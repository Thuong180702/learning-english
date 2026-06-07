"use client";

import { BookMarked } from "lucide-react";

export default function VocabularyPage() {
  return (
    <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
      <div className="mb-8 rounded-[2.25rem] bg-white p-7 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900 dark:shadow-slate-950/30 dark:ring-slate-700">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">
          Sổ tay
        </p>
        <h1 className="font-heading text-4xl font-extrabold text-slate-950 dark:text-white mb-2">
          Từ vựng
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base font-medium">
          Kho từ vựng cá nhân của bạn
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[2.25rem] border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-10 shadow-xl shadow-teal-100/60 dark:border-slate-700 dark:from-slate-900 dark:to-slate-900 dark:shadow-slate-950/30">
        <div className="absolute inset-0 learning-grid opacity-40" />
        <div className="relative max-w-xl">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500 text-white">
            <BookMarked className="h-8 w-8" />
          </div>
          <h2 className="font-heading text-3xl font-extrabold text-slate-950 dark:text-white">
            Chưa có từ nào trong sổ tay
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-400">
            Khi bạn lưu từ trong lúc xem video, chúng sẽ xuất hiện tại đây để ôn tập.
          </p>
        </div>
      </div>
    </div>
  );
}
