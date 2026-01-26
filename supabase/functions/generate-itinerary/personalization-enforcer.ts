/**
 * PERSONALIZATION ENFORCER - Make Itineraries Impossible to be Generic
 * 
 * This module enforces hard differentiation based on user traits and validates
 * that personalization shows up in both activity selection AND schedule math.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TraitScores {
  planning: number;
  social: number;
  comfort: number;
  pace: number;
  authenticity: number;
  adventure: number;
  budget: number;
  transformation: number;
}

export interface TravelerProfile {
  id: string;
  name?: string;
  traits: Partial<TraitScores>;
  interests: string[];
  dietaryRestrictions: string[];
  mobilityNeeds?: string;
  allergies: string[];
  isPrimary: boolean;
}

export interface GroupContext {
  travelers: TravelerProfile[];
  reconciliationStrategy: ReconciliationStrategy;
  togglethernessMode: 'together' | 'some_independence' | 'very_independent';
}

export type ReconciliationStrategy = {
  hardConstraints: string[]; // Always honored (allergies, mobility, dietary)
  sharedOverlaps: string[]; // Common interests get priority
  conflictResolution: ConflictResolution[];
  attributionMap: Map<string, string[]>; // activity_id -> [traveler_ids who this serves]
};

export type ConflictResolution = {
  trait: string;
  winnersById: Map<number, string>; // dayNumber -> traveler_id who "wins" that day
};

// Required slot types based on traits
export type ForcedSlotType = 
  | 'signature_meal'      // Foodie trait
  | 'deep_context'        // History/cultural trait  
  | 'linger_block'        // Relaxed pace trait
  | 'edge_activity'       // Adventure trait
  | 'wellness_moment'     // Transformation trait
  | 'authentic_encounter' // Authenticity trait
  | 'social_experience'   // Social trait (positive)
  | 'solo_retreat'        // Social trait (negative/introvert)
  | 'vip_experience'      // Status Seeker: high comfort + budget
  | 'couples_moment'      // Romantic Curator: romantic trip or archetype
  | 'connectivity_spot'   // Digital Explorer: wifi-guaranteed venue
  | 'family_activity';    // Family Architect: kid-friendly activity

export interface ForcedSlot {
  type: ForcedSlotType;
  traitSource: keyof TraitScores | 'context'; // 'context' for non-trait-based slots
  traitValue: number;
  description: string;
  validationTags: string[]; // Tags the activity MUST have
  forTraveler?: string; // Which traveler this serves (for group trips)
}

// Additional context for deriving slots beyond just traits
export interface SlotDerivationContext {
  tripType?: string; // 'romantic', 'family', 'solo', etc.
  travelCompanions?: string[]; // ['family', 'partner', 'solo', etc.]
  hasChildren?: boolean;
  primaryArchetype?: string;
  secondaryArchetype?: string;
}

export interface ScheduleConstraints {
  maxActivitiesPerDay: number;
  minActivitiesPerDay: number;
  bufferMinutesBetweenActivities: number;
  maxWalkingDistanceMeters: number;
  maxWalkingTimeMinutes: number;
  earliestStartTime: string; // HH:MM
  latestEndTime: string; // HH:MM
  requiredMealSlots: ('breakfast' | 'lunch' | 'dinner')[];
  transitTimeBuffer: number; // Extra minutes to add for transit uncertainty
}

export interface DayValidation {
  dayNumber: number;
  requiredSlots: ForcedSlot[];
  scheduleConstraints: ScheduleConstraints;
  slotsFulfilled: ForcedSlot[];
  slotsMissing: ForcedSlot[];
  scheduleViolations: ScheduleViolation[];
  isValid: boolean;
}

export interface ScheduleViolation {
  type: 'too_many_activities' | 'too_few_activities' | 'walking_exceeded' | 
        'insufficient_buffer' | 'overlapping_times' | 'missing_meal' | 
        'pace_mismatch' | 'transit_time_invalid';
  details: string;
  severity: 'critical' | 'major' | 'minor';
}

// =============================================================================
// FORCED DIFFERENTIATORS - Require trait-specific slots per day
// =============================================================================

/**
 * Derive forced slots for a day based on trait scores
 * These slots MUST appear in the itinerary or it fails validation
 */
