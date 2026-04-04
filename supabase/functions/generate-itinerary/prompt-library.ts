// =============================================================================
// MODULAR PROMPT LIBRARY - Phase 9: Comprehensive Personalization System
// =============================================================================
// This module implements a decision-tree-based prompt selection system that:
// 1. Checks flight data → hotel data → DNA data in a proper hierarchy
// 2. Flight and hotel work TOGETHER (not independently)
// 3. Injects FULL user persona into every prompt
// 4. No hardcoded assumptions - every behavior checks user DNA first
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

export interface FlightData {
  hasOutboundFlight: boolean;
  hasReturnFlight: boolean;
  arrivalTime24?: string;       // HH:MM 24-hour format
  arrivalTimeMins?: number;     // Minutes since midnight
  departureTime24?: string;     // Return flight departure
  departureTimeMins?: number;
  departureAirport?: string;
  arrivalAirport?: string;      // Destination airport
  arrivalDate?: string;         // YYYY-MM-DD
  departureDate?: string;
}

export interface HotelData {
  hasHotel: boolean;
  hotelName?: string;
  hotelAddress?: string;
  hotelNeighborhood?: string;
  checkInTime?: string;         // Default 15:00 if not specified
  checkOutTime?: string;        // Default 11:00 if not specified
  nearestAirport?: string;      // Inferred from destination if not provided
}

export interface TravelerDNA {
  // Archetype blend
  primaryArchetype?: string;
  secondaryArchetype?: string;
  archetypeConfidence?: number;
  
  // Trait scores (-10 to +10)
  traits: {
    pace: number;           // -10 = very relaxed, +10 = packed
    social: number;         // -10 = solo/introvert, +10 = group/social
    adventure: number;      // -10 = safe/comfortable, +10 = thrill-seeker
    authenticity: number;   // -10 = tourist-friendly, +10 = local-only
    comfort: number;        // -10 = budget-conscious, +10 = luxury-seeking
    planning: number;       // -10 = spontaneous, +10 = detailed planner
    transformation: number; // -10 = pure leisure, +10 = growth-focused
    budget: number;         // -10 = splurge-forward, +10 = value-focused (POSITIVE = FRUGAL)
  };
  
  // Sleep/timing preferences
  sleepSchedule?: 'early_bird' | 'night_owl' | 'needs_rest' | 'flexible';
  energyPeak?: 'morning' | 'afternoon' | 'evening';
  jetLagSensitivity?: 'low' | 'moderate' | 'high';
  
  // Dietary/mobility
  dietaryRestrictions: string[];
  mobilityLevel?: 'full' | 'moderate' | 'limited';
  accessibilityNeeds: string[];
  
  // Food preferences
  foodLikes: string[];
  foodDislikes: string[];
  
  // Interests & emotional drivers
  interests: string[];
  emotionalDrivers: string[];
  travelVibes: string[];
  
  // Companions
  companions?: 'solo' | 'couple' | 'family' | 'friends' | 'group';
  childrenCount?: number;
  
  // NEW: Preference fields wired into generation (Phase 16)
  dailyBudgetTier?: 'budget' | 'moderate' | 'comfort' | 'premium' | 'luxury';
  accommodationStyle?: string;
  recoveryStyle?: string[];
  activeHoursPerDay?: 'light' | 'moderate' | 'full';
  recommendationStyle?: 'popular' | 'off_the_beaten_path';
  aiAssistanceLevel?: 'full' | 'balanced' | 'minimal';
}

export interface TripContext {
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  travelers: number;
  tripType?: string;
  budgetTier?: string;
  currency?: string;
}

export type ArrivalWindow = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'unknown';
export type DepartureWindow = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'unknown';

export interface DayConstraints {
  dayNumber: number;
  date: string;
  isFirstDay: boolean;
  isLastDay: boolean;
  
  // Computed timing constraints
  earliestStartTime: string;      // When activities can begin
  latestEndTime: string;          // When all activities must end
  
  // Required activities for this day
  requiredSequence: string[];     // e.g., ['arrival', 'transfer', 'check-in']
  
  // Activity density based on DNA
  maxActivities: number;
  minDowntimeMinutes: number;
  
  // Energy guidance based on DNA + time
  energyLevel: 'low' | 'moderate' | 'high';
  activityTypes: string[];        // Suggested types for this day
  
  // Explanation for AI
  constraints: string;            // Full prompt section
}

// =============================================================================
// DECISION TREE FUNCTIONS
// =============================================================================

/**
 * STEP 1: Categorize arrival window based on time
 */
export function categorizeArrivalWindow(arrivalMins: number): ArrivalWindow {
  if (arrivalMins < 360) return 'early_morning';  // Before 6 AM
  if (arrivalMins < 720) return 'morning';         // 6 AM - 12 PM
  if (arrivalMins < 840) return 'midday';          // 12 PM - 2 PM
  if (arrivalMins < 1020) return 'afternoon';      // 2 PM - 5 PM
  if (arrivalMins < 1200) return 'evening';        // 5 PM - 8 PM
  return 'night';                                   // After 8 PM
}

/**
 * STEP 2: Categorize departure window
 */
export function categorizeDepartureWindow(departureMins: number): DepartureWindow {
  if (departureMins < 420) return 'early_morning';  // Before 7 AM
  if (departureMins < 720) return 'morning';         // 7 AM - 12 PM
  if (departureMins < 900) return 'midday';          // 12 PM - 3 PM
  if (departureMins < 1080) return 'afternoon';      // 3 PM - 6 PM
  if (departureMins < 1260) return 'evening';        // 6 PM - 9 PM
  return 'night';                                    // After 9 PM
}

/**
 * STEP 3: Calculate earliest activity start based on DNA + arrival
 * 
 * CRITICAL: This checks the USER'S DNA, not hardcoded assumptions!
 */
export function calculateEarliestStart(
  flight: FlightData,
  hotel: HotelData,
  dna: TravelerDNA
): { time: string; reasoning: string } {
  // Default hotel check-in
  const DEFAULT_CHECK_IN_MINS = 15 * 60; // 3 PM = 900 mins
  
  // If we have flight arrival
  if (flight.hasOutboundFlight && flight.arrivalTimeMins !== undefined) {
    // Calculate logistics buffer based on DNA
    let customsBuffer = 60; // Base: 1 hour for customs/immigration
    let transferBuffer = 60; // Base: 1 hour for transfer
    let settleBuffer = 30;   // Base: 30 mins to settle in
    
    // Adjust based on DNA:
    // - Anxious planners (+planning) need more buffer
    // - Spontaneous travelers (-planning) are faster
    if (dna.traits.planning >= 5) {
      customsBuffer += 15;
      settleBuffer += 15;
    } else if (dna.traits.planning <= -5) {
      settleBuffer -= 15; // More spontaneous, less buffer
    }
    
    // Jet lag sensitivity adjustment
    if (dna.jetLagSensitivity === 'high') {
      settleBuffer += 60; // Need rest
    }
    
    // Mobility adjustments
    if (dna.mobilityLevel === 'limited') {
      customsBuffer += 30;
      transferBuffer += 30;
    }
    
    const totalBuffer = customsBuffer + transferBuffer + settleBuffer;
    const earliestMins = flight.arrivalTimeMins + totalBuffer;
    
    const hours = Math.floor(earliestMins / 60) % 24;
    const mins = earliestMins % 60;
    const time = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    
    return {
      time,
      reasoning: `Flight arrives at ${flight.arrivalTime24}. Buffer: ${customsBuffer}min customs + ${transferBuffer}min transfer + ${settleBuffer}min settle${dna.jetLagSensitivity === 'high' ? ' (+ jet lag rest)' : ''}${dna.mobilityLevel === 'limited' ? ' (+ mobility accommodation)' : ''}.`
    };
  }
  
  // No flight but we have hotel - assume standard check-in
  if (hotel.hasHotel) {
    const checkInTime = hotel.checkInTime || '15:00';
    const [h, m] = checkInTime.split(':').map(Number);
    const checkInMins = h * 60 + m;
    
    // Add 30 mins to settle after check-in
    let settleBuffer = 30;
    if (dna.traits.pace <= -5) settleBuffer += 30; // Relaxed travelers want more settle time
    
    const earliestMins = checkInMins + settleBuffer;
    const hours = Math.floor(earliestMins / 60) % 24;
    const mins = earliestMins % 60;
    
    return {
      time: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
      reasoning: `No flight provided. Hotel check-in at ${checkInTime}. Assuming arrival around check-in time with ${settleBuffer}min to settle.`
    };
  }
  
  // No flight, no hotel - conservative default, but check DNA
  let defaultStart = '15:30'; // Conservative 3:30 PM
  let reasoning = 'No flight or hotel provided.';
  
  // If user is an early bird, maybe they arrive early
  if (dna.sleepSchedule === 'early_bird') {
    defaultStart = '10:00';
    reasoning += ' User is an early bird, assuming morning arrival.';
  } else if (dna.sleepSchedule === 'night_owl') {
    defaultStart = '16:00';
    reasoning += ' User is a night owl, assuming later arrival.';
  } else {
    reasoning += ' Using conservative 3:30 PM start (can adjust with flight details).';
  }
  
  return { time: defaultStart, reasoning };
}

/**
 * STEP 4: Calculate latest activity end based on DNA + departure
 */
export function calculateLatestEnd(
  flight: FlightData,
  hotel: HotelData,
  dna: TravelerDNA,
  isLastDay: boolean
): { time: string; reasoning: string } {
  if (!isLastDay) {
    // Not the last day - end based on DNA energy levels
    let endTime = '21:00'; // Default 9 PM
    
    if (dna.sleepSchedule === 'early_bird') {
      endTime = '20:00';
    } else if (dna.sleepSchedule === 'night_owl') {
      endTime = '23:00';
    }
    
    // Relaxed pace = end earlier
    if (dna.traits.pace <= -5) {
      const [h] = endTime.split(':').map(Number);
      endTime = `${String(Math.max(19, h - 1)).padStart(2, '0')}:00`;
    }
    
    return {
      time: endTime,
      reasoning: `Non-departure day. End time based on ${dna.sleepSchedule || 'balanced'} schedule and ${dna.traits.pace <= -3 ? 'relaxed' : dna.traits.pace >= 3 ? 'active' : 'moderate'} pace preference.`
    };
  }
  
  // Last day with flight
  if (flight.hasReturnFlight && flight.departureTimeMins !== undefined) {
    // Calculate required buffer
    let checkoutBuffer = 30;    // Checkout time
    let transferBuffer = 60;    // Hotel to airport
    let airportBuffer = 180;    // Arrive 3 hours before flight (consistent for all flights)
    
    // Anxious planner adjustment
    if (dna.traits.planning >= 5) {
      airportBuffer += 30;
    }
    
    // Mobility adjustment
    if (dna.mobilityLevel === 'limited') {
      checkoutBuffer += 15;
      transferBuffer += 30;
    }
    
    const totalBuffer = checkoutBuffer + transferBuffer + airportBuffer;
    const latestMins = flight.departureTimeMins - totalBuffer;
    
    const hours = Math.floor(Math.max(0, latestMins) / 60) % 24;
    const mins = Math.max(0, latestMins) % 60;
    const time = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    
    return {
      time,
      reasoning: `Flight departs at ${flight.departureTime24}. Buffer: ${airportBuffer}min airport + ${transferBuffer}min transfer + ${checkoutBuffer}min checkout. All activities must end by ${time}.`
    };
  }
  
  // Last day, no flight - assume afternoon checkout
  const checkoutTime = hotel.checkOutTime || '11:00';
  return {
    time: checkoutTime,
    reasoning: `No departure flight provided. Using hotel checkout time of ${checkoutTime}. User should add departure details for better planning.`
  };
}

/**
 * STEP 5: Determine activity density based on DNA
 */
