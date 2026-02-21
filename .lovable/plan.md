

# Smart Trip Status Banner

## Summary
Replace the large "Is this trip happening?" banner with smart, date-aware logic and a compact inline UI. Past trips auto-resolve (no banner), confirmed trips stay dismissed, and future draft trips within 14 days get a small inline prompt instead of a full-width card.

## What Changes for Users

**Past trips** (end date already passed): No banner. Badge shows "Past" instead of "Draft".

**Confirmed trips** (user already clicked "It's Happening!"): No banner. Badge shows "Booked" (already works).

**Future draft trips within 14 days of departure**: Small inline confirm/dismiss buttons next to the status badge -- no full-width card.

**Future draft trips more than 14 days out**: No banner shown at all (too early to nag).

## Technical Changes

### 1. TripConfirmationBanner.tsx -- Replace full-width card with inline element

- Add date-awareness: accept `startDate` and `endDate` (already passed), check if trip is past (`endDate < today`) -- if so, return `null`
- Add 14-day proximity check: only render if departure is within 14 days
- Replace the large `rounded-xl border` card with a compact inline `flex items-center gap-2` row containing:
  - A small "Confirm" button (checkmark icon + text)
  - A small "Dismiss" button (X icon)
- Keep the logistics dialog and swap review dialog untouched -- they still open when user clicks confirm
- Persist dismissal in `localStorage` keyed by trip ID so it survives page refreshes within the session

### 2. TripDetail.tsx -- Smart badge and conditional rendering

- Update the status badge section (lines 870-888):
  - If `endDate < today` AND status is "draft": show badge as "Past" with `secondary` variant
  - If status is "booked": show "Confirmed" (or keep "booked")
  - If status is "draft" AND future: show "Draft" as-is
- Move the `TripConfirmationBanner` rendering from below the badge section to **inline within** the badge row, so the confirm/dismiss buttons appear next to the badge and date, not as a separate block
- Add the date check guard: only render banner component if trip end date is in the future

### 3. Profile.tsx -- Already handles past trip classification

The `transformTrip` function (line 145-153) already classifies trips with `endDate < now` as "completed" and filters them into the completed section. The Upcoming count already excludes them. No changes needed here -- the existing logic is correct.

### 4. No database changes needed

- The `status` field on trips already supports 'draft', 'booked', 'completed'
- Dismissal state is session-local (localStorage) -- no need to persist to DB
- The banner component already checks `currentStatus !== 'draft'` to hide itself

## Detailed File Changes

### `src/components/trip/TripConfirmationBanner.tsx`

**Smart visibility logic** (replacing line 86):
```typescript
// Auto-hide for past trips
const today = new Date();
const tripEnd = parseLocalDate(endDate);
const tripStart = parseLocalDate(startDate);
const isPastTrip = tripEnd < today;
const daysUntilDeparture = differenceInDays(tripStart, today);
const isWithin14Days = daysUntilDeparture <= 14 && daysUntilDeparture >= 0;

// Check localStorage for persistent dismissal
const dismissKey = `trip-confirm-dismissed-${tripId}`;
const [dismissed, setDismissed] = useState(() => {
  return localStorage.getItem(dismissKey) === 'true';
});

// Don't show for non-draft, past trips, dismissed, or too far out
if (currentStatus !== 'draft' || dismissed || isPastTrip || !isWithin14Days) return null;
```

**Compact inline UI** (replacing the full-width card):
```tsx
<div className={cn("flex items-center gap-2", className)}>
  <Button variant="ghost" size="sm" onClick={handleDrafting} className="gap-1 h-7 text-xs px-2">
    <PenLine className="h-3 w-3" />
    Just Drafting
  </Button>
  <Button size="sm" onClick={handleUpcoming} className="gap-1 h-7 text-xs px-2">
    <CheckCircle2 className="h-3 w-3" />
    {hasFlightSelection && hasHotelSelection ? 'Confirm' : "It's Happening!"}
  </Button>
</div>
```

**Persist dismissal** in handleDrafting:
```typescript
const handleDrafting = () => {
  localStorage.setItem(dismissKey, 'true');
  setDismissed(true);
};
```

### `src/pages/TripDetail.tsx`

**Smart badge** (lines 870-888):
```tsx
{!isLiveTrip && (
  <div className="flex flex-wrap items-center gap-3 mb-8">
    <Badge variant={
      trip.status === 'completed' ? 'secondary' :
      trip.status === 'booked' ? 'default' :
      isPastTrip ? 'secondary' : 'outline'
    } className="capitalize">
      {isPastTrip && trip.status === 'draft' ? 'Past' : trip.status}
    </Badge>

    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Calendar className="w-4 h-4" />
      {format(parseLocalDate(trip.start_date), 'MMM d')} - {format(parseLocalDate(effectiveEndDate), 'MMM d, yyyy')}
    </div>

    {/* Inline confirmation buttons (only shows for draft trips within 14 days) */}
    {hasItinerary && (
      <TripConfirmationBanner
        tripId={trip.id}
        destination={trip.destination}
        startDate={trip.start_date}
        endDate={effectiveEndDate}
        currentStatus={trip.status}
        hasFlightSelection={!!trip.flight_selection}
        hasHotelSelection={!!trip.hotel_selection}
        itineraryDays={itineraryDays}
        onStatusUpdate={(status) => setTrip(prev => prev ? { ...prev, status } : null)}
        onTripDataUpdate={(data) => setTrip(prev => prev ? { ...prev, ...data } : null)}
        onApplySwaps={handleApplySwaps}
        onRegenerateTrip={handleRegenerateTrip}
      />
    )}
  </div>
)}
```

The standalone `TripConfirmationBanner` block below (lines 891-908) gets removed since it's now inline in the badge row.

**Add `isPastTrip` computation** near the existing date logic:
```typescript
const isPastTrip = isAfter(new Date(), parseLocalDate(effectiveEndDate));
```

### Files Modified

| File | Change |
|------|--------|
| `src/components/trip/TripConfirmationBanner.tsx` | Add date-awareness, 14-day check, localStorage dismiss, compact inline UI |
| `src/pages/TripDetail.tsx` | Smart badge text ("Past" for expired drafts), move banner inline, remove standalone block |

### No changes needed

| File | Reason |
|------|--------|
| `src/pages/Profile.tsx` | Already classifies past trips as "completed" in `transformTrip` |
| Database schema | Existing `status` field is sufficient; dismissal is client-side |
| Edge functions | No backend logic changes needed |

