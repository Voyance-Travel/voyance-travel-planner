

# Why Meals Are Missing — Root Cause Analysis & Fix Plan

## The Problem

The prompt layer is doing its job: `meal-policy.ts` correctly returns `['breakfast', 'lunch', 'dinner']` for full exploration days, and `index.ts` injects this into the AI prompt with extreme emphasis ("HARD RULE", "a day without 3 meals is a FAILURE"). The problem is what happens when the AI ignores this instruction — which it regularly does.

## Root Causes (3 failures working together)

### 1. No post-generation meal enforcement
When the AI returns a day with only 1 meal, nothing catches it and retries. The `day-validation.ts` file (`validateGeneratedDay`) checks for duplicate activities, back-to-back dining, and trip-wide uniqueness — but **never counts whether the required meals actually exist**. A day with zero breakfasts and zero lunches passes validation cleanly.

### 2. Personalization enforcer flags meals as "minor"
`personalization-enforcer.ts` (line 1274-1278) does detect `missing_meal`, but breakfast and lunch are flagged as `severity: 'minor'`. Only dinner gets `severity: 'major'`. The validity check (line 1290-1293) allows up to 2 major violations before failing — so even a missing dinner often passes. Minor violations are completely ignored for validity purposes.

### 3. Personalization enforcer is never called in the main generation path
The `validateDayPersonalization` function is imported (line 57) but **never invoked** in the main `generate-itinerary` flow or the `generate-day` flow. The schedule constraints prompt is built and injected into the AI prompt, but the post-generation validation that would catch missing meals is never run. The only validation that runs is `validateGeneratedDay` from `day-validation.ts`, which has no meal count logic.

## The Fix — 3 Changes

### Fix 1: Add meal count validation to `day-validation.ts`
**File: `supabase/functions/generate-itinerary/day-validation.ts`**

After the existing activity validation loop (~line 213), add a meal presence check:
- Count activities where category is `dining` and title/category contains `breakfast`, `lunch`, or `dinner`
- For non-first, non-last days: if any of the 3 required meals is missing → push an **error** (not warning)
- This plugs into the existing retry loop that re-generates when `validation.errors.length > 0`

### Fix 2: Add meal injection fallback in the retry/post-processing path
**File: `supabase/functions/generate-itinerary/index.ts`**

After the retry loop exhausts (max retries reached), if meals are still missing:
- Inject stub meal activities into the day at the correct time windows (breakfast 08:30, lunch 12:30, dinner 19:00)
- Use a lightweight AI call (or template) to generate just the missing meal slot with a real restaurant name for the destination
- This guarantees no day ships without 3 meals, even if the AI consistently drops them

### Fix 3: Upgrade meal severity in `personalization-enforcer.ts`
**File: `supabase/functions/generate-itinerary/personalization-enforcer.ts`**

Change line 1278: ALL missing meals should be `severity: 'major'` (not just dinner). Breakfast and lunch are not optional — people need to eat. This ensures that if/when the personalization validator is called, missing meals correctly fail validation.

## Files Changed
- **`supabase/functions/generate-itinerary/day-validation.ts`** — Add required meal count check that pushes errors for missing B/L/D on full days
- **`supabase/functions/generate-itinerary/index.ts`** — Add meal injection fallback after retry exhaustion + pass meal policy info to validation
- **`supabase/functions/generate-itinerary/personalization-enforcer.ts`** — Upgrade missing breakfast/lunch from 'minor' to 'major' severity

## Why This Will Work
The retry loop in `index.ts` already re-generates when `validation.errors` is non-empty. By adding meal count checks to the validator that feeds this loop, missing meals will trigger automatic retries with explicit error feedback to the AI ("Day is missing BREAKFAST and LUNCH — add them"). If retries still fail, the fallback injector guarantees meals appear. This is the same pattern used for minimum activity count enforcement (lines 2676-2693), which already works reliably.

