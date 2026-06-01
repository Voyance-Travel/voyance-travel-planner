/**
 * trip-facts.ts — Phase A of the pipeline rebuild (see .lovable/plan.md).
 *
 * Pure orchestration over existing resolvers. NO new business logic:
 *   - loadTravelerProfile  (generate-itinerary/profile-loader.ts)
 *   - getFlightHotelContext (generate-itinerary/flight-hotel-context.ts)
 *   - mergePreferenceSources (_shared/preference-spine.ts)
 *   - deriveMealPolicy (generate-itinerary/meal-policy.ts)
 *
 * Single read of `trips` for the trip-level fields. Per-day `mealPolicy`
 * is exposed as a memoized thunk so callers can cheaply derive policy
 * without re-fetching the trip row.
 *
 * NOT YET WIRED into any handler. Phase B will call this from
 * action-generate-trip-day-v2.ts. Until then, this module is additive.
 */

import { loadTravelerProfile, type TravelerProfile, type BudgetTier } from '../generate-itinerary/profile-loader.ts';
import { getFlightHotelContext, type FlightHotelContextResult } from '../generate-itinerary/flight-hotel-context.ts';
import { deriveMealPolicy, type MealPolicy } from '../generate-itinerary/meal-policy.ts';
import { mergePreferenceSources, type MergedIntent } from './preference-spine.ts';

export interface TripFactsDestination {
  city: string;
  country: string | null;
  iata: string | null;
}

export interface TripFactsDates {
  startDate: string | null;
  endDate: string | null;
  totalDays: number;
}

export interface TripFactsArrival {
  date: string | null;
  time24: string | null;
  airport: string | null;
  /** Earliest believable first activity (after check-in/settle). */
  earliestFirstActivityTime: string | null;
}

export interface TripFactsDeparture {
  date: string | null;
  time24: string | null;
  airport: string | null;
  /** Latest believable last activity (before airport transfer + buffer). */
  latestLastActivityTime: string | null;
}

export interface TripFactsHotel {
  name: string | null;
  address: string | null;
  /** Per-night rate in USD cents — null when the user hasn't entered one. */
  pricePerNightCents: number | null;
  checkIn: string | null;
  checkOut: string | null;
}

export interface TripFactsTravelers {
  count: number;
  profile: TravelerProfile;
  archetype: string;
}

export interface TripFactsPreferences {
  tripType: string | null;
  budgetTier: BudgetTier;
  dietary: string[];
  interests: string[];
}

export interface TripFacts {
  tripId: string;
  destination: TripFactsDestination;
  dates: TripFactsDates;
  arrival: TripFactsArrival;
  departure: TripFactsDeparture;
  hotel: TripFactsHotel;
  travelers: TripFactsTravelers;
  preferences: TripFactsPreferences;
  /** Unified must-haves from metadata.mustHaves + trip_day_intents + legacy userIntents. */
  mustHaves: MergedIntent[];
  /** Trip-wide free-text notes parsed out of fine-tune / metadata. */
  tripWideNotes: string[];
  /** Memoized per-day meal policy. */
  mealPolicy(dayN: number): MealPolicy;
  /** Raw underlying context — useful for callers that still need the prompt blob. */
  rawFlightHotelContext: FlightHotelContextResult;
}

export interface ResolveTripFactsOptions {
  /** Override the userId from the trip row. Defaults to trips.user_id. */
  userId?: string;
}

function countDaysInclusive(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0;
  return Math.round((e - s) / 86_400_000) + 1;
}

function pickHotelPriceCents(sel: any): number | null {
  if (!sel || typeof sel !== 'object') return null;
  // Canonical field is `pricePerNight` (USD). See src/types/trip.ts.
  const ppn = (sel.pricePerNight ?? sel.price_per_night) as number | undefined;
  if (typeof ppn === 'number' && Number.isFinite(ppn) && ppn > 0) {
    return Math.round(ppn * 100);
  }
  return null;
}

function pickHotelDates(sel: any): { checkIn: string | null; checkOut: string | null } {
  if (!sel || typeof sel !== 'object') return { checkIn: null, checkOut: null };
  return {
    checkIn: sel.checkIn ?? sel.check_in ?? null,
    checkOut: sel.checkOut ?? sel.check_out ?? null,
  };
}

/**
 * Pure orchestrator. Single `trips` read + composes existing resolvers.
 * Throws if the trip cannot be loaded.
 */
