## Problem

On Day 1 the itinerary surfaces "1 activity has no travel buffer. **Refresh Day** to fix timing." The user has to:

1. Notice the small gray banner above the day's activities.
2. Click *Refresh Day* (an edge-function call).
3. Read the diff panel.
4. Accept the proposed time-shift changes.

For an arrival day on a first-time user, that's three friction points before the itinerary is usable. Worse — refresh isn't even guaranteed: it's a soft suggestion the user can miss.

## Fix — silent Day 1 auto-buffer

Add a one-shot effect in `EditorialItinerary.tsx` that runs whenever the Day 1 activity list changes. If it detects a zero/negative gap between two non-transport, non-same-venue, non-locked activities, it cascades a 15-minute breathing buffer forward without an edge call, without a toast, and without disturbing the user.

### Algorithm
1. Build a fingerprint of Day 1 activities (`id@startTime` joined). Skip if already processed.
2. Walk consecutive pairs `(a, b)`:
   - Skip if either side is `category === 'transport'` (transport entries *are* the buffer).
   - Skip if both share the same `location.name` (legit back-to-back at one venue).
   - Skip if `b.locked || b.isLocked` (Universal Locking — never move user/manual/extracted).
   - Skip if `a.endTime` or `b.startTime` aren't simple `HH:MM` (don't risk parsing AM/PM here).
   - If `b.startTime < a.endTime + 15`, shift `b.startTime` (and `b.endTime` by the same delta) forward.
3. Cascade: each shifted activity becomes the new anchor for the next pair, so a single early collision propagates cleanly through the morning.
4. Bail out of any shift that would push past 23:30 (don't push activities into the night).
5. Mark `setHasChanges(true)` so autosave persists the corrected schedule; the existing buffer-warning banner reads from the same `days` state and disappears on the next render.

### Why this is safe
- **Locked items anchor** — manual / extracted / pinned activities (Universal Locking memory) are never moved. The cascade simply skips them.
- **Transport rows are preserved** — they already represent travel time, so we don't double-buffer.
- **Same-venue pairs** (e.g. drinks → dinner at the same hotel bar) don't get artificial gaps.
- **Idempotent** — the fingerprint guard prevents loops, and once the gaps are ≥15 min nothing mutates.
- **Day 1 only** — other days continue to surface the explicit *Refresh Day* affordance, which is the right UX when the user is mid-trip planning. Arrival day is uniquely sensitive because nothing else has been edited yet.

## File touched

- `src/components/itinerary/EditorialItinerary.tsx` — add a `useEffect` (~70 lines) right next to the existing refresh-day state at line 2171. No prop changes, no edge function changes.

## Verification

- Open the affected trip → Day 1 reflows automatically; the "no travel buffer" banner disappears within a render cycle.
- Lock an activity, then drag a sibling to overlap it → the locked one stays put, the unlocked one is auto-shifted.
- Days 2+ still show the *Refresh Day* affordance unchanged.

Approve to ship.