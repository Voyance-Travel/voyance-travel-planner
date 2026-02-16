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
  return {
    id,
    title: activity.name,
    description: activity.description || undefined,
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
    tips: activity.notes || undefined,
    isOption: activity.isOption || false,
    optionGroup: activity.optionGroup || undefined,
    source: 'parsed',
  };
}

function convertDay(day: ParsedDay): ItineraryDay {
  // Group activities by optionGroup
  const activities: ItineraryActivity[] = [];
  const processedGroups = new Set<string>();

  for (const activity of day.activities) {
    if (activity.isOption && activity.optionGroup) {
      if (processedGroups.has(activity.optionGroup)) continue;
      processedGroups.add(activity.optionGroup);

      // Find all options in this group
      const groupOptions = day.activities.filter(
        a => a.optionGroup === activity.optionGroup
      );

      // First option becomes primary, rest are alternatives
      const primary = activityToItinerary(groupOptions[0], true);
      if (groupOptions.length > 1) {
        primary.alternativeOptions = groupOptions.slice(1).map(a => ({
          name: a.name,
          notes: a.notes,
        }));
      }
      // Keep isOption and optionGroup for all options so frontend can render "Choose one"
      for (const opt of groupOptions) {
        activities.push(activityToItinerary(opt, false));
      }
      // Remove the duplicates we just added and use the group approach
      // Actually, let's keep all options as separate activities with isOption=true
      // so the frontend can render them as radio groups
      // Remove what we just pushed and re-add properly
    } else {
      activities.push(activityToItinerary(activity, true));
    }
  }

  // Simpler approach: just map all activities, keeping isOption/optionGroup intact
  const simpleActivities = day.activities.map(a => activityToItinerary(a, true));

  return {
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.theme ? `Day ${day.dayNumber} — ${day.theme}` : `Day ${day.dayNumber}`,
    theme: day.theme,
    activities: simpleActivities,
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
