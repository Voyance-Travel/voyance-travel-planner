

# Phase 4: Extract Prompt Construction

## Goal

Extract the ~930 lines of prompt assembly (lines 317–1260) from `action-generate-day.ts` into `pipeline/compile-prompt.ts`. This is the largest remaining block in the monolith. After this, the main file becomes a thin orchestrator: compile facts → compile schema → compile prompt → AI call → parse → enrich → validate/repair → persist → respond.

## What lives in these lines today

| Block | Lines | Description |
|-------|-------|-------------|
| Preference context | 317-333 | `getLearnedPreferences`, `getUserPreferences`, `buildPreferenceContext` |
| Trip intents | 335-348 | Query `trip_intents` table |
| Must-do parsing & scheduling | 350-450 | `parseMustDoInput`, `scheduleMustDos`, prompt construction |
| Interest categories | 452-461 | Category label mapping |
| Generation rules | 463-467 | `formatGenerationRules` |
| Visitor type + pacing | 469-478 | Static prompt blocks |
| Must-haves + pre-booked | 480-512 | Checklist and commitment analysis |
| Additional notes | 518-543 | Trip purpose injection |
| Timing instructions | 570-694 | First day / last day / regular day meal policy + structure |
| Transition day override | 700-725 | `buildTransitionDayPrompt` |
| Profile + archetype | 727-950 | `loadTravelerProfile`, generation context read, budget, blended traits, archetype guidance |
| Voyance Picks | 952-973 | DB query + prompt |
| Collaborator attribution | 975-1053 | DB query + prompt |
| System prompt assembly | 1055-1126 | Final concatenation |
| User prompt assembly | 1128-1260 | User-facing prompt with budget, meal rules, skip list, restaurant pool |

All of this is prompt string construction. Some parts need DB queries (trip intents, Voyance Picks, collaborators), making the function async.

## New file: `pipeline/compile-prompt.ts`

Single exported function:

```typescript
export async function compilePrompt(
  supabase: any,
  userId: string,
  params: CompilePromptInput,
): Promise<CompiledPrompt>
```

**Input** (`CompilePromptInput`): Bundles the data already available from `compileDayFacts` + `compileDaySchema` plus raw request params (tripId, dayNumber, travelers, budgetTier, preferences, previousDayActivities, etc.).

**Output** (`CompiledPrompt`):
```typescript
interface CompiledPrompt {
  systemPrompt: string;
  userPrompt: string;
  // Extracted side-effects needed by post-processing
  mustDoEventItems: ScheduledMustDo[];
  dayMealPolicy: MealPolicy;
  lockedActivities: LockedActivity[];
  allUserIdsForAttribution: string[];
  actualDailyBudgetPerPerson: number | null;
  profile: UnifiedTravelerProfile;
  effectiveBudgetTier: string;
  isSmartFinish: boolean;
}
```

The function does all DB queries (trip intents, Voyance Picks, collaborators, budget, generation context) and string assembly internally. Returns the final prompt pair plus metadata needed by downstream post-processing.

## Changes to `action-generate-day.ts`

Replace lines ~317–1260 with:

```typescript
const prompt = await compilePrompt(supabase, userId, {
  facts, schema, params, metadata, /* ... */
});
const { systemPrompt, userPrompt, mustDoEventItems, dayMealPolicy, ... } = prompt;
```

Net reduction: ~900 lines.

## Changes to `pipeline/types.ts`

Add `CompilePromptInput` and `CompiledPrompt` interfaces.

## What does NOT change

- `prompt-library.ts` — still called by `compilePrompt`, not modified
- `meal-policy.ts` — still called by `compilePrompt`, not modified
- `archetype-data.ts` — still called by `compilePrompt`, not modified
- All other pipeline modules — untouched
- Post-processing blocks (enrichment, opening hours, must-do backfill, persist, etc.) — stay in `action-generate-day.ts` for now

## Execution order

1. Add `CompilePromptInput` and `CompiledPrompt` types to `pipeline/types.ts`
2. Create `pipeline/compile-prompt.ts` — extract all prompt assembly logic
3. Wire into `action-generate-day.ts` — replace ~900 lines with single call
4. Update `.lovable/plan.md`

## Risk

**Medium-low.** Pure extraction of string concatenation + DB reads. The prompt strings must be identical. Any difference surfaces immediately as changed AI behavior. The side-effect data (mustDoEventItems, profile, etc.) that post-processing depends on is returned explicitly in `CompiledPrompt`.

## After Phase 4

The monolith drops from ~2,900 to ~2,000 lines. Remaining blocks are:
- AI call + retry (~200 lines) — could become `pipeline/ai-call.ts`
- Parse + normalize (~80 lines)
- Enrichment + opening hours (~300 lines) — I/O, stays or becomes `pipeline/enrich.ts`
- Must-do backfill + transition fallback (~310 lines) — deterministic, could fold into repair
- DB persistence (~230 lines) — could become `pipeline/persist-day.ts`
- Post-generation guarantees (~410 lines) — most should fold into repair