export function deriveForcedSlots(
  traits: Partial<TraitScores>,
  interests: string[],
  dayNumber: number,
  totalDays: number,
  context?: SlotDerivationContext
): ForcedSlot[] {
  const slots: ForcedSlot[] = [];
  
  // Foodie detection (from interests or food-related traits)
  const isFoodie = interests.some(i => 
    ['food', 'culinary', 'wine', 'gastronomy', 'cooking', 'restaurants', 'foodie'].includes(i.toLowerCase())
  );
  if (isFoodie) {
    slots.push({
      type: 'signature_meal',
      traitSource: 'authenticity', // Food lovers care about authentic experiences
      traitValue: traits.authenticity || 0,
      description: 'One signature meal experience (specific cuisine + vibe + price level)',
      validationTags: ['signature-dining', 'culinary', 'foodie', 'local-cuisine', 'must-try', 'renowned']
    });
  }
  
  // History buff detection
  const isHistoryBuff = interests.some(i =>
    ['history', 'museums', 'heritage', 'archaeology', 'architecture', 'historical', 'cultural'].includes(i.toLowerCase())
  );
  if (isHistoryBuff) {
    slots.push({
      type: 'deep_context',
      traitSource: 'transformation',
      traitValue: traits.transformation || 0,
      description: 'One deep context stop (museum/neighborhood with historical significance)',
      validationTags: ['historical', 'museum', 'heritage', 'cultural-site', 'landmark', 'architecture']
    });
  }
  
  // Relaxed pace (trait <= -3 means relaxed)
  if ((traits.pace ?? 0) <= -3) {
    slots.push({
      type: 'linger_block',
      traitSource: 'pace',
      traitValue: traits.pace || 0,
      description: 'One linger block (café, spa, scenic sit - min 90 minutes)',
      validationTags: ['relaxation', 'café', 'spa', 'scenic', 'leisure', 'slow-pace', 'unwind']
    });
  }
  
  // Adventurous (trait >= 4 means adventurous)
  if ((traits.adventure ?? 0) >= 4) {
    // Don't require edge activity every day - alternate
    if (dayNumber % 2 === 1 || dayNumber === 1) {
      slots.push({
        type: 'edge_activity',
        traitSource: 'adventure',
        traitValue: traits.adventure || 0,
        description: 'One edge activity (bolder experience, not dangerous)',
        validationTags: ['adventure', 'outdoor', 'active', 'unique', 'off-beaten-path', 'thrill']
      });
    }
  }
  
  // High transformation seekers
  if ((traits.transformation ?? 0) >= 4) {
    slots.push({
      type: 'wellness_moment',
      traitSource: 'transformation',
      traitValue: traits.transformation || 0,
      description: 'One wellness or growth-focused moment',
      validationTags: ['wellness', 'meditation', 'yoga', 'spa', 'reflection', 'nature', 'mindfulness']
    });
  }
  
  // High authenticity seekers
  if ((traits.authenticity ?? 0) >= 4) {
    slots.push({
      type: 'authentic_encounter',
      traitSource: 'authenticity',
      traitValue: traits.authenticity || 0,
      description: 'One truly local, non-touristy experience',
      validationTags: ['local', 'authentic', 'hidden-gem', 'neighborhood', 'traditional', 'off-beaten-path']
    });
  }
  
  // Social extroverts (positive social score)
  if ((traits.social ?? 0) >= 4) {
    slots.push({
      type: 'social_experience',
      traitSource: 'social',
      traitValue: traits.social || 0,
      description: 'One group/social activity',
      validationTags: ['group', 'social', 'tour', 'class', 'workshop', 'gathering', 'meetup']
    });
  }
  
  // Introverts (negative social score)
  if ((traits.social ?? 0) <= -4) {
    slots.push({
      type: 'solo_retreat',
      traitSource: 'social',
      traitValue: traits.social || 0,
      description: 'One peaceful solo moment',
      validationTags: ['quiet', 'solo', 'peaceful', 'intimate', 'private', 'secluded', 'serene']
    });
  }
  
  // ==========================================================================
  // NEW ARCHETYPE-SPECIFIC SLOTS (4 additions)
  // ==========================================================================
  
  // 1. STATUS SEEKER: VIP Experience (comfort >= 5 AND budget >= 3)
  const isStatusSeeker = (traits.comfort ?? 0) >= 5 && (traits.budget ?? 0) >= 3;
  if (isStatusSeeker) {
    // Only require every other day to avoid over-saturation
    if (dayNumber % 2 === 0 || dayNumber === 1) {
      slots.push({
        type: 'vip_experience',
        traitSource: 'comfort',
        traitValue: traits.comfort || 0,
        description: 'One VIP/exclusive access experience (priority entry, private tour, luxury venue)',
        validationTags: ['vip', 'exclusive', 'luxury', 'private', 'premium', 'priority', 'upscale', 'high-end']
      });
    }
  }
  
  // 2. ROMANTIC CURATOR: Couples Moment (trip_type romantic OR archetype match)
  const isRomantic = context?.tripType === 'romantic' || 
    context?.tripType === 'honeymoon' ||
    context?.primaryArchetype === 'romantic_curator' ||
    context?.secondaryArchetype === 'romantic_curator' ||
    context?.travelCompanions?.includes('partner');
  if (isRomantic) {
    slots.push({
      type: 'couples_moment',
      traitSource: 'context',
      traitValue: 0,
      description: 'One romantic/intimate experience (sunset spot, couples activity, special dinner)',
      validationTags: ['romantic', 'couples', 'intimate', 'sunset', 'scenic', 'candlelit', 'private', 'date-night']
    });
  }
  
  // 3. DIGITAL EXPLORER: Connectivity Spot (interests or archetype)
  const isDigitalExplorer = interests.some(i =>
    ['digital', 'remote work', 'coworking', 'technology', 'wifi', 'laptop', 'work-friendly'].includes(i.toLowerCase())
  ) || context?.primaryArchetype === 'digital_explorer' || context?.secondaryArchetype === 'digital_explorer';
  if (isDigitalExplorer) {
    // Only once per trip, not every day
    if (dayNumber === Math.ceil(totalDays / 2)) {
      slots.push({
        type: 'connectivity_spot',
        traitSource: 'context',
        traitValue: 0,
        description: 'One wifi-guaranteed venue (café with reliable internet, coworking space, hotel lounge)',
        validationTags: ['wifi', 'work-friendly', 'coworking', 'café', 'laptop-friendly', 'digital-nomad', 'connected']
      });
    }
  }
  
  // 4. FAMILY ARCHITECT: Kid-Friendly Activity (companions or children flag)
  const isFamily = context?.hasChildren || 
    context?.travelCompanions?.some(c => 
      c.toLowerCase().includes('family') || 
      c.toLowerCase().includes('kid') || 
      c.toLowerCase().includes('child')
    ) ||
    context?.tripType === 'family' ||
    context?.primaryArchetype === 'family_architect' ||
    context?.secondaryArchetype === 'family_architect' ||
    interests.some(i => ['family', 'kids', 'children', 'family-friendly'].includes(i.toLowerCase()));
  if (isFamily) {
    slots.push({
      type: 'family_activity',
      traitSource: 'context',
      traitValue: 0,
      description: 'One family-friendly activity (engaging for all ages, stroller-accessible if needed)',
      validationTags: ['family-friendly', 'kids', 'children', 'all-ages', 'stroller', 'interactive', 'educational', 'playground']
    });
  }
  
  return slots;
}

