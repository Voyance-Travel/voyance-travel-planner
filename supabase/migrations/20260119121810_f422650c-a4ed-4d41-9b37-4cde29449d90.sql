-- Fix user_preferences_safe view - it currently exposes too much data
-- The view should only expose minimal safe fields for other features to use

-- Drop the existing view
DROP VIEW IF EXISTS public.user_preferences_safe;

-- Recreate with truly safe, non-sensitive fields only
CREATE VIEW public.user_preferences_safe
WITH (security_invoker=on) AS
SELECT 
  user_id,
  travel_pace,
  budget_tier,
  activity_level,
  travel_style,
  quiz_completed,
  created_at,
  updated_at
FROM public.user_preferences;

-- Grant access to authenticated users only (not anon)
GRANT SELECT ON public.user_preferences_safe TO authenticated;

-- Revoke from anon if it was granted
REVOKE SELECT ON public.user_preferences_safe FROM anon;