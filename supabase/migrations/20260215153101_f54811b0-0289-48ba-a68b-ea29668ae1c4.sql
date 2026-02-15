
-- Server-side aggregation for Unit Economics dashboard
-- Bypasses Supabase 1000-row default limit by aggregating in PostgreSQL
CREATE OR REPLACE FUNCTION public.get_unit_economics_summary(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  -- Require admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT json_build_object(
    'date_range', json_build_object(
      'start', MIN(created_at),
      'end_date', MAX(created_at)
    ),
    'total_cost_usd', COALESCE(SUM(estimated_cost_usd), 0),
    'total_records', COUNT(*),
    -- Service call totals
    'google_places_calls', COALESCE(SUM(google_places_calls), 0),
    'google_geocoding_calls', COALESCE(SUM(google_geocoding_calls), 0),
    'google_photos_calls', COALESCE(SUM(google_photos_calls), 0),
    'google_routes_calls', COALESCE(SUM(google_routes_calls), 0),
    'perplexity_calls', COALESCE(SUM(perplexity_calls), 0),
    'amadeus_calls', COALESCE(SUM(amadeus_calls), 0),
    'total_input_tokens', COALESCE(SUM(input_tokens), 0),
    'total_output_tokens', COALESCE(SUM(output_tokens), 0),
    'ai_call_count', COUNT(*) FILTER (WHERE input_tokens > 0 OR output_tokens > 0),
    -- Unique counts
    'unique_users', COUNT(DISTINCT user_id),
    'unique_trips', COUNT(DISTINCT trip_id),
    -- Cost by date
    'cost_by_date', (
      SELECT COALESCE(json_agg(daily ORDER BY daily->>'date'), '[]'::json)
      FROM (
        SELECT json_build_object(
          'date', created_at::DATE,
          'cost', SUM(estimated_cost_usd),
          'records', COUNT(*)
        ) AS daily
        FROM trip_cost_tracking
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY created_at::DATE
      ) d
    ),
    -- Cost by action type
    'cost_by_action', (
      SELECT COALESCE(json_agg(by_action), '[]'::json)
      FROM (
        SELECT json_build_object(
          'action_type', action_type,
          'cost', SUM(estimated_cost_usd),
          'count', COUNT(*)
        ) AS by_action
        FROM trip_cost_tracking
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY action_type
      ) a
    ),
    -- Cost by category
    'cost_by_category', (
      SELECT COALESCE(json_agg(by_cat), '[]'::json)
      FROM (
        SELECT json_build_object(
          'category', cost_category,
          'cost', SUM(estimated_cost_usd),
          'count', COUNT(*),
          'google_places', COALESCE(SUM(google_places_calls), 0),
          'google_photos', COALESCE(SUM(google_photos_calls), 0),
          'perplexity', COALESCE(SUM(perplexity_calls), 0),
          'amadeus', COALESCE(SUM(amadeus_calls), 0)
        ) AS by_cat
        FROM trip_cost_tracking
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY cost_category
      ) c
    ),
    -- Cost by model
    'cost_by_model', (
      SELECT COALESCE(json_agg(by_model), '[]'::json)
      FROM (
        SELECT json_build_object(
          'model', model,
          'count', COUNT(*),
          'input_tokens', SUM(input_tokens),
          'output_tokens', SUM(output_tokens)
        ) AS by_model
        FROM trip_cost_tracking
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY model
      ) m
    )
  ) INTO result
  FROM trip_cost_tracking
  WHERE created_at BETWEEN p_start_date AND p_end_date;

  RETURN result;
END;
$$;