// =============================================================================
// SCHEDULE MATH - Compute constraints based on persona
// =============================================================================

/**
 * Derive schedule constraints from trait scores
 * This is where personalization shows up in the MATH
 */
export function deriveScheduleConstraints(
  traits: Partial<TraitScores>,
  mobilityNeeds?: string
): ScheduleConstraints {
  const pace = traits.pace ?? 0; // -10 (relaxed) to +10 (packed)
  const comfort = traits.comfort ?? 0; // -10 (budget) to +10 (luxury)
  
  // Base values
  let maxActivities = 6;
  let minActivities = 3;
  let bufferMinutes = 30;
  let maxWalkingMeters = 2000; // 2km default
  let maxWalkingMinutes = 25;
  let earliestStart = '09:00';
  let latestEnd = '22:00';
  let transitBuffer = 10;
  
  // Pace adjustments (MAJOR impact on schedule)
  if (pace <= -5) {
    // Very relaxed
    maxActivities = 3;
    minActivities = 2;
    bufferMinutes = 60; // Full hour between activities
    earliestStart = '10:00';
    latestEnd = '20:00';
  } else if (pace <= -2) {
    // Relaxed
    maxActivities = 4;
    minActivities = 2;
    bufferMinutes = 45;
    earliestStart = '09:30';
    latestEnd = '21:00';
  } else if (pace >= 5) {
    // Packed
    maxActivities = 8;
    minActivities = 5;
    bufferMinutes = 20;
    earliestStart = '08:00';
    latestEnd = '23:00';
  } else if (pace >= 2) {
    // Active
    maxActivities = 7;
    minActivities = 4;
    bufferMinutes = 25;
    earliestStart = '08:30';
    latestEnd = '22:30';
  }
  
  // Comfort affects transit preferences
  if (comfort >= 4) {
    // Luxury travelers - shorter walks, more transit buffer
    maxWalkingMeters = 800;
    maxWalkingMinutes = 12;
    transitBuffer = 20; // More buffer for comfort
  } else if (comfort <= -4) {
    // Budget travelers - more walking acceptable
    maxWalkingMeters = 3000;
    maxWalkingMinutes = 40;
    transitBuffer = 5;
  }
  
  // Mobility needs override walking constraints
  if (mobilityNeeds) {
    const needs = mobilityNeeds.toLowerCase();
    if (needs.includes('wheelchair') || needs.includes('limited') || needs.includes('difficulty')) {
      maxWalkingMeters = 400;
      maxWalkingMinutes = 8;
      bufferMinutes = Math.max(bufferMinutes, 45); // More time for transitions
    } else if (needs.includes('moderate') || needs.includes('some')) {
      maxWalkingMeters = Math.min(maxWalkingMeters, 1000);
      maxWalkingMinutes = Math.min(maxWalkingMinutes, 15);
    }
  }
  
  // Determine required meals based on pace
  const requiredMeals: ('breakfast' | 'lunch' | 'dinner')[] = ['dinner']; // Always need dinner
  if (pace <= 0) {
    requiredMeals.push('lunch'); // Relaxed pace = sit-down lunch
  }
  if (pace <= -4) {
    requiredMeals.push('breakfast'); // Very relaxed = leisurely breakfast
  }
  
  return {
    maxActivitiesPerDay: maxActivities,
    minActivitiesPerDay: minActivities,
    bufferMinutesBetweenActivities: bufferMinutes,
    maxWalkingDistanceMeters: maxWalkingMeters,
    maxWalkingTimeMinutes: maxWalkingMinutes,
    earliestStartTime: earliestStart,
    latestEndTime: latestEnd,
    requiredMealSlots: requiredMeals,
    transitTimeBuffer: transitBuffer
  };
}

