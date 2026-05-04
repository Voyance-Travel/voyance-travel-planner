# Two missing Payments rows — root cause + fix

## What's actually happening

I queried the trip and the data tells a clear story:

`activity_costs` has rows for both activities, but with `cost_per_person_usd = 0` and `notes = "[Free venue - Tier 1]"`:

| activity_id | day | title (from JSON) | JSON cost | DB cost | DB notes |
|---|---|---|---|---|---|
| `b402d7a7…` | 1 | Dinner at Frenchie | $70 | **$0** | [Free venue - Tier 1] |
| `190ff620…` | 3 | Breakfast at La Fontaine de Belleville | $18 | **$0** | [Free venue - Tier 1] |
| `8d585833…` | 1 | Lunch at Chez Janou | $40 | **$0** | [Free venue - Tier 1] |

(Lunch at Chez Janou is also missing from Payments for the exact same reason — the user only spotted two of three.)

Two compounding bugs in `src/hooks/usePayableItems.ts`:

1. **DB-driven loop (line 270)**: `if (cents <= 0) continue;` — silently drops the row.
2. **JSON-walk fallback (line 359)**: `seenActivityIds` is built from `result`, but `seenActivityIds` is also populated implicitly by anything in `activity_costs` because the DB loop adds nothing for $0 rows yet still "claims" the activity… actually no — re-reading: `seenActivityIds` is only populated from items pushed to `result`. So the fallback *should* catch these. Why doesn't it?

   Because the fallback then runs `isLikelyFreePublicVenue({ title, category })` (line 364). For `category: 'dining'` with a restaurant title, this should return false — but if it's returning true for these names, that's the second bug. More likely: the fallback IS running but `estimateCostSync` returns 0 for some reason, OR the activity's `category` is being read as something the fallback's `FREE_CATEGORIES` skips.

   I'll instrument-confirm this in the fix branch, but the safe, deterministic fix doesn't depend on knowing which path fails: **stop trusting `cost_per_person_usd = 0` when the source itinerary has an explicit non-zero cost**.

## The fix

### 1. Frontend: `src/hooks/usePayableItems.ts` (deterministic, immediate)

In the DB-driven loop (around line 266–313), when a non-transit row has `cents <= 0`:
- Look up the matching activity in `activityNameById` extended to also carry `cost`/`estimatedCost` from the JSON.
- If the JSON has an explicit positive cost for that activity, use it instead of skipping.
- Tag the resulting `PayableItem` with a `source: 'json-fallback'` field (internal, for debugging) and add it to `result`.

This guarantees: any activity that appears in the itinerary with a real cost will appear in Payments, regardless of how the cost pipeline mislabeled it.

Also: tighten the JSON-walk fallback's free-venue heuristic so `category === 'dining'` is never treated as a free public venue (a restaurant is not a park).

### 2. Backend: stop creating bogus `[Free venue - Tier 1]` rows for restaurants

The pipeline that writes `activity_costs` is tagging named restaurants like "Frenchie", "Chez Janou", "La Fontaine de Belleville" as Tier 1 free venues. Search for the writer:

- `src/services/budgetLedgerSync.ts` and the edge functions that call into it
- The "Tier 1 / free venue" classifier (likely `lib/cost-estimation` or a server-side equivalent)

Fix: the free-venue classifier must short-circuit to `false` whenever `category === 'dining'`. Dining is never free. (Cafés with no entry fee are still paid — you order food.)

Also clean up the existing 3 bad rows on this trip via a one-off update so the user sees the fix immediately without waiting for a re-sync.

### 3. Data backfill (one-off, this trip only)

Update the three offending `activity_costs` rows to use the JSON costs:
- `b402d7a7…` → $70/pp
- `190ff620…` → $18/pp
- `8d585833…` → $40/pp

Clear the `[Free venue - Tier 1]` note and set `source = 'json-rescue'`.

## Why both layers

Frontend-only fix: Payments will be correct, but Budget totals and the Budget Coach (which read from `activity_costs`) will still under-count by ~$256 on this trip alone.

Backend-only fix: future trips correct, but this trip stays broken until something forces a re-sync.

Doing both means: this trip is fixed now, and no future trip has the same problem.

## Files to change

- `src/hooks/usePayableItems.ts` — JSON cost fallback for $0 DB rows; tighten free-venue heuristic for dining.
- `src/lib/cost-estimation.ts` (and/or its server twin) — `isLikelyFreePublicVenue` returns false when category is dining/restaurant/meal.
- The cost-sync edge function that classifies "Tier 1 free venue" — same guard.
- One-off data update for the 3 affected rows on trip `7ea828ac…`.

## Out of scope (already noted in earlier rounds, still pending)

- Generic-named itinerary rows (`Dinner (Day 2)`, `transport (Day 2)`).
- Hotel committed without `pricePerNight`.
- All-Costs list collapse bug (#5 from the summary).
