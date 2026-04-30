
# Fix the trip display + generation defects

You flagged three real issues on the long trip:

1. **Confusing credit copy** — the panel said "0 more credits needed" while also saying "this action costs 10."
2. **Trip total quietly drifted upward** — the price changed without telling you.
3. **Days 24 and 25 ended up unplanned** — the original generation stopped early and the self-heal never recovered them.

Here's how I'll fix each, grounded in the code I just read.

---

## 1. Kill the "0 more credits needed" message

`src/components/itinerary/CreditNudge.tsx` always renders, even when `deficit = cost - currentBalance ≤ 0` (you already have enough). The line `{formatCredits(deficit)} more credits needed to {actionLabel}` then shows "0 more credits needed" while the next line says the action still costs 10. That's the contradiction you saw.

**Fix:**
- If `deficit ≤ 0`, render a simple "You're covered" state instead: "This action costs 10 credits. You have 47. Continue." (no upsell buttons).
- Move the price-vs-balance copy out of `CreditNudge` for the affordable case so it stops appearing as a dead-end nudge.
- Audit each call site (`EditorialItinerary.tsx` lines 3486, 4553, 4578, 4814, 6378, 6440) so the nudge is only mounted when the user actually can't afford the action — affordable actions should go straight to confirm.
- Tighten the "Build your new days?" dialog in `TripDetail.tsx` (line 3346) so it shows three lines, not two: cost, current balance, balance after — same shape everywhere.

## 2. Stop the trip total from drifting silently

`useTripFinancialSnapshot` re-sums every row in `activity_costs` whenever it refetches. When AI repair, day regenerations, or hotel sync write new rows, the total visibly creeps up with no explanation. Cause-of-change is invisible.

**Fix:**
- Add a small "What changed" indicator next to the total: when `tripTotalCents` increases between fetches, show a one-line, dismissable note ("Total updated: +$84 — added Day 12 dinner, hotel sync"). Source the delta from a new `trip_cost_changes` view that diffs the latest writes to `activity_costs` (rows added/updated since the previous snapshot timestamp the client cached).
- Show a "Last updated 2 min ago — view changes" link that opens a drawer listing the most recent `activity_costs` writes (day, category, amount, source: ai/user/repair).
- Keep the math the same — the goal is transparency, not to change cost numbers.
- Add a defensive guard: if a single refresh introduces a >25% jump, flag it as a toast warning and log to `audit_logs`. This catches future regressions where a repair pipeline mass-rewrites costs.

## 3. Recover days when generation ends early

The self-heal at `TripDetail.tsx:1207` only fires when `actualDays >= expectedTotal`. If generation stalls at, say, day 23 of 25, `actualDays < expectedTotal`, the heal never runs, and days 24/25 stay empty placeholders forever. The "stalled generation" path also doesn't trigger LockedDayCard recovery if those days don't exist in `itinerary_data.days` at all.

**Fix:**
- Change the self-heal condition: trigger whenever `itinerary_status` is no longer `'generating'`/`'queued'` and `(missing days OR empty days)` exist. Don't gate on `actualDays >= expectedTotal`.
- For each day in the trip's date range that has no entry in `days[]`, materialize an empty placeholder day (`dayNumber`, `date`, `theme: ''`, `activities: []`) so the UI can show LockedDayCard + the "Generate this day" CTA you already have.
- If version history exists for that day, restore it (already supported). Otherwise prompt the user with the existing AlertDialog ("Build your new days?") instead of silently regenerating, so they're never charged without seeing it.
- Mark days created this way with `metadata.heal_origin = 'incomplete_generation'` so the credit prompt copy can read: "Day 24 didn't finish during generation — build it now? Costs 10 credits."
- Add a banner on TripDetail when any day is in this state: "Generation ended early on Day 23. 2 days are unplanned." with a single CTA to build them all (showing the total credit cost up front, e.g. 20 credits).

## 4. Preventive guardrails

- Add a Vitest test that boots the financial snapshot, writes new `activity_costs` rows, and asserts the change indicator surfaces.
- Add a test for `CreditNudge` that fails if it renders with `deficit ≤ 0`.
- Add a generation-completion test: simulate `itinerary_status='complete'` with missing days and assert the heal/banner triggers.

---

## Technical references (for me, not you)

- `src/components/itinerary/CreditNudge.tsx:84,91` — confusing copy site.
- `src/hooks/useTripFinancialSnapshot.ts:46-90` — total recompute, no delta surfacing.
- `src/pages/TripDetail.tsx:1205-1334` — self-heal gate (`actualDays >= expectedTotal`) — the bug.
- `src/pages/TripDetail.tsx:3320-3420` — extend-days dialog (will reuse for incomplete-day prompt).
- `src/components/itinerary/LockedDayCard.tsx` — already handles the empty-day CTA we'll point at.

## What I won't do

- Won't change cost arithmetic (`trip-pricing.ts`) — the numbers are correct, only the surfacing is bad.
- Won't auto-charge for healed days. Every credit spend stays explicit.
- Won't touch the Google API tracking work from earlier turns.

Approve and I'll implement all four sections in one pass.