// =============================================================================
// GROUP PREFERENCE RECONCILIATION
// =============================================================================

/**
 * Reconcile preferences for multi-traveler trips
 * Returns reconciliation strategy with hard constraints, overlaps, and conflict resolution
 */
export function reconcileGroupPreferences(
  travelers: TravelerProfile[]
): ReconciliationStrategy {
  const hardConstraints: string[] = [];
  const sharedOverlaps: string[] = [];
  const conflictResolutions: ConflictResolution[] = [];
  
  // 1. Hard constraints - allergies and mobility override everything
  for (const t of travelers) {
    for (const allergy of t.allergies) {
      hardConstraints.push(`no-${allergy.toLowerCase()}`);
    }
    for (const dietary of t.dietaryRestrictions) {
      hardConstraints.push(`dietary-${dietary.toLowerCase()}`);
    }
    if (t.mobilityNeeds) {
      hardConstraints.push(`mobility-${t.mobilityNeeds.toLowerCase()}`);
    }
  }
  
  // 2. Shared overlaps - interests that multiple travelers share get priority
  const interestCounts = new Map<string, number>();
  for (const t of travelers) {
    for (const interest of t.interests) {
      const key = interest.toLowerCase();
      interestCounts.set(key, (interestCounts.get(key) || 0) + 1);
    }
  }
  for (const [interest, count] of interestCounts) {
    if (count > 1) {
      sharedOverlaps.push(interest);
    }
  }
  
  // 3. Conflict resolution - alternating wins for conflicting traits
  const conflictingTraits: (keyof TraitScores)[] = ['pace', 'adventure', 'social', 'authenticity'];
  
  for (const trait of conflictingTraits) {
    const values = travelers
      .filter(t => t.traits[trait] !== undefined)
      .map(t => ({ id: t.id, value: t.traits[trait]! }));
    
    if (values.length < 2) continue;
    
    const min = Math.min(...values.map(v => v.value));
    const max = Math.max(...values.map(v => v.value));
    
    // Significant conflict if spread > 4 points
    if (max - min > 4) {
      const winnersById = new Map<number, string>();
      const sortedByValue = values.sort((a, b) => b.value - a.value);
      
      // Alternate winners by day
      for (let day = 1; day <= 14; day++) {
        const winnerIndex = (day - 1) % sortedByValue.length;
        winnersById.set(day, sortedByValue[winnerIndex].id);
      }
      
      conflictResolutions.push({ trait, winnersById });
    }
  }
  
  return {
    hardConstraints: [...new Set(hardConstraints)],
    sharedOverlaps: [...new Set(sharedOverlaps)],
    conflictResolution: conflictResolutions,
    attributionMap: new Map()
  };
}

