# M6 — Itinerary card pricing not flowing into Budget tracker

## Root cause (verified — not what the prompt assumes)

Budget tracker IS already reading `activity_costs`:
- `BudgetTab.tsx::"Trip Expenses"` → `snapshot.tripTotalCents`
- → `useTripFinancialSnapshot` → `resolveCanonicalCostRows({ costs: activity_costs… })`
- → returns `effectiveTotalCents` (the [Single Resolver Manual Fold] memory)

The shared resolver, the toBudgetCategory map, and the `getBudgetSummary` rollup all work correctly. **The bug is upstream: `activity_costs` is sparse / missing rows for most priced JSON activities.**

### Why activity_costs is empty/sparse

Two cost-writer paths exist:

| Generator path | Writes `activity_costs`? |
|---|---|
| `generation-core.ts` Stage 6 / Phase 4 (lines 3108–3395) — legacy whole-trip path | ✅ Yes, full table-driven write |
| `action-generate-trip-day.ts` — current per-day chain path (most trips today) | ❌ **No.** Comment at line 3258 says "post-completion cost repair intentionally removed" but the original Phase 4 *write* never existed in this file. Only `handleSyncItineraryTables` runs. |

Result: Trips generated via the per-day chain (the default for >2-day generation) end up with whatever activity_costs `persist-day.ts` wrote during enrichment + whatever the legacy one-shot backfill seeded — frequently just hotel + a handful of rows = $160 total, while JSON cards display ~$3,600.

The frontend `syncBudgetFromDays` (EditorialItinerary.tsx:1371) DOES write all priced JSON activities to activity_costs, but it's intentionally NOT called on initial load (comment at line 1505: prevents "+$340 just now" jumps). It only fires on user edits — so a freshly generated trip stays under-counted until the user touches it.

## Plan

### 1. Backend: write activity_costs at the end of every generation path

**Extract Phase 4** from `generation-core.ts:3107–3395` into shared helper `supabase/functions/_shared/write-activity-costs.ts` exporting:

```ts
async function writeActivityCostsFromItinerary(
  supabase, tripId, days, context: { destination, travelers, budgetTier, actualDailyBudgetPerPerson? }
): Promise<{ inserted: number; skipped: number; reason?: string }>
```

Behavior preserved verbatim: cost_reference lookup → tier picker → walking/free-venue/unverified-meal guards → budget validation scaler → `delete + insert` for the trip.

**Wire-up**:
- `generation-core.ts` Stage 6: replace the inline block with `await writeActivityCostsFromItinerary(...)`.
- `action-generate-trip-day.ts` completion branch (right after `handleSyncItineraryTables`, line 3257, BEFORE the "post-completion cost repair removed" note): `await writeActivityCostsFromItinerary(...)`. This is the missing call.

Both paths end with the same canonical activity_costs snapshot. No behavior change for the legacy path; the chain path now matches.

### 2. Frontend safety net: JSON-cost rescue when row is entirely missing

In `src/services/canonicalCostRows.ts`, extend `resolveCanonicalCostRows` with a third rescue pass that runs AFTER the existing direct + orphan-id loops:

For every `liveActivities[i]` whose id was never `consumed` AND whose `jsonCost > 0` AND whose normalized category is paid (`PAID_CATS` ∪ `activity` ∪ `transport`):
- Synthesize a `ResolvedRow` with `cents = jsonCost × travelers × 100`, `rescueTag: 'json-missing-row'`, `isLogisticsRow: false`, `source: 'json-rescue'`, `isPaid: false`.
- Add to `out` and `totalCents`.
- Skip walking legs (`isWalkingLeg`) and free-venue patterns (mirror existing guards).

Backstop ensures legacy trips (no Phase 4 ever ran) and any future orphan windows still produce correct totals without waiting for a frontend edit. Safe because rescue only fires when no DB row exists at all — once Fix #1 backfills, the direct path wins and rescue is a no-op.

### 3. Auto-backfill trigger for legacy trips on first view

In `useTripFinancialSnapshot` after computing the snapshot, if:
- `costs.length === 0 || (canonical.totalCents === 0 && liveActivities.some(a => a.jsonCost > 0))`
- AND a `lastBackfillFingerprint` ref guard hasn't already fired this session

Then dispatch a one-shot call to a new edge function `sync-trip-cost-table` (thin wrapper over `writeActivityCostsFromItinerary` from #1, using the trip's stored `destination` / `travelers` / `budget_tier`). Fire-and-forget; on success the `booking-changed` event triggers a refetch and the JSON-rescue path quietly drops out.

### 4. Tests

- `__tests__/canonicalCostRows.json-missing-row-rescue.test.ts`: 3 live activities with jsonCost>0, zero costs[] → resolver returns 3 rows with `rescueTag='json-missing-row'`, totalCents = sum × travelers.
- `__tests__/canonicalCostRows.json-missing-row-rescue.test.ts`: same activities + matching costs[] → rescue skipped, no double-count.
- `_shared/__tests__/write-activity-costs.test.ts`: deterministic Phase-4 write given mock cost_reference + days.

### 5. Memory update

Update `mem://technical/finance/ui-total-cost-fallback-logic` (or new `mem://constraints/finance/activity-costs-write-parity`):

> Both generator paths (`generation-core.ts` Stage 6 + `action-generate-trip-day.ts` completion) MUST call shared `writeActivityCostsFromItinerary`. Per-day chain previously skipped Phase 4 → Budget tracker drifted to $160 vs $3,600. Frontend `resolveCanonicalCostRows` carries a `json-missing-row` rescue safety net for legacy trips; `useTripFinancialSnapshot` auto-triggers `sync-trip-cost-table` once when canonical total is $0 but live JSON has prices.

## Files

- `supabase/functions/_shared/write-activity-costs.ts` (new — extracted Phase 4)
- `supabase/functions/generate-itinerary/generation-core.ts` (replace inline Phase 4 with helper call)
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (add helper call after table sync)
- `supabase/functions/sync-trip-cost-table/index.ts` (new — wrapper edge function for #3)
- `src/services/canonicalCostRows.ts` (add json-missing-row rescue pass)
- `src/hooks/useTripFinancialSnapshot.ts` (auto-trigger backfill on $0 + JSON-priced live)
- `src/services/__tests__/canonicalCostRows.test.ts` (extend with 2 new cases)
- `supabase/functions/_shared/__tests__/write-activity-costs.test.ts` (new)
- Memory update

## Verify

- 3-day Madrid trip with €830/pp in JSON cards + hotel:
  - Backend logs show `[Phase 4] Wrote N activity_costs rows (table-driven)` from the chain path completion.
  - Budget dashboard "Trip Expenses" reads ~$3,600 (matches itinerary totals), Food/Activities/Transit categories non-zero.
  - Reopen a legacy trip with empty `activity_costs`: snapshot reads ~correct total via JSON rescue immediately, then auto-backfills on first view; subsequent reload hits the canonical rows path.
