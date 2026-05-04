
The Trip Total in the command-center header (`EditorialItinerary.tsx` ~5404) displays a single number that includes activities + transit (the "Day Totals"), plus flights and hotel. Since the day-by-day pills only show activity+transit, the difference (= hotels + flights) is invisible. Users can't reconcile €839/pp × 2 = €1,678 against a €3,713 trip total.

The math is already computed locally: `totalActivityCost`, `flightCost`, `hotelCost` (lines 3354-3375), plus `travelers`. We just don't render them.

## Fix — add a breakdown caption directly under the Trip Total

In the existing meta line at line 5446 (`{days.length} Days · {travelers} Guests · credits`), append a second sub-row that itemises the trip total when any non-day component exists:

```
Days €1,678 · Hotel €1,920 (3 nights) · Flights €115
```

Implementation in `src/components/itinerary/EditorialItinerary.tsx`:

1. Just below the existing meta line (line 5454, before the closing `</div>`), add a new flex row, only rendered when `(hotelCost > 0 || flightCost > 0)`:
   - Compute `daysSubtotal = totalActivityCost * (travelers || 1)` (already the formula on line 3385).
   - Compute `nightsCount`:
     - If `allHotels?.length`: sum `(checkOut - checkIn)` per hotel in days.
     - Else: `hotelSelection?.nights ?? Math.max(1, days.length - 1)`.
   - Render three chips with separators (`·`), wrapping on mobile:
     - `Days {formatCurrency(displayCost(daysSubtotal), tripCurrency)}` — always shown.
     - `Hotel {formatCurrency(displayCost(hotelCost), tripCurrency)} ({nightsCount} {nightsCount===1?'night':'nights'})` — only when `hotelCost > 0`.
     - `Flights {formatCurrency(displayCost(flightCost), tripCurrency)}` — only when `flightCost > 0`.
   - Use the existing `text-xs text-muted-foreground` styling so it sits as a quiet sub-line under the bold total.

2. When the snapshot total drifts from `daysSubtotal + hotelCost + flightCost` (rare reconciliation lag), still show the parts; do not invent a residual.

3. No changes to per-day pills, no changes to the Budget tab — those already show their own breakdown. This is purely about answering "where's the rest?" in the same place the user is looking.

## Files touched

- `src/components/itinerary/EditorialItinerary.tsx` — add ~10 lines around line 5446.

## Out of scope

- Cost engine, FX, snapshot logic.
- Any reordering of the existing rows.

Approve?
