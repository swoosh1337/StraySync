-- Rename the cats table to animals if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'cats'
  ) THEN
    ALTER TABLE public.cats RENAME TO animals;
    RAISE NOTICE 'Renamed cats table to animals';
  ELSE
    RAISE NOTICE 'cats table does not exist, skipping rename';
  END IF;
END $$;

-- Ensure the animal_type column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'animals'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'animals'
        AND column_name = 'animal_type'
    ) THEN
        ALTER TABLE public.animals ADD COLUMN animal_type TEXT DEFAULT 'cat';
        RAISE NOTICE 'Added animal_type column to animals table';
    ELSE
        RAISE NOTICE 'animals table does not exist or animal_type column already exists';
    END IF;
END $$;

-- Update the find_recent_cats function to find_recent_animals
CREATE OR REPLACE FUNCTION public.find_recent_animals(
  hours_ago INTEGER DEFAULT 24
)
RETURNS SETOF public.animals
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.animals
  WHERE spotted_at >= NOW() - (hours_ago || ' hours')::INTERVAL
  ORDER BY spotted_at DESC;
$$;

-- Create a function to find animals by type
CREATE OR REPLACE FUNCTION public.find_animals_by_type(
  animal_type_param TEXT,
  hours_ago INTEGER DEFAULT 24
)
RETURNS SETOF public.animals
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.animals
  WHERE animal_type = animal_type_param
  AND spotted_at >= NOW() - (hours_ago || ' hours')::INTERVAL
  ORDER BY spotted_at DESC;
$$; 