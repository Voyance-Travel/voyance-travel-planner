

## Problem: Meal-Time Mismatch (e.g. "Lunch" at breakfast time)

### Root Cause

The validator (`validate-day.ts`) detects **MEAL_ORDER** errors only for:
- Breakfast after 14:00
- Lunch after 17:00

It does **not** catch:
- Lunch before 11:00 (lunch restaurant at breakfast time — the case you saw)
- Dinner before 15:00
- Breakfast-labeled activity in the dinner slot

More critically, **MEAL_ORDER has no repair handler at all** in `repair-day.ts`. The validation fires, marks it as `autoRepairable: true`, but nothing acts on it. The broken meal label passes through untouched.

### What to Change

**File: `supabase/functions/generate-itinerary/pipeline/validate-day.ts`** — `checkMealOrder()`

Expand detection to catch all wrong-direction mismatches:
- **Lunch before 11:00** → should be breakfast
- **Dinner before 15:00** → should be lunch  
- **Breakfast after 14:00** → already caught
- **Lunch after 17:00** → already caught

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

Add a new repair block (before meal duplicate repair, around step 5a):

**Step 5a: MEAL_ORDER repair**
- For each `MEAL_ORDER` violation, determine the correct meal label for that time slot using the same ranges as MEAL_DUPLICATE repair (breakfast 6:00–10:59, lunch 11:00–14:59, dinner 17:00–22:59)
- Relabel the title: replace the wrong meal keyword with the correct one (e.g. "Lunch at Café Roma" at 8:30 → "Breakfast at Café Roma")
- Update `name` field to match
- Log the repair

**File: `supabase/functions/generate-itinerary/day-validation.ts`** — `enforceRequiredMealsFinalGuard()`

Before deduplication and injection, add a pass that relabels any meal whose title contradicts its time slot. This catches cases that bypass the pipeline (e.g. chain path, save path).

### Expected Result
- A "Lunch at X" scheduled at 8:30 AM gets relabeled to "Breakfast at X"
- A "Dinner at Y" at 12:00 gets relabeled to "Lunch at Y"  
- Every meal label matches its actual time slot before the day is saved