/**
 * Get the effective trait value for a specific day considering group dynamics
 */
export function getEffectiveTraitForDay(
  trait: keyof TraitScores,
  dayNumber: number,
  travelers: TravelerProfile[],
  reconciliation: ReconciliationStrategy
): { value: number; attribution: string[] } {
  // Check if this trait has a conflict resolution
  const resolution = reconciliation.conflictResolution.find(r => r.trait === trait);
  
  if (resolution) {
    const winnerId = resolution.winnersById.get(dayNumber);
    if (winnerId) {
      const winner = travelers.find(t => t.id === winnerId);
      if (winner && winner.traits[trait] !== undefined) {
        return {
          value: winner.traits[trait]!,
          attribution: [winnerId]
        };
      }
    }
  }
  
  // No conflict - use average
  const values = travelers
    .filter(t => t.traits[trait] !== undefined)
    .map(t => ({ id: t.id, value: t.traits[trait]! }));
  
  if (values.length === 0) return { value: 0, attribution: [] };
  
  const avg = values.reduce((sum, v) => sum + v.value, 0) / values.length;
  return {
    value: Math.round(avg * 10) / 10,
    attribution: values.map(v => v.id)
  };
}

// =============================================================================
// VALIDATION - Validate activities fulfill required slots and schedule math
// =============================================================================

interface Activity {
  id: string;
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  tags?: string[];
  personalization?: {
    tags: string[];
    whyThisFits: string;
    matchedInputs: string[];
  };
  walkingDistance?: number;
  location?: {
    coordinates?: { lat: number; lng: number };
  };
}

/**
 * Parse time string to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Calculate distance between two coordinates in meters
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Validate a day's activities against required slots and schedule constraints
 */
