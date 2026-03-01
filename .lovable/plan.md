

# Add Hotel Check-in Activity to Day 1 When Accommodation is Set

## What Happens Today
When a user sets their hotel/accommodation (either via "Find My Hotels" DNA matching or manual entry), it saves the hotel data to the database and refreshes the trip state. However, Day 1 of the itinerary is never updated to include a check-in activity for the new accommodation. The user sees hotel details in the sidebar/header but no corresponding "Check-in at [Hotel Name]" entry in their day-by-day plan.

## What Should Happen
When a hotel is saved, Day 1 (or the day matching the check-in date) should automatically get a "Check-in" activity injected into its timeline with:
- Hotel name and address from the saved data
- Google Places photo if available
- Check-in time (default 15:00 if not specified)
- Proper categorization as a structural/accommodation activity

Similarly, the last day should get a "Check-out" activity if applicable.

## Implementation

### 1. Create a utility function to build hotel check-in/check-out activities
**New file:** `src/utils/injectHotelActivities.ts`

- `buildCheckInActivity(hotel, dayNumber, date)` -- creates a check-in activity object with:
  - Title: "Check-in at [Hotel Name]"
  - Time: hotel's checkInTime or "15:00"
  - Duration: "30 min"
  - Category: "accommodation" / type: "check-in"
  - Location with hotel name, address, coordinates
  - Image from hotel data
  - Structural flag (not counted toward activity caps)

- `buildCheckOutActivity(hotel, dayNumber, date)` -- similar but for departure day

- `injectHotelActivitiesIntoDays(days, hotel)` -- finds the correct day by date match (or Day 1 fallback), removes any existing check-in/check-out activities for previously saved hotels, and inserts the new ones in the correct time-ordered position

### 2. Call the injection after hotel save in `AddBookingInline.tsx`
**File:** `src/components/itinerary/AddBookingInline.tsx`

After the hotel is saved to the database (line ~876), call the injection utility to update the itinerary days. Pass the result through a new callback prop `onItineraryUpdate` or use the existing `onHotelAdded` callback to trigger the parent to inject and save.

### 3. Call the injection after hotel save in `FindMyHotelsDrawer.tsx`
**File:** `src/components/itinerary/FindMyHotelsDrawer.tsx`

Same pattern -- after `saveHotelSelection` or city update succeeds (line ~172), trigger the itinerary update.

### 4. Wire up in `EditorialItinerary.tsx`
**File:** `src/components/itinerary/EditorialItinerary.tsx`

Enhance the `onBookingAdded` flow so that when a hotel is saved, the component:
1. Reads the updated hotel data from the refreshed trip
2. Calls `injectHotelActivitiesIntoDays()` on the current `days` state
3. Updates the days state and auto-saves

This is the cleanest approach since `EditorialItinerary` already manages the `days` array and has save capabilities.

### 5. Update `onBookingAdded` in `TripDetail.tsx`
**File:** `src/pages/TripDetail.tsx`

After refetching the trip data (line ~1622), check if the hotel selection changed, and if so, inject check-in/check-out activities into `editorDays` and save the updated itinerary.

## Technical Details

- The check-in activity ID format: `hotel-checkin-{hotelId}` (deterministic so re-saves replace rather than duplicate)
- Check-out activity ID format: `hotel-checkout-{hotelId}`
- Day matching: compare hotel `checkInDate` against each day's `date` field; fall back to Day 1 if no date match
- Time ordering: insert check-in after arrival/transit activities but before evening activities; insert check-out before departure activities
- Existing check-in activities from AI generation should be replaced (matched by category "accommodation" + title containing "check-in")
- The injection is idempotent -- running it multiple times with the same hotel produces the same result

## Files Modified
- `src/utils/injectHotelActivities.ts` (NEW) -- utility to build and inject hotel activities
- `src/pages/TripDetail.tsx` -- trigger injection in `onBookingAdded` callback
- `src/components/itinerary/EditorialItinerary.tsx` -- optionally handle injection closer to the save point

## Files NOT Modified
- `AddBookingInline.tsx` and `FindMyHotelsDrawer.tsx` -- these just save hotel data and call `onHotelAdded`/`onHotelSelected` which already triggers `onBookingAdded` in the parent. The injection happens in the parent where the itinerary state lives.
