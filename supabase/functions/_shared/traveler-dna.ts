// =============================================================================
// SHARED TRAVELER DNA MODULE
// =============================================================================
// This module provides DNA fetching and persona building utilities that can be
// used across all edge functions (itinerary-chat, get-activity-alternatives, etc.)
// =============================================================================

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.90.1";

// =============================================================================
// TYPES
// =============================================================================

export interface TravelerDNA {
  // Archetype blend
  primaryArchetype?: string;
  secondaryArchetype?: string;
  archetypeConfidence?: number;
  
  // Trait scores (-10 to +10)
  traits: {
    pace: number;
    social: number;
    adventure: number;
    authenticity: number;
    comfort: number;
    planning: number;
    transformation: number;
    budget: number;
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
  
  // NEW: Flight & hotel brand preferences
  preferredAirlines?: string[];
  preferredCabinClass?: string;
  seatPreference?: string;
  hotelBrandPreference?: string;
  accommodationStyle?: string;
  
  // NEW: Budget tier
  budgetTier?: string;
  
  // NEW: Occasion / trip type
  tripType?: string;
  
  // NEW: Past trip history (for personalization context)
  pastTrips?: Array<{
    destination: string;
    tripType?: string;
    highlights?: string[];
    painPoints?: string[];
    lessonsLearned?: string;
  }>;
}

export interface DNAFetchResult {
  dna: TravelerDNA;
  hasData: boolean;
  confidence: number;
}

// =============================================================================
// DNA FETCHING
// =============================================================================

/**
 * Fetch complete traveler DNA for a user from all profile sources
 */
export async function fetchTravelerDNA(
  supabase: SupabaseClient,
  userId: string
): Promise<DNAFetchResult> {
  const defaultDNA: TravelerDNA = {
    traits: { pace: 0, social: 0, adventure: 0, authenticity: 0, comfort: 0, planning: 0, transformation: 0, budget: 0 },
    dietaryRestrictions: [],
    accessibilityNeeds: [],
    foodLikes: [],
    foodDislikes: [],
    interests: [],
    emotionalDrivers: [],
    travelVibes: [],
  };

  try {
    // Fetch from multiple sources in parallel
    const [dnaResult, prefsResult] = await Promise.all([
      supabase.from('travel_dna_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    const dnaProfile = dnaResult.data;
    const prefs = prefsResult.data;

    if (!dnaProfile && !prefs) {
      return { dna: defaultDNA, hasData: false, confidence: 0 };
    }

    const dna: TravelerDNA = { ...defaultDNA };
    let dataPoints = 0;

    // Extract from travel_dna_profiles
    if (dnaProfile) {
      // NOTE: The canonical columns in travel_dna_profiles are snake_case with *_name suffix.
      // Older/legacy flows used primary_archetype/archetype_name.
      dna.primaryArchetype =
        dnaProfile.primary_archetype_name ||
        dnaProfile.primary_archetype ||
        dnaProfile.archetype_name;

      dna.secondaryArchetype =
        dnaProfile.secondary_archetype_name ||
        dnaProfile.secondary_archetype;

      dna.archetypeConfidence =
        dnaProfile.dna_confidence_score ||
        dnaProfile.confidence_score ||
        dnaProfile.score;
      
      // Trait scores
      const traits = dnaProfile.trait_scores as Record<string, number> | null;
      if (traits) {
        dna.traits.pace = traits.pace ?? traits.travel_pace ?? 0;
        dna.traits.social = traits.social ?? traits.social_energy ?? 0;
        dna.traits.adventure = traits.adventure ?? traits.adventure_level ?? 0;
        dna.traits.authenticity = traits.authenticity ?? traits.cultural_immersion ?? 0;
        dna.traits.comfort = traits.comfort ?? traits.luxury_vs_budget ?? 0;
        dna.traits.planning = traits.planning ?? traits.spontaneity ?? 0;
        dna.traits.transformation = traits.transformation ?? traits.growth_vs_leisure ?? 0;
        dna.traits.budget = traits.budget ?? traits.value_focus ?? 0;
        dataPoints += 8;
      }

      // Travel vibes/emotional drivers
      if (Array.isArray(dnaProfile.travel_vibes)) {
        dna.travelVibes = dnaProfile.travel_vibes;
        dataPoints += 1;
      }
      if (Array.isArray(dnaProfile.emotional_drivers)) {
        dna.emotionalDrivers = dnaProfile.emotional_drivers;
        dataPoints += 1;
      }
      dataPoints += 2; // archetype data
    }

    // Extract from user_preferences
    if (prefs) {
      // Interests
      if (Array.isArray(prefs.interests)) {
        dna.interests = prefs.interests;
        dataPoints += 1;
      }
      
      // Dietary
      if (Array.isArray(prefs.dietary_restrictions)) {
        dna.dietaryRestrictions = prefs.dietary_restrictions;
        dataPoints += 1;
      }
      
      // Mobility
      dna.mobilityLevel = prefs.mobility_level || prefs.mobility_needs;
      if (Array.isArray(prefs.accessibility_needs)) {
        dna.accessibilityNeeds = prefs.accessibility_needs;
      }
      
      // Food
      if (Array.isArray(prefs.cuisine_likes)) {
        dna.foodLikes = prefs.cuisine_likes;
      }
      if (Array.isArray(prefs.cuisine_dislikes)) {
        dna.foodDislikes = prefs.cuisine_dislikes;
      }
      
      // Companions
      dna.companions = prefs.travel_companions || prefs.companions;
      
      // Sleep schedule
      dna.sleepSchedule = prefs.sleep_schedule;
      
      // Energy peak
      if (prefs.daytime_bias) {
        dna.energyPeak = prefs.daytime_bias as 'morning' | 'afternoon' | 'evening';
        dataPoints += 1;
      }
      
      // Map travel pace to hint at pace trait if not set from DNA
      if (prefs.travel_pace && dna.traits.pace === 0) {
        const paceMap: Record<string, number> = { 'relaxed': -5, 'balanced': 0, 'packed': 5, 'intensive': 7 };
        dna.traits.pace = paceMap[prefs.travel_pace] ?? 0;
      }
      
      // Map budget tier to hint at comfort/budget traits
      if (prefs.budget_tier && dna.traits.comfort === 0) {
        const comfortMap: Record<string, number> = { 'budget': -5, 'mid-range': 0, 'premium': 5, 'luxury': 8 };
        dna.traits.comfort = comfortMap[prefs.budget_tier] ?? 0;
      }
      
      // NEW: Flight preferences
      if (Array.isArray(prefs.preferred_airlines) && prefs.preferred_airlines.length > 0) {
        dna.preferredAirlines = prefs.preferred_airlines;
        dataPoints += 1;
      }
      if (prefs.preferred_cabin_class) {
        dna.preferredCabinClass = prefs.preferred_cabin_class;
        dataPoints += 1;
      }
      if (prefs.seat_preference) {
        dna.seatPreference = prefs.seat_preference;
      }
      
      // NEW: Hotel/accommodation preferences
      if (prefs.hotel_style) {
        dna.hotelBrandPreference = prefs.hotel_style;
        dataPoints += 1;
      }
      if (prefs.accommodation_style) {
        dna.accommodationStyle = prefs.accommodation_style;
      }
      
      // NEW: Budget tier
      if (prefs.budget_tier) {
        dna.budgetTier = prefs.budget_tier;
      }
      
      dataPoints += 4;
    }

    // NEW: Fetch past trip history for personalization
    try {
      const { data: pastTrips } = await supabase
        .from('trip_learnings')
        .select('destination, highlights, pain_points, lessons_summary, pacing_feedback, discovered_likes, discovered_dislikes')
        .eq('user_id', userId)
        .not('lessons_summary', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(3);
      
      if (pastTrips && pastTrips.length > 0) {
        dna.pastTrips = pastTrips.map((t: any) => ({
          destination: t.destination || 'Unknown',
          highlights: (t.highlights as any[])?.slice(0, 2)?.map((h: any) => h.activity || '') || [],
          painPoints: (t.pain_points as any[])?.slice(0, 2)?.map((p: any) => p.issue || '') || [],
          lessonsLearned: t.lessons_summary || undefined,
        }));
        dataPoints += 3;
      }
    } catch (err) {
      console.warn('[fetchTravelerDNA] Failed to fetch past trips:', err);
    }

    // Calculate confidence based on data completeness
    const maxDataPoints = 20;
    const confidence = Math.min(100, Math.round((dataPoints / maxDataPoints) * 100));

    return { dna, hasData: true, confidence };
  } catch (error) {
    console.error('[fetchTravelerDNA] Error:', error);
    return { dna: defaultDNA, hasData: false, confidence: 0 };
  }
}

// =============================================================================
// PERSONA MANUSCRIPT BUILDER
// =============================================================================

/**
 * Build a comprehensive persona manuscript for AI injection
 * This creates the "entire life" description of the traveler
 */
export function buildPersonaManuscript(dna: TravelerDNA, destination?: string): string {
  const lines: string[] = [];
  
  lines.push(`${'='.repeat(60)}`);
  lines.push(`🧬 TRAVELER DNA PROFILE`);
  lines.push(`${'='.repeat(60)}`);
  
  // Archetype identity
  if (dna.primaryArchetype) {
    lines.push(`🎭 IDENTITY: ${dna.primaryArchetype.replace(/_/g, ' ').toUpperCase()}`);
    if (dna.secondaryArchetype) {
      lines.push(`   Secondary: ${dna.secondaryArchetype.replace(/_/g, ' ')}`);
    }
    lines.push('');
  }
  
  // Trait breakdown with behavioral implications
  lines.push(`📊 TRAIT PROFILE`);
  lines.push(`${'─'.repeat(40)}`);
  
  const traitImplications: Record<string, { low: string; high: string }> = {
    pace: { 
      low: 'Prefers slow, savored experiences. MAX 4-5 activities/day.', 
      high: 'Maximizer who wants packed days. 7-8 activities welcome.' 
    },
    social: { 
      low: 'Introverted. Avoid crowds, group tours. Prefer intimate/solo experiences.', 
      high: 'Social butterfly. Include group activities, communal dining.' 
    },
    adventure: { 
      low: 'Comfort-seeker. Stick to safe, well-known experiences.', 
      high: 'Thrill-seeker. Include adventure activities, off-beaten-path.' 
    },
    authenticity: { 
      low: 'Tourist-friendly is fine. Mainstream attractions welcome.', 
      high: 'AVOID tourist traps. Only local favorites, hidden gems.' 
    },
    comfort: { 
      low: 'Budget-conscious. Prioritize value over luxury.', 
      high: 'Luxury-seeking. Premium venues, fine dining, VIP access.' 
    },
    planning: { 
      low: 'Spontaneous. Leave gaps, general frameworks.', 
      high: 'Detailed planner. Specific timings, reservations, backups.' 
    },
    budget: { 
      low: 'Splurge-forward. Money is not a concern.', 
      high: 'Value-focused. Smart spending, avoid overpriced options.' 
    },
  };
  
  for (const [trait, impl] of Object.entries(traitImplications)) {
    const score = dna.traits[trait as keyof typeof dna.traits] || 0;
    if (Math.abs(score) >= 3) {
      const direction = score < 0 ? impl.low : impl.high;
      lines.push(`   ${trait.toUpperCase()}: ${score > 0 ? '+' : ''}${score} → ${direction}`);
    }
  }
  lines.push('');
  
  // Timing patterns
  if (dna.sleepSchedule || dna.energyPeak) {
    lines.push(`⏰ TIMING PREFERENCES`);
    lines.push(`${'─'.repeat(40)}`);
    if (dna.sleepSchedule) {
      const scheduleMap: Record<string, string> = {
        'early_bird': 'Start 7-8 AM, dinner by 7 PM, activities end by 8:30 PM',
        'night_owl': 'Start 10-11 AM, late dinners (8 PM+), include nightlife',
        'needs_rest': 'Mandatory 2+ hour midday rest (2-4 PM)',
        'flexible': 'Adapt to destination norms'
      };
      lines.push(`   ${scheduleMap[dna.sleepSchedule] || dna.sleepSchedule}`);
    }
    if (dna.energyPeak) {
      lines.push(`   ⚡ ENERGY PEAK: ${dna.energyPeak.toUpperCase()}`);
      const peakGuidance: Record<string, string> = {
        'morning': 'HIGH-INTENSITY activities 8AM-12PM (museums, hikes). LOW-INTENSITY after 3PM.',
        'afternoon': 'HIGH-INTENSITY activities 12PM-5PM (tours, attractions). Easy mornings & evenings.',
        'evening': 'HIGH-INTENSITY activities 5PM-10PM (food tours, nightlife). Light mornings.'
      };
      lines.push(`      ${peakGuidance[dna.energyPeak] || 'Schedule key activities during peak'}`);
    }
    lines.push('');
  }
  
  // Dietary/accessibility
  if (dna.dietaryRestrictions.length > 0 || dna.accessibilityNeeds.length > 0 || dna.mobilityLevel) {
    lines.push(`♿ REQUIREMENTS`);
    lines.push(`${'─'.repeat(40)}`);
    if (dna.dietaryRestrictions.length > 0) {
      lines.push(`   Dietary: ${dna.dietaryRestrictions.join(', ')}`);
    }
    if (dna.mobilityLevel && dna.mobilityLevel !== 'full') {
      lines.push(`   Mobility: ${dna.mobilityLevel} - avoid strenuous activities`);
    }
    if (dna.accessibilityNeeds.length > 0) {
      lines.push(`   Accessibility: ${dna.accessibilityNeeds.join(', ')}`);
    }
    lines.push('');
  }
  
  // Food preferences
  if (dna.foodLikes.length > 0 || dna.foodDislikes.length > 0) {
    lines.push(`🍽️ FOOD PREFERENCES`);
    lines.push(`${'─'.repeat(40)}`);
    if (dna.foodLikes.length > 0) {
      lines.push(`   Loves: ${dna.foodLikes.slice(0, 5).join(', ')}`);
    }
    if (dna.foodDislikes.length > 0) {
      lines.push(`   Avoids: ${dna.foodDislikes.slice(0, 5).join(', ')}`);
    }
    lines.push('');
  }
  
  // Interests
  if (dna.interests.length > 0) {
    lines.push(`❤️ INTERESTS: ${dna.interests.slice(0, 8).join(', ')}`);
  }
  if (dna.travelVibes.length > 0) {
    lines.push(`✨ TRAVEL VIBES: ${dna.travelVibes.slice(0, 5).join(', ')}`);
  }
  if (dna.emotionalDrivers.length > 0) {
    lines.push(`💡 EMOTIONAL DRIVERS: ${dna.emotionalDrivers.slice(0, 5).join(', ')}`);
  }
  
  // Companions
  if (dna.companions) {
    const companionMap: Record<string, string> = {
      'solo': '🧍 Traveling SOLO - independent experiences',
      'couple': '💑 Traveling as COUPLE - romantic touches',
      'family': '👨‍👩‍👧 FAMILY trip - consider all ages',
      'friends': '👯 Traveling with FRIENDS - group-friendly activities',
      'group': '👥 GROUP travel - accommodate varied preferences',
    };
    lines.push(companionMap[dna.companions] || `Companions: ${dna.companions}`);
    if (dna.childrenCount && dna.childrenCount > 0) {
      lines.push(`   Children: ${dna.childrenCount} - include family-friendly options`);
    }
  }
  
  // NEW: Flight & hotel brand preferences
  if (dna.preferredAirlines?.length || dna.preferredCabinClass || dna.hotelBrandPreference || dna.accommodationStyle) {
    lines.push('');
    lines.push(`✈️🏨 TRAVEL STYLE PREFERENCES`);
    lines.push(`${'─'.repeat(40)}`);
    if (dna.preferredAirlines?.length) {
      lines.push(`   Preferred airlines: ${dna.preferredAirlines.join(', ')}`);
    }
    if (dna.preferredCabinClass) {
      lines.push(`   Cabin class: ${dna.preferredCabinClass}`);
    }
    if (dna.hotelBrandPreference) {
      lines.push(`   Hotel style preference: ${dna.hotelBrandPreference}`);
    }
    if (dna.accommodationStyle) {
      lines.push(`   Accommodation: ${dna.accommodationStyle}`);
    }
    if (dna.budgetTier) {
      lines.push(`   Budget tier: ${dna.budgetTier}`);
    }
  }
  
  // NEW: Occasion / trip type
  if (dna.tripType) {
    lines.push('');
    lines.push(`🎉 TRIP OCCASION: ${dna.tripType.toUpperCase()}`);
    const occasionGuidance: Record<string, string> = {
      'honeymoon': 'Plan romantic, intimate experiences. Sunset dinners, couples spa, private moments.',
      'anniversary': 'Celebration-worthy experiences. Special dinner, meaningful activities.',
      'birthday': 'Include a celebration moment. Special restaurant, surprise-worthy activity.',
      'graduation': 'Achievement celebration. Celebratory dinner, memorable experiences.',
      'bachelor': 'High-energy group activities. Nightlife, adventure, bonding experiences.',
      'bachelorette': 'Fun group activities. Spa day, nightlife, Instagram-worthy spots.',
      'family': 'Balance kid-friendly and adult-enjoyable. Include rest periods.',
      'business': 'Efficient scheduling. Working-friendly cafes, professional dining spots.',
      'solo': 'Independent exploration. Opportunities to meet locals, personal discovery.',
      'reunion': 'Group-friendly venues. Shareable meals, activities for all fitness levels.',
      'retirement': 'Celebratory and leisurely. Bucket-list experiences, premium dining.',
    };
    if (occasionGuidance[dna.tripType.toLowerCase()]) {
      lines.push(`   ${occasionGuidance[dna.tripType.toLowerCase()]}`);
    }
  }
  
  // NEW: Past trip history for context
  if (dna.pastTrips && dna.pastTrips.length > 0) {
    lines.push('');
    lines.push(`📜 PAST TRIP HISTORY (use for personalization)`);
    lines.push(`${'─'.repeat(40)}`);
    for (const trip of dna.pastTrips) {
      lines.push(`   • ${trip.destination}`);
      if (trip.highlights?.length) {
        lines.push(`     Loved: ${trip.highlights.join(', ')}`);
      }
      if (trip.painPoints?.length) {
        lines.push(`     Avoid: ${trip.painPoints.join(', ')}`);
      }
      if (trip.lessonsLearned) {
        lines.push(`     Lesson: ${trip.lessonsLearned}`);
      }
    }
    lines.push(`   → Reference past experiences when relevant: "Since you loved X in Y..."`)
  }
  
  lines.push('');
  lines.push(`${'='.repeat(60)}`);
  lines.push(`🎯 PERSONALIZATION QUALITY BAR (MANDATORY)`);
  lines.push(`${'='.repeat(60)}`);
  lines.push(`Every recommendation MUST pass this test:`);
  lines.push(`"Could the user have gotten this same advice from a Google search?" If YES → it's NOT good enough.`);
  lines.push('');
  lines.push(`RULES:`);
  lines.push(`1. Be OPINIONATED: "This restaurant because of your love of X" — not "this restaurant is popular"`);
  lines.push(`2. Be SPECIFIC: "Arrive before 10am to beat the school groups" — not "visit early"`);
  lines.push(`3. Be PERSONAL: Reference their traits, past trips, or preferences in justifications`);
  lines.push(`4. Be TIMELY: Mention seasonal relevance, current events, recent openings when known`);
  lines.push(`5. NEVER give generic tourist advice. Every tip should feel like it came from a friend who knows them.`);
  lines.push(`6. If suggesting a restaurant, explain WHY it fits THIS person (cuisine match, vibe match, budget match)`);
  lines.push(`7. If suggesting an activity, connect it to their interests, emotional drivers, or past trip patterns`);
  lines.push(`${'='.repeat(60)}`);
  
  return lines.join('\n');
}

/**
 * Build a compact DNA summary for shorter prompts
 */
export function buildCompactDNASummary(dna: TravelerDNA): string {
  const parts: string[] = [];
  
  if (dna.primaryArchetype) {
    parts.push(`Type: ${dna.primaryArchetype.replace(/_/g, ' ')}`);
  }
  
  // Only mention significant traits
  const significantTraits: string[] = [];
  if (Math.abs(dna.traits.pace) >= 4) {
    significantTraits.push(dna.traits.pace < 0 ? 'relaxed pace' : 'packed schedule');
  }
  if (Math.abs(dna.traits.adventure) >= 4) {
    significantTraits.push(dna.traits.adventure < 0 ? 'comfort-seeker' : 'adventurous');
  }
  if (Math.abs(dna.traits.authenticity) >= 4) {
    significantTraits.push(dna.traits.authenticity < 0 ? 'tourist-friendly' : 'local-focused');
  }
  if (Math.abs(dna.traits.comfort) >= 4) {
    significantTraits.push(dna.traits.comfort < 0 ? 'budget-conscious' : 'luxury-seeking');
  }
  if (Math.abs(dna.traits.social) >= 4) {
    significantTraits.push(dna.traits.social < 0 ? 'introverted' : 'social');
  }
  
  if (significantTraits.length > 0) {
    parts.push(`Style: ${significantTraits.join(', ')}`);
  }
  
  if (dna.interests.length > 0) {
    parts.push(`Interests: ${dna.interests.slice(0, 4).join(', ')}`);
  }
  
  if (dna.dietaryRestrictions.length > 0) {
    parts.push(`Dietary: ${dna.dietaryRestrictions.join(', ')}`);
  }
  
  if (dna.companions) {
    parts.push(`Travel: ${dna.companions}`);
  }
  
  return parts.join(' | ');
}
