## Goal

Resolve the 3 routing/timing issues the itinerary has flagged, finish Day 3 dining corrections, fix Day 4 departure metadata, and patch the generation pipeline so the same classes of bug don't reappear on future trips.

## What's wrong (trip `7ea828ac…`)

**Day 1 — broken dinner routing**
- 17:42 Golden hour photos at Pont de l'Alma → ends 18:27
- 18:57 "Travel to Four Seasons George V" (15 min hole, no travel from viewpoint)
- 19:00 Dinner at Le Bouillon Julien (no travel TO the restaurant; restaurant is in 10th arr., not at hotel)
- 19:07 "Return to Four Seasons" *during* dinner

**Day 2 — broken evening chain**
- 15:20–18:00 "Freshen Up" (2h40m, way too long)
- 18:00 Walk to Le Bar at Plaza Athénée → 18:07
- 19:00 Dinner at Chez L'Ami Jean (7th arr.) — no travel from bar; bar nightcap is *after* dinner at 21:00
- The pre-dinner bar stop is mis-sequenced; the "Walk to Le Bar" at 18:00 is actually wrong activity (should be travel to restaurant)

**Day 3 — multiple issues**
- 12:30 Lunch at Le Comptoir du Panthéon overlaps with 12:31 "Travel to Sacré-Cœur"
- 14:41 Sacré-Cœur start has unexplained 1h11 gap after lunch
- **Dinner at Arpège $30** — duplicate of Day 1 lunch venue AND impossibly priced
- 19:00–20:15 dinner, then 20:06 travel that arrives 22:36 (2.5h transit for a 3.5 USD metro ride is impossible)

**Day 4 — departure flight has no time/duration/cost**
- "Transfer to the Airport" exists but the flight activity itself is missing scheduling fields

## Fix plan

### A. Trip data fixes (one-time, via SQL)

1. **Day 1 dinner sequence** — rewrite the 18:27→19:22 block:
   - 18:27 Walk to Pont de l'Alma metro (5 min)
   - 18:32 Metro/taxi to Le Bouillon Julien (~25 min from 7th to 10th arr.)
   - 19:00 Dinner at Le Bouillon Julien (75 min)
   - 20:15 Taxi to Four Seasons George V (~20 min)
   - Remove the misplaced 18:57 "Travel to Four Seasons" and 19:07 "Return to hotel"

2. **Day 2 evening sequence** — rewrite 15:20→22:47:
   - Compress freshen-up to 60 min (15:20–16:20) — backed by Believable Human rule
   - Insert afternoon free block or shift dinner earlier; or
   - Keep freshen until 18:00, then 18:00 Travel to Chez L'Ami Jean (taxi ~15 min)
   - 18:30–20:00 Dinner at Chez L'Ami Jean
   - 20:00 Walk/taxi to Le Bar Plaza Athénée
   - 20:30–22:00 Nightcap (shorten from 90 min)
   - 22:00 Walk to Four Seasons (existing)

3. **Day 3 fixes**:
   - Shift lunch to 12:35–13:35 (after 12:31 travel completes) OR move travel to start at 13:30
   - Replace dinner "Arpège $30" with a fresh Paris venue from `cost_reference` (e.g. **Le Bistrot Paul Bert** ~$160 for two, or **Frenchie** ~$280) — must NOT be Arpège (Day 1) or any other already-used venue
   - Recompute travel time from new dinner venue → Sunset Sunside Jazz Club; if >30 min metro is unrealistic, replace with taxi ($25–35) and proper duration

4. **Day 4 departure flight**:
   - Populate `time`, `endTime`, `durationMinutes`, `cost`, and `description` from the existing flight metadata in `trips.itinerary_data.flight` (departure flight)
   - Confirm 180-min buffer between arrival at airport and flight departure

5. **Sync `activity_costs` and `cost`/`estimatedCost`** in JSONB for every changed row.

### B. Generation pipeline hardening (prevents recurrence on all trips)

1. **Post-meal travel guard** (`day-validation.ts` + `repair-travel.ts`):
   - For every dining activity, require a `transport` activity immediately preceding it whose `toLocation` matches the restaurant venue (or starts within 5 min of dining start).
   - If missing, the repair pass synthesizes a realistic transport leg using existing `predictTransitDuration` (already enforces 1.4× walk factor and 1200m taxi threshold).
   - Symmetrically, any activity following dinner must have a transport leg from the restaurant.

2. **Travel-time sanity cap** (extend existing transit estimation memory):
   - If a `transport` activity's `durationMinutes` exceeds 90 min within the same city (no inter-city flag), flag as `TRANSIT_IMPLAUSIBLE` and let repair recompute via Google Distance Matrix wrapper.
   - Already-extracted helper: reuse `centralized Google API wrapper` (per `Google API Centralization` memory).

3. **Cost-floor enforcement for premium venues** (`action-repair-costs/index.ts`):
   - Currently only writes to `activity_costs`. **Extend it to also patch `trips.itinerary_data` JSONB** (per `Table Driven Cost Architecture` memory).
   - Add a "repeat-venue cost-floor" rule: if a venue name appears in `cost_reference` with `tier='michelin'` or `cost_floor>=100`, any activity whose cost is <50% of the reference floor is auto-corrected.
   - Run this pass at the end of `action-save-itinerary` for every newly generated trip, not just on-demand.

4. **Freshen-up duration cap** (`day-validation.ts`):
   - Cap `accommodation` activities tagged `freshen-up`/midday-hotel-ritual to 90 min max (per Believable Human memory). Current observed: 160 min on Day 2.

5. **Departure flight metadata completeness check** (`hard-constraint-enforcement.ts`):
   - On final guard pass, assert the last-day flight activity has non-null `time`, `endTime`, `durationMinutes`. If missing, hydrate from `trips.itinerary_data.flight` payload. Throw `MISSING_DEPARTURE_METADATA` if still empty.

### C. Tests

- Add fixture-based tests in `supabase/functions/generate-itinerary/_tests/`:
  - `post-meal-travel.test.ts` — synthesizes a day with restaurant + no leading transport; expects repair to insert one
  - `transit-sanity-cap.test.ts` — feeds a 150-min same-city transport; expects flag + recompute
  - `cost-floor-jsonb.test.ts` — runs `action-repair-costs` and asserts `itinerary_data` JSONB updated, not just `activity_costs`
  - `freshen-up-cap.test.ts` — input 160-min freshen-up; expects capped to 90
  - `departure-metadata.test.ts` — last-day flight with empty time; expects hydration from trip-level flight payload

## Execution order

1. SQL fixes for Days 1-4 (one-time; no code change).
2. Pipeline patches (B1-B5) with tests.
3. Run targeted test suite (`generate-itinerary/_tests`); confirm all green before deploying edge functions.

## Out of scope

- Re-generating the trip end-to-end (user opted to surgically fix; preserves locked items).
- Changes to the planner UI — these are all backend.

## Files expected to change

- `supabase/functions/generate-itinerary/day-validation.ts`
- `supabase/functions/generate-itinerary/repair-travel.ts` (new helper if not present)
- `supabase/functions/generate-itinerary/hard-constraint-enforcement.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- `supabase/functions/action-repair-costs/index.ts`
- `supabase/functions/generate-itinerary/_tests/*` (5 new tests)
- One-shot SQL UPDATE on `trips.itinerary_data` for trip `7ea828ac…`
