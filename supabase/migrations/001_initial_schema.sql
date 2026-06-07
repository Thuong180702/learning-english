-- LearnEnglish Database Schema for Supabase
-- Migration: 001_initial_schema

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Videos table
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_videos_youtube ON public.videos(youtube_id);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can read videos" ON public.videos;
CREATE POLICY "Anyone can read videos" ON public.videos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert videos" ON public.videos;
CREATE POLICY "Anyone can insert videos" ON public.videos
  FOR INSERT WITH CHECK (true);