export function calculateActivityDensity(
  dna: TravelerDNA,
  isFirstDay: boolean,
  isLastDay: boolean,
  arrivalWindow?: ArrivalWindow,
  departureWindow?: DepartureWindow
): { maxActivities: number; minDowntime: number; reasoning: string } {
  // Base from pace trait
  let baseMax = 5; // Moderate default
  let baseDowntime = 30;
  
  // Pace trait is the PRIMARY driver
  if (dna.traits.pace <= -7) {
    baseMax = 3;
    baseDowntime = 120; // 2 hours between major activities
  } else if (dna.traits.pace <= -4) {
    baseMax = 4;
    baseDowntime = 90;
  } else if (dna.traits.pace >= 7) {
    baseMax = 8;
    baseDowntime = 15;
  } else if (dna.traits.pace >= 4) {
    baseMax = 7;
    baseDowntime = 20;
  }
  
  // Arrival day reductions
  if (isFirstDay) {
    if (arrivalWindow === 'evening' || arrivalWindow === 'night') {
      baseMax = Math.min(baseMax, 2); // Just dinner maybe
    } else if (arrivalWindow === 'afternoon') {
      baseMax = Math.min(baseMax, 3);
    } else if (arrivalWindow === 'midday') {
      baseMax = Math.min(baseMax, 4);
    }
    // Morning arrival gets full count
  }
  
  // Departure day reductions
  if (isLastDay) {
    if (departureWindow === 'early_morning' || departureWindow === 'morning') {
      baseMax = Math.min(baseMax, 1); // Just checkout
    } else if (departureWindow === 'midday') {
      baseMax = Math.min(baseMax, 2);
    } else if (departureWindow === 'afternoon') {
      baseMax = Math.min(baseMax, 3);
    }
  }
  
  // Jet lag adjustment for first day
  if (isFirstDay && dna.jetLagSensitivity === 'high') {
    baseMax = Math.max(2, baseMax - 2);
    baseDowntime += 30;
  }
  
  const pacingLabel = dna.traits.pace <= -4 ? 'relaxed' : dna.traits.pace >= 4 ? 'active' : 'moderate';
  let reasoning = `${pacingLabel} pace (trait: ${dna.traits.pace > 0 ? '+' : ''}${dna.traits.pace})`;
  
  if (isFirstDay) reasoning += `, arrival day (${arrivalWindow || 'unknown'} arrival)`;
  if (isLastDay) reasoning += `, departure day (${departureWindow || 'unknown'} departure)`;
  if (dna.jetLagSensitivity === 'high' && isFirstDay) reasoning += ', high jet lag sensitivity';
  
  return {
    maxActivities: baseMax,
    minDowntime: baseDowntime,
    reasoning
  };
}

/**
 * STEP 6: Determine energy level for the day based on DNA + timing
 */
export function determineEnergyLevel(
  dna: TravelerDNA,
  isFirstDay: boolean,
  isLastDay: boolean,
  arrivalWindow?: ArrivalWindow
): 'low' | 'moderate' | 'high' {
  // First day after travel = lower energy (unless user explicitly high-energy)
  if (isFirstDay) {
    if (dna.traits.adventure >= 7 && dna.jetLagSensitivity !== 'high') {
      return 'moderate'; // Thrill-seekers recover fast
    }
    if (arrivalWindow === 'morning' || arrivalWindow === 'early_morning') {
      return dna.jetLagSensitivity === 'high' ? 'low' : 'moderate';
    }
    return 'low';
  }
  
  // Last day = moderate (need energy for travel)
  if (isLastDay) {
    return 'moderate';
  }
  
  // Regular days - based on adventure/pace traits
  if (dna.traits.adventure >= 5 && dna.traits.pace >= 3) {
    return 'high';
  }
  if (dna.traits.pace <= -3 || dna.traits.adventure <= -3) {
    return 'low';
  }
  return 'moderate';
}

/**
 * STEP 7: Suggest activity types based on DNA + energy level
 */
export function suggestActivityTypes(
  dna: TravelerDNA,
  energyLevel: 'low' | 'moderate' | 'high',
  isFirstDay: boolean
): string[] {
  const types: string[] = [];
  
  // Low energy suggestions
  if (energyLevel === 'low') {
    types.push('cafe', 'light_dining', 'scenic_viewpoint', 'neighborhood_walk');
    if (dna.interests.includes('food') || dna.interests.includes('culinary')) {
      types.push('local_market', 'food_tasting');
    }
    if (dna.traits.comfort >= 3) {
      types.push('spa', 'relaxation');
    }
  }
  
  // Moderate energy
  if (energyLevel === 'moderate') {
    types.push('museum', 'cultural_site', 'walking_tour', 'dining');
    if (dna.interests.includes('history')) types.push('historical_site');
    if (dna.interests.includes('art')) types.push('gallery', 'street_art');
  }
  
  // High energy
  if (energyLevel === 'high') {
    types.push('hiking', 'adventure', 'active_tour', 'exploration');
    if (dna.traits.social >= 3) types.push('group_activity', 'local_experience');
    if (dna.traits.adventure >= 5) types.push('adrenaline', 'outdoor_adventure');
  }
  
  // First day special: prioritize hotel-area activities
  if (isFirstDay) {
    types.unshift('nearby_hotel', 'neighborhood_exploration');
  }
  
  return [...new Set(types)];
}

// =============================================================================
// PROMPT SEGMENT BUILDERS
// =============================================================================

/**
 * Build the FULL persona manuscript - this is the "entire life" injection
 */
