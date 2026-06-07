-- LearnEnglish Database Schema - Learning Progress
-- Migration: 003_learning_progress

-- Keep this migration safe for databases that already ran an older 001
-- before the shared updated_at trigger function was added there.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.user_videos (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  last_position INTEGER NOT NULL DEFAULT 0,
  watch_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_watched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY(user_id, video_id),
  CONSTRAINT user_videos_last_position_nonnegative CHECK (last_position >= 0),
  CONSTRAINT user_videos_watch_seconds_nonnegative CHECK (watch_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_videos_user_created
  ON public.user_videos(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_videos_user_completed
  ON public.user_videos(user_id, completed);

ALTER TABLE public.user_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own user videos" ON public.user_videos;
CREATE POLICY "Users can view own user videos"
  ON public.user_videos FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own user videos" ON public.user_videos;
CREATE POLICY "Users can insert own user videos"
  ON public.user_videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own user videos" ON public.user_videos;
CREATE POLICY "Users can update own user videos"
  ON public.user_videos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own user videos" ON public.user_videos;
CREATE POLICY "Users can delete own user videos"
  ON public.user_videos FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.learning_daily_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress_date DATE NOT NULL,
  study_seconds INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  videos_added INTEGER NOT NULL DEFAULT 0,
  videos_started INTEGER NOT NULL DEFAULT 0,
  videos_completed INTEGER NOT NULL DEFAULT 0,
  words_saved INTEGER NOT NULL DEFAULT 0,
  tests_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY(user_id, progress_date)
);

CREATE INDEX IF NOT EXISTS idx_learning_daily_progress_user_date
  ON public.learning_daily_progress(user_id, progress_date DESC);

ALTER TABLE public.learning_daily_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own daily progress" ON public.learning_daily_progress;
CREATE POLICY "Users can view own daily progress"
  ON public.learning_daily_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily progress" ON public.learning_daily_progress;
CREATE POLICY "Users can insert own daily progress"
  ON public.learning_daily_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily progress" ON public.learning_daily_progress;
CREATE POLICY "Users can update own daily progress"
  ON public.learning_daily_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Daily aggregates are the source of truth for progress. The old append-only
-- learning_events table is intentionally not kept because it grows quickly and
-- is not read by the app.
DROP TABLE IF EXISTS public.learning_events;

DROP TRIGGER IF EXISTS on_user_videos_updated ON public.user_videos;
CREATE TRIGGER on_user_videos_updated
  BEFORE UPDATE ON public.user_videos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_learning_daily_progress_updated ON public.learning_daily_progress;
CREATE TRIGGER on_learning_daily_progress_updated
  BEFORE UPDATE ON public.learning_daily_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
