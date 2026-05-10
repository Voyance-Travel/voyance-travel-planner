## Status: Already Implemented — No Changes Required

The secondary-archetype flavoring feature is fully present in `supabase/functions/generate-itinerary/generation-core.ts` and reaches the LLM system prompt.

### Existing implementation

**Lines 799–802** — secondary archetype resolution (with self-equality guard so an accidentally-duplicated primary doesn't double-flavor):
```ts
const secondaryArchetypeSlug = context.travelerDNA?.secondaryArchetype;
const secondaryArchetypeDef = secondaryArchetypeSlug && secondaryArchetypeSlug !== context.travelerDNA?.primaryArchetype
  ? getArchetypeDefinition(secondaryArchetypeSlug)
  : null;
```

**Lines 803–808** — flavor block matching the requested copy (name, identity, "1–2 activities", "subtle seasoning, never a contradiction", Luxury Luminary × Story Seeker example):
```ts
const secondaryFlavor = secondaryArchetypeDef
  ? `\n\nSECONDARY DNA: ${secondaryArchetypeDef.name} — ${secondaryArchetypeDef.identity}.\n` +
    `Across the full trip, include 1–2 activities or moments that lean into this secondary identity. ` +
    `Treat it as subtle seasoning, never as a contradiction to the primary archetype's day structure, variety caps, or avoid list. ` +
    `Example: primary=Luxury Luminary + secondary=Story Seeker → mostly curated high-end experiences, but swap one Michelin night for an "underground jazz bar locals know."`
  : '';
```

**Line 895** — `${secondaryFlavor}` interpolated into `generationHierarchy`.

**Line 908** — `generationHierarchy` interpolated into the final `systemPrompt` sent to the LLM (line 906).

### Minor naming deltas vs. the spec (intentional, keep as-is)

- `secondaryArchetypeSlug` instead of `secondaryArchetype` — avoids shadowing the optional context field
- Self-equality guard `slug !== primaryArchetype` — prevents nonsensical "secondary = primary" flavor
- Em-dash format `Name — identity` instead of split lines — same content

### Verification (no code change needed)

- `rg -n "SECONDARY DNA|secondaryFlavor" supabase/functions/generate-itinerary/generation-core.ts` already returns 2 hits (definition + interpolation)
- `secondaryFlavor` reaches the system prompt via: `secondaryFlavor` → `generationHierarchy` (line 895) → `systemPrompt` (line 908)
- Manual QA: generate a Luxury Luminary + Story Seeker trip and confirm 1–2 underground/local-tip moments appear; check edge function logs for the literal string `SECONDARY DNA:` in the prompt

### Recommendation

Close this task as a no-op. If the user wants to expand the feature (e.g., make it stronger, log a sentinel, or add it to the day-level prompt as well), that's a separate change to scope.