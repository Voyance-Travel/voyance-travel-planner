/**
 * Quiz to Database Mapping Layer
 * Maps frontend quiz responses to backend database schema
 * Aligned with backend's user_preferences and related tables
 */

import { supabase } from '@/integrations/supabase/client';
import { getTypeRarity } from '@/config/typeRarity';
import type { Json } from '@/integrations/supabase/types';

// ============================================================================
// TYPES
// ============================================================================

export interface QuizAnswer {
  questionId: string;
  value: string | string[];
  displayLabel?: string;
  stepId?: string;
  questionPrompt?: string;
}

export interface QuizSessionData {
  userId: string;
  quizVersion?: string;
  currentStep: number;
  totalSteps: number;
  completionPercentage: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  userAgent?: string;
  deviceType?: string;
}

export interface UserPreferencesPayload {
  // Core preferences
  travel_style?: string;
  budget_tier?: string;
  travel_pace?: string;
  accommodation_style?: string;
  interests?: string[];
  
  // Extended preferences
  quiz_completed?: boolean;
  quiz_version?: string;
  completed_at?: string;
  primary_goal?: string;
  traveler_type?: string;
  travel_vibes?: string[];
  emotional_drivers?: string[];
  travel_frequency?: string;
  trip_duration?: string;
  schedule_flexibility?: string;
  trip_structure_preference?: string;
  travel_companions?: string[];
  preferred_group_size?: string;
  hotel_style?: string;
  hotel_vs_flight?: string;
  seat_preference?: string;
  flight_time_preference?: string;
  direct_flights_only?: boolean;
  preferred_cabin_class?: string;
  preferred_airlines?: string[];
  home_airport?: string;
  airport_radius_miles?: number;
  climate_preferences?: string[];
  weather_preferences?: string[];
  mobility_level?: string;
  accessibility_needs?: string[];
  mobility_needs?: string;
  dietary_restrictions?: string[];
  food_likes?: string[];
  food_dislikes?: string[];
  dining_style?: string;
  eco_friendly?: boolean;
  vibe?: string;
  activity_level?: string;
  planning_preference?: string;
  sleep_schedule?: string;
  daytime_bias?: string;
  downtime_ratio?: string;
  social_energy?: string;
}

export interface TravelDNAPayload {
  primary_archetype_name?: string;
  primary_archetype_display?: string;
  primary_archetype_category?: string;
  primary_archetype_tagline?: string;
  secondary_archetype_name?: string;
  secondary_archetype_display?: string;
  dna_confidence_score?: number;
  dna_rarity?: string;
  trait_scores?: Record<string, number>;
  tone_tags?: string[];
  emotional_drivers?: string[];
  perfect_trip_preview?: string;
  summary?: string;
  calculated_at?: string;
}

// ============================================================================
// FIELD MAPPINGS
// ============================================================================

/**
 * Maps frontend quiz question IDs to backend database columns
 */
const QUIZ_FIELD_MAP: Record<string, keyof UserPreferencesPayload> = {
  // ==== QUIZ.TSX QUESTION IDS (MUST MATCH EXACTLY) ====
  'traveler_type': 'traveler_type',
  'travel_vibes': 'travel_vibes',
  'trip_frequency': 'travel_frequency',
  'trip_duration': 'trip_duration',
  'budget': 'budget_tier',
  'pace': 'travel_pace',
  'planning_style': 'planning_preference',
  'travel_companions': 'travel_companions',
  'companions': 'travel_companions', // Alternate ID
  'group_size': 'preferred_group_size',
  'interests': 'interests',
  'accommodation': 'accommodation_style', // Step 8 hotel type
  'hotel_style': 'hotel_style',
  'hotel_priorities': 'hotel_style', // Maps priorities to style
  'dining_style': 'dining_style',
  'dietary_restrictions': 'dietary_restrictions',
  'weather_preference': 'climate_preferences', // CRITICAL: climate prefs
  'cabin_class': 'preferred_cabin_class', // Flight cabin class
  'social_energy': 'social_energy', // Introvert/extrovert preference
  // flight_preferences is handled specially in mapQuizAnswersToPreferences
  
  // ==== LEGACY/ALTERNATE MAPPINGS (camelCase versions) ====
  'style': 'travel_style',
  // 'accommodation' already mapped above
  'travelerType': 'traveler_type',
  'travelVibes': 'travel_vibes',
  'emotionalDrivers': 'emotional_drivers',
  'travelFrequency': 'travel_frequency',
  'tripDuration': 'trip_duration',
  'scheduleFlexibility': 'schedule_flexibility',
  'tripStructure': 'trip_structure_preference',
  'travelCompanions': 'travel_companions',
  'groupSize': 'preferred_group_size',
  'hotelStyle': 'hotel_style',
  'hotelVsFlight': 'hotel_vs_flight',
  'seatPreference': 'seat_preference',
  'flightTime': 'flight_time_preference',
  'directFlights': 'direct_flights_only',
  'preferredAirlines': 'preferred_airlines',
  'homeAirport': 'home_airport',
  'airportRadius': 'airport_radius_miles',
  'climate': 'climate_preferences',
  'weather': 'weather_preferences',
  'mobilityLevel': 'mobility_level',
  'accessibilityNeeds': 'accessibility_needs',
  'dietaryRestrictions': 'dietary_restrictions',
  'foodLikes': 'food_likes',
  'foodDislikes': 'food_dislikes',
  'diningStyle': 'dining_style',
  'ecoFriendly': 'eco_friendly',
  'vibe': 'vibe',
  'activityLevel': 'activity_level',
  'planningPreference': 'planning_preference',
  'sleepSchedule': 'sleep_schedule',
  'daytimeBias': 'daytime_bias',
  'downtimeRatio': 'downtime_ratio',
  'primaryGoal': 'primary_goal',
};

/**
 * Maps quiz traveler_type values to archetype IDs
 * These match the values sent from the Quiz.tsx options
 */
const STYLE_TO_ARCHETYPE: Record<string, string> = {
  // Primary quiz values (from Quiz.tsx traveler_type question)
  'explorer': 'cultural_anthropologist',
  'escape_artist': 'zen_seeker',
  'curated_luxe': 'luxury_luminary',
  'story_seeker': 'story_seeker',
  // Legacy/alternate values
  'luxury': 'luxury_luminary',
  'adventure': 'adrenaline_architect',
  'cultural': 'cultural_anthropologist',
  'relaxation': 'escape_artist',
};

/**
 * Maps pace to pace description
 */
const PACE_MAP: Record<string, string> = {
  'slow': 'relaxed',
  'moderate': 'moderate',
  'fast': 'packed',
};

