# Consolidate Guards: End the Whack-a-Mole

## Why this keeps happening

Each symptom has 3–5 overlapping guards in different files. They were added one at a time as bugs appeared. They have **subtly different rules** and **no single owner**, so:

- A new code path can skip them all (the "Spa — find a venue" leak).
- Two guards disagree on the same row (Payments "Totals differ").
- A repair runs *after* persistence reads the row (ghost 12:15 AM survives).
- The fallback DB itself produces dirty data that 4 layers then filter (wrong-city restaurants).

The fix is **not another sweeper**. It is to designate **one owner per concern**, delete the duplicates, and add an assert at the boundary so regressions fail loudly instead of silently producing dirty rows that downstream guards then "save."

---

## Symptom 1 — Payments "Totals differ"

**Owner today:** split between `useTripFinancialSnapshot`, `usePayableItems`, `PaymentsTab` (fingerprint + auto-reconcile), `canonicalCostRows`.

**Consolidate to:** `canonicalCostRows` is the **only** place that resolves rows → cents. Both consumers call it with identical inputs and trust the output. Remove fingerprint/auto-reconcile in `PaymentsTab` — if totals ever differ, that's a bug to surface in dev, not paper over in prod.

**Concrete changes:**
1. `useTripFinancialSnapshot` and `usePayableItems` both call `resolveCanonicalCostRows` with the same `(costs, liveActivities, includeHotel, includeFlight)` derived from one shared selector hook (`useCanonicalTripCosts`).
2. Delete `PaymentsTab` reconciliation badge + auto-reconcile loop. Replace with a dev-only `console.assert` when sums diverge.
3. Add a unit test: same fixture → both consumers return same total, across 6 trip shapes (transit-heavy, hotel-only, multi-city, paid+pending, walking legs, $0 JSON rescue).

**Effect:** the badge can no longer flicker because there is no second number to disagree with.

---

## Symptom 2 — Ghost 12:15 AM entry on Day 2

**Owner today:** `hideGhostActivities` (render filter), `repair-day.ts` Step 8 (generator), `universal-quality-pass.ts` (post-gen).

**Root cause:** the row is *persisted* with `startTime: 00:15`. The render filter hides it on the itinerary page but it leaks into Payments rows, day exports, and any consumer that doesn't import `isGhostActivity`.

**Consolidate to:** **prevent persistence**, don't hide at render.

**Concrete changes:**
1. In `save-itinerary` (server, single chokepoint), reject any non-locked activity with `startTime` between `00:00` and `04:59` whose `category` is `accommodation`/`wellness`/`logistics`. Drop it before write. Log once.
2. Delete the `hideGhostActivities` render filter. If the server contract holds, the client never sees one.
3. Keep `repair-day` Step 8 but downgrade it to an **assert** in dev (throws) and a silent drop in prod with a counter metric.

**Effect:** one rule, one location, one log line. No more "leaked into a new view" regressions.

---

## Symptom 3 — "find a local spot" / "Spa — find a venue"

**Owner today:** `sanitizeActivityName`, `nuclearWellnessSweep`, `fix-placeholders`, `wellnessPlaceholderDetection`, client `fallbackRestaurants`, `verified_venues` filter.

**Root cause:** the generator is *allowed* to emit a row whose `name` matches a placeholder pattern. Six guards then race to relabel it. Whichever path skips a guard wins.

**Consolidate to:** the generator output **must** pass a single `assertNoPlaceholderName(activity)` at the **boundary of `persist-day`** (server). If a name matches the union pattern, the activity is either replaced from the city-keyed fallback DB **or dropped** (no "find a venue" sentinel rendered as a real card).

**Concrete changes:**
1. New file `supabase/functions/_shared/placeholder-contract.ts`: single regex union `PLACEHOLDER_NAME_RE` + single `repairOrDrop(activity, city)` function. All 6 existing guards re-export from this file.
2. `persist-day` calls `repairOrDrop` on every activity. After this point, no row with a placeholder name can exist in the DB.
3. Delete `nuclearWellnessSweep`, the client `sanitizeActivityName` hotel short-circuit, and the render-time fallback in `EditorialItinerary`. The render path renders what the DB says; the contract guarantees the DB is clean.
4. Keep `isGhostActivity`-style render filter only as a temporary safety net behind a feature flag, removable after one week of clean logs.

