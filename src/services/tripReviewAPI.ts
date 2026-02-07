/**
 * Trip Review API
 * Rich multi-dimension reviews for completed trips
 */
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface TripReview {
  id: string;
  user_id: string;
  trip_id: string;
  overall_rating: number;
  value_rating: number | null;
  experience_rating: number | null;
  location_rating: number | null;
  food_rating: number | null;
  highlight_label: string | null;
  highlight_text: string | null;
  review_text: string | null;
  photo_url: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface UpsertTripReviewInput {
  trip_id: string;
  overall_rating: number;
  value_rating?: number | null;
  experience_rating?: number | null;
  location_rating?: number | null;
  food_rating?: number | null;
  highlight_label?: string | null;
  highlight_text?: string | null;
  review_text?: string | null;
  photo_url?: string | null;
  tags?: string[];
}

export const REVIEW_HIGHLIGHT_OPTIONS = [
  'Best meal',
  'Best view',
  'Hidden gem',
  'Most fun',
  'Most relaxing',
  'Best culture',
  'Skip next time',
  'Must revisit',
];

export const REVIEW_TAGS = [
  'Worth every penny',
  'Overrated',
  'Hidden gem',
  'Great for couples',
  'Family friendly',
  'Solo traveler approved',
  'Foodie paradise',
  'Instagram worthy',
  'Off the beaten path',
  'Bucket list checked',
];

export async function upsertTripReview(input: UpsertTripReviewInput): Promise<TripReview> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('trip_reviews' as 'activity_feedback')
    .upsert({
      user_id: user.id,
      trip_id: input.trip_id,
      overall_rating: input.overall_rating,
      value_rating: input.value_rating ?? null,
      experience_rating: input.experience_rating ?? null,
      location_rating: input.location_rating ?? null,
      food_rating: input.food_rating ?? null,
      highlight_label: input.highlight_label ?? null,
      highlight_text: input.highlight_text ?? null,
      review_text: input.review_text ?? null,
      photo_url: input.photo_url ?? null,
      tags: input.tags ?? [],
    } as never, {
      onConflict: 'user_id,trip_id',
    } as never)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TripReview;
}

export async function getTripReview(tripId: string): Promise<TripReview | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('trip_reviews' as 'activity_feedback')
    .select('*')
    .eq('user_id' as never, user.id)
    .eq('trip_id' as never, tripId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as TripReview | null;
}

export async function getAllTripReviews(): Promise<TripReview[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('trip_reviews' as 'activity_feedback')
    .select('*')
    .eq('user_id' as never, user.id)
    .order('created_at' as never, { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as TripReview[];
}

// Hooks
export function useTripReview(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-review', tripId],
    queryFn: () => tripId ? getTripReview(tripId) : null,
    enabled: !!tripId,
  });
}

export function useAllTripReviews() {
  return useQuery({
    queryKey: ['all-trip-reviews'],
    queryFn: getAllTripReviews,
  });
}

export function useUpsertTripReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upsertTripReview,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trip-review', data.trip_id] });
      queryClient.invalidateQueries({ queryKey: ['all-trip-reviews'] });
    },
  });
}
