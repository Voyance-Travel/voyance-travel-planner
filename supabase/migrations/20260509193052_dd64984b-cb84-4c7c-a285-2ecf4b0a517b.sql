-- Revoke implicit PUBLIC grants on the atomic counter RPCs added in S6.1.
-- Postgres grants EXECUTE to PUBLIC by default on every new function;
-- without an explicit REVOKE, the additive GRANT TO authenticated/service_role
-- left anon with execute permission via PUBLIC inheritance.

REVOKE ALL ON FUNCTION public.increment_user_usage(uuid, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_venue_usage(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_archetype_guide_usage(text, uuid) FROM PUBLIC;

-- Re-affirm the intended grants. Idempotent — safe even if already set.
GRANT EXECUTE ON FUNCTION public.increment_user_usage(uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_venue_usage(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_archetype_guide_usage(text, uuid) TO service_role;