export function buildPersonaManuscript(dna: TravelerDNA, tripContext: TripContext): string {
  const lines: string[] = [];
  
  lines.push(`${'='.repeat(70)}`);
  lines.push(`🧬 COMPLETE TRAVELER DNA PROFILE`);
  lines.push(`${'='.repeat(70)}`);
  lines.push('');
  
  // Archetype identity
  if (dna.primaryArchetype) {
    lines.push(`🎭 PRIMARY IDENTITY: ${dna.primaryArchetype.replace(/_/g, ' ').toUpperCase()}`);
    if (dna.secondaryArchetype) {
      lines.push(`   Secondary influence: ${dna.secondaryArchetype.replace(/_/g, ' ')}`);
    }
    if (dna.archetypeConfidence) {
      const confLabel = dna.archetypeConfidence >= 80 ? 'HIGH' : dna.archetypeConfidence >= 60 ? 'MODERATE' : 'LOW';
      lines.push(`   Confidence: ${dna.archetypeConfidence}% (${confLabel})`);
    }
    lines.push('');
  }

  // ============================================================================
  // TRUST CONTRACT: Identity overrides
  // If the user has explicitly selected a primary/secondary archetype, that identity
  // must be obeyed even if trait scores or older days drifted in another direction.
  // ============================================================================
  if (dna.primaryArchetype) {
    const primary = dna.primaryArchetype;
    const secondary = dna.secondaryArchetype;
    const budgetTier = (tripContext.budgetTier || '').toLowerCase();
    const isPremiumTrip = ['premium', 'luxury'].includes(budgetTier);

    const guardrails: string[] = [];
    guardrails.push('1) The PRIMARY/SECONDARY identity above is the source of truth. Do not contradict it.');
    guardrails.push('2) Do not mirror the “style” of previous days if they conflict with this identity.');
    guardrails.push(
      isPremiumTrip
        ? '3) This is a premium/luxury trip tier, so elevated venues are acceptable—but still match the identity.'
        : '3) This is NOT a premium/luxury trip tier. STRICTLY AVOID: “private tour”, VIP/skip-the-line framing, five-star hotel spa framing, and “luxury/splurge/premium/exclusive” wording unless explicitly requested. NEVER put “Luxury”, “VIP”, or “Private” in activity titles.'
    );

    if (!isPremiumTrip) {
      guardrails.push('4) DEFAULT TOUR STYLE: self-guided or small-group. Do NOT recommend private tours by default.');
      guardrails.push('5) VENUE RULE: Do not anchor activities at 5-star hotel venues (Waldorf/Westin/Four Seasons style) unless the traveler explicitly selected that hotel.');
      guardrails.push('6) RESTORATION RULE: If you need downtime, use parks, gardens, riverside walks, scenic viewpoints, cafés, slow lunches, bookshops. Avoid spa/baths/hammams/massage unless explicitly requested.');
    }

    // NOTE: No hardcoded archetype-specific guardrails here.
    // All archetypes derive behavior from canonical profile columns and trait scores.

    if (guardrails.length > 0) {
      lines.push(`🧭 IDENTITY OVERRIDES (HIGHEST PRIORITY)`);
      lines.push(`${'─'.repeat(50)}`);
      for (const g of guardrails) lines.push(`   ${g}`);
      lines.push('');
    }
  }
  
  // Full trait breakdown with behavioral implications
  lines.push(`📊 TRAIT PROFILE (Behavioral Guide)`);
  lines.push(`${'─'.repeat(50)}`);
  
  const traitDescriptions: Record<string, { low: string; high: string; implication: (score: number) => string }> = {
    pace: {
      low: 'deeply relaxed, savors moments',
      high: 'fast-paced, maximizer',
      implication: (s) => s <= -5 
        ? 'Schedule MAX 4-5 activities/day with 2+ hour downtime blocks. Quality over quantity.'
        : s >= 5
        ? 'Pack the day! 7-8 activities, minimal gaps, keep them moving.'
        : 'Balanced 5-6 activities with reasonable buffers.'
    },
    social: {
      low: 'solo/intimate, values quiet',
      high: 'social butterfly, loves groups',
      implication: (s) => s <= -5
        ? 'Avoid crowded venues and large group tours. Prefer self-guided walks, off-peak visits, and quieter cafes.'
        : s >= 5
        ? 'Include group activities, communal dining, social experiences, meeting locals.'
        : 'Mix of solo and social experiences.'
    },
    adventure: {
      low: 'comfort-seeker, safe choices',
      high: 'thrill-seeker, risk-taker',
      implication: (s) => s <= -5
        ? 'Stick to well-known, comfortable experiences. No extreme activities, unfamiliar areas.'
        : s >= 5
        ? 'Include adventure sports, off-the-beaten-path, adrenaline activities, unique challenges.'
        : 'Balanced mix of comfortable and slightly adventurous.'
    },
    authenticity: {
      low: 'tourist-friendly is fine',
      high: 'local-only, hates tourist traps',
      implication: (s) => s <= -5
        ? 'Mainstream attractions are welcome. Don\'t overthink "authenticity".'
        : s >= 5
        ? 'AVOID all tourist traps. Only local favorites, hidden gems, off-guidebook spots.'
        : 'Mix of highlights and local recommendations.'
    },
    comfort: {
      low: 'budget-conscious, minimalist',
      high: 'luxury-seeking, premium comfort',
      implication: (s) => s <= -5
        ? 'Budget options are preferred. Don\'t prioritize comfort over cost.'
        : s >= 5
        ? 'High comfort focus: well-reviewed, convenient, low-hassle experiences. Avoid “luxury/private/VIP” framing unless explicitly requested.'
        : 'Balance of occasional upgrades and value options (avoid “luxury/splurge” framing unless asked).'
    },
    planning: {
      low: 'spontaneous, go-with-flow',
      high: 'detailed planner, needs structure',
      implication: (s) => s <= -5
        ? 'Leave gaps for spontaneity. General frameworks, not minute-by-minute plans.'
        : s >= 5
        ? 'Detailed timing, reservations, backup options, specific instructions.'
        : 'Key bookings with flexibility for discovery.'
    },
    transformation: {
      low: 'pure leisure, relaxation',
      high: 'growth-focused, seeking meaning',
      implication: (s) => s <= -5
        ? 'Focus on relaxation, enjoyment. No "educational" agenda required.'
        : s >= 5
        ? 'Include learning experiences, cultural immersion, personal growth opportunities.'
        : 'Mix of leisure and enrichment.'
    },
    budget: {
      low: 'splurge-forward, money is no object',
      high: 'value-focused, strategic spending',
      implication: (s) => {
        if (s <= -5) return 'Premium everything. Money is no object. Michelin and luxury expected.';
        if (s <= -2) return 'Willing to splurge. High-end options welcome but not required.';
        if (s <= 2)  return 'Balance quality and value. Occasional splurge OK, but justify it.';
        if (s <= 5)  return 'Value-conscious. Avoid luxury unless exceptional value. No Michelin unless signature meal.';
        return 'Strict budget. Best value only. No luxury. No overpriced tourist spots.';
      }
    }
  };
  
  for (const [trait, desc] of Object.entries(traitDescriptions)) {
    const score = dna.traits[trait as keyof typeof dna.traits] || 0;
    const direction = score <= -3 ? desc.low : score >= 3 ? desc.high : 'balanced';
    const intensity = Math.abs(score) >= 7 ? 'STRONG' : Math.abs(score) >= 4 ? 'Moderate' : 'Slight';
    
    lines.push(`   ${trait.toUpperCase()}: ${score > 0 ? '+' : ''}${score}/10`);
    lines.push(`      → ${intensity} ${direction}`);
    lines.push(`      → ${desc.implication(score)}`);
    lines.push('');
  }
  
  // Timing/energy patterns
  lines.push(`⏰ TIMING & ENERGY PATTERNS`);
  lines.push(`${'─'.repeat(50)}`);
  
  if (dna.sleepSchedule) {
    const scheduleMap: Record<string, string> = {
      'early_bird': '🌅 EARLY BIRD: Start day at 7-8 AM, dinner by 7 PM, activities end by 8:30 PM',
      'night_owl': '🌙 NIGHT OWL: Start at 10-11 AM, late dinners (8 PM+), include nightlife',
      'needs_rest': '😴 NEEDS DAYTIME REST: Morning start, mandatory 2+ hour siesta (2-4 PM)',
      'flexible': '⚖️ FLEXIBLE: Adapt to destination norms'
    };
    lines.push(`   ${scheduleMap[dna.sleepSchedule] || dna.sleepSchedule}`);
  }
  
  // ENERGY PEAK SCHEDULING - Critical for activity intensity mapping
  if (dna.energyPeak) {
    lines.push('');
    lines.push(`   ⚡ ENERGY PEAK: ${dna.energyPeak.toUpperCase()}`);
    
    const peakSchedulingRules: Record<string, {
      peakWindow: string;
      highIntensity: string;
      lowIntensity: string;
      examples: string;
    }> = {
      'morning': {
        peakWindow: '8 AM - 12 PM',
        highIntensity: 'Schedule museums, hiking, walking tours, markets, adventure activities during MORNING',
        lowIntensity: 'Afternoon/evening: cafés, light dining, scenic sits, relaxed neighborhood strolls',
        examples: 'E.g., Hike at 9 AM → Lunch → Café → Light evening stroll'
      },
      'afternoon': {
        peakWindow: '12 PM - 5 PM',
        highIntensity: 'Schedule key attractions, active tours, major sights during AFTERNOON',
        lowIntensity: 'Morning: leisurely breakfast, café. Evening: fine dining, sunset spots',
        examples: 'E.g., Slow breakfast → Museum at 1 PM → Walking tour at 3 PM → Sunset dinner'
      },
      'evening': {
        peakWindow: '5 PM - 10 PM',
        highIntensity: 'Schedule active experiences, nightlife, vibrant neighborhoods during EVENING',
        lowIntensity: 'Morning/afternoon: rest, spa, casual exploration, work-from-café',
        examples: 'E.g., Late breakfast → Rest → Light afternoon → Food tour at 6 PM → Nightlife'
      }
    };
    
    const peakRules = peakSchedulingRules[dna.energyPeak];
    if (peakRules) {
      lines.push(`      Peak window: ${peakRules.peakWindow}`);
      lines.push(`      ✅ HIGH-INTENSITY: ${peakRules.highIntensity}`);
      lines.push(`      ⬇️ LOW-INTENSITY: ${peakRules.lowIntensity}`);
      lines.push(`      ${peakRules.examples}`);
    }
  } else {
    lines.push(`   ⚡ ENERGY PEAK: Not specified - use balanced distribution`);
  }
  lines.push('');
  
  if (dna.jetLagSensitivity) {
    const jetLagMap: Record<string, string> = {
      'low': 'Low jet lag sensitivity - can dive into activities quickly',
      'moderate': 'Moderate jet lag - Day 1 should be lighter than usual',
      'high': 'HIGH JET LAG SENSITIVITY - Day 1 must be very light, include rest blocks'
    };
    lines.push(`   ${jetLagMap[dna.jetLagSensitivity]}`);
  }
  lines.push('');
  
  // Emotional drivers
  if (dna.emotionalDrivers.length > 0) {
    lines.push(`💫 EMOTIONAL DRIVERS (Why they travel)`);
    lines.push(`${'─'.repeat(50)}`);
    
    const driverDescriptions: Record<string, string> = {
      'escape': 'Needs to break from routine - avoid work reminders, maximize contrast',
      'discovery': 'Driven by curiosity - prioritize learning, new experiences, hidden gems',
      'connection': 'Seeks bonding - prioritize shared experiences, local interactions',
      'adventure': 'Craves excitement - include unique, memorable, story-worthy activities',
      'relaxation': 'Needs recovery - spa, beach, quiet time, no rushing',
      'achievement': 'Bucket-list driven - include must-see landmarks, photo opportunities',
      'transformation': 'Seeking growth - cultural immersion, challenging experiences',
      'romance': 'Prioritize intimate settings, couple activities, special moments'
    };
    
    for (const driver of dna.emotionalDrivers.slice(0, 5)) {
      lines.push(`   ✨ ${driver.toUpperCase()}: ${driverDescriptions[driver.toLowerCase()] || driver}`);
    }
    lines.push('');
  }
  
  // Interests
  if (dna.interests.length > 0) {
    lines.push(`🎯 INTERESTS (Activity selection priority)`);
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`   ${dna.interests.join(', ')}`);
    lines.push(`   → Prioritize activities aligned with these interests`);
    lines.push('');
  }
  
  // Travel vibes
  if (dna.travelVibes.length > 0) {
    lines.push(`🌍 TRAVEL VIBES (Atmosphere preferences)`);
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`   Attracted to: ${dna.travelVibes.join(', ')}`);
    lines.push('');
  }
  
  // HARD CONSTRAINTS
  lines.push(`⚠️ HARD CONSTRAINTS (NON-NEGOTIABLE)`);
  lines.push(`${'─'.repeat(50)}`);
  
  // Dynamic dietary enforcement - import and use buildDietaryEnforcementPrompt
  // For now, keep the basic reference here and the full enforcement is injected separately
  if (dna.dietaryRestrictions.length > 0) {
    lines.push(`   🍽️ DIETARY RESTRICTIONS: ${dna.dietaryRestrictions.join(', ')}`);
    lines.push(`      ⚠️ SEE CRITICAL DIETARY CONSTRAINTS SECTION BELOW FOR FULL RULES`);
  }
  
  if (dna.mobilityLevel && dna.mobilityLevel !== 'full') {
    lines.push(`   ♿ MOBILITY: ${dna.mobilityLevel}`);
    if (dna.mobilityLevel === 'limited') {
      lines.push(`      AVOID: long walks, stairs, inaccessible venues`);
      lines.push(`      REQUIRE: elevator access, accessible transport, ground-floor seating`);
    }
  }
  
  if (dna.accessibilityNeeds.length > 0) {
    lines.push(`   ♿ ACCESSIBILITY: ${dna.accessibilityNeeds.join(', ')}`);
  }
  
  if (dna.foodDislikes.length > 0) {
    lines.push(`   ❌ FOOD AVOID: ${dna.foodDislikes.join(', ')}`);
    lines.push(`      NEVER recommend restaurants featuring these`);
  }
  
  lines.push('');
  
  // Food loves
  if (dna.foodLikes.length > 0) {
    lines.push(`✅ FOOD LOVES`);
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`   ${dna.foodLikes.join(', ')}`);
    lines.push(`   Prioritize restaurants specializing in these`);
    lines.push('');
  }
  
  // Companions context
  if (dna.companions) {
    lines.push(`👥 TRAVEL PARTY`);
    lines.push(`${'─'.repeat(50)}`);
    
    const companionGuidance: Record<string, string> = {
      'solo': 'Solo traveler - include cafe time for people-watching, opportunities to meet locals, flexible timing',
      'couple': 'Traveling as couple - romantic spots, intimate dining, couple activities, sunset views',
      'family': `Family of ${tripContext.travelers}${dna.childrenCount ? ` (${dna.childrenCount} children)` : ''} - kid-friendly venues, manageable pacing, family activities`,
      'friends': 'Friend group - social activities, shared experiences, nightlife options',
      'group': 'Larger group - group-friendly venues, activities that accommodate numbers'
    };
    
    lines.push(`   ${companionGuidance[dna.companions] || dna.companions}`);
    lines.push('');
  }
  
  // ============================================================================
  // NEW PHASE 16: Wire collected preferences into prompt
  // ============================================================================
  
  // Gap 1: Daily Budget Constraint
  if (dna.dailyBudgetTier) {
    const budgetRanges: Record<string, string> = {
      'budget': '$50-150 per person per day (meals, activities, local transport — NOT flights/hotels)',
      'moderate': '$150-300 per person per day',
      'comfort': '$300-500 per person per day',
      'premium': '$500-800 per person per day',
      'luxury': '$800+ per person per day',
    };
    lines.push(`💰 DAILY BUDGET CONSTRAINT`);
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`   Target daily spend: ${budgetRanges[dna.dailyBudgetTier] || dna.dailyBudgetTier}`);
    lines.push(`   Every day's activities + meals + transport MUST stay within this range.`);
    lines.push(`   If suggesting a premium activity, balance it by suggesting a free/low-cost activity the same day.`);
    lines.push('');
  }
  
  // Gap 2: Accommodation Context
  if (dna.accommodationStyle) {
    const styleMap: Record<string, string> = {
      'hotel': 'standard hotels',
      'boutique': 'boutique hotels',
      'hostel': 'hostels',
      'airbnb': 'vacation rentals / Airbnb',
      'resort': 'resorts',
      'luxury_cocoon': 'luxury suites',
    };
    const stayType = styleMap[dna.accommodationStyle] || dna.accommodationStyle;
    lines.push(`🏨 ACCOMMODATION CONTEXT`);
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`   Traveler stays in: ${stayType}`);
    lines.push(`   Reference their accommodation type naturally when mentioning "head back" or "freshen up."`);
    lines.push(`   Match activity suggestions to this level — don't suggest room service for a hostel guest.`);
    lines.push('');
  }
  
  // Gap 3: Recovery Style
  if (dna.recoveryStyle && dna.recoveryStyle.length > 0) {
    lines.push(`🧘 RECOVERY PREFERENCES`);
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`   How they recover: ${dna.recoveryStyle.join(', ')}`);
    if (dna.recoveryStyle.includes('early_sleep')) {
      lines.push(`   ⚠️ EARLY SLEEPER: No activities after 8:30 PM. Dinner by 7:00 PM.`);
    }
    if (dna.recoveryStyle.includes('spa_treatments')) {
      lines.push(`   Include a spa/wellness activity every 2-3 days.`);
    }
    if (dna.recoveryStyle.includes('alone_time')) {
      lines.push(`   Include at least one 1.5+ hour unscheduled block per day for personal time.`);
    }
    if (dna.recoveryStyle.includes('drinks_socializing')) {
      lines.push(`   Include evening social venues (bars, lounges) for wind-down.`);
    }
    lines.push('');
  }
  
  // Gap 5: Recommendation Style
  if (dna.recommendationStyle) {
    lines.push(`🔍 RECOMMENDATION STYLE`);
    lines.push(`${'─'.repeat(50)}`);
    if (dna.recommendationStyle === 'off_the_beaten_path') {
      lines.push(`   IMPORTANT: Prefer hidden gems, local favorites, and lesser-known spots.`);
      lines.push(`   Avoid: Top-10 lists, tourist-trap restaurants, overcrowded attractions.`);
      lines.push(`   At least 60% of suggestions should be places most tourists wouldn't find.`);
    } else {
      lines.push(`   Prioritize well-reviewed, popular destinations that are popular for good reason.`);
      lines.push(`   Include established favorites with strong ratings and reviews.`);
    }
    lines.push('');
  }
  
  // Gap 6: AI Assistance Level (affects itinerary detail level)
  if (dna.aiAssistanceLevel === 'minimal') {
    lines.push(`📋 PLANNING FLEXIBILITY`);
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`   This traveler prefers to plan themselves. Generate a LOOSE framework:`);
    lines.push(`   - Suggest neighborhoods/areas to explore, not specific activities`);
    lines.push(`   - Give 2-3 options per time slot instead of one fixed plan`);
    lines.push(`   - Include more unscheduled "explore on your own" blocks`);
    lines.push('');
  } else if (dna.aiAssistanceLevel === 'balanced') {
    lines.push(`📋 PLANNING FLEXIBILITY`);
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`   Provide specific suggestions but frame them as options, not a fixed schedule.`);
    lines.push('');
  }
  // 'full' = default behavior (detailed plan), no extra prompt needed
  
  // ============================================================================
  // PERSONALIZATION QUALITY BAR (MANDATORY FOR ALL AI OUTPUTS)
  // ============================================================================
  lines.push('');
  lines.push(`${'='.repeat(70)}`);
  lines.push(`🎯 PERSONALIZATION QUALITY BAR (MANDATORY — HIGHEST PRIORITY)`);
  lines.push(`${'='.repeat(70)}`);
  lines.push(`Every recommendation MUST pass this test:`);
  lines.push(`"Could the user have gotten this same advice from a Google search?" If YES → it's NOT good enough.`);
  lines.push('');
  lines.push(`RULES FOR EVERY ACTIVITY, RESTAURANT, AND TIP:`);
  lines.push(`1. Be OPINIONATED: "This restaurant because of your love of omakase and your comfort budget" — NOT "this restaurant is popular"`);
  lines.push(`2. Be SPECIFIC: "Arrive before 10am to beat the school groups — the Crown Jewels queue is shortest at opening" — NOT "visit early"`);
  lines.push(`3. Be PERSONAL: Reference their archetype, traits, past trips, or preferences in the "whyThisFits" field`);
  lines.push(`4. Be TIMELY: Mention seasonal specifics, current exhibitions, recent openings, or events happening during their dates`);
  lines.push(`5. NEVER give generic tourist advice. Every tip should feel like it came from a well-traveled friend who has read their diary.`);
  lines.push(`6. For restaurants: explain WHY it fits THIS person's cuisine preferences, budget, and dining style`);
  lines.push(`7. For activities: connect to their interests, emotional drivers, or patterns from past trips`);
  lines.push(`8. For "whyThisFits": MUST reference at least ONE specific trait/preference (e.g., "Your authenticity score of +7 means you'll prefer this local market over the tourist-facing food hall")`);
  lines.push(`9. For "tips": Must be insider-level. "The gift shop has a back entrance that skips the main queue" — NOT "buy tickets online"`);
  lines.push(`10. If the traveler has past trips, reference them: "Since you loved the street food scene in Bangkok, you'll enjoy this hawker-style market"`);
  lines.push('');
  lines.push(`ANTI-GENERIC EXAMPLES:`);
  lines.push(`❌ "Visit the British Museum (free)" → Generic, zero personalization`);
  lines.push(`✅ "The British Museum's new Silk Road exhibition runs through March — given your interest in Asian culture from your Tokyo trip, it's worth 2 hours. Arrive before 10am to beat school groups."`);
  lines.push(`❌ "Try local food" → Meaningless`);
  lines.push(`✅ "Myojaku in Nishiazabu just earned its 3rd Michelin star — with your omakase obsession and luxury budget, this is your signature meal of the trip. Book 3 weeks out."`);
  lines.push(`${'='.repeat(70)}`);
  lines.push(`END OF TRAVELER DNA PROFILE`);
  lines.push(`${'='.repeat(70)}`);
  
  return lines.join('\n');
}

