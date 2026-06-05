-- LearnEnglish Database Schema for Supabase
-- Migration: 001_initial_schema

-- Videos table
CREATE TABLE public.videos (
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
CREATE INDEX idx_videos_youtube ON public.videos(youtube_id);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read videos" ON public.videos
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert videos" ON public.videos
  FOR INSERT WITH CHECK (true);
