CREATE POLICY "Users can update their own suggestions"
ON public.trip_suggestions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());