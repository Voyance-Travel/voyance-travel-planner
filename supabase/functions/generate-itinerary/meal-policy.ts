// =============================================================================
// MEAL POLICY — Single source of truth for how many meals a day should have
// =============================================================================
// Replaces the old "3 meals unless first/last day" blanket rule.
// Every day's meal requirements are now derived from its actual shape.
// =============================================================================

export type DayMode =
  | 'full_exploration'       // Standard mid-trip day — 3 meals
  | 'late_arrival'           // Arrive evening/night — dinner only (maybe)
  | 'midday_arrival'         // Arrive midday — lunch + dinner
  | 'morning_arrival'        // Arrive early — near-full day, 2-3 meals
  | 'early_departure'        // Leave before noon — breakfast only
  | 'midday_departure'       // Leave by early afternoon — breakfast (+ light lunch)
  | 'afternoon_departure'    // Leave by late afternoon — breakfast + lunch
  | 'late_departure'         // Leave evening — nearly full day, 3 meals
  | 'full_day_event'         // User locked the entire day — no meal pressure
  | 'transition_day'         // Travel between cities — meals based on free window
  | 'constrained_half_day';  // Large locked time block — reduce meals to fit

export type RequiredMeal = 'breakfast' | 'lunch' | 'dinner';

export interface MealPolicy {
  dayMode: DayMode;
  requiredMeals: RequiredMeal[];
  mealInstructionText: string;
  isFullExplorationDay: boolean;
  /** Total usable hours for scheduling (approximate) */
  usableHours: number;
}

export interface MealPolicyInput {
  dayNumber: number;
  totalDays: number;
  isFirstDay: boolean;
  isLastDay: boolean;
  /** HH:MM arrival time (flight or estimated), undefined if unknown */
  arrivalTime24?: string;
  /** HH:MM departure time (flight), undefined if unknown */
  departureTime24?: string;
  /** Whether this day is a transition between cities */
  isTransitionDay?: boolean;
  /** Whether a full_day_event constraint is on this day */
  hasFullDayEvent?: boolean;
  /** Earliest available time HH:MM (after arrival/check-in/settle) */
  earliestAvailable?: string;
  /** Latest available time HH:MM (before departure logistics) */
  latestAvailable?: string;
  /** Hours consumed by locked/pre-booked time blocks */
  lockedHours?: number;
}

// =============================================================================
// CORE POLICY FUNCTION
// =============================================================================

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Derive the meal policy for a single day based on its actual shape.
 */
