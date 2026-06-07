-- LearnEnglish Database Schema - Storage Optimization
-- Migration: 005_storage_optimization

-- Remove the old append-only event log. The app only reads daily aggregate
-- progress, so keeping every raw event just increases database size.
DROP TABLE IF EXISTS public.learning_events;

-- user_videos is identified by one row per user/video pair. A separate UUID id
-- plus a UNIQUE(user_id, video_id) index is redundant.
ALTER TABLE IF EXISTS public.user_videos
  DROP CONSTRAINT IF EXISTS user_videos_user_id_video_id_key;

ALTER TABLE IF EXISTS public.user_videos
  DROP COLUMN IF EXISTS id;

DO $$
BEGIN
  IF to_regclass('public.user_videos') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.user_videos'::regclass
         AND contype = 'p'
     ) THEN
    ALTER TABLE public.user_videos
      ADD CONSTRAINT user_videos_pkey PRIMARY KEY (user_id, video_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.user_videos') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.user_videos'::regclass
         AND conname = 'user_videos_last_position_nonnegative'
     ) THEN
    ALTER TABLE public.user_videos
      ADD CONSTRAINT user_videos_last_position_nonnegative CHECK (last_position >= 0);
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.user_videos') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.user_videos'::regclass
         AND conname = 'user_videos_watch_seconds_nonnegative'
     ) THEN
    ALTER TABLE public.user_videos
      ADD CONSTRAINT user_videos_watch_seconds_nonnegative CHECK (watch_seconds >= 0);
  END IF;
END;
$$;

-- subtitle_progress is identified by one row per user/video/subtitle pair.
-- The primary key also covers lookups by user/video, so the old user/video
-- index is redundant.
DROP INDEX IF EXISTS public.idx_subtitle_progress_user_video;
DROP INDEX IF EXISTS public.idx_subtitle_progress_user_completed;

ALTER TABLE IF EXISTS public.subtitle_progress
  DROP CONSTRAINT IF EXISTS subtitle_progress_user_id_video_id_subtitle_index_key;

ALTER TABLE IF EXISTS public.subtitle_progress
  DROP COLUMN IF EXISTS id;

ALTER TABLE IF EXISTS public.subtitle_progress
  ALTER COLUMN subtitle_start TYPE REAL USING subtitle_start::real;

ALTER TABLE IF EXISTS public.subtitle_progress
  ALTER COLUMN attempts TYPE SMALLINT
  USING GREATEST(1, LEAST(attempts, 32767))::smallint;

DO $$
BEGIN
  IF to_regclass('public.subtitle_progress') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.subtitle_progress'::regclass
         AND contype = 'p'
     ) THEN
    ALTER TABLE public.subtitle_progress
      ADD CONSTRAINT subtitle_progress_pkey PRIMARY KEY (user_id, video_id, subtitle_index);
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.subtitle_progress') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.subtitle_progress'::regclass
         AND conname = 'subtitle_progress_subtitle_index_nonnegative'
     ) THEN
    ALTER TABLE public.subtitle_progress
      ADD CONSTRAINT subtitle_progress_subtitle_index_nonnegative CHECK (subtitle_index >= 0);
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.subtitle_progress') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.subtitle_progress'::regclass
         AND conname = 'subtitle_progress_subtitle_start_nonnegative'
     ) THEN
    ALTER TABLE public.subtitle_progress
      ADD CONSTRAINT subtitle_progress_subtitle_start_nonnegative CHECK (subtitle_start >= 0);
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.subtitle_progress') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.subtitle_progress'::regclass
         AND conname = 'subtitle_progress_attempts_positive'
     ) THEN
    ALTER TABLE public.subtitle_progress
      ADD CONSTRAINT subtitle_progress_attempts_positive CHECK (attempts > 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_subtitle_progress_completed_by_video
  ON public.subtitle_progress(user_id, video_id, subtitle_index)
  WHERE completed;
