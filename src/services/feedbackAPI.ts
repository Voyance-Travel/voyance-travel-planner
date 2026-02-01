/**
 * Feedback System API
 * Handles all feedback-related database operations
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { 
  FeedbackPrompt, 
  FeedbackResponse, 
  DaySummary, 
  DepartureSummary,
  FeedbackPromptType 
} from '@/types/feedback';

// =====================================================
// FETCH PROMPTS
// =====================================================

export async function getActivePrompts(): Promise<FeedbackPrompt[]> {
  const { data, error } = await supabase
    .from('feedback_prompts' as 'activity_feedback')
    .select('*')
    .eq('is_active' as never, true)
    .order('priority' as never, { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as FeedbackPrompt[];
}

export function useActivePrompts() {
  return useQuery({
    queryKey: ['feedback-prompts'],
    queryFn: getActivePrompts,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// =====================================================
// FEEDBACK RESPONSES
// =====================================================

export async function submitFeedbackResponse(input: FeedbackResponse): Promise<FeedbackResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Note: Using type assertion because types may not be regenerated yet
  const insertData = {
    trip_id: input.trip_id,
    prompt_id: input.prompt_id,
    prompt_type: input.prompt_type,
    activity_id: input.activity_id,
    day_number: input.day_number,
    responses: input.responses,
    location: input.location,
    submitted_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('trip_feedback_responses' as 'activity_feedback') // Type workaround
    .insert(insertData as never)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as FeedbackResponse;
}

export async function dismissFeedback(input: { 
  trip_id: string; 
  prompt_id?: string; 
  prompt_type: FeedbackPromptType;
  activity_id?: string;
  day_number?: number;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const insertData = {
    trip_id: input.trip_id,
    prompt_id: input.prompt_id,
    prompt_type: input.prompt_type,
    activity_id: input.activity_id,
    day_number: input.day_number,
    responses: {},
    dismissed_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('trip_feedback_responses' as 'activity_feedback')
    .insert(insertData as never);

  if (error) throw error;
}

export async function getTodaysFeedbackResponses(tripId: string): Promise<FeedbackResponse[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('trip_feedback_responses' as 'activity_feedback')
    .select('*')
    .eq('user_id' as never, user.id)
    .eq('trip_id' as never, tripId)
    .gte('created_at' as never, today.toISOString());

  if (error) throw error;
  return (data || []) as unknown as FeedbackResponse[];
}

export async function getTripFeedbackResponses(tripId: string): Promise<FeedbackResponse[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('trip_feedback_responses' as 'activity_feedback')
    .select('*')
    .eq('user_id' as never, user.id)
    .eq('trip_id' as never, tripId)
    .order('created_at' as never, { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as FeedbackResponse[];
}

export function useTodaysFeedbackResponses(tripId: string | null) {
  return useQuery({
    queryKey: ['todays-feedback', tripId],
    queryFn: () => tripId ? getTodaysFeedbackResponses(tripId) : [],
    enabled: !!tripId,
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: submitFeedbackResponse,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['todays-feedback', data.trip_id] });
      queryClient.invalidateQueries({ queryKey: ['trip-feedback-responses', data.trip_id] });
      queryClient.invalidateQueries({ queryKey: ['day-summaries', data.trip_id] });
    },
  });
}

export function useDismissFeedback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: dismissFeedback,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['todays-feedback', variables.trip_id] });
    },
  });
}

// =====================================================
// DAY SUMMARIES
// =====================================================

export async function getDaySummaries(tripId: string): Promise<DaySummary[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('trip_day_summaries' as 'activity_feedback')
    .select('*')
    .eq('user_id' as never, user.id)
    .eq('trip_id' as never, tripId)
    .order('day_number' as never, { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as DaySummary[];
}

export async function upsertDaySummary(input: DaySummary): Promise<DaySummary> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const upsertData = {
    user_id: user.id,
    trip_id: input.trip_id,
    day_number: input.day_number,
    day_date: input.day_date,
    pacing_rating: input.pacing_rating,
    highlight_activity_id: input.highlight_activity_id,
    highlight_text: input.highlight_text,
    energy_level: input.energy_level,
    overall_rating: input.overall_rating,
    notes: input.notes,
    weather_experience: input.weather_experience,
    unexpected_discoveries: input.unexpected_discoveries,
  };

  const { data, error } = await supabase
    .from('trip_day_summaries' as 'activity_feedback')
    .upsert(upsertData as never, {
      onConflict: 'user_id,trip_id,day_number',
    } as never)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as DaySummary;
}

export function useDaySummaries(tripId: string | null) {
  return useQuery({
    queryKey: ['day-summaries', tripId],
    queryFn: () => tripId ? getDaySummaries(tripId) : [],
    enabled: !!tripId,
  });
}

export function useUpsertDaySummary() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: upsertDaySummary,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['day-summaries', data.trip_id] });
    },
  });
}

// =====================================================
// DEPARTURE SUMMARIES
// =====================================================

export async function getDepartureSummary(tripId: string): Promise<DepartureSummary | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('trip_departure_summaries' as 'activity_feedback')
    .select('*')
    .eq('user_id' as never, user.id)
    .eq('trip_id' as never, tripId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as DepartureSummary | null;
}

export async function upsertDepartureSummary(input: DepartureSummary): Promise<DepartureSummary> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const upsertData = {
    user_id: user.id,
    trip_id: input.trip_id,
    archetype_fit: input.archetype_fit,
    highlight_activities: input.highlight_activities,
    would_change: input.would_change,
    best_meal_activity_id: input.best_meal_activity_id,
    best_experience_activity_id: input.best_experience_activity_id,
    overall_trip_rating: input.overall_trip_rating,
    would_recommend: input.would_recommend,
    recommend_score: input.recommend_score,
    final_thoughts: input.final_thoughts,
    suggestions_for_destination: input.suggestions_for_destination,
  };

  const { data, error } = await supabase
    .from('trip_departure_summaries' as 'activity_feedback')
    .upsert(upsertData as never, {
      onConflict: 'user_id,trip_id',
    } as never)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as DepartureSummary;
}

export function useDepartureSummary(tripId: string | null) {
  return useQuery({
    queryKey: ['departure-summary', tripId],
    queryFn: () => tripId ? getDepartureSummary(tripId) : null,
    enabled: !!tripId,
  });
}

export function useUpsertDepartureSummary() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: upsertDepartureSummary,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['departure-summary', data.trip_id] });
    },
  });
}

// =====================================================
// PROMPT LOG
// =====================================================

export async function logPromptShown(input: {
  trip_id: string;
  prompt_id?: string;
  prompt_type: FeedbackPromptType;
  activity_id?: string;
  day_number?: number;
  action: 'shown' | 'dismissed' | 'completed' | 'expired';
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const logData = {
    user_id: user.id,
    trip_id: input.trip_id,
    prompt_id: input.prompt_id,
    prompt_type: input.prompt_type,
    activity_id: input.activity_id,
    day_number: input.day_number,
    action: input.action,
  };

  await supabase
    .from('feedback_prompt_log' as 'activity_feedback')
    .insert(logData as never);
}
