## Wire Secondary Archetype Into Generation Prompt

The existing system already passes `secondaryArchetype` through `context.travelerDNA` (confirmed at line 2957) but never references it when assembling the per-day prompt. Today only the primary feeds `buildAllConstraints`, `buildExperienceGuidancePrompt`, and `buildDestinationGuidancePrompt`. Result: secondary is cosmetic.

### Change

File: `supabase/functions/generate-itinerary/generation-core.ts`

1. Just after the `archetypeDefinition` lookup (around line 792), resolve the secondary:
   ```ts
   const secondaryArchetype = context.travelerDNA?.secondaryArchetype;
   const secondaryArchetypeDef = secondaryArchetype && secondaryArchetype !== context.travelerDNA?.primaryArchetype
     ? getArchetypeDefinition(secondaryArchetype)
     : null;
   ```
   Guard against the secondary equalling the primary so we don't double-count.

2. Build a `secondaryFlavor` string using the existing `ArchetypeDefinition` shape (`name`, `identity`):
   ```ts
   const secondaryFlavor = secondaryArchetypeDef
     ? `\n\nSECONDARY DNA: ${secondaryArchetypeDef.name} — ${secondaryArchetypeDef.identity}.\n` +
       `Across the full trip, include 1–2 activities or moments that lean into this secondary identity. ` +
       `Treat it as subtle seasoning, never as a contradiction to the primary archetype's day structure, variety caps, or avoid list. ` +
       `Example: primary=Luxury Luminary + secondary=Story Seeker → mostly curated high-end experiences, but swap one Michelin night for an "underground jazz bar locals know."`
     : '';
   ```

3. Append `secondaryFlavor` to the `generationHierarchy` template (line 828–883) — adding it after `${destinationGuidancePrompt}` keeps it adjacent to the archetype-shaping block that already lands in the system prompt at line 895.

That's the entire change. No new imports, no signature changes, no edits to `archetype-constraints.ts` or downstream pipeline. `getArchetypeDefinition` already returns a default for unknown slugs, so this is null-safe via the explicit guard above.

### Verification

- `grep -n "SECONDARY DNA" supabase/functions/generate-itinerary/generation-core.ts` returns the new block.
- Generate a trip for a profile with primary=`luxury_luminary`, secondary=`story_seeker`. Inspect `edge_function_logs` for `generate-itinerary` (or `action-generate-trip-day`) and confirm `SECONDARY DNA: …` appears in the system prompt payload.
- Inspect the resulting itinerary: at least one evening should be a "local discovery" type rather than a second Michelin meal.
- Sanity test with no secondary (or secondary === primary) — prompt unchanged, no empty `SECONDARY DNA:` header leaks into the model context.
