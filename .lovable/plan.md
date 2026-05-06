# Honor Adventure (+5 Thrill-Seeker) in Itinerary Generation

## The Bug

The `adventure` trait score is collected from the Fine-Tune slider and stored in `traitScores.adventure`, but the generation pipeline never uses it:

- `compile-prompt.ts` only forwards `effectiveTraitScores = { pace, budget }` — the `adventure` value is dropped.
- `buildAllConstraints()` only knows about `pace` and `budget`. There is no "Thrill-Seeker mode" prompt block.
- `deriveForcedSlots()` already produces an `edge_activity` slot when `adventure >= 4`, but it is only invoked **once** (Day 1, in `action-generate-trip.ts`) and the result is not validated or repaired per-day.
- `repair-day.ts` and `action-generate-trip-day.ts` never receive `adventureScore`, so missing edge activities are never injected.
- Rome has no obvious "outdoor adventure" defaults, so the model fell back to parks/fountains/markets.

## What to Build

### 1. Propagate `adventure` through the pipeline
- Extend `effectiveTraitScores` in `compile-prompt.ts` to include `adventure` (read from `blendedTraitScores.adventure ?? traitScores.adventure`).
- Update `buildAllConstraints(archetype, budgetTier, traits)` signature to accept `{ pace, budget, adventure }`.
- Add `adventureScore` to `RepairDayInput` (mirrors the `paceScore` change from the previous turn) and pass it from `action-generate-day.ts` and `action-generate-trip-day.ts`.

### 2. Prompt-level "Thrill-Seeker Mode"
In `archetype-constraints.ts`, add `buildAdventureRules(adventure: number)` and include it from `buildAllConstraints`. Tiers:

- `adventure >= 7` (Thrill-Seeker max): require **2 kinetic / adrenaline experiences per trip minimum**, at least 1 in first 3 days. Concrete examples (city-aware):
  - Rome: Vespa/e-scooter tour, catacombs night tour, Tiber kayak/SUP, gladiator school, e-bike Appian Way, climbing gym, go-karts at Pista La Pista, helicopter over the city, ghost/underground crawl.
  - Generic fallbacks per city type (coastal, alpine, urban, desert).
- `adventure >= 4`: at least 1 "edge" experience (bold, kinetic, off-beaten-path) somewhere in the trip.
- Forbid satisfying the slot with: parks, fountains, scenic walks, markets, shopping, cafés, museums.

### 3. Per-day forced-slot enforcement
- In `action-generate-trip-day.ts`, call `deriveForcedSlots` for the current day (not just Day 1) with the blended traits, and inject the result into the day prompt via `buildForcedSlotsPrompt`.
- After generation, call `validateDayPersonalization` for the `edge_activity` slot. If missing on a Thrill-Seeker trip and the trip has zero adventure activities so far, mark the day for repair.

### 4. Repair pass for missing adventure
In `repair-day.ts`:
- Accept `adventureScore`.
- If `adventureScore >= 4` and the trip-wide adventure count is 0 (passed in via repair input), add an instruction to the repair prompt: *"Replace one low-priority slot (park, scenic walk, generic café) with a kinetic/adventure experience appropriate to {city}. Do not add another museum or fountain."*
- Tag the result with `tags: ['adventure', 'thrill', 'kinetic']` so the validator recognizes fulfillment.

### 5. Tagging hygiene
- In `venue-enrichment.ts` / `fix-placeholders.ts`, when a venue's category matches climbing, kayak, scooter, motorcycle, helicopter, karting, etc., auto-add adventure tags so `validateDayPersonalization` sees the slot fulfilled.

## Files to Modify
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- `supabase/functions/generate-itinerary/archetype-constraints.ts`
- `supabase/functions/generate-itinerary/personalization-enforcer.ts` (expand city-aware tag matching for `edge_activity`)
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- `supabase/functions/generate-itinerary/action-generate-day.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/action-generate-trip.ts` (per-day `deriveForcedSlots`, not just Day 1)
- `supabase/functions/generate-itinerary/venue-enrichment.ts` (tag adventure venues)

## Verification
- After regen, a Rome trip with Adventure +5 should include at least one Vespa/e-bike/kayak/catacombs-tour/climbing-style activity within the first 3 days; no all-park/fountain itineraries.
- Adventure +7 should produce ≥2 kinetic activities across the trip.
- Pace and budget behavior remains unchanged.

The user should tap "Refresh Day" or regenerate the trip after these changes apply.
