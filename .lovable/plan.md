# Honor Authenticity (+3 Local Explorer) in Itinerary Generation

## The Bug

The Authenticity slider mostly does nothing at +3:

- `deriveForcedSlots` only fires the `authentic_encounter` slot when `authenticity >= 4`. A +3 Local Explorer never triggers it.
- `buildAllConstraints` knows `pace`, `budget`, and (now) `adventure` — but not `authenticity`. There is no "Local Explorer Mode" prompt block.
- `effectiveTraitScores` in `compile-prompt.ts` doesn't carry `authenticity`, so even if downstream code wanted to use it, it isn't propagated.
- No blacklist of postcard-tourism venues (Trevi Fountain, Spanish Steps, Colosseum-only photo stops, La Pergola-tier luxury tourist destinations) for high-authenticity travelers — the model defaults to "famous = good".

Result: Rome itineraries with Authenticity +3 mix one or two genuine local picks with a wall of standard tourist beats.

## What to Build

### 1. Lower threshold and tier the forced slot
In `personalization-enforcer.ts > deriveForcedSlots`:
- Trigger `authentic_encounter` at `authenticity >= 3` (not 4).
- `>= 3` (Local Explorer): require **1 truly local experience per day** (neighborhood trattoria, local wine bar, non-tourist piazza, family-run venue).
- `>= 6` (Local-Only): require **2 local experiences per day** AND forbid more than **1 famous landmark per day**.
- Tighten validationTags: prefer `neighborhood`, `family-run`, `non-touristy`, `enoteca`, `osteria`, `trattoria` — drop generic `local` which the model satisfies trivially.

### 2. Propagate `authenticity` through the pipeline
- Extend `effectiveTraitScores` in `compile-prompt.ts` to include `authenticity` (mirror the recent `adventure` change: read `blendedTraitScores.authenticity ?? traitScores.authenticity ?? 0`).
- Update signatures: `getFullArchetypeContext`, `buildFullPromptGuidance(Async)`, `buildAllConstraints` to accept optional `authenticity` in their `traits` arg.
- In `generation-core.ts`, pass `traits.authenticity || 0` into `buildAllConstraints`.

### 3. Prompt-level "Local Explorer Mode"
Add `buildAuthenticityRules(authenticity, destination)` in `archetype-constraints.ts`, called from `buildAllConstraints` (after adventure rules):

- `>= 3`:
  - At least 1 venue per day in a residential/non-tourist neighborhood (e.g. Rome: Testaccio, Pigneto, Garbatella, Monti, Quadraro, Trastevere back-streets — NOT around Trevi, Spanish Steps, Piazza Navona).
  - Meals heavily skew family-run trattorias / osterias / enoteche; ban hotel restaurants, chain Michelin destinations like La Pergola, and "tourist menu" spots near major landmarks.
  - Allow at most ONE postcard landmark per day; pair it with a deep local follow-up (e.g. Colosseum → lunch in Monti at Mordi e Vai or aperitivo in Rione Monti).
- `>= 6`:
  - Hard cap: maximum 1 marquee landmark across the WHOLE TRIP.
  - Forbidden venues (city-aware): Rome → Trevi Fountain, Spanish Steps, Piazza Navona day visits, La Pergola, Cavalieri/luxury hotel dining, mass-market vans/buses; Paris → Champs-Élysées dining, Eiffel Tower restaurants; Barcelona → La Rambla restaurants; etc.
- City-specific neighborhood and venue lists for the top destinations (Rome, Paris, Barcelona, London, Tokyo, NYC, Lisbon, Mexico City).
- Tagging requirement: each "local" activity must include one of `neighborhood`, `family-run`, `osteria`, `trattoria`, `enoteca`, `non-touristy` in `personalization.tags`.

### 4. Validation reminder
Append rule #11 to the "VALIDATION BEFORE FINALIZING" checklist in `buildAllConstraints`:
> 11. Authenticity ≥ +3 — does this day include a real neighborhood/family-run venue and stay under the landmark cap? → If not, swap a tourist beat for a local one.

### 5. (Optional) Soft post-gen warning
In the existing repair pipeline, surface a non-blocking log when an `authenticity >= 3` trip contains > N landmarks per day or no `neighborhood`-tagged activity. Logging only — repair stays prompt-driven (matches how adventure is handled).

## Files to Modify
- `supabase/functions/generate-itinerary/personalization-enforcer.ts`
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- `supabase/functions/generate-itinerary/archetype-constraints.ts` (new `buildAuthenticityRules`, updated `buildAllConstraints`)
- `supabase/functions/generate-itinerary/archetype-data.ts` (signature update only)
- `supabase/functions/generate-itinerary/generation-core.ts` (pass `authenticity` into `buildAllConstraints`)

## Verification
- A Rome trip with Authenticity +3 should:
  - Include ≥1 trattoria/osteria/enoteca per day in Testaccio/Monti/Pigneto/Trastevere-back-streets/Garbatella.
  - Contain at most 1 postcard landmark per day (no Trevi+Spanish Steps+Pantheon stacked).
  - Replace La Pergola-style tourist-luxury dining with a local fine-dining alternative (e.g. SantoPalato, Trattoria Pennestri, Armando al Pantheon).
- Authenticity +6 should produce ≤1 marquee landmark across the whole trip.
- Other traits (pace, adventure, budget) behavior remains unchanged.

The user should tap "Refresh Day" after these changes apply, or regenerate the trip for the cleanest result.
