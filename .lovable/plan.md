

## Fix: Update-in-Place Instead of Strip-and-Re-inject

### Problem

Current injection logic (both hotel and the planned flight injection) uses a **strip → rebuild → insert** pattern. This means:
- If the AI already generated an arrival/departure/check-in placeholder card, the injection **deletes it and creates a new one** — losing any AI-enriched data (tips, description, tags)
- If the user sees a placeholder "Arrive in Paris" card from generation, then adds their flight, they get a **duplicate** or a jarring replacement instead of seeing their placeholder seamlessly updated with real details

The user wants: **find the existing placeholder → update it in place with real data (time, location, airline, etc.) → keep its position in the day**.

### Fix

**1. Change `injectHotelActivities.ts` — update-in-place pattern**

Replace `stripExistingHotelActivities` + `insertChronologically` with a `findAndUpdate` approach:

- **Find matcher**: Look for any activity where `category === 'accommodation'` AND title contains "check-in" (or has deterministic hotel ID). Same for check-out.
- **If found**: Merge real hotel data INTO the existing activity (update `title`, `startTime`, `location`, `description`, `photos`) but **preserve** its `id`, position in the array, and any AI-generated fields like `contextualTips`, `tags`, `voyanceInsight`
- **If NOT found**: Only then insert a new activity chronologically (current behavior as fallback)
- **Re-sort only if time changed**: If the updated startTime differs from the original, re-sort the day's activities

**2. Create `src/utils/injectFlightActivities.ts` — same update-in-place pattern**

- **Find matcher for arrival**: Match by `category === 'arrival'` OR (`category === 'transport'` AND title matches "arrive"/"arrival"/"land") OR deterministic ID `flight-arrival-*`
- **Find matcher for departure**: Match by `category === 'departure'` OR (`category === 'transport'` AND title matches "depart"/"departure"/"airport") OR deterministic ID `flight-departure-*`
- **If found**: Update the existing card with real flight data:
  - `title` → "Arrive in {city} — {airline} {flightNumber}" 
  - `startTime` → actual arrival/departure time
  - `location` → airport name + code
  - `description` → gate/terminal info if available
  - `category` → `arrival` or `departure` (upgrade from `transport`)
  - Keep existing `tags`, `contextualTips`, `voyanceInsight`
- **If NOT found**: Insert new card chronologically
- **Day adjustment**: If the flight date maps to a different day than where the placeholder lives, move the activity to the correct day
- **Cascade integration**: After updating the arrival/departure card in-place, still run time-shift logic on surrounding activities (via `shiftDayAfter`/`truncateDayBefore`) to adjust the rest of the day

**3. Update `cascadeTransportToItinerary.ts` — use update-in-place for arrival/departure blocks**

In `shiftDayAfter` (line 153) and `truncateDayBefore` (line 90):
- Before creating a new `transport-arrive-*` or `transport-depart-*` block, **search for existing arrival/departure placeholder**
- If found, update it in place with the correct time and category (`arrival`/`departure`)
- Change the category of created blocks from `'transport'` to `'arrival'`/`'departure'`

**4. Wire flight injection into `TripDetail.tsx` `onBookingAdded`** (line 2311)

After the existing hotel injection block, add:
```
const flightRaw = updatedTrip.flight_selection;
if (flightRaw) {
  injectedDays = injectFlightActivitiesIntoDays(injectedDays, flightRaw);
}
```

**5. Wire flight injection into `EditorialItinerary.tsx`** after cascade (line 2255)

After `setDays(refreshedDays)`, call `injectFlightActivitiesIntoDays` on the refreshed days.

### Key Principle

The matching logic is intentionally broad (title + category + deterministic ID) to catch:
- AI-generated placeholders ("Arrive in Paris", "Airport Transfer")  
- Previously injected cards (deterministic IDs)
- User-edited cards that kept the category

### Files Changed: 4
- `src/utils/injectHotelActivities.ts` — refactor to update-in-place
- **NEW** `src/utils/injectFlightActivities.ts` — flight card injection with update-in-place
- `src/services/cascadeTransportToItinerary.ts` — use `arrival`/`departure` categories, find existing placeholders
- `src/pages/TripDetail.tsx` — wire flight injection in `onBookingAdded`

