/**
 * Trip Learnings API
 * Handles post-trip retrospectives and continuous learning
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export type PacingFeedback = 'too_rushed' | 'perfect' | 'too_slow' | 'varied_needs';
export type AccommodationFeedback = 'loved_it' | 'good_location' | 'would_change' | 'too_far';
export type BestTimeOfDay = 'morning_person' | 'afternoon_explorer' | 'evening_adventurer' | 'flexible';

export interface TripHighlight {
  category: string;
  activity: string;
  why: string;
}

export interface PainPoint {
  issue: string;
  context?: string;
  solution?: string;
}

export interface SkippedActivity {
  activity: string;
  reason: string;
  replacement?: string;
}

export interface TripLearning {
  id: string;
  user_id: string;
  trip_id: string;
  destination: string | null;
  overall_rating: number | null;
  would_return: boolean | null;
  highlights: TripHighlight[];
  pacing_feedback: PacingFeedback | null;
  accommodation_feedback: AccommodationFeedback | null;
  pain_points: PainPoint[];
  skipped_activities: SkippedActivity[];
  discovered_likes: string[] | null;
  discovered_dislikes: string[] | null;
  lessons_summary: string | null;
  travel_party_notes: string | null;
  best_time_of_day: BestTimeOfDay | null;
  would_change: string | null;
  tips_for_others: string | null;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTripLearningInput {
  trip_id: string;
  destination?: string;
  overall_rating?: number;
  would_return?: boolean;
  highlights?: TripHighlight[];
  pacing_feedback?: PacingFeedback;
  accommodation_feedback?: AccommodationFeedback;
  pain_points?: PainPoint[];
  skipped_activities?: SkippedActivity[];
  discovered_likes?: string[];
  discovered_dislikes?: string[];
  travel_party_notes?: string;
  best_time_of_day?: BestTimeOfDay;
  would_change?: string;
  tips_for_others?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get trip learnings for a specific trip
 */
export async function getTripLearning(tripId: string): Promise<TripLearning | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('trip_learnings')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[TripLearnings] Error fetching:', error);
    return null;
  }

  if (!data) return null;

  // Parse JSON fields
  return {
    ...data,
    highlights: (data.highlights as unknown as TripHighlight[]) || [],
    pain_points: (data.pain_points as unknown as PainPoint[]) || [],
    skipped_activities: (data.skipped_activities as unknown as SkippedActivity[]) || [],
  } as TripLearning;
}

/**
 * Get all trip learnings for the current user (for AI context)
 */
export async function getUserTripLearnings(limit = 5): Promise<TripLearning[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('trip_learnings')
    .select('*')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[TripLearnings] Error fetching all:', error);
    return [];
  }

  return (data || []).map(d => ({
    ...d,
    highlights: (d.highlights as unknown as TripHighlight[]) || [],
    pain_points: (d.pain_points as unknown as PainPoint[]) || [],
    skipped_activities: (d.skipped_activities as unknown as SkippedActivity[]) || [],
  })) as TripLearning[];
}

/**
 * Submit or update trip learnings
 */
export async function submitTripLearning(input: CreateTripLearningInput): Promise<TripLearning> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Upsert the learning
  const { data, error } = await supabase
    .from('trip_learnings')
    .upsert({
      user_id: user.id,
      trip_id: input.trip_id,
      destination: input.destination || null,
      overall_rating: input.overall_rating || null,
      would_return: input.would_return ?? null,
      highlights: (input.highlights || []) as unknown as Record<string, unknown>[],
      pacing_feedback: input.pacing_feedback || null,
      accommodation_feedback: input.accommodation_feedback || null,
      pain_points: (input.pain_points || []) as unknown as Record<string, unknown>[],
      skipped_activities: (input.skipped_activities || []) as unknown as Record<string, unknown>[],
      discovered_likes: input.discovered_likes || null,
      discovered_dislikes: input.discovered_dislikes || null,
      travel_party_notes: input.travel_party_notes || null,
      best_time_of_day: input.best_time_of_day || null,
      would_change: input.would_change || null,
      tips_for_others: input.tips_for_others || null,
      completed_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,trip_id'
    })
    .select()
    .single();

  if (error) throw error;

  // Generate AI summary in background
  generateLearningsSummary(input.trip_id).catch(console.error);

  return {
    ...data,
    highlights: (data.highlights as unknown as TripHighlight[]) || [],
    pain_points: (data.pain_points as unknown as PainPoint[]) || [],
    skipped_activities: (data.skipped_activities as unknown as SkippedActivity[]) || [],
  } as TripLearning;
}

