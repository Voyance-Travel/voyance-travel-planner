-- Add policy allowing users to view their own ID mappings
-- This is needed for account migration/verification purposes

CREATE POLICY "Users can view own user ID mappings"
  ON public.user_id_mappings
  FOR SELECT
  USING (auth.uid() = user_id);