## Goal
Stop scheduling defects from reaching the itinerary by adding a deterministic **Scheduling Executioner** layer that runs after generation/filler output and before persist/response. This should act on hard truth, not prompts.

## What I’ll build

### 1. Canonical flight-anchor enforcement
- Add a shared backend helper, likely `supabase/functions/_shared/schedule-executioner.ts`, with a `enforceFlightAnchors()` pass.
- Use the existing shared flight leg picker (`_shared/flight-leg-pick.ts`) instead of ad-hoc `flight_selection.arrivalTime24 || arrivalTime || legs[0]` extraction.
- On Day 1:
  - rewrite or inject the arrival logistics card from the actual destination arrival time
  - remove/retime non-logistics activities before landing + required arrival buffer
  - prevent generated arrival anchors like `21:30` when the flight truth is `22:00`
- Apply this in both paths:
  - `action-generate-day.ts`
  - `action-generate-trip-day.ts`

### 2. Explicit midnight-spill handling
- Add a `detectMidnightSpill()` pass to classify activities where `endTime < startTime` or where late-night bookends land after midnight.
- Allow only known late-nightlife chains to spill past midnight.
- For allowed spillovers:
  - stamp metadata such as `spillsPastMidnight: true` / `spilloverMinutes`
  - ensure UI/health can warn “continues after midnight” instead of silently treating it as a normal same-day card
- For disallowed spillovers:
  - retime, drop, or send to refill depending on whether the row is salvageable
- Keep the existing late-nightlife bookend rules, but make the behavior explicit and audited.

### 3. Final buffer execution before response
- Move the effective `enforceTimingAndBuffers()` result into the hot response path, not only the persist boundary.
- Run it after enrichment/gap-fill/quality pass and before the final validation gate so the itinerary the user sees matches the saved itinerary.
- Re-run validation after the cascade so warnings like “2 activities have no travel buffer” do not ship when the deterministic cascade already knows how to fix them.
- Add metadata counters under `metadata.quality.executioner` for repairs: `buffer_fix`, `overlap_fix`, `transit_recomputed`, `dropped_past_midnight`.

### 4. Geographic coherence / cluster guard
- Add a new deterministic `geo-coherence` check inside the Executioner.
- Detect outlier activities inside a themed neighborhood day using:
  - coordinates from enrichment when available
  - neighborhood/address/title signals when coordinates are missing
  - transition duration/distance from existing transit helpers
- If a day is clustered around Shinjuku, an Asakusa outlier like Senso-ji should be flagged as `GEO_OUTLIER` and either:
  - moved only if there is a compatible day/slot available, or
  - dropped and sent to the refill layer for a same-zone replacement
- Drop orphan transit cards created by outlier removal.

### 5. Wire Executioner into skeleton cleanup/refill
- Extend `itinerary-cleanup.ts` so cleanup is not just city-level; it can also enforce:
  - slot time compatibility
  - distance/zone coherence
  - midnight spill legality
- Feed `needsRefill[]` into the existing `refillDroppedSlots()` path so bad rows are replaced, not merely removed.
- Keep `schema_filler_primary` flag-gated, but make its eligibility depend on passing Executioner with zero critical defects.

### 6. Health warning parity
- Update the health/audit side so these defects surface consistently:
  - `FLIGHT_ANCHOR_MISMATCH`
  - `MIDNIGHT_SPILLOVER`
  - `BUFFER_UNRESOLVED`
  - `GEO_OUTLIER`
- If the Executioner repairs a defect, no stale warning should remain.
- If a valid late-night spill remains, show it as an intentional late-night continuation, not an unexplained broken day.

## Tests I’ll add
- Flight arrival mismatch: Tokyo flight `22:00`, generated anchor `21:30` gets corrected or replaced.
- Midnight spill: Golden Gai `22:55–00:55` + hotel return `01:20` is marked as late-night spill and sorted/displayed at day tail.
- Invalid morning nightcap: `Nightcap` at `09:00` gets dropped/refilled or moved to an evening slot.
- Hotel venue before check-in: hotel-located activity before check-in is blocked unless it is explicit luggage/check-in logistics.
- Buffer conflicts: back-to-back Tokyo activities are cascade-repaired before response.
- Geo outlier: Senso-ji in a Shinjuku day is detected and replaced with a Shinjuku-compatible slot.

## Technical touchpoints
- New: `supabase/functions/_shared/schedule-executioner.ts`
- New tests under `supabase/functions/_shared/__tests__/`
- Edit:
  - `supabase/functions/generate-itinerary/action-generate-day.ts`
  - `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
  - `supabase/functions/_shared/itinerary-cleanup.ts`
  - `supabase/functions/_shared/audit-timing.ts`
  - relevant frontend health display/parser files only if needed for visible warnings

## Rollout safety
- First ship as deterministic enforcement with telemetry.
- Do not remove legacy repair/quality passes yet.
- Preserve locked/manual/user activities under Universal Locking.
- Use existing persistence and no-regression guards so the Executioner cannot wipe a healthy day.