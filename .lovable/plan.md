## Problem

Day 3 Health panel flags an "error" for: Villa Medici Gardens (10:05–10:55) overlapping Walk to Hotel Flora (10:45–11:00). The "Walk to Hotel" entry is a transit/transfer card — the kind the timing cascade is designed to butt right up against the previous activity (zero-buffer is fine for transit). The shared `enforceTimingAndBuffers` cascade already has a test that pulls this exact pair forward (`timingCascade.test.ts` L25–33), and the on-load `transit-cascade` effect in `EditorialItinerary` runs it automatically.

So one of two things is happening:
- The cascade ran and pushed the walk to 10:55–11:10, but the data on disk still has the old 10:45 start until the user saves, so any other reader of the trip sees the overlap.
- Or the cascade is gated out (e.g. the walk card is `locked`, or `endTime` is missing) and never actually shifts.

Either way, `analyzeHealth` in `TripHealthPanel` reports the overlap with `severity: 'error'` regardless of category, even though one side is a transit/transfer card — so the Health panel paints a red "conflict" for a situation the system explicitly treats as benign elsewhere.

## Fix (UI/health-classification only)

Make the Health panel treat transit-involved overlaps as the soft, auto-resolved condition the cascade already considers them.

### `src/components/trip/TripHealthPanel.tsx` — `analyzeHealth`

1. Reuse the existing transit-category set (already used in the buffer block):
   ```ts
   const TRANSIT_CATS = ['transit','transportation','transfer','walking','transport','commute','taxi','travel'];
   const isTransitCat = (c?: string) => TRANSIT_CATS.includes((c || '').toLowerCase());
   ```
2. In the overlap loop (L101–114), when `timed[i].end > timed[i+1].start`:
   - Look up the two original activities (`activities[i]`, `activities[i+1]`).
   - If either side is a transit category, OR the title of either matches `/^(walk|transfer|return|drive|taxi|metro|train|bus|tram|ride)\b/i` (catches "Walk to Hotel Flora", "Return to Hotel", "Transfer to Marriott"), downgrade:
     - `severity: 'warning'`
     - message: `Day ${dayNum}: Tight transition — "${A}" (…) runs into "${B}" (…). Auto-resolves on save.`
     - `fixLabel: 'Fix timing'`, `fixAction: 'fix_timing'` (unchanged so the existing one-click button still works).
   - Still `break` to keep one entry per day.
3. Health-score weighting (L302–311) already softens timing issues; no change needed beyond the severity downgrade.

### Index lookup correctness

The existing buffer block at L120–123 reads `activities[i]` / `activities[i+1]` by index, but `timed` is sorted independently from `activities`, so those indices can disagree. Fix the same way for both blocks: tag each `timed` entry with its source activity (push `category` and `title` onto the `timed` object at L91–97) and read from there. This is the minimum change required to make the transit check reliable; without it the buffer/transit detection has been silently misaligned.

### Tests

Add `src/components/trip/__tests__/TripHealthPanel.analyzeHealth.test.ts` with:
- Villa Medici (10:05–10:55, `leisure`) + Walk to Hotel Flora (10:45–11:00, `transfer`) → exactly one issue, `severity === 'warning'`, message contains "Tight transition" and "Auto-resolves".
- Two non-transit overlapping cards → still `severity: 'error'` (regression).
- Walk-titled card with `category: undefined` → still classified as transit by title prefix.

## Out of scope

- No changes to the timing cascade itself; it already does the right thing.
- No backend/data changes; the actual time shift is still owned by the existing on-load cascade and pre-save cascade.
- Not touching the empty-day, budget-balance, or checklist branches of `analyzeHealth`.

## Files touched

- `src/components/trip/TripHealthPanel.tsx`
- `src/components/trip/__tests__/TripHealthPanel.analyzeHealth.test.ts` (new)
