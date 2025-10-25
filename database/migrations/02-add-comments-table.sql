-- =====================================================================
-- Add Comments System for Animals
-- =====================================================================

-- Create comments table
CREATE TABLE IF NOT EXISTS public.animal_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID REFERENCES public.animals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS animal_comments_animal_id_idx ON public.animal_comments(animal_id);
CREATE INDEX IF NOT EXISTS animal_comments_user_id_idx ON public.animal_comments(user_id);
CREATE INDEX IF NOT EXISTS animal_comments_created_at_idx ON public.animal_comments(created_at DESC);

-- Enable RLS
ALTER TABLE public.animal_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view comments
CREATE POLICY "Comments are viewable by everyone"
  ON public.animal_comments FOR SELECT
  USING (true);

-- Authenticated users can insert comments
CREATE POLICY "Authenticated users can insert comments"
  ON public.animal_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
  ON public.animal_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
  ON public.animal_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at on comments
DROP TRIGGER IF EXISTS on_comment_updated ON public.animal_comments;
CREATE TRIGGER on_comment_updated
  BEFORE UPDATE ON public.animal_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to get comment count for an animal
CREATE OR REPLACE FUNCTION public.get_animal_comment_count(animal_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.animal_comments
  WHERE animal_id = animal_uuid;
$$;

-- Function to get comments with user info
CREATE OR REPLACE FUNCTION public.get_animal_comments(animal_uuid UUID)
RETURNS TABLE (
  id UUID,
  animal_id UUID,
  user_id UUID,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  user_display_name TEXT,
  user_avatar_url TEXT,
  user_is_supporter BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.animal_id,
    c.user_id,
    c.comment,
    c.created_at,
    c.updated_at,
    p.display_name,
    p.avatar_url,
    p.is_supporter
  FROM public.animal_comments c
  LEFT JOIN public.profiles p ON c.user_id = p.id
  WHERE c.animal_id = animal_uuid
  ORDER BY c.created_at ASC;
$$;

-- Grant permissions
GRANT ALL ON public.animal_comments TO authenticated;
GRANT SELECT ON public.animal_comments TO anon;
GRANT EXECUTE ON FUNCTION public.get_animal_comment_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_animal_comment_count(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_animal_comments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_animal_comments(UUID) TO anon;

-- Comments
COMMENT ON TABLE public.animal_comments IS 'User comments on animal sightings';
COMMENT ON FUNCTION public.get_animal_comment_count(UUID) IS 'Get the number of comments for a specific animal';
COMMENT ON FUNCTION public.get_animal_comments(UUID) IS 'Get all comments for an animal with user profile information';
