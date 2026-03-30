

## ✅ Completed: Strip Internal System Language from Meal-Guard Tips

Fixed in `day-validation.ts` — replaced "Recommended by our venue database" with user-friendly tips.

## ✅ Completed: Reject Mainland Venues for Water-Bound / Car-Free Destinations

Added hotel-proximity guard to venue enrichment pipeline. Water-bound destinations (Venice, Santorini, Capri, etc.) use a tight 5km radius; normal cities use 15km.

### Files Changed
- `venue-enrichment.ts` — Added `TIGHT_RADIUS_DESTINATIONS` map, hotel proximity check in `verifyVenueWithGooglePlaces`, threaded `hotelCoordinates` through all enrichment functions
- `pipeline/enrich-day.ts` — Added `hotelCoordinates` to `EnrichDayInput` and threaded through pipeline
- `action-generate-day.ts` — Geocodes hotel address to coordinates before enrichment call

## ✅ Completed: TIME_OVERLAP Cascade Repair

Added step 13 to `repair-day.ts` — a final-pass overlap resolver that truncates activities before structural items (checkout, departure) and shifts non-structural activities forward. Drops anything pushed past 23:30.

### Files Changed
- `pipeline/repair-day.ts` — Added TIME_OVERLAP cascade repair as step 13 after all prior injections