// ============================================================================
// QUIZ SESSION MANAGEMENT
// ============================================================================

/**
 * Creates a new quiz session for tracking progress
 */
export async function createQuizSession(data: QuizSessionData): Promise<string | null> {
  const { data: session, error } = await supabase
    .from('quiz_sessions')
    .insert({
      user_id: data.userId,
      quiz_version: data.quizVersion || 'v3',
      current_step: data.currentStep,
      total_steps: data.totalSteps,
      completion_percentage: data.completionPercentage,
      status: data.status,
      user_agent: data.userAgent,
      device_type: data.deviceType,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create quiz session:', error);
    return null;
  }

  return session?.id || null;
}

/**
 * Updates an existing quiz session
 */
export async function updateQuizSession(
  sessionId: string,
  updates: Partial<QuizSessionData>
): Promise<boolean> {
  const updatePayload: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
  };

  if (updates.currentStep !== undefined) {
    updatePayload.current_step = updates.currentStep;
  }
  if (updates.completionPercentage !== undefined) {
    updatePayload.completion_percentage = updates.completionPercentage;
  }
  if (updates.status !== undefined) {
    updatePayload.status = updates.status;
    if (updates.status === 'completed') {
      updatePayload.completed_at = new Date().toISOString();
      updatePayload.is_complete = true;
    }
  }

  const { error } = await supabase
    .from('quiz_sessions')
    .update(updatePayload)
    .eq('id', sessionId);

  if (error) {
    console.error('Failed to update quiz session:', error);
    return false;
  }

  return true;
}

// ============================================================================
// QUIZ RESPONSE STORAGE
// ============================================================================

/**
 * Saves an individual quiz response
 */
export async function saveQuizResponse(
  userId: string,
  sessionId: string | null,
  answer: QuizAnswer,
  responseOrder: number
): Promise<boolean> {
  const { error } = await supabase.from('quiz_responses').insert({
    user_id: userId,
    session_id: sessionId,
    field_id: answer.questionId,
    field_type: Array.isArray(answer.value) ? 'multi_select' : 'single_select',
    answer_value: Array.isArray(answer.value) 
      ? JSON.stringify(answer.value) 
      : answer.value,
    display_label: answer.displayLabel,
    step_id: answer.stepId,
    question_prompt: answer.questionPrompt,
    response_order: responseOrder,
  });

  if (error) {
    console.error('Failed to save quiz response:', error);
    return false;
  }

  return true;
}

// ============================================================================
// PREFERENCE MAPPING & SAVING
// ============================================================================

/**
 * Maps quiz answers to user preferences payload
 */
export function mapQuizAnswersToPreferences(
  answers: Record<string, string | string[]>
): UserPreferencesPayload {
  const preferences: UserPreferencesPayload = {};

  for (const [questionId, value] of Object.entries(answers)) {
    const dbField = QUIZ_FIELD_MAP[questionId];
    
    if (dbField) {
      // Handle special transformations
      if (questionId === 'pace' && typeof value === 'string') {
        (preferences as Record<string, unknown>)[dbField] = PACE_MAP[value] || value;
      } else if (questionId === 'directFlights' && typeof value === 'string') {
        (preferences as Record<string, unknown>)[dbField] = value === 'yes';
      } else if (questionId === 'ecoFriendly' && typeof value === 'string') {
        (preferences as Record<string, unknown>)[dbField] = value === 'yes';
      } else if (questionId === 'airportRadius' && typeof value === 'string') {
        (preferences as Record<string, unknown>)[dbField] = parseInt(value, 10) || null;
      } else {
        (preferences as Record<string, unknown>)[dbField] = value;
      }
    }
    
    // Handle flight_preferences - now single select with 'direct' or 'flexible'
    if (questionId === 'flight_preferences') {
      if (value === 'direct') {
        preferences.direct_flights_only = true;
      } else if (value === 'flexible') {
        preferences.direct_flights_only = false;
      }
      // Also handle legacy multi-select format for backward compatibility
      if (Array.isArray(value) && value.includes('direct')) {
        preferences.direct_flights_only = true;
      }
    }
    
    // Handle food_allergies text input - append to dietary info
    if (questionId === 'food_allergies' && typeof value === 'string' && value.trim()) {
      // Store allergies in dietary_restrictions with a prefix for clarity
      const existingRestrictions = preferences.dietary_restrictions || [];
      preferences.dietary_restrictions = [...existingRestrictions, `ALLERGIES: ${value.trim()}`];
    }
  }

  return preferences;
}

/**
 * Saves user preferences to the database
 */
export async function saveUserPreferences(
  userId: string,
  preferences: UserPreferencesPayload,
  markQuizComplete = true
): Promise<boolean> {
  const payload: Record<string, unknown> = { ...preferences };
  
  if (markQuizComplete) {
    payload.quiz_completed = true;
    payload.completed_at = new Date().toISOString();
  }

  // Try to update first, then insert if not exists
  const { data: existing } = await supabase
    .from('user_preferences')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let error;
  
  if (existing) {
    const result = await supabase
      .from('user_preferences')
      .update(payload)
      .eq('user_id', userId);
    error = result.error;
  } else {
    const result = await supabase
      .from('user_preferences')
      .insert({ user_id: userId, ...payload });
    error = result.error;
  }

  if (error) {
    console.error('Failed to save user preferences:', error);
    return false;
  }

  return true;
}

// ============================================================================
// TRAVEL DNA CALCULATION & SAVING
// ============================================================================

/**
 * Calculates Travel DNA via backend edge function
 * Uses sophisticated trait calculation and AI-powered Perfect Trip generation
 * @param existingOverrides - User's manual trait adjustments to consider during calculation
 */
/**
 * Convert V3 25-trait (0-1) scores to V2 8-trait (-10/+10) scores
 * so the edge function can process V3 quiz answers correctly.
 */
/**
 * Extract fine-grained V3 trait scores (0-1 scale) for supplementary archetype matching.
 * These are passed alongside the 8 V2 traits to give the edge function
 * the granularity it needs to distinguish between similar archetypes.
 */
