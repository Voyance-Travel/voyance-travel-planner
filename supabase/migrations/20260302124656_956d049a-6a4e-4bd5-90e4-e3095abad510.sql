
-- ============================================================
-- FIX 1: trip_activities - Add collaborator-aware RLS policies
-- Collaborators with accepted_at can VIEW activities
-- Collaborators with edit/admin permission can UPDATE activities
-- ============================================================

-- Collaborators can view trip activities
CREATE POLICY "Collaborators can view trip activities"
ON public.trip_activities
FOR SELECT
TO authenticated
USING (
  public.is_trip_collaborator(trip_id, auth.uid(), false)
);

-- Collaborators with edit permission can update trip activities
CREATE POLICY "Collaborators with edit can update trip activities"
ON public.trip_activities
FOR UPDATE
TO authenticated
USING (
  public.is_trip_collaborator(trip_id, auth.uid(), true)
);

-- ============================================================
-- FIX 2: credit_ledger - Create safe view excluding Stripe IDs
-- Users should see their transaction history without payment internals
-- ============================================================

CREATE OR REPLACE VIEW public.credit_ledger_safe
WITH (security_invoker = on)
AS
SELECT
  id,
  user_id,
  transaction_type,
  credits_delta,
  is_free_credit,
  action_type,
  trip_id,
  activity_id,
  notes,
  created_at
FROM public.credit_ledger;

-- Grant access to the view
GRANT SELECT ON public.credit_ledger_safe TO authenticated;
