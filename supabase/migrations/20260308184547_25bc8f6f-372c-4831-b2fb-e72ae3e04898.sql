
CREATE OR REPLACE FUNCTION public.get_platform_trip_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COUNT(*)::int FROM public.trips;
$$;

CREATE OR REPLACE FUNCTION public.get_platform_destination_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COUNT(*)::int FROM public.destinations;
$$;
