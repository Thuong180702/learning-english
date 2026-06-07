-- LearnEnglish Database Schema - Video Subtitle Cache Policy
-- Migration: 007_video_subtitle_cache_policy

-- Subtitle cache writes must be done by server-side code with
-- SUPABASE_SERVICE_ROLE_KEY. Do not grant this to anon/authenticated users,
-- otherwise clients could overwrite shared transcript cache records.
REVOKE UPDATE ON public.videos FROM anon, authenticated;

DROP POLICY IF EXISTS "Authenticated users can cache video subtitles" ON public.videos;
