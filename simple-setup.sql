-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the cats table
CREATE TABLE IF NOT EXISTS public.cats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT,
  spotted_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cat-images', 'cat-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Set up storage policies
-- Allow public access to read files
CREATE POLICY IF NOT EXISTS "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'cat-images');

-- Allow anyone to upload images (for demo purposes)
CREATE POLICY IF NOT EXISTS "Anyone can upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'cat-images');

-- Allow anyone to update their own images
CREATE POLICY IF NOT EXISTS "Anyone can update own images" ON storage.objects 
FOR UPDATE USING (bucket_id = 'cat-images')
WITH CHECK (true);

-- Create RLS policies for cats table
CREATE POLICY IF NOT EXISTS "Anyone can read cats" ON public.cats
FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Anyone can insert cats" ON public.cats
FOR INSERT WITH CHECK (true);

-- Enable Row Level Security
ALTER TABLE public.cats ENABLE ROW LEVEL SECURITY;

-- Create basic index
CREATE INDEX IF NOT EXISTS cats_spotted_at_idx ON public.cats (spotted_at DESC);

-- Create a simple function to find cats within a time frame
CREATE OR REPLACE FUNCTION public.find_recent_cats(
  hours_ago INTEGER DEFAULT 24
)
RETURNS SETOF public.cats
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.cats
  WHERE spotted_at >= NOW() - (hours_ago || ' hours')::INTERVAL
  ORDER BY spotted_at DESC;
$$; 