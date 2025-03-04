-- Check if animal_type column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'cats'
        AND column_name = 'animal_type'
    ) THEN
        ALTER TABLE public.cats ADD COLUMN animal_type TEXT DEFAULT 'cat';
        RAISE NOTICE 'Added animal_type column to cats table';
    ELSE
        RAISE NOTICE 'animal_type column already exists in cats table';
    END IF;
END $$; 