/**
 * Generate AI summary of trip learnings for future prompts
 */
export async function generateLearningsSummary(tripId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('summarize-trip-learnings', {
      body: { tripId }
    });

    if (error) throw error;
    return data?.summary || null;
  } catch (err) {
    console.error('[TripLearnings] Summary generation failed:', err);
    return null;
  }
}

/**
 * Get compiled learnings for AI prompt (used by generate-itinerary)
 */
export async function getCompiledLearningsForPrompt(): Promise<string> {
  const learnings = await getUserTripLearnings(3); // Last 3 trips
  if (learnings.length === 0) return '';

  const sections: string[] = [];

  learnings.forEach((l, idx) => {
    const tripSection: string[] = [];
    
    if (l.destination) {
      tripSection.push(`Past trip to ${l.destination}:`);
    }

    // Positive learnings
    if (l.highlights && l.highlights.length > 0) {
      const highlights = l.highlights
        .slice(0, 2)
        .map(h => `${h.activity} (${h.why})`)
        .join(', ');
      tripSection.push(`  ✓ Loved: ${highlights}`);
    }

    // What to avoid
    if (l.pain_points && l.pain_points.length > 0) {
      const issues = l.pain_points
        .slice(0, 2)
        .map(p => `${p.issue}${p.solution ? ` → ${p.solution}` : ''}`)
        .join('; ');
      tripSection.push(`  ✗ Avoid: ${issues}`);
    }

    // Pacing insights
    if (l.pacing_feedback) {
      const pacingMap: Record<PacingFeedback, string> = {
        'too_rushed': 'prefers slower pace with fewer activities',
        'perfect': 'current pacing works well',
        'too_slow': 'enjoys action-packed days',
        'varied_needs': 'needs variety in daily intensity'
      };
      tripSection.push(`  📊 ${pacingMap[l.pacing_feedback]}`);
    }

    // Discovered preferences
    if (l.discovered_likes && l.discovered_likes.length > 0) {
      tripSection.push(`  💡 Discovered loves: ${l.discovered_likes.slice(0, 3).join(', ')}`);
    }
    if (l.discovered_dislikes && l.discovered_dislikes.length > 0) {
      tripSection.push(`  ⚠️ Discovered dislikes: ${l.discovered_dislikes.slice(0, 3).join(', ')}`);
    }

    // AI summary (most valuable)
    if (l.lessons_summary) {
      tripSection.push(`  📝 Key insight: ${l.lessons_summary}`);
    }

    if (tripSection.length > 1) {
      sections.push(tripSection.join('\n'));
    }
  });

  if (sections.length === 0) return '';

  return `\n## 🔄 LEARNINGS FROM PAST TRIPS\nApply these lessons to avoid repeating mistakes:\n${sections.join('\n\n')}`;
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useTripLearning(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip-learning', tripId],
    queryFn: () => tripId ? getTripLearning(tripId) : null,
    enabled: !!tripId,
  });
}

export function useUserTripLearnings(limit = 5) {
  return useQuery({
    queryKey: ['user-trip-learnings', limit],
    queryFn: () => getUserTripLearnings(limit),
  });
}

export function useSubmitTripLearning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitTripLearning,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trip-learning', data.trip_id] });
      queryClient.invalidateQueries({ queryKey: ['user-trip-learnings'] });
    },
  });
}
