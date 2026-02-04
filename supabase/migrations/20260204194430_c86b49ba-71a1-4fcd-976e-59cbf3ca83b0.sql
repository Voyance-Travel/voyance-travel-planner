-- Fix security definer view by explicitly setting security invoker
DROP VIEW IF EXISTS public.trip_cost_summary;

CREATE OR REPLACE VIEW public.trip_cost_summary 
WITH (security_invoker = true) AS
SELECT 
  action_type,
  model,
  COUNT(*) as total_calls,
  AVG(input_tokens) as avg_input_tokens,
  AVG(output_tokens) as avg_output_tokens,
  AVG(google_places_calls) as avg_google_places,
  AVG(google_geocoding_calls) as avg_google_geocoding,
  AVG(google_photos_calls) as avg_google_photos,
  AVG(google_routes_calls) as avg_google_routes,
  AVG(amadeus_calls) as avg_amadeus,
  AVG(perplexity_calls) as avg_perplexity,
  AVG(estimated_cost_usd) as avg_cost_usd,
  SUM(estimated_cost_usd) as total_cost_usd,
  AVG(duration_ms) as avg_duration_ms,
  MIN(created_at) as first_call,
  MAX(created_at) as last_call
FROM public.trip_cost_tracking
GROUP BY action_type, model;