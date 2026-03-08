-- Allow admins to view all credit purchases for Business Dashboard
CREATE POLICY "Admins can view all credit purchases"
ON public.credit_purchases
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);