
# Pipeline Refactor — Status

## Completed Phases

### Phase 1: Types & Failure Codes ✅
Defined `pipeline/types.ts` with `FailureCode`, `ValidationResult`, `DayFacts`, `DaySchema`, `LockedActivity`, `CompiledFacts`, `CompiledSchema`, etc.

### Phase 2: Compile Facts & Schema ✅
Extracted `pipeline/compile-day-facts.ts` and `pipeline/compile-day-schema.ts`. ~400 lines moved out of the monolith.

### Phase 3: Validate & Repair ✅
Created `pipeline/validate-day.ts` and `pipeline/repair-day.ts` for structured post-processing.

### Phase 4: Extract Prompt Construction ✅
Extracted ~930 lines of prompt assembly into `pipeline/compile-prompt.ts`. Added `CompilePromptInput` and `CompiledPrompt` types. Removed ~160 lines of dead imports. Monolith dropped from ~2,900 to ~1,780 lines.

### Phase 5: Bug Fixes + Final Extraction ✅

**Part A — Fixed 3 broken variables:**
- `itineraryDayId`: assigned from `dayRow.id` after upsert
- `paramHotelName`: restored in params destructure
- `action` (now `paramAction`): passed through from `index.ts` via `{ ...params, action }`

**Part B — Deduplicated post-generation guarantees (~250 lines removed):**
- Hotel check-in guarantee → repair step 9 in `repair-day.ts`
- Hotel checkout guarantee → repair step 10 in `repair-day.ts`
- Departure sequence fix (checkout/airport swap) → repair step 11 in `repair-day.ts`
- Non-flight airport strip → repair step 12 in `repair-day.ts`
- Multi-city hotel resolution pre-resolved in orchestrator, passed via `RepairDayInput`
- `repair-day.ts` stays synchronous (Option 2 from plan)

**Part C — Extracted DB persistence (~235 lines → `pipeline/persist-day.ts`):**
- Day upsert, activity insert/upsert, UUID mapping, orphan cleanup, version save
- Returns updated activities with DB UUIDs mapped back

**Result:** Monolith dropped from 1,780 → **1,361 lines** (down from original ~2,900).

### Phase 6: Extract Enrichment + Post-Processing ✅

**AI Call + Retry → `pipeline/ai-call.ts` (~219 lines):**
- Extracted model selection, retry with backoff, fallback model after 3 failures
- Error classification (429/402/5xx) with typed `AICallError` class
- Tool schema moved out of monolith into the module
- Returns structured `AICallResult` with data, usage, and model info

**Enrichment + Opening Hours → `pipeline/enrich-day.ts` (~291 lines):**
- Google Maps enrichment with time budget (25s cap)
- Batch processing (3 parallel) with budget enforcement
- Opening hours validation: confirmed closures → remove, time conflicts → shift
- Hard-constraint checks against checkout/departure activities

**Result:** Monolith dropped from 1,361 → **1,036 lines** (down from original ~2,900).

## Remaining Blocks in `action-generate-day.ts` (1,036 lines)

Pipeline refactor is **functionally complete**. The orchestrator retains blocks that are small, tightly coupled, or have diminishing extraction returns:

| Block | ~Lines | Status |
|-------|--------|--------|
| Parse + normalize | ~80 | Stays — tightly coupled to AI response |
| Locked merge + semantic dedup | ~45 | Stays — small |
| Auto route optimization | ~12 | Stays — single call |
| Must-do overlap + backfill | ~160 | Optional extraction candidate |
| Transition day assembly | ~145 | Optional extraction candidate |
| Validate + repair call | ~170 | Wired to pipeline modules |
| Persist call | ~22 | Already extracted |
| Attribution backfill | ~20 | Stays — tiny |
| Meal final guard | ~70 | Stays — needs DB, small |

**Summary:** Orchestrator reduced from ~2,900 → **1,036 lines** (~64% reduction). Eight pipeline modules now handle types, facts, schema, prompt, validation, repair, persistence, AI calls, and enrichment.

## Pipeline Module Inventory

| Module | Lines | Purpose |
|--------|-------|---------|
| `pipeline/types.ts` | 365 | Shared types |
| `pipeline/compile-day-facts.ts` | ~400 | Deterministic fact compilation |
| `pipeline/compile-day-schema.ts` | ~200 | Day schema compilation |
| `pipeline/compile-prompt.ts` | ~930 | Full prompt assembly |
| `pipeline/validate-day.ts` | 561 | Pure validation (no mutations) |
| `pipeline/repair-day.ts` | 725 | Deterministic repairs (12 steps) |
| `pipeline/persist-day.ts` | 258 | DB persistence + versioning |
| `pipeline/ai-call.ts` | 219 | AI call + retry + error handling |
| `pipeline/enrich-day.ts` | 291 | Enrichment + opening hours |
