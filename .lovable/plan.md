

# Fix: Persistent `.toLowerCase()` crash in itinerary render

## Problem
The crash persists with the **new bundle** (`Bp3QcUDA`), confirming the PWA fix worked but an unguarded `.toLowerCase()` still exists in the render path. The file has **249 `.toLowerCase()` calls** across 11K lines, making it impractical to find the exact one from a minified stack trace.

## Root cause
Multiple functions in `EditorialItinerary.tsx` and `cost-estimation.ts` call `.toLowerCase()` on values that can be `undefined` when activity data from the AI backend is incomplete. The fallback chains (e.g., `activity.category || activity.type || 'activity'`) look safe in isolation, but edge cases exist where intermediate values are non-null but non-string (e.g., an object, a number, or `false`).

## Fix: Nuclear defensive sweep

### 1. Guard `cost-estimation.ts` (2 bare calls)
- **Line 332**: `category.toLowerCase()` → `(category || 'activity').toLowerCase()`
- **Line 402**: `category.toLowerCase()` → `(category || 'activity').toLowerCase()`
- **Lines 363, 371**: `city.toLowerCase()`, `country.toLowerCase()` — already inside null checks but add `|| ''` for safety

### 2. Guard remaining bare calls in `EditorialItinerary.tsx`
- **Lines 1040-1041**: `category.toLowerCase()` and `title.toLowerCase()` → use `safeLower()` or add `|| ''` guards
- **Line 2580**: `newMode.toLowerCase()` → `(newMode || '').toLowerCase()`
- **Line 2610**: `newMode.toLowerCase()` → `(newMode || '').toLowerCase()`
- **Line 2619**: `newMode.toLowerCase()` → `(newMode || '').toLowerCase()`
- **Lines 8573-8576**: `o.mode.toLowerCase()` → `(o.mode || '').toLowerCase()`

### 3. Add a safety wrapper at the top of `ActivityRow`
Add an early-return guard: if `activity` is nullish, return `null`. This prevents all downstream property accesses from crashing.

### 4. Add `safeLower` to `getActivityType` and `getActivityCostInfo`
Replace raw `||` chains with explicit `safeLower()` calls to handle non-string edge cases (e.g., `activity.category` being an object or number).

## Files to modify
- `src/lib/cost-estimation.ts` — guard 2 bare `.toLowerCase()` calls
- `src/components/itinerary/EditorialItinerary.tsx` — guard ~8 bare `.toLowerCase()` calls + add ActivityRow null check

## Expected result
No more render crashes from `.toLowerCase()` regardless of what data shape the AI backend returns.

