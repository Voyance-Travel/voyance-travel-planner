/**
 * Convert ParsedTripInput into the existing itinerary_data JSONB format
 * and create a trip record in the database.
 */

import { supabase } from '@/integrations/supabase/client';
import { useManualBuilderStore } from '@/stores/manual-builder-store';
import type { ParsedTripInput, ParsedActivity, ParsedDay } from '@/types/parsedTrip';
import { sanitizeAIOutput } from '@/utils/textSanitizer';
import { normalizeTimeTo24h, parseTimeToMinutes } from '@/utils/timeFormat';
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

// Coarse time-of-day labels are what pasted ChatGPT/Claude itineraries actually
// use ("Morning", "Lunch", "Evening") instead of clock times. Map them to
// representative minutes so the converted day has a REAL, sortable schedule.
// Without this, normalizeTimeTo24h('Morning') is undefined → startTime becomes
// the literal word, parseTimeToMinutes('Morning') === 0, and every card
// collapses to minute 0 under an empty band (the "converter was bad" bug).
const TIME_LABEL_MIN: Record<string, number> = {
  'dawn': 420, 'sunrise': 420, 'early morning': 450, 'breakfast': 510,
  'morning': 540, 'mid-morning': 630, 'midmorning': 630, 'brunch': 630, 'late morning': 690,
  'midday': 720, 'noon': 720, 'lunch': 750,
  'early afternoon': 810, 'afternoon': 840, 'mid-afternoon': 900, 'late afternoon': 990,
  'evening': 1110, 'sunset': 1140, 'dusk': 1140, 'golden hour': 1140,
  'dinner': 1170, 'night': 1260, 'late night': 1320, 'nightcap': 1320,
};
const fmHHMM = (mins: number): string =>
  `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

// Defensive cost coercion. The parse-trip-input schema types cost as a number,
// but if a range ("€45–€70") or currency-symbol string ("$30") ever slips
// through, storing it verbatim in estimatedCost.amount makes a genuinely paid
// stop render as "Free". Coerce number|string → number (range → midpoint).
function coerceCostAmount(raw: unknown): number | undefined {
  if (typeof raw === 'number') return isNaN(raw) ? undefined : raw;
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (!/\d/.test(s) && /\b(free|no charge|complimentary|included|gratis|none)\b/i.test(s)) return 0;
  const toNum = (n: string) => parseFloat(n.replace(/,/g, ''));
  const range = s.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:–|—|-|~|\bto\b)\s*[€£$₹¥]?\s*(\d[\d,]*(?:\.\d+)?)/i);
  if (range) return Math.round((toNum(range[1]) + toNum(range[2])) / 2);
  const single = s.match(/\d[\d,]*(?:\.\d+)?/);
  if (single) { const n = toNum(single[0]); if (!isNaN(n)) return n; }
  return undefined;
}

/**
 * Resolve clock times for a day's activities IN ORDER. An explicit clock time
 * is respected as-is; a coarse label is anchored to its band but never moved
 * earlier than the running cursor; an unlabeled stop takes the next slot. The
 * cursor advances ~90 min per stop so cards never stack at one minute.
 */
function assignClockTimes(activities: ParsedActivity[]): string[] {
  let cursor = 8 * 60; // first slot defaults to 08:00 when nothing else signals
  return activities.map((a) => {
    const real = normalizeTimeTo24h(a.time);
    let mins: number;
    if (real) {
      mins = parseTimeToMinutes(real); // explicit clock — honor it verbatim
    } else {
      const base = TIME_LABEL_MIN[String(a.time ?? '').toLowerCase().trim()];
      mins = base != null ? Math.max(base, cursor) : cursor;
    }
    cursor = Math.max(cursor, mins) + 90;
    return fmHHMM(mins);
  });
}

function activityToItinerary(activity: ParsedActivity, isSelected: boolean, clock?: string): ItineraryActivity {
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
    // Prefer the resolved clock; fall back to a real parsed time. Never leak the
    // raw label ("Morning") into startTime — it sorts to 0 and shows as a word.
    startTime: clock || normalizeTimeTo24h(activity.time) || undefined,
    category: mapCategory(activity.category),
    type: mapCategory(activity.category) as any,
    estimatedCost: (() => {
      const amount = coerceCostAmount(activity.cost);
      return amount !== undefined
        ? { amount, currency: activity.currency || 'USD' }
        : undefined;
    })(),
    // Venue Name must be the venue/activity name, not the address — the edit
    // modal's "Venue Name" field reads location.name, and Preview shows both, so
    // duplicating the address into name produced "venue name = address" and a
    // repeated address in Preview. Only fill address when it's a distinct string.
    location: {
      name: activity.name || activity.location || '',
      address: (activity.location && activity.location !== activity.name) ? activity.location : '',
    },
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
  const selected: ParsedActivity[] = [];

  for (const activity of day.activities) {
    if (activity.isOption && activity.optionGroup) {
      // Only include the first option from each group to avoid duplicate slots
      if (seen.has(activity.optionGroup)) continue;
      seen.add(activity.optionGroup);
    }
    selected.push(activity);
  }

  // Resolve real clock times over the kept activities (in paste order) so the
  // day sorts and bands correctly instead of collapsing every card to 00:00.
  const clocks = assignClockTimes(selected);
  const activities = selected.map((activity, i) => activityToItinerary(activity, true, clocks[i]));

  return {
    dayNumber: day.dayNumber,
    date: day.date,
    // Store just the theme as the title — the itinerary renderers already prefix
    // "Day N" themselves, so embedding "Day N:" here produced "Day 1 Day 1: …".
    title: day.theme || undefined,
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
            // Mirror convertDay: drop alternates, then resolve clocks in order so
            // anchor times match the itinerary cards they lock.
            const seenG = new Set<string>();
            const dayActs = (day.activities || []).filter((a) => {
              if (a.isOption && a.optionGroup) { if (seenG.has(a.optionGroup)) return false; seenG.add(a.optionGroup); }
              return true;
            });
            const anchorClocks = assignClockTimes(dayActs);
            dayActs.forEach((activity, i) => {
              userAnchors.push({
                dayNumber: day.dayNumber,
                title: activity.name,
                startTime: anchorClocks[i],
                category: mapCategory(activity.category),
                venueName: activity.location || undefined,
                lockedSource: `manual_paste:${activity.name}`,
                source: 'manual_paste',
                raw: activity.name,
              });
            });
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
        })() as any,
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
