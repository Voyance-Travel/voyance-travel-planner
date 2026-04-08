

# Fix: Duplicate Transport/Hotel Cards + Runtime Crashes

## Problem Summary

Three interrelated issues are degrading itinerary quality:

1. **Duplicate transport cards** — consecutive "Travel to X" → "Travel to Y" cards with no activity at X between them
2. **Duplicate hotel returns** — multiple "Return to Your Hotel" cards on the same day (one with `category: 'activity'`, another with `category: 'accommodation'`)
3. **Runtime crash in repair-costs** — `TypeError: ALWAYS_FREE_VENUE_PATTERNS.test is not a function` because `ALWAYS_FREE_VENUE_PATTERNS` is a `RegExp[]` array but callers invoke `.test()` on it as if it were a single `RegExp`

## Root Causes

**Duplicate hotels**: The hotel return dedup in `universal-quality-pass.ts` (line 302) only catches activities with `category === 'accommodation'`. When the AI generates a "Return to Your Hotel" with `category: 'activity'`, it escapes the filter. Then `repairBookends` (repair-day.ts) injects another return because it doesn't see a valid end-of-day return — creating a duplicate.

**Duplicate transports**: The repair pipeline's `repairBookends` injects transport+hotel cards (step 2, line 2985–2986) AFTER the consecutive transport consolidation (step 4/9e) has already run. The newly injected transports can create back-to-back transport sequences that no subsequent pass cleans up.

**ALWAYS_FREE_VENUE_PATTERNS crash**: The constant was changed from a single `RegExp` to a `RegExp[]` array, but two callers still call `.test()` directly on it:
- `action-repair-costs.ts` line 138
- `generation-core.ts` line 3129

## Implementation Plan

### 1. Fix `ALWAYS_FREE_VENUE_PATTERNS.test()` crash (2 files)

**`action-repair-costs.ts`** (~line 138):
- Change `ALWAYS_FREE_VENUE_PATTERNS.test(allText)` → `ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test(allText))`

**`generation-core.ts`** (~line 3129):
- Same fix: `ALWAYS_FREE_VENUE_PATTERNS.test(allActivityText)` → `ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test(allActivityText))`

### 2. Broaden hotel return dedup (1 file)

**`universal-quality-pass.ts`** (~line 295–316):
- Remove the `cat === 'accommodation'` requirement from the hotel return dedup
- Match purely by title pattern (`hotelReturnRe`) regardless of category
- This ensures "Return to Your Hotel" with `category: 'activity'` is also caught

### 3. Add final consecutive-transport safety net (2 files)

**`action-generate-day.ts`** (after repair pipeline, before persist ~line 1117):
- Add a final pass that collapses any remaining back-to-back transport cards
- Merge consecutive transports: keep "from" of the first and "to" of the last

**`action-generate-trip-day.ts`** (equivalent location after repair):
- Same safety net for the trip-day orchestrator path

### 4. Recategorize mismatched hotel returns (1 file)

**`universal-quality-pass.ts`** (in the dedup block):
- When a "Return to Your Hotel" activity has a non-accommodation category, fix its category to `'accommodation'` before dedup runs
- This prevents `repairBookends` from thinking no end-of-day return exists

## Files to Modify

| File | Change |
|------|--------|
| `action-repair-costs.ts` | Fix `.test()` on array |
| `generation-core.ts` | Fix `.test()` on array |
| `universal-quality-pass.ts` | Broaden hotel return dedup + recategorize |
| `action-generate-day.ts` | Add post-repair transport consolidation |
| `action-generate-trip-day.ts` | Add post-repair transport consolidation |

