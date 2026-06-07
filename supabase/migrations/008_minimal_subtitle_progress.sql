-- LearnEnglish Database Schema - Minimal Subtitle Progress
-- Migration: 008_minimal_subtitle_progress

-- Subtitles are fetched in the browser and are not stored on the server.
-- Keep only the user's progress by video/subtitle index.
ALTER TABLE IF EXISTS public.subtitle_progress
  DROP COLUMN IF EXISTS subtitle_start,
  DROP COLUMN IF EXISTS subtitle_text,
  DROP COLUMN IF EXISTS user_translation,
  DROP COLUMN IF EXISTS reference_translation,
  DROP COLUMN IF EXISTS match_result;

ALTER TABLE IF EXISTS public.subtitle_progress
  DROP CONSTRAINT IF EXISTS subtitle_progress_subtitle_start_nonnegative;
