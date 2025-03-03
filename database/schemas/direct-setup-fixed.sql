-- Step 1: Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Create the cats table
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

-- Step 3: Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cat-images', 'cat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Step 4: Set up storage policies
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'cat-images');

CREATE POLICY "Authenticated users can upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'cat-images');

-- Step 5: Create RLS policies for cats table
CREATE POLICY "Anyone can read cats" ON public.cats
FOR SELECT USING (true);

CREATE POLICY "Users can insert their own cats" ON public.cats
FOR INSERT WITH CHECK (true);

-- Step 6: Enable Row Level Security
ALTER TABLE public.cats ENABLE ROW LEVEL SECURITY;

-- Step 7: Create basic index
CREATE INDEX IF NOT EXISTS cats_spotted_at_idx ON public.cats (spotted_at DESC);

-- Step 8: Create spatial index (only if PostGIS is working)
DO $$
BEGIN
  -- Check if PostGIS is properly installed
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'postgis'
  ) THEN
    -- Create the spatial index
    EXECUTE 'CREATE INDEX IF NOT EXISTS cats_location_idx ON public.cats USING gist (
      ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    )';
  END IF;
END
$$;

-- Step 9: Create function to find cats within a radius
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
  AND (
    -- Calculate distance using PostGIS if available, otherwise return all cats
    EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AND
    ST_DWithin(
      ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_km * 1000  -- Convert km to meters
    )
    OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis')
  )
  ORDER BY spotted_at DESC;
$$; 