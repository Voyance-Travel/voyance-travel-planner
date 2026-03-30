// =============================================================================
// DAY VALIDATION — Extracted from index.ts to reduce bundle size
// =============================================================================

import { isRecurringEvent } from './currency-utils.ts';
import type { RequiredMeal } from './meal-policy.ts';

// =============================================================================
// CHAIN RESTAURANT BLOCKLIST — prevents chain restaurants from appearing
// =============================================================================

export const CHAIN_RESTAURANT_BLOCKLIST: string[] = [
  'five guys', 'mcdonalds', "mcdonald's", 'burger king', "wendy's", 'wendys',
  'subway', 'starbucks', 'chick-fil-a', 'chickfila', 'taco bell',
  'kfc', 'kentucky fried chicken', 'popeyes', "popeye's", 'panda express',
  'chipotle', "domino's", 'dominos', 'pizza hut', "papa john's", 'papa johns',
  "applebee's", 'applebees', "chili's", 'chilis', 'olive garden',
  'tgi fridays', "tgi friday's", "denny's", 'dennys', 'ihop',
  'waffle house', 'cracker barrel', 'red lobster', 'outback steakhouse',
  'buffalo wild wings', 'hooters', "nando's", 'nandos', 'wetherspoons',
  'tim hortons', "dunkin'", 'dunkin donuts', 'panera bread', 'panera',
  "arby's", 'arbys', 'sonic drive-in', 'jack in the box',
  'shake shack', 'in-n-out', 'whataburger', "culver's", 'culvers',
  "zaxby's", 'zaxbys', "raising cane's", 'raising canes', 'wingstop',
  "jimmy john's", 'jimmy johns', "jersey mike's", 'jersey mikes',
  'firehouse subs', 'cheesecake factory', "p.f. chang's", 'pf changs',
  'benihana', "ruth's chris", 'ruths chris', "morton's", 'mortons',
  'capital grille', 'the capital grille', 'hard rock cafe', 'planet hollywood',
  'rainforest cafe', 'bubba gump', 'golden corral', 'bob evans',
  "carl's jr", 'carls jr', 'del taco', 'el pollo loco',
  "bojangles'", 'bojangles', 'church\'s chicken', "church's chicken",
  "jason's deli", 'jasons deli', 'qdoba', 'moe\'s southwest grill',
  "moe's southwest", 'tropical smoothie', 'smoothie king',
  'jamba juice', 'cinnabon', 'auntie anne\'s', "auntie anne's",
  'dairy queen', 'baskin robbins', 'baskin-robbins', "coldstone creamery",
  'cold stone', 'krispy kreme', "little caesars", "little caesar's",
  'papa murphy\'s', "papa murphy's", 'wingstop', 'el pollo loco',
  'white castle', 'checkers', "rally's", 'rallys',
  "long john silver's", 'long john silvers', 'captain d\'s',
  'boston market', 'cracker barrel', 'perkins', "denny's",
  'texas roadhouse', 'longhorn steakhouse', 'red robin',
  'bob evans', "o'charley's", 'ocharles',
  'cheddar\'s scratch kitchen', "cheddar's",
  'yard house', 'bj\'s restaurant', "bj's restaurant",
  'dave and busters', "dave & buster's",
  'the cheesecake factory', 'seasons 52',
  'bahama breeze', 'cracker barrel old country store',
];

/**
 * Check if a restaurant name matches any chain in the blocklist.
 * Uses normalized lowercase comparison with substring matching.
 */
export function isChainRestaurant(name: string): boolean {
  if (!name) return false;
  const normalized = name.toLowerCase().trim();
  return CHAIN_RESTAURANT_BLOCKLIST.some(chain => {
    // Exact match or the name contains the chain name
    if (normalized === chain) return true;
    if (normalized.includes(chain)) return true;
    // Also check if the chain name is a significant portion of the restaurant name
    // e.g. "Five Guys Burgers" should match "five guys"
    const chainWords = chain.split(/\s+/);
    if (chainWords.length >= 2) {
      return chainWords.every(word => normalized.includes(word));
    }
    return false;
  });
}

/**
 * Filter chain restaurants from a list of activities.
 * Returns the filtered list and an array of removed chain names.
 */
export function filterChainRestaurants(
  activities: StrictActivityMinimal[],
): { filtered: StrictActivityMinimal[]; removedChains: string[] } {
  const removedChains: string[] = [];
  const filtered = activities.filter(a => {
    const category = (a.category || '').toLowerCase();
    if (!category.includes('dining') && !category.includes('restaurant') && !category.includes('food')) {
      return true; // Not a dining activity, keep it
    }
    if (isChainRestaurant(a.title)) {
      removedChains.push(a.title);
      return false;
    }
    return true;
  });
  return { filtered, removedChains };
}

// Re-declare minimal interfaces needed (avoid circular imports)
export interface StrictActivityMinimal {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  location: { name: string; address: string; coordinates?: { lat: number; lng: number } };
  cost: { amount: number; currency: string; formatted?: string; source?: string };
  description: string;
  tags: string[];
  bookingRequired: boolean;
  transportation: { method: string; duration: string; estimatedCost: { amount: number; currency: string }; instructions: string };
  tips?: string;
  personalization?: { tags: string[]; whyThisFits: string; confidence: number; matchedInputs: string[] };
  [key: string]: unknown;
}

export interface StrictDayMinimal {
  dayNumber: number;
  date: string;
  title: string;
  theme?: string;
  activities: StrictActivityMinimal[];
  [key: string]: unknown;
}

