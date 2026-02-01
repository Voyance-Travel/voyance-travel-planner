/**
 * Trip Duration Rules
 * 
 * Implements energy arcs based on trip length:
 * - Weekend trips: Higher intensity OK
 * - Week trips: Include mid-trip lighter day
 * - Extended trips: Multiple rest days, sustainable pacing
 */

export interface TripDurationConfig {
  category: 'weekend' | 'short' | 'week' | 'extended' | 'long';
  pacingModifier: number;
  includeRestDays: number[];  // Day numbers that should be lighter
  midTripSlump?: number;      // Day number where energy typically dips
  description: string;
  constraints: string[];
}

export interface DayEnergyLevel {
  dayNumber: number;
  energyLevel: 'arrival' | 'low' | 'moderate' | 'high' | 'recovery' | 'departure';
  maxActivities: number;
  description: string;
  isRestDay?: boolean;
}

/**
 * Get trip duration configuration based on total days
 */
export function getTripDurationConfig(totalDays: number): TripDurationConfig {
  if (totalDays <= 3) {
    return {
      category: 'weekend',
      pacingModifier: 1, // Slightly higher intensity OK
      includeRestDays: [],
      description: 'Short trip - make every moment count but avoid exhaustion',
      constraints: [
        'Focus over variety - prioritize top 3-5 experiences',
        'No mid-trip rest needed',
        'Every hour counts but don\'t marathon',
      ]
    };
  }
  
  if (totalDays <= 5) {
    return {
      category: 'short',
      pacingModifier: 0,
      includeRestDays: [],
      description: 'Sweet spot for city trips - balanced highlights and discovery',
      constraints: [
        'Good balance of highlights and depth',
        'Some rest built into natural rhythm',
      ]
    };
  }
  
  if (totalDays <= 8) {
    return {
      category: 'week',
      pacingModifier: 0,
      includeRestDays: [Math.floor(totalDays / 2)], // Middle day lighter
      midTripSlump: Math.floor(totalDays / 2),
      description: 'Week trip - include one mid-trip recovery day',
      constraints: [
        'Include 1 lighter "recovery" day mid-trip',
        `Day ${Math.floor(totalDays / 2)} should be less intense`,
        'Mix of highlights, neighborhoods, maybe a day trip',
      ]
    };
  }
  
  if (totalDays <= 14) {
    return {
      category: 'extended',
      pacingModifier: -1,
      includeRestDays: [5, 10].filter(d => d <= totalDays), // Rest days at 5 and 10
      midTripSlump: 7,
      description: 'Extended trip - must build in rest days to avoid burnout',
      constraints: [
        'Day 7-8 slump is REAL - plan lighter activities',
        'Include at least 2 lighter/rest days',
        'Don\'t front-load all the big activities',
        'Mix of full days, half days, and rest days',
      ]
    };
  }
  
  // 15+ days
  return {
    category: 'long',
    pacingModifier: -2,
    includeRestDays: [4, 8, 12, 16].filter(d => d <= totalDays), // Regular rest rhythm
    midTripSlump: 7,
    description: 'Long trip - sustainable slow travel pacing required',
    constraints: [
      'This is slow travel, not a race',
      'Rest day every 3-4 active days',
      'Include "nothing" days for spontaneity',
      'Live like a local, don\'t rush',
      'Can revisit favorites - no FOMO',
    ]
  };
}

/**
 * Calculate energy level for each day of the trip
 */
