---
name: Lunch-Window Detection and Dead-Gap Steering
description: detectMealSlots time-window guard + fill-dead-gaps lunch-overlap dining steering — closes Istanbul-Day-2-style midday holes
type: constraint
---

# Lunch-Window Detection + Dead-Gap Lunch Steering

Closes the recurring "Day N has a 3h+ midday gap and no lunch — yet meal-guard reports compliant" pattern (Istanbul Day 2: Topkapi ends 12:35, next card "Lunch at Binbirdirek" at 15:55, no real lunch in 11:00–15:00).

## Two enforcement layers

### 1. `detectMealSlots` time-window guard
`supabase/functions/generate-itinerary/day-validation.ts` — when a dining card's title contains a meal keyword (`breakfast|brunch|lunch|dinner|supper`), the credit is only granted if `startTime` falls inside that meal's window:

- breakfast: 06:00–11:00
- lunch:     11:00–15:00
- dinner:    17:00–22:00

A "Lunch at X" card starting 15:55 is **not** counted as lunch — meal-guard then sees lunch missing and injects a real one. Category-only hits (no meal keyword in title) and cards with no `startTime` still fall through to the time-based detector for legacy/backward compatibility. Sentinel: `[MEAL_FALSE_POSITIVE] rejected "<title>" at <startTime> reason=out_of_window meal=<meal>`.

### 2. `fillAfternoonDeadGaps` lunch-overlap steering
`supabase/functions/generate-itinerary/pipeline/fill-dead-gaps.ts` — accepts optional `requiredMeals: ('breakfast'|'lunch'|'dinner')[]` on `FillDeadGapsOptions`. When the detected gap overlaps `[11:00, 15:00)` by ≥60min AND `requiredMeals` includes `'lunch'`, the proposeGapFiller call is forced to `preferCategory='dining'` so the AI picks a real lunch venue instead of another sightseeing card. Sentinel: `[DEAD_GAP_DECISION] … prefer=dining mealSlot=lunch`.

Callers that don't pass `requiredMeals` preserve legacy behavior — no behavior change in manual mode, tests, or older call sites.

## Tests
`supabase/functions/generate-itinerary/__tests__/detect-meal-slots-window.test.ts` (8 cases) — locks the window guard + legacy fallback.