export interface DayValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const MEAL_KEYWORDS: Record<RequiredMeal, string[]> = {
  breakfast: ['breakfast', 'brunch'],
  lunch: ['lunch'],
  dinner: ['dinner', 'supper', 'evening meal'],
};

const DINING_CATEGORIES = ['dining', 'restaurant', 'food', 'cafe', 'meal'];

export function detectMealSlots(
  activities: Array<Pick<StrictActivityMinimal, 'title' | 'category'> & { startTime?: string }>
): RequiredMeal[] {
  const detected = new Set<RequiredMeal>();

  for (const activity of activities) {
    const title = (activity.title || '').toLowerCase();
    const category = (activity.category || '').toLowerCase();
    const isDining = DINING_CATEGORIES.some(c => category.includes(c));

    for (const mealType of Object.keys(MEAL_KEYWORDS) as RequiredMeal[]) {
      // Title-based keyword match works regardless of category
      if (MEAL_KEYWORDS[mealType].some(keyword => title.includes(keyword))) {
        detected.add(mealType);
      } else if (isDining && MEAL_KEYWORDS[mealType].some(keyword => category.includes(keyword))) {
        detected.add(mealType);
      }
    }

    // Time-based meal detection for dining-category activities (e.g. "De Kas" at 19:00)
    if (isDining) {
      const startTime = (activity as any).startTime || '';
      const minutes = parseTimeToMinutesLocal(startTime);
      if (minutes !== null) {
        if (minutes >= 6 * 60 && minutes < 11 * 60) detected.add('breakfast');
        else if (minutes >= 11 * 60 && minutes < 15 * 60) detected.add('lunch');
        else if (minutes >= 17 * 60 && minutes <= 22 * 60) detected.add('dinner');
      }
    }
  }

  return (['breakfast', 'lunch', 'dinner'] as RequiredMeal[]).filter(meal => detected.has(meal));
}

function resolveRequiredMealsForValidation(
  isFirstDay: boolean,
  isLastDay: boolean,
  requiredMealsOverride?: RequiredMeal[]
): RequiredMeal[] {
  if (requiredMealsOverride) return requiredMealsOverride;
  return !isFirstDay && !isLastDay ? ['breakfast', 'lunch', 'dinner'] : [];
}

function parseTimeToMinutesLocal(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  if (!period && hours >= 24) return null;
  return hours * 60 + mins;
}

