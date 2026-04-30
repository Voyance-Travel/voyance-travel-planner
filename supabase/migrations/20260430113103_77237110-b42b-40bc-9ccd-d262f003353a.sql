CREATE OR REPLACE VIEW public.v_google_spend_per_trip
WITH (security_invoker = true) AS
SELECT
  trip_id,
  user_id,
  date_trunc('day', created_at)::date AS spend_date,
  -- Raw call counts
  SUM(google_places_calls)::int    AS places_calls,
  SUM(google_photos_calls)::int    AS photos_calls,
  SUM(google_geocoding_calls)::int AS geocoding_calls,
  SUM(google_routes_calls)::int    AS routes_calls,
  -- Estimated USD per SKU using current Google list pricing
  -- Places API (Text Search): $0.032 / call
  -- Places API (Photos):      $0.007 / call
  -- Geocoding:                $0.005 / call
  -- Routes / Distance Matrix: $0.005 / call (basic)
  ROUND(SUM(google_places_calls)    * 0.032, 4) AS places_usd,
  ROUND(SUM(google_photos_calls)    * 0.007, 4) AS photos_usd,
  ROUND(SUM(google_geocoding_calls) * 0.005, 4) AS geocoding_usd,
  ROUND(SUM(google_routes_calls)    * 0.005, 4) AS routes_usd,
  ROUND(
    SUM(google_places_calls)    * 0.032 +
    SUM(google_photos_calls)    * 0.007 +
    SUM(google_geocoding_calls) * 0.005 +
    SUM(google_routes_calls)    * 0.005,
    4
  ) AS total_google_usd,
  COUNT(*)::int AS tracking_records
FROM public.trip_cost_tracking
WHERE
  google_places_calls    > 0
  OR google_photos_calls > 0
  OR google_geocoding_calls > 0
  OR google_routes_calls > 0
GROUP BY trip_id, user_id, date_trunc('day', created_at);

COMMENT ON VIEW public.v_google_spend_per_trip IS
  'Per-trip, per-day Google API spend reconciliation view. Backed by trip_cost_tracking. Dollar values use current Google list prices and may drift from the actual invoice.';

REVOKE ALL ON public.v_google_spend_per_trip FROM PUBLIC;
GRANT SELECT ON public.v_google_spend_per_trip TO authenticated;
GRANT SELECT ON public.v_google_spend_per_trip TO service_role;