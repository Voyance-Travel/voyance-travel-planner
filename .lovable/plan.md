

## Fix 22C: Prompt Serializer & Feature Flag

### Overview
Create the schema-to-prompt serializer, a local feature flag config, and add a single if/else branch in the edge function's generate-day path. The flag defaults to OFF — existing behavior is unchanged.

### Critical Architecture Issue
The schema compiler lives in `src/lib/schema-compiler/` but the generation runs in `supabase/functions/generate-itinerary/index.ts` (Deno edge function). Edge functions **cannot import from `src/`**. The prompt specifies this: "put a copy of the schema-compiler and types in the supabase functions directory."

**Solution:** Create mirror copies of the needed modules inside `supabase/functions/generate-itinerary/` as standalone files. The feature flag will be a simple const inside the edge function (not imported from `src/config/`).

### Files to Create (3)

**1. `src/lib/schema-compiler/schema-to-prompt.ts`** — The serializer (for frontend/testing use)
- `serializeSchemaToPrompt(schema, context) → { systemPrompt, userPrompt, estimatedTokens }`
- Builds 6 focused system prompt sections (Role, Traveler Profile, Destination, Budget, Slot Filling Rules, Archetype Instructions) + surviving sections (booking, tips, personalization, hidden gems)
- User prompt serializes each slot as FILLED/LOCKED or EMPTY/FILL-THIS with time windows and instructions
- Imports only from `@/types/schema-generation` and `@/config/pattern-group-configs`

**2. `src/lib/schema-compiler/index.ts`** — Update exports to include serializer

**3. `src/config/feature-flags.ts`** — Local feature flag file
- `USE_SCHEMA_GENERATION = false`
- `SCHEMA_GENERATION_CONFIG` with `logSchemas`, `shadowMode`, timing defaults

### Edge Function Changes (1 file)

**`supabase/functions/generate-itinerary/index.ts`** — Single if/else branch

The branch point is at **line ~7976** (after systemPrompt and userPrompt are assembled, before the AI call at line ~7992). The insertion:

1. Add a `USE_SCHEMA_GENERATION = false` const near the top of the file (cannot import from `src/config/`)
2. Wrap the existing AI call block in the `else` branch
3. The `if` branch would: build `CompilerInput` from existing variables → compile schema → serialize to prompts → use those prompts instead
4. Since the flag is `false`, the `if` block is dead code — but it establishes the wiring point for Fix 22D/E

**Key variable mappings** (from existing code at lines ~6288-7974):
- `dayNumber` → `compilerInput.dayNumber`
- `totalDays` → `compilerInput.totalDays`  
- `resolvedDestination` → `compilerInput.destination`
- `date` → `compilerInput.date`
- `primaryArchetype` → `compilerInput.archetypeName`

Since the flag is `false` and the edge function can't import `src/` modules, the simplest approach is:
- Add the flag const + a commented-out schema path placeholder in the edge function
- Create the full serializer in `src/lib/schema-compiler/` for future use
- The actual wiring (copying compiler into edge function dir) happens in Fix 22D when we activate it

This keeps Fix 22C truly inert while establishing the code structure.

### No Other Changes
- No modifications to existing prompt-building code
- No changes to the AI call, tool schema, or response handling
- No UI changes
- Existing generation works exactly as before

