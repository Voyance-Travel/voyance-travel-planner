## The bug

"Meal (Day 1)" in the All Costs view is the generic fallback in `src/services/tripBudgetService.ts` (line 447). It fires whenever a row in `activity_costs` has an `activity_id` that no longer exists in the trip's `itinerary_data.days[].activities[].id`.

I confirmed this on the live Paris trip (`7ea828ac…`):

| Row | `activity_id` | In itinerary JSON? |
|---|---|---|
| Day 1 dining $25 | `fec938a1-…` | **No** — orphan |
| Day 1 dining $45 | `9e0a278f-…` | Yes → "Lunch at Le Comptoir du Relais" |

Day 1's actual dinner in JSON is `Dinner at Sacré Fleur` (id `767e3a94…`) but no cost row references it. So a later quality/sanitization pass replaced the dinner activity (and minted a new id) without re-writing `activity_costs`. The result: an orphan dining row with no name, and a missing cost row for the real dinner.

The page-load `syncBudgetFromDays` was disabled this morning to fix the "+$340 just now" jumps, so the orphan-cleanup that used to mask this no longer runs.

## Plan

Three layers, smallest to largest impact:

### 1. Resilient name resolution (the visible fix)

In `src/services/tripBudgetService.ts` and `src/hooks/usePayableItems.ts`, when `activity_id` lookup misses, try a secondary match by **(day_number, category)** against the itinerary's activities. Build a per-(day, category) queue of unmatched activity names and pop one for each unmatched cost row. Only fall back to "Meal (Day N)" if even that fails.

Effect: the orphan Day 1 row will display "Dinner at Sacré Fleur" instead of "Meal (Day 1)".

### 2. Orphan reconciliation on hydration

Add a one-shot reconciliation in `EditorialItinerary.tsx` that, on initial load, checks for `activity_costs` rows whose `activity_id` isn't present in the current itinerary JSON. For each orphan that can be matched 1:1 to an itinerary activity by (day, category), `UPDATE activity_costs SET activity_id = <new id>` — no price change, just a key fix. Wrap behind a `metadata.last_costs_reconciled_at` flag so it runs at most once per trip until the itinerary is regenerated.

This keeps the DB consistent without re-introducing the page-load price drift.

### 3. Prevent recurrence at the source

In `supabase/functions/generate-itinerary/universal-quality-pass.ts` (and any other late-stage pass that swaps activities), when an activity is replaced, **preserve the old `id`** instead of minting a new UUID. If a brand-new activity is genuinely added, also call into the same Phase-4 cost-write helper from `generation-core.ts` for that single activity.

This is the durable fix. I'll scope this to the specific replacement paths I can identify in `universal-quality-pass.ts` and `day-validation.ts` (the two files that mint new activity IDs late).

## Files touched

- `src/services/tripBudgetService.ts` — secondary (day, category) name resolution
- `src/hooks/usePayableItems.ts` — same fallback so Split Bill reads match
- `src/components/itinerary/EditorialItinerary.tsx` — one-shot orphan key reconciliation on mount
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — preserve `id` on activity replacement
- `supabase/functions/generate-itinerary/day-validation.ts` — same

No schema changes; no price changes. Approve to apply.