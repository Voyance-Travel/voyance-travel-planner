

## Fix Generic "Meal at a X" Titles in Itinerary

### Root Cause

There are **two** meal guard systems that inject fallback meals when the AI misses one:

1. **Server-side** (`day-validation.ts` line 838): Has access to a restaurant pool and verified_venues. Falls back to generic `"Breakfast at a café near your hotel"` only when both pools are empty.

2. **Client-side** (`mealGuard.ts` line 144): Runs on every save (via `itineraryActionExecutor.ts` and `itineraryAPI.ts`). Has **zero** access to restaurant pools — always produces generic names like `"Lunch at a neighborhood restaurant"`.

**221 out of 3,112 dining activities** (7%) in production have these generic fallback names. The client-side guard is the primary offender because it fires on every drag-drop, edit, or regeneration save.

### The Fix (3 parts)

**Part 1: Client-side guard — query real venues before falling back**

File: `src/utils/mealGuard.ts`

- Add an async variant `enforceItineraryMealComplianceAsync` that accepts `supabase` client
- Before injecting a generic fallback, query `verified_venues` table for the destination city (same approach as server-side line 11210-11234)
- Use real venue names when available; only fall back to generic when the query returns nothing
- Mark any remaining generic fallbacks with `needsRefinement: true` (already done)

**Part 2: Wire up the async guard in callers**

Files: `src/services/itineraryActionExecutor.ts`, `src/services/itineraryAPI.ts`

- Switch from `enforceItineraryMealCompliance` (sync) to `enforceItineraryMealComplianceAsync` (async)
- Pass the supabase client and destination city to the guard

**Part 3: Ensure needsRefinement meals show a swap CTA**

Verify the UI already renders a "Find a real restaurant" button for `needsRefinement` activities. If not, add it to the activity card component.

### What this does NOT change

- The server-side guard already has pool access and works correctly
- AI prompt instructions stay the same (they already demand real names)
- The 221 existing generic entries in production won't auto-fix, but users can tap "swap" to replace them

### Files changed

| File | Change |
|------|--------|
| `src/utils/mealGuard.ts` | Add async variant with `verified_venues` query |
| `src/services/itineraryActionExecutor.ts` | Use async guard, pass supabase + destination |
| `src/services/itineraryAPI.ts` | Use async guard, pass supabase + destination |
| Activity card component (if needed) | Ensure swap CTA for `needsRefinement` |

