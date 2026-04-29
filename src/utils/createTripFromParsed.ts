/**
 * Convert ParsedTripInput into the existing itinerary_data JSONB format
 * and create a trip record in the database.
 */

import { supabase } from '@/integrations/supabase/client';
import { useManualBuilderStore } from '@/stores/manual-builder-store';
import type { ParsedTripInput, ParsedActivity, ParsedDay } from '@/types/parsedTrip';
import { sanitizeAIOutput } from '@/utils/textSanitizer';
import { normalizeTimeTo24h } from '@/utils/timeFormat';
import { buildUserAnchors, type UserAnchor } from '@/utils/userAnchors';

interface ItineraryActivity {
  id: string;
  name: string;
  title?: string;
  description?: string;
  startTime?: string;
  duration?: string;
  category?: string;
  type?: string;
  estimatedCost?: { amount: number; currency: string };
  location?: { name?: string; address?: string };
  coordinates?: null;
  venue?: null;
  tags?: string[];
  bookingRequired?: boolean;
  tips?: string;
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
    .filter(Boolean).join(', ') || undefined;

  return {
    id,
    name: activity.name,
    title: activity.name, // keep for backward compat
    description: combinedDescription,
    startTime: normalizeTimeTo24h(activity.time) || activity.time || undefined,
    category: mapCategory(activity.category),
    type: mapCategory(activity.category) as any,
    estimatedCost: activity.cost !== undefined
      ? { amount: activity.cost, currency: activity.currency || 'USD' }
      : undefined,
    location: activity.location
      ? { name: activity.location, address: activity.location }
      : { name: '', address: '' },
    coordinates: null,
    venue: null,
    bookingRequired: activity.bookingRequired || false,
    source: 'parsed',
    // Manual paste / Build It Myself items are user-told content — lock them
    // so AI/cleanup never silently drops, renames, or moves them.
    locked: true,
    isLocked: true,
    lockedSource: `manual_paste:${activity.name}`,
    anchorSource: 'manual_paste',
  } as ItineraryActivity & {
    locked: boolean;
    isLocked: boolean;
    lockedSource: string;
    anchorSource: string;
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
    title: day.theme ? `Day ${day.dayNumber}: ${day.theme}` : `Day ${day.dayNumber}`,
    theme: day.theme,
    activities,
    metadata: day.dailyBudget ? { dailyBudget: day.dailyBudget } : undefined,
  };
}

export function convertParsedToItineraryData(parsed: ParsedTripInput & { detectedCurrency?: string }) {
  const days = parsed.days.map(convertDay);
  const currency = (parsed as any).detectedCurrency || inferCurrencyFromDestination(parsed.destination || '');

  return {
    days,
    // Store currency in overview so EditorialItinerary can find it
    overview: {
      currency,
    },
    // Persist parsed preferences so buildResearchContext (enrich-manual-trip) can read them
    preferences: parsed.preferences || undefined,
    metadata: {
      source: 'manual_paste',
      currency,
      accommodationNotes: parsed.accommodationNotes || [],
      practicalTips: parsed.practicalTips || [],
      unparsed: parsed.unparsed || [],
      parsedAt: new Date().toISOString(),
    },
  };
}

/** Map a destination string to its canonical currency code (mirrors the edge function logic). */
function inferCurrencyFromDestination(destination: string): string {
  const d = destination.toLowerCase();
  const usStates = ['texas','california','new york','florida','illinois','washington',
    'colorado','georgia','tennessee','oregon','nevada','arizona','ohio','michigan',
    'massachusetts','pennsylvania','virginia','north carolina','south carolina'];
  const usAbbr = [', tx',', ca',', ny',', fl',', il',', wa',', co',', ga',
    ', tn',', or',', nv',', az',', oh',', mi',', ma',', pa',', va',', nc',', sc'];
  const usCities = ['austin','nashville','denver','portland','seattle','chicago',
    'los angeles','san francisco','new orleans','miami','boston','atlanta',
    'dallas','houston','phoenix','philadelphia','las vegas','san diego'];
  if ([...usStates,...usAbbr,...usCities,'united states',', usa',', us'].some(x => d.includes(x))) return 'USD';
  if (['canada','toronto','vancouver','montreal'].some(x => d.includes(x))) return 'CAD';
  if (['united kingdom','england','scotland','london','manchester',', uk'].some(x => d.includes(x))) return 'GBP';
  if (['france','germany','spain','italy','portugal','netherlands','belgium','austria',
       'greece','ireland','paris','berlin','madrid','rome','amsterdam','lisbon','vienna',
       'athens','dublin','europe'].some(x => d.includes(x))) return 'EUR';
  if (['japan','tokyo','osaka','kyoto'].some(x => d.includes(x))) return 'JPY';
  if (['australia','sydney','melbourne','brisbane'].some(x => d.includes(x))) return 'AUD';
  if (['mexico','cancun','tulum','oaxaca'].some(x => d.includes(x))) return 'MXN';
  return 'USD'; // Default to USD
}

