-- Fix security definer on the view by setting it to INVOKER
ALTER VIEW public.user_preferences_safe SET (security_invoker = on);