**Effect:** zero placeholder cards possible. New code paths inherit the contract because they all go through `persist-day`.

---

## Symptom 4 — Wrong-city restaurants

**Owner today:** 4 layers added last turn (client pools, meal guard, `verified_venues` prefetch filter, venue-cache).

**Root cause:** the *fallback DB shape* is wrong. `INLINE_FALLBACK_*` is partially country-pooled and partially city-keyed. Filters re-derive city from name regex, which is brittle.

**Consolidate to:** **city is a required field on every fallback row.** Filters become a one-line equality check.

**Concrete changes:**
1. Migrate `src/lib/fallbackRestaurants.ts` and `supabase/functions/_shared/fallback-meals.ts` to a single shape: `{ name, city: string (canonical), country, ... }`. No country pools, no GLOBAL pool.
2. Replace `detectCrossCityMention` regex filter with `row.city === destinationCity` exact match (canonicalize via existing `cityCountryMap`).
3. Delete the 4-layer guard chain. Keep one assert in `persist-day`: `activity.location.city === trip.city || activity.locked`.
4. Generator prompt: pass only the city-matched subset to the model, never the full DB.

**Effect:** wrong-city venues become structurally impossible. Filters drop from ~200 lines to ~10.

---

## Cross-cutting: enforce the contract

Add `supabase/functions/generate-itinerary/persist-day-contract.ts` with one exported `assertCleanDay(day, trip)` that runs:
- No ghost rows (00:00–04:59 non-locked accommodation/wellness/logistics).
- No placeholder names (`PLACEHOLDER_NAME_RE`).
- No wrong-city venues (`row.city === trip.city` or locked).
- No prompt artifacts (`/\(\s*(slot|aesthetic|placeholder)\s*\)/i`).

`persist-day` calls it. In dev: throw. In prod: drop offending rows, log with `[CONTRACT_VIOLATION]` so we see exactly which generator path leaked.

---

## Files touched

```text
NEW   supabase/functions/_shared/placeholder-contract.ts
NEW   supabase/functions/generate-itinerary/persist-day-contract.ts
NEW   src/hooks/useCanonicalTripCosts.ts
EDIT  supabase/functions/generate-itinerary/persist-day.ts        (call contract)
EDIT  supabase/functions/generate-itinerary/save-itinerary.ts     (ghost reject)
EDIT  src/lib/fallbackRestaurants.ts                              (city-keyed shape)
EDIT  supabase/functions/_shared/fallback-meals.ts                (city-keyed shape)
EDIT  src/hooks/useTripFinancialSnapshot.ts                       (use shared selector)
EDIT  src/hooks/usePayableItems.ts                                (use shared selector)
EDIT  src/components/itinerary/PaymentsTab.tsx                    (drop reconcile UI)
DEL   src/lib/itinerary/hideGhostActivities.ts                    (after 1wk flag)
SHRINK supabase/functions/_shared/verified-venues-filter.ts       (one-line check)
SHRINK supabase/functions/generate-itinerary/fix-placeholders.ts  (delegate to contract)
SHRINK src/utils/activityNameSanitizer.ts                         (delegate)
SHRINK src/utils/wellnessPlaceholderDetection.ts                  (delegate)
```

Net: **~1,200 lines removed, ~300 added, 4 symptom classes structurally extinct.**

## Order of work

1. Payments unification (lowest risk, immediate user-visible win).
2. Ghost server-side reject + delete render filter behind flag.
3. Placeholder contract + delete duplicates.
4. Fallback DB city-keying + filter shrink.
5. Memory updates: collapse the 4 cross-city / wellness / ghost memories into one "Persist-Day Contract" entry; delete the obsolete sweeper memories.

Each step is independently shippable and independently reversible.