export async function createTripFromParsed(
  parsed: ParsedTripInput & { detectedCurrency?: string },
  userId: string
): Promise<{ tripId: string } | { error: string }> {
  try {
    const rawDestination = sanitizeAIOutput(parsed.destination) || 'Unknown';
    // Strip IANA timezone identifiers the AI sometimes appends (e.g. "Barcelona Africa/Casablanca")
    const destination = rawDestination.replace(/\s+[A-Z][a-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?/g, '').trim() || 'Unknown';
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

    // Use the currency the edge function resolved from the destination,
    // falling back to our own inference so US trips always get USD.
    const tripCurrency = parsed.detectedCurrency || inferCurrencyFromDestination(destination);

    const today = new Date().toISOString().split('T')[0];
    const startDate = parsed.dates?.start || today;

    // Calculate end_date from start_date + (num_days - 1).
    // This prevents the parser from using "end of month" when the user
    // said e.g. "3 days in March" (parsed.dates.end would be Mar 31, wrong).
    let endDate = parsed.dates?.end || today;
    const numDays = parsed.duration ?? parsed.days?.length ?? 0;
    if (numDays > 0 && startDate) {
      const [y, m, d] = startDate.split('-').map(Number);
      const computed = new Date(y, m - 1, d + numDays - 1);
      const computedStr = computed.toISOString().split('T')[0];
      // Always trust computed end over what the AI returned
      endDate = computedStr;
    }

    // Get user's current plan tier for ownership tracking (same as voyanceAPI.createTrip)
    let ownerPlanTier = 'free';
    try {
      const { data: entitlements } = await supabase.functions.invoke('get-entitlements');
      ownerPlanTier = entitlements?.plans?.[0] || 'free';
    } catch { /* fallback to free */ }

    const { data: trip, error } = await supabase
      .from('trips')
      .insert({
        user_id: userId,
        name: tripName,
        destination,
        start_date: startDate,
        end_date: endDate,
        travelers: parsed.travelers || 1,
        trip_type: parsed.tripType || 'leisure',
        budget_tier: budgetTier,
        status: 'draft',
        creation_source: 'manual_paste',
        is_multi_city: false,
        owner_plan_tier: ownerPlanTier,
        itinerary_data: itineraryData as any,
        // Manual trips: unlock ALL days — user's own content is free
        unlocked_day_count: parsed.days.length,
        metadata: (() => {
          // Treat every parsed activity as a user anchor.
          const userAnchors: UserAnchor[] = [];
          for (const day of parsed.days || []) {
            for (const activity of (day.activities || [])) {
              if (activity.isOption && activity.optionGroup) continue; // skip alternates
              userAnchors.push({
                dayNumber: day.dayNumber,
                title: activity.name,
                startTime: normalizeTimeTo24h(activity.time) || activity.time || undefined,
                category: mapCategory(activity.category),
                venueName: activity.location || undefined,
                lockedSource: `manual_paste:${activity.name}`,
                source: 'manual_paste',
                raw: activity.name,
              });
            }
          }
          return {
            source: 'manual_paste',
            currency: tripCurrency,
            userAnchors: userAnchors.length > 0 ? userAnchors : null,
            lastUpdated: new Date().toISOString(),
            ...(parsed.preferences ? {
              userConstraints: {
                dietary: parsed.preferences.dietary || [],
                avoid: parsed.preferences.avoid || [],
                focus: parsed.preferences.focus || [],
                pace: parsed.preferences.pace || undefined,
                budgetLevel: parsed.preferences.budgetLevel || undefined,
              },
              rawPreferenceText: parsed.preferences.rawPreferenceText || undefined,
            } : {}),
          };
        })(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[createTripFromParsed] Insert failed:', error);
      return { error: error.message };
    }

    // Insert single trip_cities row for unified schema
    const numDaysComputed = parsed.days?.length || 1;
    await supabase.from('trip_cities').insert({
      trip_id: trip.id,
      city_order: 0,
      city_name: destination,
      arrival_date: startDate,
      departure_date: endDate,
      nights: Math.max(1, numDaysComputed - 1),
      generation_status: 'pending',
      days_total: numDaysComputed,
    } as any).then(({ error: cityErr }) => {
      if (cityErr) console.error('[createTripFromParsed] trip_cities insert failed:', cityErr);
    });

    // Enable manual builder mode
    useManualBuilderStore.getState().enableManualBuilder(trip.id);

    return { tripId: trip.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[createTripFromParsed] Exception:', err);
    return { error: message };
  }
}
