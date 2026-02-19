/**
 * Convert ParsedTripInput into the existing itinerary_data JSONB format
 * and create a trip record in the database.
 */

import { supabase } from '@/integrations/supabase/client';
import { useManualBuilderStore } from '@/stores/manual-builder-store';
import type { ParsedTripInput, ParsedActivity, ParsedDay } from '@/types/parsedTrip';

interface ItineraryActivity {
  id: string;
  title: string;
  description?: string;
  startTime?: string;
  time?: string;
  duration?: string;
  category?: string;
  type?: string;
  cost?: { amount: number; currency: string };
  location?: { name?: string; address?: string };
  tags?: string[];
  bookingRequired?: boolean;
  tips?: string;
  isOption?: boolean;
  optionGroup?: string;
  alternativeOptions?: Array<{ name: string; notes?: string }>;
  source: string;
}

interface ItineraryDay {
  dayNumber: number;
  date?: string;
  title?: string;
  theme?: string;
  activities: ItineraryActivity[];
  metadata?: Record<string, unknown>;
}

function mapCategory(cat?: string): string {
  const mapping: Record<string, string> = {
    dining: 'dining',
    attraction: 'sightseeing',
    activity: 'activity',
    transport: 'transportation',
    lodging: 'accommodation',
    shopping: 'shopping',
    nightlife: 'activity',
    relaxation: 'relaxation',
    cultural: 'cultural',
  };
  return mapping[cat || ''] || 'activity';
}

function activityToItinerary(activity: ParsedActivity, isSelected: boolean): ItineraryActivity {
  const id = crypto.randomUUID();
  // Merge notes into description — do NOT set `tips` as that triggers VoyanceInsight badges
  // which are meant only for AI-generated content, not user's raw research notes
  const combinedDescription = [activity.description, activity.notes]
    .filter(Boolean).join(' — ') || undefined;

  return {
    id,
    title: activity.name,
    description: combinedDescription,
    startTime: activity.time || undefined,
    time: activity.time || undefined,
    category: mapCategory(activity.category),
    type: mapCategory(activity.category) as any,
    cost: activity.cost !== undefined
      ? { amount: activity.cost, currency: activity.currency || 'USD' }
      : undefined,
    location: activity.location
      ? { name: activity.location, address: activity.location }
      : { name: '', address: '' },
    bookingRequired: activity.bookingRequired || false,
    // Do NOT set tips — that renders "Voyance Insight" badges meant for AI content
    // Do NOT set isOption/optionGroup — that renders "choose one" UI blocks
    // User's raw research should just be a flat list; Smart Finish (generate-itinerary) will curate
    source: 'parsed',
  };
}

function convertDay(day: ParsedDay): ItineraryDay {
  // Flat map — option groups are collapsed to just the first option per group.
  // The "choose one" UI is intentionally NOT rendered for parsed activities;
  // Smart Finish (generate-itinerary) will curate the best single recommendation.
  const seen = new Set<string>();
  const activities: ItineraryActivity[] = [];

  for (const activity of day.activities) {
    if (activity.isOption && activity.optionGroup) {
      // Only include the first option from each group to avoid duplicate slots
      if (seen.has(activity.optionGroup)) continue;
      seen.add(activity.optionGroup);
    }
    activities.push(activityToItinerary(activity, true));
  }

  return {
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.theme ? `Day ${day.dayNumber} — ${day.theme}` : `Day ${day.dayNumber}`,
    theme: day.theme,
    activities,
    metadata: day.dailyBudget ? { dailyBudget: day.dailyBudget } : undefined,
  };
}

export function convertParsedToItineraryData(parsed: ParsedTripInput) {
  const days = parsed.days.map(convertDay);

  return {
    days,
    metadata: {
      source: 'manual_paste',
      accommodationNotes: parsed.accommodationNotes || [],
      practicalTips: parsed.practicalTips || [],
      unparsed: parsed.unparsed || [],
      parsedAt: new Date().toISOString(),
    },
  };
}

export async function createTripFromParsed(
  parsed: ParsedTripInput,
  userId: string
): Promise<{ tripId: string } | { error: string }> {
  try {
    const destination = parsed.destination || 'Unknown';
    const tripName = `Trip to ${destination}`;
    const itineraryData = convertParsedToItineraryData(parsed);

    // Determine budget tier from preferences
    let budgetTier = 'moderate';
    if (parsed.preferences?.budgetLevel) {
      const mapping: Record<string, string> = {
        'budget': 'budget',
        'mid-range': 'moderate',
        'luxury': 'luxury',
      };
      budgetTier = mapping[parsed.preferences.budgetLevel] || 'moderate';
    }

    const { data: trip, error } = await supabase
      .from('trips')
      .insert({
        user_id: userId,
        name: tripName,
        destination,
        start_date: parsed.dates?.start || new Date().toISOString().split('T')[0],
        end_date: parsed.dates?.end || new Date().toISOString().split('T')[0],
        travelers: parsed.travelers || 1,
        trip_type: parsed.tripType || 'leisure',
        budget_tier: budgetTier,
        status: 'draft',
        creation_source: 'manual_paste',
        itinerary_data: itineraryData as any,
        // Manual trips: unlock ALL days — user's own content is free
        unlocked_day_count: parsed.days.length,
        metadata: {
          source: 'manual_paste',
          lastUpdated: new Date().toISOString(),
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('[createTripFromParsed] Insert failed:', error);
      return { error: error.message };
    }

    // Enable manual builder mode
    useManualBuilderStore.getState().enableManualBuilder(trip.id);

    return { tripId: trip.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[createTripFromParsed] Exception:', err);
    return { error: message };
  }
}
