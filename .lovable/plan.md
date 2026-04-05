
## Fix Wrong-Day Arrival Banner on Day 3

### What I found
- The wrong banner is coming from `src/components/itinerary/EditorialItinerary.tsx`, not the generation pipeline.
- `ArrivalGamePlan` is currently rendered in 3 cases:
  1. Day 1 normal arrival
  2. Day 2 overnight-flight arrival
  3. Any later `allHotels[idx > 0]` entry whose `checkInDate` matches the selected day
- That 3rd case is the bug. In `src/pages/TripDetail.tsx`, single-city split stays are expanded into `allHotels`, so a same-city hotel change on Day 3 looks like a fresh “arrival” and triggers the full arrival card.

### Plan
1. **Tighten the render condition in `EditorialItinerary.tsx`**
   - Keep the valid arrival cases:
     - Day 1 arrival
     - Day 2 overnight-arrival case
   - Stop treating any later hotel `checkInDate` as an arrival trigger for the banner.

2. **Differentiate real arrival from hotel switch**
   - For split stays in the same city, do not render `ArrivalGamePlan` on the later hotel’s check-in day.
   - Leave the existing hotel event cards alone so Day 3 still shows:
     - `Check out · Four Seasons Ritz`
     - `Check in · Palácio Ludovice`

3. **Add a defensive guard in the arrival UI**
   - Replace the implicit `dayNumber !== 1` fallback title/subtitle behavior with an explicit “actual arrival day” check.
   - This prevents `Arriving in Lisbon — Flight arrival, Day 3` from appearing again if a hotel-switch day ever reaches this component.

### Technical details
- **File to edit:** `src/components/itinerary/EditorialItinerary.tsx`
- **Touchpoints:**
  - the render branch around the Day 1 / overnight Day 2 / later `allHotels.find(...)` logic
  - the `ArrivalGamePlan` header logic that currently switches to `Arriving in ${destination}` for later day numbers
- **No changes to:**
  - generation pipeline
  - hotel switch logic
  - backend/database
  - new files

### Verification
- Generate a 4-day Lisbon trip with a Day 3 hotel switch.
- Confirm:
  - Day 1 shows the arrival banner.
  - Day 3 shows only the checkout/check-in banners.
  - Day 3 does **not** show:
    - `Arriving in Lisbon`
    - `Flight arrival, Day 3`
    - `Add Your Flight`
    - `Getting to Your Hotel`
- Regression check:
  - If the trip has an overnight inbound flight, confirm the arrival card still appears on the true arrival day only.
