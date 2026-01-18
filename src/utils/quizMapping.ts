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
  secondary_archetype_name?: string;
  dna_confidence_score?: number;
  dna_rarity?: string;
  trait_scores?: Record<string, number>;
  tone_tags?: string[];
  emotional_drivers?: string[];
  summary?: string;
}

// ============================================================================
// FIELD MAPPINGS
// ============================================================================

/**
 * Maps frontend quiz question IDs to backend database columns
 */
const QUIZ_FIELD_MAP: Record<string, keyof UserPreferencesPayload> = {
  // Current quiz fields
  'style': 'travel_style',
  'budget': 'budget_tier',
  'pace': 'travel_pace',
  'interests': 'interests',
  'accommodation': 'accommodation_style',
  
  // Extended quiz fields (for future expansion)
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
 * Calculates Travel DNA based on quiz answers
 * This is a simplified frontend calculation - the full calculation happens on backend
 */
export function calculateTravelDNA(
  answers: Record<string, string | string[]>
): TravelDNAPayload {
  const style = answers.style as string;
  const interests = answers.interests as string[] || [];
  const pace = answers.pace as string;
  const budget = answers.budget as string;

  // Determine primary archetype from style
  const primaryArchetype = STYLE_TO_ARCHETYPE[style] || 'Explorer';

  // Calculate trait scores based on answers
  const traitScores: Record<string, number> = {
    adventure: style === 'adventure' ? 85 : interests.includes('nature') ? 60 : 30,
    culture: style === 'cultural' ? 85 : interests.includes('art') ? 60 : 30,
    relaxation: style === 'relaxation' ? 85 : pace === 'slow' ? 60 : 30,
    luxury: style === 'luxury' || budget === 'luxury' ? 85 : budget === 'premium' ? 60 : 30,
    social: interests.includes('nightlife') ? 70 : 40,
    culinary: interests.includes('food') ? 80 : 40,
    wellness: interests.includes('wellness') ? 80 : 30,
  };

  // Derive tone tags from high-scoring traits
  const toneTags = Object.entries(traitScores)
    .filter(([, score]) => score >= 60)
    .map(([trait]) => trait);

  // Calculate confidence based on number of questions answered
  const answeredCount = Object.keys(answers).length;
  const confidence = Math.min(100, Math.round((answeredCount / 5) * 100));

  // Determine rarity
  let rarity = 'Common';
  if (toneTags.length >= 4) rarity = 'Unique';
  else if (toneTags.length >= 3) rarity = 'Uncommon';

  // Generate summary
  const summary = generateDNASummary(primaryArchetype, toneTags, pace);

  return {
    primary_archetype_name: primaryArchetype,
    dna_confidence_score: confidence,
    dna_rarity: rarity,
    trait_scores: traitScores,
    tone_tags: toneTags,
    summary,
  };
}

/**
 * Generates a human-readable DNA summary
 */
function generateDNASummary(
  archetype: string,
  traits: string[],
  pace: string
): string {
  const paceDescriptor = pace === 'slow' ? 'leisurely' : pace === 'fast' ? 'action-packed' : 'balanced';
  const traitList = traits.slice(0, 3).join(', ');
  
  return `As a ${archetype}, you prefer ${paceDescriptor} travel experiences${
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
    
    // 2. Calculate Travel DNA
    const dna = calculateTravelDNA(answers);
    
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

    // 7. Update profiles table with quiz_completed flag
    await supabase
      .from('profiles')
      .update({ 
        quiz_completed: true,
        travel_dna: JSON.parse(JSON.stringify(dna)) as Json,
      })
      .eq('id', userId);

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
