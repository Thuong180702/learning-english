-- LearnEnglish Database Schema - All Migrations Combined
-- Run this file in Supabase SQL Editor to set up the complete database
-- This combines all migrations for a fresh setup or can be run incrementally

-- ============================================================
-- PART 1: Profiles (from 000_profiles.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'premium')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Avatar storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- Shared: updated_at trigger function (used by all tables)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- PART 2: Videos (from 001_initial_schema.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id VARCHAR(20) UNIQUE NOT NULL,
  title VARCHAR(500),
  thumbnail_url TEXT,
  duration INTEGER,
  subtitles JSONB DEFAULT '[]'::JSONB,
  cached_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_youtube ON public.videos(youtube_id);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read videos" ON public.videos;
CREATE POLICY "Anyone can read videos" ON public.videos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert videos" ON public.videos;
CREATE POLICY "Anyone can insert videos" ON public.videos
  FOR INSERT WITH CHECK (true);

REVOKE UPDATE ON public.videos FROM anon, authenticated;

DROP POLICY IF EXISTS "Authenticated users can cache video subtitles" ON public.videos;

-- ============================================================
-- PART 3: Vocabulary (from 002_vocabulary.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  sentence_index INTEGER,
  word VARCHAR(100) NOT NULL,
  phonetic VARCHAR(100),
  meaning TEXT,
  sentence TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_user_created ON public.vocabulary(user_id, created_at DESC);

ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own vocabulary" ON public.vocabulary;
CREATE POLICY "Users can view own vocabulary" ON public.vocabulary
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own vocabulary" ON public.vocabulary;
CREATE POLICY "Users can insert own vocabulary" ON public.vocabulary
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own vocabulary" ON public.vocabulary;
CREATE POLICY "Users can delete own vocabulary" ON public.vocabulary
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- PART 4: Learning Progress (from 003_learning_progress.sql)
-- ============================================================

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

-- learning_daily_progress
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

-- Shared updated_at triggers
DROP TRIGGER IF EXISTS on_user_videos_updated ON public.user_videos;
CREATE TRIGGER on_user_videos_updated
  BEFORE UPDATE ON public.user_videos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_learning_daily_progress_updated ON public.learning_daily_progress;
CREATE TRIGGER on_learning_daily_progress_updated
  BEFORE UPDATE ON public.learning_daily_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- PART 5: Subtitle Progress (from 004_subtitle_progress.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subtitle_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  subtitle_index INTEGER NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT TRUE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attempts SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY(user_id, video_id, subtitle_index),
  CONSTRAINT subtitle_progress_subtitle_index_nonnegative CHECK (subtitle_index >= 0),
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

-- ============================================================
-- PART 6: Minimal Subtitle Progress (from 008_minimal_subtitle_progress.sql)
-- ============================================================

ALTER TABLE IF EXISTS public.subtitle_progress
  DROP COLUMN IF EXISTS subtitle_start,
  DROP COLUMN IF EXISTS subtitle_text,
  DROP COLUMN IF EXISTS user_translation,
  DROP COLUMN IF EXISTS reference_translation,
  DROP COLUMN IF EXISTS match_result;

ALTER TABLE IF EXISTS public.subtitle_progress
  DROP CONSTRAINT IF EXISTS subtitle_progress_subtitle_start_nonnegative;
