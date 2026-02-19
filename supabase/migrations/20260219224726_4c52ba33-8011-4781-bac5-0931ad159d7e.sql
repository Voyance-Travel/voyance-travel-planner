
-- Pending credit charges table — server-side safety net for guaranteed refunds
CREATE TABLE public.pending_credit_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL,
  action TEXT NOT NULL,
  credits_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT
);

-- Index for quick lookup of stale pending charges
CREATE INDEX idx_pending_charges_status_created ON public.pending_credit_charges (status, created_at)
  WHERE status = 'pending';

CREATE INDEX idx_pending_charges_user_trip ON public.pending_credit_charges (user_id, trip_id);

-- RLS
ALTER TABLE public.pending_credit_charges ENABLE ROW LEVEL SECURITY;

-- Users can read their own pending charges (for frontend stale-check)
CREATE POLICY "Users can view own pending charges"
  ON public.pending_credit_charges FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role / edge functions should insert/update (no user-facing writes)
-- The edge functions use service role key, so no INSERT/UPDATE policy needed for anon/authenticated
