// =============================================================================
// DAY VALIDATION — Extracted from index.ts to reduce bundle size
// =============================================================================

import { isRecurringEvent } from './currency-utils.ts';

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
  mustDoActivities: string[] = []
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

  const conceptSimilarity = (a: string, b: string): boolean => {
    if (!a || !b || a.length < 5 || b.length < 5) return false;
    if (a === b) return true;
    const mealKeywords = ['lunch', 'dinner', 'breakfast', 'brunch', 'coffee', 'cafe', 'dessert', 'snack', 'food', 'eat', 'meal', 'drinks', 'cocktail', 'bar'];
    const aHasMeal = mealKeywords.some(kw => a.includes(kw));
    const bHasMeal = mealKeywords.some(kw => b.includes(kw));
    if (aHasMeal !== bHasMeal) return false;
    if (a.includes(b) || b.includes(a)) return true;
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
        errors.push(`Back-to-back culinary classes are not allowed: "${prevAct.title}" followed by "${act.title}"`);
      }

      const specificMealCategories = ['breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee'];
      const currMealType = specificMealCategories.find(m => currTitle.includes(m) || (act.category || '').toLowerCase().includes(m));
      const prevMealType = specificMealCategories.find(m => prevTitle.includes(m) || (prevAct.category || '').toLowerCase().includes(m));
      const currIsGenericDining = !currMealType && (act.category || '').toLowerCase().includes('dining');
      const prevIsGenericDining = !prevMealType && (prevAct.category || '').toLowerCase().includes('dining');

      if (!currIsTransportLike && !prevIsTransportLike && currMealType && prevMealType && currMealType === prevMealType) {
        errors.push(`Activities ${i} and ${i + 1} are both "${currMealType}" meals - NEVER schedule two ${currMealType} spots back-to-back`);
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

  // Day-level variety rules
  if (day.activities?.length) {
    const types = day.activities.map(getExperienceType);
    const culinaryCount = types.filter(t => t === 'culinary_class').length;
    if (culinaryCount > 1) {
      errors.push(`VARIETY RULE VIOLATION: Only ONE culinary class/workshop is allowed per day (found ${culinaryCount}).`);
    }
  }

  // Trip-wide uniqueness rules
  if (previousDays.length > 0 && day.activities?.length) {
    const previousConcepts = new Set<string>();
    const previousExperienceTypes: Record<string, number> = {};
    for (const prevDay of previousDays) {
      for (const prevAct of prevDay.activities || []) {
        const concept = extractConcept(normalizeText(prevAct.title || ''));
        if (concept.length > 5) previousConcepts.add(concept);
        const expType = getExperienceType(prevAct);
        previousExperienceTypes[expType] = (previousExperienceTypes[expType] || 0) + 1;
      }
    }

    const LOGISTICAL_PATTERNS = /\b(free time|relax|reset|freshen|check.?in|check.?out|transfer|transit|break|settle|unpack|pack|depart|arrival|airport|taxi|uber|rideshare|metro|bus|train)\b/i;

    for (const act of day.activities) {
      const actConcept = extractConcept(normalizeText(act.title || ''));
      const actType = getExperienceType(act);
      const actTitle = (act.title || '').toLowerCase();

      if (actType === 'transport' || actType === 'accommodation' || actType === 'dining') continue;
      if (LOGISTICAL_PATTERNS.test(actTitle)) continue;

      for (const prevConcept of previousConcepts) {
        if (conceptSimilarity(actConcept, prevConcept)) {
          if (isRecurringEvent(act, mustDoActivities)) continue;
          if (!isSmartFinish && (actType === 'culinary_class' || actType === 'wine_tasting')) {
            errors.push(`TRIP-WIDE DUPLICATE: "${act.title}" is too similar to an activity from a previous day.`);
          } else {
            warnings.push(`Trip-wide similarity: "${act.title}" resembles a previous day's activity. Consider more variety.`);
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
      errors.push('Departure day sequence violation: Hotel checkout must occur before airport transfer.');
    }

    if (!hasCheckout) errors.push('Last day MUST include hotel checkout activity');
    if (!hasDeparture) errors.push('Last day MUST end with departure/airport transfer activity');
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * POST-VALIDATION: Strip duplicate activities from a day.
 */
export function deduplicateActivities(day: StrictDayMinimal): { day: StrictDayMinimal; removed: string[] } {
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

  for (const act of day.activities) {
    const category = (act.category || '').toLowerCase();
    if (repeatableCategories.includes(category)) {
      kept.push(act);
      continue;
    }

    const concept = extractConcept(act.title || '');
    const locationKey = normalizeText(act.location?.name || '') + '|' + normalizeText(act.location?.address || '');
    const normalTitle = normalizeText(act.title || '');

    if (normalTitle.length > 5 && seenTitles.has(normalTitle)) {
      removed.push(act.title || 'untitled');
      continue;
    }
    if (concept.length > 3 && seenConcepts.has(concept) && locationKey.length > 3 && seenLocations.has(locationKey)) {
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
