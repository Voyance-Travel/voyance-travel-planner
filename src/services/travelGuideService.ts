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

  // Mirror into community_guides so the guide appears in the community browse.
  // Failure here must NOT block the publish success path — log + continue.
  try {
    const { data: guide } = await supabase
      .from('travel_guides')
      .select('*')
      .eq('id', guideId)
      .maybeSingle();

    if (!guide) return;

    let tripCountry: string | null = null;
    if (guide.trip_id) {
      const { data: trip } = await supabase
        .from('trips')
        .select('destination_country')
        .eq('id', guide.trip_id)
        .maybeSingle();
      tripCountry = trip?.destination_country ?? null;
    }

    await mirrorToCommunityGuides(guide as TravelGuide, tripCountry);
  } catch (err) {
    console.warn('[travel_guide] mirror to community_guides failed', err);
  }
}

/** Build a short description from markdown content (strip headings, ~280 char cap). */
function deriveDescriptionFromMarkdown(md: string): string {
  if (!md) return '';
  const firstPara = md
    .split(/\n{2,}/)
    .map(s => s.trim())
    .find(s => s && !s.startsWith('#') && !s.startsWith('!['));
  const text = (firstPara || md).replace(/[#*_`>\[\]()!]/g, '').replace(/\s+/g, ' ').trim();
  return text.length > 280 ? text.slice(0, 277) + '...' : text;
}

/**
 * Upsert a community_guides row mirroring the travel_guides record.
 * Keyed on slug (unique on community_guides).
 */
async function mirrorToCommunityGuides(
  guide: TravelGuide,
  tripCountry: string | null
): Promise<void> {
  const photos = Array.isArray(guide.selected_photos) ? guide.selected_photos : [];
  const social = (guide.social_links && typeof guide.social_links === 'object')
    ? guide.social_links
    : {};

  const payload = {
    user_id: guide.user_id,
    trip_id: guide.trip_id,
    title: guide.title,
    description: deriveDescriptionFromMarkdown(guide.content),
    destination: guide.destination || null,
    destination_country: tripCountry,
    cover_image_url: guide.cover_image_url,
    slug: guide.slug,
    status: 'published' as const,
    // moderation_status defaults to 'approved' on the table; AI-generated guides bypass review.
    content: {
      markdown: guide.content,
      photos,
      social_links: social,
      source: 'travel_guides',
      travel_guide_id: guide.id,
    },
    tags: [] as string[],
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // @ts-ignore - moderation_status not in generated types
  const { error } = await supabase
    .from('community_guides')
    .upsert(payload, { onConflict: 'slug' });

  if (error) throw error;
}
