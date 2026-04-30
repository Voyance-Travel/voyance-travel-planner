## Goal

Make the rule engine actually enforce its rules across all days, not collapse after day 1. Three concrete bugs, all in or near `supabase/functions/generate-itinerary/ledger-check.ts`, all visible in your most recent Paris generation log.

## Evidence (from the live log you just generated)

```text
Day Brief: removed 15, inserted 0 placeholder(s), warnings 16
[day 2] repeat: Removed "Travel to Paris Marriott Champs Elysees Hotel"
[day 2] repeat: Removed "Freshen Up at Paris Marriott Champs Elysees Hotel"
[day 2] repeat: Removed "Return to Paris Marriott Champs Elysees Hotel"
[day 3..6] repeat: same three rituals, every single day
[day 4] vibe_clash: Arpège (day 4) and Le Cinq (day 5) — warning only, nothing happens
[day 5,6] repeat: Removed "Lunch: Girafe" (proposed twice, deleted once)
```

The AI generated the trip correctly. The dedup rule destroyed it.

## Bug 1 — Daily anchors get deleted by dedup

`ledger-check.ts` line 180-197 runs every later-day activity through `fuzzyMatch` against every prior day's titles. `fuzzyMatch` returns true on `includes`, so "Return to Marriott" on day 2 matches "Return to Marriott" on day 1 and gets removed. This violates the Core memory rule "explicit Return to Hotel after last non-stay activity" — that's per-day, not once.

**Fix:** Add `isDailyAnchor()` exemption. An activity is a daily anchor if its title matches any of these patterns (case-insensitive):

```text
^(return to|travel to|taxi to|head back to|back to)\b.*\b(hotel|resort|inn|stay|accommodation)
^(freshen up|wellness refresh|midday break|siesta|recharge)
^(check[\- ]?(in|out)) at\b
^(breakfast at (the )?hotel|breakfast at .*marriott|hilton|hyatt|...)
```

If `isDailyAnchor(activity)` is true, skip the repeat-already-done filter entirely. Anchor-guard already handles "did the user lock this once and we missed it" — those are the *first*-day cases, not the repeats.

Also exclude activities tagged `category: 'transport' | 'transportation' | 'accommodation' | 'wellness'` from dedup when their title contains the hotel name. Hotel-anchored daily rituals are by definition repeating.

## Bug 2 — Restaurant double-booking on consecutive days

"Lunch: Girafe" appeared on day 5 *and* day 6 in the same generation run. The repeat-filter caught it on day 6, but the AI shouldn't have proposed it twice. The blocklist sent to the prompt is `usedRestaurants (7)` from `[generate-day]` — it's only updated *after* a day completes, so when days are generated in parallel or in the same batch, day 6's prompt never saw day 5's pick.

**Fix:** In `compile-prompt.ts` (or wherever the restaurant pool is filtered), include all restaurants already proposed in *earlier days of the current generation run*, not just persisted ones. Easiest implementation: pass `prevDaysActivities` into compile-prompt and append all dining-category venue names to `blocklist` before the restaurant pool is computed. This is a 5-line change.

## Bug 3 — Vibe clash is a warning only

Line 223-236 logs the clash but never mutates. With Luminary archetype the rule (Core memory) is "1–3 Michelin dinners total" — back-to-back splurge dinners is exactly the failure mode that warning is designed to prevent.

**Fix:** Promote `vibe_clash` from warning-only to *auto-action*. When today and tomorrow are both splurge dinners:

1. If tomorrow's dinner is locked/user-pinned → leave today's, just warn.
2. Otherwise: clear tomorrow's dinner activity (don't remove the slot — replace title with a casual placeholder marked `needsRecommendation: true` and add a warning so downstream restaurant-recommendation logic fills it). 

This needs a small extension to `forwardState` so we can mutate the next-day activities array, OR we accept that vibe-clash mutation runs in a second pass over `out` (we already have all days in scope; we can mutate `day+1` directly inside the loop).

I'll do the in-loop approach — when a clash is detected, mutate `out[dayIdx+1].activities` to mark the offending dinner.

## Files to change

- `supabase/functions/generate-itinerary/ledger-check.ts` — add `isDailyAnchor`, gate repeat filter, mutate next-day on vibe clash.
- `supabase/functions/generate-itinerary/compile-prompt.ts` — extend blocklist to include in-run prior-day dining venues. (Need to read this file to confirm exact insertion point.)
- New test: `supabase/functions/generate-itinerary/ledger-check.test.ts` (extend existing `day-ledger.test.ts` neighbor) covering: daily anchor survives across 6 days, restaurant dedup happens at prompt time, vibe clash mutates next day.

## Verification

After deploy, generate a fresh 6-day Paris Luminary trip and tail `generate-itinerary` logs. Pass criteria:

- `Day Brief: removed 0` for hotel-anchor lines (we'll grep for `Removed "Return to`, `Removed "Travel to.*Hotel`, `Removed "Freshen Up`, `Removed "Check-in at`).
- No `repeat_already_done` for category=transport or accommodation across days 2–6.
- At most one splurge-dinner warning per trip, and the next-day dinner is replaced not just flagged.
- Manual eyeball: every day has its hotel ritual.

If any of those fail, I keep iterating.

## Out of scope

- Re-architecting the ledger to first-class "anchor" type. The exemption pattern is good enough to ship now; full type system can come later.
- Changing the AI prompt to stop proposing duplicate restaurants pre-emptively. The blocklist fix is sufficient and cheaper.
- Fixing the cosmetic "Day 19 vs Day 4" labelling in the UI — that's a different defect; tell me when you want it picked up.

## Memory updates

New memory: `mem://technical/itinerary/daily-anchor-exemption` documenting the rule that daily-ritual activities (hotel returns, freshen-up, check-in/out, in-hotel breakfast) bypass dedup; pattern + categories included.
