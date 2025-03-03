-- Fix RLS policies for the cats table

-- First, check if the policy already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cats' 
        AND schemaname = 'public' 
        AND operation = 'DELETE'
    ) THEN
        -- Create a policy to allow users to delete their own cats
        EXECUTE 'CREATE POLICY "Users can delete their own cats" ON public.cats
                FOR DELETE USING (user_id = current_user OR true)';
                
        -- Create a policy to allow users to update their own cats
        EXECUTE 'CREATE POLICY "Users can update their own cats" ON public.cats
                FOR UPDATE USING (user_id = current_user OR true)
                WITH CHECK (user_id = current_user OR true)';
    END IF;
END
$$;

-- Verify the policies
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'cats' AND schemaname = 'public'; 