export function validateDayPersonalization(
  dayNumber: number,
  activities: Activity[],
  requiredSlots: ForcedSlot[],
  constraints: ScheduleConstraints
): DayValidation {
  const slotsFulfilled: ForcedSlot[] = [];
  const slotsMissing: ForcedSlot[] = [];
  const violations: ScheduleViolation[] = [];
  
  // Filter out transport/accommodation for activity count
  const coreActivities = activities.filter(a => 
    !['transport', 'accommodation', 'logistics'].includes(a.category?.toLowerCase() || '')
  );
  
  // ==========================================================================
  // 1. CHECK FORCED SLOTS
  // ==========================================================================
  for (const slot of requiredSlots) {
    const fulfilled = activities.some(activity => {
      const activityTags = [
        ...(activity.tags || []),
        ...(activity.personalization?.tags || [])
      ].map(t => t.toLowerCase());
      
      // Check if any validation tag matches
      return slot.validationTags.some(vTag => 
        activityTags.some(aTag => aTag.includes(vTag.toLowerCase()))
      );
    });
    
    if (fulfilled) {
      slotsFulfilled.push(slot);
    } else {
      slotsMissing.push(slot);
    }
  }
  
  // ==========================================================================
  // 2. CHECK ACTIVITY COUNT
  // ==========================================================================
  if (coreActivities.length > constraints.maxActivitiesPerDay) {
    violations.push({
      type: 'too_many_activities',
      details: `Day has ${coreActivities.length} activities, max is ${constraints.maxActivitiesPerDay} for this pace`,
      severity: 'major'
    });
  }
  
  if (coreActivities.length < constraints.minActivitiesPerDay && dayNumber > 1) {
    violations.push({
      type: 'too_few_activities',
      details: `Day has ${coreActivities.length} activities, min is ${constraints.minActivitiesPerDay}`,
      severity: 'minor'
    });
  }
  
  // ==========================================================================
  // 3. CHECK TIMING CONSTRAINTS
  // ==========================================================================
  const sortedActivities = [...activities].sort((a, b) => 
    parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
  );
  
  // Check start/end times
  if (sortedActivities.length > 0) {
    const firstStart = parseTimeToMinutes(sortedActivities[0].startTime);
    const lastEnd = parseTimeToMinutes(sortedActivities[sortedActivities.length - 1].endTime);
    const earliestAllowed = parseTimeToMinutes(constraints.earliestStartTime);
    const latestAllowed = parseTimeToMinutes(constraints.latestEndTime);
    
    // Only check if not arrival/departure day
    if (dayNumber > 1 && firstStart < earliestAllowed - 30) {
      violations.push({
        type: 'pace_mismatch',
        details: `First activity starts at ${sortedActivities[0].startTime}, before ${constraints.earliestStartTime} (too early for pace)`,
        severity: 'minor'
      });
    }
    
    if (lastEnd > latestAllowed + 30) {
      violations.push({
        type: 'pace_mismatch',
        details: `Last activity ends at ${sortedActivities[sortedActivities.length - 1].endTime}, after ${constraints.latestEndTime} (too late for pace)`,
        severity: 'minor'
      });
    }
  }
  
  // Check buffers between activities
  for (let i = 0; i < sortedActivities.length - 1; i++) {
    const current = sortedActivities[i];
    const next = sortedActivities[i + 1];
    
    const currentEnd = parseTimeToMinutes(current.endTime);
    const nextStart = parseTimeToMinutes(next.startTime);
    const gap = nextStart - currentEnd;
    
    // Check for overlaps
    if (gap < 0) {
      violations.push({
        type: 'overlapping_times',
        details: `"${current.title}" ends at ${current.endTime} but "${next.title}" starts at ${next.startTime}`,
        severity: 'critical'
      });
    }
    // Check buffer (only for non-transport transitions)
    else if (gap < constraints.bufferMinutesBetweenActivities && 
             current.category !== 'transport' && next.category !== 'transport') {
      violations.push({
        type: 'insufficient_buffer',
        details: `Only ${gap} min between "${current.title}" and "${next.title}", need ${constraints.bufferMinutesBetweenActivities} min`,
        severity: 'minor'
      });
    }
  }
  
  // ==========================================================================
  // 4. CHECK WALKING DISTANCES
  // ==========================================================================
  for (let i = 0; i < sortedActivities.length - 1; i++) {
    const current = sortedActivities[i];
    const next = sortedActivities[i + 1];
    
    // Skip if either is transport/accommodation
    if (['transport', 'accommodation'].includes(current.category?.toLowerCase() || '') ||
        ['transport', 'accommodation'].includes(next.category?.toLowerCase() || '')) {
      continue;
    }
    
    // If we have coordinates, calculate distance
    const currentCoords = current.location?.coordinates;
    const nextCoords = next.location?.coordinates;
    
    if (currentCoords && nextCoords) {
      const distance = haversineDistance(
        currentCoords.lat, currentCoords.lng,
        nextCoords.lat, nextCoords.lng
      );
      
      if (distance > constraints.maxWalkingDistanceMeters) {
        violations.push({
          type: 'walking_exceeded',
          details: `${Math.round(distance)}m walk from "${current.title}" to "${next.title}", max is ${constraints.maxWalkingDistanceMeters}m`,
          severity: 'major'
        });
      }
    }
    
    // Also check walking time if provided
    if (current.walkingDistance && current.walkingDistance > constraints.maxWalkingDistanceMeters) {
      violations.push({
        type: 'walking_exceeded',
        details: `${current.walkingDistance}m walking distance for "${current.title}", max is ${constraints.maxWalkingDistanceMeters}m`,
        severity: 'major'
      });
    }
  }
  
  // ==========================================================================
  // 5. CHECK REQUIRED MEALS
  // ==========================================================================
  const mealCategories = activities.filter(a => a.category?.toLowerCase() === 'dining');
  const mealTitles = mealCategories.map(a => a.title.toLowerCase());
  
  for (const requiredMeal of constraints.requiredMealSlots) {
    const hasMeal = mealTitles.some(title => 
      title.includes(requiredMeal) ||
      (requiredMeal === 'breakfast' && title.includes('brunch')) ||
      (requiredMeal === 'dinner' && (title.includes('supper') || title.includes('evening meal')))
    );
    
    if (!hasMeal && dayNumber > 1) { // Don't require meals on arrival day
      violations.push({
        type: 'missing_meal',
        details: `Missing ${requiredMeal} slot (required for this pace)`,
        severity: requiredMeal === 'dinner' ? 'major' : 'minor'
      });
    }
  }
  
  // ==========================================================================
  // CALCULATE VALIDITY
  // ==========================================================================
  const criticalViolations = violations.filter(v => v.severity === 'critical');
  const majorViolations = violations.filter(v => v.severity === 'major');
  const criticalSlotsMissing = slotsMissing.length > requiredSlots.length * 0.5;
  
  const isValid = 
    criticalViolations.length === 0 &&
    majorViolations.length <= 2 &&
    !criticalSlotsMissing;
  
  return {
    dayNumber,
    requiredSlots,
    scheduleConstraints: constraints,
    slotsFulfilled,
    slotsMissing,
    scheduleViolations: violations,
    isValid
  };
}

