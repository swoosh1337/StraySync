-- Enable the PostGIS extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the cats table to store cat sightings
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

-- Create storage bucket for cat images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cat-images', 'cat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policy to allow public access to cat images
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'cat-images');

-- Set up storage policy to allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'cat-images');

-- Create RLS policy for cats table to allow anyone to read
CREATE POLICY "Anyone can read cats" ON public.cats
FOR SELECT USING (true);

-- Create RLS policy for cats table to allow users to insert their own cats
CREATE POLICY "Users can insert their own cats" ON public.cats
FOR INSERT WITH CHECK (true);

-- Enable Row Level Security on the cats table
ALTER TABLE public.cats ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries by spotted_at
CREATE INDEX IF NOT EXISTS cats_spotted_at_idx ON public.cats (spotted_at DESC);

-- Create index for faster spatial queries
CREATE INDEX IF NOT EXISTS cats_location_idx ON public.cats USING gist (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
);

-- Create function to find cats within a radius
CREATE OR REPLACE FUNCTION public.find_cats_within_radius(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION,
  hours_ago INTEGER DEFAULT 24
)
RETURNS SETOF public.cats
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.cats
  WHERE spotted_at >= NOW() - (hours_ago || ' hours')::INTERVAL
  AND ST_DWithin(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_km * 1000  -- Convert km to meters
  )
  ORDER BY spotted_at DESC;
$$; 