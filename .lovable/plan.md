

## Fix: City Badge Shows Wrong Country ("Rome, Spain")

### Root Cause

The `day.country` field in stored itinerary data comes from `trip_cities.country`, but many `trip_cities` rows have `country = null` (confirmed in DB: the Barcelona+Rome trip has null country for both cities). When the country is null in the dayMap, the AI-generated day JSON may contain a hallucinated country value that isn't overwritten (or was generated before the overwrite code existed). Day 4 in the DB literally stores `country: "Spain"` for Rome.

Two issues compound:
1. `trip_cities` rows are often created without a `country` value
2. The client blindly trusts `day.country` from stored data without validation

### Fix (2 parts)

**Part 1: Client-side country lookup fallback (`EditorialItinerary.tsx`)**

Add a small `CITY_TO_COUNTRY` map (covering the ~25 popular destinations already in `destinationSearch.ts`) and use it as a validation/fallback when rendering the city badge at line 9000:

```typescript
// Before:
{day.city}{day.country ? `, ${day.country}` : ''}

// After:  
{day.city}{resolvedCountry ? `, ${resolvedCountry}` : ''}
```

Where `resolvedCountry` uses `day.country` only if it passes a sanity check (city belongs to that country), otherwise looks up from the map. This is a ~20-line constant + 3-line lookup, added near the top of the component.

**Part 2: Edge function — populate country when creating trip_cities**

In the trip creation flow (where `trip_cities` rows are inserted), look up the country from the `destinations` table or a hardcoded map when the user/parser doesn't provide one. This prevents null countries going forward.

Search for where `addTripCity` / `addTripCities` is called without a country value and ensure the country is resolved before insertion.

### Scope
- `EditorialItinerary.tsx`: Add city-to-country map constant + use it in badge rendering (~25 lines)
- Trip creation code (where trip_cities are inserted): Add country resolution (~10 lines)
- Optionally: backfill existing null-country trip_cities rows via migration

