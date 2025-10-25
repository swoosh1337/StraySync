-- =====================================================================
-- Function: cleanup_old_animals
-- Description: Automatically deletes animal records older than 14 days
--              and their associated images from storage
-- Returns: Count of deleted records
-- Note: Works with both 'cats' and 'animals' table names
-- =====================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_animals()
RETURNS TABLE(deleted_count INTEGER, deleted_images INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges to delete from storage
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_deleted_images INTEGER := 0;
  v_cutoff_date TIMESTAMP WITH TIME ZONE;
  v_animal RECORD;
  v_storage_path TEXT;
  v_table_name TEXT;
BEGIN
  -- Calculate cutoff date (14 days ago)
  v_cutoff_date := NOW() - INTERVAL '14 days';

  -- Determine which table exists (animals or cats)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'animals') THEN
    v_table_name := 'animals';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cats') THEN
    v_table_name := 'cats';
  ELSE
    RAISE EXCEPTION 'Neither animals nor cats table exists';
  END IF;

  -- Log the cleanup operation
  RAISE NOTICE 'Starting cleanup of % older than %', v_table_name, v_cutoff_date;

  -- Loop through old animals to delete their images first
  FOR v_animal IN EXECUTE format(
    'SELECT id, image_url, spotted_at FROM public.%I WHERE spotted_at < $1',
    v_table_name
  ) USING v_cutoff_date
  LOOP
    -- Extract the storage path from the image URL
    -- URL format: https://{project}.supabase.co/storage/v1/object/public/cat-images/{filename}
    IF v_animal.image_url LIKE '%/cat-images/%' THEN
      -- Extract just the filename part after 'cat-images/'
      v_storage_path := substring(v_animal.image_url from '/cat-images/(.*)$');

      -- Only attempt to delete if we have a valid path and it's not a placeholder
      IF v_storage_path IS NOT NULL
         AND v_storage_path != ''
         AND v_animal.image_url NOT LIKE '%placekitten.com%'
         AND v_animal.image_url NOT LIKE '%placeholder%' THEN

        -- Delete from storage.objects table
        BEGIN
          DELETE FROM storage.objects
          WHERE bucket_id = 'cat-images'
            AND name = v_storage_path;

          IF FOUND THEN
            v_deleted_images := v_deleted_images + 1;
            RAISE NOTICE 'Deleted image: %', v_storage_path;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            -- Log but don't fail if image deletion fails
            RAISE NOTICE 'Failed to delete image % for animal %: %', v_storage_path, v_animal.id, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;

  -- Delete old animal records
  EXECUTE format(
    'WITH deleted AS (DELETE FROM public.%I WHERE spotted_at < $1 RETURNING id) SELECT COUNT(*) FROM deleted',
    v_table_name
  ) USING v_cutoff_date INTO v_deleted_count;

  -- Log completion
  RAISE NOTICE 'Cleanup completed: % animals deleted, % images deleted', v_deleted_count, v_deleted_images;

  -- Return the counts
  RETURN QUERY SELECT v_deleted_count, v_deleted_images;
END;
$$;

-- Grant execute permission to authenticated and anonymous users
-- (so it can be called via Supabase API if needed)
GRANT EXECUTE ON FUNCTION public.cleanup_old_animals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_animals() TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION public.cleanup_old_animals() IS
'Deletes animal records older than 14 days and their associated images from storage.
Scheduled to run daily via pg_cron. Can also be called manually for testing.';
