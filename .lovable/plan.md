
Fix: Repeated “No travel buffer” warnings in itinerary view

Root cause

The UI currently does two things at once for the same zero-gap problem:

1. `EditorialItinerary.tsx` shows a day-level consolidated banner when a day has 2+ zero-gap transitions.
2. `TransitGapIndicator.tsx` still renders an inline row for every zero-gap transition.

So the “consolidated” warning never actually replaces the noisy per-gap indicators; it just stacks on top of them. That’s why users still see 2–3 repeated warnings on days like Sicily Day 2.

Implementation plan

1. Add a shared zero-buffer visibility rule
- Create a small helper for “should this gap count as a surfaced no-buffer issue?”
- Reuse the same rule for:
  - day-level banner counting
  - inline indicator suppression
- Keep the existing exclusions aligned (`sameLocation`, transit-only rows, preview states).

2. Suppress repeated inline zero-gap indicators when a day already has multiple zero-gap issues
- In `EditorialItinerary.tsx`, compute the number of surfaced zero-gap transitions once per day.
- Pass a prop into `TransitGapIndicator` such as `suppressZeroGapIndicator`.
- When the day has 2+ zero-gap issues, hide the per-gap zero-buffer rows and rely on the single day-level banner instead.
- Keep normal transit rows for non-zero gaps and tight-but-positive gaps.

3. Keep a single inline indicator for isolated cases
- If a day has only 1 zero-gap issue, continue showing the subtle inline indicator so the user still has local context.
- This reduces noise without removing all signal.

4. Make the day-level banner actionable
- Turn the current “Refresh Day” text in the banner into a real button/click target wired to `handleRefreshDay(dayIndex)`.
- That way, when repeated zero-gap issues are consolidated, users still have a direct fix path.

Files to update

- `src/components/itinerary/EditorialItinerary.tsx`
  - centralize day zero-gap counting
  - pass suppression prop to `TransitGapIndicator`
  - make the banner’s Refresh Day CTA actually clickable

- `src/components/itinerary/TransitGapIndicator.tsx`
  - accept the new suppression prop
  - early-return for zero-gap rows when the day-level banner is already handling multiple warnings

Expected result

- Days with 2+ zero-buffer issues show one consolidated banner instead of multiple repeated inline warnings.
- Days with a single zero-buffer issue still show one subtle inline indicator.
- Users keep a clear fix path via a clickable Refresh Day action.
- The warning logic becomes consistent instead of split across two slightly different checks.
