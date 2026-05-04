## Problem

For luxury food audiences (Luxury Luminary, Culinary Cartographer, VIP Voyager, or `foodie + luxury` budget), Day 1 frequently lands two bistro-tier meals (lunch + dinner both €30–€50/pp). The arrival day is the "Grand Entrance" — at least the dinner should be elevated. Today nothing in `compile-day-schema.ts` tells the model that Day 1 dinner is special, so the dining-config Michelin policy gets "spent" later in the trip.

## Fix

Add a **Day 1 "Grand Entrance" dinner directive** that's injected into the existing arrival prompts in `compile-day-schema.ts`, gated on the dining config the trip already resolves.

### 1. New helper — `buildGrandEntranceBlock`
File: `supabase/functions/generate-itinerary/dining-config.ts`

```ts
export function buildGrandEntranceBlock(
  config: DiningConfig,
  destination: string,
): string | null {
  if (config.michelinPolicy !== 'required' && config.michelinPolicy !== 'encouraged') return null;
  const [, dinnerHi] = config.priceRange.dinner;
  return `
🌟 DAY 1 "GRAND ENTRANCE" DINNER — REQUIRED:
This traveler's first dinner sets the tone for the trip. It MUST be an elevated, destination-defining restaurant, NOT a casual bistro/brasserie.
- Choose a Michelin-starred room, palace-hotel dining room, or an iconic chef-led restaurant in ${destination}
- Target price: €${Math.round(dinnerHi * 0.7)}–€${dinnerHi}/pp (tasting menu or chef-driven prix fixe)
- Do NOT pick neighborhood bistros, steak-frites houses, or "authentic local" casual spots for THIS dinner
- If lunch on Day 1 is already casual/bistro, the dinner MUST compensate by being elevated
- Reservation note: flag as "Book 2–4 weeks ahead"`;
}
```

### 2. Inject into Day 1 arrival prompts
File: `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts`

Resolve dining config once at the top of the `isFirstDay` branch (the tier + archetype are already in `input` — pass them through `DaySchemaInput` if not already there; they live on the trip context used to call `compileDaySchema`). Append the Grand Entrance block to `dayConstraints` for every Day 1 sub-branch that schedules a dinner: morning arrival (with/without hotel), afternoon arrival (with/without hotel), no-flight + hotel, no-flight + no-hotel. Skip for evening arrival (dinner is already optional + traveler exhausted) and skip for the all-day-event branch.

### 3. Pair-aware guard in universal quality pass
File: `supabase/functions/generate-itinerary/universal-quality-pass.ts`

After the existing Day 1 passes, add a check: if `tier === 'Curator' || archetype ∈ {Luxury Luminary, Culinary Cartographer, VIP Voyager}` AND Day 1 lunch + dinner are both ≤ the lunch price-range midpoint, log a `low_priority` warning ("Day 1 dining tier mismatch") and tag the dinner activity with `needs_elevation: true`. The repair pass already rewrites flagged dinners, so this gives the existing repair loop a single deterministic signal instead of duplicating the prompt logic.

### 4. Editorial copy
When the Grand Entrance dinner is rendered in `EditorialItinerary.tsx`, prefix the description with "Your Grand Entrance dinner — " for Day 1 only when the activity carries the `grand_entrance` tag (set by the generator from the new prompt block). No layout change; pure string prefix.

## Out of scope
- Re-pricing existing trips — change applies on next regeneration / Day 1 refresh.
- Changing lunch tier (lunch can stay "authentic Paris"; the pairing problem is solved by elevating only dinner).
- Budget/Value tier travelers — they keep current behavior.

## Files to edit
- `supabase/functions/generate-itinerary/dining-config.ts` — add `buildGrandEntranceBlock`
- `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts` — inject block into Day 1 branches
- `supabase/functions/generate-itinerary/pipeline/types.ts` — add `tier` + `archetype` to `DaySchemaInput` if missing
- `supabase/functions/generate-itinerary/action-generate-day.ts` — pass tier/archetype when calling `compileDaySchema`
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — pair-aware guard
- `src/components/itinerary/EditorialItinerary.tsx` — Grand Entrance description prefix

Approve to implement?