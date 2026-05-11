ALTER VIEW public.public_trip_collaborators SET (security_invoker = false, security_barrier = true);

COMMENT ON VIEW public.public_trip_collaborators IS
  'PII-safe peer view of trip_collaborators. Intentionally SECURITY DEFINER so trip members can see fellow members'' display name + avatar without direct SELECT on the base table (which is owner/self only). Linter 0010 warning is accepted by design — the view exposes no user_id, no email, and no FK-traversable identity columns.';