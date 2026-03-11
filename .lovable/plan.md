

## Fix 22F: Edge Function Schema Compiler Copies

### Overview
Copy all 14 schema compiler files into `supabase/functions/generate-itinerary/schema/` with `@/` imports rewritten to relative `.ts` paths for Deno compatibility. Update the feature flag branch in `index.ts` to import from `./schema/index.ts` instead of the placeholder comment.

### Files to Create (15)

All files in `supabase/functions/generate-itinerary/schema/`:

| File | Source | Import rewrites needed |
|------|--------|----------------------|
| `types.ts` | `src/types/schema-generation.ts` | None (no imports) |
| `pattern-group-configs.ts` | `src/config/pattern-group-configs.ts` | `@/types/schema-generation` → `./types.ts` |
| `archetype-group-mapping.ts` | `src/config/archetype-group-mapping.ts` | `@/types/schema-generation` → `./types.ts` |
| `feature-flags.ts` | `src/config/feature-flags.ts` | None (no imports) |
| `day-skeletons.ts` | `src/lib/schema-compiler/day-skeletons.ts` | `@/types/schema-generation` → `./types.ts` |
| `dna-modifiers.ts` | `src/lib/schema-compiler/dna-modifiers.ts` | `@/types/schema-generation` → `./types.ts` |
| `constraint-filler.ts` | `src/lib/schema-compiler/constraint-filler.ts` | `@/types/schema-generation` → `./types.ts`, `./compile-day-schema` → `./compile-day-schema.ts` |
| `conflict-resolver.ts` | `src/lib/schema-compiler/conflict-resolver.ts` | `@/types/schema-generation` → `./types.ts` |
| `time-parser.ts` | `src/lib/schema-compiler/time-parser.ts` | None (no imports) |
| `must-do-filler.ts` | `src/lib/schema-compiler/must-do-filler.ts` | `@/types/schema-generation` → `./types.ts`, `@/config/feature-flags` → `./feature-flags.ts`, `./time-parser` → `./time-parser.ts` |
| `schema-to-prompt.ts` | `src/lib/schema-compiler/schema-to-prompt.ts` | `@/types/schema-generation` → `./types.ts`, `@/config/pattern-group-configs` → `./pattern-group-configs.ts` |
| `schema-validator.ts` | `src/lib/schema-compiler/schema-validator.ts` | `@/types/schema-generation` → `./types.ts` |
| `generation-logger.ts` | `src/lib/schema-compiler/generation-logger.ts` | `@/types/schema-generation` → `./types.ts` |
| `compile-day-schema.ts` | `src/lib/schema-compiler/compile-day-schema.ts` | `@/types/schema-generation` → `./types.ts`, `@/config/pattern-group-configs` → `./pattern-group-configs.ts`, `@/config/archetype-group-mapping` → `./archetype-group-mapping.ts`, all local `./xyz` → `./xyz.ts` |
| `index.ts` | New re-export barrel | All exports with `.ts` extensions |

Every file gets a comment header: `// EDGE FUNCTION COPY — Source of truth is in src/`

All relative imports use `.ts` extension (Deno requirement).

### File to Update (1)

**`supabase/functions/generate-itinerary/index.ts`** (lines 7976-8008)
- Remove the `const USE_SCHEMA_GENERATION = false;` inline declaration
- Add import at the top of the feature flag block: `import { USE_SCHEMA_GENERATION, SCHEMA_GENERATION_CONFIG } from './schema/index.ts';`
- The flag value still comes from `schema/feature-flags.ts` which defaults to `false`
- Keep the rest of the branch logic identical

### What does NOT change
- No `src/` files modified
- Feature flag remains `false` — no runtime behavior change
- No generation logic changes
- No UI changes