// =============================================================================
// PROMPT GENERATION - Build AI prompt sections for personalization enforcement
// =============================================================================

/**
 * Generate the forced slots instruction for AI prompt
 */
export function buildForcedSlotsPrompt(slots: ForcedSlot[]): string {
  if (slots.length === 0) return '';
  
  const slotInstructions = slots.map(slot => {
    const travelerNote = slot.forTraveler ? ` (for ${slot.forTraveler})` : '';
    return `- ${slot.type.toUpperCase()}${travelerNote}: ${slot.description}
  → Required tags: ${slot.validationTags.slice(0, 4).join(', ')}
  → Based on: ${slot.traitSource} trait (${slot.traitValue > 0 ? '+' : ''}${slot.traitValue})`;
  }).join('\n\n');
  
  return `
## FORCED DIFFERENTIATORS - REQUIRED SLOTS
Each day MUST include these trait-specific activities. Failure to include them makes the itinerary INVALID.

${slotInstructions}

Each activity must have at least one of the required tags in its personalization.tags array.`;
}

/**
 * Generate schedule constraints instruction for AI prompt
 */
export function buildScheduleConstraintsPrompt(constraints: ScheduleConstraints): string {
  return `
## SCHEDULE CONSTRAINTS - MATHEMATICALLY ENFORCED
These constraints are derived from the traveler's traits. VIOLATIONS WILL CAUSE REJECTION.

- Activities per day: ${constraints.minActivitiesPerDay}-${constraints.maxActivitiesPerDay} (excluding transport/accommodation)
- Buffer between activities: minimum ${constraints.bufferMinutesBetweenActivities} minutes
- Day timing: ${constraints.earliestStartTime} earliest start, ${constraints.latestEndTime} latest end
- Walking: maximum ${constraints.maxWalkingDistanceMeters}m or ${constraints.maxWalkingTimeMinutes} min between venues
- Required meals: ${constraints.requiredMealSlots.join(', ')}

If transit time between venues exceeds walking limit, include explicit transport activity.`;
}

/**
 * Generate group reconciliation prompt for multi-traveler trips
 */
export function buildGroupReconciliationPrompt(
  travelers: TravelerProfile[],
  reconciliation: ReconciliationStrategy,
  dayNumber: number
): string {
  if (travelers.length <= 1) return '';
  
  const parts: string[] = [];
  
  // Hard constraints
  if (reconciliation.hardConstraints.length > 0) {
    parts.push(`HARD CONSTRAINTS (must honor for ALL activities):
${reconciliation.hardConstraints.map(c => `- ${c}`).join('\n')}`);
  }
  
  // Shared overlaps
  if (reconciliation.sharedOverlaps.length > 0) {
    parts.push(`SHARED INTERESTS (prioritize these):
${reconciliation.sharedOverlaps.join(', ')}`);
  }
  
  // Day winner for conflicts
  for (const resolution of reconciliation.conflictResolution) {
    const winnerId = resolution.winnersById.get(dayNumber);
    if (winnerId) {
      const winner = travelers.find(t => t.id === winnerId);
      parts.push(`TODAY'S ${resolution.trait.toUpperCase()} PREFERENCE: Favor ${winner?.name || winnerId}'s preference`);
    }
  }
  
  // Attribution requirement
  parts.push(`ATTRIBUTION: For each activity, note which traveler(s) it serves in personalization.matchedInputs`);
  
  return `
## GROUP TRAVEL - ${travelers.length} TRAVELERS
${parts.join('\n\n')}`;
}
