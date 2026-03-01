
-- Fix security definer views — set to SECURITY INVOKER so RLS of the querying user applies
ALTER VIEW public.v_trip_total SET (security_invoker = on);
ALTER VIEW public.v_day_totals SET (security_invoker = on);
ALTER VIEW public.v_budget_by_category SET (security_invoker = on);
ALTER VIEW public.v_payments_summary SET (security_invoker = on);
