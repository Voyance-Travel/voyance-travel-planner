
On Day 1 for luxury food archetypes the LLM currently produces: arrival → hotel freshen-up → one cultural stop (Petit Palais) → lunch → spa → dinner. There's no second iconic / sensory "you-are-in-Paris" moment. The Grand Entrance Dinner directive already covers the dinner; this fix adds a sibling **"Grand Entrance Afternoon Anchor"** directive so Day 1 has at least one additional iconic experiential beat between the museum and dinner.

## Fix

### 1. Add a sibling prompt block in `dining-config.ts`

New exported function `buildArrivalCulturalAnchorBlock(config, destination)`:
- Returns `null` unless `michelinPolicy === 'required' || 'encouraged'` (same gate as Grand Entrance Dinner — these are the luxury food tiers).
- Returns a directive that mandates **one additional 60–90 min iconic cultural/sensory experience** scheduled in late afternoon (≈16:00–18:30), between any spa/freshen-up and dinner. Examples to suggest (destination-aware where practical, but framed as archetypes the LLM picks venues for):
  - "Sunset stroll along an iconic waterway (Seine, Tagus, Thames…)"
  - "Champagne or rooftop-bar toast at a landmark hotel/terrace"
  - "Quick visit to a flagship cultural building open late (Grand Palais, Centre Pompidou-equivalent, gallery district walk)"
  - "Golden-hour viewpoint walk (Trocadéro, Pincio, Hampstead Heath…)"
- Tag requirement: `tags: ["arrival_anchor"]`.
- Hard rules: must NOT replace lunch or dinner; must be a real named venue (no placeholders); cost reasonable (free–€60/pp); explicitly does NOT count as the third meal.

### 2. Wire it in `pipeline/compile-prompt.ts`

Right after the existing Grand Entrance Dinner injection (line 990), call the new builder with the same gate and append its block to `timingInstructions`:
```ts
const anchor = buildArrivalCulturalAnchorBlock(diningConfig, resolvedDestination || destination || '');
if (anchor) {
  timingInstructions = `${timingInstructions}\n${anchor}\n`;
  console.log(`[compile-prompt] Day 1 Arrival Cultural Anchor injected`);
}
```

### 3. Soft post-gen guard in `universal-quality-pass.ts`

Right after Step 7b (Grand Entrance dinner check, line 233):
- Only when `dayIndex === 0` AND `isLuxuryFood` AND policy is required/encouraged.
- Count Day 1 non-meal experiential activities — categories in `{ATTRACTION, CULTURE, MUSEUM, OUTDOOR, ENTERTAINMENT, SIGHTSEEING, NIGHTLIFE}`.
- If `< 2`, log a warning and append a synthetic activity-level tag on the day metadata (`(result as any).__missingArrivalAnchor = true`) so the repair pass can later prompt-augment a regen. **Do not** insert a fake card client-side (we have no real venue lookup here, and inventing one violates the "no placeholders" mandate).
- This soft signal mirrors the existing `needs_elevation` pattern; cheaper than adding a full repair path right now and matches how Grand Entrance Dinner shipped.

### 4. Memory

Update `mem://features/itinerary/grand-entrance-dinner` (rename in body to "Grand Entrance Day 1") to also describe the afternoon anchor as a sibling rule under the same gate.

## Out of scope

- No new repair-day venue insertion. The directive runs at generation time; existing trips don't auto-heal.
- No archetype recalibration; only the existing luxury food tiers (Curator, Luxury Luminary, Culinary Cartographer, VIP Voyager) are affected.
- Petit Palais and the chosen lunch/dinner are untouched — we only ensure a 2nd cultural beat exists.

## Files touched

- `supabase/functions/generate-itinerary/dining-config.ts` — add `buildArrivalCulturalAnchorBlock`
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — wire anchor block into Day 1 directive
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — soft `__missingArrivalAnchor` flag
- `mem://features/itinerary/grand-entrance-dinner` — note the new sibling rule

Approve?
