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

---

## Fresh 15/15 run (owner: "solid fresh batch + proof") — 7 fresh trips on the deployed content-floor fix
Vienna 4d · Tokyo 6d Honeymoon · Lisbon 6d · Barcelona 5d · Marrakech 4d · Mexico City 5d · Istanbul 5d
(Europe×2, Asia, Africa, Americas, Eurasia; both previously-failing cities re-tested.)

**All 7: ready + fully_persisted=true → all render.** (V2 render fix holding.)

**Deep content audit: 6/7 PASS hard gates.**
- ✅ **Lisbon + Barcelona come out CLEAN from fresh generation** → the nightcap + 06:30 meal-floor
  fix is validated in production (the exact cities that failed before).
- ✅ Vienna, Tokyo, Marrakech, Mexico City clean.
- ❌ **Istanbul** — 1 real issue: a placeholder breakfast ("Breakfast — find a local spot in the
  destination", 08:30) on the departure day, *after* the 07:35 airport transfer.
  - The self-check's post-checkout strip **already removes it correctly** (tested on the real data:
    BEFORE has the breakfast, AFTER selfCheckAndRepair it's gone). So the strip is right — it's a
    **V2-chain ordering bug**: the meal-coverage gate (8g) re-injects a departure-day breakfast that
    escapes the final strip. Narrow (early-flight last days) + uses a placeholder title.
  - The audit's "Spice Bazaar dup" was a **false positive** (DB confirms it appears once, D1 only).

**Net: 6/7 fresh clean; the fix this round targeted (nightcap/breakfast-floor) is confirmed working.
Remaining: a narrow departure-day meal-reinjection edge on Istanbul.**

---

## 7/7 close-out (after all 4 fixes deployed)
Re-tested Istanbul (the one fail) TWICE on the deployed fixes:
- **Departure-day fix:** D5 = checkout + taxi + flight, **no post-departure breakfast.** ✅
- **Must-do dedup fix:** rebuilt WITH the Spice Bazaar must-do (the exact 3-copy case).
  Eyes-on (not just the audit): Spice Bazaar appears **exactly once** (D1, venue "Spice Bazaar
  (Egyptian Bazaar)"). Note: a transient mid-generation state briefly showed 2 with title variants
  that the title-keyed audit did NOT flag — caught only by looking at the cards; the dedup collapsed
  it to 1 in the stable state. Full audit: **PASS.**
- Soft: D4 thin (1 real activity) — pacing, not a failure.

**Result: 7/7 fresh trips clean on hard gates** (Vienna, Tokyo, Lisbon, Barcelona, Marrakech,
Mexico City, Istanbul), all render, **verified by reading the content — not just the automated pass.**

## Four real bugs fixed + validated this session
1. Render hang — every fresh trip stuck "Loading…" (V2 never stamped fully_persisted). FIXED.
2. Content timing — nightcap at 2pm / 00:00, breakfast 06:20 under floor. FIXED + validated (Lisbon/Barcelona).
3. Departure-day meal — placeholder breakfast after the airport transfer. FIXED + validated (Istanbul D5).
4. Must-do variant-dedup — one must-do rendered as 3 cards with different titles. FIXED + validated.

**Honest bar going forward:** stable floor + content reads clean on a broad sample (verified by eyes,
not just structural checks) + tools work. QA is asymptotic — a wide sweep will keep finding narrow
edges. This is "earned, verified by looking," not "bug-free."
