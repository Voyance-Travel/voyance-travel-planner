-- Fix linter: security-definer views (set to security invoker)
ALTER VIEW public.profiles_public SET (security_invoker = true);
ALTER VIEW public.agency_accounts_intake SET (security_invoker = true);