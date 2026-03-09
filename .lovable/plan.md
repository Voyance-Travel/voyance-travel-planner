

## Add Trip Status Toggle (Draft / Confirmed)

The `TripConfirmationBanner` component exists but was never wired into the UI. Rather than re-integrating that complex component (which has hotel/flight logistics dialogs, swap suggestions, etc.), a simpler approach is better: add a clickable status badge directly in the trip header that toggles between "draft" and "booked" (confirmed).

### Changes

**File: `src/pages/TripDetail.tsx`**

Replace the read-only `Badge` in the trip header (lines 1581-1596) with an interactive dropdown or toggle button:

- When status is `draft`: show a badge/button labeled "Draft" with a subtle prompt — clicking it sets status to `booked` (confirmed)
- When status is `booked`: show "Confirmed" badge — clicking it sets back to `draft`
- Past trips and active trips: keep the badge read-only (no toggle)

Implementation:
1. Add a `handleStatusToggle` function that calls `supabase.from('trips').update({ status: newStatus }).eq('id', tripId)` and updates local `trip` state
2. Replace the static Badge with a clickable button-styled badge that shows a dropdown with "Draft" and "Confirmed" options, or simply toggles on click
3. Use existing icons: `PenLine` for draft, `CheckCircle` for confirmed
4. Keep it minimal — just a small clickable badge, no modal or dialog

The toggle will only appear for future trips that aren't currently active. Past trips and live trips keep their read-only badges.