export async function resolveTripFacts(
  supabase: any,
  tripId: string,
  opts: ResolveTripFactsOptions = {},
): Promise<TripFacts> {
  if (!tripId) throw new Error('resolveTripFacts: tripId required');

  // One trip read for trip-level fields.
  const { data: trip, error } = await supabase
    .from('trips')
    .select(
      'id, user_id, destination, destination_country, ' +
        'start_date, end_date, travelers, budget_tier, trip_type, ' +
        'dietary_restrictions, interests, metadata, hotel_selection',
    )
    .eq('id', tripId)
    .maybeSingle();

  if (error) throw new Error(`resolveTripFacts: trip fetch failed: ${error.message}`);
  if (!trip) throw new Error(`resolveTripFacts: trip ${tripId} not found`);

  const userId = opts.userId || trip.user_id;

  // ── Compose existing resolvers in parallel where safe ───────────────────
  const [profile, flightHotel, intentsRes] = await Promise.all([
    loadTravelerProfile(supabase, userId, tripId, trip.destination || undefined),
    getFlightHotelContext(supabase, tripId),
    supabase
      .from('trip_day_intents')
      .select(
        'day_number, title, intent_kind, source_entry_point, priority, ' +
          'start_time, end_time, raw_text, status, locked, locked_source',
      )
      .eq('trip_id', tripId),
  ]);

  const structuredRows = (intentsRes?.data as any[]) || [];
  const metadata = (trip.metadata as Record<string, unknown>) || {};

  const merged = mergePreferenceSources({
    structuredRows,
    additionalNotes: (metadata.additionalNotes as string) || undefined,
    recordedIntents: (metadata.userIntents as any[]) || undefined,
    mustDoActivities: (metadata.mustDoActivities as any[]) || undefined,
    perDayActivities: (metadata.perDayActivities as any[]) || undefined,
    // Bridge: legacy metadata.mustHaves shape ({label, notes, dayTags})
    // is folded in as `mustDoActivities` semantics — same canonical merge.
    // No parallel must-haves-bridge file needed (audit found this is already
    // wired upstream via compile-prompt.ts; resolveTripFacts is additive).
    tripStartDate: trip.start_date || undefined,
    totalDays: countDaysInclusive(trip.start_date, trip.end_date),
  } as any);

  // Fold metadata.mustHaves chips into the must-haves list when present.
  // These are { label, notes? } pairs from the start form; treat as soft
  // trip-wide intents (priority: 'should', tripWide: true).
  const mustHavesChips = Array.isArray(metadata.mustHaves) ? (metadata.mustHaves as any[]) : [];
  const chipIntents: MergedIntent[] = mustHavesChips
    .map((m) => (typeof m === 'string' ? { label: m } : m))
    .filter((m) => m && typeof m.label === 'string' && m.label.trim())
    .map((m) => ({
      title: String(m.label).trim(),
      dayNumber: null,
      kind: 'activity' as const,
      source: 'metadata_mustHaves',
      priority: 'should' as const,
      raw: String(m.notes || m.label).trim(),
      locked: false,
      tripWide: true,
      origin: 'must_do' as const,
    }));

  // Dedupe chip intents against already-merged titles (case-insensitive).
  const seenTitles = new Set(merged.intents.map((i) => i.title.toLowerCase()));
  const extraChips = chipIntents.filter((c) => !seenTitles.has(c.title.toLowerCase()));
  const mustHaves = [...merged.intents, ...extraChips];

  // ── Trip-level facts ────────────────────────────────────────────────────
  const totalDays = countDaysInclusive(trip.start_date, trip.end_date);
  const { checkIn, checkOut } = pickHotelDates(trip.hotel_selection);

  const facts: TripFacts = {
    tripId,
    destination: {
      city: trip.destination || '',
      country: trip.destination_country || null,
      iata: trip.destination_iata || flightHotel.arrivalAirport || null,
    },
    dates: {
      startDate: trip.start_date || null,
      endDate: trip.end_date || null,
      totalDays,
    },
    arrival: {
      date: trip.start_date || null,
      time24: flightHotel.arrivalTime24 || null,
      airport: flightHotel.arrivalAirport || null,
      earliestFirstActivityTime: flightHotel.earliestFirstActivityTime || null,
    },
    departure: {
      date: trip.end_date || null,
      time24: flightHotel.returnDepartureTime24 || null,
      airport: null, // departure airport not currently surfaced by FHC
      latestLastActivityTime: flightHotel.latestLastActivityTime || null,
    },
    hotel: {
      name: flightHotel.hotelName || null,
      address: flightHotel.hotelAddress || null,
      pricePerNightCents: pickHotelPriceCents(trip.hotel_selection),
      checkIn,
      checkOut,
    },
    travelers: {
      count: typeof trip.travelers === 'number' && trip.travelers > 0 ? trip.travelers : 1,
      profile,
      archetype: profile.archetype,
    },
    preferences: {
      tripType: trip.trip_type || null,
      budgetTier: profile.budgetTier,
      dietary: Array.isArray(trip.dietary_restrictions)
        ? (trip.dietary_restrictions as string[])
        : profile.dietaryRestrictions || [],
      interests: Array.isArray(trip.interests)
        ? (trip.interests as string[])
        : profile.interests || [],
    },
    mustHaves,
    tripWideNotes: merged.tripWideNotes || [],
    mealPolicy: (() => {
      const cache = new Map<number, MealPolicy>();
      return (dayN: number) => {
        const cached = cache.get(dayN);
        if (cached) return cached;
        const isFirstDay = dayN === 1;
        const isLastDay = totalDays > 0 && dayN === totalDays;
        const policy = deriveMealPolicy({
          dayNumber: dayN,
          totalDays,
          isFirstDay,
          isLastDay,
          arrivalTime24: isFirstDay ? flightHotel.arrivalTime24 || undefined : undefined,
          departureTime24: isLastDay ? flightHotel.returnDepartureTime24 || undefined : undefined,
          earliestAvailable: isFirstDay ? flightHotel.earliestFirstActivityTime || undefined : undefined,
          latestAvailable: isLastDay ? flightHotel.latestLastActivityTime || undefined : undefined,
        });
        cache.set(dayN, policy);
        return policy;
      };
    })(),
    rawFlightHotelContext: flightHotel,
  };

  return facts;
}
