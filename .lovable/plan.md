

## Problem

The AI generates real activities (sightseeing, cultural, transport) but frequently omits dining venues entirely on Days 2+. The meal guard catches the missing meals but injects generic, useless placeholders like "Breakfast — Local Café" and "Dinner — Local Restaurant" instead of real venue recommendations. These placeholders have no real restaurant name, no address, no useful information — they are effectively broken entries.

From the live data for trip `36238571`:
- Day 1: Real dinner (AI-generated) — correct
- Day 2: Only lunch detected from AI; breakfast and dinner injected as guards
- Day 3: Zero meals from AI; all three injected as guards  
- Day 4: Zero meals from AI; all three injected as guards

## Root cause

Two issues compound:

1. **The AI prompt asks for meals but doesn't enforce them strongly enough.** The meal policy block says "Required meals: BREAKFAST, LUNCH, DINNER" but the AI still drops them. There is no retry or feedback loop when meals are missing — the code just falls through to the guard.

2. **The meal guard is a "last resort" that injects garbage.** It was designed as a safety net, but in practice it is firing on most days and producing the majority of dining entries. Generic "Local Restaurant" placeholders are not acceptable in a premium travel product.

## Implementation plan

### 1. Upgrade the meal guard to inject destination-aware fallbacks (backend)
**File: `supabase/functions/generate-itinerary/day-validation.ts`**

Instead of injecting "Breakfast — Local Café", use a curated fallback map keyed by destination city and meal type. Include:
- Real neighborhood-appropriate venue suggestions per city (e.g., "Morning coffee at a Shinjuku kissaten" for Tokyo breakfast)
- Category-aware descriptions ("Traditional Japanese breakfast near your hotel")
- Mark with a `needsRefinement: true` flag so the frontend can show a "tap to get a specific recommendation" action

### 2. Add meal-missing retry before falling through to guard (backend)
**File: `supabase/functions/generate-itinerary/index.ts`**

After the initial AI generation, before accepting a day, check if required meals are present. If meals are missing and we haven't exhausted retries:
- Add the missing meal types to the retry feedback: "Your response is missing BREAKFAST and DINNER dining activities. You MUST include real restaurant recommendations with names for: breakfast, dinner."
- Only fall through to the meal guard on the absolute last retry

This is the key fix — the AI should be told it failed and asked to try again, rather than silently patching with placeholders.

### 3. Strengthen the meal enforcement in the AI prompt (backend)
**File: `supabase/functions/generate-itinerary/meal-policy.ts`**

Make the prompt language more forceful:
- Current: `"BREAKFAST: Real restaurant/café name near hotel"`
- New: `"🚨 BREAKFAST (MANDATORY — FAILURE IF MISSING): You MUST include a dining activity with category='dining' and the word 'Breakfast' in the title. Use a REAL restaurant/café name. Generic names like 'Local Café' = FAILURE."`

### 4. Treat meal-guard injections as validation errors, not silent fixes (backend)
**File: `supabase/functions/generate-itinerary/index.ts`**

Currently at line ~2897, if the meal guard fires, the code just warns and continues. Change this so that if the meal guard fires AND we have retries remaining, it counts as a validation error that triggers a retry with specific feedback about which meals were missing.

### 5. Update client-side meal guard to match (frontend)
**File: `src/utils/mealGuard.ts`**

Mirror the same improvements: instead of "Breakfast — Local Café", use contextual fallbacks. Also add the `needsRefinement` flag so the UI can prompt the user to swap for a real venue.

## Files to change
- `supabase/functions/generate-itinerary/day-validation.ts` — upgrade fallback quality
- `supabase/functions/generate-itinerary/index.ts` — add meal-missing retry loop before guard
- `supabase/functions/generate-itinerary/meal-policy.ts` — strengthen prompt language
- `src/utils/mealGuard.ts` — upgrade client-side fallback quality

## Expected outcome
- AI retries when meals are missing instead of silently injecting placeholders
- On the rare occasion the guard still fires (final retry exhausted), fallbacks are contextual and destination-aware rather than generic "Local Restaurant"
- No more days filled with nothing but "Breakfast spot, Lunch spot, Dinner spot"

