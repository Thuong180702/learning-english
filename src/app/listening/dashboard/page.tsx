"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Award,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Circle,
  Flame,
  Headphones,
  Map,
  Play,
  Sparkles,
  Star,
  Target,
  Upload,
  Zap,
} from "lucide-react";
import { useListening } from "@/components/listening/ListeningLayoutShell";

export default function DashboardPage() {
  const router = useRouter();
  const { displayName, progress } = useListening();

  const streakCount = progress?.streak?.current || 0;
  const studyGoalMinutes = Math.floor((progress?.today?.studyGoalSeconds || 30 * 60) / 60);
  const studyMinutes = progress?.today?.studyMinutes || 0;
  const studyPercent = progress?.today?.studyPercent || 0;
  const minutesRemaining = Math.max(0, studyGoalMinutes - studyMinutes);
  const todayXp = progress?.today?.xp || 0;
  const todayWords = progress?.today?.wordsSaved || 0;
  const todayVideosCompleted = progress?.today?.videosCompleted || 0;
  const missionPercent = progress?.today?.missionPercent || 0;
  const weekStudyMinutes = progress?.totals?.studyMinutesWeek || 0;
  const totalWords = progress?.totals?.wordsSaved || 0;
  const totalVideosCompleted = progress?.totals?.videosCompleted || 0;
  const averageScore = progress?.totals?.averageScore;
  const quest = progress?.quest || {
    id: "streak-5",
    title: "Quest 5 ngày",
    current: Math.min(streakCount, 5),
    target: 5,
    completed: streakCount >= 5,
    xpReward: 50,
  };
  const missionSteps = progress?.missions || [];

  return (
    <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
      <section className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div
          className="relative min-h-[290px] overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-teal-300 via-emerald-200 to-lime-200 p-8 shadow-2xl shadow-teal-200/50 dark:from-slate-900 dark:via-slate-800 dark:to-teal-950 dark:shadow-slate-950/40"
          style={{
            clipPath:
              "polygon(0 0, 96% 0, 100% 14%, 100% 100%, 5% 100%, 0 88%)",
          }}
        >
          <div className="absolute inset-0 learning-grid opacity-50" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-extrabold text-teal-800 shadow-sm dark:bg-slate-950/70 dark:text-teal-200 dark:ring-1 dark:ring-teal-400/20">
                <Sparkles className="h-4 w-4" />
                Hôm nay luyện nghe nhẹ nhàng
              </div>
              <h1 className="font-heading text-4xl font-extrabold leading-tight text-slate-950 md:text-5xl dark:text-white">
                Xin chào, <span className="learning-user-name inline-block">{displayName}</span>
              </h1>
              <p className="mt-4 max-w-xl text-base font-medium leading-7 text-slate-700 dark:text-slate-300">
                Chọn một video, bắt nhịp phụ đề và gom từ mới vào sổ tay của bạn.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/listening/myvideo")}
                  className="learning-btn-create inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-extrabold"
                >
                  <Play className="h-4 w-4" />
                  Tạo bài nghe mới
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/listening/vocabulary")}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-white/[0.85] px-6 text-sm font-extrabold text-slate-800 shadow-sm ring-1 ring-white/80 transition hover:-translate-y-0.5 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
                >
                  <BookOpen className="h-4 w-4" />
                  Xem từ vựng
                </button>
              </div>
            </div>

            <div className="relative hidden min-h-[230px] lg:block">
              <div className="absolute right-4 top-4 flex h-28 w-28 rotate-6 items-center justify-center rounded-[2rem] bg-white/70 text-teal-700 shadow-xl dark:bg-slate-900/85 dark:text-teal-200">
                <BookOpen className="h-10 w-10" />
              </div>
              <div className="absolute bottom-8 left-0 flex h-20 w-32 -rotate-6 items-center justify-center rounded-full bg-amber-300 text-slate-950 shadow-xl">
                <Headphones className="h-8 w-8" />
              </div>
              <div className="absolute bottom-0 right-0 h-52 w-52 animate-float-soft">
                <Image
                  src="/image/logo.png"
                  alt="LearnEnglish logo"
                  fill
                  className="object-contain p-4 drop-shadow-2xl"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl shadow-slate-200/70 dark:border-teal-500/25 dark:bg-gradient-to-br dark:from-slate-900 dark:via-teal-950 dark:to-slate-950 dark:text-white dark:shadow-teal-950/30">
          <div className="absolute inset-0 learning-grid opacity-40" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">
                  Lộ trình
                </p>
                <h2 className="mt-2 font-heading text-2xl font-extrabold">
                  {studyGoalMinutes} phút nghe
                </h2>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-300 text-slate-950">
                <Target className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-300">Tiến độ hôm nay</span>
                <span className="font-extrabold text-teal-700 dark:text-teal-200">
                  {studyMinutes}/{studyGoalMinutes} phút · còn {minutesRemaining} phút
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-300 to-lime-300"
                  style={{ width: `${studyPercent}%` }}
                />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[
                [String(streakCount), "ngày"],
                [String(todayVideosCompleted), "video"],
                [String(todayXp), "XP"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-[1.35rem] bg-slate-50 px-3 py-4 text-center dark:bg-white/[0.08]"
                >
                  <p className="font-heading text-2xl font-extrabold text-slate-950 dark:text-white">
                    {value}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="relative overflow-hidden rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-xl shadow-emerald-100/60 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <Map className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-heading text-2xl font-extrabold text-slate-900 dark:text-white">
                Nhiệm vụ hôm nay
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                Tích lũy {studyGoalMinutes} phút nghe, hoàn thành 1 video và lưu 5 từ mới.
              </p>
            </div>
            <div className="rounded-full bg-emerald-50 px-5 py-3 text-center ring-1 ring-emerald-100 dark:bg-slate-800 dark:ring-slate-700">
              <p className="font-heading text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {missionPercent}%
              </p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Hoàn thành</p>
            </div>
          </div>
          <div className="mt-7 flex items-center gap-3">
            {(missionSteps.length
              ? missionSteps
              : [
                  { id: "daily-study", completed: false },
                  { id: "daily-video", completed: false },
                  { id: "daily-words", completed: false },
                ]
            ).map((mission: any, step: number) => (
              <div key={mission.id} className="flex flex-1 items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    mission.completed
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                  }`}
                >
                  {mission.completed ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>
                {step < (missionSteps.length || 3) - 1 && (
                  <div className="h-1 flex-1 rounded-full bg-slate-100 dark:bg-slate-800" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {[
            {
              title: quest.title,
              value: `${quest.current}/${quest.target}`,
              icon: Star,
              color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
            },
            {
              title: "Từ mới",
              value: String(todayWords),
              icon: BookMarked,
              color: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
            },
            {
              title: "Điểm luyện",
              value: `${todayXp} XP`,
              icon: Award,
              color: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex items-center gap-4 rounded-[1.75rem] bg-white p-4 shadow-lg shadow-slate-200/60 ring-1 ring-slate-100 dark:bg-slate-900 dark:shadow-slate-950/30 dark:ring-slate-700"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${item.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{item.title}</p>
                  <p className="font-heading text-2xl font-extrabold text-slate-900 dark:text-white">
                    {item.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">
              Tổng quan
            </p>
            <h2 className="font-heading text-2xl font-extrabold text-slate-950 dark:text-white">
              Bảng tiến bộ của bạn
            </h2>
          </div>
          <button
            type="button"
            onClick={() => router.push("/listening/myvideo")}
            className="hidden rounded-full bg-white px-4 py-2 text-sm font-bold text-teal-700 shadow-sm ring-1 ring-slate-200 sm:inline-flex dark:bg-slate-900 dark:text-teal-200 dark:ring-slate-700"
          >
            Thêm video
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              label: "Video hoàn thành",
              value: String(totalVideosCompleted),
              icon: Play,
              tone: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/40",
            },
            {
              label: "Từ vựng đã học",
              value: String(totalWords),
              icon: BookMarked,
              tone: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/40",
            },
            {
              label: "Phút học tuần này",
              value: `${weekStudyMinutes} phút`,
              icon: Flame,
              tone: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40",
            },
            {
              label: "Điểm thi TB",
              value: averageScore === null || averageScore === undefined ? "--" : String(averageScore),
              icon: Zap,
              tone: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:ring-fuchsia-900/40",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={`min-h-[150px] rounded-[2rem] p-5 shadow-sm ring-1 ${stat.tone}`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-900">
                  <Icon className="h-6 w-6" />
                </div>
                <p className="mt-5 font-heading text-3xl font-extrabold">{stat.value}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-400">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
