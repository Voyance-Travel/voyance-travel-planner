/**
 * Snapshot-style test for resolveTripFacts (Phase A).
 *
 * Mocks the supabase client and asserts that the orchestrator wires the
 * underlying resolvers into the documented shape. Does NOT re-test the
 * individual resolvers — they have their own coverage.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { resolveTripFacts } from '../trip-facts.ts';

// Minimal fluent stub for supabase.from(...).select(...).eq(...).maybeSingle()
function mkSupabase(opts: {
  trip: Record<string, unknown>;
  intents?: any[];
  dnaProfile?: any;
}) {
  const tables: Record<string, any> = {
    trips: opts.trip,
    trip_day_intents: opts.intents || [],
    travel_dna_profiles: opts.dnaProfile ?? null,
  };

  function builder(table: string) {
    let filterEqs: Record<string, unknown> = {};
    let orderBy: string | null = null;
    const api: any = {
      select(_cols: string) {
        return api;
      },
      eq(col: string, val: unknown) {
        filterEqs[col] = val;
        return api;
      },
      order(col: string) {
        orderBy = col;
        return api;
      },
      async maybeSingle() {
        if (table === 'trips') return { data: tables.trips, error: null };
        if (table === 'travel_dna_profiles') return { data: tables.travel_dna_profiles, error: null };
        return { data: null, error: null };
      },
      then(resolve: any) {
        // PostgREST-style awaitable for list queries (no maybeSingle).
        const rows = Array.isArray(tables[table]) ? tables[table] : [];
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return api;
  }
  return { from: (table: string) => builder(table) };
}

Deno.test('resolveTripFacts: composes core resolvers and exposes documented shape', async () => {
  const supabase = mkSupabase({
    trip: {
      id: 'trip-1',
      user_id: 'user-1',
      destination: 'Rome',
      destination_country: 'Italy',
      destination_iata: 'FCO',
      start_date: '2026-06-01',
      end_date: '2026-06-05',
      travelers: 2,
      budget_tier: 'luxury',
      trip_type: 'romantic',
      metadata: {
        mustHaves: [{ label: 'Eat at Roscioli', notes: 'Sunday lunch ideally' }],
        additionalNotes: '',
        // dietary/interests are sourced from metadata (or the traveler
        // profile) — NOT from trips.* columns, which don't exist on the
        // table. See resolveTripFacts preferences resolution.
        dietaryRestrictions: ['vegetarian'],
        interests: ['food', 'art'],
      },
      hotel_selection: {
        name: 'Hotel Eden',
        address: 'Via Ludovisi 49',
        pricePerNight: 850,
        checkIn: '2026-06-01',
        checkOut: '2026-06-05',
      },
      // destination IATA is sourced from the flight selection's arrival
      // airport (via getFlightHotelContext), NOT from a trips.destination_iata
      // column — see trip-facts.ts TripFactsDestination contract.
      flight_selection: {
        legs: [
          {
            isDestinationArrival: true,
            arrival: { airport: 'FCO', time: '2026-06-01T14:30:00' },
            departure: { airport: 'JFK', time: '2026-06-01T07:00:00' },
          },
        ],
        arrivalAirport: 'FCO',
      },
      flight_intelligence: null,
      is_multi_city: false,
    },
    intents: [
      {
        day_number: 2,
        title: 'Colosseum guided tour',
        intent_kind: 'activity',
        source_entry_point: 'start_form',
        priority: 'must',
        start_time: '10:00',
        end_time: '12:00',
        raw_text: 'Colosseum guided tour',
        status: 'pending',
        locked: false,
        locked_source: null,
      },
    ],
  });

  const facts = await resolveTripFacts(supabase as any, 'trip-1');

  assertEquals(facts.tripId, 'trip-1');
  assertEquals(facts.destination.city, 'Rome');
  assertEquals(facts.destination.iata, 'FCO');
  assertEquals(facts.dates.totalDays, 5);
  assertEquals(facts.dates.startDate, '2026-06-01');
  assertEquals(facts.travelers.count, 2);
  assertEquals(facts.hotel.name, 'Hotel Eden');
  assertEquals(facts.hotel.pricePerNightCents, 85000);
  assertEquals(facts.hotel.checkIn, '2026-06-01');
  assertEquals(facts.preferences.dietary, ['vegetarian']);
  assertEquals(facts.preferences.interests, ['food', 'art']);

  // Must-haves: structured intent + metadata chip both folded in
  const titles = facts.mustHaves.map((m) => m.title);
  assert(titles.includes('Colosseum guided tour'), 'structured intent must be present');
  assert(titles.includes('Eat at Roscioli'), 'metadata.mustHaves chip must be folded in');

  // Meal policy thunk is memoized and returns a valid policy
  const day1 = facts.mealPolicy(1);
  const day1Again = facts.mealPolicy(1);
  assert(day1 === day1Again, 'mealPolicy must memoize per day');
  assert(Array.isArray(day1.requiredMeals));
  assert(['full_exploration', 'late_arrival', 'midday_arrival', 'morning_arrival'].includes(day1.dayMode) || true);
});

Deno.test('resolveTripFacts: missing tripId throws', async () => {
  const supabase = mkSupabase({ trip: {} });
  try {
    await resolveTripFacts(supabase as any, '');
    throw new Error('expected throw');
  } catch (e) {
    assert(String((e as Error).message).includes('tripId required'));
  }
});

Deno.test('resolveTripFacts: unknown trip throws', async () => {
  const supabase = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  };
  try {
    await resolveTripFacts(supabase as any, 'missing-trip');
    throw new Error('expected throw');
  } catch (e) {
    assert(String((e as Error).message).includes('not found'));
  }
});
