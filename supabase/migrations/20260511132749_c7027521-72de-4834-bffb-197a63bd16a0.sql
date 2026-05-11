-- Structurally isolate customer_reviews.email into a separate owner-only contacts table.

CREATE TABLE public.customer_review_contacts (
  review_id  UUID PRIMARY KEY REFERENCES public.customer_reviews(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_review_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_review_contacts_owner_read"
  ON public.customer_review_contacts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_reviews cr
      WHERE cr.id = customer_review_contacts.review_id
        AND cr.user_id = auth.uid()
    )
  );

CREATE POLICY "customer_review_contacts_owner_insert"
  ON public.customer_review_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customer_reviews cr
      WHERE cr.id = customer_review_contacts.review_id
        AND cr.user_id = auth.uid()
    )
  );

REVOKE UPDATE, DELETE ON public.customer_review_contacts FROM authenticated, anon, PUBLIC;

INSERT INTO public.customer_review_contacts (review_id, email)
SELECT id, email FROM public.customer_reviews WHERE email IS NOT NULL
ON CONFLICT (review_id) DO NOTHING;

ALTER TABLE public.customer_reviews DROP COLUMN email;

COMMENT ON COLUMN public.customer_review_contacts.email IS
  'PII — never expose via any anon-readable policy, view, or RPC. Owner-only access via RLS.';