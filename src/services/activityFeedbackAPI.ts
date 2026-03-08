import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export type FeedbackRating = 'loved' | 'liked' | 'neutral' | 'disliked';

export interface ActivityFeedback {
  id: string;
  user_id: string;
  trip_id: string;
  activity_id: string;
  rating: FeedbackRating;
  feedback_text: string | null;
  feedback_tags: string[];
  activity_type: string | null;
  activity_category: string | null;
  destination: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFeedbackInput {
  trip_id: string;
  activity_id: string;
  rating: FeedbackRating;
  feedback_text?: string;
  feedback_tags?: string[];
  activity_type?: string;
  activity_category?: string;
  destination?: string;
}

export interface UserPreferenceInsights {
  id: string;
  user_id: string;
  loved_activity_types: Record<string, number>;
  disliked_activity_types: Record<string, number>;
  loved_categories: Record<string, number>;
  disliked_categories: Record<string, number>;
  preferred_times: Record<string, number>;
  preferred_pace: string | null;
  feedback_count: number;
  last_analysis_at: string | null;
  insights_summary: string | null;
  created_at: string;
  updated_at: string;
}

// Feedback tags users can select
export const FEEDBACK_TAGS = {
  positive: [
    'Perfect timing',
    'Great location',
    'Worth the price',
    'Exceeded expectations',
    'Unique experience',
    'Great atmosphere',
    'Friendly staff',
    'Easy to navigate',
    'Good for photos',
    'Would do again'
  ],
  negative: [
    'Too crowded',
    'Too expensive',
    'Not enough time',
    'Hard to find',
    'Underwhelming',
    'Bad timing',
    'Not my style',
    'Too touristy',
    'Skipped it',
    'Would not repeat'
  ]
};

// API Functions
export async function submitActivityFeedback(input: CreateFeedbackInput): Promise<ActivityFeedback> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Use upsert to handle updates to existing feedback
  const { data, error } = await supabase
    .from('activity_feedback')
    .upsert({
      user_id: user.id,
      trip_id: input.trip_id,
      activity_id: input.activity_id,
      rating: input.rating,
      feedback_text: input.feedback_text || null,
      feedback_tags: input.feedback_tags || [],
      activity_type: input.activity_type || null,
      activity_category: input.activity_category || null,
      destination: input.destination || null
    }, {
      onConflict: 'user_id,activity_id'
    })
    .select()
    .single();

  if (error) throw error;
  
  // Trigger preference analysis in background only if save succeeded
  if (data) {
    analyzeUserPreferences().catch(console.error);
  }
  
  return data as ActivityFeedback;
}

export async function getActivityFeedback(activityId: string): Promise<ActivityFeedback | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('activity_feedback')
    .select('*')
    .eq('user_id', user.id)
    .eq('activity_id', activityId)
    .maybeSingle();

  if (error) throw error;
  return data as ActivityFeedback | null;
}

export async function getTripFeedback(tripId: string): Promise<ActivityFeedback[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('activity_feedback')
    .select('*')
    .eq('user_id', user.id)
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ActivityFeedback[];
}

export async function getUserFeedbackHistory(): Promise<ActivityFeedback[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('activity_feedback')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []) as ActivityFeedback[];
}

export async function getUserPreferenceInsights(): Promise<UserPreferenceInsights | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_preference_insights')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data as UserPreferenceInsights | null;
}

// Analyze user preferences based on feedback history
export async function analyzeUserPreferences(): Promise<UserPreferenceInsights | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get all feedback
  const feedback = await getUserFeedbackHistory();
  if (feedback.length === 0) return null;

  // Calculate preference scores
  const lovedTypes: Record<string, number> = {};
  const dislikedTypes: Record<string, number> = {};
  const lovedCategories: Record<string, number> = {};
  const dislikedCategories: Record<string, number> = {};
  const preferredTimes: Record<string, number> = {};

  feedback.forEach(f => {
    const isPositive = f.rating === 'loved' || f.rating === 'liked';
    const isNegative = f.rating === 'disliked';
    const weight = f.rating === 'loved' ? 2 : f.rating === 'disliked' ? -2 : f.rating === 'liked' ? 1 : 0;

    if (f.activity_type) {
      if (isPositive) {
        lovedTypes[f.activity_type] = (lovedTypes[f.activity_type] || 0) + weight;
      } else if (isNegative) {
        dislikedTypes[f.activity_type] = (dislikedTypes[f.activity_type] || 0) + Math.abs(weight);
      }
    }

    if (f.activity_category) {
      if (isPositive) {
        lovedCategories[f.activity_category] = (lovedCategories[f.activity_category] || 0) + weight;
      } else if (isNegative) {
        dislikedCategories[f.activity_category] = (dislikedCategories[f.activity_category] || 0) + Math.abs(weight);
      }
    }
  });

  // Generate insights summary using AI (call edge function)
  let insightsSummary = '';
  try {
    const response = await supabase.functions.invoke('analyze-preferences', {
      body: {
        lovedTypes,
        dislikedTypes,
        lovedCategories,
        dislikedCategories,
        feedbackCount: feedback.length
      }
    });
    if (response.data?.summary) {
      insightsSummary = response.data.summary;
    }
  } catch (e) {
    console.error('Failed to generate insights summary:', e);
    // Fallback to basic summary
    const topLoved = Object.entries(lovedTypes).sort((a, b) => b[1] - a[1])[0];
    const topDisliked = Object.entries(dislikedTypes).sort((a, b) => b[1] - a[1])[0];
    insightsSummary = `Based on ${feedback.length} activities: ${topLoved ? `You love ${topLoved[0]} activities.` : ''} ${topDisliked ? `You tend to skip ${topDisliked[0]} activities.` : ''}`;
  }

  // Upsert insights
  const { data, error } = await supabase
    .from('user_preference_insights')
    .upsert({
      user_id: user.id,
      loved_activity_types: lovedTypes,
      disliked_activity_types: dislikedTypes,
      loved_categories: lovedCategories,
      disliked_categories: dislikedCategories,
      preferred_times: preferredTimes,
      feedback_count: feedback.length,
      last_analysis_at: new Date().toISOString(),
      insights_summary: insightsSummary
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data as UserPreferenceInsights;
}

// React Query Hooks
export function useActivityFeedback(activityId: string | null) {
  return useQuery({
    queryKey: ['activity-feedback', activityId],
    queryFn: () => activityId ? getActivityFeedback(activityId) : null,
    enabled: !!activityId
  });
}

export function useTripFeedback(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-feedback', tripId],
    queryFn: () => tripId ? getTripFeedback(tripId) : [],
    enabled: !!tripId
  });
}

export function useUserPreferenceInsights() {
  return useQuery({
    queryKey: ['user-preference-insights'],
    queryFn: getUserPreferenceInsights
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: submitActivityFeedback,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activity-feedback', data.activity_id] });
      queryClient.invalidateQueries({ queryKey: ['trip-feedback', data.trip_id] });
      queryClient.invalidateQueries({ queryKey: ['user-preference-insights'] });
    }
  });
}

export function useAnalyzePreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: analyzeUserPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preference-insights'] });
    }
  });
}