// Validate a single generated day for quality and correctness
export function validateGeneratedDay(
  day: StrictDayMinimal,
  dayNumber: number,
  isFirstDay: boolean,
  isLastDay: boolean,
  totalDays: number,
  previousDays: StrictDayMinimal[] = [],
  isSmartFinish: boolean = false,
  mustDoActivities: string[] = [],
  requiredMealsOverride?: RequiredMeal[]
): DayValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const normalizeText = (input: string): string => {
    return (input || '')
      .toLowerCase()
      .normalize('NFD')
      // deno-lint-ignore no-control-regex
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  type ExperienceType =
    | 'culinary_class' | 'wine_tasting' | 'walking_tour'
    | 'museum_gallery' | 'shopping' | 'dining'
    | 'transport' | 'accommodation' | 'other';

  const getExperienceType = (act: StrictActivityMinimal): ExperienceType => {
    const title = normalizeText(act.title || '');
    const category = normalizeText(act.category || '');
    if (category.includes('transport')) return 'transport';
    if (category.includes('accommodation')) return 'accommodation';
    const isClassLike = /\b(class|workshop|lesson|masterclass|experience|session)\b/.test(title);
    const isCulinary = /\b(cook|cooking|culinary|chef|bake|baking|pastry|patisserie|food)\b/.test(title);
    if (isClassLike && isCulinary) return 'culinary_class';
    if (/\b(wine|tasting|vineyard|winery)\b/.test(title)) return 'wine_tasting';
    if (/\b(walking tour|guided tour|city tour|history tour)\b/.test(title)) return 'walking_tour';
    if (/\b(museum|gallery|exhibit|exhibition)\b/.test(title)) return 'museum_gallery';
    if (category.includes('shopping') || /\b(shop|shopping|market)\b/.test(title)) return 'shopping';
    if (category.includes('dining') || /\b(dinner|lunch|breakfast|brunch|restaurant)\b/.test(title)) return 'dining';
    return 'other';
  };

  const extractConcept = (title: string): string => {
    const conceptPart = normalizeText(title).split(/\s+at\s+|\s+with\s+|\s+@\s+|\s+in\s+/i)[0];
    return conceptPart
      .replace(/\b(class|tour|experience|visit|workshop|session|lesson|masterclass)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const STRIP_VERBS_RE = /\b(guided|visit|explore|discover|tour|walk|stroll|head|go|return|morning|afternoon|evening|a|an|the|to|of|at|in|on|and|with|for)\b/g;

  const conceptSimilarity = (a: string, b: string): boolean => {
    if (!a || !b || a.length < 5 || b.length < 5) return false;
    if (a === b) return true;
    const mealKeywords = ['lunch', 'dinner', 'breakfast', 'brunch', 'coffee', 'cafe', 'dessert', 'snack', 'food', 'eat', 'meal', 'drinks', 'cocktail', 'bar'];
    const aHasMeal = mealKeywords.some(kw => a.includes(kw));
    const bHasMeal = mealKeywords.some(kw => b.includes(kw));
    if (aHasMeal !== bHasMeal) return false;
    if (a.includes(b) || b.includes(a)) return true;

    // Venue-name substring matching: strip common verbs/prepositions and check containment
    const aVenue = a.replace(STRIP_VERBS_RE, '').replace(/\s+/g, ' ').trim();
    const bVenue = b.replace(STRIP_VERBS_RE, '').replace(/\s+/g, ' ').trim();
    if (aVenue.length > 5 && bVenue.length > 5 && (aVenue.includes(bVenue) || bVenue.includes(aVenue))) {
      return true;
    }

    const aWords = new Set(a.split(/\s+/));
    const bWords = new Set(b.split(/\s+/));
    const intersection = [...aWords].filter(w => bWords.has(w) && w.length > 3);
    const minLen = Math.min(aWords.size, bWords.size);
    return minLen > 0 && intersection.length / minLen > 0.6;
  };

  // Basic structure checks
  if (!day.dayNumber || day.dayNumber !== dayNumber) {
    errors.push(`Day number mismatch: expected ${dayNumber}, got ${day.dayNumber}`);
  }
  if (!day.activities || day.activities.length === 0) {
    errors.push('Day has no activities');
  }
  if (day.activities && day.activities.length < 3) {
    warnings.push(`Day has only ${day.activities.length} activities (expected 3-6)`);
  }

  // Validate each activity
  for (let i = 0; i < (day.activities?.length || 0); i++) {
    const act = day.activities[i];
    if (!act.title) errors.push(`Activity ${i + 1}: Missing title`);
    if (!act.startTime || !act.endTime) errors.push(`Activity ${i + 1} (${act.title || 'unknown'}): Missing start/end time`);
    if (!act.category) warnings.push(`Activity ${i + 1} (${act.title || 'unknown'}): Missing category`);
    if (!act.location?.name) warnings.push(`Activity ${i + 1} (${act.title || 'unknown'}): Missing location name`);

    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (act.startTime && !timeRegex.test(act.startTime)) errors.push(`Activity ${i + 1} (${act.title || 'unknown'}): Invalid startTime format "${act.startTime}"`);
    if (act.endTime && !timeRegex.test(act.endTime)) errors.push(`Activity ${i + 1} (${act.title || 'unknown'}): Invalid endTime format "${act.endTime}"`);

    const logisticsKeywords = ['check-in', 'checkout', 'check-out', 'check in', 'check out', 'arrival', 'departure', 'transfer', 'free time', 'at leisure', 'leisure time', 'downtime', 'rest', 'relax at hotel', 'explore on your own', 'personal time'];
    const transportLikeKeywords = ['rideshare', 'uber', 'lyft', 'taxi', 'metro', 'subway', 'tram', 'bus', 'train', 'ferry', 'flight'];
    const isLogistics = logisticsKeywords.some(kw => (act.title || '').toLowerCase().includes(kw)) ||
                        ['transport', 'accommodation', 'downtime', 'free_time'].includes(act.category?.toLowerCase() || '');

    const isTransportLikeActivity = (activity: StrictActivityMinimal): boolean => {
      const title = normalizeText(activity.title || '');
      const category = normalizeText(activity.category || '');
      return category.includes('transport') || category.includes('transit') ||
        transportLikeKeywords.some((kw) => title.includes(kw));
    };

    if (isLogistics && act.bookingRequired) {
      warnings.push(`Activity ${i + 1} (${act.title || 'unknown'}): Logistics activity should not require booking`);
    }
    if (isLogistics && act.cost?.amount && act.cost.amount > 0) {
      const isAirportTransfer = (act.title || '').toLowerCase().includes('transfer') &&
                                 (act.title || '').toLowerCase().includes('airport');
      if (!isAirportTransfer) {
        warnings.push(`Activity ${i + 1} (${act.title || 'unknown'}): Logistics should have $0 cost`);
      }
    }

    // Duplicate detection
    if (i > 0) {
      const prevAct = day.activities[i - 1];
      const currTitle = normalizeText(act.title || '');
      const prevTitle = normalizeText(prevAct.title || '');
      const currIsTransportLike = isTransportLikeActivity(act);
      const prevIsTransportLike = isTransportLikeActivity(prevAct);
      const currConcept = extractConcept(currTitle);
      const prevConcept = extractConcept(prevTitle);

      if (!currIsTransportLike && !prevIsTransportLike && conceptSimilarity(currConcept, prevConcept)) {
        if (isRecurringEvent(act, mustDoActivities)) {
          // Allow — user wants this activity repeated
        } else if (isSmartFinish) {
          warnings.push(`Activities ${i} and ${i + 1} are similar: "${prevAct.title}" followed by "${act.title}" - consider adding variety`);
        } else {
          errors.push(`Activities ${i} and ${i + 1} are too similar: "${prevAct.title}" followed by "${act.title}" - AVOID duplicate concepts back-to-back`);
        }
      }

      const prevType = getExperienceType(prevAct);
      const currType = getExperienceType(act);
      if (prevType === 'culinary_class' && currType === 'culinary_class') {
        if (isSmartFinish) {
          warnings.push(`Back-to-back culinary classes: "${prevAct.title}" followed by "${act.title}" - consider variety`);
        } else {
          errors.push(`Back-to-back culinary classes are not allowed: "${prevAct.title}" followed by "${act.title}"`);
        }
      }

      const specificMealCategories = ['breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee'];
      const currMealType = specificMealCategories.find(m => currTitle.includes(m) || (act.category || '').toLowerCase().includes(m));
      const prevMealType = specificMealCategories.find(m => prevTitle.includes(m) || (prevAct.category || '').toLowerCase().includes(m));
      const currIsGenericDining = !currMealType && (act.category || '').toLowerCase().includes('dining');
      const prevIsGenericDining = !prevMealType && (prevAct.category || '').toLowerCase().includes('dining');

      if (!currIsTransportLike && !prevIsTransportLike && currMealType && prevMealType && currMealType === prevMealType) {
        if (isSmartFinish) {
          warnings.push(`Activities ${i} and ${i + 1} are both "${currMealType}" meals - consider variety`);
        } else {
          errors.push(`Activities ${i} and ${i + 1} are both "${currMealType}" meals - NEVER schedule two ${currMealType} spots back-to-back`);
        }
      } else if (!currIsTransportLike && !prevIsTransportLike && currIsGenericDining && prevIsGenericDining) {
        warnings.push(`Activities ${i} and ${i + 1} are both dining entries - consider more variety`);
      }

      const skipCategories = ['transport', 'accommodation', 'downtime', 'free_time'];
      if (act.category && prevAct.category &&
          act.category.toLowerCase() === prevAct.category.toLowerCase() &&
          !skipCategories.includes(act.category.toLowerCase())) {
        warnings.push(`Activities ${i} and ${i + 1} are both "${act.category}" - consider more variety`);
      }
    }
  }

  // ==========================================================================
  // REQUIRED MEAL COUNT VALIDATION — driven by shared meal policy
  // ==========================================================================
  const requiredMealsForDay = resolveRequiredMealsForValidation(isFirstDay, isLastDay, requiredMealsOverride);
  const detectedMeals = detectMealSlots(day.activities || []);

  if (requiredMealsForDay.length > 0 && day.activities?.length) {
    for (const mealType of requiredMealsForDay) {
      if (!detectedMeals.includes(mealType)) {
        if (isSmartFinish) {
          warnings.push(
            `MISSING MEAL: Day ${dayNumber} is missing ${mealType.toUpperCase()} - consider adding a ${mealType} dining activity.`
          );
        } else {
          errors.push(
            `MISSING MEAL: Day ${dayNumber} is missing ${mealType.toUpperCase()}. Required meals for this day are [${requiredMealsForDay.join(', ')}]. Add a clearly labeled ${mealType} dining activity at a real restaurant or café.`
          );
        }
      }
    }
  }

  // Day-level variety rules
  if (day.activities?.length) {
    const types = day.activities.map(getExperienceType);
    const culinaryCount = types.filter(t => t === 'culinary_class').length;
    if (culinaryCount > 1) {
      if (isSmartFinish) {
        warnings.push(`Multiple culinary classes on one day (found ${culinaryCount}) - consider variety`);
      } else {
        errors.push(`VARIETY RULE VIOLATION: Only ONE culinary class/workshop is allowed per day (found ${culinaryCount}).`);
      }
    }
  }

  // Trip-wide uniqueness rules
  if (previousDays.length > 0 && day.activities?.length) {
    const previousConcepts = new Set<string>();
    const previousExperienceTypes: Record<string, number> = {};
    const previousLocations = new Set<string>();
    for (const prevDay of previousDays) {
      for (const prevAct of prevDay.activities || []) {
        const concept = extractConcept(normalizeText(prevAct.title || ''));
        if (concept.length > 5) previousConcepts.add(concept);
        const expType = getExperienceType(prevAct);
        previousExperienceTypes[expType] = (previousExperienceTypes[expType] || 0) + 1;
        // Build location set for cross-day location dedup
        const locName = normalizeText(prevAct.location?.name || '');
        if (locName.length > 5) previousLocations.add(locName);
      }
    }

    const LOGISTICAL_PATTERNS = /\b(free time|relax|reset|freshen|check.?in|check.?out|transfer|transit|break|settle|unpack|pack|depart|arrival|airport|taxi|uber|rideshare|metro|bus|train)\b/i;

    for (const act of day.activities) {
      const actConcept = extractConcept(normalizeText(act.title || ''));
      const actType = getExperienceType(act);
      const actTitle = (act.title || '').toLowerCase();

      if (actType === 'transport' || actType === 'accommodation') continue;
      if (LOGISTICAL_PATTERNS.test(actTitle)) continue;

      // Cross-day location dedup: same physical venue on different days
      const actLocName = normalizeText(act.location?.name || '');
      if (actLocName.length > 5 && previousLocations.has(actLocName)) {
        if (!isRecurringEvent(act, mustDoActivities)) {
          errors.push(`TRIP-WIDE DUPLICATE: "${act.title}" visits the same location ("${act.location?.name}") as a previous day.`);
          continue;
        }
      }

      // Meal-specific dedup: flag if same restaurant name appears on previous days
      if (actType === 'dining') {
        for (const prevConcept of previousConcepts) {
          if (conceptSimilarity(actConcept, prevConcept)) {
            if (isRecurringEvent(act, mustDoActivities)) continue;
            if (isSmartFinish) {
              warnings.push(`MEAL REPEAT: "${act.title}" is similar to a meal from a previous day - consider variety`);
            } else {
              errors.push(`MEAL REPEAT: "${act.title}" is too similar to a meal from a previous day. Each day should feature DIFFERENT restaurants.`);
            }
            break;
          }
        }
        continue; // Skip non-meal dedup checks for dining
      }

      for (const prevConcept of previousConcepts) {
        if (conceptSimilarity(actConcept, prevConcept)) {
          if (isRecurringEvent(act, mustDoActivities)) continue;
          if (isSmartFinish) {
            warnings.push(`Trip-wide similarity: "${act.title}" resembles a previous day's activity. Consider more variety.`);
          } else {
            errors.push(`TRIP-WIDE DUPLICATE: "${act.title}" is too similar to an activity from a previous day.`);
          }
          break;
        }
      }

      if (actType === 'culinary_class' && (previousExperienceTypes['culinary_class'] || 0) >= 1) {
        if (isSmartFinish) {
          warnings.push(`Trip already has a culinary class — consider variety.`);
        } else {
          errors.push(`TRIP-WIDE LIMIT: A culinary class/workshop was already scheduled on a previous day. Only ONE culinary class/workshop is allowed per ENTIRE TRIP.`);
        }
      }
      if (actType === 'wine_tasting' && (previousExperienceTypes['wine_tasting'] || 0) >= 1) {
        if (isSmartFinish) {
          warnings.push(`Trip already has a wine tasting — consider variety.`);
        } else {
          errors.push(`TRIP-WIDE LIMIT: A wine tasting was already scheduled on a previous day. Only ONE wine tasting is allowed per ENTIRE TRIP.`);
        }
      }
      if (actType === 'walking_tour' && (previousExperienceTypes['walking_tour'] || 0) >= 2) {
        warnings.push(`Trip has ${previousExperienceTypes['walking_tour']! + 1} walking tours total. Consider more variety.`);
      }
      if (actType === 'museum_gallery' && (previousExperienceTypes['museum_gallery'] || 0) >= 3) {
        warnings.push(`Trip has ${previousExperienceTypes['museum_gallery']! + 1} museums/galleries total. Consider more variety.`);
      }
    }
  }

  if (isFirstDay) {
    // Arrival and transfer are handled by the Arrival Game Plan UI — only validate check-in
    const hasCheckin = day.activities?.some(a =>
      (a.title || '').toLowerCase().includes('check-in') || (a.title || '').toLowerCase().includes('checkin')
    );
    if (!hasCheckin) warnings.push('Day 1 should include hotel check-in');
  }

  if (isLastDay && totalDays > 1) {
    const hasCheckout = day.activities?.some(a =>
      (a.title || '').toLowerCase().includes('check-out') || (a.title || '').toLowerCase().includes('checkout')
    );
    const hasDeparture = day.activities?.some(a =>
      (a.title || '').toLowerCase().includes('departure') ||
      ((a.category === 'transport') && (a.title || '').toLowerCase().includes('airport'))
    );

    const checkoutAct = day.activities?.find(a => {
      const t = (a.title || '').toLowerCase();
      return t.includes('checkout') || t.includes('check-out') || t.includes('check out');
    });
    const airportAct = day.activities?.find(a => {
      const t = (a.title || '').toLowerCase();
      const isAirportish = t.includes('airport') || t.includes('departure transfer');
      const isTransportish = (a.category === 'transport') || t.includes('transfer') || t.includes('departure');
      return isAirportish && isTransportish;
    });

    const checkoutMins = checkoutAct?.startTime ? parseTimeToMinutesLocal(checkoutAct.startTime) : null;
    const airportMins = airportAct?.startTime ? parseTimeToMinutesLocal(airportAct.startTime) : null;
    if (checkoutMins !== null && airportMins !== null && checkoutMins > airportMins) {
      if (isSmartFinish) {
        warnings.push('Departure day sequence: Hotel checkout should occur before airport transfer.');
      } else {
        errors.push('Departure day sequence violation: Hotel checkout must occur before airport transfer.');
      }
    }

    if (!hasCheckout) {
      if (isSmartFinish) {
        warnings.push('Last day should include hotel checkout activity');
      } else {
        errors.push('Last day MUST include hotel checkout activity');
      }
    }
    if (!hasDeparture) {
      if (isSmartFinish) {
        warnings.push('Last day should end with departure/airport transfer activity');
      } else {
        errors.push('Last day MUST end with departure/airport transfer activity');
      }
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

// =============================================================================
// GEOGRAPHIC SYNONYM STRIPPING — Removes keyword-stuffed location synonyms
// =============================================================================
const GEO_SYNONYMS = new Set([
  'borough', 'town', 'place', 'locale', 'district', 'quarter', 'sector',
  'area', 'neighborhood', 'neighbourhood', 'zone', 'region', 'vicinity',
  'suburb', 'precinct', 'ward', 'enclave', 'territory', 'locality',
]);

/**
 * Sanitize activity titles: strip geographic synonym stuffing and cap length.
 * Call after generation, before persistence.
 */
export function sanitizeActivityTitles(day: StrictDayMinimal): StrictDayMinimal {
  if (!day.activities?.length) return day;

  for (const act of day.activities) {
    if (!act.title) continue;
    let title = act.title;

    // Check for geographic synonym cluster (3+ geo synonyms in title)
    const words = title.split(/\s+/);
    const geoMatches = words.filter(w => GEO_SYNONYMS.has(w.toLowerCase()));
    if (geoMatches.length >= 3) {
      // Find first geo synonym and truncate before it
      const firstGeoIdx = words.findIndex(w => GEO_SYNONYMS.has(w.toLowerCase()));
      if (firstGeoIdx > 0) {
        title = words.slice(0, firstGeoIdx).join(' ');
      }
    }

    // Cap at 60 characters
    if (title.length > 60) {
      title = title.substring(0, 57).replace(/\s+\S*$/, '') + '...';
    }

    act.title = title.trim() || act.title;
    act.name = act.title;
  }

  return day;
}

/**
 * POST-VALIDATION: Strip duplicate activities from a day.
 * Now meal-safe: will NOT remove a dining activity if it is the only instance
 * of a required meal slot for the day.
 */
export function deduplicateActivities(
  day: StrictDayMinimal,
  requiredMeals: RequiredMeal[] = []
): { day: StrictDayMinimal; removed: string[] } {
  if (!day.activities || day.activities.length <= 1) {
    return { day, removed: [] };
  }

  const removed: string[] = [];
  const kept: StrictActivityMinimal[] = [];
  const seenConcepts = new Set<string>();
  const seenLocations = new Set<string>();
  const seenTitles = new Set<string>();

  const normalizeText = (input: string): string => {
    return (input || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const extractConcept = (title: string): string => {
    const conceptPart = normalizeText(title).split(/\s+at\s+|\s+with\s+|\s+@\s+|\s+in\s+/i)[0];
    return conceptPart
      .replace(/\b(class|tour|experience|visit|workshop|session|lesson|masterclass)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const repeatableCategories = ['transport', 'accommodation', 'downtime', 'free_time'];

  // Pre-count meal slots so we know which meals only have one provider
  const mealProviders: Record<RequiredMeal, StrictActivityMinimal[]> = {
    breakfast: [], lunch: [], dinner: [],
  };
  if (requiredMeals.length > 0) {
    for (const act of day.activities) {
      const cat = (act.category || '').toLowerCase();
      if (!cat.includes('dining')) continue;
      const title = (act.title || '').toLowerCase();
      for (const meal of requiredMeals) {
        if (MEAL_KEYWORDS[meal].some(kw => title.includes(kw))) {
          mealProviders[meal].push(act);
        }
      }
    }
  }

  for (const act of day.activities) {
    const category = (act.category || '').toLowerCase();
    if (repeatableCategories.includes(category)) {
      kept.push(act);
      continue;
    }

    const concept = extractConcept(act.title || '');
    const locationKey = normalizeText(act.location?.name || '') + '|' + normalizeText(act.location?.address || '');
    const normalTitle = normalizeText(act.title || '');

    let isDuplicate = false;
    if (normalTitle.length > 5 && seenTitles.has(normalTitle)) {
      isDuplicate = true;
    } else if (concept.length > 3 && seenConcepts.has(concept) && locationKey.length > 3 && seenLocations.has(locationKey)) {
      isDuplicate = true;
    }

    if (isDuplicate) {
      // MEAL-SAFE CHECK: Don't remove if this is the sole provider of a required meal
      let isSoleMealProvider = false;
      if (requiredMeals.length > 0 && category.includes('dining')) {
        const actTitle = (act.title || '').toLowerCase();
        for (const meal of requiredMeals) {
          if (MEAL_KEYWORDS[meal].some(kw => actTitle.includes(kw)) && mealProviders[meal].length <= 1) {
            isSoleMealProvider = true;
            break;
          }
        }
      }
      if (isSoleMealProvider) {
        // Keep it — it's the only source for a required meal
        kept.push(act);
        if (normalTitle.length > 5) seenTitles.add(normalTitle);
        if (concept.length > 3) seenConcepts.add(concept);
        if (locationKey.length > 3) seenLocations.add(locationKey);
        continue;
      }
      removed.push(act.title || 'untitled');
      continue;
    }

    if (normalTitle.length > 5) seenTitles.add(normalTitle);
    if (concept.length > 3) seenConcepts.add(concept);
    if (locationKey.length > 3) seenLocations.add(locationKey);
    kept.push(act);
  }

  if (removed.length > 0) {
    return { day: { ...day, activities: kept }, removed };
  }
  return { day, removed: [] };
}

// =============================================================================
// FINAL MEAL GUARD — The last line of defense before any day is returned/saved
// =============================================================================
// This function MUST be called after ALL post-processing (dedup, personalization
// stripping, opening hours removal, etc.) and BEFORE returning/persisting the day.
// It detects missing required meals and injects fallback dining activities.
// =============================================================================

export interface MealGuardResult {
  activities: StrictActivityMinimal[];
  injectedMeals: RequiredMeal[];
  alreadyCompliant: boolean;
}

// Destination-aware fallback suggestions keyed by city keyword
const DESTINATION_MEAL_HINTS: Record<string, Record<RequiredMeal, { venueSuffix: string; description: string }>> = {
  tokyo: {
    breakfast: { venueSuffix: 'kissaten (traditional coffee house)', description: 'Traditional Japanese morning set (モーニング) at a neighborhood kissaten — toast, egg, coffee' },
    lunch: { venueSuffix: 'ramen shop', description: 'Steaming bowl of ramen or a teishoku (set meal) at a local shokudō' },
    dinner: { venueSuffix: 'izakaya', description: 'Grilled skewers, small plates, and draft beer at a lively izakaya' },
  },
  paris: {
    breakfast: { venueSuffix: 'boulangerie-café', description: 'Fresh croissant and café crème at a neighborhood boulangerie' },
    lunch: { venueSuffix: 'bistro', description: 'Plat du jour at a classic Parisian bistro' },
    dinner: { venueSuffix: 'brasserie', description: 'French brasserie dinner — steak frites, wine, and people-watching' },
  },
  rome: {
    breakfast: { venueSuffix: 'bar-pasticceria', description: 'Cornetto and cappuccino standing at the bar — the Italian way' },
    lunch: { venueSuffix: 'trattoria', description: 'Fresh pasta and house wine at a neighborhood trattoria' },
    dinner: { venueSuffix: 'ristorante', description: 'Roman classics — cacio e pepe, supplì, and local wine' },
  },
  london: {
    breakfast: { venueSuffix: 'café', description: 'Full English or avocado toast at a neighborhood café' },
    lunch: { venueSuffix: 'gastropub', description: 'Pub lunch with craft beer at a local gastropub' },
    dinner: { venueSuffix: 'restaurant', description: 'Dinner at a well-reviewed neighborhood restaurant' },
  },
  bangkok: {
    breakfast: { venueSuffix: 'street stall', description: 'Jok (rice porridge) or pa-tong-ko at a morning street stall' },
    lunch: { venueSuffix: 'shophouse restaurant', description: 'Pad kra pao or som tum at a bustling shophouse restaurant' },
    dinner: { venueSuffix: 'riverside restaurant', description: 'Thai seafood dinner with river views' },
  },
};

function getDestinationHint(destination: string, mealType: RequiredMeal): { venueSuffix: string; description: string } {
  const destLower = destination.toLowerCase();
  for (const [key, hints] of Object.entries(DESTINATION_MEAL_HINTS)) {
    if (destLower.includes(key)) return hints[mealType];
  }
  // Generic but better than "Local Café"
  const generic: Record<RequiredMeal, { venueSuffix: string; description: string }> = {
    breakfast: { venueSuffix: 'local spot', description: 'Morning coffee and a local breakfast — check recent reviews for top-rated options nearby' },
    lunch: { venueSuffix: 'local spot', description: 'Midday meal at a well-reviewed local spot — explore the area for great options' },
    dinner: { venueSuffix: 'local spot', description: 'Evening dinner at a popular local restaurant — reservations recommended' },
  };
  return generic[mealType];
}

export function enforceRequiredMealsFinalGuard(
  activities: StrictActivityMinimal[],
  requiredMeals: RequiredMeal[],
  dayNumber: number,
  destination: string,
  currency: string = 'USD',
  dayMode: string = 'unknown',
  fallbackVenues: Array<{ name: string; address: string; mealType: string }> = [],
): MealGuardResult {
  if (requiredMeals.length === 0) {
    return { activities, injectedMeals: [], alreadyCompliant: true };
  }

  // Pre-filter: remove any chain restaurants from fallbackVenues
  const cleanFallbackVenues = fallbackVenues.filter(v => !isChainRestaurant(v.name));
  if (cleanFallbackVenues.length < fallbackVenues.length) {
    console.warn(`[MEAL FINAL GUARD] Day ${dayNumber}: Stripped ${fallbackVenues.length - cleanFallbackVenues.length} chain(s) from fallback venues`);
  }
  fallbackVenues = cleanFallbackVenues;

  const detected = detectMealSlots(activities);

  // PRE-PASS 0: Relabel any meal whose title contradicts its time slot
  // e.g. "Lunch at X" at 08:30 → "Breakfast at X"
  const MEAL_LABEL_MAP: Record<string, string[]> = {
    breakfast: ['breakfast', 'brunch'],
    lunch: ['lunch'],
    dinner: ['dinner', 'supper'],
  };
  for (const act of activities) {
    const titleLower = (act.title || '').toLowerCase();
    const cat = (act.category || '').toLowerCase();
    if (!cat.includes('dining') && !cat.includes('food') && !cat.includes('restaurant')) continue;

    const startMins = parseTimeToMinutesLocal(act.startTime || '');
    if (startMins === null) continue;

    // Determine correct meal for this time
    let correctMeal: string | null = null;
    if (startMins >= 360 && startMins < 660) correctMeal = 'breakfast';
    else if (startMins >= 660 && startMins < 900) correctMeal = 'lunch';
    else if (startMins >= 1020 && startMins < 1380) correctMeal = 'dinner';
    if (!correctMeal) continue;

    // Find current meal keyword in title
    let currentMealKey: string | null = null;
    let currentKeyword: string | null = null;
    for (const [meal, kws] of Object.entries(MEAL_LABEL_MAP)) {
      for (const kw of kws) {
        if (titleLower.includes(kw)) {
          currentMealKey = meal;
          currentKeyword = kw;
          break;
        }
      }
      if (currentMealKey) break;
    }

    if (currentMealKey && currentMealKey !== correctMeal && currentKeyword) {
      const correctLabel = correctMeal.charAt(0).toUpperCase() + correctMeal.slice(1);
      const before = act.title;
      const regex = new RegExp(`\\b${currentKeyword}\\b`, 'i');
      act.title = act.title.replace(regex, (match: string) =>
        match[0] === match[0].toUpperCase() ? correctLabel : correctLabel.toLowerCase()
      );
      if ((act as any).name) (act as any).name = act.title;
      console.log(`[MEAL FINAL GUARD] Day ${dayNumber}: Relabeled "${before}" → "${act.title}" (time ${act.startTime})`);
    }
  }

  // PRE-PASS 1: Deduplicate same-meal activities before injecting missing ones
  // This prevents the guard from seeing "dinner exists" when there are two dinners
  // and then NOT injecting the actually-missing lunch
  const mealActivityMap: Record<RequiredMeal, number[]> = { breakfast: [], lunch: [], dinner: [] };
  for (let i = 0; i < activities.length; i++) {
    const title = (activities[i].title || '').toLowerCase();
    const cat = (activities[i].category || '').toLowerCase();
    if (!cat.includes('dining') && !cat.includes('food') && !cat.includes('restaurant')) continue;
    for (const meal of ['breakfast', 'lunch', 'dinner'] as RequiredMeal[]) {
      if (MEAL_KEYWORDS[meal].some(kw => title.includes(kw))) {
        mealActivityMap[meal].push(i);
      }
    }
  }

  // Remove extra duplicates of the same meal (keep first, remove rest)
  const indicesToRemove: number[] = [];
  for (const [meal, indices] of Object.entries(mealActivityMap)) {
    if (indices.length > 1) {
      console.warn(`[MEAL FINAL GUARD] Day ${dayNumber}: Found ${indices.length} ${meal} activities — keeping first, removing ${indices.length - 1} duplicate(s)`);
      for (let j = 1; j < indices.length; j++) {
        indicesToRemove.push(indices[j]);
      }
    }
  }

  // Remove in reverse to preserve indices
  if (indicesToRemove.length > 0) {
    const sorted = [...new Set(indicesToRemove)].sort((a, b) => b - a);
    for (const idx of sorted) {
      const removed = activities[idx];
      console.log(`[MEAL FINAL GUARD] Day ${dayNumber}: Removing duplicate meal "${removed?.title}"`);
      activities.splice(idx, 1);
    }
  }

  // Re-detect after dedup
  const detectedAfterDedup = detectMealSlots(activities);
  const missing = requiredMeals.filter(meal => !detectedAfterDedup.includes(meal));

  if (missing.length === 0) {
    return { activities, injectedMeals: [], alreadyCompliant: true };
  }

  console.warn(
    `[MEAL FINAL GUARD] Day ${dayNumber}: ` +
    `required=[${requiredMeals.join(',')}], detected=[${detected.join(',')}], ` +
    `MISSING=[${missing.join(',')}] — injecting ${fallbackVenues.length > 0 ? 'REAL VENUE' : 'destination-aware'} fallback meals (dayMode=${dayMode})`
  );

  const fallbackTimes: Record<RequiredMeal, { start: string; end: string; cost: number }> = {
    breakfast: { start: '08:30', end: '09:15', cost: 12 },
    lunch:     { start: '12:30', end: '13:30', cost: 18 },
    dinner:    { start: '19:00', end: '20:15', cost: 30 },
  };

  // Track which venue names have been used to avoid duplicates within this guard call
  const usedVenueNames = new Set<string>(
    activities.map(a => (a.title || '').toLowerCase())
  );

  const result = [...activities];

  for (const mealType of missing) {
    const slot = fallbackTimes[mealType];
    const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);

    // TRY 1: Use a real venue from fallbackVenues
    let venueName: string | null = null;
    let venueAddress: string = destination;
    let venueDescription: string = '';

    // Find matching venue: prefer specific meal type, then 'any'
    const matchingVenues = fallbackVenues.filter(v =>
      (v.mealType === mealType || v.mealType === 'any') &&
      !usedVenueNames.has(v.name.toLowerCase())
    );
    // Prefer meal-type-specific matches first
    const specificMatch = matchingVenues.find(v => v.mealType === mealType);
    const venue = specificMatch || matchingVenues[0];

    if (venue) {
      venueName = venue.name;
      venueAddress = venue.address || destination;
      venueDescription = `${label} at ${venue.name} — a real local spot worth visiting`;
      usedVenueNames.add(venue.name.toLowerCase());
      // Remove from fallbackVenues so next meal gets a different one
      const idx = fallbackVenues.indexOf(venue);
      if (idx >= 0) fallbackVenues.splice(idx, 1);
      console.log(`[MEAL FINAL GUARD] Day ${dayNumber}: Using REAL venue "${venue.name}" for ${mealType}`);
    }

    // TRY 2: Fall back to destination-aware hints — use venue TYPE, never "${Meal} in ${City}"
    if (!venueName) {
      const hint = getDestinationHint(destination, mealType);
      // Use the venue type suffix (e.g. "bistro", "trattoria", "izakaya") instead of city name
      venueName = `${label} at a ${hint.venueSuffix}`;
      venueDescription = hint.description;
      console.warn(`[MEAL FINAL GUARD] Day ${dayNumber}: No real venue for ${mealType} — using type-based fallback "${venueName}" (needs refinement)`);
    }

    result.push({
      id: crypto.randomUUID(),
      title: venueName!.startsWith(label) ? venueName! : `${label}: ${venueName}`,
      startTime: slot.start,
      endTime: slot.end,
      category: 'dining',
      location: { name: venueName!, address: venueAddress },
      cost: { amount: slot.cost, currency, source: 'meal_guard_fallback' } as any,
      description: venueDescription,
      tags: ['dining', mealType, 'meal-guard'],
      bookingRequired: false,
      transportation: { method: 'walk', duration: '5 min', estimatedCost: { amount: 0, currency }, instructions: 'Short walk from the previous activity' },
      tips: venue
        ? `Recommended by our venue database — confirm hours before visiting.`
        : `Explore local options near your next activity — ask a local or check recent reviews.`,
      needsRefinement: !venue,
    } as StrictActivityMinimal);
  }

  // Sort by startTime
  result.sort((a, b) => {
    const parseMin = (t: string) => {
      const m = (t || '').match(/(\d{1,2}):(\d{2})/);
      return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
    };
    return parseMin(a.startTime) - parseMin(b.startTime);
  });

  const afterDetected = detectMealSlots(result);
  console.log(
    `[MEAL FINAL GUARD] Day ${dayNumber}: after injection detected=[${afterDetected.join(',')}]`
  );

  return { activities: result, injectedMeals: missing, alreadyCompliant: false };
}
