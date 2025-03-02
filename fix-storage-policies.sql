-- Fix storage bucket and policies

-- First, ensure the bucket exists and is public
UPDATE storage.buckets 
SET public = true 
WHERE name = 'cat-images';

-- If the bucket doesn't exist, create it
INSERT INTO storage.buckets (id, name, public) 
SELECT 'cat-images', 'cat-images', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'cat-images');

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update own images" ON storage.objects;

-- Create new policies with correct syntax
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'cat-images');

CREATE POLICY "Anyone can upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'cat-images');

CREATE POLICY "Anyone can update own images" ON storage.objects 
FOR UPDATE USING (bucket_id = 'cat-images')
WITH CHECK (true);

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Anyone can delete images" ON storage.objects;

-- Create policy to allow anyone to delete images
CREATE POLICY "Anyone can delete images" ON storage.objects 
FOR DELETE USING (bucket_id = 'cat-images');

-- Make sure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verify the bucket exists
SELECT * FROM storage.buckets WHERE name = 'cat-images';

-- Verify policies exist
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- List all policies to verify
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname; 