export function calculateDayEnergies(
  totalDays: number,
  hasArrivalFlight: boolean = true,
  hasDepartureFlight: boolean = true
): DayEnergyLevel[] {
  const config = getTripDurationConfig(totalDays);
  const energies: DayEnergyLevel[] = [];
  
  for (let day = 1; day <= totalDays; day++) {
    const isFirstDay = day === 1;
    const isLastDay = day === totalDays;
    const isRestDay = config.includeRestDays.includes(day);
    const isMidSlump = config.midTripSlump === day;
    
    let energyLevel: DayEnergyLevel['energyLevel'];
    let maxActivities: number;
    let description: string;
    
    if (isFirstDay && hasArrivalFlight) {
      energyLevel = 'arrival';
      maxActivities = 2;
      description = 'Arrival day - light activities only, allow for jet lag recovery';
    } else if (isLastDay && hasDepartureFlight) {
      energyLevel = 'departure';
      maxActivities = 2;
      description = 'Departure day - constrained by flight time, stay near hotel';
    } else if (isRestDay || isMidSlump) {
      energyLevel = 'recovery';
      maxActivities = 3;
      description = `Recovery day - lighter schedule to prevent burnout`;
    } else if (day === 2 || day === 3) {
      // Peak energy days early in trip
      energyLevel = 'high';
      maxActivities = 5;
      description = 'Peak energy day - can handle full schedule';
    } else if (day === totalDays - 1) {
      // Day before departure - moderate
      energyLevel = 'moderate';
      maxActivities = 4;
      description = 'Winding down - save energy for departure';
    } else {
      // Default middle days
      energyLevel = 'moderate';
      maxActivities = 4;
      description = 'Standard day - balanced activity level';
    }
    
    energies.push({
      dayNumber: day,
      energyLevel,
      maxActivities,
      description,
      isRestDay: isRestDay || isMidSlump,
    });
  }
  
  return energies;
}

/**
 * Build prompt section for trip duration rules
 */
export function buildTripDurationPrompt(
  totalDays: number,
  hasArrivalFlight: boolean = true,
  hasDepartureFlight: boolean = true
): string {
  const config = getTripDurationConfig(totalDays);
  const energies = calculateDayEnergies(totalDays, hasArrivalFlight, hasDepartureFlight);
  
  const restDaysList = config.includeRestDays.length > 0
    ? `Days ${config.includeRestDays.join(', ')}`
    : 'None required';
  
  const energyBreakdown = energies
    .map(e => `  Day ${e.dayNumber}: ${e.energyLevel.toUpperCase()} (max ${e.maxActivities} activities)${e.isRestDay ? ' ← REST DAY' : ''}`)
    .join('\n');
  
  return `
═══════════════════════════════════════════════════════════════════════════
TRIP DURATION ENERGY ARC: ${totalDays} DAYS (${config.category.toUpperCase()})
═══════════════════════════════════════════════════════════════════════════

${config.description}

Pacing adjustment: ${config.pacingModifier > 0 ? '+' : ''}${config.pacingModifier}
Designated rest/recovery days: ${restDaysList}

CONSTRAINTS:
${config.constraints.map(c => `• ${c}`).join('\n')}

DAY-BY-DAY ENERGY LEVELS:
${energyBreakdown}

${config.midTripSlump ? `
⚠️ MID-TRIP SLUMP WARNING:
Around day ${config.midTripSlump}, travelers often feel fatigued.
Schedule lighter activities or a rest day here.
` : ''}

═══════════════════════════════════════════════════════════════════════════
`;
}

/**
 * Get children age categories and their implications
 */
export interface ChildrenAgeContext {
  hasToddlers: boolean;     // 0-3 years
  hasYoungKids: boolean;    // 4-7 years
  hasOlderKids: boolean;    // 8-12 years
  hasTeens: boolean;        // 13-17 years
  youngestAge: number;
  oldestAge: number;
  constraints: string[];
  paceAdjustment: number;
}

