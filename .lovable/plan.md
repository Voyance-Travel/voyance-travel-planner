
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

## Remaining Blocks in `action-generate-day.ts`

| Block | ~Lines | Candidate module |
|-------|--------|-----------------|
| AI call + retry | ~200 | `pipeline/ai-call.ts` |
| Parse + normalize | ~80 | inline or `pipeline/parse-response.ts` |
| Enrichment + opening hours | ~300 | `pipeline/enrich.ts` |
| Must-do backfill + transition fallback | ~310 | fold into repair |
| DB persistence | ~230 | `pipeline/persist-day.ts` |
| Post-generation guarantees | ~410 | fold into repair |

## Next Phase (Phase 5 — not started)

Extract AI call + retry logic into `pipeline/ai-call.ts`, and DB persistence into `pipeline/persist-day.ts`. These are the two cleanest remaining extractions.
