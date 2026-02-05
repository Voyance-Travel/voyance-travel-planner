-- Fix customer_reviews INSERT policy to require authentication
-- This prevents anonymous spam submissions

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can submit reviews" ON public.customer_reviews;

-- Create a proper authenticated-only INSERT policy
CREATE POLICY "Authenticated users can submit reviews"
ON public.customer_reviews
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Ensure users can only read their own reviews (if not already exists)
DROP POLICY IF EXISTS "Users can view their own reviews" ON public.customer_reviews;
CREATE POLICY "Users can view their own reviews"
ON public.customer_reviews
FOR SELECT
TO authenticated
USING (user_id = auth.uid());