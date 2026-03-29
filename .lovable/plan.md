
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

## Remaining Blocks in `action-generate-day.ts`

| Block | ~Lines | Notes |
|-------|--------|-------|
| AI call + retry | ~170 | Could extract to `pipeline/ai-call.ts` |
| Parse + normalize | ~80 | Inline, tightly coupled to AI response shape |
| Locked activity merge + semantic dedup | ~45 | Inline |
| Enrichment + opening hours | ~200 | I/O-heavy, depends on Google Maps API |
| Auto route optimization | ~12 | Inline |
| Must-do event overlap + backfill | ~170 | Inline |
| Transition day assembly | ~130 | Inline |
| Pipeline validate + repair call | ~70 | Already wired to pipeline |
| Attribution backfill | ~20 | Inline |
| Meal final guard | ~75 | Inline, needs DB |

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
