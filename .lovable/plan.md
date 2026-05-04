## Problem

The Budget Coach is producing 7 swap suggestions that don't map to anything the user recognizes in their itinerary. Root cause is two layers of weakness, both visible in the existing data:

1. **Garbage in.** The itinerary contains unresolved placeholder rows like `Dinner (Day 2)`, `Lunch (Day 2)`, `transport (Day 2)` (the same broken rows surfaced in the earlier "All Costs" report). Those rows have real IDs and real costs, so the coach happily targets them as "expensive items to swap."
2. **Title guard is too loose.** `titleMatches()` in `supabase/functions/budget-coach/index.ts` (lines 370-382) accepts a swap if ≥60% of long tokens overlap. A claimed item `"Dinner at Frenchie"` against a real title `"Dinner (Day 2)"` shares the token `dinner` — overlap 1 / min(2,1) = 100% — so the fabricated name slips through and is what the user sees on the card.

Net effect: the coach is suggesting "Dinner at Frenchie" as a swap for a row whose real title is just `Dinner (Day 2)`, and the user — correctly — reads that as a phantom activity.

## Fix

### 1. Drop unresolvable rows from the coach payload (`src/components/planner/budget/BudgetCoach.tsx`)

In `buildPayloadDays()`, skip any activity whose title matches a generic-placeholder pattern, e.g.:

- `/^(breakfast|lunch|dinner|brunch|meal|activity|transport|transit|hotel)\s*(\(|-|$)/i`
- empty / `"Activity"` / `"Untitled"`

Those rows can't be responsibly swapped because we don't know what they actually are.

### 2. Tighten the server-side title guard (`supabase/functions/budget-coach/index.ts`)

In `titleMatches()`:

- Add a stop-word set of meal/category/day words (`dinner, lunch, breakfast, brunch, meal, activity, transport, transit, hotel, day, paris, restaurant, café, cafe`) that are **excluded** from the overlap count.
- Require either: (a) a true substring match of the longer side ≥ 8 chars, or (b) ≥ 2 non-stopword tokens overlapping. A single shared category word like "dinner" must no longer be enough.

### 3. Guard at the same point against placeholder-titled real activities

In the post-filter loop (around line 416), if the real title for `sid` matches the generic placeholder pattern from step 1, drop the suggestion with a `console.log` reason. Belt-and-suspenders for items that bypass the client filter (e.g. cached payloads).

### 4. Surface the real name on the card (already partially done)

Line 457 already overrides `current_item` to the real title server-side — keep it. No UI change required, since after step 1 the only suggestions reaching the UI will target activities with real names.

## Files

- `supabase/functions/budget-coach/index.ts` — strengthen `titleMatches`, add placeholder-title rejection in post-filter.
- `src/components/planner/budget/BudgetCoach.tsx` — filter generic-titled activities out of `buildPayloadDays`.

## Out of scope

Fixing the upstream cause of placeholder rows like `Dinner (Day 2)` lives in the itinerary repair pipeline (see existing `Hallucination Elimination` and `Day Truth Ledger` memories). This change just stops the coach from acting on them.
