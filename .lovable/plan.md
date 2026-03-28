

## Table-Driven Cost Architecture — Implementation Plan

### What's Already Built
The database infrastructure from your original spec is **already in place**:
- `cost_reference` table with indexes and RLS
- `activity_costs` table with validation trigger (`validate_activity_cost`)
- `exchange_rates` table with seed data
- Four SQL views: `v_trip_total`, `v_day_totals`, `v_budget_by_category`, `v_payments_summary`
- Service layer (`activityCostService.ts`) with typed queries for all views
- `useTripFinancialSnapshot` hook reading from `activity_costs`
- `backfill-activity-costs` edge function
- `action-repair-costs` in generate-itinerary

**What's still broken**: The generation pipeline still asks the AI for costs, the Trip Summary header still falls back to JS-summed `estimatedCost` from JSON, and the Budget Coach can still corrupt prices.

---

### Phase 1: Seed cost_reference (foundation for everything else)

Populate `cost_reference` with real price ranges for cities in existing trips. Use a one-time script to insert ~200-300 rows covering Hong Kong, Tokyo, Shanghai, Beijing, Austin, Barcelona, and other active destinations. Categories: dining (street_food, casual, mid_range, fine_dining), transport (metro, bus, taxi, airport_transfer, ferry), activity (museum, temple, attraction, tour), nightlife (bar, lounge, club), shopping.

Tag all as `source: 'ai_seeded'`, `confidence: 'medium'`.

**Files**: Migration SQL (INSERT statements via insert tool)

---

### Phase 2: Generation pipeline — stop asking AI for costs

**2a.** Update `prompt-library.ts` to remove cost estimation instructions from the AI prompt. Change the schema to NOT include `cost` or `estimatedCost` fields in the expected output.

**2b.** Rewrite Phase 4 in `generate-itinerary/index.ts` (lines ~4420-4500) to:
1. For each activity, look up `cost_reference` by `(destination_city, category, subcategory)`
2. Select `cost_low/mid/high_usd` based on budget tier
3. Write to `activity_costs` with `source: 'reference'` and `cost_reference_id`
4. Fall back to country-level or global defaults only when no reference exists

**2c.** Remove the budget-scaling math that creates odd non-round numbers. Instead, the reference table already provides tier-appropriate costs.

**Files**: `supabase/functions/generate-itinerary/prompt-library.ts`, `supabase/functions/generate-itinerary/index.ts`

---

### Phase 3: Trip Summary header — use DB, kill JS fallback

The Trip Summary header currently computes `totalCost` via a JS fallback that sums `estimatedCost` from JSON (line 3019-3049 of `EditorialItinerary.tsx`). It only uses the DB snapshot when `snapshotTotalUsd > 0`.

**Fix**: Remove the JS fallback entirely. Show a loading state while the snapshot loads, then display the DB value. This eliminates the #1 source of divergence.

**Files**: `src/components/itinerary/EditorialItinerary.tsx`

---

### Phase 4: Budget Coach guardrails

**4a.** Update `budget-coach/index.ts` system prompt to add explicit rules: never set costs, only suggest swaps from `cost_reference`, always cite the reference table.

**4b.** Add server-side validation: if the Budget Coach response contains a cost modification action, reject it and re-prompt with swap-only instructions.

**Files**: `supabase/functions/budget-coach/index.ts`

---

### Phase 5: Backfill existing trips

Run the existing `backfill-activity-costs` edge function against all trips. It already validates against `cost_reference` and auto-corrects outliers. After Phase 1 seeds the reference data, the backfill will have real ranges to validate against.

**Files**: No code changes — invoke existing edge function

---

### Phase 6: Clean up legacy paths

Remove `estimateCostSync()` usage from `usePayableItems.ts` and `EditorialItinerary.tsx`. These client-side estimation paths are the #2 and #3 sources of divergence. All cost display should read from `activity_costs` via the SQL views or the financial snapshot hook.

**Files**: `src/hooks/usePayableItems.ts`, `src/components/itinerary/EditorialItinerary.tsx`, `src/lib/cost-estimation.ts`

---

### Priority Order

| Phase | Impact | Risk |
|-------|--------|------|
| 1. Seed cost_reference | Foundation | Low — data-only |
| 2. Fix generation pipeline | Prevents new corruption | Medium — touches generation |
| 3. Fix Trip Summary header | Eliminates #1 divergence | Low — removes code |
| 4. Budget Coach guardrails | Prevents user-facing corruption | Low — prompt + validation |
| 5. Backfill existing trips | Fixes historical data | Low — uses existing tool |
| 6. Remove legacy paths | Eliminates remaining divergence | Medium — many files |

### What This Does NOT Change
- The `activity_costs` table schema (already correct)
- The SQL views (already correct)
- The validation trigger (already correct)
- The `useTripFinancialSnapshot` hook (already reads from DB)

