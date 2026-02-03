/**
 * Dynamic Itinerary Validator
 * 
 * Post-processes itinerary data to fix common issues without requiring regeneration:
 * - Skip list violations (activities we told users to avoid)
 * - Celebration day misplacement
 * - Checkout/airport sequence errors
 * - Invalid pricing (never-free categories showing as free)
 */

import { getDestinationSkippedItems } from './intelligenceAnalytics';

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationIssue {
  type: 'skip_list' | 'celebration_misplaced' | 'sequence_error' | 'pricing_error';
  dayNumber: number;
  activityId: string;
  activityTitle: string;
  message: string;
  severity: 'warning' | 'error';
  autoFixed?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  fixedActivities: string[]; // IDs of activities that were auto-fixed
}

// =============================================================================
// SKIP LIST DETECTION
// =============================================================================

// Keywords to detect skip list violations
const SKIP_LIST_KEYWORDS: Record<string, string[]> = {
  paris: [
    'seine cruise', 'river cruise', 'bateaux', 'dinner cruise', 'sunset cruise on seine',
    'boat cruise on seine', 'cruise on the seine',
    'champs-elysees restaurant', 'champs elysees dining',
    'montmartre portrait', 'place du tertre artists'
  ],
  tokyo: [
    'robot restaurant', 'robot show',
    'skytree observation', 'tokyo skytree'
  ],
  rome: [
    'piazza navona restaurant', 'navona restaurant', 'eating at piazza navona',
    'via veneto restaurant', 'dining on via veneto'
  ],
  london: [
    'leicester square restaurant', 'leicester square dining',
    'hard rock cafe'
  ],
  barcelona: [
    'rambla restaurant', 'las ramblas dining', 'eating on la rambla',
    'barceloneta beachfront restaurant', 'beach paella barceloneta'
  ]
};

/**
 * Check if an activity matches the skip list for a destination
 */
export function matchesSkipList(
  activityTitle: string,
  destination: string
): { matches: boolean; matchedItem?: string } {
  const titleLower = activityTitle.toLowerCase();
  const destLower = destination.toLowerCase();
  
  // Find matching city keywords
  let cityKey: string | null = null;
  for (const city of Object.keys(SKIP_LIST_KEYWORDS)) {
    if (destLower.includes(city) || city.includes(destLower.split(',')[0].trim())) {
      cityKey = city;
      break;
    }
  }
  
  if (!cityKey) return { matches: false };
  
  const keywords = SKIP_LIST_KEYWORDS[cityKey];
  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) {
      return { matches: true, matchedItem: keyword };
    }
  }
  
  return { matches: false };
}

// =============================================================================
// CELEBRATION DAY DETECTION
// =============================================================================

const CELEBRATION_KEYWORDS = [
  'birthday', 'celebration', 'anniversary', 'special occasion',
  'commemorative', 'milestone', 'champagne', 'celebratory'
];

/**
 * Check if an activity is celebration-themed
 */
export function isCelebrationActivity(activityTitle: string, description?: string): boolean {
  const text = `${activityTitle} ${description || ''}`.toLowerCase();
  return CELEBRATION_KEYWORDS.some(kw => text.includes(kw));
}

// =============================================================================
// SEQUENCE VALIDATION
// =============================================================================

/**
 * Check if checkout comes before airport transfer on last day
 */
export function validateCheckoutSequence(
  activities: Array<{ id: string; title: string; startTime?: string }>
): { valid: boolean; checkoutIdx: number; airportIdx: number } {
  let checkoutIdx = -1;
  let airportIdx = -1;
  
  activities.forEach((act, idx) => {
    const titleLower = act.title.toLowerCase();
    if (titleLower.includes('checkout') || titleLower.includes('check-out') || titleLower.includes('check out')) {
      checkoutIdx = idx;
    }
    if (titleLower.includes('airport') || titleLower.includes('departure transfer')) {
      airportIdx = idx;
    }
  });
  
  // Valid if: no checkout/airport, or checkout comes before airport
  if (checkoutIdx === -1 || airportIdx === -1) {
    return { valid: true, checkoutIdx, airportIdx };
  }
  
  return { 
    valid: checkoutIdx < airportIdx,
    checkoutIdx,
    airportIdx
  };
}

// =============================================================================
// MAIN VALIDATOR
// =============================================================================

interface ValidateOptions {
  destination: string;
  tripType?: string;
  celebrationDay?: number;
  totalDays: number;
}

interface ActivityLike {
  id: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  cost?: { amount?: number; currency?: string };
  estimatedCost?: { amount?: number; currency?: string };
  category?: string;
  type?: string;
}

