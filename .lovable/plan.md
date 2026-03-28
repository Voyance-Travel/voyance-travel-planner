

## Fix: Hotel Cards & Flights Tab Polish

This is a multi-part fix touching flight cards, hotel cards, the Arrival Game Plan, and in-itinerary accommodation cards.

---

### Part 1: Flight Cards — Show Complete Information

**File:** `src/components/itinerary/SortableFlightLegCards.tsx`

**Current state:** Cards show times and cabin class but lack origin airport name, airline, duration, stops, price, and use raw ISO dates.

**Changes:**

1. **Format dates** — Replace raw `2026-04-15` with `Wed, Apr 15` using `format(parseISO(date), 'EEE, MMM d')` from date-fns. Apply to the date display at line 149.

2. **Show origin airport** — The `getAirportDisplay()` function already exists but only displays when there's a code. At lines 166-167, the departure side shows `leg.departure?.time` and `getAirportDisplay(leg.departure?.airport)`. If airport is empty, show nothing — no change needed there, but the parent component (EditorialItinerary) needs to ensure it passes airport codes from flightSelection. Verify `getAirportDisplay` handles missing codes gracefully.

3. **Add price display** — After the route visualization (line 189), add a price row:
   ```
   {leg.price && (
     <div className="text-right mt-2">
       <span className="text-lg font-semibold">${leg.price.toLocaleString()}</span>
       <span className="text-xs text-muted-foreground">/person</span>
     </div>
   )}
   ```

4. **Show stops** — In the route visualization center (line 174-179), replace the plain plane icon with stops info when available. Could derive from layover data or add a `stops` field to `FlightLegDisplay`.

5. **Hide mark buttons for single-leg trips and non-editors** — Line 228: the condition `totalLegs > 1` already hides for single-leg. Add `&& isEditable` to also hide from viewers:
   ```typescript
   {totalLegs > 1 && isEditable && (
   ```

---

### Part 2: Hotel Card — Dates and Cost Breakdown

**File:** `src/components/itinerary/EditorialItinerary.tsx` (~lines 6807-6860)

**Current state:** Shows check-in/out times and $/night but not stay dates or total cost.

**Changes:**

1. **Add stay dates** — After check-in/out pills (line 6822), add:
   ```
   {startDate && endDate && (
     <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 text-sm">
       <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
       <span className="font-medium">{format(parseISO(startDate), 'MMM d')} – {format(parseISO(endDate), 'MMM d')}</span>
     </div>
   )}
   ```

2. **Add total cost** — After the $/night pill:
   ```
   {hotelSelection.pricePerNight && totalDays > 0 && (
     <div className="text-sm text-muted-foreground">
       ${hotelSelection.pricePerNight}/night × {Math.max(1, totalDays - 1)} nights = <strong>${hotelSelection.pricePerNight * Math.max(1, totalDays - 1)}</strong>
     </div>
   )}
   ```

3. **Show room type** — If `hotelSelection.roomType` exists, display it as a badge.

4. **Website domain** — Line 6855: Change `'Website'` to show the domain:
   ```typescript
   {hotelSelection.website
     ? new URL(hotelSelection.website).hostname.replace('www.', '')
     : 'Maps'}
   ```

---

### Part 3: Arrival Game Plan Fixes

**File:** `src/components/itinerary/EditorialItinerary.tsx` (~lines 8738-8750, 8822-8840)

1. **Fix "Arrive at airport" label** — Line 8745: Change from `"Arrive at airport by {recommendedArrival}"` to `"Leave for the airport by {recommendedArrival}"` since this refers to the origin departure, not the destination arrival.

2. **Check-in time consistency** — Line 8837-8838: The check-in time currently reads from `effectiveHotelSelection?.checkInTime || effectiveHotelSelection?.checkIn`. Ensure it falls back to `'3:00 PM'` (the standard) and label it clearly:
   ```
   Check-in from {checkInTime} (early luggage storage usually available)
   ```

3. **Fix postLanding contradiction** — The `getPostLandingAdvice()` at line 8655 says "Store luggage, explore immediately" for early arrivals, but the itinerary starts with hotel check-in. Change early arrival advice to:
   ```
   action: 'Head to hotel, drop bags & start exploring'
   ```

---

### Part 4: In-Itinerary Hotel Card Consistency

**File:** `src/components/itinerary/EditorialItinerary.tsx`

1. **"Included in your stay" badge** — In the activity card renderer, when `isAccommodation` is true (already detected by the pricing fix), add a small badge:
   ```
   <Badge variant="secondary" className="text-[10px]">Included in your stay</Badge>
   ```
   This goes in the cost display area of accommodation cards, replacing the "$0" or "Free" text with a more meaningful indicator.

2. **Fix return-to-hotel duration** — The duration bug (8h for 10:25 PM → 11:59 PM) likely comes from the AI generating end_time as next-day or the duration calculation treating overnight as same-day. In the duration display logic, cap accommodation card durations: if category is accommodation and calculated duration > 3 hours, either hide the duration or show "Overnight" instead.

3. **Mark buttons already hidden for single-leg** — Covered in Part 1.

---

### Files Changed

| File | Changes |
|------|---------|
| `src/components/itinerary/SortableFlightLegCards.tsx` | Format dates, add price, hide mark buttons for non-editors |
| `src/components/itinerary/EditorialItinerary.tsx` | Hotel card dates/total, Arrival Game Plan labels, accommodation badge, duration cap |

### Not in Scope (Separate Tickets)
- Hotel photo fetching (requires Places API integration — tracked separately)
- Transport cost API accuracy (the static fallbacks for Tokyo are already correct; API response issues are backend)
- Activity card pricing ($836/$850) — already fixed in the pricing consistency ticket