function extractFineGrainedTraits(v3: Record<string, number | string>): Record<string, number> {
  const get = (key: string, def: number = 0): number => {
    const val = v3[key];
    return typeof val === 'number' ? val : def;
  };
  return {
    nature_orientation: get('nature_orientation', 0.5),
    cultural_depth: get('cultural_depth', 0.5),
    social_energy: get('social_energy', 0.5),
    flexibility: get('flexibility', 0.5),
    restoration_need: get('restoration_need', 0.5),
    food_focus: get('food_focus', 0.3),
    art_focus: get('art_focus', 0.2),
    photo_focus: get('photo_focus', 0.2),
    niche_interest: get('niche_interest', 0.2),
    romance_focus: get('romance_focus', 0),
    family_focus: get('family_focus', 0),
    ethics_focus: get('ethics_focus', 0.3),
    bucket_list: get('bucket_list', 0.3),
    quality_intrinsic: get('quality_intrinsic', 0.5),
    status_seeking: get('status_seeking', 0.3),
    spirituality: get('spirituality', 0.2),
    learning_focus: get('learning_focus', 0.3),
    healing_focus: get('healing_focus', 0),
    novelty_seeking: get('novelty_seeking', 0.5),
    adventure: get('adventure', 0.5),
    group_size_pref: get('group_size_pref', 0.5),
    morning_energy: get('morning_energy', 0.5),
    budget_tier: get('budget_tier', 0.5),
    pace: get('pace', 0.5),
    planning: get('planning', 0.5),
  };
}

function convertV3ToV2Traits(v3: Record<string, number | string>): Record<string, number> {
  const get = (key: string, def: number = 0.5): number => {
    const val = v3[key];
    return typeof val === 'number' ? val : def;
  };
  const scale = (val: number, center: number, factor: number) => (val - center) * factor;

  return {
    pace: Math.max(-10, Math.min(10, scale(get('pace'), 0.5, 14) + scale(get('morning_energy'), 0.5, 4) - scale(get('restoration_need'), 0.5, 4))),
    social: Math.max(-10, Math.min(10, scale(get('social_energy'), 0.5, 14) + scale(get('group_size_pref'), 0.5, 6))),
    comfort: Math.max(-10, Math.min(10, scale(get('quality_intrinsic'), 0.5, 10) + scale(get('budget_tier'), 0.5, 6) + scale(get('status_seeking', 0.3), 0.3, 4))),
    adventure: Math.max(-10, Math.min(10, scale(get('adventure'), 0.5, 12) + scale(get('novelty_seeking'), 0.5, 8))),
    authenticity: Math.max(-10, Math.min(10, scale(get('cultural_depth'), 0.5, 12) + scale(get('learning_focus', 0.3), 0.3, 6) + scale(get('food_focus', 0.3), 0.3, 4) + scale(get('art_focus', 0.2), 0.2, 3))),
    planning: Math.max(-10, Math.min(10, scale(get('planning'), 0.5, 14) - scale(get('flexibility'), 0.5, 6))),
    budget: Math.max(-10, Math.min(10, -scale(get('budget_tier'), 0.5, 14) - scale(get('status_seeking', 0.3), 0.3, 6))),
    transformation: Math.max(-10, Math.min(10, scale(get('spirituality', 0.2), 0.2, 8) + scale(get('healing_focus', 0), 0, 6) + scale(get('learning_focus', 0.3), 0.3, 4))),
  };
}

