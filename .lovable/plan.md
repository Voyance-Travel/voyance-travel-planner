## Problem

The AI invents itineraries that include real, famous restaurants but assigns them to the wrong city (Sant'Eustachio Il Caffè in Rome → "Venice", Trattoria Sostanza & All'Antico Vinaio in Florence → "Venice"). The venue, address, and reputation are all real — but they are physically in another city.

## Root cause

`venue-enrichment.ts` already has a 50 km **distance guard** that rejects Google Places matches further than 50 km from the destination. When the AI hallucinates Sant'Eustachio for Venice, Google Places resolves the venue → Rome → guard rejects → `verifyVenueWithGooglePlaces` returns `null`.

But "rejected" is a soft outcome:
- The activity is **kept as-is** with the AI's original (wrong-city) name and address text.
- `enriched.verified.confidence` falls back to `0.6` and the card ships to the user.
- No log/metric flags this as a cross-city hallucination, and no replacement is attempted.

The hallucination filter in `action-generate-trip-day.ts` only catches **generic stub names** ("Trattoria del Corso", "The Hidden Gem"). Real, famous venues from training data sail through.

## Plan

### 1. Detect cross-city hallucinations during venue verification

In `supabase/functions/generate-itinerary/venue-enrichment.ts`, when the 50 km distance guard fires, compute name overlap between the AI venue name and the Google Places result. If overlap ≥ 0.6 AND distance > 50 km, return a **structured rejection** (not just `null`):

```ts
return { isValid: false, confidence: 0, crossCityHallucination: true,
         resolvedCity: <reverse-geocoded city of the place>,
         intendedCity: destination };
```

Extend `VenueVerification` with the new optional fields. Add a city extractor from `place.formattedAddress` (last-but-one comma-segment is enough for diagnostics).

### 2. Drop / retry cross-city hallucinated activities

In `enrichActivityWithRetry` (same file): when `verifyVenueWithDualAI` returns `crossCityHallucination: true` for a `dining`/`restaurant`/`food`/`sightseeing` activity, mark `enriched.crossCityHallucination = true` and `enriched.removed = true` with a reason.

In `pipeline/enrich-day.ts`: after the enrichment loop, filter out any activity with `removed: true && crossCityHallucination`. Log: `[CROSS-CITY HALLUCINATION] Removed "<title>" — Google placed in <resolvedCity>, expected <destination>`.

Locked / user-specified venues are exempt (consistent with existing hallucination filter behaviour).

### 3. Sync filter into the post-generation pass

In `action-generate-trip-day.ts` around the `HALLUCINATION FILTER` block (~line 953), add an **address-string cross-city check** as a second line of defence for cases where enrichment is skipped or times out:

- Build a small `OTHER_CITY_TOKENS` map keyed by the destination's country (e.g. for Italy: `roma|rome|firenze|florence|milano|milan|napoli|naples|torino|bologna|verona`).
- For each dining/sightseeing activity whose destination is, say, Venice, scan `act.address`, `act.location.address`, and `act.location.name` for any *other-city* token. If found and the destination token (`venezia|venice`) is **absent**, drop the activity with log `[CROSS-CITY ADDRESS] Removed "<title>" — address mentions <city>, destination is <destination>`.
- Keep the list focused on Italy/France/Spain/UK/Germany/Japan to start; structure so other countries can be added later. Trip-level destination token is derived from `cityInfo?.cityName || destination`.

This catches the exact symptom the user reported even when Google Places isn't called.

### 4. Telemetry

Add a counter line at the end of `enrich-day.ts`:
`[enrich-day] Cross-city hallucinations removed: N` so future regressions are visible in edge logs.

### 5. Database cleanup for the current Venice trip

Migration: scrub the three confirmed wrong-city restaurants from the active Venice trip (`itinerary_activities` rows, `itinerary_days.activities` JSON, and `trips.itinerary_data.days[*].activities`) — match on title `ilike '%Sant''Eustachio%' OR '%Sostanza%' OR '%Antico Vinaio%'` for trip id `38f81fab-c114-4124-bc3a-a7c54ebd79df`.

### 6. Tests

- `venue-enrichment.test.ts`: mock Google Places returning a >50 km result with high name overlap → expect `crossCityHallucination: true`.
- `action-generate-trip-day.test.ts` (or new `cross-city-filter.test.ts`): an activity titled "Sant'Eustachio Il Caffè" with address `Piazza di Sant'Eustachio, 82, 00186 Roma RM, Italy` for destination `Venice, Italy` → removed.
- A user-specified (locked) cross-city venue → preserved.

## Files

- edit: `supabase/functions/generate-itinerary/venue-enrichment.ts`
- edit: `supabase/functions/generate-itinerary/pipeline/enrich-day.ts`
- edit: `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (mirror block also exists in `action-generate-day.ts` — apply same patch)
- new: `supabase/functions/generate-itinerary/cross-city-filter.ts` (token map + helper, shared by both action files)
- new tests as above
- new migration to scrub the 3 known bad rows from the current Venice trip

## Memory

Add a Core memory rule: "Cross-city venue guard: dining/sightseeing items whose Google Places match is >50 km from destination, OR whose address string mentions another well-known city in the same country without the destination token, are removed (locked/user-pinned exempt)."
