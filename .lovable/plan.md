# Batch 4 verification + Option 1 (cron sweeper)

## Batch 4 results (Q17–Q24)

| Q | Item | Status | Evidence |
|---|---|---|---|
| Q17 | Unsplash Tier 2A fallback | ✅ SHIPPED | `destination-images/index.ts` L373–439 `tryUnsplashFallback` + L1623–1626 dispatch; needs `UNSPLASH_ACCESS_KEY` secret |
| Q18 | Per-category price sanity | ✅ SHIPPED | `CATEGORY_PRICE_CEILINGS` in `_shared/category-price-bounds.ts`; `checkPlausiblePricing` in `validate-day.ts` L183/198; `PRICE_IMPLAUSIBLE` repair in `repair-day.ts` L2910–2948 + `action-repair-costs.ts` L494 |
| Q19 | Hotel-return on non-departure days | ✅ SHIPPED | `repair-day.ts` L4066 `injected_midday_hotel_return` + L4120 `injected_hotel_return`; gated on `isDepartureDay` (L1511/1921), runs on all non-departure days. Save-time net at `action-save-itinerary.ts` L434 + `action-generate-trip-day.ts` L1813 |
| Q20 | Meal injection at repair | ⚠️ NO MATCH | No `MISSING_MEAL` / `repairMissingMeals` / `generateSingleMealActivity` token found in pipeline. Meal-guard runs at generate-trip-day (per memory) but repair-day does **not** inject; only validate flags. Needs investigation — possible drift |
| Q21A | 5 new DNA traits | ✅ SHIPPED | All 5 traits present in `quiz-questions-v3.json` weights + schema L1426 |
| Q21B | q22/q23 added | ✅ SHIPPED | `q22_accomplishment` L1297, `q23_recharge` L1348, registered in step 10 L2002 |
| Q21C | Forbidden pairs + adjusted score | ✅ SHIPPED | `archetype-matcher.ts` L17 `FORBIDDEN_PAIRS`, L464 `adjustedScore` w/ 0.7 same-category penalty, L469 forbidden-pair filter |
| Q21D | eco_ethicist constraints | ⚠️ PARTIAL | `eco_ethicist` defined in quiz JSON L1806 + rarity/group/narratives, but no `elephant`/`tiger temple` avoid-list match found. Constraint file may be elsewhere or never landed |
| Q22A | discover-proactive auth | ✅ SHIPPED | `index.ts` L39–45 reads Authorization header + `auth.getUser()` |
| Q22B | activity-concierge auth + CostTracker | ⚠️ PARTIAL | Auth check present L133 `authClient.auth.getUser()`. **No `trackCost`/`CostTracker` import** — cost tracking did not ship for this function |
| Q22C | itinerary-chat daily cap | ✅ SHIPPED | `DAILY_CHAT_CAP = 50` L29, enforcement L496–505 |
| Q23 | EUR rate unification | ✅ SHIPPED | Single source `supabase/functions/_shared/exchange-rates.ts` L18 `EUR: 0.86`; both `src/lib/currency.ts` and `generate-itinerary/currency-utils.ts` re-export from it. No duplicate table |
| Q24 | Refund-day cleanup of activity_costs | ⚠️ MOVED | No `persist-day.ts` exists. Cleanup found in `generation-core.ts` L3388 `activity_costs.delete().eq('trip_id', tripId)`. Likely correct but **trip-wide delete on regenerate-day** is worth confirming scope — could be over-broad |

**Tally:** 9 clean, 3 partial/drift (Q20 meal-inject, Q21D eco constraints, Q22B concierge cost-track), 1 needs-scope-check (Q24).

None are launch-blockers; flag for batch 5 or post-launch hardening.

---

## Option 1: pg_cron stale pending-charge sweeper

Closes the tab-close-mid-failure window where a `pending_credit_charges` row stays `pending` indefinitely and the user silently loses credits.

### Design

A pg_cron job runs every 5 minutes and invokes a SECURITY DEFINER function `sweep_stale_pending_charges()` that:

1. Finds `pending_credit_charges` rows where:
   - `status = 'pending'`
   - `created_at < now() - interval '5 minutes'`
   - `refund_attempts < 3` (respects existing client-side max-attempts contract from `useStalePendingChargeRefund`)
2. For each row, calls the existing `spend-credits` edge function via `pg_net.http_post` with:
   - `action: 'REFUND'`
   - `creditsAmount`, `tripId`, `userId` from the row
   - `metadata.reason = 'cron_stale_pending_sweeper'`
   - `metadata.pendingChargeId = id` (atomic dedup against existing idempotency layer)
   - `metadata.originalAction = action`
3. Increments `refund_attempts` immediately (race protection against the client hook running at the same time).
4. The existing `spend-credits` REFUND handler does the actual ledger reversal + marks the row `refunded` — we reuse its idempotency, no duplicate refund logic.

### Why 5 minutes

- Matches the client hook's `STALE_THRESHOLD_MS = 2 minutes` but adds 3-minute buffer so the client always gets first shot.
- Generation P99 is ~90s; 5 min is well past any legitimate in-flight charge.

### Idempotency / collision with client hook

Both code paths set `metadata.pendingChargeId` and call `spend-credits` REFUND. `spend-credits` already dedupes refunds by `originalIdempotencyKey` / pending charge id (per Q11 architecture). Worst case: both fire simultaneously → second one is a no-op.

The `refund_attempts` UPDATE uses `WHERE refund_attempts = <current value>` (optimistic lock) so only one path increments per attempt.

### Files

**1 migration** (`supabase/migrations/<timestamp>_stale_charge_cron_sweeper.sql`):

- `CREATE OR REPLACE FUNCTION public.sweep_stale_pending_charges()` — SECURITY DEFINER, plpgsql, loops over stale rows, fires `net.http_post` to `/functions/v1/spend-credits` with service-role JWT (read from vault — same pattern as existing cron jobs in this project).
- `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated;` (callable only by cron / service role).
- `SELECT cron.schedule('sweep-stale-pending-charges', '*/5 * * * *', $$SELECT public.sweep_stale_pending_charges()$$);`
- Guard: `cron.unschedule` first if same name exists (idempotent re-run).

**Note on service-role key:** the migration tool runs as the project owner so `vault.decrypted_secrets` works. If the project already has a cron-friendly pattern (e.g. a `SERVICE_ROLE_KEY` vault secret), reuse it; otherwise the migration creates a `cron_caller_token` secret. I'll confirm which exists before writing the migration.

### Verification after ship

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'sweep-stale-pending-charges';
-- Then manually insert a fake stale charge (created_at = now() - '10 min', status='pending')
-- Wait 5 min, confirm status flipped to 'refunded' and credits returned
```

### Not in scope

- No change to `useStalePendingChargeRefund` client hook (keeps fast-path responsiveness).
- No change to `spend-credits` (relies on existing REFUND handler).
- No change to client-side generation flow.

---

## Deliverable

One migration via `supabase--migration` for the cron sweeper. After approval, I'll verify the job is scheduled and report the 3 partial Batch 4 items (Q20, Q21D, Q22B) for inclusion in Batch 5 or backlog.