/**
 * Build Day 1 arrival constraints based on flight + hotel + DNA
 */
export function buildArrivalDayPrompt(
  flight: FlightData,
  hotel: HotelData,
  dna: TravelerDNA,
  tripContext: TripContext
): DayConstraints {
  const arrivalWindow = flight.arrivalTimeMins !== undefined 
    ? categorizeArrivalWindow(flight.arrivalTimeMins)
    : 'unknown';
  
  const { time: earliestStart, reasoning: startReasoning } = calculateEarliestStart(flight, hotel, dna);
  const { time: latestEnd, reasoning: endReasoning } = calculateLatestEnd(flight, hotel, dna, false);
  const { maxActivities, minDowntime, reasoning: densityReasoning } = calculateActivityDensity(
    dna, true, false, arrivalWindow, undefined
  );
  const energyLevel = determineEnergyLevel(dna, true, false, arrivalWindow);
  const activityTypes = suggestActivityTypes(dna, energyLevel, true);
  
  // Build required sequence based on what data we have
  const requiredSequence: string[] = [];
  
  // airport_arrival removed — handled by Arrival Game Plan UI component
  
  if (hotel.hasHotel) {
    requiredSequence.push('hotel_check_in');
    if (dna.traits.pace <= -3 || dna.jetLagSensitivity === 'high') {
      requiredSequence.push('settle_in_rest');
    }
  }
  
  // Build constraint text
  const lines: string[] = [];
  lines.push(`${'='.repeat(60)}`);
  lines.push(`📅 DAY 1 CONSTRAINTS - ARRIVAL DAY`);
  lines.push(`${'='.repeat(60)}`);
  lines.push('');
  
  // Flight status
  if (flight.hasOutboundFlight) {
    lines.push(`✈️ FLIGHT ARRIVAL: ${flight.arrivalTime24} (${arrivalWindow.replace('_', ' ')})`);
    if (flight.arrivalAirport) {
      lines.push(`   Airport: ${flight.arrivalAirport}`);
    }
    lines.push('');
  } else {
    lines.push(`✈️ FLIGHT: Not provided`);
    lines.push(`   ⚠️ Recommend user adds flight details for accurate timing`);
    lines.push('');
  }
  
  // Hotel status
  if (hotel.hasHotel) {
    lines.push(`🏨 HOTEL: ${hotel.hotelName}`);
    if (hotel.hotelAddress) lines.push(`   Address: ${hotel.hotelAddress}`);
    if (hotel.hotelNeighborhood) lines.push(`   Neighborhood: ${hotel.hotelNeighborhood}`);
    lines.push(`   Check-in: ${hotel.checkInTime || '15:00 (standard)'}`);
    lines.push('');
    
    // Link back to flight
    if (!flight.hasOutboundFlight) {
      lines.push(`   ⚠️ ASSUMPTION: Since no flight provided, assuming arrival around hotel check-in time.`);
      lines.push(`   → First activity should be near ${hotel.hotelNeighborhood || 'hotel area'}`);
      lines.push('');
    }
  } else {
    lines.push(`🏨 HOTEL: Not provided`);
    lines.push(`   Using destination center as base`);
    lines.push('');
  }
  
  // Timing constraints
  lines.push(`⏰ TIMING CONSTRAINTS`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`   Earliest activity start: ${earliestStart}`);
  lines.push(`   → ${startReasoning}`);
  lines.push(`   Latest activity end: ${latestEnd}`);
  lines.push(`   → ${endReasoning}`);
  lines.push('');
  
  // Required sequence
  if (requiredSequence.length > 0) {
    lines.push(`📋 REQUIRED SEQUENCE (in order)`);
    lines.push(`${'─'.repeat(40)}`);
    const seqLabels: Record<string, string> = {
      'hotel_check_in': '1. Hotel Check-in & Refresh (category: accommodation)',
      'settle_in_rest': '2. Rest & Refresh (category: downtime)'
    };
    for (const step of requiredSequence) {
      lines.push(`   ${seqLabels[step] || step}`);
    }
    lines.push('');
  }
  
  // Energy & activity guidance
  lines.push(`⚡ ENERGY & ACTIVITY GUIDANCE`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`   Energy level: ${energyLevel.toUpperCase()}`);
  lines.push(`   Max EXPERIENCE activities: ${maxActivities} (${densityReasoning})`);
  lines.push(`   ⚠️ Meals (dinner at minimum), transit, and hotel check-in are MANDATORY additions on top.`);
  lines.push(`   Total entries for arrival day: ${maxActivities + 3}-${maxActivities + 6} (experiences + meals + transit + hotel)`);
  lines.push(`   Min downtime between activities: ${minDowntime} minutes`);
  lines.push('');
  lines.push(`   Suggested activity types for ${energyLevel} energy:`);
  lines.push(`   ${activityTypes.join(', ')}`);
  lines.push('');
  
  // DNA-specific arrival guidance
  if (dna.jetLagSensitivity === 'high') {
    lines.push(`⚠️ HIGH JET LAG SENSITIVITY`);
    lines.push(`   - Keep Day 1 very light`);
    lines.push(`   - Include 2+ hour rest block`);
    lines.push(`   - Focus on hotel neighborhood only`);
    lines.push(`   - Early dinner, early night`);
    lines.push('');
  }
  
  if (dna.traits.pace <= -5) {
    lines.push(`🧘 RELAXED PACE TRAVELER`);
    lines.push(`   - Don't rush to fill the day`);
    lines.push(`   - Quality of experience over quantity`);
    lines.push(`   - Long cafe sits, wandering welcome`);
    lines.push('');
  }
  
  if (arrivalWindow === 'evening' || arrivalWindow === 'night') {
    lines.push(`🌙 LATE ARRIVAL`);
    lines.push(`   - Day 1 is essentially: Arrive → Transfer → Check-in → Dinner (optional) → Rest`);
    lines.push(`   - Do NOT schedule sightseeing`);
    lines.push(`   - Dinner should be NEAR hotel`);
    lines.push('');
  }
  
  return {
    dayNumber: 1,
    date: tripContext.startDate,
    isFirstDay: true,
    isLastDay: tripContext.totalDays === 1,
    earliestStartTime: earliestStart,
    latestEndTime: latestEnd,
    requiredSequence,
    maxActivities,
    minDowntimeMinutes: minDowntime,
    energyLevel,
    activityTypes,
    constraints: lines.join('\n')
  };
}

/**
 * Build Last Day departure constraints based on flight + hotel + DNA
 */