export function deriveMealPolicy(input: MealPolicyInput): MealPolicy {
  const {
    isFirstDay,
    isLastDay,
    arrivalTime24,
    departureTime24,
    isTransitionDay,
    hasFullDayEvent,
    earliestAvailable,
    latestAvailable,
    lockedHours,
  } = input;

  // ── Full-day event: no meal pressure ──
  if (hasFullDayEvent) {
    return {
      dayMode: 'full_day_event',
      requiredMeals: [],
      mealInstructionText: 'This day is consumed by a full-day event. Do NOT force meals — only include a meal if the event schedule has a clear gap and the traveler would realistically eat.',
      isFullExplorationDay: false,
      usableHours: 0,
    };
  }

  // Compute usable window
  const startMins = earliestAvailable ? timeToMins(earliestAvailable) : (isFirstDay ? 15 * 60 : 8 * 60); // default 3pm arrival / 8am
  const endMins = latestAvailable ? timeToMins(latestAvailable) : (isLastDay ? 11 * 60 : 22 * 60); // default 11am checkout / 10pm
  const rawUsableMinutes = Math.max(0, endMins - startMins);
  const lockedMinutes = (lockedHours || 0) * 60;
  const usableMinutes = Math.max(0, rawUsableMinutes - lockedMinutes);
  const usableHours = Math.round(usableMinutes / 60 * 10) / 10;

  // ── Transition day: meals based on remaining free window ──
  if (isTransitionDay) {
    const meals = deriveMealsFromWindow(startMins, endMins, usableMinutes);
    return {
      dayMode: 'transition_day',
      requiredMeals: meals,
      mealInstructionText: buildMealText(meals, 'transition day'),
      isFullExplorationDay: false,
      usableHours,
    };
  }

  // ── Constrained half-day: large locked block ate most of the day ──
  if (!isFirstDay && !isLastDay && lockedHours && lockedHours >= 5) {
    const meals = deriveMealsFromWindow(startMins, endMins, usableMinutes);
    return {
      dayMode: 'constrained_half_day',
      requiredMeals: meals,
      mealInstructionText: buildMealText(meals, 'constrained day (large time block)'),
      isFullExplorationDay: false,
      usableHours,
    };
  }

  // ── Arrival day (first day) ──
  if (isFirstDay) {
    const arrivalMins = arrivalTime24 ? timeToMins(arrivalTime24) : undefined;

    if (arrivalMins !== undefined) {
      if (arrivalMins >= 1200) {
        // After 8 PM — late arrival
        return meal('late_arrival', ['dinner'], usableHours,
          'Late arrival — only schedule dinner if the traveler has time and energy. No breakfast or lunch.');
      }
      if (arrivalMins >= 1020) {
        // 5-8 PM — evening arrival
        return meal('late_arrival', ['dinner'], usableHours,
          'Evening arrival — plan dinner near the hotel. No breakfast or lunch on this day.');
      }
      if (arrivalMins >= 720) {
        // 12-5 PM — midday/afternoon arrival
        const meals: RequiredMeal[] = arrivalMins < 780 ? ['lunch', 'dinner'] : ['dinner'];
        return meal('midday_arrival', meals, usableHours,
          buildMealText(meals, 'midday/afternoon arrival'));
      }
      // Before noon — morning arrival, nearly full day
      // Breakfast required if arrival < 10:30 AM (real morning window for café/coffee).
      const meals: RequiredMeal[] = arrivalMins < 630 ? ['breakfast', 'lunch', 'dinner'] : ['lunch', 'dinner'];
      return meal('morning_arrival', meals, usableHours,
        buildMealText(meals, 'morning arrival'));
    }

    // No arrival time — assume full day available (morning start)
    return meal('morning_arrival', ['breakfast', 'lunch', 'dinner'], usableHours,
      'Arrival time unknown — planning a full day with all 3 meals. Add flight details to adjust if arriving later.');
  }

  // ── Departure day (last day) ──
  if (isLastDay) {
    const depMins = departureTime24 ? timeToMins(departureTime24) : undefined;

    if (depMins !== undefined) {
      if (depMins < 600) {
        // Before 10 AM — very early departure
        return meal('early_departure', [], usableHours,
          'Very early departure — no scheduled meals. Just checkout and transit to airport.');
      }
      if (depMins < 720) {
        // 10 AM - noon — morning departure
        return meal('early_departure', ['breakfast'], usableHours,
          'Morning departure — breakfast only, then checkout and airport.');
      }
      if (depMins < 900) {
        // Noon - 3 PM — midday departure
        return meal('midday_departure', ['breakfast'], usableHours,
          'Midday departure — breakfast near hotel, then checkout. Quick morning activity possible.');
      }
      if (depMins < 1080) {
        // 3-6 PM — afternoon departure
        return meal('afternoon_departure', ['breakfast', 'lunch'], usableHours,
          'Afternoon departure — breakfast + lunch. Morning activities possible before checkout.');
      }
      // After 6 PM — late departure, nearly full day
      return meal('late_departure', ['breakfast', 'lunch', 'dinner'], usableHours,
        'Late departure — nearly a full day. Include breakfast, lunch, and dinner before airport.');
    }

    // No departure time — plan morning + lunch before checkout
    return meal('midday_departure', ['breakfast', 'lunch'], usableHours,
      'Departure time unknown — planning breakfast + lunch. Add flight details for better planning.');
  }

  // ── Standard mid-trip day ──
  // Check if usable hours are significantly reduced by locked blocks
  if (usableHours < 6) {
    const meals = deriveMealsFromWindow(startMins, endMins, usableMinutes);
    return {
      dayMode: 'constrained_half_day',
      requiredMeals: meals,
      mealInstructionText: buildMealText(meals, 'constrained day'),
      isFullExplorationDay: false,
      usableHours,
    };
  }

  // Full exploration day — 3 meals
  return {
    dayMode: 'full_exploration',
    requiredMeals: ['breakfast', 'lunch', 'dinner'],
    mealInstructionText: `Full exploration day — 3 meals required (breakfast, lunch, dinner). Each meal must be a real named restaurant with approximate price.`,
    isFullExplorationDay: true,
    usableHours,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function meal(mode: DayMode, meals: RequiredMeal[], usableHours: number, text: string): MealPolicy {
  return {
    dayMode: mode,
    requiredMeals: meals,
    mealInstructionText: text,
    isFullExplorationDay: false,
    usableHours,
  };
}

/**
 * Derive which meals fit into a time window based on when the window falls.
 */
function deriveMealsFromWindow(startMins: number, endMins: number, usableMinutes: number): RequiredMeal[] {
  const meals: RequiredMeal[] = [];

  // Only include meals whose windows overlap with the available time
  // Breakfast: 7:00-10:30 (420-630)
  if (startMins <= 600 && endMins >= 450 && usableMinutes >= 60) {
    meals.push('breakfast');
  }
  // Lunch: 11:30-14:00 (690-840)
  if (startMins <= 810 && endMins >= 720 && usableMinutes >= 120) {
    meals.push('lunch');
  }
  // Dinner: 18:00-21:30 (1080-1290)
  if (startMins <= 1260 && endMins >= 1110 && usableMinutes >= 120) {
    meals.push('dinner');
  }

  return meals;
}

function buildMealText(meals: RequiredMeal[], dayLabel: string): string {
  if (meals.length === 0) {
    return `${capitalize(dayLabel)} — no scheduled meals required. Only include a meal if there's a natural gap.`;
  }
  const mealList = meals.join(', ');
  return `${capitalize(dayLabel)} — ${meals.length} meal${meals.length > 1 ? 's' : ''} required: ${mealList}. Each must be a real named restaurant with approximate price. Do NOT add meals beyond this list.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build the meal requirements section for injection into AI prompts.
 * Replaces the old hardcoded "3 per full day" block.
 */
export function buildMealRequirementsPrompt(policy: MealPolicy): string {
  const lines: string[] = [];

  lines.push(`MEAL POLICY (${policy.dayMode.replace(/_/g, ' ')}):`);

  if (policy.requiredMeals.length === 0) {
    lines.push(`- No mandatory meals for this day type.`);
    lines.push(`- Only include a meal if the schedule has a natural gap during a meal window.`);
    return lines.join('\n');
  }

  lines.push(`🚨 MANDATORY MEALS — ${policy.requiredMeals.length} REQUIRED (FAILURE IF ANY ARE MISSING):`);
  lines.push(`You MUST include ALL of the following as separate dining activities with category="dining".`);
  lines.push(`Generic names like "Local Café", "Local Restaurant", "Breakfast spot" = AUTOMATIC FAILURE.`);
  lines.push(`Each meal MUST use a REAL, SPECIFIC restaurant or café name that exists in the destination.`);

  if (policy.requiredMeals.includes('breakfast')) {
    lines.push(`- 🍳 BREAKFAST (MANDATORY): PREFER the hotel's own restaurant/café (e.g., "Breakfast at [Hotel Restaurant Name]"). At least 3 of every 5 days should be at the guest's hotel. For variety, alternate with a real named café within walking distance on some days. NEVER send the guest to a DIFFERENT hotel for breakfast. Include the actual restaurant name, approximate price. MUST be DIFFERENT from any previous day's breakfast. Example: "Breakfast at The Lounge at Four Seasons" NOT "Breakfast — Local Café".`);
  }
  if (policy.requiredMeals.includes('lunch')) {
    lines.push(`- 🥗 LUNCH (MANDATORY): A real named restaurant near the previous activity. Include actual restaurant name, ~price, 1 alternative in tips. MUST be DIFFERENT from any previous day's lunch. Example: "Lunch at Ichiran Ramen" NOT "Lunch spot".`);
  }
  if (policy.requiredMeals.includes('dinner')) {
    lines.push(`- 🍽️ DINNER (MANDATORY): A real named restaurant with price range, cuisine type, reservation info. MUST be DIFFERENT from any previous day's dinner. Example: "Dinner at Trattoria dell'Orso" NOT "Dinner — Local Restaurant".`);
  }

  lines.push(`⚠️ CRITICAL: If your response is missing ANY of the above meals, it will be REJECTED and you will be asked to redo the entire day. Save time by including them on the first attempt.`);

  if (policy.requiredMeals.length < 3) {
    const missing = (['breakfast', 'lunch', 'dinner'] as RequiredMeal[]).filter(m => !policy.requiredMeals.includes(m));
    lines.push(`- Do NOT schedule: ${missing.join(', ')} — this day type does not call for ${missing.length > 1 ? 'them' : 'it'}.`);
  }

  return lines.join('\n');
}
