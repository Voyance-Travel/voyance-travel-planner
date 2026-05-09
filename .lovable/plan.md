## M5 — Multi-hotel date boundary (same-day handover)

**File:** `src/services/hotelItineraryPatch.ts`

### Problem

`isDayInRange` uses an exclusive upper bound (`d < checkOutDate`). On a same-day handover (Hotel A checkout = Hotel B check-in on the same calendar day), the day belongs unambiguously to Hotel B for non-checkout activities, but the existing logic does not signal this explicitly. Today it works only because `Array.prototype.find` happens to skip Hotel A (its `isDayInRange` returns `false` since `d === checkOutDate`) and lands on Hotel B. That's fragile and breaks if hotel order, normalization, or any caller relies on `isDayInRange` to resolve a hotel claim on a boundary day.

The user's spec asks for an explicit `isInclusive` opt-in so the destination (arriving) hotel can claim its check-in day even when another hotel's exclusive range would also be evaluated.

### Plan

1. **Extend `isDayInRange` signature** (line 46–50) with an `isInclusive` flag, defaulting to `false` to preserve the current generation-pipeline convention documented at the top of the file:

   ```ts
   function isDayInRange(
     dayDate: string | undefined,
     checkInDate?: string,
     checkOutDate?: string,
     isInclusive = false,
   ): boolean {
     if (!checkInDate || !checkOutDate || !dayDate) return true;
     const d = dayDate.slice(0, 10);
     const ci = checkInDate.slice(0, 10);
     const co = checkOutDate.slice(0, 10);
     return isInclusive ? (d >= ci && d <= co) : (d >= ci && d < co);
   }
   ```

2. **Update the multi-hotel loop** (`patchItineraryWithMultipleHotels`, around line 200–207) so the arriving hotel wins on same-day handover. Resolve `matchingHotel` in two passes:

   ```ts
   // Pass 1: prefer the hotel whose check-in is exactly this day (arrival wins on handover)
   const arrivingHotel = hotels.find(
     h => h.checkInDate && dayDate && h.checkInDate.slice(0, 10) === dayDate.slice(0, 10),
   );
   // Pass 2: otherwise, the hotel whose exclusive range covers this day
   const stayingHotel = hotels.find(h => isDayInRange(dayDate, h.checkInDate, h.checkOutDate));
   const matchingHotel = arrivingHotel ?? stayingHotel;

   const departingHotel = hotels.find(h => isCheckoutDay(dayDate, h.checkOutDate));
   ```

   Behavior on a same-day A→B handover:
   - `departingHotel = A` → checkout activity gets "Checkout from Hotel A" ✓
   - `matchingHotel = B` (via `arrivingHotel`) → "Check-in at Hotel B" / settle-in / freshen-up / return cards get Hotel B ✓

3. **Single-hotel function (`patchItineraryWithHotel`) is unchanged** — it scopes to one hotel only, no handover possible. Comment at the top of the file already documents the exclusive convention; keep that verbatim.

4. **No migration, no schema change, no UI change.** Pure logic fix in this one file.

### Verification

- Trip with Hotel A (checkIn D1, checkOut D3) and Hotel B (checkIn D3, checkOut D5):
  - D1, D2 → Hotel A (all accom cards)
  - D3 → "Checkout from Hotel A" + "Check-in at Hotel B" / freshen-up Hotel B
  - D4 → Hotel B
- Trip with single hotel: identical output to today.
- `grep -n "isInclusive\|arrivingHotel"` → 3+ hits.

### Out of scope

- The mem rule "Hotel Date Boundary Policy — inclusive-exclusive boundaries" stays intact; this only adds an opt-in inclusive overload for the arriving-hotel resolver.
- No changes to generation pipeline or `isCheckoutDay`.
