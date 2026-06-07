-- LearnEnglish Database Schema - Video Subtitle Cache Policy
-- Migration: 007_video_subtitle_cache_policy

-- Allow logged-in users to refresh only the subtitle cache fields for shared
-- video records. This lets local/server transcript fetches populate Supabase so
-- Vercel can read cached subtitles when YouTube blocks server-side fetching.
REVOKE UPDATE ON public.videos FROM anon, authenticated;
GRANT UPDATE (subtitles, cached_at) ON public.videos TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can cache video subtitles" ON public.videos;
CREATE POLICY "Authenticated users can cache video subtitles"
  ON public.videos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
