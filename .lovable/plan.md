# Allow "Booked elsewhere" for Flights checklist item

## Problem
The Trip Completion checklist marks **Flights booked** as incomplete whenever `trip.flight_selection` is empty. Many users book flights outside the app and have no way to acknowledge that without entering full flight details, leaving the score stuck (e.g. 67%) and the item visibly red.

## Fix
Give users a one-click way to mark Flights — and for symmetry, Hotels — as "booked elsewhere", persisted on the trip so the checklist treats them as done.

### UX
On any unchecked checklist row that supports it (`flights`, `hotel`), show a small secondary action next to the existing primary "Add flights" / "Add hotel" button:

```
○  ✈  Flights booked          [Add flights →]  [Already booked]
```

Clicking **Already booked**:
- Marks the item as done immediately (optimistic).
- Persists `metadata.flightsBookedElsewhere = true` (or `hotelBookedElsewhere`) on the trip via the existing trip update path.
- Toast: "Marked flights as booked elsewhere".

When the flag is set, the checklist row renders as done and shows a tiny "Booked elsewhere · Undo" affordance instead of the fix buttons. Clicking Undo clears the flag.

If the user later adds real flight/hotel data, the real data wins and we silently clear the flag.

### Technical details
- **Persistence**: `trip.metadata.flightsBookedElsewhere: boolean` and `trip.metadata.hotelBookedElsewhere: boolean`. No schema change — `metadata` is already a JSON column we mutate.
- **TripHealthPanel** (`src/components/trip/TripHealthPanel.tsx`):
  - Accept new props `flightsBookedElsewhere?: boolean`, `hotelBookedElsewhere?: boolean`.
  - In the checklist build, treat `done = hasFlights || flightsBookedElsewhere` (same for hotel). Skip `fixLabel`/`fixAction` when "elsewhere" is the reason it's done; instead expose a new `secondaryAction: 'mark_booked_elsewhere' | 'unmark_booked_elsewhere'` for those two rows.
  - Render the secondary button in the existing checklist row JSX (around L406–L416) — small ghost button "Already booked" when not done, and a subtle "Booked elsewhere · Undo" when done-by-flag.
  - Include the two flags in the `useMemo` deps and in the `completionFactors` calculation so the % updates.
- **TripDetail.tsx** (`src/pages/TripDetail.tsx`, both `TripHealthPanel` instances ~L2794 and ~L3045):
  - Read `flightsBookedElsewhere` / `hotelBookedElsewhere` from `trip.metadata` and pass as props.
  - Extend the `onAction` handler to handle `mark_booked_elsewhere` / `unmark_booked_elsewhere` with a `field: 'flights' | 'hotel'` arg. Update via the existing trip-metadata update helper used elsewhere on this page (find the closest existing `updateTrip` / supabase update for `metadata`).
  - Auto-clear the flag when real data appears: if `trip.flight_selection` becomes truthy and `flightsBookedElsewhere` is true, fire-and-forget a metadata update to set it false (one-time effect guarded by a ref).

### Out of scope
- Adding a real flight-entry shortcut.
- Changing health-score weights.
- Multi-city per-leg "booked elsewhere" toggles (single trip-level flag only).

## Files touched
- `src/components/trip/TripHealthPanel.tsx`
- `src/pages/TripDetail.tsx`
