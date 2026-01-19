/**
 * Quiz to Database Mapping Layer
 * Maps frontend quiz responses to backend database schema
 * Aligned with backend's user_preferences and related tables
 */

import { supabase } from '@/integrations/supabase/client';
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
  // flight_preferences is multi-select, handled specially in mapQuizAnswersToPreferences
  
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
 * Maps travel style to traveler type archetype
 */
const STYLE_TO_ARCHETYPE: Record<string, string> = {
  'luxury': 'Curated Luxe',
  'adventure': 'Explorer',
  'cultural': 'Story Seeker',
  'relaxation': 'Escape Artist',
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
    
    // Handle flight_preferences multi-select specially
    // Extract individual preferences from the multi-select
    if (questionId === 'flight_preferences' && Array.isArray(value)) {
      // Check for specific preferences in the array
      if (value.includes('direct')) {
        preferences.direct_flights_only = true;
      }
      if (value.includes('window')) {
        preferences.seat_preference = 'window';
      } else if (value.includes('aisle')) {
        preferences.seat_preference = 'aisle';
      }
      if (value.includes('morning')) {
        preferences.flight_time_preference = 'morning';
      } else if (value.includes('evening')) {
        preferences.flight_time_preference = 'evening';
      }
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
 */
export async function calculateTravelDNAAdvanced(
  answers: Record<string, string | string[]>,
  userId?: string
): Promise<TravelDNAPayload> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-travel-dna`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ answers, userId }),
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

  // Determine rarity
  let rarity = 'Common';
  if (toneTags.length >= 4) rarity = 'Rare';
  else if (toneTags.length >= 3) rarity = 'Uncommon';

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
    explorer: 'The Explorer',
    escape_artist: 'The Escape Artist',
    curated_luxe: 'Curated Luxe',
    story_seeker: 'The Story Seeker',
    cultural_anthropologist: 'The Cultural Anthropologist',
    zen_seeker: 'The Zen Seeker',
    slow_traveler: 'The Slow Traveler',
    adrenaline_architect: 'The Adrenaline Architect',
    luxury_luminary: 'The Luxury Luminary',
    culinary_cartographer: 'The Culinary Cartographer',
  };
  return names[id] || 'The Explorer';
}

function getArchetypeCategory(id: string): string {
  const categories: Record<string, string> = {
    explorer: 'EXPLORER',
    escape_artist: 'RESTORER',
    curated_luxe: 'CURATOR',
    story_seeker: 'CONNECTOR',
    cultural_anthropologist: 'EXPLORER',
    zen_seeker: 'RESTORER',
    slow_traveler: 'RESTORER',
    adrenaline_architect: 'ACHIEVER',
    luxury_luminary: 'CURATOR',
    culinary_cartographer: 'CURATOR',
  };
  return categories[id] || 'EXPLORER';
}

function getArchetypeTagline(id: string): string {
  const taglines: Record<string, string> = {
    explorer: 'The world is your playground.',
    escape_artist: 'Sometimes you need to leave to find yourself.',
    curated_luxe: "You don't travel—you orchestrate experiences.",
    story_seeker: "Every person is a book you haven't read yet.",
    cultural_anthropologist: "You don't just visit places, you become them.",
    zen_seeker: 'Breathe in experience, exhale expectation.',
    slow_traveler: 'Stay long enough to have a favorite café.',
    adrenaline_architect: 'Normal is just a setting on the washing machine.',
    luxury_luminary: 'Champagne wishes, caviar dreams, economy never.',
    culinary_cartographer: 'Your passport is basically a menu.',
  };
  return taglines[id] || 'The world awaits your discovery.';
}

function extractEmotionalDrivers(answers: Record<string, string | string[]>): string[] {
  const drivers: string[] = [];
  const style = answers.traveler_type as string || answers.style as string;
  
  const driverMap: Record<string, string[]> = {
    explorer: ['discovery', 'curiosity', 'growth'],
    escape_artist: ['freedom', 'peace', 'renewal'],
    curated_luxe: ['comfort', 'excellence', 'indulgence'],
    story_seeker: ['connection', 'meaning', 'understanding'],
  };
  
  if (style && driverMap[style]) {
    drivers.push(...driverMap[style]);
  }
  
  const interests = answers.interests as string[] || [];
  if (interests.includes('wellness')) drivers.push('restoration');
  if (interests.includes('adventure')) drivers.push('thrill');
  if (interests.includes('culture')) drivers.push('learning');
  
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
    ...dna,
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
    console.error('Failed to save travel DNA:', error);
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
    // 1. Map answers to preferences
    const preferences = mapQuizAnswersToPreferences(answers);
    
    // 2. Calculate Travel DNA via backend (with AI-powered Perfect Trip)
    let dna: TravelDNAPayload;
    try {
      dna = await calculateTravelDNAAdvanced(answers, userId);
    } catch {
      // Fallback to simple calculation if backend fails
      dna = calculateTravelDNA(answers);
    }
    
    // 3. Add traveler type to preferences from DNA
    preferences.traveler_type = dna.primary_archetype_name;
    preferences.emotional_drivers = dna.emotional_drivers;

    // 4. Save preferences
    const prefSuccess = await saveUserPreferences(userId, preferences, true);
    
    // 5. Save Travel DNA
    const dnaSuccess = await saveTravelDNA(userId, sessionId || null, dna);

    // 6. Update quiz session if provided
    if (sessionId) {
      await updateQuizSession(sessionId, {
        status: 'completed',
        completionPercentage: 100,
      });
    }

    // 7. Update profiles table with quiz_completed flag and travel_dna
    try {
      // Create a clean JSON object for travel_dna
      const travelDnaJson = {
        primary_archetype_name: dna.primary_archetype_name || null,
        secondary_archetype_name: dna.secondary_archetype_name || null,
        dna_confidence_score: dna.dna_confidence_score || null,
        dna_rarity: dna.dna_rarity || null,
        trait_scores: dna.trait_scores || {},
        tone_tags: dna.tone_tags || [],
        emotional_drivers: dna.emotional_drivers || [],
        summary: dna.summary || null,
      };
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          quiz_completed: true,
          travel_dna: travelDnaJson as unknown as Json,
        })
        .eq('id', userId);
        
      if (profileError) {
        console.error('Failed to update profile with travel_dna:', profileError);
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
