const LEARNING_TIME_ZONE = "Asia/Ho_Chi_Minh";
const DAILY_STUDY_SECONDS_GOAL = 30 * 60;
const DAILY_VIDEO_GOAL = 1;
const DAILY_WORD_GOAL = 5;

export type LearningEventType =
  | "study_time"
  | "video_added"
  | "video_started"
  | "video_completed"
  | "word_saved"
  | "test_completed";

interface LearningEventInput {
  type: LearningEventType;
  userId: string;
  videoId?: string | null;
  studySeconds?: number;
  positionSeconds?: number;
  metadata?: Record<string, unknown>;
}

interface DailyProgressRow {
  progress_date: string;
  study_seconds: number | null;
  xp: number | null;
  videos_added: number | null;
  videos_started: number | null;
  videos_completed: number | null;
  words_saved: number | null;
  tests_completed: number | null;
}

const EVENT_XP: Record<LearningEventType, number> = {
  study_time: 0,
  video_added: 5,
  video_started: 10,
  video_completed: 50,
  word_saved: 10,
  test_completed: 100,
};

export function getLearningDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LEARNING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function clampInt(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function hasActivity(row?: DailyProgressRow) {
  if (!row) return false;
  return (
    (row.study_seconds || 0) > 0 ||
    (row.videos_added || 0) > 0 ||
    (row.videos_started || 0) > 0 ||
    (row.videos_completed || 0) > 0 ||
    (row.words_saved || 0) > 0 ||
    (row.tests_completed || 0) > 0 ||
    (row.xp || 0) > 0
  );
}

function buildWeek(today: string, rows: DailyProgressRow[]) {
  const byDate = new Map(rows.map((row) => [row.progress_date, row]));
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    timeZone: "UTC",
  });

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const [year, month, day] = date.split("-").map(Number);
    const label = formatter.format(new Date(Date.UTC(year, month - 1, day)));

    return {
      date,
      label,
      active: hasActivity(byDate.get(date)),
      isToday: date === today,
    };
  });
}