export function buildDepartureDayPrompt(
  flight: FlightData,
  hotel: HotelData,
  dna: TravelerDNA,
  tripContext: TripContext,
  dayNumber: number
): DayConstraints {
  const departureWindow = flight.departureTimeMins !== undefined
    ? categorizeDepartureWindow(flight.departureTimeMins)
    : 'unknown';
  
  // For last day, earliest start is based on DNA (not arrival)
  let earliestStart = '08:00'; // Default morning
  if (dna.sleepSchedule === 'night_owl') earliestStart = '09:30';
  if (dna.sleepSchedule === 'early_bird') earliestStart = '07:00';
  
  const { time: latestEnd, reasoning: endReasoning } = calculateLatestEnd(flight, hotel, dna, true);
  const { maxActivities, minDowntime, reasoning: densityReasoning } = calculateActivityDensity(
    dna, false, true, undefined, departureWindow
  );
  const energyLevel = determineEnergyLevel(dna, false, true);
  const activityTypes = suggestActivityTypes(dna, energyLevel, false);
  
  // Required sequence for departure day
  const requiredSequence: string[] = [];
  
  if (hotel.hasHotel) {
    requiredSequence.push('hotel_checkout');
  }
  
  if (flight.hasReturnFlight) {
    requiredSequence.push('transfer_to_airport', 'airport_departure');
  }
  
  // Build constraint text
  const lines: string[] = [];
  lines.push(`${'='.repeat(60)}`);
  lines.push(`📅 DAY ${dayNumber} CONSTRAINTS - DEPARTURE DAY`);
  lines.push(`${'='.repeat(60)}`);
  lines.push('');
  
  // Flight status
  if (flight.hasReturnFlight) {
    lines.push(`✈️ FLIGHT DEPARTURE: ${flight.departureTime24} (${departureWindow.replace('_', ' ')})`);
    if (flight.departureAirport) {
      lines.push(`   Airport: ${flight.departureAirport}`);
    }
    lines.push('');
  } else {
    lines.push(`✈️ RETURN FLIGHT: Not provided`);
    lines.push(`   ⚠️ Recommend user adds departure details`);
    lines.push(`   Using hotel checkout time as departure anchor`);
    lines.push('');
  }
  
  // Hotel checkout
  if (hotel.hasHotel) {
    lines.push(`🏨 HOTEL CHECKOUT: ${hotel.checkOutTime || '11:00 (standard)'}`);
    if (hotel.hotelName) lines.push(`   From: ${hotel.hotelName}`);
    lines.push('');
  }
  
  // Timing constraints
  lines.push(`⏰ TIMING CONSTRAINTS`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`   Day starts: ${earliestStart}`);
  lines.push(`   LATEST activity end: ${latestEnd}`);
  lines.push(`   → ${endReasoning}`);
  lines.push('');
  
  // Required sequence
  lines.push(`📋 REQUIRED ENDING SEQUENCE (in order)`);
  lines.push(`${'─'.repeat(40)}`);
  
  if (hotel.hasHotel) {
    // Calculate checkout time based on departure
    const checkoutTime = flight.hasReturnFlight && flight.departureTimeMins
      ? minutesToHHMM(flight.departureTimeMins - 210) // 3.5 hours before flight
      : hotel.checkOutTime || '11:00';
    lines.push(`   1. "Hotel Checkout" at ${checkoutTime} (category: accommodation)`);
  }
  
  if (flight.hasReturnFlight && flight.departureTimeMins) {
    const transferTime = minutesToHHMM(flight.departureTimeMins - 150); // 2.5 hours before
    lines.push(`   2. "Transfer to Airport" at ${transferTime} (category: transport)`);
    lines.push(`   3. "Departure from Airport" endTime: ${flight.departureTime24} (category: transport)`);
    lines.push('');
    lines.push(`   🚫 DO NOT generate any additional airport-related activities.`);
    lines.push(`   The above 3 items are the ONLY checkout/transfer/departure entries.`);
    lines.push(`   Do NOT add extra "Head to Airport", "Go to Airport", or duplicate transfer/departure entries.`);
  }
  lines.push('');
  
  // Activity guidance
  lines.push(`⚡ ACTIVITY GUIDANCE`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`   Max EXPERIENCE activities BEFORE checkout: ${maxActivities}`);
  lines.push(`   ⚠️ Meals (breakfast at minimum), transit, hotel checkout, and airport transfer are MANDATORY additions.`);
  lines.push(`   Total entries for departure day: ${maxActivities + 3}-${maxActivities + 5} (experiences + meals + transit + checkout)`);
  lines.push(`   (${densityReasoning})`);
  lines.push('');
  
  // Departure window specific guidance
  if (departureWindow === 'early_morning' || departureWindow === 'morning') {
    lines.push(`⚠️ EARLY DEPARTURE`);
    lines.push(`   - NO sightseeing activities on departure day`);
    lines.push(`   - Schedule: Wake → Pack → Checkout → Airport`);
    lines.push(`   - Optional: Quick breakfast near hotel only`);
    lines.push('');
  } else if (departureWindow === 'midday') {
    lines.push(`📝 MIDDAY DEPARTURE`);
    lines.push(`   - Morning only for activities`);
    lines.push(`   - One quick breakfast/coffee spot`);
    lines.push(`   - Pack and checkout by 10:00-10:30`);
    lines.push('');
  } else if (departureWindow === 'afternoon') {
    lines.push(`📝 AFTERNOON DEPARTURE`);
    lines.push(`   - Morning activities possible`);
    lines.push(`   - Plan for late morning checkout`);
    lines.push(`   - One morning activity + brunch feasible`);
    lines.push('');
  } else if (departureWindow === 'evening' || departureWindow === 'night') {
    lines.push(`📝 LATE DEPARTURE`);
    lines.push(`   - Nearly full day available`);
    lines.push(`   - Standard checkout, luggage storage at hotel`);
    lines.push(`   - Lunch + afternoon activity possible`);
    lines.push(`   - Aim for airport by ${latestEnd}`);
    lines.push('');
  }
  
  return {
    dayNumber,
    date: formatDateFromStart(tripContext.startDate, dayNumber - 1),
    isFirstDay: false,
    isLastDay: true,
    earliestStartTime: earliestStart,
    latestEndTime: latestEnd,
    requiredSequence,
    maxActivities,
    minDowntimeMinutes: minDowntime,
    energyLevel,
    activityTypes,
    constraints: lines.join('\n')
  };
}

/**
 * Build regular day constraints (not first or last)
 */
