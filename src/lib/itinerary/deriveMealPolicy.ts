/**
 * Client-side port of supabase/functions/generate-itinerary/meal-policy.ts.
 * Pure thresholds — no edge dependencies. Keep in sync with server file.
 */

export type DayMode =
  | 'full_exploration'
  | 'late_arrival'
  | 'midday_arrival'
  | 'morning_arrival'
  | 'early_departure'
  | 'midday_departure'
  | 'afternoon_departure'
  | 'late_departure'
  | 'full_day_event'
  | 'transition_day'
  | 'constrained_half_day';

export type RequiredMeal = 'breakfast' | 'lunch' | 'dinner';

export interface MealPolicy {
  dayMode: DayMode;
  requiredMeals: RequiredMeal[];
  isFullExplorationDay: boolean;
  usableHours: number;
}

export interface MealPolicyInput {
  dayNumber: number;
  totalDays: number;
  isFirstDay: boolean;
  isLastDay: boolean;
  arrivalTime24?: string;
  departureTime24?: string;
  isTransitionDay?: boolean;
  hasFullDayEvent?: boolean;
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function mk(mode: DayMode, meals: RequiredMeal[], usableHours: number): MealPolicy {
  return { dayMode: mode, requiredMeals: meals, isFullExplorationDay: false, usableHours };
}

function deriveMealsFromWindow(startMins: number, endMins: number, usableMinutes: number): RequiredMeal[] {
  const meals: RequiredMeal[] = [];
  if (startMins <= 600 && endMins >= 450 && usableMinutes >= 60) meals.push('breakfast');
  if (startMins <= 810 && endMins >= 720 && usableMinutes >= 120) meals.push('lunch');
  if (startMins <= 1260 && endMins >= 1110 && usableMinutes >= 120) meals.push('dinner');
  return meals;
}

export function deriveMealPolicy(input: MealPolicyInput): MealPolicy {
  const { isFirstDay, isLastDay, arrivalTime24, departureTime24, isTransitionDay, hasFullDayEvent } = input;

  if (hasFullDayEvent) {
    return { dayMode: 'full_day_event', requiredMeals: [], isFullExplorationDay: false, usableHours: 0 };
  }

  const startMins = isFirstDay ? 15 * 60 : 8 * 60;
  const endMins = isLastDay ? 11 * 60 : 22 * 60;
  const usableMinutes = Math.max(0, endMins - startMins);
  const usableHours = Math.round(usableMinutes / 60 * 10) / 10;

  if (isTransitionDay) {
    return { dayMode: 'transition_day', requiredMeals: deriveMealsFromWindow(startMins, endMins, usableMinutes), isFullExplorationDay: false, usableHours };
  }

  if (isFirstDay) {
    const arrivalMins = arrivalTime24 ? timeToMins(arrivalTime24) : undefined;
    if (arrivalMins !== undefined) {
      if (arrivalMins >= 1200) return mk('late_arrival', ['dinner'], usableHours);
      if (arrivalMins >= 1020) return mk('late_arrival', ['dinner'], usableHours);
      if (arrivalMins >= 720) {
        const meals: RequiredMeal[] = arrivalMins < 780 ? ['lunch', 'dinner'] : ['dinner'];
        return mk('midday_arrival', meals, usableHours);
      }
      const meals: RequiredMeal[] = arrivalMins < 630 ? ['breakfast', 'lunch', 'dinner'] : ['lunch', 'dinner'];
      return mk('morning_arrival', meals, usableHours);
    }
    return mk('morning_arrival', ['breakfast', 'lunch', 'dinner'], usableHours);
  }

  if (isLastDay) {
    const depMins = departureTime24 ? timeToMins(departureTime24) : undefined;
    if (depMins !== undefined) {
      if (depMins < 600) return mk('early_departure', [], usableHours);
      if (depMins < 720) return mk('early_departure', ['breakfast'], usableHours);
      if (depMins < 900) return mk('midday_departure', ['breakfast'], usableHours);
      if (depMins < 1080) return mk('afternoon_departure', ['breakfast', 'lunch'], usableHours);
      return mk('late_departure', ['breakfast', 'lunch', 'dinner'], usableHours);
    }
    return mk('midday_departure', ['breakfast', 'lunch'], usableHours);
  }

  return {
    dayMode: 'full_exploration',
    requiredMeals: ['breakfast', 'lunch', 'dinner'],
    isFullExplorationDay: true,
    usableHours,
  };
}