export async function calculateTravelDNAAdvanced(
  answers: Record<string, string | string[]>,
  userId?: string,
  existingOverrides?: Record<string, number> | null
): Promise<TravelDNAPayload> {
  try {
    // Pre-compute V2 traits from V3 quiz answers so edge function gets valid trait data
    let precomputedTraits: Record<string, number> | null = null;
    let fineGrainedTraits: Record<string, number> | null = null;
    try {
      // Dynamic import to avoid circular dependencies
      const { calculateTraitScores } = await import('@/services/engines/travelDNA/archetype-matcher');
      const flatAnswers: Record<string, string> = {};
      for (const [k, v] of Object.entries(answers)) {
        if (typeof v === 'string') flatAnswers[k] = v;
      }
      const { scores } = calculateTraitScores(flatAnswers);
      const converted = convertV3ToV2Traits(scores as unknown as Record<string, number | string>);
      // Only send precomputedTraits if they have real signal (not all zeros from legacy answers
      // that didn't match any V3 question IDs)
      // ALWAYS extract fine-grained V3 traits — they are the primary scoring signal
      // and must never be gated behind V2 hasSignal
      fineGrainedTraits = extractFineGrainedTraits(scores as unknown as Record<string, number | string>);
      const hasFineGrainedSignal = Object.values(fineGrainedTraits).some(v => v > 0.05);
      if (!hasFineGrainedSignal) {
        console.warn('[TravelDNA] Fine-grained traits are all near-zero — possible legacy answers');
        fineGrainedTraits = null;
      } else {
        console.log('[TravelDNA] Fine-grained V3 traits (ALWAYS SENT):', JSON.stringify(fineGrainedTraits));
      }
      
      const hasV2Signal = Object.values(converted).some(v => Math.abs(v) >= 1.0);
      if (hasV2Signal) {
        precomputedTraits = converted;
        console.log('[TravelDNA] Pre-computed V2 traits:', JSON.stringify(precomputedTraits));
      } else {
        console.log('[TravelDNA] V2 traits are all near-zero — edge function will use legacy parsing for V2');
      }
    } catch (err) {
      console.warn('[TravelDNA] Failed to pre-compute traits:', err);
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-travel-dna`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          answers, 
          userId,
          existingOverrides: existingOverrides || null,
          precomputedTraits,
          fineGrainedTraits,
        }),
      }
    );

    if (!response.ok) {
      console.error('Edge function error:', response.status);
      // Fall back to simple calculation
      return calculateTravelDNA(answers);
    }

    const data = await response.json();
    return data as TravelDNAPayload;
  } catch (error) {
    console.error('Failed to calculate Travel DNA via backend:', error);
    // Fall back to simple calculation
    return calculateTravelDNA(answers);
  }
}

/**
 * Calculates Travel DNA based on quiz answers (fallback/offline)
 * This is a simplified frontend calculation - the full calculation happens on backend
 */
export function calculateTravelDNA(
  answers: Record<string, string | string[]>
): TravelDNAPayload {
  const style = answers.traveler_type as string || answers.style as string;
  const interests = answers.interests as string[] || [];
  const pace = answers.pace as string;
  const budget = answers.budget as string;
  const vibes = answers.travel_vibes as string[] || [];

  // Determine primary archetype from style
  const primaryArchetype = STYLE_TO_ARCHETYPE[style] || 'explorer';

  // Calculate trait scores based on answers (-10 to +10 scale)
  const traitScores: Record<string, number> = {
    planning: answers.planning_style === 'detailed' ? 7 : answers.planning_style === 'spontaneous' ? -5 : 0,
    social: (answers.travel_companions as string[])?.includes('solo') ? -3 : interests.includes('nightlife') ? 5 : 2,
    comfort: budget === 'luxury' ? 6 : budget === 'premium' ? 4 : budget === 'budget' ? -2 : 2,
    pace: pace === 'active' ? 6 : pace === 'relaxed' ? -6 : 0,
    authenticity: interests.includes('culture') || interests.includes('food') ? 5 : 2,
    adventure: interests.includes('adventure') || vibes.includes('bold') ? 6 : 2,
    budget: budget === 'luxury' ? 7 : budget === 'premium' ? 4 : budget === 'budget' ? -3 : 0,
    transformation: vibes.includes('spiritual') || interests.includes('wellness') ? 5 : 2,
  };

  // Derive tone tags from trait scores
  const toneTags: string[] = [];
  if (traitScores.adventure >= 5) toneTags.push('adventurous');
  if (traitScores.comfort >= 5) toneTags.push('comfort-seeking');
  if (traitScores.authenticity >= 5) toneTags.push('authentic');
  if (traitScores.pace <= -3) toneTags.push('slow-paced');
  if (traitScores.pace >= 3) toneTags.push('active');
  if (traitScores.transformation >= 5) toneTags.push('transformative');

  // Calculate confidence based on number of questions answered
  const answeredCount = Object.keys(answers).length;
  const confidence = Math.min(100, Math.round((answeredCount / 10) * 100 + 30));

  // Determine rarity from type-specific data
  const typeRarityData = getTypeRarity(primaryArchetype);
  const rarity = typeRarityData
    ? (typeRarityData.tier === 'very-rare' ? 'Very Rare' : typeRarityData.tier === 'very-common' ? 'Very Common' : typeRarityData.tier.charAt(0).toUpperCase() + typeRarityData.tier.slice(1))
    : 'Uncommon';

  // Generate summary
  const summary = generateDNASummary(primaryArchetype, toneTags, pace);

  return {
    primary_archetype_name: primaryArchetype,
    primary_archetype_display: STYLE_TO_ARCHETYPE[style] ? getArchetypeDisplayName(primaryArchetype) : 'The Explorer',
    primary_archetype_category: getArchetypeCategory(primaryArchetype),
    primary_archetype_tagline: getArchetypeTagline(primaryArchetype),
    dna_confidence_score: confidence,
    dna_rarity: rarity,
    trait_scores: traitScores,
    tone_tags: toneTags,
    emotional_drivers: extractEmotionalDrivers(answers),
    summary,
  };
}

function getArchetypeDisplayName(id: string): string {
  const names: Record<string, string> = {
    // EXPLORER category
    cultural_anthropologist: 'The Cultural Anthropologist',
    urban_nomad: 'The Urban Nomad',
    wilderness_pioneer: 'The Wilderness Pioneer',
    digital_explorer: 'The Untethered Traveler',
    explorer: 'The Explorer',
    // CONNECTOR category
    social_butterfly: 'The Social Butterfly',
    family_architect: 'The Family Architect',
    romantic_curator: 'The Romantic Curator',
    story_seeker: 'The Story Seeker',
    // ACHIEVER category
    bucket_list_conqueror: 'The Bucket List Conqueror',
    adrenaline_architect: 'The Adrenaline Architect',
    collection_curator: 'The Passport Collector',
    status_seeker: 'The Luxe Achiever',
    // RESTORER category
    zen_seeker: 'The Zen Seeker',
    retreat_regular: 'The Retreat Regular',
    beach_therapist: 'The Beach Therapist',
    slow_traveler: 'The Slow Traveler',
    escape_artist: 'The Escape Artist',
    // CURATOR category
    culinary_cartographer: 'The Culinary Cartographer',
    art_aficionado: 'The Art Aficionado',
    luxury_luminary: 'The Luxury Luminary',
    eco_ethicist: 'The Mindful Voyager',
    curated_luxe: 'Curated Luxe',
    // TRANSFORMER category
    gap_year_graduate: 'The Gap Year Graduate',
    midlife_explorer: 'The Unscripted Explorer',
    sabbatical_scholar: 'The Sabbatical Scholar',
    healing_journeyer: 'The Healing Journeyer',
    retirement_ranger: 'The Boundless Explorer',
    // CONNECTOR (additional)
    community_builder: 'The Community Builder',
    // RESTORER (additional)
    sanctuary_seeker: 'The Sanctuary Seeker',
    // BALANCED / FLEXIBLE archetypes
    balanced_story_collector: 'The Balanced Story Collector',
    flexible_wanderer: 'The Flexible Wanderer',
  };
  return names[id] || 'The Explorer';
}

function getArchetypeCategory(id: string): string {
  const categories: Record<string, string> = {
    // EXPLORER
    cultural_anthropologist: 'EXPLORER',
    urban_nomad: 'EXPLORER',
    wilderness_pioneer: 'EXPLORER',
    digital_explorer: 'EXPLORER',
    explorer: 'EXPLORER',
    // CONNECTOR
    social_butterfly: 'CONNECTOR',
    family_architect: 'CONNECTOR',
    romantic_curator: 'CONNECTOR',
    story_seeker: 'CONNECTOR',
    // ACHIEVER
    bucket_list_conqueror: 'ACHIEVER',
    adrenaline_architect: 'ACHIEVER',
    collection_curator: 'ACHIEVER',
    status_seeker: 'ACHIEVER',
    // RESTORER
    zen_seeker: 'RESTORER',
    retreat_regular: 'RESTORER',
    beach_therapist: 'RESTORER',
    slow_traveler: 'RESTORER',
    escape_artist: 'RESTORER',
    // CURATOR
    culinary_cartographer: 'CURATOR',
    art_aficionado: 'CURATOR',
    luxury_luminary: 'CURATOR',
    eco_ethicist: 'CURATOR',
    curated_luxe: 'CURATOR',
    // TRANSFORMER
    gap_year_graduate: 'TRANSFORMER',
    midlife_explorer: 'TRANSFORMER',
    sabbatical_scholar: 'TRANSFORMER',
    healing_journeyer: 'TRANSFORMER',
    retirement_ranger: 'TRANSFORMER',
    // CONNECTOR (additional)
    community_builder: 'CONNECTOR',
    // RESTORER (additional)
    sanctuary_seeker: 'RESTORER',
  };
  return categories[id] || 'EXPLORER';
}

function getArchetypeTagline(id: string): string {
  const taglines: Record<string, string> = {
    // EXPLORER
    cultural_anthropologist: "You don't just visit places, you become them.",
    urban_nomad: 'Cities speak to you in neon and noise.',
    wilderness_pioneer: 'WiFi is optional, wilderness is essential.',
    digital_explorer: 'Your laptop is your passport extension.',
    explorer: 'The world is your playground.',
    // CONNECTOR
    social_butterfly: "Every stranger is a friend you haven't met.",
    family_architect: 'Making memories that outlive photo albums.',
    romantic_curator: 'Love is better with a view.',
    story_seeker: "Every person is a book you haven't read yet.",
    // ACHIEVER
    bucket_list_conqueror: 'Life is a checklist of wonders.',
    adrenaline_architect: 'Normal is just a setting on the washing machine.',
    collection_curator: 'Countries collected, stamps earned.',
    status_seeker: "First class isn't a seat, it's a lifestyle.",
    // RESTORER
    zen_seeker: 'Breathe in experience, exhale expectation.',
    retreat_regular: "Wellness isn't a trend, it's a lifestyle.",
    beach_therapist: 'Salt water heals everything.',
    slow_traveler: 'Stay long enough to have a favorite café.',
    escape_artist: 'Sometimes you need to leave to find yourself.',
    // CURATOR
    culinary_cartographer: 'Your passport is basically a menu.',
    art_aficionado: 'Every gallery is a pilgrimage.',
    luxury_luminary: 'Champagne wishes, caviar dreams, economy never.',
    eco_ethicist: 'Leave nothing but footprints.',
    curated_luxe: "You don't travel, you orchestrate experiences.",
    // TRANSFORMER
    gap_year_graduate: 'The world is the ultimate classroom.',
    midlife_explorer: "It's never too late to become who you were meant to be.",
    sabbatical_scholar: 'Taking time off to find time on.',
    healing_journeyer: 'Travel is the medicine for the soul.',
    retirement_ranger: 'Your next chapter deserves the whole world as its backdrop.',
    // CONNECTOR (additional)
    community_builder: 'You travel to connect, contribute, and belong.',
    // RESTORER (additional)
    sanctuary_seeker: 'You seek places that feel like a sacred refuge.',
  };
  return taglines[id] || 'The world awaits your discovery.';
}

function extractEmotionalDrivers(answers: Record<string, string | string[]>): string[] {
  const drivers: string[] = [];
  const style = answers.traveler_type as string || answers.style as string;
  
  // Map quiz traveler_type to emotional drivers
  const driverMap: Record<string, string[]> = {
    // Primary quiz values
    explorer: ['discovery', 'curiosity', 'growth'],
    escape_artist: ['freedom', 'peace', 'renewal'],
    curated_luxe: ['comfort', 'excellence', 'indulgence'],
    story_seeker: ['connection', 'meaning', 'understanding'],
    // Extended archetypes
    cultural_anthropologist: ['discovery', 'authenticity', 'connection'],
    urban_nomad: ['energy', 'discovery', 'social'],
    wilderness_pioneer: ['freedom', 'adventure', 'challenge'],
    digital_explorer: ['flexibility', 'discovery', 'independence'],
    social_butterfly: ['connection', 'joy', 'community'],
    family_architect: ['togetherness', 'memories', 'joy'],
    romantic_curator: ['romance', 'intimacy', 'beauty'],
    bucket_list_conqueror: ['achievement', 'adventure', 'purpose'],
    adrenaline_architect: ['thrill', 'challenge', 'excitement'],
    collection_curator: ['achievement', 'discovery', 'pride'],
    status_seeker: ['prestige', 'comfort', 'recognition'],
    zen_seeker: ['peace', 'mindfulness', 'renewal'],
    retreat_regular: ['wellness', 'balance', 'self-care'],
    beach_therapist: ['relaxation', 'peace', 'simplicity'],
    slow_traveler: ['depth', 'authenticity', 'immersion'],
    culinary_cartographer: ['pleasure', 'discovery', 'culture'],
    art_aficionado: ['beauty', 'inspiration', 'culture'],
    luxury_luminary: ['comfort', 'excellence', 'indulgence'],
    eco_ethicist: ['responsibility', 'authenticity', 'purpose'],
    gap_year_graduate: ['growth', 'discovery', 'transformation'],
    midlife_explorer: ['renewal', 'discovery', 'meaning'],
    sabbatical_scholar: ['learning', 'renewal', 'perspective'],
    healing_journeyer: ['healing', 'transformation', 'peace'],
  };
  
  if (style && driverMap[style]) {
    drivers.push(...driverMap[style]);
  }
  
  // Add interest-based drivers
  const interests = answers.interests as string[] || [];
  if (interests.includes('wellness')) drivers.push('restoration');
  if (interests.includes('adventure')) drivers.push('thrill');
  if (interests.includes('culture')) drivers.push('learning');
  if (interests.includes('food')) drivers.push('pleasure');
  if (interests.includes('nature')) drivers.push('connection');
  
  return [...new Set(drivers)].slice(0, 5);
}

/**
 * Generates a human-readable DNA summary
 */
function generateDNASummary(
  archetype: string,
  traits: string[],
  pace: string
): string {
  const displayName = getArchetypeDisplayName(archetype);
  const paceDescriptor = pace === 'relaxed' ? 'leisurely' : pace === 'active' ? 'action-packed' : 'balanced';
  const traitList = traits.slice(0, 3).join(', ');
  
  return `As ${displayName}, you prefer ${paceDescriptor} travel experiences${
    traitList ? ` with a focus on ${traitList}` : ''
  }. Your travel personality reflects someone who values authentic experiences tailored to your unique preferences.`;
}

/**
 * Saves Travel DNA profile to the database
 */
export async function saveTravelDNA(
  userId: string,
  sessionId: string | null,
  dna: TravelDNAPayload
): Promise<boolean> {
  const payload = {
    user_id: userId,
    session_id: sessionId,
    // Only persist DB-backed fields (avoid 400s from extra UI-only keys)
    primary_archetype_name: dna.primary_archetype_name,
    secondary_archetype_name: dna.secondary_archetype_name,
    dna_confidence_score: dna.dna_confidence_score,
    dna_rarity: dna.dna_rarity,
    trait_scores: dna.trait_scores ? JSON.parse(JSON.stringify(dna.trait_scores)) : null,
    tone_tags: dna.tone_tags ?? null,
    emotional_drivers: dna.emotional_drivers ?? null,
    perfect_trip_preview: (dna as { perfect_trip_preview?: string | null })?.perfect_trip_preview ?? null,
    summary: dna.summary,
    calculated_at: new Date().toISOString(),
  };

  // Try to update first, then insert if not exists
  const { data: existing } = await supabase
    .from('travel_dna_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let error;
  
  if (existing) {
    const result = await supabase
      .from('travel_dna_profiles')
      .update(payload)
      .eq('user_id', userId);
    error = result.error;
  } else {
    const result = await supabase
      .from('travel_dna_profiles')
      .insert(payload);
    error = result.error;
  }

  if (error) {
    console.error('Failed to save travel DNA:', JSON.stringify(error, null, 2));
    return false;
  }

  // Also save to history
  await supabase.from('travel_dna_history').insert([{
    user_id: userId,
    profile_snapshot: JSON.parse(JSON.stringify(dna)) as Json,
    quiz_session_id: sessionId,
  }]);

  return true;
}

// ============================================================================
// COMPLETE QUIZ SUBMISSION
// ============================================================================

/**
 * Complete quiz submission - saves all data to appropriate tables
 */
export async function submitQuizComplete(
  userId: string,
  answers: Record<string, string | string[]>,
  sessionId?: string | null
): Promise<{
  success: boolean;
  preferences: UserPreferencesPayload;
  dna: TravelDNAPayload;
}> {
  try {
    // 0. Fetch existing overrides and preferences BEFORE recalculating
    // This ensures user adjustments are preserved across quiz retakes
    let existingOverrides: Record<string, number> | null = null;
    let existingPreferences: Record<string, unknown> | null = null;
    
    try {
      const [overridesResult, prefsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('travel_dna_overrides')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
      ]);
      
      if (overridesResult.data?.travel_dna_overrides) {
        existingOverrides = overridesResult.data.travel_dna_overrides as Record<string, number>;
        console.log('[Quiz] Found existing trait overrides:', Object.keys(existingOverrides));
      }
      
      if (prefsResult.data) {
        existingPreferences = prefsResult.data as Record<string, unknown>;
        console.log('[Quiz] Found existing preferences');
      }
    } catch (err) {
      console.warn('[Quiz] Could not fetch existing data:', err);
    }
    
    // 1. Map answers to preferences
    const preferences = mapQuizAnswersToPreferences(answers);
    
    // 2. Calculate Travel DNA via backend (with AI-powered Perfect Trip)
    // Pass existing overrides so the edge function can factor them in
    let dna: TravelDNAPayload;
    try {
      dna = await calculateTravelDNAAdvanced(answers, userId, existingOverrides);
    } catch {
      // Fallback to simple calculation if backend fails
      dna = calculateTravelDNA(answers);
    }
    
    // 3. Add traveler type to preferences from DNA
    preferences.traveler_type = dna.primary_archetype_name;
    preferences.emotional_drivers = dna.emotional_drivers;

    // 3b. Seed additional preferences from DNA trait scores
    // This ensures preferences are pre-populated even when quiz questions
    // don't directly map to preference fields
    if (dna.trait_scores) {
      const traits = dna.trait_scores;
      
      // Travel pace: pace trait > 3 = active, < -3 = relaxed, else moderate
      if (!preferences.travel_pace) {
        if (traits.pace >= 3) preferences.travel_pace = 'active';
        else if (traits.pace <= -3) preferences.travel_pace = 'relaxed';
        else preferences.travel_pace = 'moderate';
      }
      
      // Interests from trait scores
      if (!preferences.interests || preferences.interests.length === 0) {
        const seededInterests: string[] = [];
        if (traits.authenticity >= 3) seededInterests.push('local_culture', 'history');
        if (traits.adventure >= 3) seededInterests.push('adventure');
        if (traits.comfort >= 3) seededInterests.push('wellness');
        if (traits.social >= 3) seededInterests.push('nightlife');
        if (traits.authenticity >= 1) seededInterests.push('food_culinary');
        if (traits.adventure <= -2) seededInterests.push('beach_water');
        if (seededInterests.length > 0) preferences.interests = [...new Set(seededInterests)];
      }
      
      // Accommodation style from comfort trait
      if (!preferences.accommodation_style) {
        if (traits.comfort >= 5) preferences.accommodation_style = 'luxury_suites';
        else if (traits.comfort >= 2) preferences.accommodation_style = 'hotels';
        else if (traits.comfort <= -3) preferences.accommodation_style = 'hostels';
        else preferences.accommodation_style = 'vacation_rentals';
      }
      
      // Planning preference from planning trait
      if (!preferences.planning_preference) {
        if (traits.planning >= 4) preferences.planning_preference = 'detailed';
        else if (traits.planning <= -3) preferences.planning_preference = 'spontaneous';
        else preferences.planning_preference = 'flexible';
      }
      
      // Activity level from pace + adventure
      if (!preferences.activity_level) {
        const energyScore = (traits.pace + traits.adventure) / 2;
        if (energyScore >= 3) preferences.activity_level = 'high';
        else if (energyScore <= -2) preferences.activity_level = 'low';
        else preferences.activity_level = 'moderate';
      }
      
      // Social energy from social trait
      if (!preferences.social_energy) {
        if (traits.social >= 3) preferences.social_energy = 'extrovert';
        else if (traits.social <= -3) preferences.social_energy = 'introvert';
        else preferences.social_energy = 'ambivert';
      }
    }

    // 4. Save preferences - MERGE with existing, don't overwrite
    // Only update fields that were explicitly set by the quiz
    const mergedPreferences = existingPreferences
      ? { ...existingPreferences, ...preferences }
      : preferences;
    const prefSuccess = await saveUserPreferences(userId, mergedPreferences as UserPreferencesPayload, true);
    
    // 5. Save Travel DNA
    const dnaSuccess = await saveTravelDNA(userId, sessionId || null, dna);

    // 6. Update quiz session if provided
    if (sessionId) {
      await updateQuizSession(sessionId, {
        status: 'completed',
        completionPercentage: 100,
      });
    }
    
    // 7. Trigger achievement for quiz completion
    try {
      const { checkMilestoneAchievements } = await import('@/services/achievementsAPI');
      await checkMilestoneAchievements('quiz_completed', { 
        archetype: dna.primary_archetype_name,
        sessionId 
      });
    } catch (achievementErr) {
      console.warn('[Quiz] Achievement unlock failed (non-blocking):', achievementErr);
    }

    // 7. Update profiles table with quiz_completed flag and travel_dna
    // IMPORTANT: Preserve existing overrides - do NOT clear them
    try {
      // Create a clean JSON object for travel_dna
      // Dedup guard: ensure secondary !== primary even on quiz completion path
      const quizSecondary = (dna.secondary_archetype_name && dna.secondary_archetype_name !== dna.primary_archetype_name)
        ? dna.secondary_archetype_name
        : null;
      const travelDnaJson = {
        primary_archetype_name: dna.primary_archetype_name || null,
        secondary_archetype_name: quizSecondary,
        dna_confidence_score: dna.dna_confidence_score ?? null,
        dna_rarity: dna.dna_rarity || null,
        trait_scores: dna.trait_scores || {},
        tone_tags: dna.tone_tags || [],
        emotional_drivers: dna.emotional_drivers || [],
        perfect_trip_preview: (dna as { perfect_trip_preview?: string | null })?.perfect_trip_preview ?? null,
        summary: dna.summary || null,
      };
      
      // Note: We explicitly do NOT update travel_dna_overrides here
      // User adjustments are preserved even when retaking the quiz
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          quiz_completed: true,
          travel_dna: travelDnaJson as unknown as Json,
          // travel_dna_overrides: preserved (not touched)
        })
        .eq('id', userId);
        
      if (profileError) {
        console.error('Failed to update profile with travel_dna:', JSON.stringify(profileError, null, 2));
      }
    } catch (profileErr) {
      console.error('Error updating profile:', profileErr);
    }

    return {
      success: prefSuccess && dnaSuccess,
      preferences,
      dna,
    };
  } catch (error) {
    console.error('Failed to submit quiz:', error);
    return {
      success: false,
      preferences: {},
      dna: {},
    };
  }
}

// ============================================================================
// RECALCULATE DNA FROM PREFERENCES
// ============================================================================

/**
 * Reverse mapping: Converts stored preferences back to quiz answer format
 * This allows us to recalculate DNA when preferences are updated
 */
const PREFERENCE_TO_QUIZ_MAP: Record<string, string> = {
  traveler_type: 'traveler_type',
  travel_vibes: 'travel_vibes',
  travel_frequency: 'trip_frequency',
  trip_duration: 'trip_duration',
  budget_tier: 'budget',
  travel_pace: 'pace',
  planning_preference: 'planning_style',
  travel_companions: 'travel_companions',
  preferred_group_size: 'group_size',
  interests: 'interests',
  accommodation_style: 'accommodation',
  hotel_style: 'hotel_style',
  dining_style: 'dining_style',
  dietary_restrictions: 'dietary_restrictions',
  climate_preferences: 'weather_preference',
  primary_goal: 'primaryGoal',
  activity_level: 'activityLevel',
  eco_friendly: 'ecoFriendly',
};

/**
 * Converts stored preferences back to quiz-like answers format
 */
export function preferencesToQuizAnswers(
  preferences: UserPreferencesPayload
): Record<string, string | string[]> {
  const answers: Record<string, string | string[]> = {};
  
  for (const [prefKey, quizKey] of Object.entries(PREFERENCE_TO_QUIZ_MAP)) {
    const value = (preferences as Record<string, unknown>)[prefKey];
    if (value !== null && value !== undefined) {
      // Handle boolean conversions back to strings
      if (prefKey === 'eco_friendly' || prefKey === 'direct_flights_only') {
        answers[quizKey] = value ? 'yes' : 'no';
      } else {
        answers[quizKey] = value as string | string[];
      }
    }
  }
  
  return answers;
}
/**
 * Compute V2 traits directly from stored preferences.
 * Bypasses archetype-matcher (which expects quiz-format answers) to avoid all-zero results.
 */
function computeV2TraitsFromPreferences(preferences: UserPreferencesPayload): Record<string, number> {
  const stringToScore = (val: unknown, mapping: Record<string, number>, defaultVal = 0): number => {
    if (typeof val === 'number') return Math.max(-10, Math.min(10, val));
    if (typeof val === 'string' && val in mapping) return mapping[val];
    return defaultVal;
  };

  const pace = stringToScore(preferences.travel_pace, {
    relaxed: -6, slow: -6, moderate: 0, moderate_pace: 0, active: 5, packed: 7, fast: 7, intense: 8,
  });

  const social = stringToScore(preferences.traveler_type, {
    solo: -5, couple: -2, small_group: 3, family: 4, large_group: 7,
  }) + (preferences.social_energy === 'introvert' ? -3 : preferences.social_energy === 'extrovert' ? 3 : 0);

  const comfort = stringToScore(preferences.budget_tier, {
    budget: -4, moderate: 0, comfort: 3, luxury: 6, ultra_luxury: 9,
  }) + stringToScore(preferences.accommodation_style, {
    hostel: -3, hotel: 0, airbnb: 0, boutique: 2, resort: 4, luxury_cocoon: 5, villa: 4,
  }) * 0.5;

  const adventure = stringToScore(preferences.activity_level, {
    low: -4, moderate: 0, high: 5, extreme: 8,
  });
  // Boost from interests
  const interests = preferences.interests || [];
  const adventureBoost = interests.includes('adventure') || interests.includes('outdoor') ? 3 : 0;

  const authenticity = (interests.includes('culture') || interests.includes('history') ? 4 : 0) +
    (interests.includes('food') || interests.includes('local_cuisine') ? 2 : 0) +
    stringToScore(preferences.dining_style, { local: 3, street_food: 4, fine_dining: 1 }, 0);

  const planning = stringToScore(preferences.planning_preference, {
    meticulous: 7, detailed: 7, balanced: 0, flexible: -5, spontaneous: -7,
  });

  const budget = stringToScore(preferences.budget_tier, {
    budget: -6, moderate: 0, comfort: 3, luxury: 7, ultra_luxury: 10,
  });

  const vibes = preferences.travel_vibes || [];
  const transformation = (vibes.includes('spiritual') || vibes.includes('wellness') ? 4 : 0) +
    (vibes.includes('transformative') || vibes.includes('growth') ? 3 : 0) +
    (interests.includes('wellness') ? 2 : 0);

  return {
    pace: Math.max(-10, Math.min(10, pace)),
    social: Math.max(-10, Math.min(10, social)),
    comfort: Math.max(-10, Math.min(10, comfort)),
    adventure: Math.max(-10, Math.min(10, adventure + adventureBoost)),
    authenticity: Math.max(-10, Math.min(10, authenticity)),
    planning: Math.max(-10, Math.min(10, planning)),
    budget: Math.max(-10, Math.min(10, budget)),
    transformation: Math.max(-10, Math.min(10, transformation)),
  };
}

/**
 * Recalculates Travel DNA from current preferences
 * Use this when preferences are updated outside of the quiz flow
 */
export async function recalculateDNAFromPreferences(
  userId: string
): Promise<{ success: boolean; dna: TravelDNAPayload | null }> {
  try {
    // 1. Fetch current preferences, existing overrides, AND existing DNA in parallel
    // We need the existing DNA so we can preserve the secondary archetype if recalc produces a duplicate
    const [preferences, overridesResult, existingDnaResult] = await Promise.all([
      getUserPreferences(userId),
      supabase
        .from('profiles')
        .select('travel_dna_overrides')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('travel_dna_profiles')
        .select('secondary_archetype_name')
        .eq('user_id', userId)
        .maybeSingle()
    ]);
    const existingSecondary = existingDnaResult.data?.secondary_archetype_name as string | null;
    
    if (!preferences) {
      console.error('No preferences found for user:', userId);
      return { success: false, dna: null };
    }
    
    const existingOverrides = overridesResult.data?.travel_dna_overrides as Record<string, number> | null;
    
    if (existingOverrides && Object.keys(existingOverrides).length > 0) {
      console.log('[DNA Recalc] Preserving existing overrides:', Object.keys(existingOverrides));
    }
    
    // 2. Convert preferences to quiz answer format
    const answers = preferencesToQuizAnswers(preferences);
    
    // 3. Recalculate DNA via backend WITH overrides
    let dna: TravelDNAPayload;
    try {
      dna = await calculateTravelDNAAdvanced(answers, userId, existingOverrides);
    } catch {
      dna = calculateTravelDNA(answers);
    }
    
    // 4. Fix V2 traits if all zero (archetype-matcher failed)
    if (dna.trait_scores) {
      const allZero = Object.values(dna.trait_scores).every(v => v === 0);
      if (allZero) {
        console.warn('[DNA Recalc] All V2 traits are zero — using direct preference mapping');
        const directTraits = computeV2TraitsFromPreferences(preferences);
        dna.trait_scores = directTraits;
      }
    }

    // 4b. ALWAYS re-match archetype from current traits (including overrides).
    // This ensures that when Fine-Tune sliders change the trait profile significantly,
    // the archetype updates to match — preventing the mismatch where trait tags say
    // "Adventurous, Fast-Paced" but the archetype still shows "Luxury Luminary".
    try {
      const { determineArchetype } = await import('@/services/engines/travelDNA/archetype-matcher');
      const flatAnswers: Record<string, string> = {};
      for (const [k, v] of Object.entries(answers)) {
        if (typeof v === 'string') flatAnswers[k] = v;
      }
      const archetypeResult = determineArchetype(flatAnswers);
      const primaryId = archetypeResult.primary?.id || dna.primary_archetype_name || 'cultural_anthropologist';
      // Dedup: if recalc produces the same archetype for both primary and secondary,
      // fall back to the pre-existing secondary to avoid clobbering it
      const candidateSecondary = archetypeResult.secondary?.id || dna.secondary_archetype_name || null;
      const secondaryId = (candidateSecondary && candidateSecondary !== primaryId)
        ? candidateSecondary
        : (existingSecondary && existingSecondary !== primaryId ? existingSecondary : null);

      console.log('[DNA Recalc] Archetype re-match:', primaryId, '| secondary:', secondaryId, '| candidate was:', candidateSecondary);

      dna.primary_archetype_name = primaryId;
      dna.secondary_archetype_name = secondaryId;
      dna.primary_archetype_display = getArchetypeDisplayName(primaryId);
      dna.primary_archetype_category = getArchetypeCategory(primaryId);
      dna.primary_archetype_tagline = getArchetypeTagline(primaryId);
    } catch (matchErr) {
      console.error('[DNA Recalc] Archetype matching failed, keeping edge-function result:', matchErr);
      if (dna.primary_archetype_name) {
        dna.primary_archetype_display = getArchetypeDisplayName(dna.primary_archetype_name);
        dna.primary_archetype_category = getArchetypeCategory(dna.primary_archetype_name);
        dna.primary_archetype_tagline = getArchetypeTagline(dna.primary_archetype_name);
      }
    }
    
    console.log('[DNA Recalc] Final V2 traits:', JSON.stringify(dna.trait_scores));
    
    // 4c. Regenerate tone_tags from final trait scores (including overrides)
    // This ensures trait tags displayed in "Your Travel Traits" always match
    // the actual trait values, not stale quiz-time tags.
    if (dna.trait_scores) {
      const ts = dna.trait_scores as Record<string, number>;
      const freshTags: string[] = [];
      if ((ts.adventure ?? 0) >= 5) freshTags.push('adventurous');
      if ((ts.comfort ?? 0) >= 5) freshTags.push('comfort-seeking');
      if ((ts.authenticity ?? 0) >= 5) freshTags.push('authentic');
      if ((ts.pace ?? 0) <= -3) freshTags.push('slow-paced');
      if ((ts.pace ?? 0) >= 3) freshTags.push('active');
      if ((ts.pace ?? 0) >= 6) freshTags.push('fast-paced');
      if ((ts.transformation ?? 0) >= 5) freshTags.push('transformative');
      if ((ts.social ?? 0) >= 5) freshTags.push('social');
      if ((ts.social ?? 0) <= -3) freshTags.push('introspective');
      if ((ts.budget ?? 0) >= 5) freshTags.push('budget-savvy');
      if ((ts.budget ?? 0) <= -5) freshTags.push('luxury-leaning');
      if ((ts.planning ?? 0) >= 5) freshTags.push('detail-oriented');
      if ((ts.planning ?? 0) <= -3) freshTags.push('spontaneous');
      // Only replace if we generated any tags; otherwise keep existing
      if (freshTags.length > 0) {
        dna.tone_tags = freshTags;
        console.log('[DNA Recalc] Regenerated tone_tags:', freshTags);
      }
    }
    
    // 5. Save the new DNA
    const dnaSuccess = await saveTravelDNA(userId, null, dna);
    
    // 6. Update profiles table with new travel_dna
    try {
      const travelDnaJson = {
        primary_archetype_name: dna.primary_archetype_name || null,
        secondary_archetype_name: dna.secondary_archetype_name || null,
        dna_confidence_score: dna.dna_confidence_score ?? null,
        dna_rarity: dna.dna_rarity || null,
        trait_scores: dna.trait_scores || {},
        tone_tags: dna.tone_tags || [],
        emotional_drivers: dna.emotional_drivers || [],
        perfect_trip_preview: (dna as { perfect_trip_preview?: string | null })?.perfect_trip_preview ?? null,
        summary: dna.summary || null,
      };
      
      await supabase
        .from('profiles')
        .update({ travel_dna: travelDnaJson as unknown as Json })
        .eq('id', userId);
    } catch (profileErr) {
      console.error('Error updating profile travel_dna:', profileErr);
    }
    
    return { success: dnaSuccess, dna };
  } catch (error) {
    console.error('Failed to recalculate DNA from preferences:', error);
    return { success: false, dna: null };
  }
}

// ============================================================================
// DATA RETRIEVAL
// ============================================================================

/**
 * Fetches user preferences from database
 */
export async function getUserPreferences(
  userId: string
): Promise<UserPreferencesPayload | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user preferences:', error);
    return null;
  }

  return data as UserPreferencesPayload | null;
}

/**
 * Fetches Travel DNA profile from database
 */
export async function getTravelDNA(
  userId: string
): Promise<TravelDNAPayload | null> {
  const { data, error } = await supabase
    .from('travel_dna_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch travel DNA:', error);
    return null;
  }

  return data as TravelDNAPayload | null;
}
