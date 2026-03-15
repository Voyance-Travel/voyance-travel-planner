

# Fix: Only 1 Meal Per Day Instead of 3

## Root Cause

There are **two competing meal systems** that contradict each other:

1. **`meal-policy.ts`** — A well-designed system that correctly derives meals per day (e.g., standard mid-trip days get breakfast + lunch + dinner). But it's **only used in the single-day rewrite path** (`generate-day`), not in full trip generation.

2. **`personalization-enforcer.ts` → `deriveScheduleConstraints()`** (lines 860-891) — Has a broken pace-based fallback for meal derivation:
   - Default: **dinner only**
   - Adds lunch only if pace ≤ 0 (relaxed)
   - Adds breakfast only if pace ≤ -4 (very relaxed)
   - Adds all 3 only if pace ≥ 2 (active)
   - **Moderate pace (0-1) = dinner only**

   The full generation path (line 5255) calls `deriveScheduleConstraints()` **without** `dayContext`, so it always hits this broken fallback. The output goes into `buildScheduleConstraintsPrompt()` which tells the AI: `"Required meals: dinner"` — overriding the softer line 1983 instruction that says "Include a mix of: 3 dining slots."

**Result**: For most users (moderate pace), the AI is told to only include dinner. On arrival/departure days, even that can get dropped.

## Fix

### 1. Fix the default meal logic in `personalization-enforcer.ts`

Replace the pace-based meal derivation (lines 877-891) with a simple default: **standard full-exploration days always require breakfast, lunch, and dinner**. The arrival/departure/transition day logic already handles reduced meals correctly via `dayContext` — the problem is only in the fallback when `dayContext` is not provided.

**Before** (broken):
```typescript
requiredMeals = ['dinner'];
if (pace <= 0) requiredMeals.push('lunch');
if (pace <= -4) requiredMeals.push('breakfast');
if (pace >= 2) { /* add all */ }
```

**After** (fixed):
```typescript
requiredMeals = ['breakfast', 'lunch', 'dinner']; // Standard day = 3 meals
```

The first/last/transition/full-day-event branches (lines 862-876) already correctly reduce meals for those special days — only the generic fallback is broken.

### 2. Wire `meal-policy.ts` into the full generation path

In `index.ts`, within the per-day generation loop (~line 1486), derive the meal policy using `deriveMealPolicy()` for each day and pass `requiredMealsOverride` into `deriveScheduleConstraints()` via `dayContext`. This ensures the full generation path uses the same smart meal logic as single-day rewrites.

### 3. Strengthen the prompt instruction

Change line 1983 from a soft suggestion to a hard requirement aligned with the derived meal policy for that day.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/personalization-enforcer.ts` | Fix default meal fallback: standard days = 3 meals regardless of pace |
| `supabase/functions/generate-itinerary/index.ts` | Wire `deriveMealPolicy()` into full generation loop; pass `requiredMealsOverride` to schedule constraints; strengthen meal prompt |

## Expected Result

- Standard mid-trip days: breakfast + lunch + dinner (always)
- Arrival day: meals based on arrival time (morning arrival = 3 meals, evening = dinner only)
- Departure day: meals based on departure time
- Transition/constrained days: meals based on available window

