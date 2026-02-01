/**
 * Feedback System Types
 * Defines all types for the contextual feedback collection system
 */

export type FeedbackPromptType = 
  | 'quick_reaction' 
  | 'day_summary' 
  | 'restaurant_specific' 
  | 'departure_summary' 
  | 'one_week_followup';

export type FeedbackQuestionType = 
  | 'emoji_scale' 
  | 'single_select' 
  | 'multi_select' 
  | 'text' 
  | 'activity_pick'
  | 'rating_scale';

export interface FeedbackQuestion {
  id: string;
  text: string;
  type: FeedbackQuestionType;
  options?: string[];
  required: boolean;
}

export interface FeedbackTriggerConfig {
  type: 'time_after_activity' | 'time_of_day' | 'trip_day' | 'days_after_return';
  value: number; // minutes for time_after_activity, hour for time_of_day, day number for trip_day
  conditions?: {
    activity_types?: string[];
    user_opened_activity?: boolean;
    max_prompts_today?: number;
  };
}

export interface FeedbackPrompt {
  id: string;
  prompt_type: FeedbackPromptType;
  name: string;
  description?: string;
  trigger_config: FeedbackTriggerConfig;
  questions: FeedbackQuestion[];
  priority: number;
  archetype_relevance?: string[];
  is_active: boolean;
}

export interface FeedbackResponse {
  id?: string;
  user_id?: string;
  trip_id: string;
  prompt_id?: string;
  prompt_type: FeedbackPromptType;
  activity_id?: string;
  day_number?: number;
  responses: Record<string, unknown>;
  location?: { lat: number; lng: number };
  submitted_at?: string;
  dismissed_at?: string;
}

export interface DaySummary {
  id?: string;
  user_id?: string;
  trip_id: string;
  day_number: number;
  day_date: string;
  pacing_rating?: 'too_rushed' | 'just_right' | 'too_slow';
  highlight_activity_id?: string;
  highlight_text?: string;
  energy_level?: number;
  overall_rating?: number;
  notes?: string;
  weather_experience?: string;
  unexpected_discoveries?: string[];
}

export interface DepartureSummary {
  id?: string;
  user_id?: string;
  trip_id: string;
  archetype_fit?: 'nailed_it' | 'mostly' | 'somewhat' | 'missed_the_mark';
  highlight_activities?: string[];
  would_change?: string[];
  best_meal_activity_id?: string;
  best_experience_activity_id?: string;
  overall_trip_rating?: number;
  would_recommend?: boolean;
  recommend_score?: number;
  final_thoughts?: string;
  suggestions_for_destination?: string;
}

export interface ActivityQualityScore {
  id: string;
  venue_id?: string;
  venue_name: string;
  destination: string;
  category?: string;
  total_ratings: number;
  average_rating?: number;
  rating_distribution: {
    loved: number;
    good: number;
    meh: number;
    skip: number;
  };
  worth_price_score?: number;
  archetype_breakdown: Record<string, { count: number; avg: number }>;
  common_tips?: string[];
}

export interface ArchetypePacingStats {
  id: string;
  archetype: string;
  trip_type?: string;
  total_responses: number;
  pacing_distribution: {
    too_rushed: number;
    just_right: number;
    too_slow: number;
  };
  recommended_adjustment: number;
}

// Context for evaluating feedback triggers
export interface TripContext {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  currentDayNumber: number;
  totalDays: number;
  userArchetype?: string;
  todaysActivities: ActivityContext[];
  recentActivity?: ActivityContext;
}

export interface ActivityContext {
  id: string;
  name: string;
  category?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  completedAt?: Date;
}

// Prompt display context
export interface PromptDisplayContext {
  prompt: FeedbackPrompt;
  activity?: ActivityContext;
  dayNumber?: number;
  tripName?: string;
  destination: string;
}
