# Structurally isolate customer_reviews.email

## Decision gate result

- `SELECT count(*) FROM customer_reviews` → **0 rows** (0 with email).
- Threshold says <1000 → **Option A (structural isolation)**.

## Code-impact survey

Only one direct writer of `customer_reviews.email` exists:

- `src/components/reviews/ReviewCapturePopup.tsx` (line 78) — single insert that sets `email: email.trim() || null` alongside the review row.

No reads of `customer_reviews.email` anywhere in `src/` or `supabase/functions/`. `delete-users` / `delete-my-account` only touch `auth.users.email`, not the review column. Existing migration `20260510185906` already revokes column-level SELECT on `email` from anon/authenticated — that grant becomes unnecessary once the column is dropped.

## Migration (single file)

```sql
-- 1. New contacts table
CREATE TABLE public.customer_review_contacts (
  review_id  UUID PRIMARY KEY REFERENCES public.customer_reviews(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_review_contacts ENABLE ROW LEVEL SECURITY;

-- 2. Owner-only SELECT (joined back to parent review)
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

-- 3. Owner-only INSERT (so the review submitter can attach their own contact row)
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

-- 4. No UPDATE / DELETE policy → blocked for authenticated/anon by default.
REVOKE UPDATE, DELETE ON public.customer_review_contacts FROM authenticated, anon, PUBLIC;

-- 5. Backfill (no-op at 0 rows, kept for safety/idempotency)
INSERT INTO public.customer_review_contacts (review_id, email)
SELECT id, email FROM public.customer_reviews WHERE email IS NOT NULL
ON CONFLICT (review_id) DO NOTHING;

-- 6. Drop the column from customer_reviews
ALTER TABLE public.customer_reviews DROP COLUMN email;

-- 7. Hardening comment on the new column
COMMENT ON COLUMN public.customer_review_contacts.email IS
  'PII — never expose via any anon-readable policy, view, or RPC. Owner-only access via RLS.';
```

## Code change

`src/components/reviews/ReviewCapturePopup.tsx` — split the single insert into two:

1. Insert the review (without `email`) and `select('id').single()` to get `reviewId`.
2. If `email.trim()` is non-empty, insert `{ review_id: reviewId, email }` into `customer_review_contacts`. Failure here is non-fatal (toast warn, review is already saved).

No other callers to update.

## Memory

Add `mem://constraints/security/customer-reviews-pii-isolation`:
> `customer_reviews.email` was structurally removed (migration 20260511…). Email now lives in `customer_review_contacts`, owner-only RLS. Never re-add an `email` column to `customer_reviews`, and never expose `customer_review_contacts` via any anon-readable policy, view, or RPC. Public review surfaces (e.g. `public_customer_reviews` view) must continue to omit contact data entirely.

Add a one-liner reference under the index `## Memories` section.

## Verification

1. `supabase--linter` — `customer_reviews_email_public_read` finding should resolve.
2. ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_schema='public' AND table_name='customer_reviews' AND column_name='email';
   ```
   → 0 rows.
3. ```sql
   SELECT polname FROM pg_policy
   WHERE polrelid = 'public.customer_review_contacts'::regclass;
   ```
   → exactly the two policies above; no UPDATE/DELETE policies.
4. Smoke: submit a review via `ReviewCapturePopup` with an email; confirm one row in each table and that a different authenticated user cannot SELECT the contact row.

## Out of scope

- The `is_approved` / `is_featured` admin workflow is unchanged — admins now read contact info via service role on `customer_review_contacts` if needed.
- `public_customer_reviews` view requires no edit (already projects out email).
