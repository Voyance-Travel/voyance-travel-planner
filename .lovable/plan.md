# Batch 3 verification + R1-redo migration

## Verification results (Q10–Q16)

| # | Item | Status | Evidence |
|---|---|---|---|
| Q10 | AI notes load-path hydration | ✅ SHIPPED | `aiNotes` is in `src/types/itinerary.ts` (source) and the DB→frontend mapper at line 284 copies `aiNotes: activity.aiNotes`. Full round-trip works. R7 closes as resolved — JSONB blob path is intentional and correct. |
| Q11 | Refund-on-failure for regenerate_day | ⚠️ PARTIAL (by design) | No server-side try/catch refund in `action-generate-day.ts`. Instead the **client** owns the refund via `useGenerationGate` (line 211–251): on failure it invokes `spend-credits` with `originalIdempotencyKey` + `defensiveRefundKey`. `spend-credits` (lines 377–436) supports this via `originalIdempotencyKey` lookup — `regenerate_day: 0` placeholder forces it to read the actual debit from the ledger. Works as long as the client stays alive long enough to fire the refund. If user closes tab mid-failure, no refund. Architectural call — flagging, not blocking. |
| Q12 | Edit-trip-dates activity shift | ✅ SHIPPED | `voyanceAPI.updateTrip` (lines 264–276) throws hard if `startDate`/`endDate` change without `allowDateChange: true`. Comment cites the orphan footgun explicitly and routes callers to `TripDateEditor → TripDetail.handleDateChange`. |
| Q13 | Mid-trip invite auto-regen | ✅ SHIPPED | `AcceptInvite.tsx` line 286–291: if `itinerary_status === 'ready'`, fires `regenerate-on-blend-change`. `TripCollaboratorsPanel.handleTogglePreferences` line 237–241: also fires `regenerate-on-blend-change` on every toggle direction (both ON and OFF). |
| Q14 | Even-weight blending | ✅ SHIPPED | `dnaBlending.ts` line 135: `ownerWeight: evenWeight`. Lines 101–106 apply `evenWeight` to both owner and every companion symmetrically. No 50/50 owner bias. |
| Q15 | Frontend idempotencyKey coverage | ✅ SHIPPED | 9 distinct call sites: `useSpendCredits`, `useUnlockDay`, `useGenerationGate`, `checkoutAPI`, `bookingsV1API`, `FindMyHotelsDrawer`, `TripConfirmationBanner`, `ItineraryAssistant`, `EditorialItinerary` (regenerate-trip + 2 spend contexts). |
| Q16 | Curated destination images | ✅ SHIPPED | All 6 named keys present (`venice`, `naples`, `stockholm`, `athens`, `madrid`, `santorini`) plus 23 others — 29 destinations curated in `src/utils/destinationImages.ts`. |

**Tally:** 6/7 clean, 1 architectural note (Q11 client-owned refund). No critical drift.

## R1-redo — Ship migration

Drop the leftover anon SELECT policy on `customer_reviews` and REVOKE direct table access so anon callers must use the `public_customer_reviews` view (which omits `email`/`user_id`).

```sql
-- Drop the leftover anon policy on base table
DROP POLICY IF EXISTS "customer_reviews_anon_approved_read" ON public.customer_reviews;

-- Belt-and-suspenders: revoke direct table SELECT from anon/public
REVOKE SELECT ON public.customer_reviews FROM anon;
REVOKE SELECT ON public.customer_reviews FROM PUBLIC;

-- Keep authenticated owner-read policy + authenticated INSERT (unchanged)
-- public_customer_reviews view already exists from prior migration and remains the anon read path
```

## Verification after migration

1. SQL: `SELECT policyname FROM pg_policies WHERE tablename = 'customer_reviews' AND 'anon' = ANY(roles);` → 0 rows.
2. SQL: `SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'customer_reviews' AND grantee IN ('anon','PUBLIC');` → 0 rows.
3. Anon curl on base `customer_reviews` → 401/empty; on `public_customer_reviews` → rows without `email`.
4. Re-run Supabase linter — the email PII finding on `customer_reviews` should be gone.
5. Confirm no frontend code reads `customer_reviews` directly as anon (logged-in owner reads stay intact via owner-read policy).

## Out of scope

- Q11 server-side refund hardening (current client-owned refund is a known design tradeoff, not a regression — flag for separate decision).
- Any frontend changes — none required by R1-redo since the public-facing reads already go through the view.
