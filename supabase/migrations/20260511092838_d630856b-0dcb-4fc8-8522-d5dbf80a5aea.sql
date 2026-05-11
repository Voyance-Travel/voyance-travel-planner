CREATE OR REPLACE VIEW public.public_trip_collaborators
WITH (security_barrier = true) AS
SELECT
  tc.id,
  tc.trip_id,
  tc.permission AS role,
  tc.accepted_at,
  tc.created_at,
  COALESCE(p.display_name, 'Member ' || SUBSTRING(tc.id::text FROM 1 FOR 8)) AS member_display,
  p.avatar_url
FROM public.trip_collaborators tc
LEFT JOIN public.profiles p ON p.id = tc.user_id
WHERE
  EXISTS (SELECT 1 FROM public.trips t
          WHERE t.id = tc.trip_id AND t.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.trip_collaborators me
             WHERE me.trip_id = tc.trip_id
               AND me.user_id = auth.uid()
               AND me.accepted_at IS NOT NULL);

ALTER VIEW public.public_trip_collaborators SET (security_invoker = false, security_barrier = true);
GRANT SELECT ON public.public_trip_collaborators TO authenticated;
REVOKE SELECT ON public.public_trip_collaborators FROM anon, PUBLIC;

COMMENT ON VIEW public.public_trip_collaborators IS
  'PII-safe peer view of trip_collaborators (no user_id, no email). SECURITY DEFINER by design — base table is owner/self only; this view applies its own membership filter via auth.uid(). Linter 0010 is accepted.';