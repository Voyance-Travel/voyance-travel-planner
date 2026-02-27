
Root issue identified: the “Just Tell Us” confirmation can display multiple cities, but the persisted trip record is still being saved as single-city for chat-created trips. In current data, chat trips are consistently stored with:
- `is_multi_city = false`
- `destinations = null`
- no rows in `trip_cities`

The itinerary generator then behaves exactly as coded: it only enters multi-city routing when `trip.is_multi_city` is true. So even if the title contains multiple cities, generation stays single-city.

Implementation plan:

1) Make confirmed `cities[]` authoritative in chat trip creation
- In `Start.tsx` chat callback (`onChatDetailsExtracted`), stop treating multi-city as “best effort inference.”
- Priority order for city resolution:
  1. `details.cities` from confirm card (authoritative if length > 1)
  2. fallback parser from destination/notes only when `cities[]` is missing/invalid
- If resolved city count > 1, force:
  - `is_multi_city = true`
  - `creation_source = 'multi_city'` (or a stable chat-multi source)
  - `destinations` JSON filled with ordered city legs + nights

2) Remove brittle re-inference divergence between chat UI and trip persistence
- Ensure the same normalization rules are used between:
  - `TripChatPlanner` extraction/fallback
  - `Start.tsx` persistence
- Centralize city normalization into one shared utility (single source of truth), so “what user confirmed” == “what gets written.”

3) Enforce successful write of per-city records (no silent failure)
- Current chat path can fail silently when writing `trip_cities`.
- Change to strict handling:
  - if multi-city: `trip_cities` insert must succeed for all legs
  - if single-city: at least one `trip_cities` row must succeed
  - on failure: show explicit error and avoid navigating to generation
- Optional hardening (recommended): move chat-trip creation into one backend function to make trip + trip_cities persistence atomic and avoid partial writes.

4) Keep generator contract aligned (no behavior change needed there)
- `generate-itinerary` currently relies on persisted `trip.is_multi_city` and `destinations`/`trip_cities`.
- Once creation writes correctly, generator will naturally produce multi-city itineraries.
- No prompt-only fix is sufficient unless persistence contract is correct.

5) Add defensive observability for future regressions
- Add structured logs (frontend + backend function if added):
  - detected city count
  - resolved city list
  - final payload fields (`is_multi_city`, destinations length, city_rows inserted)
- Add a guard before navigation to `/trip/:id?generate=true`:
  - if route has >1 city but `is_multi_city !== true`, block and toast a diagnostic error.

Validation plan (must pass):
1. Create via Just Tell Us: “Hong Kong then Shanghai then Beijing then Tokyo.”
2. Confirm card shows 4 cities.
3. In database for the new trip:
   - `is_multi_city = true`
   - `destinations` contains all 4 in order
   - `trip_cities` has 4 rows with correct `city_order` and dates/nights
4. Generate itinerary:
   - days are mapped across all cities
   - transition days appear between city legs
5. Regression checks:
   - single-city Just Tell Us still creates 1 city row and normal itinerary
   - two-city phrasing variants (“London and Paris”, “London, Paris”, “London -> Paris”) all persist as multi-city.

Technical note on why this keeps recurring:
- The extraction/prompt quality is not the primary blocker anymore.
- The blocker is persistence contract mismatch: multi-city intent is seen in chat/confirmation, but not consistently committed into the fields (`is_multi_city`, `destinations`, `trip_cities`) that generation actually uses.
