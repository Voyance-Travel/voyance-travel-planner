

# Phase 7: Cleanup, Update Plan, and End-to-End Testing

## Step 1: Update `plan.md` — fix stale "Remaining Blocks" table

Replace the outdated table (lines 55-68) with the current state. The AI call and enrichment rows are gone; the remaining blocks reflect the actual 1,036-line orchestrator:

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

Add a summary line: orchestrator is at 1,036 lines, pipeline refactor is functionally complete.

## Step 2: Run smoke tests on all edge functions with test files

Run `supabase--test_edge_functions` for all 8 test files to verify nothing is broken after the refactor:

- `generate-itinerary` (20 tests — the main target)
- `chat-trip-planner`
- `calculate-travel-dna`
- And the other 5 test files

Any test returning 500 indicates a runtime crash introduced by the refactor.

## Step 3: Check deploy logs for errors

If any tests fail with 500, inspect edge function logs to identify the root cause (missing imports, undefined variables, etc.) and fix.

## Scope

- No new modules or extractions — this is cleanup and verification only
- The must-do overlap and transition day blocks stay in the orchestrator (they work, they're complex, and extracting them has diminishing returns)

