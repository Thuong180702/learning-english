-- LearnEnglish Database Schema for Supabase
-- Migration: 001_initial_schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT false,
  verification_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Videos table
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  youtube_id VARCHAR(20) UNIQUE NOT NULL,
  title VARCHAR(500),
  thumbnail_url TEXT,
  duration INTEGER,
  subtitles JSONB DEFAULT '[]'::JSONB,
  cached_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Videos table (user's watched videos)
CREATE TABLE public.user_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  last_position INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, video_id)
);

-- Vocabulary table
CREATE TABLE public.vocabulary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  sentence_index INTEGER,
  word VARCHAR(100) NOT NULL,
  phonetic VARCHAR(100),
  meaning TEXT,
  sentence TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vocabulary_user_created ON public.vocabulary(user_id, created_at DESC);
CREATE INDEX idx_user_videos_user ON public.user_videos(user_id);
CREATE INDEX idx_videos_youtube ON public.videos(youtube_id);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can read their own profile, update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Videos: Anyone can read videos, only authenticated users can insert
CREATE POLICY "Anyone can read videos" ON public.videos
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert videos" ON public.videos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- User Videos: Users can manage their own watched videos
CREATE POLICY "Users can view own watched videos" ON public.user_videos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watched videos" ON public.user_videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watched videos" ON public.user_videos
  FOR UPDATE USING (auth.uid() = user_id);

-- Vocabulary: Users can only access their own vocabulary
CREATE POLICY "Users can view own vocabulary" ON public.vocabulary
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocabulary" ON public.vocabulary
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vocabulary" ON public.vocabulary
  FOR DELETE USING (auth.uid() = user_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
