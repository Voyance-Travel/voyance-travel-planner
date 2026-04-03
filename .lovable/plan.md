
Fix the hotel-change resolution so the switch happens on the correct day and uses two different hotels.

1. Use the real trip start date for split-stay mapping
- In `supabase/functions/generate-itinerary/action-generate-day.ts`, stop building the hotel day map from the current request’s `date`.
- Anchor the map to the trip’s actual `start_date`, so day 1/day 2/day 3 align correctly with hotel date ranges.
- This addresses the “wrong day” issue.

2. Make the resolved hotel authoritative for that day
- Right now a stale hotel name can survive from earlier context while the address updates to the new hotel.
- Update the resolution so that when the date-aware lookup finds the hotel for the current day, both the hotel name and address are replaced from that result.
- This fixes the “checkout and check-in to the same hotel” symptom.

3. Unify hotel-change detection into one source of truth
- Extend `supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts` and `pipeline/types.ts` to return:
  - `resolvedIsHotelChange`
  - `resolvedPreviousHotelName`
- Build these from the same split-stay timeline used to resolve the daily hotel, with fallback to `trips.hotel_selection` if `trip_cities` is missing/incomplete.
- Then remove the duplicate hotel-change derivation from `action-generate-day.ts`.

4. Feed repair-day the correct outgoing and incoming hotels
- Pass the unified facts into `repairDay` so its hotel-change block gets:
  - previous hotel = Hotel A
  - current hotel = Hotel B
  - only on the actual swap day
- Add a small safety tweak in `supabase/functions/generate-itinerary/pipeline/repair-day.ts` so the hotel-change check-in uses the resolved current hotel override if present.

Expected result
- Only on the real hotel-switch day:
  - breakfast at Hotel A
  - checkout from Hotel A at 11:00
  - travel to Hotel B
  - check-in at Hotel B
- No same-hotel checkout/check-in pair.
- No hotel-switch cards on the wrong day.

Technical details
- Files:
  - `supabase/functions/generate-itinerary/action-generate-day.ts`
  - `supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts`
  - `supabase/functions/generate-itinerary/pipeline/types.ts`
  - `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (small safety update)
- No database changes required.