function calculateStreak(today: string, rows: DailyProgressRow[]) {
  const byDate = new Map(rows.map((row) => [row.progress_date, row]));
  let cursor = hasActivity(byDate.get(today)) ? today : addDays(today, -1);
  let count = 0;

  while (hasActivity(byDate.get(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }

  return count;
}

function getStudyXp(studySeconds: number) {
  if (studySeconds <= 0) return 0;
  return Math.max(1, Math.floor(studySeconds / 60));
}

export async function recordLearningEvent(supabase: any, input: LearningEventInput) {
  const today = getLearningDate();
  const studySeconds =
    input.type === "study_time" ? clampInt(input.studySeconds, 1, 5 * 60) : 0;
  let xpDelta = input.type === "study_time" ? getStudyXp(studySeconds) : EVENT_XP[input.type];
  let videosAdded = input.type === "video_added" ? 1 : 0;
  let videosStarted = input.type === "video_started" ? 1 : 0;
  let videosCompleted = input.type === "video_completed" ? 1 : 0;
  const wordsSaved = input.type === "word_saved" ? 1 : 0;
  const testsCompleted = input.type === "test_completed" ? 1 : 0;

  if (input.videoId) {
    if (input.type === "study_time" || input.type === "video_started") {
      await upsertUserVideo(supabase, input.userId, input.videoId, {
        watchSecondsDelta: studySeconds,
        lastPosition: input.positionSeconds,
        completed: false,
      });
    }

    if (input.type === "video_completed") {
      const firstCompletion = await completeUserVideo(supabase, input.userId, input.videoId);
      if (!firstCompletion) {
        xpDelta = 0;
        videosCompleted = 0;
      }
    }

    if (input.type === "video_added") {
      const firstAdd = await upsertUserVideo(supabase, input.userId, input.videoId, {
        watchSecondsDelta: 0,
        completed: false,
      });
      if (!firstAdd) {
        xpDelta = 0;
        videosAdded = 0;
      }
    }
  }

  if (
    studySeconds === 0 &&
    xpDelta === 0 &&
    videosAdded === 0 &&
    videosStarted === 0 &&
    videosCompleted === 0 &&
    wordsSaved === 0 &&
    testsCompleted === 0
  ) {
    return { skipped: true };
  }

  const { data: current } = await supabase
    .from("learning_daily_progress")
    .select("*")
    .eq("user_id", input.userId)
    .eq("progress_date", today)
    .maybeSingle();

  const nextDaily = {
    user_id: input.userId,
    progress_date: today,
    study_seconds: (current?.study_seconds || 0) + studySeconds,
    xp: (current?.xp || 0) + xpDelta,
    videos_added: (current?.videos_added || 0) + videosAdded,
    videos_started: (current?.videos_started || 0) + videosStarted,
    videos_completed: (current?.videos_completed || 0) + videosCompleted,
    words_saved: (current?.words_saved || 0) + wordsSaved,
    tests_completed: (current?.tests_completed || 0) + testsCompleted,
  };

  const { error: dailyError } = await supabase
    .from("learning_daily_progress")
    .upsert(nextDaily, { onConflict: "user_id,progress_date" });

  if (dailyError) throw dailyError;

  return {
    skipped: false,
    date: today,
    xpDelta,
    studySeconds,
    daily: nextDaily,
  };
}

async function upsertUserVideo(
  supabase: any,
  userId: string,
  videoId: string,
  options: {
    watchSecondsDelta: number;
    lastPosition?: number;
    completed: boolean;
  }
) {
  const { data: existing } = await supabase
    .from("user_videos")
    .select("*")
    .eq("user_id", userId)
    .eq("video_id", videoId)
    .maybeSingle();

  const nextRow = {
    user_id: userId,
    video_id: videoId,
    watch_seconds: (existing?.watch_seconds || 0) + options.watchSecondsDelta,
    last_position:
      options.lastPosition === undefined
        ? existing?.last_position || 0
        : clampInt(options.lastPosition, 0, 24 * 60 * 60),
    completed: existing?.completed || options.completed,
    last_watched_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("user_videos")
    .upsert(nextRow, { onConflict: "user_id,video_id" });

  if (error) throw error;
  return !existing;
}

async function completeUserVideo(supabase: any, userId: string, videoId: string) {
  const { data: existing } = await supabase
    .from("user_videos")
    .select("*")
    .eq("user_id", userId)
    .eq("video_id", videoId)
    .maybeSingle();

  if (existing?.completed) return false;

  const { error } = await supabase
    .from("user_videos")
    .upsert(
      {
        user_id: userId,
        video_id: videoId,
        watch_seconds: existing?.watch_seconds || 0,
        last_position: existing?.last_position || 0,
        completed: true,
        completed_at: new Date().toISOString(),
        last_watched_at: new Date().toISOString(),
      },
      { onConflict: "user_id,video_id" }
    );

  if (error) throw error;
  return true;
}

export async function getLearningProgress(supabase: any, userId: string) {
  const today = getLearningDate();
  const since = addDays(today, -370);

  const { data: rows, error } = await supabase
    .from("learning_daily_progress")
    .select("*")
    .eq("user_id", userId)
    .gte("progress_date", since)
    .lte("progress_date", today)
    .order("progress_date", { ascending: false });

  if (error) throw error;

  const progressRows = (rows || []) as DailyProgressRow[];
  const todayRow =
    progressRows.find((row) => row.progress_date === today) ||
    ({
      progress_date: today,
      study_seconds: 0,
      xp: 0,
      videos_added: 0,
      videos_started: 0,
      videos_completed: 0,
      words_saved: 0,
      tests_completed: 0,
    } satisfies DailyProgressRow);

  const [videoTotal, vocabularyTotal] = await Promise.all([
    getCount(supabase, "user_videos", userId, { completed: true }),
    getCount(supabase, "vocabulary", userId),
  ]);

  const weekRows = progressRows.filter((row) => row.progress_date >= addDays(today, -6));
  const weekStudySeconds = weekRows.reduce(
    (sum, row) => sum + (row.study_seconds || 0),
    0
  );
  const weekXp = weekRows.reduce((sum, row) => sum + (row.xp || 0), 0);
  const currentStreak = calculateStreak(today, progressRows);
  const studyPercent = Math.min(
    100,
    Math.round(((todayRow.study_seconds || 0) / DAILY_STUDY_SECONDS_GOAL) * 100)
  );
  const missionItems = [
    {
      id: "daily-study",
      title: "30 phút nghe",
      description: "Tích lũy thời gian xem video hôm nay.",
      current: todayRow.study_seconds || 0,
      target: DAILY_STUDY_SECONDS_GOAL,
      unit: "seconds",
      completed: (todayRow.study_seconds || 0) >= DAILY_STUDY_SECONDS_GOAL,
      xpReward: 30,
    },
    {
      id: "daily-video",
      title: "Hoàn thành 1 video",
      description: "Xem hết ít nhất một video luyện nghe.",
      current: todayRow.videos_completed || 0,
      target: DAILY_VIDEO_GOAL,
      unit: "video",
      completed: (todayRow.videos_completed || 0) >= DAILY_VIDEO_GOAL,
      xpReward: 50,
    },
    {
      id: "daily-words",
      title: "Lưu 5 từ mới",
      description: "Bấm vào phụ đề và lưu từ vào sổ tay.",
      current: todayRow.words_saved || 0,
      target: DAILY_WORD_GOAL,
      unit: "word",
      completed: (todayRow.words_saved || 0) >= DAILY_WORD_GOAL,
      xpReward: 50,
    },
  ];
  const completedMissions = missionItems.filter((mission) => mission.completed).length;

  return {
    date: today,
    streak: {
      current: currentStreak,
      week: buildWeek(today, progressRows),
    },
    today: {
      studySeconds: todayRow.study_seconds || 0,
      studyMinutes: Math.floor((todayRow.study_seconds || 0) / 60),
      xp: todayRow.xp || 0,
      videosAdded: todayRow.videos_added || 0,
      videosStarted: todayRow.videos_started || 0,
      videosCompleted: todayRow.videos_completed || 0,
      wordsSaved: todayRow.words_saved || 0,
      testsCompleted: todayRow.tests_completed || 0,
      studyGoalSeconds: DAILY_STUDY_SECONDS_GOAL,
      studyPercent,
      missionPercent: Math.round((completedMissions / missionItems.length) * 100),
    },
    totals: {
      videosCompleted: videoTotal,
      wordsSaved: vocabularyTotal,
      studySecondsWeek: weekStudySeconds,
      studyMinutesWeek: Math.floor(weekStudySeconds / 60),
      xpWeek: weekXp,
      averageScore: null,
    },
    missions: missionItems,
    quest: {
      id: "streak-5",
      title: "Quest 5 ngày",
      current: Math.min(currentStreak, 5),
      target: 5,
      completed: currentStreak >= 5,
      xpReward: 50,
    },
  };
}

async function getCount(
  supabase: any,
  table: string,
  userId: string,
  filters?: Record<string, unknown>
) {
  let query = supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  Object.entries(filters || {}).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}
