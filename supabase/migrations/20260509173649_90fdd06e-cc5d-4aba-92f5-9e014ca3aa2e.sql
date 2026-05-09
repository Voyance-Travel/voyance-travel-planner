-- R3.10: Explicit privilege model for transition_booking_state.
-- The function already enforces auth via auth.uid() + ownership/collaborator
-- checks, but we want anon blocked at the GRANT layer too in case any future
-- misconfiguration exposes the schema to the anon role.
-- REVOKE FROM PUBLIC is required because Postgres' default function privileges
-- grant EXECUTE to PUBLIC (which includes anon).

REVOKE ALL ON FUNCTION public.transition_booking_state(
  uuid, public.booking_item_state, text, text, jsonb
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.transition_booking_state(
  uuid, public.booking_item_state, text, text, jsonb
) FROM anon;

GRANT EXECUTE ON FUNCTION public.transition_booking_state(
  uuid, public.booking_item_state, text, text, jsonb
) TO authenticated, service_role;