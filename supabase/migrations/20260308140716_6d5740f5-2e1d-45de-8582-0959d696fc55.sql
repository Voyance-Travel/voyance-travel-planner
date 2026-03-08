
-- Allow anyone (including anon) to count followers for a creator
CREATE POLICY "Anyone can count followers"
  ON public.creator_follows
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Drop the old restrictive select policy since the new one covers it
DROP POLICY IF EXISTS "Users can view own follows" ON public.creator_follows;
