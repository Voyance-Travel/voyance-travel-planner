

## ✅ Completed: Strip Internal System Language from Meal-Guard Tips

Fixed in `day-validation.ts` — replaced "Recommended by our venue database" with user-friendly tips.

## ✅ Completed: Reject Mainland Venues for Water-Bound / Car-Free Destinations

Added hotel-proximity guard to venue enrichment pipeline. Water-bound destinations (Venice, Santorini, Capri, etc.) use a tight 5km radius; normal cities use 15km.

### Files Changed
- `venue-enrichment.ts` — Added `TIGHT_RADIUS_DESTINATIONS` map, hotel proximity check in `verifyVenueWithGooglePlaces`, threaded `hotelCoordinates` through all enrichment functions
- `pipeline/enrich-day.ts` — Added `hotelCoordinates` to `EnrichDayInput` and threaded through pipeline
- `action-generate-day.ts` — Geocodes hotel address to coordinates before enrichment call
