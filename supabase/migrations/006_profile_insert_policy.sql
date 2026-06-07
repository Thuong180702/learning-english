-- LearnEnglish Database Schema - Profile Insert Policy
-- Migration: 006_profile_insert_policy

-- Existing users can be missing a profiles row if they signed up before the
-- profile trigger existed. Allow the settings page to upsert only the current
-- user's own profile.
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
