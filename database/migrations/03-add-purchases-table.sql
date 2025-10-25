-- =====================================================================
-- Add Purchases/Donations Table for Monetization
-- =====================================================================

-- Create purchases table
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id TEXT NOT NULL,
  amount INTEGER, -- Amount in cents (USD)
  platform TEXT NOT NULL, -- 'apple' or 'google'
  transaction_id TEXT, -- Store transaction ID for verification
  purchase_token TEXT, -- For Android
  receipt_data TEXT, -- For iOS
  status TEXT DEFAULT 'completed', -- 'completed', 'pending', 'refunded'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS purchases_user_id_idx ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS purchases_product_id_idx ON public.purchases(product_id);
CREATE INDEX IF NOT EXISTS purchases_created_at_idx ON public.purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS purchases_transaction_id_idx ON public.purchases(transaction_id);

-- Enable RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own purchases
CREATE POLICY "Users can view their own purchases"
  ON public.purchases FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own purchases
CREATE POLICY "Users can insert their own purchases"
  ON public.purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add check constraint for status
ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_status_check
  CHECK (status IN ('completed', 'pending', 'refunded'));

-- Add check constraint for platform
ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_platform_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_platform_check
  CHECK (platform IN ('apple', 'google'));

-- Function to handle supporter badge purchase
CREATE OR REPLACE FUNCTION public.handle_supporter_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If the purchase is for supporter badge and status is completed
  IF NEW.product_id = 'supporter_badge' AND NEW.status = 'completed' THEN
    -- Update user's profile to be a supporter
    UPDATE public.profiles
    SET
      is_supporter = TRUE,
      supporter_since = COALESCE(supporter_since, NEW.created_at)
    WHERE id = NEW.user_id;
  END IF;

  -- If purchasing any tip, also grant supporter badge
  IF NEW.product_id LIKE 'tip_%' AND NEW.status = 'completed' THEN
    UPDATE public.profiles
    SET
      is_supporter = TRUE,
      supporter_since = COALESCE(supporter_since, NEW.created_at)
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to automatically update supporter status on purchase
DROP TRIGGER IF EXISTS on_supporter_purchase ON public.purchases;
CREATE TRIGGER on_supporter_purchase
  AFTER INSERT ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_supporter_purchase();

-- Function to get user's total donations
CREATE OR REPLACE FUNCTION public.get_user_donation_total(user_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM public.purchases
  WHERE user_id = user_uuid
    AND status = 'completed'
    AND product_id LIKE 'tip_%';
$$;

-- Function to check if user has purchased supporter badge
CREATE OR REPLACE FUNCTION public.user_is_supporter(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT is_supporter
  FROM public.profiles
  WHERE id = user_uuid;
$$;

-- Grant permissions
GRANT ALL ON public.purchases TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_donation_total(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_supporter(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_supporter(UUID) TO anon;

-- Comments
COMMENT ON TABLE public.purchases IS 'In-app purchases and donations tracking';
COMMENT ON COLUMN public.purchases.product_id IS 'Product identifier: supporter_badge, tip_1, tip_3, tip_5, tip_10';
COMMENT ON COLUMN public.purchases.amount IS 'Purchase amount in cents (USD)';
COMMENT ON FUNCTION public.handle_supporter_purchase() IS 'Automatically grants supporter badge when user makes a purchase';
COMMENT ON FUNCTION public.get_user_donation_total(UUID) IS 'Get total amount donated by user (tips only)';
