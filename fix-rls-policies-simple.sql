-- Fix RLS policies for the cats table

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can delete their own cats" ON public.cats;
DROP POLICY IF EXISTS "Users can update their own cats" ON public.cats;

-- Create a policy to allow anyone to delete cats
-- In a production app, you would restrict this to only allow users to delete their own cats
CREATE POLICY "Anyone can delete cats" ON public.cats
FOR DELETE USING (true);

-- Create a policy to allow anyone to update cats
-- In a production app, you would restrict this to only allow users to update their own cats
CREATE POLICY "Anyone can update cats" ON public.cats
FOR UPDATE USING (true)
WITH CHECK (true);

-- Verify the policies
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'cats' AND schemaname = 'public'; 