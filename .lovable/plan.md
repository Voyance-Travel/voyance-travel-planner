

# Fix: `effectiveBudgetTier is not defined` in generate-day action

## Root Cause

The edge function logs show:
```
ReferenceError: effectiveBudgetTier is not defined
    at index.ts:7235
```

The variable `effectiveBudgetTier` is declared in the `generate-full` action path (line 5334) but **never declared** in the `generate-day` / `regenerate-day` action path. After the profile loads at line 8051, line 8067 has a comment stub ("Use profile's budget tier if available, fallback to params") but the actual `const effectiveBudgetTier = ...` assignment is missing. The variable is then referenced at lines 8152, 8213, 8264, 8441, and 9397, causing a crash on every single-day generation call.

This was likely caused by an incomplete edit — the DNA integration changes earlier may have removed or failed to add this line.

## Fix

**File: `supabase/functions/generate-itinerary/index.ts`**

After line 8067 (the comment), add the missing declaration:

```typescript
const effectiveBudgetTier = profile.budgetTier || budgetTier || 'moderate';
```

This mirrors the exact same pattern used at line 5334 in the `generate-full` action:
```typescript
const effectiveBudgetTier = unifiedProfile.budgetTier || context.budgetTier || 'moderate';
```

In the `generate-day` path, `profile` is the loaded `TravelerProfile` and `budgetTier` comes from the request params (line 6534).

### Files Changed

| File | Change |
|------|--------|
| `index.ts` (line ~8068) | Add `const effectiveBudgetTier = profile.budgetTier \|\| budgetTier \|\| 'moderate';` |

One-line fix. This will unblock all itinerary generation.

