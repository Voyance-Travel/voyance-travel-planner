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
    let airportBuffer = 120;    // Arrive 2 hours before flight (domestic) or 3 hours (international)
    
    // International flight adjustment
    const isInternational = flight.arrivalAirport !== flight.departureAirport; // Rough heuristic
    if (isInternational) {
      airportBuffer = 180;
    }
    
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
        ? 'Avoid crowded venues, group tours. Prioritize solo experiences, quiet cafes, private tours.'
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
        ? 'Premium experiences, fine dining, luxury venues, skip-the-line, private access.'
        : 'Balance of splurges and value options.'
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
      implication: (s) => s <= -5
        ? 'Premium everything. Don\'t mention prices or "value".'
        : s >= 5
        ? 'Highlight value. Avoid overpriced tourist traps. Smart splurges only.'
        : 'Balance quality and value.'
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
  
  if (dna.dietaryRestrictions.length > 0) {
    lines.push(`   🍽️ DIETARY: ${dna.dietaryRestrictions.join(', ')}`);
    lines.push(`      ALL food recommendations MUST accommodate these restrictions`);
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
  
  if (flight.hasOutboundFlight) {
    requiredSequence.push('airport_arrival', 'airport_transfer');
  }
  
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
      'airport_arrival': '1. Arrival at Airport (category: transport)',
      'airport_transfer': '2. Airport Transfer to Hotel (category: transport)',
      'hotel_check_in': '3. Hotel Check-in & Settle In (category: accommodation)',
      'settle_in_rest': '4. Rest & Refresh (category: downtime)'
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
  lines.push(`   Max activities: ${maxActivities} (${densityReasoning})`);
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
  }
  lines.push('');
  
  // Activity guidance
  lines.push(`⚡ ACTIVITY GUIDANCE`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`   Max activities BEFORE checkout: ${maxActivities}`);
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
  let latestEnd = '21:00';
  if (dna.sleepSchedule === 'early_bird') latestEnd = '20:00';
  if (dna.sleepSchedule === 'night_owl') latestEnd = '23:30';
  if (dna.traits.pace <= -5) latestEnd = '20:30'; // Relaxed = earlier end
  
  const lines: string[] = [];
  lines.push(`${'='.repeat(60)}`);
  lines.push(`📅 DAY ${dayNumber} - FULL EXPLORATION DAY`);
  lines.push(`${'='.repeat(60)}`);
  lines.push('');
  
  lines.push(`⏰ TIMING`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`   Day starts: ${earliestStart} (based on ${dna.sleepSchedule || 'balanced'} schedule)`);
  lines.push(`   Day ends: ${latestEnd}`);
  lines.push('');
  
  lines.push(`⚡ ACTIVITY DENSITY`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`   Max activities: ${maxActivities}`);
  lines.push(`   Min downtime: ${minDowntime} minutes between activities`);
  lines.push(`   Energy level: ${energyLevel.toUpperCase()}`);
  lines.push(`   (${densityReasoning})`);
  lines.push('');
  
  if (hotel.hasHotel && hotel.hotelNeighborhood) {
    lines.push(`🏨 BASE: ${hotel.hotelNeighborhood}`);
    lines.push(`   Start and end day near hotel when practical`);
    lines.push('');
  }
  
  // DNA-specific guidance
  if (dna.sleepSchedule === 'needs_rest') {
    lines.push(`😴 SIESTA REQUIRED`);
    lines.push(`   Include 2+ hour rest block (2:00-4:00 PM)`);
    lines.push('');
  }
  
  if (dna.traits.authenticity >= 5) {
    lines.push(`🎯 LOCAL-FOCUSED DAY`);
    lines.push(`   Prioritize off-guidebook spots`);
    lines.push(`   Avoid obvious tourist areas`);
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
  const date = new Date(startDate);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().split('T')[0];
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
  dayNumber: number
): { personaPrompt: string; dayConstraints: DayConstraints } {
  const isFirstDay = dayNumber === 1;
  const isLastDay = dayNumber === tripContext.totalDays;
  
  // Build the full persona manuscript (same for all days)
  const personaPrompt = buildPersonaManuscript(dna, tripContext);
  
  // Build day-specific constraints
  let dayConstraints: DayConstraints;
  
  if (isFirstDay) {
    dayConstraints = buildArrivalDayPrompt(flight, hotel, dna, tripContext);
  } else if (isLastDay) {
    dayConstraints = buildDepartureDayPrompt(flight, hotel, dna, tripContext, dayNumber);
  } else {
    dayConstraints = buildRegularDayPrompt(dna, tripContext, dayNumber, hotel);
  }
  
  return { personaPrompt, dayConstraints };
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
  
  // Outbound arrival time
  const manualArrival = (nestedDeparture?.arrival as Record<string, unknown>)?.time as string | undefined;
  const searchArrival = nestedDeparture?.arrivalTime as string | undefined;
  const flatArrival = flightSelection.arrivalTime as string | undefined;
  const arrivalTime = manualArrival || searchArrival || flatArrival;
  
  if (arrivalTime) {
    result.hasOutboundFlight = true;
    result.arrivalTime24 = normalizeTo24h(arrivalTime);
    if (result.arrivalTime24) {
      result.arrivalTimeMins = parseTimeToMins(result.arrivalTime24);
    }
  }
  
  // Return departure time
  const manualReturnDep = (nestedReturn?.departure as Record<string, unknown>)?.time as string | undefined;
  const searchReturnDep = nestedReturn?.departureTime as string | undefined;
  const flatReturnDep = flightSelection.returnDepartureTime as string | undefined;
  const departureTime = manualReturnDep || searchReturnDep || flatReturnDep;
  
  if (departureTime) {
    result.hasReturnFlight = true;
    result.departureTime24 = normalizeTo24h(departureTime);
    if (result.departureTime24) {
      result.departureTimeMins = parseTimeToMins(result.departureTime24);
    }
  }
  
  // Airport codes
  result.departureAirport = flightSelection.departureAirport as string | undefined;
  result.arrivalAirport = flightSelection.arrivalAirport as string | undefined;
  
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
 */
export function buildTravelerDNA(
  dnaProfile: Record<string, unknown> | null,
  preferences: Record<string, unknown> | null,
  overrides: Record<string, number> | null
): TravelerDNA {
  const traitScores = dnaProfile?.trait_scores as Record<string, number> | undefined;
  const v2Data = dnaProfile?.travel_dna_v2 as Record<string, unknown> | undefined;
  const archetypes = v2Data?.archetype_matches as Array<{ name: string; pct: number }> | undefined;
  
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
  
  return {
    primaryArchetype: archetypes?.[0]?.name,
    secondaryArchetype: archetypes?.[1]?.name,
    archetypeConfidence: v2Data?.confidence as number | undefined,
    traits,
    sleepSchedule: (preferences?.sleep_schedule || v2Data?.sleep_schedule) as TravelerDNA['sleepSchedule'],
    energyPeak: (preferences?.daytime_bias || v2Data?.energy_peak) as TravelerDNA['energyPeak'],
    jetLagSensitivity: (preferences?.jet_lag_sensitivity || 'moderate') as TravelerDNA['jetLagSensitivity'],
    dietaryRestrictions: ((preferences?.dietary_restrictions || []) as string[]).filter(Boolean),
    mobilityLevel: (preferences?.mobility_level || 'full') as TravelerDNA['mobilityLevel'],
    accessibilityNeeds: ((preferences?.accessibility_needs || []) as string[]).filter(Boolean),
    foodLikes: ((preferences?.food_likes || []) as string[]).filter(Boolean),
    foodDislikes: ((preferences?.food_dislikes || []) as string[]).filter(Boolean),
    interests: ((preferences?.interests || v2Data?.interests || []) as string[]).filter(Boolean),
    emotionalDrivers: ((preferences?.emotional_drivers || v2Data?.emotional_drivers || []) as string[]).filter(Boolean),
    travelVibes: ((preferences?.travel_vibes || v2Data?.travel_vibes || []) as string[]).filter(Boolean),
    companions: (Array.isArray(preferences?.travel_companions) ? preferences.travel_companions[0] : preferences?.companion_type) as TravelerDNA['companions'],
    childrenCount: preferences?.children_count as number | undefined,
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
