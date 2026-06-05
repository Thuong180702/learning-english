-- LearnEnglish Database Schema - Vocabulary
-- Migration: 002_vocabulary

-- Vocabulary table
CREATE TABLE public.vocabulary (
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

-- Indexes
CREATE INDEX idx_vocabulary_user_created ON public.vocabulary(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own vocabulary" ON public.vocabulary
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocabulary" ON public.vocabulary
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vocabulary" ON public.vocabulary
  FOR DELETE USING (auth.uid() = user_id);
