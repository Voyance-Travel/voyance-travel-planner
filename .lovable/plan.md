## Fix Raw Error Codes Showing in Draft Banner

**Problem:** Two integrity-contract codes (`NEIGHBORHOOD_ADDRESS_CONFLICT` and `FINAL_ORPHAN_TRANSIT`) are missing from the `CODE_COPY` dictionary in `src/components/itinerary/IntegrityContractBanner.tsx`. When these codes are returned by the backend, the UI falls back to rendering the raw internal constant name because `{CODE_COPY[c] || c}` has no human-readable mapping.

**Fix:** Add two entries to `CODE_COPY`:
- `NEIGHBORHOOD_ADDRESS_CONFLICT`: `"An activity is scheduled in a neighborhood that doesn't match the day's area."`
- `FINAL_ORPHAN_TRANSIT`: `"A transit connection points to a venue that isn't scheduled that day."`

**File changed:** `src/components/itinerary/IntegrityContractBanner.tsx` (one dictionary addition, two new keys).