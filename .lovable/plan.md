## Stop exposing reviewer emails in `customer_reviews`

### Findings

- Table `public.customer_reviews` has columns `id, user_id, name, email, rating, review_text, trip_destination, archetype, is_featured, is_approved, photo_consent, created_at, updated_at`.
- Current policies:
  - SELECT `Approved reviews are publicly visible` — `is_approved = true`, `{public}` ← leaks `email` (and `name`, `user_id`)
  - SELECT `Users can view their own reviews` — owner-only
  - INSERT `Authenticated users can submit own reviews`
  - UPDATE `Users can update their own reviews`
- Frontend usage: `customer_reviews` is only **written** (`src/components/reviews/ReviewCapturePopup.tsx` inserts a review and prefills the form from `user.email`). **No frontend code reads `customer_reviews` for display** — confirmed by ripgrep. So removing public read access of PII causes zero UI breakage. No public testimonial component currently queries this table.
- Other places `email` is referenced are unrelated (auth user, profiles delete flows).

### Approach

Use Approach A from the request (view-based), but skip the join — the table already has its own denormalized `name` column. Lock the base table to owner-only reads and expose a sanitized view for any future public testimonial UI.

### Migration

```sql
-- 1. Remove the over-broad public SELECT policy
DROP POLICY "Approved reviews are publicly visible" ON public.customer_reviews;

-- Owner SELECT policy ("Users can view their own reviews") is retained — owners
-- can still read their own email (self-data).

-- 2. Lock down column privileges as belt-and-braces (in case a future policy
--    re-broadens public read access, email + user_id stay revoked).
REVOKE SELECT (email, user_id) ON public.customer_reviews FROM anon, authenticated;

-- 3. Public-safe view for displaying approved testimonials
CREATE OR REPLACE VIEW public.public_customer_reviews
WITH (security_invoker = true) AS
SELECT
  id,
  -- Mask name: first character + "***" (e.g., "Jane Doe" -> "J***")
  CASE
    WHEN name IS NULL OR length(btrim(name)) = 0 THEN 'Anonymous'
    ELSE substring(btrim(name) FROM 1 FOR 1) || '***'
  END                                    AS reviewer_display,
  rating,
  review_text,
  trip_destination,
  archetype,
  is_featured,
  photo_consent,
  created_at
FROM public.customer_reviews
WHERE is_approved = true;

-- The view runs with caller privileges. To let anon/auth read approved rows
-- through the view without granting them table SELECT on the base table,
-- add a dedicated permissive SELECT policy scoped to the columns the view
-- actually exposes (email/user_id are still revoked at the column-grant level
-- AND not selected by the view).
CREATE POLICY "Approved reviews readable via view"
  ON public.customer_reviews
  FOR SELECT
  TO anon, authenticated
  USING (is_approved = true);

GRANT SELECT ON public.public_customer_reviews TO anon, authenticated;
```

Why both the new policy and the column-level REVOKE: the policy is needed so the view (security_invoker) can read approved rows under the caller's role; the column REVOKE guarantees that even if a client SELECTs the base table directly, `email` and `user_id` are denied at the privilege layer — independent of RLS.

### Verification

1. Anonymous `select * from customer_reviews` → permission denied on `email`/`user_id` (or empty/error from PostgREST). Approved rows readable only by selecting non-PII columns.
2. Anonymous `select * from public_customer_reviews` → approved rows, no email, name masked.
3. Authenticated non-owner same as above.
4. Owner `select email from customer_reviews where user_id = auth.uid()` → still works via the retained owner-SELECT policy + default grant to row owner.
5. Insert path (`ReviewCapturePopup`) unchanged — INSERT policy unaffected.

### Files

- New migration: `supabase/migrations/<ts>_lock_customer_reviews_pii.sql`

No frontend changes — there is no existing public-read consumer of this table.
