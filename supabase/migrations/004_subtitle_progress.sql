-- LearnEnglish Database Schema - Subtitle Progress
-- Migration: 004_subtitle_progress

CREATE TABLE IF NOT EXISTS public.subtitle_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  subtitle_index INTEGER NOT NULL,
  subtitle_start REAL NOT NULL,
  subtitle_text TEXT,
  user_translation TEXT,
  reference_translation TEXT,
  match_result TEXT CHECK (match_result IN ('correct', 'close', 'incorrect', 'manual')),
  completed BOOLEAN NOT NULL DEFAULT TRUE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attempts SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY(user_id, video_id, subtitle_index),
  CONSTRAINT subtitle_progress_subtitle_index_nonnegative CHECK (subtitle_index >= 0),
  CONSTRAINT subtitle_progress_subtitle_start_nonnegative CHECK (subtitle_start >= 0),
  CONSTRAINT subtitle_progress_attempts_positive CHECK (attempts > 0)
);

CREATE INDEX IF NOT EXISTS idx_subtitle_progress_completed_by_video
  ON public.subtitle_progress(user_id, video_id, subtitle_index)
  WHERE completed;

ALTER TABLE public.subtitle_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subtitle progress" ON public.subtitle_progress;
CREATE POLICY "Users can view own subtitle progress"
  ON public.subtitle_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own subtitle progress" ON public.subtitle_progress;
CREATE POLICY "Users can insert own subtitle progress"
  ON public.subtitle_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subtitle progress" ON public.subtitle_progress;
CREATE POLICY "Users can update own subtitle progress"
  ON public.subtitle_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own subtitle progress" ON public.subtitle_progress;
CREATE POLICY "Users can delete own subtitle progress"
  ON public.subtitle_progress FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS on_subtitle_progress_updated ON public.subtitle_progress;
CREATE TRIGGER on_subtitle_progress_updated
  BEFORE UPDATE ON public.subtitle_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
