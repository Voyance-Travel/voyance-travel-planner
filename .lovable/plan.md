

# Analysis: Itinerary Generation Producing Identical Output

## Executive Summary

The itinerary generation system has a critical architectural flaw: **there are two completely separate code paths for generation, and the one being used (`generate-day` action, lines 6800-7200) is missing ALL the new constraint modules** that were added to the `generateSingleDayWithRetry` function (lines 3500-4200).

---

## Root Cause Identified

### The Problem: Two Separate Generation Paths

The edge function has TWO distinct generation flows:

| Path | Location | Used By | Has Constraints? |
|------|----------|---------|------------------|
| **`generateSingleDayWithRetry`** | Lines 3660-4200 | `generate-full` action | YES - All Phase 11/12 constraints |
| **`generate-day` action handler** | Lines 6800-7200 | `useLovableItinerary` hook | **NO - Missing everything** |

### What's Happening

1. The frontend (`useLovableItinerary.ts`) calls `action: 'generate-day'` for progressive generation
2. This routes to the **legacy handler** at line 6800, which has a **completely different, simpler prompt**
3. The legacy prompt (lines 6823-6850) contains NONE of the following:
   - Archetype constraints (`buildAllConstraints`)
   - Experience affinity guidance (`buildExperienceGuidancePrompt`)
   - Destination-specific guides (`buildDestinationGuidancePrompt`)
   - Budget constraints with "DO NOT" rules
   - Pacing enforcement
   - Trip-wide variety rules
   - Generation hierarchy

### The Evidence

**What the `generate-day` action sends to the AI (lines 6823-6850):**
```
You are an expert travel planner. Generate a single day's detailed itinerary.

General Requirements:
- Include FULL street addresses for all locations
- Provide realistic cost estimates in local currency
...
```

**What `generateSingleDayWithRetry` sends (lines 3833-3930):**
```
⚖️ GENERATION HIERARCHY — CONFLICT RESOLUTION RULES
...
1. DESTINATION ESSENTIALS (highest priority)
2. ARCHETYPE IDENTITY (critical - defines WHO the traveler is)
3. EXPERIENCE AFFINITY (what TO prioritize)
4. DESTINATION-SPECIFIC GUIDE (city × archetype recommendations)
5. BUDGET CONSTRAINTS
6. PACING CONSTRAINTS
7. VARIETY RULES
...
${comprehensiveConstraints}
${experienceGuidancePrompt}
${destinationGuidancePrompt}
```

---

## Secondary Issues

### 1. No User Profile Loading in `generate-day`
The legacy path doesn't fetch Travel DNA, archetypes, or trait scores. It only receives:
- `destination`
- `budgetTier` (string only)
- `travelers`
- `preferences?.pace`

### 2. Missing Constraint Module Imports
The `generate-day` handler doesn't call:
- `buildAllConstraints()` from `archetype-constraints.ts`
- `buildExperienceGuidancePrompt()` from `experience-affinity.ts`
- `buildDestinationGuidancePrompt()` from `destination-guides.ts`

### 3. Frontend Always Uses Progressive Generation
In `useItineraryGeneration.ts:356-369`:
```typescript
const generateItinerary = useCallback(async (trip: TripDetails): Promise<GeneratedDay[]> => {
  // UX-first: progressive generation streams days into the UI
  try {
    return await generateItineraryProgressive(trip); // ← ALWAYS tries this first
  } catch (error) {
    // ... falls back to full only on failure
  }
}
```

This means the broken path is **always used first**.

---

## Solution

### Option A: Route Progressive to Full Pipeline (Recommended)
Modify the `generate-day` action to use `generateSingleDayWithRetry` which already has all constraints.

### Option B: Port All Constraints to `generate-day`
Copy all the constraint logic from `generateSingleDayWithRetry` into the `generate-day` action handler.

### Option C: Change Frontend Default
Make the frontend use `generate-full` action by default instead of `generate-day`.

---

## Technical Plan

### Phase 1: Unify Generation Paths (High Priority)
1. **Modify `generate-day` action** (lines 6700-7200) to:
   - Load user Travel DNA and trait scores
   - Call `buildAllConstraints()` with archetype
   - Call `buildExperienceGuidancePrompt()` 
   - Call `buildDestinationGuidancePrompt()`
   - Include the generation hierarchy in the system prompt
   - Derive budget intent from traits

2. **Alternatively**: Redirect `generate-day` to internally call `generateSingleDayWithRetry`

### Phase 2: Ensure Profile Loading
1. Add Travel DNA fetch to `generate-day` path
2. Extract archetype and trait scores
3. Pass to constraint builders

### Phase 3: Verification
1. Add logging to confirm which prompt is being sent
2. Test regeneration with a Flexible Wanderer profile
3. Verify output excludes luxury/spa/Michelin

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-itinerary/index.ts` | Update `generate-day` action to use full constraint stack |

## Estimated Effort

| Task | Time |
|------|------|
| Port constraints to `generate-day` | 2-3 hours |
| Add Travel DNA loading | 1 hour |
| Testing | 1-2 hours |
| **Total** | **4-6 hours** |

---

## Why This Explains the "Corrupted" Feeling

- No matter what changes you made to `archetype-constraints.ts`, `experience-affinity.ts`, or `destination-guides.ts`, they were never used by the actual generation path
- The `generate-day` prompt has been the same generic prompt all along
- This is why you kept seeing identical output regardless of constraint file edits

