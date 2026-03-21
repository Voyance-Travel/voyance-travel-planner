/**
 * Meal-type / time-slot coherence guard.
 * Ensures that when a swap changes an activity title, the meal keyword
 * ("Breakfast", "Lunch", "Dinner") matches the activity's time slot.
 */

import { parseTimeToMinutes } from './timeFormat';

type MealLabel = 'Breakfast' | 'Lunch' | 'Dinner';

const MEAL_TIME_RANGES: Record<MealLabel, [number, number]> = {
  Breakfast: [6 * 60, 10 * 60 + 59],   // 6:00–10:59
  Lunch:     [11 * 60, 14 * 60 + 59],   // 11:00–14:59
  Dinner:    [17 * 60, 22 * 60 + 59],   // 17:00–22:59
};

const MEAL_PATTERN = /\b(breakfast|brunch|lunch|dinner|supper)\b/i;

function mealLabelForTime(minutes: number): MealLabel | null {
  for (const [label, [lo, hi]] of Object.entries(MEAL_TIME_RANGES) as [MealLabel, [number, number]][]) {
    if (minutes >= lo && minutes <= hi) return label;
  }
  return null;
}

function canonicalMealLabel(keyword: string): MealLabel | null {
  const lc = keyword.toLowerCase();
  if (lc === 'breakfast' || lc === 'brunch') return 'Breakfast';
  if (lc === 'lunch') return 'Lunch';
  if (lc === 'dinner' || lc === 'supper') return 'Dinner';
  return null;
}

/**
 * If `title` contains a meal keyword that contradicts `timeSlot`,
 * replace it with the correct meal keyword for that time.
 * Returns the (possibly corrected) title.
 */
export function enforceMealTimeCoherence(title: string, timeSlot: string | undefined | null): string {
  if (!title || !timeSlot) return title;

  const match = MEAL_PATTERN.exec(title);
  if (!match) return title; // No meal keyword → nothing to fix

  const titleMeal = canonicalMealLabel(match[1]);
  if (!titleMeal) return title;

  const minutes = parseTimeToMinutes(timeSlot);
  if (minutes === 0) return title; // Unparseable time → leave as-is

  const correctMeal = mealLabelForTime(minutes);
  if (!correctMeal) return title; // Time outside all meal windows → leave as-is
  if (correctMeal === titleMeal) return title; // Already coherent

  // Replace the meal keyword preserving case style
  const replacement = match[1][0] === match[1][0].toUpperCase()
    ? correctMeal
    : correctMeal.toLowerCase();

  console.log(`[MealCoherence] "${title}" at ${timeSlot}: ${titleMeal} → ${correctMeal}`);
  return title.slice(0, match.index) + replacement + title.slice(match.index + match[1].length);
}
