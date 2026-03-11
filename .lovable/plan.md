

## Fix 22D: Schema-Driven Post-Generation Validation

### Overview
Create two new standalone files in `src/lib/schema-compiler/` and update the index exports. No existing files modified. All code is dead/unused until the feature flag is enabled.

### Files to Create (2)

**1. `src/lib/schema-compiler/schema-validator.ts`**
- `validateAgainstSchema(schema: DaySchema, aiActivities: AiActivity[]) → ValidationResult`
- 8 validation checks: slot count, filled slot integrity, time window compliance, duration compliance, meal presence, group attribution, gap detection, category diversity
- Auto-corrects low-severity issues (locked slot modifications restored, missing suggestedFor backfilled)
- Returns `{ passed, validations, overrides, severity, summary, correctedActivities }`
- Imports only from `@/types/schema-generation`

**2. `src/lib/schema-compiler/generation-logger.ts`**
- `buildGenerationLog(params) → DayGenerationLog` — structured audit trail
- `formatLogForConsole(log) → string` — human-readable debug output
- Imports only from `@/types/schema-generation`

### File to Update (1)

**`src/lib/schema-compiler/index.ts`** — Add exports for validator and logger:
- `validateAgainstSchema`, `ValidationResult`, `AiActivity`
- `buildGenerationLog`, `formatLogForConsole`

### Isolation
- Zero modifications to existing generation or post-processing code
- Zero runtime impact — nothing calls these functions
- All imports restricted to `@/types/schema-generation`

