CREATE UNIQUE INDEX IF NOT EXISTS user_usage_user_metric_period_uidx
  ON public.user_usage (user_id, metric_key, period);

CREATE OR REPLACE FUNCTION public.increment_user_usage(
  p_user_id uuid,
  p_metric_key text,
  p_period text,
  p_amount integer DEFAULT 1
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.user_usage (user_id, metric_key, period, count, updated_at)
  VALUES (p_user_id, p_metric_key, p_period, p_amount, now())
  ON CONFLICT (user_id, metric_key, period)
  DO UPDATE SET
    count = public.user_usage.count + EXCLUDED.count,
    updated_at = now()
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_user_usage(uuid, text, text, integer)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bump_venue_usage(p_place_id text)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.verified_venues
  SET usage_count = COALESCE(usage_count, 0) + 1,
      updated_at = now()
  WHERE google_place_id = p_place_id;
$$;

GRANT EXECUTE ON FUNCTION public.bump_venue_usage(text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bump_archetype_guide_usage(
  p_archetype text,
  p_destination_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.archetype_destination_guides
  SET usage_count = COALESCE(usage_count, 0) + 1
  WHERE archetype = p_archetype
    AND destination_id = p_destination_id;
$$;

GRANT EXECUTE ON FUNCTION public.bump_archetype_guide_usage(text, uuid)
  TO authenticated, service_role;
