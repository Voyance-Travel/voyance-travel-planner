# Plan: Fix itinerary timing regressions

## What is wrong

The Milan trip shows two separate timing failures:

1. **The visible JSON itinerary is out of order.**
   - Day 1 currently stores `Dinner: Cracco in Galleria` at 19:00 before `Visit Duomo di Milano` at 16:30.
   - That came from the targeted must-have heal inserting Duomo without re-sorting Day 1 before save.

2. **The normalized activity table is stale and more broken than the JSON.**
   - `itinerary_activities` for the same trip still contains the previously removed 01:44–08:10 phantom Day 1 cards.
   - It also still contains Day 3 `Golden Hour Group Walk through Brera` after/around checkout.
   - The page-load sparse-rebuild code can temporarily prefer those per-row table activities when it thinks JSON is missing content, even when the trip is already frozen. The backend write no-ops, but the local page state is still replaced, so users can see “9 AM → 12 PM → 6 AM” style timelines.

There is also one systemic parity gap:

- The **frontend timing cascade mirror** still uses raw minute sorting in one path, while the backend uses wrap-aware ordering plus orphan/pre-dawn cleanup. That makes analyzer/preview behavior disagree with the server and can keep reintroducing bad timing warnings.

## Fixes to implement

### 1. One-shot heal for trip `44a68e13`

- Re-sort Day 1 JSON activities by canonical day chronology so Duomo appears before dinner.
- Rebuild `itinerary_activities` for this trip from the canonical `trips.itinerary_data` JSON.
- Remove stale normalized rows not present in JSON:
  - Day 1 phantom 01:44–08:10 sequence
  - Day 3 post-checkout Brera walk
- Ensure Day 2 normalized dinner matches the JSON pasta-night repair (`Pasta Night at Trattoria Trippa`), not stale Berton.

### 2. Stop stale table rows from overriding healthy frozen JSON

- In `TripDetail` sparse rebuild, do **not** set local trip state from per-row/table reconstruction when the trip is frozen/ready and the backend save is blocked.
- For frozen ready trips, use table rebuild only as diagnostics unless JSON is empty or explicitly user-recovered.
- Gate the table-vs-JSON chooser so per-row data must pass timing sanity checks before it can ever replace JSON locally.

### 3. Add a shared timing sanity gate before table rebuild wins

Before any rebuild candidate from `itinerary_activities` can be chosen, reject it if it has:

- Non-bookend activities before 06:00 on Day 2+.
- Large backwards jumps in stored order, except legitimate late-night wrap after 22:00.
- Non-logistics activities after checkout/departure on the final day.
- A candidate that is less chronologically coherent than current JSON.

### 4. Bring frontend timing cascade back to backend parity

- Update `src/utils/itinerary/timingCascade.ts` to use `dayChronoKey` sorting instead of raw minute sorting.
- Mirror the backend’s orphan late-nightlife / pre-dawn cleanup behavior or delegate those checks to shared frontend helpers before the cascade dry-run.
- Add regression tests for:
  - Day 1 `19:00` followed by `16:30` is sorted correctly.
  - Stale per-row predawn rows cannot win over healthy JSON.
  - Day 3 post-checkout activity is rejected from rebuild.
  - Frontend cascade keeps valid late-night 00:xx bookends at the tail but does not treat random 06:00 activities as a valid next morning sequence.

## Acceptance criteria

- Milan trip Day 1 displays in order: check-in → morning/afternoon activities → Duomo → dinner.
- Milan normalized tables match the JSON, with no phantom predawn rows and no post-checkout Day 3 activity.
- Reloading the trip cannot temporarily replace healthy JSON with stale `itinerary_activities` rows.
- New itineraries no longer produce or surface backwards timing jumps like `09:00 → 12:00 → 06:00`.
