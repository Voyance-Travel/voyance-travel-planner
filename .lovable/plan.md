# Fix: Spending Money reserve inflates trip total on empty itinerary

## Problem

`useTripFinancialSnapshot` adds the unspent misc-reserve into `tripTotalCents` (lines 234–250) so the headline budget never shows phantom headroom equal to the slider. This is correct on a normal trip, but on an **empty itinerary** (hotel-only, no meaningful activities) the result is a Trip Expenses number that exceeds what the itinerary actually contains:

- Itinerary: hotel $2,400
- Misc reserve: $270 (slider %)
- Snapshot reports: **$2,670** ← off by the reserve, inexplicable to the user

There is no real spending to back the $270 — the reserve is a planning placeholder, and BudgetTab already shows the empty-state breakdown for the same scenario. The total card is the only place still inflating the number.

## Goal

Trip Expenses must equal what's actually in the itinerary (committed/logged costs) when the itinerary has no meaningful activities. The misc reserve only contributes once the trip has real content.

## Changes

### `src/hooks/useTripFinancialSnapshot.ts`
- Reuse the existing `liveActivityIds` walk (lines 96–103). Track `meaningfulActivityCount` while iterating `days[].activities[]`, applying the same exclusions used by `classifyItineraryCompleteness`:
  - skip categories: `hotel`, `flight`, `accommodation`, `lodging`, `stay`, `check-in`, `check-out`, `bag-drop`, `departure`, `arrival`
  - skip titles matching `/check\s*-?\s*in|check\s*-?\s*out|bag\s*-?\s*drop|return\s+to\s+(?:your\s+)?hotel|hotel\s+check(?:in|out)|airport\s+transfer|departure/i`
- Gate the reserve contribution: only add `reserve.contributionToTotalCents` when `meaningfulActivityCount >= 1`. Otherwise add 0.
- Comment the gate so future readers understand the rationale (mirrors the BudgetTab empty-state treatment).

### Why not import `classifyItineraryCompleteness` directly?
The snapshot already walks `days[].activities[]` once for `liveActivityIds`. Folding the meaningful-count check into the same loop avoids a second pass and keeps the dependency surface unchanged. We mirror the same exclusion set inline (small and stable).

## Out of scope
- No changes to `computeMiscReserve` (its return is still correct; we just don't always add it).
- No changes to BudgetTab — it already shows the empty-state breakdown.
- No changes to `paidTotal`, fixed costs, or manual-payment handling.