export function buildRegularDayPrompt(
  dna: TravelerDNA,
  tripContext: TripContext,
  dayNumber: number,
  hotel: HotelData
): DayConstraints {
  const { maxActivities, minDowntime, reasoning: densityReasoning } = calculateActivityDensity(
    dna, false, false, undefined, undefined
  );
  const energyLevel = determineEnergyLevel(dna, false, false);
  const activityTypes = suggestActivityTypes(dna, energyLevel, false);
  
  // Start time based on DNA
  let earliestStart = '09:00';
  if (dna.sleepSchedule === 'early_bird') earliestStart = '07:30';
  if (dna.sleepSchedule === 'night_owl') earliestStart = '10:30';
  if (dna.sleepSchedule === 'needs_rest') earliestStart = '09:30';
  
  // End time based on DNA
  let latestEnd = '22:30';
  if (dna.sleepSchedule === 'early_bird') latestEnd = '21:00';
  if (dna.sleepSchedule === 'night_owl') latestEnd = '23:30';
  if (dna.traits.pace <= -5) latestEnd = '21:30';
  
  // Import meal policy for dynamic meal requirements
  // Note: meal policy is injected from the caller; this prompt builds the structure
  // The caller (index.ts) now handles meal policy derivation and injects the correct
  // meal requirements block. This function provides the structural template.
  
  const lines: string[] = [];
  lines.push(`${'='.repeat(60)}`);
  lines.push(`📅 DAY ${dayNumber} - EXPLORATION DAY (HOUR-BY-HOUR)`);
  lines.push(`${'='.repeat(60)}`);
  lines.push('');
  
  lines.push(`⏰ TIMING`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`   Day starts: ${earliestStart} (based on ${dna.sleepSchedule || 'balanced'} schedule)`);
  lines.push(`   Day ends: ${latestEnd} (including nightlife/evening activity)`);
  lines.push('');

  // =========================================================================
  // DAY STRUCTURE — HOUR-BY-HOUR TRAVEL PLAN (NOT just a list of activities)
  // Note: Meal requirements are now dynamic per day - injected by index.ts
  // =========================================================================
  lines.push(`🗓️ REQUIRED DAY STRUCTURE`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`   This is NOT a suggestion list. It is a COMPLETE hour-by-hour travel plan.`);
  lines.push(`   Every hour from ${earliestStart} to ${latestEnd} must be accounted for.`);
  lines.push('');
  
  lines.push(`   STRUCTURE ELEMENTS (include as applicable per meal policy):`);
  lines.push(`   ┌──────────────────────────────────────────────────────────────┐`);
  lines.push(`   │ 🍳 BREAKFAST — If required by meal policy                     │`);
  lines.push(`   │ 🚶 TRANSIT — Mode, duration, cost between EVERY pair of stops  │`);
  lines.push(`   │ 🎯 MORNING ACTIVITY — Paid attraction/museum/tour              │`);
  lines.push(`   │ 🌿 FREE ACTIVITY — Park, walk, viewpoint                       │`);
  lines.push(`   │ 🍽️ LUNCH — If required by meal policy                          │`);
  lines.push(`   │ 🎯 AFTERNOON ACTIVITY — Paid attraction/experience             │`);
  lines.push(`   │ 🏨 HOTEL RETURN — Freshen up before dinner (if appropriate)     │`);
  lines.push(`   │ 🍷 DINNER — If required by meal policy                          │`);
  lines.push(`   │ 🌙 EVENING/NIGHTLIFE — Bar, jazz club, night market, show      │`);
  lines.push(`   │ 🏨 RETURN TO HOTEL                                               │`);
  lines.push(`   │ 🌅 NEXT MORNING PREVIEW — "Tomorrow: wake at X, breakfast at Y"│`);
  lines.push(`   └──────────────────────────────────────────────────────────────┘`);
  lines.push('');

  lines.push(`   MEAL DETAILS (for each required meal):`);
  lines.push(`   - Each meal = real restaurant/café name + walk time/distance + approximate price`);
  lines.push(`   - MUST BE DIFFERENT from any previous day's same-type meal`);
  lines.push(`   - Lunch and dinner: include 1 alternative option in tips field`);
  lines.push(`   - Only include meals specified by the day's meal policy — do NOT add extras`);
  lines.push('');

  lines.push(`   TRANSIT REQUIREMENTS (between EVERY consecutive activity):`);
  lines.push(`   - Include as category: "transport" activities between stops`);
  lines.push(`   - Mode: walk, taxi, metro/tube/subway, bus, tram, rideshare`);
  lines.push(`   - Duration: realistic travel time (not just distance)`);
  lines.push(`   - Cost: fare/price for paid transit (walking = free)`);
  lines.push(`   - In the description, include WHICH line/route for public transit`);
  lines.push(`   - Short walks (under 5 min) can be noted in the tips of the previous activity`);
  lines.push(`     instead of a separate transport entry, but 10+ min walks MUST be explicit`);
  lines.push('');

  lines.push(`   ACTIVITY MIX REQUIREMENTS:`);
  lines.push(`   - Minimum 3 PAID activities (museums, tours, attractions, experiences)`);
  lines.push(`   - Minimum 2 FREE activities (parks, viewpoints, neighborhood walks, markets, street art)`);
  lines.push(`   - Free activities placed BETWEEN paid ones to break up the day`);
  lines.push(`   - At least 1 coffee/snack stop for long gaps (note in tips or as separate entry)`);
  lines.push('');

  lines.push(`   EVENING/NIGHTLIFE (mandatory — not every day ends at dinner):`);
  lines.push(`   - After dinner, include at least 1 evening suggestion:`);
  lines.push(`     Jazz clubs, rooftop bars, night markets, shows, river cruises,`);
  lines.push(`     neighborhood walks at night, dessert spots, live music`);
  lines.push(`   - Can be optional/skippable — note "optional" in description if so`);
  lines.push('');

  lines.push(`   HOTEL BOOKENDS:`);
  if (hotel.hasHotel) {
    lines.push(`   - Start day near hotel (breakfast within walking distance)`);
    lines.push(`   - If dinner location is far, include "Return to hotel to freshen up" activity`);
    lines.push(`   - End day with "Return to hotel" noting transport mode + time`);
    if (hotel.hotelName) {
      lines.push(`   - Hotel: ${hotel.hotelName}`);
    }
    if (hotel.hotelNeighborhood) {
      lines.push(`   - Neighborhood: ${hotel.hotelNeighborhood}`);
    }
  } else {
    lines.push(`   - Start day with breakfast in a central/convenient area`);
    lines.push(`   - Include evening return transport`);
  }
  lines.push('');

  lines.push(`   PRACTICAL TIPS (inline on activities):`);
  lines.push(`   - "Book tickets online in advance to skip queue"`);
  lines.push(`   - "Closed on Mondays" / "Free entry first Sunday of month"`);
  lines.push(`   - "Queue shorter before 10am" / "Go at sunset for best photos"`);
  lines.push(`   - "Smart casual dress code" / "No shorts allowed"`);
  lines.push(`   - These go in the "tips" field of each activity`);
  lines.push('');

  lines.push(`   NEXT MORNING PREVIEW:`);
  lines.push(`   - The LAST activity of the day should include in its tips field:`);
  lines.push(`     "Tomorrow: Wake up [time]. Breakfast at [restaurant] ([walk time] from hotel, ~[price])."`);
  lines.push('');

  lines.push(`   COSTS — DO NOT ESTIMATE PRICES:`);
  lines.push(`   - Do NOT include cost estimates, price guesses, or estimatedCost fields`);
  lines.push(`   - Costs are assigned separately from our verified pricing database`);
  lines.push(`   - Focus on activity selection, timing, and descriptions only`);
  lines.push(`   - If an activity is FREE, you may mention "free entry" in the description`);
  lines.push('');

  lines.push(`⚡ ACTIVITY DENSITY`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`   Max EXPERIENCE activities: ${maxActivities} (museums, tours, attractions, cultural sites)`);
  lines.push(`   ⚠️ IMPORTANT: Required meals, transit, coffee stops, nightlife, and hotel bookends are MANDATORY ADDITIONS`);
  lines.push(`   on top of the experience count. Total entries depend on the day's meal policy:`);
  lines.push(`     - ${maxActivities} experience activities (paid + free mix)`);
  lines.push(`     - Required meals as specified by meal policy`);
  lines.push(`     - 4-6 transit entries between stops`);
  lines.push(`     - 1 nightlife/evening entry`);
  lines.push(`     - 1-2 hotel bookend entries (return to freshen up, end of day)`);
  lines.push(`   Min downtime: ${minDowntime} minutes between major activities`);
  lines.push(`   Energy level: ${energyLevel.toUpperCase()}`);
  lines.push(`   (${densityReasoning})`);
  lines.push('');
  
  // DNA-specific guidance
  if (dna.sleepSchedule === 'needs_rest') {
    lines.push(`😴 SIESTA REQUIRED`);
    lines.push(`   Include 2+ hour rest block (2:00-4:00 PM)`);
    lines.push(`   Label as "Rest & Recharge at Hotel" with category "relaxation"`);
    lines.push('');
  }
  
  if (dna.traits.authenticity >= 5) {
    lines.push(`🎯 LOCAL-FOCUSED DAY`);
    lines.push(`   Prioritize off-guidebook spots`);
    lines.push(`   Avoid obvious tourist areas`);
    lines.push('');
  }

  if (dna.traits.pace <= -5) {
    lines.push(`🧘 RELAXED PACE`);
    lines.push(`   Fewer activities but more depth per stop`);
    lines.push(`   Longer café sits, unstructured wandering blocks`);
    lines.push(`   Replace 1 paid activity with extended free time`);
    lines.push('');
  }

  if (dna.traits.pace >= 5) {
    lines.push(`⚡ PACKED PACE`);
    lines.push(`   Maximize activities — add extra sightseeing in gaps`);
    lines.push(`   Shorter meals, tighter transit windows`);
    lines.push(`   Include additional paid experiences beyond the minimum`);
    lines.push('');
  }
  
  return {
    dayNumber,
    date: formatDateFromStart(tripContext.startDate, dayNumber - 1),
    isFirstDay: false,
    isLastDay: false,
    earliestStartTime: earliestStart,
    latestEndTime: latestEnd,
    requiredSequence: [],
    maxActivities,
    minDowntimeMinutes: minDowntime,
    energyLevel,
    activityTypes,
    constraints: lines.join('\n')
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function minutesToHHMM(totalMins: number): string {
  const mins = ((totalMins % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDateFromStart(startDate: string, dayOffset: number): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + dayOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Build the complete prompt for a specific day
 * This is the main entry point that orchestrates all the pieces
 */
export function buildDayPrompt(
  flight: FlightData,
  hotel: HotelData,
  dna: TravelerDNA,
  tripContext: TripContext,
  dayNumber: number,
  options?: { isLastDayInCity?: boolean; nextLegTransport?: string; nextLegCity?: string; nextLegTransportDetails?: Record<string, any> }
): { personaPrompt: string; dayConstraints: DayConstraints } {
  const isFirstDay = dayNumber === 1;
  const isLastDay = dayNumber === tripContext.totalDays;
  
  // ─── Cross-day flight detection ───
  const isDepartureTravelDay = isFirstDay
    && flight.hasOutboundFlight
    && flight.arrivalDate
    && flight.departureDate
    && flight.arrivalDate > flight.departureDate;
  
  // Build the full persona manuscript (same for all days)
  const personaPrompt = buildPersonaManuscript(dna, tripContext);
  
  // Build day-specific constraints
  let dayConstraints: DayConstraints;
  
  // ─── Mid-trip city departure (non-flight): generate station-based departure ───
  const isMidTripCityDeparture = options?.isLastDayInCity && !isLastDay;
  const isNonFlightCityDeparture = isMidTripCityDeparture && options?.nextLegTransport && options.nextLegTransport !== 'flight';
  
  if (isDepartureTravelDay) {
    dayConstraints = buildOutboundTravelDayPrompt(flight, hotel, dna, tripContext);
  } else if (isFirstDay) {
    dayConstraints = buildArrivalDayPrompt(flight, hotel, dna, tripContext);
  } else if (isNonFlightCityDeparture) {
    // Non-flight departure from a mid-trip city — do NOT use flight departure prompt
    // Return a regular day prompt; the actual departure constraints come from the
    // multi-city overlay or the generate-day handler's non-flight departure block
    dayConstraints = buildRegularDayPrompt(dna, tripContext, dayNumber, hotel);
  } else if (isLastDay) {
    dayConstraints = buildDepartureDayPrompt(flight, hotel, dna, tripContext, dayNumber);
  } else {
    dayConstraints = buildRegularDayPrompt(dna, tripContext, dayNumber, hotel);
  }
  
  return { personaPrompt, dayConstraints };
}

/**
 * Build constraints for a DEPARTURE TRAVEL DAY (Day 1 when flight arrives next day).
 * The traveler departs from their home city — no destination activities.
 * Activities: morning prep, travel to airport, boarding, in-flight rest.
 */
export function buildOutboundTravelDayPrompt(
  flight: FlightData,
  hotel: HotelData,
  dna: TravelerDNA,
  tripContext: TripContext
): DayConstraints {
  const lines: string[] = [];
  lines.push(`${'='.repeat(60)}`);
  lines.push(`✈️ DAY 1 — DEPARTURE / TRAVEL DAY (NOT AT DESTINATION YET)`);
  lines.push(`${'='.repeat(60)}`);
  lines.push('');
  lines.push(`⚠️ CRITICAL: The traveler is NOT in ${tripContext.destination} today.`);
  lines.push(`They depart from their home city and will arrive at the destination TOMORROW.`);
  lines.push('');
  
  if (flight.departureTime24) {
    lines.push(`✈️ OUTBOUND FLIGHT DEPARTS: ${flight.departureTime24}`);
  }
  if (flight.departureAirport) {
    lines.push(`   From: ${flight.departureAirport}`);
  }
  if (flight.arrivalDate) {
    lines.push(`   Arrives at destination: ${flight.arrivalDate}`);
  }
  lines.push('');
  
  lines.push(`📋 MANDATORY STRUCTURE FOR THIS DAY:`);
  lines.push(`   1. Morning: Pack, prepare for trip, finalize travel essentials`);
  lines.push(`   2. Travel to airport (allow 2+ hours before departure)`);
  lines.push(`   3. Airport check-in, security, boarding`);
  lines.push(`   4. In-flight (rest, entertainment, meals on board)`);
  lines.push('');
  lines.push(`🚫 DO NOT generate activities at ${tripContext.destination}.`);
  lines.push(`🚫 DO NOT schedule sightseeing, restaurants, or tours.`);
  lines.push(`🚫 ALL activities must be at the DEPARTURE city, NOT the destination.`);
  lines.push('');
  lines.push(`Use the traveler's home/departure city for all location references.`);
  lines.push(`Category for activities: "transit", "preparation"`);
  
  return {
    dayNumber: 1,
    date: tripContext.startDate,
    isFirstDay: true,
    isLastDay: false,
    earliestStartTime: '08:00',
    latestEndTime: '23:59',
    requiredSequence: ['pack_and_prepare', 'travel_to_airport', 'airport_checkin', 'board_flight', 'in_flight'],
    maxActivities: 6,
    minDowntimeMinutes: 0,
    energyLevel: 'moderate',
    activityTypes: ['transit', 'preparation'],
    constraints: lines.join('\n'),
  };
}

/**
 * Extract flight data from trip database record
 */
export function extractFlightData(rawFlightSelection: unknown): FlightData {
  if (!rawFlightSelection || typeof rawFlightSelection !== 'object') {
    return { hasOutboundFlight: false, hasReturnFlight: false };
  }
  
  const flightSelection = rawFlightSelection as Record<string, unknown>;
  const result: FlightData = { hasOutboundFlight: false, hasReturnFlight: false };
  
  // Handle multiple payload structures
  const nestedDeparture = flightSelection.departure as Record<string, unknown> | undefined;
  const nestedReturn = flightSelection.return as Record<string, unknown> | undefined;
  const legs = Array.isArray(flightSelection.legs) ? flightSelection.legs as Array<Record<string, unknown>> : [];
  
  // ─── Legs-based extraction (preferred) ───
  // Find destination arrival leg (user-marked or heuristic)
  const destArrivalLeg = legs.find((l: any) => l.isDestinationArrival)
    || (legs.length === 2 ? legs[0] : legs.length >= 3 ? legs[legs.length - 2] : legs[0]);
  // Find destination departure leg (user-marked or last leg)
  const destDepartureLeg = legs.find((l: any) => l.isDestinationDeparture)
    || (legs.length >= 2 ? legs[legs.length - 1] : undefined);
  
  // Outbound arrival time — prefer legs, fallback to legacy
  const legArrivalTime = (destArrivalLeg?.arrival as Record<string, unknown>)?.time as string | undefined;
  const manualArrival = (nestedDeparture?.arrival as Record<string, unknown>)?.time as string | undefined;
  const searchArrival = nestedDeparture?.arrivalTime as string | undefined;
  const flatArrival = flightSelection.arrivalTime as string | undefined;
  const arrivalTime = legArrivalTime || manualArrival || searchArrival || flatArrival;
  
  if (arrivalTime) {
    result.hasOutboundFlight = true;
    result.arrivalTime24 = normalizeTo24h(arrivalTime);
    if (result.arrivalTime24) {
      result.arrivalTimeMins = parseTimeToMins(result.arrivalTime24);
    }
  }
  
  // ─── Extract arrival DATE (new: for cross-day flight detection) ───
  // Priority: legs[].arrival.date > departure.arrival.date > parse from ISO datetime
  const legArrivalDate = (destArrivalLeg?.arrival as Record<string, unknown>)?.date as string | undefined;
  const nestedArrivalDate = (nestedDeparture?.arrival as Record<string, unknown>)?.date as string | undefined;
  const rawArrivalDate = legArrivalDate || nestedArrivalDate;
  if (rawArrivalDate && /^\d{4}-\d{2}-\d{2}/.test(rawArrivalDate)) {
    result.arrivalDate = rawArrivalDate.substring(0, 10); // normalize to YYYY-MM-DD
  }
  
  // ─── Extract departure DATE for outbound flight ───
  const legDepartureDate = (destArrivalLeg?.departure as Record<string, unknown>)?.date as string | undefined;
  const nestedDepartureDate = (nestedDeparture?.departure as Record<string, unknown>)?.date as string | undefined;
  const rawDepartureDate = legDepartureDate || nestedDepartureDate;
  if (rawDepartureDate && /^\d{4}-\d{2}-\d{2}/.test(rawDepartureDate)) {
    result.departureDate = rawDepartureDate.substring(0, 10);
  }
  
  // Return departure time — prefer legs, fallback to legacy
  const legReturnDepTime = (destDepartureLeg?.departure as Record<string, unknown>)?.time as string | undefined;
  const manualReturnDep = (nestedReturn?.departure as Record<string, unknown>)?.time as string | undefined;
  const searchReturnDep = nestedReturn?.departureTime as string | undefined;
  const flatReturnDep = flightSelection.returnDepartureTime as string | undefined;
  const departureTime = legReturnDepTime || manualReturnDep || searchReturnDep || flatReturnDep;
  
  if (departureTime) {
    result.hasReturnFlight = true;
    result.departureTime24 = normalizeTo24h(departureTime);
    if (result.departureTime24) {
      result.departureTimeMins = parseTimeToMins(result.departureTime24);
    }
  }
  
  // Airport codes — prefer legs, fallback to flat fields
  result.departureAirport = (destArrivalLeg?.departure as Record<string, unknown>)?.airport as string
    || flightSelection.departureAirport as string | undefined;
  result.arrivalAirport = (destArrivalLeg?.arrival as Record<string, unknown>)?.airport as string
    || flightSelection.arrivalAirport as string | undefined;
  
  return result;
}

/**
 * Extract hotel data from trip database record
 */
export function extractHotelData(hotelSelection: unknown): HotelData {
  if (!hotelSelection) {
    return { hasHotel: false };
  }
  
  // Handle array format (new) or object format (legacy)
  let hotel: Record<string, unknown> | null = null;
  
  if (Array.isArray(hotelSelection) && hotelSelection.length > 0) {
    hotel = hotelSelection[0] as Record<string, unknown>;
  } else if (typeof hotelSelection === 'object') {
    hotel = hotelSelection as Record<string, unknown>;
  }
  
  if (!hotel) {
    return { hasHotel: false };
  }
  
  return {
    hasHotel: true,
    hotelName: (hotel.name || hotel.hotel_name) as string | undefined,
    hotelAddress: hotel.address as string | undefined,
    hotelNeighborhood: hotel.neighborhood as string | undefined,
    checkInTime: hotel.check_in_time as string | undefined,
    checkOutTime: hotel.check_out_time as string | undefined,
  };
}

/**
 * Build TravelerDNA from multiple database sources
 * 
 * CRITICAL: Checks ALL archetype sources in priority order:
 * 1. Canonical columns (primary_archetype_name) - highest priority
 * 2. profiles.travel_dna blob (primary_archetype_name inside JSON)
 * 3. v2 archetype_matches array
 * 4. v1 archetype_matches array - legacy fallback
 */
export function buildTravelerDNA(
  dnaProfile: Record<string, unknown> | null,
  preferences: Record<string, unknown> | null,
  overrides: Record<string, number> | null
): TravelerDNA {
  // Extract nested structures
  const v2Data = dnaProfile?.travel_dna_v2 as Record<string, unknown> | undefined;
  const profileTravelDna = dnaProfile?.travel_dna as Record<string, unknown> | undefined;
  const archetypeMatchesV2 = v2Data?.archetype_matches as Array<{ name: string; pct: number }> | undefined;
  const archetypeMatchesV1 = dnaProfile?.archetype_matches as Array<{ name: string; pct: number }> | undefined;
  
  // ==========================================================================
  // ARCHETYPE EXTRACTION - Check ALL sources in priority order
  // This ensures users who update their quiz get their new archetype used
  // ==========================================================================
  let primaryArchetype: string | undefined;
  let secondaryArchetype: string | undefined;
  let archetypeConfidence: number | undefined;
  let archetypeSource = 'none';
  
  // Priority 1: Canonical columns on dnaProfile (from travel_dna_profiles table)
  if (dnaProfile?.primary_archetype_name && typeof dnaProfile.primary_archetype_name === 'string') {
    primaryArchetype = dnaProfile.primary_archetype_name as string;
    secondaryArchetype = dnaProfile.secondary_archetype_name as string | undefined;
    archetypeConfidence = dnaProfile.confidence as number | undefined;
    archetypeSource = 'canonical_columns';
  }
  // Priority 2: profiles.travel_dna blob (stores primary_archetype_name inside JSON)
  else if (profileTravelDna?.primary_archetype_name && typeof profileTravelDna.primary_archetype_name === 'string') {
    primaryArchetype = profileTravelDna.primary_archetype_name as string;
    secondaryArchetype = profileTravelDna.secondary_archetype_name as string | undefined;
    archetypeConfidence = profileTravelDna.dna_confidence_score as number | undefined;
    archetypeSource = 'profiles_travel_dna_blob';
  }
  // Priority 3: v2 archetype_matches array
  else if (archetypeMatchesV2 && archetypeMatchesV2.length > 0) {
    primaryArchetype = archetypeMatchesV2[0]?.name;
    secondaryArchetype = archetypeMatchesV2[1]?.name;
    archetypeConfidence = v2Data?.confidence as number | undefined;
    archetypeSource = 'v2_archetype_matches';
  }
  // Priority 4: v1 archetype_matches array
  else if (archetypeMatchesV1 && archetypeMatchesV1.length > 0) {
    primaryArchetype = archetypeMatchesV1[0]?.name;
    secondaryArchetype = archetypeMatchesV1[1]?.name;
    archetypeSource = 'v1_archetype_matches';
  }
  
  console.log(`[buildTravelerDNA] Archetype source: ${archetypeSource}, primary: ${primaryArchetype || 'none'}, secondary: ${secondaryArchetype || 'none'}`);
  
  // ==========================================================================
  // TRAIT EXTRACTION - Also check multiple sources
  // ==========================================================================
  let traitScores = dnaProfile?.trait_scores as Record<string, number> | undefined;
  
  // If not at top level, check inside v2 or profiles.travel_dna
  if (!traitScores || Object.keys(traitScores).length === 0) {
    traitScores = v2Data?.trait_scores as Record<string, number> | undefined;
  }
  if (!traitScores || Object.keys(traitScores).length === 0) {
    traitScores = profileTravelDna?.trait_scores as Record<string, number> | undefined;
  }
  
  // Default traits
  const defaultTraits = {
    pace: 0,
    social: 0,
    adventure: 0,
    authenticity: 0,
    comfort: 0,
    planning: 0,
    transformation: 0,
    budget: 0
  };
  
  // Blend traits with overrides
  const traits = { ...defaultTraits };
  if (traitScores) {
    for (const [key, value] of Object.entries(traitScores)) {
      if (key in traits && typeof value === 'number') {
        traits[key as keyof typeof traits] = value;
      }
    }
  }
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (key in traits && typeof value === 'number') {
        // Blend: 70% base + 30% override
        const base = traits[key as keyof typeof traits];
        traits[key as keyof typeof traits] = Math.round((base * 0.7 + value * 0.3) * 10) / 10;
      }
    }
  }
  
  console.log(`[buildTravelerDNA] Traits: pace=${traits.pace}, comfort=${traits.comfort}, adventure=${traits.adventure}, budget=${traits.budget}`);
  
  // Extract additional preferences from multiple sources
  const emotionalDrivers = (
    (preferences?.emotional_drivers as string[]) ||
    (v2Data?.emotional_drivers as string[]) ||
    (profileTravelDna?.emotional_drivers as string[]) ||
    []
  ).filter(Boolean);
  
  const interests = (
    (preferences?.interests as string[]) ||
    (v2Data?.interests as string[]) ||
    []
  ).filter(Boolean);
  
  const travelVibes = (
    (preferences?.travel_vibes as string[]) ||
    (v2Data?.travel_vibes as string[]) ||
    (profileTravelDna?.tone_tags as string[]) ||
    []
  ).filter(Boolean);
  
  return {
    primaryArchetype,
    secondaryArchetype,
    archetypeConfidence,
    traits,
    sleepSchedule: (preferences?.sleep_schedule || v2Data?.sleep_schedule) as TravelerDNA['sleepSchedule'],
    energyPeak: (preferences?.daytime_bias || v2Data?.energy_peak) as TravelerDNA['energyPeak'],
    jetLagSensitivity: (preferences?.jet_lag_sensitivity || 'moderate') as TravelerDNA['jetLagSensitivity'],
    dietaryRestrictions: ((preferences?.dietary_restrictions || []) as string[]).filter(Boolean),
    mobilityLevel: (preferences?.mobility_level || 'full') as TravelerDNA['mobilityLevel'],
    accessibilityNeeds: ((preferences?.accessibility_needs || []) as string[]).filter(Boolean),
    foodLikes: ((preferences?.food_likes || []) as string[]).filter(Boolean),
    foodDislikes: ((preferences?.food_dislikes || []) as string[]).filter(Boolean),
    interests,
    emotionalDrivers,
    travelVibes,
    companions: (Array.isArray(preferences?.travel_companions) ? preferences.travel_companions[0] : preferences?.companion_type) as TravelerDNA['companions'],
    childrenCount: preferences?.children_count as number | undefined,
    // NEW: Wire collected preferences into generation (Phase 16)
    dailyBudgetTier: (preferences?.daily_budget_tier || preferences?.budget_tier) as TravelerDNA['dailyBudgetTier'],
    accommodationStyle: (preferences?.accommodation_style || preferences?.hotel_style) as string | undefined,
    recoveryStyle: ((preferences?.recovery_style || []) as string[]).filter(Boolean),
    activeHoursPerDay: (preferences?.active_hours_per_day) as TravelerDNA['activeHoursPerDay'],
    recommendationStyle: (preferences?.recommendation_style) as TravelerDNA['recommendationStyle'],
    aiAssistanceLevel: (preferences?.ai_assistance_level) as TravelerDNA['aiAssistanceLevel'],
  };
}

// Time parsing helpers
function normalizeTo24h(timeStr: string): string | undefined {
  if (!timeStr) return undefined;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return undefined;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function parseTimeToMins(timeHHMM: string): number | undefined {
  const match = timeHHMM.match(/(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

// =============================================================================
// TRANSITION DAY PROMPT BUILDER
// =============================================================================

export interface TransitionDayParams {
  transitionFrom: string;
  transitionFromCountry?: string;
  transitionTo: string;
  transitionToCountry?: string;
  transportType?: string; // user-selected or default
  travelers: number;
  budgetTier?: string;
  primaryArchetype?: string;
  currency?: string;
  /** User-entered transport details (times, carrier, duration, stations) */
  transportDetails?: {
    carrier?: string;
    departureTime?: string;
    arrivalTime?: string;
    duration?: string;
    departureStation?: string;
    arrivalStation?: string;
    departureAirport?: string;
    arrivalAirport?: string;
    costPerPerson?: number;
    totalCost?: number;
    bookingRef?: string;
    seatClass?: string;
  };
}

/**
 * Build a mandatory structured prompt for inter-city transition days.
 * Forces a strict day structure: checkout → transfer → travel → arrival → check-in → evening.
 * Also instructs the AI to return a transportComparison array with 3+ options.
 */
export function buildTransitionDayPrompt(params: TransitionDayParams): string {
  const {
    transitionFrom, transitionFromCountry,
    transitionTo, transitionToCountry,
    transportType, travelers, budgetTier,
    primaryArchetype, currency,
  } = params;

  const td = params.transportDetails;
  const fromLabel = transitionFromCountry ? `${transitionFrom}, ${transitionFromCountry}` : transitionFrom;
  const toLabel = transitionToCountry ? `${transitionTo}, ${transitionToCountry}` : transitionTo;
  const isSameCountry = transitionFromCountry && transitionToCountry && transitionFromCountry === transitionToCountry;

  // Check if cities are in the same metro area (flights would be absurd)
  const SAME_METRO_PAIRS: Record<string, string[]> = {
    'new york': ['east rutherford', 'newark', 'jersey city', 'hoboken', 'brooklyn', 'queens', 'bronx', 'staten island', 'long island city', 'white plains', 'yonkers', 'fort lee', 'weehawken', 'secaucus', 'new york city', 'manhattan'],
    'san francisco': ['oakland', 'berkeley', 'san jose', 'palo alto', 'daly city', 'fremont', 'redwood city', 'mountain view', 'sunnyvale'],
    'los angeles': ['santa monica', 'pasadena', 'long beach', 'burbank', 'anaheim', 'hollywood', 'glendale', 'beverly hills', 'west hollywood'],
    'london': ['windsor', 'croydon', 'greenwich', 'richmond', 'watford', 'kingston'],
    'paris': ['versailles', 'saint-denis', 'la defense', 'boulogne'],
    'tokyo': ['yokohama', 'kawasaki', 'chiba', 'saitama'],
    'chicago': ['evanston', 'oak park', 'naperville', 'aurora'],
    'washington': ['arlington', 'alexandria', 'bethesda', 'silver spring', 'georgetown'],
    'boston': ['cambridge', 'somerville', 'brookline', 'quincy'],
    'dallas': ['fort worth', 'arlington', 'plano', 'irving'],
  };

  const originLower = (transitionFrom || '').toLowerCase().trim();
  const destLower = (transitionTo || '').toLowerCase().trim();
  let tooCloseForFlight = false;

  for (const [metro, suburbs] of Object.entries(SAME_METRO_PAIRS)) {
    const allInMetro = [metro, ...suburbs];
    const originInMetro = allInMetro.some(place => originLower.includes(place) || place.includes(originLower));
    const destInMetro = allInMetro.some(place => destLower.includes(place) || place.includes(destLower));
    if (originInMetro && destInMetro) {
      tooCloseForFlight = true;
      break;
    }
  }

  const defaultMode = tooCloseForFlight ? 'rideshare' : (transportType || (isSameCountry ? 'train' : 'flight'));

  // Build confirmed booking schedule block if we have real times
  let confirmedScheduleBlock = '';
  if (td && (td.departureTime || td.arrivalTime)) {
    const parts: string[] = [];
    parts.push(`\n${'='.repeat(70)}`);
    parts.push(`📋 CONFIRMED TRANSPORT SCHEDULE — USE THESE EXACT TIMES`);
    parts.push(`${'='.repeat(70)}`);
    parts.push(`The traveler has ALREADY booked their inter-city transport. Use these exact details:`);
    if (td.carrier) parts.push(`  Operator/Carrier: ${td.carrier}`);
    if (td.departureTime) {
      const depStation = td.departureStation || td.departureAirport || `${transitionFrom} station`;
      parts.push(`  Departure: ${td.departureTime} from ${depStation}`);
    }
    if (td.arrivalTime) {
      const arrStation = td.arrivalStation || td.arrivalAirport || `${transitionTo} station`;
      parts.push(`  Arrival: ${td.arrivalTime} at ${arrStation}`);
    }
    if (td.duration) parts.push(`  Journey Duration: ${td.duration}`);
    if (td.seatClass) parts.push(`  Class: ${td.seatClass}`);
    if (td.bookingRef) parts.push(`  Booking Ref: ${td.bookingRef}`);
    if (td.costPerPerson) parts.push(`  Cost: ${td.costPerPerson} per person`);
    parts.push('');
    parts.push(`CRITICAL: The inter-city travel activity MUST use startTime="${td.departureTime || ''}" and endTime="${td.arrivalTime || ''}".`);
    parts.push(`Schedule the "Transfer to station" activity to END at or before the departure time.`);
    parts.push(`Schedule "Transfer to hotel" and check-in AFTER the arrival time.`);
    parts.push(`DO NOT invent different departure/arrival times. The traveler has a confirmed booking.`);
    confirmedScheduleBlock = parts.join('\n');
  }

  // Archetype-aware recommendation guidance
  let recommendationGuidance = '';
  const arch = (primaryArchetype || '').toLowerCase();
  if (arch.includes('luxury') || arch.includes('comfort')) {
    recommendationGuidance = 'Recommend the MOST COMFORTABLE option: city-center-to-city-center, premium seating, minimal transfers. Comfort > cost.';
  } else if (arch.includes('budget') || arch.includes('backpack') || arch.includes('value')) {
    recommendationGuidance = 'Recommend the CHEAPEST total door-to-door option. Include all hidden costs (baggage fees, airport transfers, parking). Cost > comfort.';
  } else if (arch.includes('adventure') || arch.includes('explorer')) {
    recommendationGuidance = 'Recommend the option with the BEST SCENIC/EXPERIENCE value. Highlight stopover opportunities, scenic routes, and unique experiences en route.';
  } else {
    recommendationGuidance = 'Recommend the best BALANCED option considering door-to-door time, total cost, and comfort.';
  }

  return `
${confirmedScheduleBlock}

${'='.repeat(70)}
🚆 MANDATORY TRANSITION DAY: ${fromLabel} → ${toLabel}
${'='.repeat(70)}

This is a TRAVEL DAY. The traveler is moving between cities. NO TELEPORTING.
You MUST generate activities following this EXACT mandatory structure:

1. MORNING — Hotel Checkout in ${transitionFrom}
   - Category: "accommodation"
   - Title: "Hotel Checkout – ${transitionFrom}"
   - Time: 08:00–09:00 (adjust if flight/train requires earlier)
   - Cost: { amount: 0, currency: "USD" }
   - bookingRequired: false

2. TRANSFER to departure point
   - Category: "transport"
   - Title: "Transfer to [Station/Airport Name]"
   - Include realistic transfer time, method, and cost
   - The departure point MUST be a real station/airport in ${transitionFrom}

3. INTER-CITY TRAVEL: ${transitionFrom} → ${transitionTo}
   - Category: "transport"
   - Title: "[Mode] – ${transitionFrom} to ${transitionTo}"
   - Use transport mode: "${defaultMode}" (or the AI recommended mode)
   - Include realistic duration, operator name, departure/arrival points
   - Cost MUST reflect real-world pricing for ${travelers} traveler(s)

4. TRANSFER from arrival point to hotel in ${transitionTo}
   - Category: "transport"
   - Title: "Transfer to Hotel – ${transitionTo}"
   - Include realistic transfer time from arrival station/airport to city center

5. HOTEL CHECK-IN in ${transitionTo}
   - Category: "accommodation"
   - Title: "Hotel Check-in – ${transitionTo}"
   - Time: Calculated from arrival + transfer duration
   - Cost: { amount: 0, currency: "USD" }
   - bookingRequired: false

6. EVENING — Light exploration + dinner near hotel in ${transitionTo}
   - 1-2 low-key activities: neighborhood walk, local restaurant, sunset viewpoint
   - All activities MUST be in ${transitionTo}
   - Keep it light — the traveler just traveled

${'='.repeat(70)}
🔄 TRANSPORT COMPARISON MODULE — REQUIRED
${'='.repeat(70)}

You MUST also return a "transportComparison" array with AT LEAST 3 viable transport options
for getting from ${transitionFrom} to ${transitionTo}.

For EACH option, provide:
- id: unique string (e.g., "train_fast", "flight_budget", "bus_economy")
- mode: "train" | "flight" | "bus" | "car" | "ferry"
- operator: Real operator name (e.g., "Eurostar", "EasyJet", "FlixBus")
- inTransitDuration: Just the travel time (e.g., "2h 15m")
- doorToDoorDuration: TOTAL time including transfers, check-in, security, boarding (e.g., "4h 30m")
- cost: { perPerson: number, total: number (for ${travelers} travelers), currency: "${currency || 'USD'}", includesTransfers: boolean }
  - INCLUDE ALL hidden costs: baggage fees, airport transfers, parking, tolls, fuel
  - Total must be the REAL door-to-door expense, not just the ticket price
- departure: { point: "Real station/airport name", neighborhood: "Area of city it's in" }
- arrival: { point: "Real station/airport name", neighborhood: "Area of city it's in" }
- pros: string[] (2-4 genuine advantages)
- cons: string[] (2-3 genuine disadvantages)
- bookingTip: string (actionable tip, e.g., "Book 6+ weeks out for £39 fares on Eurostar")
- scenicOpportunities: string[] (what you'll see en route, stopover options)
- isRecommended: boolean (true for exactly ONE option)
- recommendationReason: string (1-2 sentences explaining why, referencing the traveler's profile)

RECOMMENDATION GUIDANCE: ${recommendationGuidance}

Also return: "selectedTransportId": string — set to the id of the recommended option.

${'='.repeat(70)}
⚠️ CRITICAL RULES FOR TRANSITION DAYS
${'='.repeat(70)}
- The inter-city travel activity is MANDATORY. Do NOT skip it.
- ALL costs must be realistic for the ${fromLabel} → ${toLabel} route.
- Door-to-door time MUST include getting to/from stations/airports. A 1h15m flight is 4-5h door-to-door.
- Evening activities MUST be in ${transitionTo}, NOT ${transitionFrom}.
- Do NOT include tourist attractions requiring extended visits. Keep evening activities casual.
- The transportComparison array is REQUIRED. Do not omit it.
- Activity count for transition days: exactly 6-8 activities (the 6 mandatory + 1-2 evening).
${tooCloseForFlight ? `
⚠️ CRITICAL: ${fromLabel} and ${toLabel} are in the SAME METROPOLITAN AREA.
NEVER suggest flights between them — there are no commercial flights for this distance.
Only suggest ground transport: rideshare, taxi, bus, train, or driving.
` : ''}

${'='.repeat(70)}
⏰ ARRIVAL-TIME SCHEDULING CONSTRAINT
${'='.repeat(70)}
The FIRST activity in ${transitionTo} CANNOT be scheduled before:
  arrival_time + transfer_to_hotel + check_in_buffer (30 min) + rest_buffer (30 min)

Example: If the train arrives at 15:00 + 45 min transfer + 30 min check-in + 30 min rest = earliest activity at 16:45.

If arriving AFTER 18:00:
- Only schedule a light dinner and/or neighborhood stroll — NOT a museum, tour, or attraction.
- The evening should feel relaxed, not rushed.

If arriving AFTER 21:00:
- Only suggest "Settle in and rest" or a very short walk to a nearby restaurant.
- No scheduled activities beyond dinner.

The NEXT DAY (Day ${transitionTo} Day 1) is a FULL day — schedule normally from 08:00-09:00 breakfast onward.
`;

}

// =============================================================================
// FLIGHT INTELLIGENCE PROMPT BUILDER
// =============================================================================

/**
 * Build a prompt section from flight intelligence data (layovers, availability windows, missing legs).
 * Returns empty string if no intelligence data is available (backward compatible).
 */
export function buildFlightIntelligencePrompt(intelligence: unknown): string {
  if (!intelligence || typeof intelligence !== 'object') {
    return '';
  }

  const intel = intelligence as Record<string, unknown>;
  const sections: string[] = [];

  // --- Route display ---
  const route = intel.route as Record<string, unknown> | undefined;
  if (route?.display) {
    sections.push(`${'='.repeat(60)}\n🛫 FLIGHT INTELLIGENCE — ROUTE\n${'='.repeat(60)}\nRoute: ${route.display}`);
  }

  // --- FLIGHT-AWARE SCHEDULING ---
  const schedule = intel.destinationSchedule as Array<Record<string, unknown>> | undefined;
  if (schedule && schedule.length > 0) {
    const scheduleLines: string[] = [];
    scheduleLines.push(`\n${'='.repeat(60)}\n⏰ FLIGHT-AWARE SCHEDULING\n${'='.repeat(60)}`);
    for (const dest of schedule) {
      scheduleLines.push(`\n📍 ${dest.city} (${dest.airport}):`);
      if (dest.availableFrom) {
        scheduleLines.push(`   - Available FROM: ${dest.availableFrom}`);
        scheduleLines.push(`   - Do NOT schedule activities before this time.`);
      }
      if (dest.availableUntil) {
        scheduleLines.push(`   - Available UNTIL: ${dest.availableUntil}`);
        scheduleLines.push(`   - Do NOT schedule activities after this time.`);
      }
      if (dest.fullDays) {
        scheduleLines.push(`   - Plan ${dest.fullDays} days of activities.`);
      }
      if (dest.isFirstDestination) {
        scheduleLines.push(`   - ⚡ FIRST DESTINATION — lighter schedule on arrival day (2-3 activities max, afternoon/evening only). The traveler just arrived and may be tired.`);
      }
      if (dest.isLastDestination && dest.availableUntil) {
        scheduleLines.push(`   - ⚡ LAST DESTINATION — final day activities MUST end by ${dest.availableUntil} for airport transit.`);
      }
      const notes = dest.notes as string[] | undefined;
      if (notes && notes.length > 0) {
        for (const note of notes) {
          scheduleLines.push(`   - Note: ${note}`);
        }
      }
    }
    sections.push(scheduleLines.join('\n'));
  }

  // --- LAYOVER EXCLUSIONS ---
  const layovers = intel.layovers as Array<Record<string, unknown>> | undefined;
  if (layovers && layovers.length > 0) {
    const layoverLines: string[] = [];
    layoverLines.push(`\n${'='.repeat(60)}\n🚫 LAYOVER EXCLUSIONS\n${'='.repeat(60)}`);
    for (const layover of layovers) {
      layoverLines.push(`Do NOT schedule any activities, meals, or sightseeing in ${layover.city} during the ${layover.duration} layover at ${layover.airport} (${layover.arrivalTime} → ${layover.departureTime}). The traveler will be in the airport.`);
    }
    sections.push(layoverLines.join('\n'));
  }

  // --- MISSING LEG HANDLING ---
  const missingLegs = intel.missingLegs as Array<Record<string, unknown>> | undefined;
  if (missingLegs && missingLegs.length > 0) {
    const missingLines: string[] = [];
    missingLines.push(`\n${'='.repeat(60)}\n⚠️ MISSING LEG HANDLING — CRITICAL\n${'='.repeat(60)}`);
    for (const leg of missingLegs) {
      missingLines.push(`The traveler still needs to book a flight from ${leg.fromCity} (${leg.from}) to ${leg.toCity} (${leg.to}).`);
      missingLines.push(`Reason: ${leg.reason}`);
      missingLines.push(`DO NOT create or fabricate flight activity cards for this leg. Instead:`);
      missingLines.push(`- Add a "Travel Day" note: "Flight not yet booked — ${leg.fromCity} to ${leg.toCity}"`);
      missingLines.push(`- Show a warning banner, not a fake flight card`);
      missingLines.push(`- Keep the travel day flexible with minimal scheduling`);
      missingLines.push(`- Do NOT invent flight numbers, times, or airlines for this leg`);
    }
    sections.push(missingLines.join('\n'));
  }

  // --- TRAVEL INTEL COVERAGE ---
  if (schedule && schedule.length > 0) {
    const cities = schedule.map(d => d.city as string).filter(Boolean);
    if (cities.length > 0) {
      sections.push(`\n${'='.repeat(60)}\n🌍 TRAVEL INTEL COVERAGE\n${'='.repeat(60)}\nGenerate Travel Intel for ALL of these destination cities: ${cities.join(', ')}\nDo NOT skip any destination. Do NOT generate Travel Intel for layover-only cities.`);
    }
  }

  return sections.length > 0 ? sections.join('\n\n') : '';
}
