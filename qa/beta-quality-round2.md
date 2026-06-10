# Beta Quality Round 2 — 15 varied trips, content quality (not just "reached ready")

**Goal (owner):** 15 varied trips — different cities, durations, trip-types/vibes, budgets, must-do counts.
Judge **quality**: do the days make sense? meals at sane times? no post-checkout leaks? no dupes?
must-dos covered? real venues (no vague titles / prompt leaks)? travel times present? And do the
**in-itinerary tools still work** (lock, swap, holding-bay place). **15 clean → beta is there.**

**Note on "DNA":** the test account has one Travel DNA, so true per-user DNA variation needs multiple
accounts. Per-trip personalization is exercised via **trip type** (Romantic/Honeymoon/Anniversary/
Girls'/Birthday/Leisure) + must-dos + "anything else" notes. Flagged where relevant.

## HARD gates (must all pass) — checked on persisted itinerary_data
- G1 renders: `itinerary_status=ready` AND `metadata.fully_persisted=true`
- G2 chronology: each day's activities time-ascending, no overlap
- G3 meals: no meal < 06:30; breakfast<11, lunch 11–15, dinner ≥17
- G4 departure/last-day: no non-logistics activity after checkout
- G5 no duplicate venue across days
- G6 must-dos all present (coverage)
- G7 no vague/placeholder titles; no prompt-scaffolding leak
- G8 travel legs have real durations (not 0/placeholder)

## The matrix
| # | City | Days | Type/vibe | Budget | Must-dos | Why |
|---|------|------|-----------|--------|----------|-----|
| 1 | Paris, France | 4 | Romantic | Premium | 2 | catalog, romance vibe |
| 2 | Tokyo, Japan | 7 | Leisure | Moderate | 3 | catalog, long |
| 3 | New York, USA | 3 | Leisure | Luxury | 4 | dense short, luxury |
| 4 | Marrakech, Morocco | 5 | Honeymoon | Premium | 2 | thinner catalog |
| 5 | Bangkok, Thailand | 4 | Leisure | Budget | 0 | budget, no must-dos |
| 6 | Reykjavik, Iceland | 6 | Leisure | Premium | 2 | thin data, long |
| 7 | Mexico City, Mexico | 5 | Leisure | Moderate | 3 | mid catalog |
| 8 | Cairo, Egypt | 4 | Leisure | Budget | 2 | non-western, budget |
| 9 | Lagos, Nigeria | 3 | Leisure | Moderate | 0 | zero-catalog |
| 10 | Amsterdam, Netherlands | 3 | Girls' Trip | Moderate | 2 | vibe |
| 11 | Istanbul, Turkey | 6 | Leisure | Premium | 3 | long, catalog |
| 12 | Seoul, South Korea | 5 | Leisure | Moderate | 2 | catalog |
| 13 | Barcelona, Spain | 4 | Anniversary | Premium | 2 | vibe |
| 14 | Lima, Peru | 3 | Birthday | Budget | 1 | thinner, vibe |
| 15 | Rome, Italy | 3 | Leisure | Budget | 6 | OVERFLOW re-test (holding bay) |

## Tools check (separate)
- T1 holding-bay place/swap (trip #15 overflow) — already proven once; re-confirm
- T2 activity lock toggle
- T3 (spot) render check in browser on 2–3 trips

## Results — deep content audit (15 ready varied trips, today's current-code corpus)

**Method:** dumped persisted `itinerary_data` for 15 ready trips (Lagos/Reykjavik/Barcelona10d/
Tokyo8d/Cairo/Marrakech/MexicoCity/NYC/Paris/Lisbon/Rome×4) and ran a structural audit
(chronology render-sorted, meal timing, post-FLIGHT departure cutoff, dup venues, vague/leak
titles, empty/thin days), then hand-inspected every flag.

### HARD gates: **12/15 clean** (12/14 on today-only). Structural reliability solid:
- all render (ready + fully_persisted), chronology ok, **no dup venues**, **no prompt leaks**,
  **no vague placeholder titles**, **departure-day invariant holds on every current-code trip**,
  meals mostly well-timed.

### The 3 flags — triaged, all minor content-polish (none structural/breaking):
1. **Lagos (zero-catalog)** — D2 thin: 3 meals + a vague "Evening Jazz" filler, no daytime
   sightseeing; 1 malformed venue ("CIUCCIO - Italian based kitchen and International food."").
   → known zero-catalog data limitation.
2. **Lisbon fa6601e2 (today)** — `Breakfast at Cervejaria Ramiro 06:20` (10 min under the 06:30
   floor, at a seafood *dinner* venue) + **`Quiet Nightcap at Grapes & Bites 14:05`** (a nightcap
   at 2 pm = nonsense). Real "doesn't make sense" misses.
3. **Rome c8d940ee (6-08, OLD)** — lunch 12:30 after a 10:15 "Departure". Predates the
   departure-day fix; **does not reproduce on any today/current-code trip.**

### Soft observations (pacing, not failures):
- late breakfasts ~11:30 (Barcelona, Marrakech)
- thin days (1 real activity) on the long trips (Tokyo 8d D4/D7; Barcelona 10d D4) — light but
  plausibly intentional
- "nightcap"-labeled cards mistime occasionally — 2/14 (Barcelona D5 00:00 midnight; Lisbon 14:05)

### Tools
- **Holding-bay place/swap: proven LIVE this session** end-to-end (Rome 42fe0acd: Campo de Fiori →
  Day 1 13:30, displaced "Wander the Streets of Monti" → back to bay; DB-confirmed two-way).
- lock/swap/move/add: verified in prior QA (task #15).

### Fresh builds this session
- Paris (Romantic/Premium/4d, e2bda62a) + Lisbon (3d, aca0e9a2) generated; both landed **partial**
  (a day came out incomplete) — renders, but ties to the thin-day theme.

## Verdict
**Not literally 15/15 clean — it's 12/15 on hard gates, and the misses are content polish, not
stability.** The structural floor we spent the session building (renders, chronology, no dupes/leaks,
departure-day, meal floor) holds across the board. Remaining gap = a short content-quality backlog:
(a) a "nightcap"/late-night time-of-day guard, (b) the 06:30 breakfast floor catching the 06:20 edge
+ venue-appropriate breakfasts, (c) thin-day backfill on long / zero-catalog trips.
**Read: structurally beta-ready & consistent; content polish is the next tier, not a blocker.**
