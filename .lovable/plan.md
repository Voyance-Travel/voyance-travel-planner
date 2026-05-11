## V2 — Defense-in-depth: revoke anon/PUBLIC grants on `customer_review_contacts`

Current state confirmed:
- Anon has SELECT + INSERT table-level grants (legacy default).
- Both RLS policies (`customer_review_contacts_owner_read`, `customer_review_contacts_owner_insert`) are scoped to role `authenticated` and join via `customer_reviews.user_id = auth.uid()`, so RLS already returns 0 rows to anon.
- `ReviewCapturePopup.tsx` writes the row right after authenticated review insert — no anon write path exists.

### Migration

```sql
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.customer_review_contacts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.customer_review_contacts FROM PUBLIC;

-- Authenticated keeps SELECT + INSERT (RLS still enforces owner-only row visibility).
GRANT SELECT, INSERT ON public.customer_review_contacts TO authenticated;
-- service_role bypasses RLS; no explicit grant needed.
```

### Verification queries (run after migration)

```sql
SELECT has_table_privilege('anon',          'public.customer_review_contacts', 'SELECT'); -- expect false
SELECT has_table_privilege('anon',          'public.customer_review_contacts', 'INSERT'); -- expect false
SELECT has_table_privilege('authenticated', 'public.customer_review_contacts', 'SELECT'); -- expect true
SELECT has_table_privilege('authenticated', 'public.customer_review_contacts', 'INSERT'); -- expect true
```

(Skipping `PUBLIC` literal — pg `has_table_privilege` rejects the role name; the REVOKE FROM PUBLIC is still applied and inherited via grant chain.)

### Spot-check

- Submit a review while signed in as user A via `ReviewCapturePopup` → confirm A reads their own `customer_review_contacts` row.
- As user B, attempt to read A's row → 0 rows.
- Signed out (anon), attempt to read → permission denied (table-level, before RLS even fires).

### Memory

Append to `mem://constraints/security/customer-reviews-pii-isolation`: "Anon and PUBLIC have no table-level grants on `customer_review_contacts`. Only `authenticated` (RLS-gated owner-only) and `service_role` (bypasses RLS) may touch it. Adding any anon-readable policy would no-op without first re-granting — that asymmetry is the safety net."

### Out of scope

No application code changes. No RLS policy changes. No backfill.