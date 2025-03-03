-- Fix storage bucket policies for deletion
-- Run this in the Supabase SQL Editor

-- Make sure the bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE name = 'cat-images';

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Anyone can delete images" ON storage.objects;

-- Create policy to allow anyone to delete images
CREATE POLICY "Anyone can delete images" ON storage.objects 
FOR DELETE USING (bucket_id = 'cat-images');

-- Make sure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

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