# Map links resolve to wrong city (Atlanta) for Amsterdam venues

## Symptom

On the Amsterdam trip, tapping the map pin / "Open in Maps" for restaurants (Bakers & Roasters, Maoz Vegetarian, RIJKS, Restaurant Flore, Omelegg, Dignita, Fries 'N' Joy) and for the hotel return cards opens Google Maps centered on Atlanta locations of the same brand. The activities themselves are correctly Amsterdam in the database.

## Root cause

Cards build Google/Apple Maps search URLs from `name + address` only. The database stores neighborhood-only addresses for many dining rows (`De Pijp`, `Jordaan`, `Centrum`, `Oud-Zuid`, `Oud-West`) with no city/country. Without `lat,lng` or city context, Google's ambiguous-name resolver picks the most globally popular match — Atlanta wins for several of these brands. Hotel "return to" rows have `location: null` and fall back to a query of just `"Amsterdam Marriott Hotel"` (Marriott exists everywhere).

Three leak sites in the frontend, plus one data-quality gap in the backend:

1. `src/utils/mapNavigation.ts` → `openMapLocation` builds `query=${address || name}` with no destination.
2. `src/components/itinerary/ItineraryEditor.tsx` → `getMapsUrl` builds `query=${name} ${address}` with no destination.
3. `src/components/itinerary/DayRouteMap.tsx` (lines 60, 65, 243) → directions URLs use lat/lng so they're fine, but `name`/`address`-only fallbacks (if any in nearby render paths) need the same audit.
4. Backend writers persist bare-neighborhood `location.address` without the destination city, so even a corrected client still gets ambiguous input on legacy rows.

## Fix

### 1. Frontend: always include destination in map queries (primary fix)

Add a small helper `buildSafeMapQuery({ name, address, lat, lng, destination })` in `src/utils/mapNavigation.ts`:

- If `lat` and `lng` are both present, use coordinates verbatim (most accurate).
- Otherwise build `query = [name, address, destination].filter(Boolean).join(', ')`, deduping when `address` already contains `destination` (case-insensitive substring).
- Always trims neighborhood-only addresses to `${address}, ${destination}` when destination isn't already present.

Wire it through:
- `openMapLocation(location, provider, travelMode, destination?)` — new optional `destination` arg, threaded from the trip context wherever it's called.
- `ItineraryEditor.getMapsUrl(loc)` — take `destination` from the surrounding trip/activity context and call `buildSafeMapQuery`.
- Any other call site that ends in `google.com/maps/search/?...query=` (grep is already clean except these two).

Source the destination from the existing trip object (`trip.destination` or `trip.cities[0]?.name` for multi-city). All cards already receive `trip` or a `destination` prop one or two parents up.

### 2. Backend: normalize bare-neighborhood addresses on write

In `supabase/functions/_shared/scrub-activity.ts` (single output-validation boundary already wired at repair-day §10b, action-save-itinerary `normalizeDays`, and chat executor), add a `normalizeLocationAddress(activity, destination)` step:

- If `activity.location.address` is non-empty AND does not contain a comma AND does not contain the destination string (case-insensitive), set `activity.location.address = ${address}, ${destination}`. Idempotent — re-running is a no-op.
- Skip when `location.coordinates` are present and the address already looks complete (`,` present).

This stops new persistences from writing bare-neighborhood addresses and lets ledger consumers (verified_venues prefetch, restaurant link lookup, map link) work off complete addresses.

### 3. One-shot legacy backfill

Migration that runs once across `itinerary_activities` rows where:
- `location->>'address'` is non-null AND not containing `,` AND not containing destination (resolved via `trips.destination`).

Update to `${address}, ${destination}`. Same pass through `trips.itinerary_data->'days'[*]->'activities'[*]->'location'->'address'` to keep JSON snapshot aligned. Sentinel logged per row updated.

### 4. Verification

- Reload `https://travelwithvoyance.com/trip/2aa3c144-df77-43b0-8cbe-3b508e8daeb8`, open every dining card and the Return-to-Hotel rows, click "Open in Maps". Each must land on an Amsterdam venue.
- Re-query DB: every `location.address` for that trip ends in `Amsterdam, Netherlands` (or `Amsterdam`).
- New unit test `mapNavigation.destinationGuard.test.ts`:
  - `buildSafeMapQuery({ name: 'Bakers & Roasters', address: 'De Pijp', destination: 'Amsterdam' })` → query contains `Amsterdam`.
  - Coordinates path bypasses destination append.
  - Idempotent when `address` already contains destination.

## Out of scope

- Activity photos (separate Google Places photo cache path).
- Cross-city venue filter at generation time (already covered by Cross-City Venue Guard memory).
- Apple Maps deep-link variants beyond `?q=` (already covered by helper).
