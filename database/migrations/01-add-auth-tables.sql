-- =====================================================================
-- Add Authentication Tables and Update Schema for Auth
-- =====================================================================

-- Create profiles table to store user profile data
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  is_supporter BOOLEAN DEFAULT FALSE,
  supporter_since TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
-- Anyone can view profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Add status and view_count columns to animals table
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Add check constraint for status
ALTER TABLE public.animals DROP CONSTRAINT IF EXISTS animals_status_check;
ALTER TABLE public.animals ADD CONSTRAINT animals_status_check
  CHECK (status IN ('active', 'helped', 'rescued'));

-- Update animals table: change user_id from TEXT to UUID
-- First, add a new column for auth user IDs
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- Create index on auth_user_id for performance
CREATE INDEX IF NOT EXISTS animals_auth_user_id_idx ON public.animals(auth_user_id);

-- Update RLS policies for animals table
-- Drop old policies
DROP POLICY IF EXISTS "Anyone can read cats" ON public.animals;
DROP POLICY IF EXISTS "Anyone can insert cats" ON public.animals;
DROP POLICY IF EXISTS "Anyone can read animals" ON public.animals;
DROP POLICY IF EXISTS "Anyone can insert animals" ON public.animals;

-- New policies: Viewing is public, but insert/update/delete requires auth
CREATE POLICY "Animals are viewable by everyone"
  ON public.animals FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert animals"
  ON public.animals FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own animals"
  ON public.animals FOR UPDATE
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can delete their own animals"
  ON public.animals FOR DELETE
  USING (auth.uid() = auth_user_id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Anonymous User'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to auto-update updated_at on profiles
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.animals TO authenticated;
GRANT SELECT ON public.animals TO anon;

-- Comments
COMMENT ON TABLE public.profiles IS 'User profile information linked to Supabase Auth';
COMMENT ON COLUMN public.animals.status IS 'Animal status: active, helped, or rescued';
COMMENT ON COLUMN public.animals.view_count IS 'Number of times this animal has been viewed';
COMMENT ON COLUMN public.animals.auth_user_id IS 'UUID of the authenticated user who posted this animal';