export function analyzeChildrenAges(ages: number[]): ChildrenAgeContext | null {
  if (!ages || ages.length === 0) return null;
  
  const hasToddlers = ages.some(age => age <= 3);
  const hasYoungKids = ages.some(age => age >= 4 && age <= 7);
  const hasOlderKids = ages.some(age => age >= 8 && age <= 12);
  const hasTeens = ages.some(age => age >= 13);
  
  const constraints: string[] = [];
  let paceAdjustment = -1; // Default family adjustment
  
  if (hasToddlers) {
    constraints.push('👶 TODDLER NAP TIME: Schedule rest 13:00-15:00');
    constraints.push('👶 TODDLER MEALS: Lunch by 12:00, Dinner by 17:30');
    constraints.push('👶 TODDLER WALKING: Use strollers, minimal walking distances');
    constraints.push('👶 NO activities requiring quiet/stillness (museums, theater)');
    paceAdjustment = -3;
  }
  
  if (hasYoungKids) {
    constraints.push('👦 YOUNG KIDS: Include playground/park breaks');
    constraints.push('👦 YOUNG KIDS: Interactive, hands-on activities preferred');
    constraints.push('👦 SNACK BREAKS: Plan for mid-morning and mid-afternoon snacks');
  }
  
  if (hasOlderKids) {
    constraints.push('🧒 OLDER KIDS: Can handle longer activities but mix with active time');
    constraints.push('🧒 OLDER KIDS: Include some educational but fun experiences');
  }
  
  if (hasTeens) {
    constraints.push('🎮 TEENS: Include some independence/choice in activities');
    constraints.push('🎮 TEENS: Avoid "boring" kid activities - age-appropriate experiences');
    constraints.push('🎮 TEENS: Consider later dinner times (up to 19:00)');
    if (!hasToddlers && !hasYoungKids) {
      paceAdjustment = 0; // Teens only = more flexible
    }
  }
  
  // Mixed ages need extra consideration
  if ((hasToddlers || hasYoungKids) && hasTeens) {
    constraints.push('👨‍👩‍👧‍👦 MIXED AGES: Include split-up time for different interests');
    constraints.push('👨‍👩‍👧‍👦 MIXED AGES: Find activities that work for ALL ages');
  }
  
  return {
    hasToddlers,
    hasYoungKids,
    hasOlderKids,
    hasTeens,
    youngestAge: Math.min(...ages),
    oldestAge: Math.max(...ages),
    constraints,
    paceAdjustment,
  };
}

/**
 * Build prompt section for children ages
 */
export function buildChildrenAgesPrompt(ages: number[]): string {
  const context = analyzeChildrenAges(ages);
  if (!context) return '';
  
  const ageList = ages.join(', ');
  const ageGroups: string[] = [];
  if (context.hasToddlers) ageGroups.push('toddlers (0-3)');
  if (context.hasYoungKids) ageGroups.push('young kids (4-7)');
  if (context.hasOlderKids) ageGroups.push('older kids (8-12)');
  if (context.hasTeens) ageGroups.push('teens (13+)');
  
  return `
═══════════════════════════════════════════════════════════════════════════
CHILDREN'S AGES: ${ageList}
═══════════════════════════════════════════════════════════════════════════

Age groups present: ${ageGroups.join(', ')}
Pace adjustment: ${context.paceAdjustment}

${context.hasToddlers ? `
⚠️ TODDLER MODE ACTIVATED (age ${context.youngestAge}):
This fundamentally changes the trip. Everything revolves around nap time.
- NAP TIME IS SACRED: 13:00-15:00
- Early meals: Lunch by 12:00, Dinner by 17:30-18:00
- Maximum 2 "real" activities per day
- Hotel/rest breaks between activities
- Activities must be stroller-friendly
- No museums, no theater, no "be quiet" places
` : ''}

${context.hasTeens && !context.hasToddlers ? `
👨‍👧 TEEN-FRIENDLY MODE:
- Include activities they'll actually enjoy
- Avoid "baby" activities - they'll be mortified
- Some independence/choice is good
- Later dinner times acceptable (up to 19:00)
- Consider their interests (gaming cafes, extreme sports, etc.)
` : ''}

CONSTRAINTS:
${context.constraints.map(c => `${c}`).join('\n')}

═══════════════════════════════════════════════════════════════════════════
`;
}
