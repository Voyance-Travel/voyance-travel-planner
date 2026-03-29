

## Audit Results: `generate-itinerary` Refactoring

### Critical Finding: Edge Function is BROKEN

The edge function logs show a **BootFailure**:
```
Identifier 'validateGeneratedDay' has already been declared
  at generation-core.ts:334:10
```

**Root Cause**: `generation-core.ts` imports from `./day-validation.ts` **twice** — once at lines 193-203 and again at lines 571-581. The second import block is a leftover from the original code that wasn't cleaned up during extraction.

### Fix

**File**: `supabase/functions/generate-itinerary/generation-core.ts`

Delete the duplicate import block at lines 570-581:
```typescript
// Day validation + deduplication extracted to ./day-validation.ts
import {
  validateGeneratedDay,
  deduplicateActivities,
  sanitizeActivityTitles,
  detectMealSlots,
  enforceRequiredMealsFinalGuard,
  isChainRestaurant,
  filterChainRestaurants,
  type DayValidationResult,
  type StrictDayMinimal,
} from './day-validation.ts';
```

This is the same set of symbols already imported at lines 193-203. The stale comment ("extracted to ./day-validation.ts") confirms it was a leftover annotation from the monolith.

### Audit of Everything Else

**Router (`index.ts` — 188 lines)**: Clean. All 12 actions dispatched correctly. Auth, rate limiting, service-role bypass, CORS — all intact.

**Action handlers**: All import their own dependencies directly. No circular or missing imports detected in:
- `action-generate-full.ts` — imports from `generation-core.ts` correctly
- `action-generate-day.ts` — imports from `day-validation.ts` directly (no duplication)
- CRUD actions (`get-trip`, `get-itinerary`, `save-itinerary`, etc.) — use `ActionContext` pattern cleanly

**Scope**: No implicit variable leaks. All handlers receive explicit parameters (`supabase`, `userId`, `params` or `ActionContext`).

### Summary

| Issue | Severity | Status |
|---|---|---|
| Duplicate import in `generation-core.ts` | **P0 — function won't boot** | Fix: delete lines 570-581 |
| Router wiring | OK | All 12 actions dispatched |
| Auth / rate limiting | OK | Preserved from original |
| CORS headers | OK | Consistent across files |
| Service-role bypass | OK | Whitelist intact |

One fix needed, then the refactoring is fully validated.

