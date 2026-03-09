/**
 * Travel Guide Service
 * CRUD operations and AI generation for travel guides
 */

import { supabase } from '@/integrations/supabase/client';

export interface TravelGuide {
  id: string;
  user_id: string;
  trip_id: string;
  title: string;
  slug: string;
  content: string;
  cover_image_url: string | null;
  destination: string;
  status: string;
  selected_activities: any;
  selected_photos: string[] | null;
  social_links: any;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface GenerateOptions {
  includeNotes?: boolean;
  includeHotel?: boolean;
  includeFlights?: boolean;
}

export async function generateTravelGuide(
  tripId: string,
  selectedActivityIds: string[],
  options: GenerateOptions = {}
): Promise<{ guideId: string; slug: string; content: string; title: string }> {
  const { data, error } = await supabase.functions.invoke('generate-travel-guide', {
    body: {
      tripId,
      selectedActivityIds,
      includeNotes: options.includeNotes ?? true,
      includeHotel: options.includeHotel ?? true,
      includeFlights: options.includeFlights ?? true,
    },
  });

  if (error) throw error;
  if (data?.error) {
    if (data.error === 'Insufficient credits') {
      throw new Error('INSUFFICIENT_CREDITS');
    }
    throw new Error(data.error);
  }

  return data;
}

export async function getTravelGuide(guideId: string): Promise<TravelGuide | null> {
  const { data, error } = await supabase
    .from('travel_guides')
    .select('*')
    .eq('id', guideId)
    .maybeSingle();

  if (error) throw error;
  return data as TravelGuide | null;
}

export async function getTravelGuideByTrip(tripId: string): Promise<TravelGuide | null> {
  const { data, error } = await supabase
    .from('travel_guides')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as TravelGuide | null;
}

export async function getTravelGuideBySlug(slug: string): Promise<TravelGuide | null> {
  const { data, error } = await supabase
    .from('travel_guides')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data as TravelGuide | null;
}

export async function updateTravelGuide(
  guideId: string,
  updates: Partial<Pick<TravelGuide, 'title' | 'content' | 'social_links' | 'cover_image_url' | 'selected_photos'>>
): Promise<void> {
  const { error } = await supabase
    .from('travel_guides')
    .update(updates)
    .eq('id', guideId);

  if (error) throw error;
}

export async function deleteGuide(guideId: string): Promise<void> {
  const { error } = await supabase
    .from('travel_guides')
    .delete()
    .eq('id', guideId);

  if (error) throw error;
}

export async function publishTravelGuide(guideId: string): Promise<void> {
  const { error } = await supabase
    .from('travel_guides')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', guideId);

  if (error) throw error;
}
