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
  | 'signature_meal'           // Foodie trait
  | 'deep_context'             // History/cultural trait  
  | 'linger_block'             // Relaxed pace trait
  | 'edge_activity'            // Adventure trait
  | 'wellness_moment'          // Transformation trait
  | 'authentic_encounter'      // Authenticity trait
  | 'flex_window'              // Planning trait (negative/spontaneous)
  | 'social_experience'        // Social trait (positive)
  | 'solo_retreat'             // Social trait (negative/introvert)
  | 'vip_experience'           // VIP Voyager: high comfort + budget
  | 'couples_moment'           // Romantic Curator: romantic trip or archetype
  | 'connectivity_spot'        // Untethered Traveler: wifi-guaranteed venue
  | 'family_activity'          // Family Architect: kid-friendly activity
  | 'celebration_dinner'       // Birthday/Anniversary: special celebration dinner
  | 'celebration_experience'   // Birthday/Anniversary: memorable milestone experience
  // GROUP TRIP SLOTS:
  | 'group_bonding_activity'   // Guys/Girls trip: shared group activity
  | 'evening_entertainment'    // Guys trip: bar/pub/sports bar
  | 'evening_out'              // Girls trip: rooftop/wine bar/cocktails
  | 'group_experience'         // Girls trip: class/tasting/spa
  | 'photo_worthy'             // Girls trip: instagram-worthy moment
  // PURPOSE-DRIVEN TRIP SLOTS:
  | 'graduation_celebration'   // Graduation: celebration moment
  | 'reward_experience'        // Graduation: earned reward activity
  | 'bucket_list_experience'   // Retirement: bucket list item
  | 'leisurely_morning'        // Retirement: no early alarms
  | 'morning_wellness'         // Wellness retreat: daily morning practice
  | 'wellness_treatment'       // Wellness retreat: spa/massage
  | 'healthy_dining'           // Wellness retreat: nourishing meals
  | 'main_adventure'           // Adventure trip: primary adventure
  | 'secondary_adventure'      // Adventure trip: supporting activity
  | 'adventure_recovery'       // Adventure trip: rest between activities
  | 'market_visit'             // Foodie trip: food market experience
  | 'cooking_experience'       // Foodie trip: cooking class/workshop
  | 'signature_restaurant'     // Foodie trip: THE restaurant
  | 'food_discovery'           // Foodie trip: street food/neighborhood crawl
  | 'efficient_highlight'      // Business leisure: quick must-see
  | 'quality_dinner'           // Business leisure: client-worthy restaurant
  | 'easy_break_activity';     // Business leisure: 1-2 hour break activity

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
  celebrationDay?: number; // User-specified day for birthday/anniversary celebration (1-indexed)
  travelerCount?: number; // Number of travelers on the trip
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

  const normalizedInterests = interests.map(i => i.toLowerCase().trim());
  
  // Foodie detection (from interests)
  const isFoodie = normalizedInterests.some(i =>
    ['food', 'culinary', 'wine', 'gastronomy', 'cooking', 'restaurants', 'foodie'].includes(i)
  );

  // If the user literally says “one special meal per trip”, enforce that as truth.
  const wantsOneSpecialMealPerTrip = normalizedInterests.some(i =>
    i.includes('one special meal per trip') || i.includes('special meal per trip')
  );

  if (isFoodie) {
    // Default: do NOT force a signature meal every day (this was causing repetitive fine dining).
    // Schedule it once per trip (or roughly once every 3 days if not explicitly “one per trip”).
    const signatureMealDay = Math.max(1, Math.min(totalDays, totalDays >= 3 ? 2 : 1));
    const shouldIncludeSignatureMeal = wantsOneSpecialMealPerTrip
      ? dayNumber === signatureMealDay
      : (dayNumber === signatureMealDay || (totalDays >= 5 && dayNumber % 3 === 0));

    if (shouldIncludeSignatureMeal) {
      slots.push({
        type: 'signature_meal',
        traitSource: 'authenticity', // Food lovers care about authentic experiences
        traitValue: traits.authenticity || 0,
        description: 'One signature meal (local favorite + signature dish; not necessarily fine dining)',
        // Important: do not default to “renowned/must-try” language (often pushes Michelin / luxury).
        validationTags: ['signature-dining', 'culinary', 'local-cuisine', 'local-favorite', 'great-food']
      });
    }
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
    // IMPORTANT: A relaxed pace should not automatically mean “spa”.
    // This was the primary source of “spa every day” suggestions.
    slots.push({
      type: 'linger_block',
      traitSource: 'pace',
      traitValue: traits.pace || 0,
      description: 'One linger block (café, scenic sit, park, slow lunch - min 90 minutes)',
      // Avoid spa-adjacent words like “relaxation/unwind” which were repeatedly fulfilled as baths/spas.
      validationTags: ['café', 'scenic', 'leisure', 'slow-pace', 'park', 'people-watching', 'slow-lunch', 'gelato']
    });
  }
  
  // Adventurous (trait >= 4 means adventurous, >= 7 means thrill-seeker)
  if ((traits.adventure ?? 0) >= 4) {
    const adv = traits.adventure || 0;
    const isThrillSeeker = adv >= 7;
    // Thrill-Seeker: edge activity EVERY day. Adventurous (4-6): alternating days.
    const requireEdgeToday = isThrillSeeker || dayNumber % 2 === 1 || dayNumber === 1;
    if (requireEdgeToday) {
      slots.push({
        type: 'edge_activity',
        traitSource: 'adventure',
        traitValue: adv,
        description: isThrillSeeker
          ? 'One KINETIC / ADRENALINE experience (Vespa or e-bike tour, kayak/SUP, climbing, go-karts, helicopter, paragliding, canyoning, ziplining, motorcycle tour, ghost-tunnel/catacombs night crawl). NOT a park/fountain/scenic walk/market/museum/café.'
          : 'One edge activity (bolder, kinetic experience: bike tour, kayak, climbing, scooter tour, off-beaten-path adventure). NOT a generic park, fountain, market, or café.',
        // STRICT validation tags — must be kinetic/adrenaline, not generic "outdoor"
        validationTags: isThrillSeeker
          ? ['kinetic', 'adrenaline', 'thrill', 'climbing', 'kayak', 'sup', 'vespa', 'scooter', 'bike-tour', 'ebike', 'helicopter', 'paragliding', 'canyoning', 'zipline', 'motorcycle', 'go-kart', 'speedboat', 'rafting', 'extreme', 'gladiator-school']
          : ['adventure', 'kinetic', 'thrill', 'bike-tour', 'kayak', 'climbing', 'scooter', 'vespa', 'zipline', 'rafting', 'off-beaten-path']
      });
    }
  }
  
  // High transformation seekers
  if ((traits.transformation ?? 0) >= 4) {
    slots.push({
      type: 'wellness_moment',
      traitSource: 'transformation',
      traitValue: traits.transformation || 0,
      description: 'One mindful reset / growth-focused moment (quiet, nature, reflection)',
      // Do NOT include spa/baths/hammams as a default “wellness” fulfillment.
      validationTags: ['mindfulness', 'meditation', 'reflection', 'nature', 'quiet', 'journaling', 'sunrise', 'garden']
    });
  }
  
  // Authenticity / Local Explorer
  const authScore = traits.authenticity ?? 0;
  if (authScore >= 3) {
    const isLocalOnly = authScore >= 6;
    slots.push({
      type: 'authentic_encounter',
      traitSource: 'authenticity',
      traitValue: authScore,
      description: isLocalOnly
        ? 'TWO genuinely local experiences (residential neighborhood, family-run trattoria/osteria/enoteca, non-tourist piazza). At MOST 1 marquee landmark across the WHOLE TRIP.'
        : 'One genuinely local experience in a residential/non-tourist neighborhood (family-run trattoria, osteria, enoteca, neighborhood piazza). NOT a famous landmark or tourist-luxury venue.',
      validationTags: ['neighborhood', 'family-run', 'osteria', 'trattoria', 'enoteca', 'non-touristy', 'hidden-gem']
    });
  }

  // Spontaneous planners — require explicit flex/wander windows
  const planningScore = traits.planning ?? 0;
  if (planningScore <= -3) {
    const isFullySpontaneous = planningScore <= -6;
    const flexCount = isFullySpontaneous ? 2 : 1;
    for (let i = 0; i < flexCount; i++) {
      slots.push({
        type: 'flex_window',
        traitSource: 'planning',
        traitValue: planningScore,
        description: isFullySpontaneous
          ? 'Open / unplanned wander block (90–120m). NO fixed venue, NO reservation. Title like "Wander {neighborhood}" or "Free roam — follow your nose".'
          : 'One open / unplanned wander block (90–120m). NO fixed venue, NO reservation. Title like "Wander {neighborhood}" or "Open afternoon — café-hop or pivot".',
        validationTags: ['flex', 'wander', 'free-roam', 'unplanned']
      });
    }
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
  
  // Introverts (negative social score) — gate "solo" framing on traveler count
  if ((traits.social ?? 0) <= -4) {
    const isSoloTrip = !context?.travelerCount || context.travelerCount <= 1 ||
      context?.tripType === 'solo' ||
      context?.travelCompanions?.includes('solo');

    if (isSoloTrip) {
      slots.push({
        type: 'solo_retreat',
        traitSource: 'social',
        traitValue: traits.social || 0,
        description: 'One peaceful solo moment',
        validationTags: ['quiet', 'solo', 'peaceful', 'intimate', 'private', 'secluded', 'serene']
      });
    } else {
      // Multi-person introvert trip: request quiet/peaceful activities without "solo" framing
      slots.push({
        type: 'solo_retreat',
        traitSource: 'social',
        traitValue: traits.social || 0,
        description: 'One quiet, peaceful moment away from crowds (NOT solo — travelers are together)',
        validationTags: ['quiet', 'peaceful', 'intimate', 'secluded', 'serene']
      });
    }
  }
  
  // ==========================================================================
  // ARCHETYPE-SPECIFIC & OCCASION-SPECIFIC SLOTS
  // ==========================================================================
  
  // 1. VIP VOYAGER: VIP Experience (comfort >= 5 AND budget >= 3)
  const isStatusSeeker = (traits.comfort ?? 0) >= 5 && (traits.budget ?? 0) >= 3;
  if (isStatusSeeker) {
    // Only require every other day to avoid over-saturation
    if (dayNumber % 2 === 0 || dayNumber === 1) {
      slots.push({
        type: 'vip_experience',
        traitSource: 'comfort',
        traitValue: traits.comfort || 0,
        // Avoid forcing VIP/private/luxury language; keep it “high-comfort” instead.
        description: 'One high-comfort highlight (well-reviewed, convenient, low-hassle; not necessarily VIP)',
        validationTags: ['high-comfort', 'well-reviewed', 'convenient', 'skip-hassle', 'easy-logistics', 'premium-feel']
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
      // Remove “private” tag to avoid nudging the model toward “private tours”.
      validationTags: ['romantic', 'couples', 'intimate', 'sunset', 'scenic', 'candlelit', 'date-night', 'cozy']
    });
  }
  
  // 3. UNTETHERED TRAVELER: Connectivity Spot (interests or archetype)
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
  
  // 5. BIRTHDAY/CELEBRATION: Special celebration moments
  // ONLY add celebration slots on the user-specified celebrationDay (if provided)
  const isCelebration = context?.tripType === 'birthday' || 
    context?.tripType?.toLowerCase()?.includes('birthday') ||
    context?.tripType === 'anniversary' ||
    context?.tripType?.toLowerCase()?.includes('celebration') ||
    context?.tripType?.toLowerCase()?.includes('milestone');
  if (isCelebration) {
    // Use user-specified celebration day if provided, otherwise fall back to smart default
    const userSpecifiedDay = context?.celebrationDay;
    const celebrationTargetDay = userSpecifiedDay ?? (totalDays >= 3 ? Math.ceil(totalDays / 2) : 1);
    
    // ONLY add celebration slots on the designated celebration day
    if (dayNumber === celebrationTargetDay) {
      slots.push({
        type: 'celebration_dinner',
        traitSource: 'context',
        traitValue: 0,
        description: 'BIRTHDAY/CELEBRATION: Special celebration dinner at a highly-rated restaurant with great ambiance',
        validationTags: ['celebration', 'special-occasion', 'fine-dining', 'birthday', 'anniversary', 'upscale', 'memorable', 'reservation-worthy', 'champagne']
      });
      slots.push({
        type: 'celebration_experience',
        traitSource: 'context',
        traitValue: 0,
        description: 'BIRTHDAY/CELEBRATION: Memorable milestone experience (special tour, unique activity, champagne toast, scenic moment)',
        validationTags: ['special-experience', 'celebration', 'champagne', 'memorable', 'unique', 'treat-yourself', 'milestone', 'bucket-list']
      });
    }
    // Non-celebration days should be NORMAL - no celebration language or activities
  }
  
  // ==========================================================================
  // 6. GUYS TRIP: Group bonding and evening entertainment
  // ==========================================================================
  const isGuysTrip = context?.tripType === 'guys_trip' || 
    context?.tripType === 'guys-trip' ||
    context?.tripType?.toLowerCase()?.includes('guys');
  if (isGuysTrip) {
    // Group bonding activity mid-trip
    const groupActivityDay = Math.ceil(totalDays / 2);
    if (dayNumber === groupActivityDay && totalDays >= 2) {
      slots.push({
        type: 'group_bonding_activity',
        traitSource: 'context',
        traitValue: 0,
        description: 'GUYS TRIP: Group bonding activity (sports, adventure, brewery tour, or shared experience)',
        validationTags: ['group', 'bonding', 'adventure', 'sports', 'tour', 'brewery', 'active', 'shared-experience', 'guys-activity']
      });
    }
    // Evening entertainment (day 2 or 3)
    const eveningDay = totalDays >= 3 ? 2 : 1;
    if (dayNumber === eveningDay) {
      slots.push({
        type: 'evening_entertainment',
        traitSource: 'context',
        traitValue: 0,
        description: 'GUYS TRIP: Evening out (bar, pub crawl, sports bar, or nightlife)',
        validationTags: ['bar', 'pub', 'nightlife', 'sports-bar', 'evening', 'drinks', 'social', 'night-out']
      });
    }
  }

  // ==========================================================================
  // 7. GIRLS TRIP: Group experiences and photo opportunities
  // ==========================================================================
  const isGirlsTrip = context?.tripType === 'girls_trip' || 
    context?.tripType === 'girls-trip' ||
    context?.tripType?.toLowerCase()?.includes('girls');
  if (isGirlsTrip) {
    // Group experience mid-trip
    const groupExperienceDay = Math.ceil(totalDays / 2);
    if (dayNumber === groupExperienceDay && totalDays >= 2) {
      slots.push({
        type: 'group_experience',
        traitSource: 'context',
        traitValue: 0,
        description: 'GIRLS TRIP: Shared group experience (wine tasting, cooking class, spa day, or group tour)',
        validationTags: ['group', 'class', 'tasting', 'spa', 'tour', 'shared', 'bonding', 'girls-activity']
      });
    }
    // Evening out option
    const eveningDay = totalDays >= 3 ? 2 : 1;
    if (dayNumber === eveningDay) {
      slots.push({
        type: 'evening_out',
        traitSource: 'context',
        traitValue: 0,
        description: 'GIRLS TRIP: Evening out (rooftop bar, wine bar, cocktails, or nightlife)',
        validationTags: ['rooftop', 'wine-bar', 'cocktails', 'evening', 'nightlife', 'drinks', 'girls-night']
      });
    }
    // Photo-worthy moment
    if (dayNumber <= 3) {
      slots.push({
        type: 'photo_worthy',
        traitSource: 'context',
        traitValue: 0,
        description: 'GIRLS TRIP: Photo-worthy location or aesthetically beautiful experience',
        validationTags: ['photo', 'instagram', 'scenic', 'aesthetic', 'viewpoint', 'beautiful', 'shareable']
      });
    }
  }

  // ==========================================================================
  // 8. GRADUATION: Celebration and reward experiences
  // ==========================================================================
  const isGraduation = context?.tripType === 'graduation' || 
    context?.tripType?.toLowerCase()?.includes('graduation');
  if (isGraduation) {
    // Celebration moment mid-trip
    const celebrationDay = Math.ceil(totalDays / 2);
    if (dayNumber === celebrationDay) {
      slots.push({
        type: 'graduation_celebration',
        traitSource: 'context',
        traitValue: 0,
        description: 'GRADUATION: Special celebration moment (dinner, toast, memorable experience)',
        validationTags: ['celebration', 'special', 'dinner', 'toast', 'milestone', 'achievement']
      });
    }
    // Reward experience (day 2 or 3)
    const rewardDay = totalDays >= 3 ? 2 : 1;
    if (dayNumber === rewardDay) {
      slots.push({
        type: 'reward_experience',
        traitSource: 'context',
        traitValue: 0,
        description: 'GRADUATION: Reward activity they earned (bucket list, splurge, dream experience)',
        validationTags: ['reward', 'bucket-list', 'splurge', 'earned', 'special', 'memorable']
      });
    }
  }

  // ==========================================================================
  // 9. RETIREMENT: Bucket list and leisurely pace
  // ==========================================================================
  const isRetirement = context?.tripType === 'retirement' || 
    context?.tripType?.toLowerCase()?.includes('retirement');
  if (isRetirement) {
    // Bucket list experience mid-trip
    const bucketListDay = Math.ceil(totalDays / 2);
    if (dayNumber === bucketListDay) {
      slots.push({
        type: 'bucket_list_experience',
        traitSource: 'context',
        traitValue: 0,
        description: 'RETIREMENT: THE experience they\'ve always wanted - no more "someday"',
        validationTags: ['bucket-list', 'dream', 'lifetime', 'special', 'iconic', 'must-do']
      });
    }
    // Celebration dinner
    const dinnerDay = totalDays >= 3 ? 3 : 2;
    if (dayNumber === dinnerDay) {
      slots.push({
        type: 'celebration_dinner',
        traitSource: 'context',
        traitValue: 0,
        description: 'RETIREMENT: Special dinner celebrating career achievement',
        validationTags: ['celebration', 'dinner', 'special', 'fine-dining', 'memorable']
      });
    }
    // Leisurely mornings - no early alarms
    if (dayNumber > 1) {
      slots.push({
        type: 'leisurely_morning',
        traitSource: 'context',
        traitValue: 0,
        description: 'RETIREMENT: No early alarms - they\'ve earned rest. Late breakfast or brunch.',
        validationTags: ['late-start', 'brunch', 'leisurely', 'relaxed', 'no-rush']
      });
    }
  }

  // ==========================================================================
  // 10. WELLNESS RETREAT: Daily wellness focus
  // ==========================================================================
  const isWellness = context?.tripType === 'wellness_retreat' || 
    context?.tripType === 'wellness-retreat' ||
    context?.tripType?.toLowerCase()?.includes('wellness');
  if (isWellness) {
    // Morning wellness every day
    slots.push({
      type: 'morning_wellness',
      traitSource: 'context',
      traitValue: 0,
      description: 'WELLNESS: Morning practice (yoga, meditation, or wellness activity)',
      validationTags: ['yoga', 'meditation', 'morning', 'wellness', 'mindfulness', 'practice']
    });
    // Treatment every other day minimum
    if (dayNumber % 2 === 0 || dayNumber === 1) {
      slots.push({
        type: 'wellness_treatment',
        traitSource: 'context',
        traitValue: 0,
        description: 'WELLNESS: Spa treatment, massage, or therapeutic experience',
        validationTags: ['spa', 'massage', 'treatment', 'therapeutic', 'healing', 'relaxation']
      });
    }
    // Integration/rest time every day
    slots.push({
      type: 'linger_block',
      traitSource: 'context',
      traitValue: 0,
      description: 'WELLNESS: Rest and integration time between activities',
      validationTags: ['rest', 'integration', 'quiet', 'relaxation', 'downtime']
    });
  }

  // ==========================================================================
  // 11. ADVENTURE TRIP: Adventure activities with recovery
  // ==========================================================================
  const isAdventure = context?.tripType === 'adventure' || 
    context?.tripType?.toLowerCase()?.includes('adventure');
  if (isAdventure) {
    // Main adventure activity most days
    if (dayNumber % 2 === 1 || dayNumber === 2) { // Days 1, 2, 3, 5, etc.
      slots.push({
        type: 'main_adventure',
        traitSource: 'context',
        traitValue: 0,
        description: 'ADVENTURE: Primary adventure activity (the reason for the trip)',
        validationTags: ['adventure', 'extreme', 'active', 'outdoor', 'thrill', 'adrenaline']
      });
    }
    // Secondary adventure on alternating days
    if (dayNumber % 2 === 0 && dayNumber <= 4) {
      slots.push({
        type: 'secondary_adventure',
        traitSource: 'context',
        traitValue: 0,
        description: 'ADVENTURE: Supporting active experience',
        validationTags: ['active', 'outdoor', 'adventure', 'hiking', 'sport', 'physical']
      });
    }
    // Recovery time mid-trip and end
    if (dayNumber === Math.ceil(totalDays / 2) || dayNumber === totalDays) {
      slots.push({
        type: 'adventure_recovery',
        traitSource: 'context',
        traitValue: 0,
        description: 'ADVENTURE: Recovery time (rest, spa, easy activity)',
        validationTags: ['recovery', 'rest', 'spa', 'easy', 'relaxation', 'gentle']
      });
    }
  }

  // ==========================================================================
  // 12. FOODIE TRIP: Food-focused activities
  // ==========================================================================
  const isFoodieTripType = context?.tripType === 'foodie' || 
    context?.tripType?.toLowerCase()?.includes('foodie') ||
    context?.tripType?.toLowerCase()?.includes('culinary');
  if (isFoodieTripType) {
    // Market visit early in trip
    if (dayNumber <= 2) {
      slots.push({
        type: 'market_visit',
        traitSource: 'context',
        traitValue: 0,
        description: 'FOODIE: Food market, farmers market, or specialty food shopping',
        validationTags: ['market', 'food-market', 'farmers', 'local', 'produce', 'specialty']
      });
    }
    // Cooking experience mid-trip
    const cookingDay = Math.ceil(totalDays / 2);
    if (dayNumber === cookingDay) {
      slots.push({
        type: 'cooking_experience',
        traitSource: 'context',
        traitValue: 0,
        description: 'FOODIE: Cooking class, food workshop, or hands-on culinary experience',
        validationTags: ['cooking', 'class', 'workshop', 'culinary', 'hands-on', 'chef']
      });
    }
    // Signature restaurant later in trip
    const signatureDay = totalDays >= 4 ? totalDays - 1 : totalDays;
    if (dayNumber === signatureDay) {
      slots.push({
        type: 'signature_restaurant',
        traitSource: 'context',
        traitValue: 0,
        description: 'FOODIE: THE restaurant of the trip - researched, reserved, anticipated',
        validationTags: ['signature', 'fine-dining', 'special', 'renowned', 'destination', 'bucket-list']
      });
    }
    // Food discovery every day
    slots.push({
      type: 'food_discovery',
      traitSource: 'context',
      traitValue: 0,
      description: 'FOODIE: Street food, local specialty, or neighborhood food exploration',
      validationTags: ['street-food', 'local', 'authentic', 'discovery', 'neighborhood', 'hidden-gem']
    });
  }

  // ==========================================================================
  // 13. BUSINESS LEISURE: Efficient use of limited free time
  // ==========================================================================
  const isBusinessLeisure = context?.tripType === 'business_leisure' || 
    context?.tripType === 'business-leisure' ||
    context?.tripType?.toLowerCase()?.includes('bleisure');
  if (isBusinessLeisure) {
    // Efficient highlight - the ONE thing to see
    if (dayNumber === 1 || dayNumber === totalDays) {
      slots.push({
        type: 'efficient_highlight',
        traitSource: 'context',
        traitValue: 0,
        description: 'BLEISURE: Must-see highlight doable in limited free time',
        validationTags: ['must-see', 'landmark', 'efficient', 'quick', 'iconic', 'highlight']
      });
    }
    // Quality dinner option for business entertaining
    if (dayNumber <= 2) {
      slots.push({
        type: 'quality_dinner',
        traitSource: 'context',
        traitValue: 0,
        description: 'BLEISURE: Restaurant suitable for client entertainment or quality solo meal',
        validationTags: ['business-appropriate', 'upscale', 'quality', 'impressive', 'professional']
      });
    }
    // Easy break activity
    if (dayNumber === 2 && totalDays >= 2) {
      slots.push({
        type: 'easy_break_activity',
        traitSource: 'context',
        traitValue: 0,
        description: 'BLEISURE: Quick activity (1-2 hours) doable between meetings',
        validationTags: ['quick', 'nearby', 'break', 'flexible', 'accessible', 'central']
      });
    }
  }
  
  // ==========================================================================
  // FORCED INTEREST SLOTS - Guarantee user interests appear in itinerary
  // ==========================================================================
  
  // Map interests to forced slots (not every day, use cadence)
  const interestSlotMap: Record<string, { 
    tags: string[]; 
    description: string; 
    cadence: number; // Every N days
  }> = {
    // Art & Culture
    'art': { tags: ['art', 'gallery', 'museum', 'street-art', 'exhibition'], description: 'Art-focused experience (gallery, museum, street art)', cadence: 2 },
    'museums': { tags: ['museum', 'exhibition', 'cultural', 'collection'], description: 'Museum visit', cadence: 2 },
    'theater': { tags: ['theater', 'performance', 'show', 'live', 'concert'], description: 'Live performance or show', cadence: 3 },
    'music': { tags: ['music', 'concert', 'live-music', 'jazz', 'venue'], description: 'Music venue or live performance', cadence: 3 },
    
    // Nature & Outdoors
    'nature': { tags: ['nature', 'park', 'garden', 'scenic', 'outdoor', 'green-space'], description: 'Nature experience (park, garden, scenic viewpoint)', cadence: 2 },
    'hiking': { tags: ['hiking', 'trail', 'trekking', 'walk', 'outdoor'], description: 'Hiking or nature walk', cadence: 2 },
    'beach': { tags: ['beach', 'coastal', 'waterfront', 'seaside', 'ocean'], description: 'Beach or coastal activity', cadence: 2 },
    'wildlife': { tags: ['wildlife', 'animals', 'zoo', 'sanctuary', 'nature'], description: 'Wildlife encounter', cadence: 3 },
    
    // Active & Sports
    'sports': { tags: ['sports', 'active', 'game', 'athletic', 'stadium'], description: 'Sports-related activity', cadence: 3 },
    'fitness': { tags: ['fitness', 'active', 'workout', 'gym', 'exercise'], description: 'Fitness activity', cadence: 2 },
    'water sports': { tags: ['water-sports', 'kayak', 'surf', 'swim', 'diving', 'snorkel'], description: 'Water sports activity', cadence: 2 },
    
    // Shopping & Markets
    'shopping': { tags: ['shopping', 'market', 'boutique', 'mall', 'retail'], description: 'Shopping experience', cadence: 3 },
    'markets': { tags: ['market', 'bazaar', 'flea-market', 'local-market', 'street-market'], description: 'Local market visit', cadence: 2 },
    
    // Photography & Sightseeing
    'photography': { tags: ['photography', 'scenic', 'viewpoint', 'instagram', 'photo-spot'], description: 'Photo-worthy location', cadence: 1 },
    'sightseeing': { tags: ['sightseeing', 'landmark', 'monument', 'attraction', 'must-see'], description: 'Key landmark or attraction', cadence: 1 },
    
    // Wellness & Relaxation
    'wellness': { tags: ['wellness', 'spa', 'massage', 'relaxation', 'self-care'], description: 'Wellness experience', cadence: 3 },
    'yoga': { tags: ['yoga', 'meditation', 'mindfulness', 'wellness', 'retreat'], description: 'Yoga or meditation session', cadence: 2 },
    
    // Learning & Experiences
    'cooking': { tags: ['cooking', 'culinary', 'class', 'workshop', 'food-experience'], description: 'Cooking class or food workshop', cadence: 4 },
    'wine': { tags: ['wine', 'vineyard', 'tasting', 'winery', 'sommelier'], description: 'Wine tasting experience', cadence: 2 },
    'craft': { tags: ['craft', 'workshop', 'artisan', 'handmade', 'diy'], description: 'Craft or artisan workshop', cadence: 4 },
    
    // Nightlife & Entertainment
    'nightlife': { tags: ['nightlife', 'bar', 'club', 'night', 'evening'], description: 'Nightlife experience', cadence: 2 },
    'bars': { tags: ['bar', 'cocktail', 'pub', 'drinks', 'speakeasy'], description: 'Bar or cocktail experience', cadence: 2 },
  };
  
  for (const interest of interests) {
    const normalizedInterest = interest.toLowerCase().trim();
    const slotConfig = interestSlotMap[normalizedInterest];
    
    if (slotConfig) {
      // Check if this day should have this interest based on cadence
      const shouldInclude = (dayNumber === 1) || (dayNumber % slotConfig.cadence === 0);
      
      if (shouldInclude) {
        // Create a unique slot type for tracking (using 'context' as traitSource for interest-based)
        slots.push({
          type: 'authentic_encounter' as ForcedSlotType, // Reuse type, validation is via tags
          traitSource: 'context',
          traitValue: 0,
          description: `INTEREST SLOT: ${slotConfig.description} (user loves: ${interest})`,
          validationTags: slotConfig.tags
        });
      }
    }
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
  mobilityNeeds?: string,
  preferences?: {
    recoveryStyle?: string[];
    activeHoursPerDay?: 'light' | 'moderate' | 'full';
  },
  /** Day context for meal policy — when provided, overrides pace-only meal derivation */
  dayContext?: {
    isFirstDay?: boolean;
    isLastDay?: boolean;
    isTransitionDay?: boolean;
    hasFullDayEvent?: boolean;
    arrivalTime24?: string;
    departureTime24?: string;
    requiredMealsOverride?: ('breakfast' | 'lunch' | 'dinner')[];
  }
): ScheduleConstraints {
  const pace = traits.pace ?? 0; // -10 (relaxed) to +10 (packed)
  const comfort = traits.comfort ?? 0; // -10 (budget) to +10 (luxury)
  
  // Base values
  let maxActivities = 7;
  let minActivities = 5;
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
  
  // =========================================================================
  // MEAL SLOT DERIVATION — Now respects day context when provided
  // =========================================================================
  let requiredMeals: ('breakfast' | 'lunch' | 'dinner')[];
  
  if (dayContext?.requiredMealsOverride) {
    // Caller has already computed the meal policy — use it directly
    requiredMeals = dayContext.requiredMealsOverride;
  } else if (dayContext?.hasFullDayEvent) {
    // Full-day event — no mandatory meals
    requiredMeals = [];
  } else if (dayContext?.isTransitionDay) {
    // Transition day — dinner at most
    requiredMeals = ['dinner'];
  } else if (dayContext?.isFirstDay) {
    // Arrival day — conservative
    requiredMeals = ['dinner'];
  } else if (dayContext?.isLastDay) {
    // Departure day — breakfast at most
    requiredMeals = ['breakfast'];
  } else {
    // Standard full-exploration day — always requires all 3 meals regardless of pace.
    // The pace trait affects meal *weight* (quick fuel vs. sit-down experience),
    // NOT whether meals exist. Every traveler eats breakfast, lunch, and dinner.
    requiredMeals = ['breakfast', 'lunch', 'dinner'];
  }
  
  // =========================================================================
  // Gap 3: Recovery Style constraints
  // =========================================================================
  if (preferences?.recoveryStyle) {
    if (preferences.recoveryStyle.includes('early_sleep')) {
      // Cap end time for early sleepers
      const currentEndMins = parseInt(latestEnd.split(':')[0]) * 60 + parseInt(latestEnd.split(':')[1]);
      const earlyCap = 20 * 60 + 30; // 20:30
      if (currentEndMins > earlyCap) {
        latestEnd = '20:30';
      }
    }
    if (preferences.recoveryStyle.includes('alone_time')) {
      // Reduce max activities to ensure unscheduled blocks
      maxActivities = Math.max(2, maxActivities - 1);
      bufferMinutes = Math.max(bufferMinutes, 45);
    }
  }
  
  // =========================================================================
  // Gap 4: Active Hours Per Day constraints
  // =========================================================================
  if (preferences?.activeHoursPerDay) {
    const hourRanges: Record<string, [number, number]> = {
      'light': [3, 5],
      'moderate': [6, 8],
      'full': [9, 12],
    };
    const range = hourRanges[preferences.activeHoursPerDay];
    if (range) {
      const [, maxHours] = range;
      // Cap max activities based on active hours (~1.5h per activity avg)
      const hourBasedMax = Math.floor(maxHours / 1.5);
      maxActivities = Math.min(maxActivities, hourBasedMax);
    }
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
      details: `Day has ${coreActivities.length} activities, min is ${constraints.minActivitiesPerDay}. Add more activities to fill the day.`,
      severity: 'major'
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
    
    if (!hasMeal) {
      violations.push({
        type: 'missing_meal',
        details: `Missing ${requiredMeal} slot (required by meal policy)` ,
        severity: 'major'
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
- Buffer between activities: minimum ${constraints.bufferMinutesBetweenActivities} minutes (see transition rules below)
- Day timing: ${constraints.earliestStartTime} earliest start, ${constraints.latestEndTime} latest end
- Walking: maximum ${constraints.maxWalkingDistanceMeters}m or ${constraints.maxWalkingTimeMinutes} min between venues
- Required meals: ${constraints.requiredMealSlots.join(', ')}

If transit time between venues exceeds walking limit, include explicit transport activity.

**POST-PROCESSING NOTE**: After generation, the system will verify all buffers using actual GPS coordinates and haversine distances between venues. If two venues are far apart but you scheduled a short gap, the system will automatically expand the gap and cascade-shift later activities. Plan conservatively — it's better to leave generous gaps that don't need correction.

## 🚦 REALISTIC TRANSITION BUFFER RULES — MANDATORY
NEVER schedule back-to-back activities with zero gap. Every transition requires buffer time ON TOP of travel time.
The next activity's startTime must be: previous endTime + travel duration + buffer.

Minimum buffers BY TRANSITION TYPE (apply the relevant one):
- Walking to next activity: +5 min (check map, cross streets, find entrance)
- Taxi/rideshare pickup: +10 min (request ride, wait for arrival, load in)
- Taxi/rideshare dropoff → indoor venue: +5 min (pay, walk to entrance, orient)
- Arriving at a restaurant: +10 min (check in with host, get seated, order drinks)
- Hotel check-in: +15 min (front desk queue, elevator, settle into room)
- Leaving hotel (freshen up/change): +10 min (get ready, gather belongings, reach lobby)
- Museum/attraction entry: +10 min (ticket queue, bag check, orientation)
- Airport arrival → through security: +45 min domestic, +60 min international (longer lines, passport control)
- Between ANY two activities at DIFFERENT locations: never less than 10 min total gap

EXAMPLE — WRONG vs RIGHT:
❌ WRONG: Taxi ends 6:30 PM → Hotel refresh starts 6:30 PM → ends 7:30 PM → Taxi starts 7:30 PM
✅ RIGHT: Taxi ends 6:30 PM → Hotel check-in + freshen up 6:45 PM → ready 7:30 PM → Taxi pickup 7:40 PM → Restaurant arrival 8:00 PM (seated by 8:10 PM)

Show the buffer naturally in descriptions: "Arrive at hotel ~6:30 PM. Check in and freshen up. Ready by 7:30 PM."`;
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