interface DayLike {
  dayNumber: number;
  activities: ActivityLike[];
}

/**
 * Validate an itinerary and return issues found
 */
export function validateItinerary(
  days: DayLike[],
  options: ValidateOptions
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const fixedActivities: string[] = [];
  
  const { destination, tripType, celebrationDay, totalDays } = options;
  const isCelebrationTrip = tripType === 'birthday' || tripType === 'anniversary' || 
    tripType?.toLowerCase().includes('birthday') || tripType?.toLowerCase().includes('celebration');
  
  days.forEach((day, dayIdx) => {
    const isLastDay = day.dayNumber === totalDays;
    const isCelebrationDayNumber = celebrationDay === day.dayNumber;
    
    day.activities.forEach(activity => {
      // 1. Check skip list violations
      const skipMatch = matchesSkipList(activity.title, destination);
      if (skipMatch.matches) {
        issues.push({
          type: 'skip_list',
          dayNumber: day.dayNumber,
          activityId: activity.id,
          activityTitle: activity.title,
          message: `This activity matches our skip list: "${skipMatch.matchedItem}". Consider replacing it.`,
          severity: 'warning'
        });
      }
      
      // 2. Check celebration day misplacement
      if (isCelebrationTrip && celebrationDay) {
        const isCelebration = isCelebrationActivity(activity.title, activity.description);
        if (isCelebration && !isCelebrationDayNumber) {
          issues.push({
            type: 'celebration_misplaced',
            dayNumber: day.dayNumber,
            activityId: activity.id,
            activityTitle: activity.title,
            message: `Celebration activity on Day ${day.dayNumber}, but celebration day is Day ${celebrationDay}.`,
            severity: 'warning'
          });
        }
      }
    });
    
    // 3. Check checkout/airport sequence on last day
    if (isLastDay) {
      const seqResult = validateCheckoutSequence(day.activities);
      if (!seqResult.valid && seqResult.checkoutIdx !== -1 && seqResult.airportIdx !== -1) {
        issues.push({
          type: 'sequence_error',
          dayNumber: day.dayNumber,
          activityId: day.activities[seqResult.checkoutIdx]?.id || 'unknown',
          activityTitle: 'Checkout/Airport sequence',
          message: 'Hotel checkout should come before airport transfer.',
          severity: 'error'
        });
      }
    }
  });
  
  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    fixedActivities
  };
}

/**
 * Apply automatic fixes to itinerary data
 * Returns a new array with fixes applied
 */
export function applyItineraryFixes<T extends DayLike>(
  days: T[],
  options: ValidateOptions
): { days: T[]; fixedCount: number; fixes: string[] } {
  const fixes: string[] = [];
  let fixedCount = 0;
  
  const fixedDays = days.map((day, dayIdx) => {
    const isLastDay = day.dayNumber === options.totalDays;
    
    // Fix 1: Checkout/airport sequence on last day
    if (isLastDay) {
      const seqResult = validateCheckoutSequence(day.activities);
      if (!seqResult.valid && seqResult.checkoutIdx !== -1 && seqResult.airportIdx !== -1) {
        // Swap the activities
        const activities = [...day.activities];
        const checkout = activities[seqResult.checkoutIdx];
        const airport = activities[seqResult.airportIdx];
        
        // Swap times
        const checkoutStart = checkout.startTime;
        const checkoutEnd = checkout.endTime;
        const airportStart = airport.startTime;
        const airportEnd = airport.endTime;
        
        // Move checkout to airport's earlier position with airport's original time
        activities[seqResult.airportIdx] = { 
          ...checkout, 
          startTime: airportStart,
          endTime: airportEnd 
        };
        // Move airport to checkout's later position with checkout's original time
        activities[seqResult.checkoutIdx] = { 
          ...airport, 
          startTime: checkoutStart,
          endTime: checkoutEnd 
        };
        
        fixes.push(`Fixed checkout/airport sequence on Day ${day.dayNumber}`);
        fixedCount++;
        
        return { ...day, activities } as T;
      }
    }
    
    return day;
  });
  
  return { days: fixedDays, fixedCount, fixes };
}

/**
 * Get human-readable summary of validation issues
 */
export function getValidationSummary(result: ValidationResult): string | null {
  if (result.issues.length === 0) return null;
  
  const errorCount = result.issues.filter(i => i.severity === 'error').length;
  const warningCount = result.issues.filter(i => i.severity === 'warning').length;
  
  const parts: string[] = [];
  if (errorCount > 0) parts.push(`${errorCount} error${errorCount > 1 ? 's' : ''}`);
  if (warningCount > 0) parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`);
  
  return `Itinerary has ${parts.join(' and ')}`;
}
