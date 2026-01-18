-- Add UPDATE policy for saved_items table
-- Users can only update their own saved items
CREATE POLICY "Users can update own saved items"
ON saved_items
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);