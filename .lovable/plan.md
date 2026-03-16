

## Problem: Dedup strips meals, guard injects garbage

The logs prove the exact sequence:

1. AI generates real restaurant meals for Day 3: "Breakfast at Point Et Ligne Marunouchi" and "Anago (Eel) Culinary Heritage Dinner"
2. Trip-wide validation flags them as `MEAL REPEAT` (similar to previous days)
3. The dedup code at line ~9775 **removes them entirely**
4. Meal guard fires, finds breakfast and dinner missing, injects generic "Breakfast spot" / "Dinner spot" placeholders

The fix is simple: **never strip a dining activity without replacing it.** When a meal is flagged as a repeat, the system should either ask the AI for a replacement or keep the duplicate (a repeated real restaurant is better than a placeholder).

## Changes

### 1. Make meal-repeat stripping request a retry instead of silently removing (index.ts ~9762-9791)

Replace the current logic that strips MEAL REPEAT activities with:
- If any `MEAL REPEAT` errors exist AND retries remain: add those errors to the retry feedback and loop back to the AI, asking it to use **different** restaurants for the flagged meals
- If no retries remain: **keep the duplicate meal** rather than stripping it — a repeated real restaurant is infinitely better than "Breakfast spot"
- Only strip `TRIP-WIDE DUPLICATE` for non-dining activities (sightseeing, tours, etc.)

The key rule: **a dining activity flagged as MEAL REPEAT must never be removed without a replacement.**

### 2. Add meal-safe guard to the stripping filter (index.ts ~9775)

As a safety net, even if the above logic has bugs, add a hard rule to the `.filter()` at line 9775:
```
// NEVER strip a dining activity — keep the repeat rather than losing the meal
if (act.category === 'dining') return true;
```

This ensures no dining activity is ever silently removed by dedup.

### 3. Include MEAL REPEAT in retry feedback (index.ts)

When meals are flagged as repeats and retries remain, format the retry feedback to say:
"Day 3 BREAKFAST uses the same restaurant as a previous day. You MUST suggest a DIFFERENT restaurant for breakfast. Do NOT reuse [restaurant name]."

This gives the AI specific, actionable feedback to fix the issue.

## Files to change
- `supabase/functions/generate-itinerary/index.ts` — lines ~9762-9791 (dedup stripping logic)

## Expected outcome
- Dining activities are never stripped without replacement
- MEAL REPEAT triggers a retry with specific "use a different restaurant" feedback
- If retries are exhausted, the duplicate restaurant is kept (real > placeholder)
- No more "Breakfast spot" / "Lunch spot" / "Dinner spot" placeholders

