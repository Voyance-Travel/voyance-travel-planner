import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { googleDistanceMatrix } from "../_shared/google-api.ts";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TransferRequest {
  origin: string;
  destination: string;
  city: string;
  airportCode?: string;
  arrivalTime?: string;
  hotelName?: string;
  archetype?: string;
  travelers?: number;
  isReturn?: boolean; // true = hotel→airport, false = airport→hotel
}

interface TransferOption {
  id: string;
  mode: string;
  label: string;
  duration: string;
  durationMinutes: number;
  estimatedCost: string;
  costPerPerson?: string;
  route?: string;
  notes?: string;
  pros?: string[];
  cons?: string[];
  trainLine?: string;
  recommended?: boolean;
  recommendedFor?: string; // archetype match
  bookingTip?: string;
  icon: string; // emoji
}

interface TransferResponse {
  origin: string;
  destination: string;
  options: TransferOption[];
  aiRecommendation?: string;
  source: 'database+ai' | 'database' | 'estimated' | 'ai';
  lastVerified?: string;
  fetchedAt: string;
}

interface FareRecord {
  city: string;
  airport_code: string;
  airport_name: string;
  taxi_duration_min: number | null;
  taxi_duration_max: number | null;
  taxi_cost_min: number | null;
  taxi_cost_max: number | null;
  taxi_is_fixed_price: boolean;
  taxi_notes: string | null;
  train_duration_min: number | null;
  train_duration_max: number | null;
  train_cost: number | null;
  train_line: string | null;
  train_notes: string | null;
  bus_cost: number | null;
  bus_duration_min: number | null;
  bus_duration_max: number | null;
  bus_notes: string | null;
  currency: string;
  currency_symbol: string;
  last_verified_at: string;
  source: string;
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
};

const formatDurationRange = (min: number | null, max: number | null): string => {
  if (min === null && max === null) return 'N/A';
  if (min === max || max === null) return `${min} min`;
  if (min === null) return `${max} min`;
  return `${min}-${max} min`;
};

const formatCost = (min: number | null, max: number | null, symbol: string, isFixed: boolean): string => {
  if (min === null && max === null) return 'N/A';
  if (isFixed || min === max) return `${symbol}${min} fixed`;
  if (min === null) return `${symbol}${max}`;
  if (max === null) return `${symbol}${min}`;
  return `${symbol}${min}-${max}`;
};

// Regional transfer cost estimates for cities not in the database
interface RegionalEstimate {
  taxiMin: number; taxiMax: number;
  trainCost: number | null;
  busCost: number | null;
  symbol: string;
  taxiDuration: string;
  trainDuration: string | null;
  busDuration: string | null;
  hotelCarMin: number | null; hotelCarMax: number | null;
}

const REGIONAL_ESTIMATES: Record<string, RegionalEstimate> = {
  'mexico': { taxiMin: 15, taxiMax: 30, trainCost: 1, busCost: 3, symbol: '$', taxiDuration: '30-50 min', trainDuration: '40-60 min', busDuration: '50-70 min', hotelCarMin: 40, hotelCarMax: 60 },
  'colombia': { taxiMin: 10, taxiMax: 25, trainCost: null, busCost: 3, symbol: '$', taxiDuration: '40-70 min', trainDuration: null, busDuration: '50-80 min', hotelCarMin: 30, hotelCarMax: 50 },
  'brazil': { taxiMin: 20, taxiMax: 40, trainCost: 2, busCost: 3, symbol: 'R$', taxiDuration: '30-60 min', trainDuration: '40-60 min', busDuration: '50-70 min', hotelCarMin: 50, hotelCarMax: 80 },
  'europe_default': { taxiMin: 30, taxiMax: 60, trainCost: 10, busCost: 6, symbol: '€', taxiDuration: '30-50 min', trainDuration: '30-45 min', busDuration: '45-60 min', hotelCarMin: 70, hotelCarMax: 120 },
  'uk': { taxiMin: 40, taxiMax: 80, trainCost: 15, busCost: 8, symbol: '£', taxiDuration: '30-60 min', trainDuration: '30-45 min', busDuration: '50-70 min', hotelCarMin: 80, hotelCarMax: 130 },
  'scandinavia': { taxiMin: 40, taxiMax: 80, trainCost: 12, busCost: 8, symbol: '€', taxiDuration: '25-40 min', trainDuration: '20-35 min', busDuration: '35-50 min', hotelCarMin: 80, hotelCarMax: 120 },
  'eastern_europe': { taxiMin: 10, taxiMax: 25, trainCost: 3, busCost: 2, symbol: '€', taxiDuration: '25-45 min', trainDuration: '30-45 min', busDuration: '40-55 min', hotelCarMin: 30, hotelCarMax: 50 },
  'southeast_asia': { taxiMin: 5, taxiMax: 15, trainCost: 2, busCost: 1, symbol: '$', taxiDuration: '30-60 min', trainDuration: '30-45 min', busDuration: '40-60 min', hotelCarMin: 20, hotelCarMax: 40 },
  'japan': { taxiMin: 60, taxiMax: 200, trainCost: 30, busCost: 10, symbol: '¥', taxiDuration: '45-90 min', trainDuration: '35-60 min', busDuration: '60-90 min', hotelCarMin: 100, hotelCarMax: 250 },
  'india': { taxiMin: 8, taxiMax: 20, trainCost: 1, busCost: 1, symbol: '₹', taxiDuration: '30-60 min', trainDuration: '40-60 min', busDuration: '45-70 min', hotelCarMin: 25, hotelCarMax: 50 },
  'middle_east': { taxiMin: 15, taxiMax: 40, trainCost: 5, busCost: 3, symbol: '$', taxiDuration: '20-40 min', trainDuration: '25-40 min', busDuration: '35-50 min', hotelCarMin: 50, hotelCarMax: 90 },
  'australia': { taxiMin: 40, taxiMax: 80, trainCost: 15, busCost: 10, symbol: 'A$', taxiDuration: '25-45 min', trainDuration: '30-45 min', busDuration: '45-60 min', hotelCarMin: 80, hotelCarMax: 140 },
  'default': { taxiMin: 20, taxiMax: 50, trainCost: 5, busCost: 4, symbol: '$', taxiDuration: '30-50 min', trainDuration: '30-45 min', busDuration: '40-55 min', hotelCarMin: 50, hotelCarMax: 100 },
};

const CITY_REGION_MAP: Record<string, string> = {
  'bogota': 'colombia', 'medellin': 'colombia', 'cartagena': 'colombia',
  'mexico city': 'mexico', 'cancun': 'mexico', 'cabo san lucas': 'mexico',
  'rio de janeiro': 'brazil', 'sao paulo': 'brazil',
  'edinburgh': 'uk', 'dublin': 'europe_default', 'manchester': 'uk', 'london': 'uk',
  'stockholm': 'scandinavia', 'copenhagen': 'scandinavia', 'oslo': 'scandinavia',
  'prague': 'eastern_europe', 'budapest': 'eastern_europe', 'krakow': 'eastern_europe',
  'amsterdam': 'europe_default', 'brussels': 'europe_default', 'vienna': 'europe_default',
  'lisbon': 'europe_default', 'porto': 'europe_default', 'rome': 'europe_default',
  'florence': 'europe_default', 'milan': 'europe_default', 'venice': 'europe_default',
  'paris': 'europe_default', 'nice': 'europe_default', 'barcelona': 'europe_default',
  'madrid': 'europe_default', 'berlin': 'europe_default', 'munich': 'europe_default',
  'hanoi': 'southeast_asia', 'ho chi minh': 'southeast_asia', 'bangkok': 'southeast_asia',
  'bali': 'southeast_asia', 'singapore': 'southeast_asia',
  'kyoto': 'japan', 'osaka': 'japan', 'tokyo': 'japan',
  'mumbai': 'india', 'delhi': 'india', 'jaipur': 'india',
  'dubai': 'middle_east', 'amman': 'middle_east', 'istanbul': 'middle_east',
  'sydney': 'australia', 'melbourne': 'australia',
};

function getRegionalEstimate(city: string): RegionalEstimate {
  const cityLower = city.toLowerCase().trim();
  const regionKey = CITY_REGION_MAP[cityLower];
  if (regionKey && REGIONAL_ESTIMATES[regionKey]) return REGIONAL_ESTIMATES[regionKey];
  for (const [key, region] of Object.entries(CITY_REGION_MAP)) {
    if (cityLower.includes(key) || key.includes(cityLower)) {
      return REGIONAL_ESTIMATES[region] || REGIONAL_ESTIMATES['default'];
    }
  }
  return REGIONAL_ESTIMATES['default'];
}

// Generate AI recommendation based on archetype
function getArchetypeRecommendation(
  archetype: string | undefined,
  options: TransferOption[],
  hotelName?: string,
  travelers?: number
): { recommendation: string; recommendedId: string } {
  const pax = travelers || 2;
  const taxiOpt = options.find(o => o.id === 'taxi');
  const trainOpt = options.find(o => o.id === 'train');
  const hotelCarOpt = options.find(o => o.id === 'hotel_car');
  const busOpt = options.find(o => o.id === 'bus');

  const arch = (archetype || '').toLowerCase();

  if (arch.includes('luxury') || arch.includes('premium')) {
    const rec = hotelCarOpt || taxiOpt;
    return {
      recommendedId: rec?.id || 'taxi',
      recommendation: hotelCarOpt
        ? `As a Luxury traveler, the hotel car service is worth it after a long flight. Driver meets you at arrivals — no navigating, no luggage hassle.${hotelName ? ` Book through ${hotelName} concierge when you confirm your reservation.` : ''}`
        : `A pre-booked taxi or ride service gives you door-to-door comfort with minimal hassle after your flight.`,
    };
  }

  if (arch.includes('budget') || arch.includes('backpack') || arch.includes('explorer')) {
    const rec = trainOpt?.estimatedCost !== 'N/A' ? trainOpt : busOpt || taxiOpt;
    return {
      recommendedId: rec?.id || 'train',
      recommendation: trainOpt?.estimatedCost !== 'N/A'
        ? `The train is your best bet — fast, cheap, and you get to see the city on the way in.${trainOpt?.trainLine ? ` Take the ${trainOpt.trainLine}.` : ''}`
        : `The airport bus/shuttle gives you the best value. Save your travel budget for experiences!`,
    };
  }

  if (arch.includes('cultural') || arch.includes('foodie')) {
    const rec = trainOpt?.estimatedCost !== 'N/A' ? trainOpt : taxiOpt;
    return {
      recommendedId: rec?.id || 'train',
      recommendation: `The train gives you a first taste of local life — watch the city unfold from street level. It's part of the experience!`,
    };
  }

  if (arch.includes('family') || arch.includes('group')) {
    return {
      recommendedId: 'taxi',
      recommendation: pax > 2
        ? `With ${pax} travelers, a taxi splits nicely and saves the luggage hassle. Door-to-door is worth it with a group.`
        : `A taxi gets you to the hotel quickly with luggage — especially important when traveling as a family.`,
    };
  }

  // Default balanced recommendation
  return {
    recommendedId: taxiOpt?.id || 'taxi',
    recommendation: `A taxi/rideshare is the most convenient option — door-to-door service with no transfers. If you're budget-conscious, the train is a great alternative.`,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as TransferRequest;
    const { origin, destination, city, airportCode, arrivalTime, hotelName, archetype, travelers, isReturn } = body;

    if (!city) {
      return new Response(
        JSON.stringify({ error: 'City is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Detect if this is an airport route vs a city point-to-point route
    const AIRPORT_KEYWORDS = ['airport', 'terminal', 'aeroporto', 'aéroport', 'flughafen', 'aeropuerto'];
    const AIRPORT_CODE_PATTERN = /\b[A-Z]{3}\b/; // e.g. LHR, JFK
    const originLower = (origin || '').toLowerCase();
    const destLower = (destination || '').toLowerCase();
    const isAirportRoute = AIRPORT_KEYWORDS.some(kw => originLower.includes(kw) || destLower.includes(kw))
      || (airportCode && airportCode.length === 3)
      || AIRPORT_CODE_PATTERN.test(origin || '')
      || AIRPORT_CODE_PATTERN.test(destination || '');

    // Look up fare data from database (only for airport routes)
    let fareRecord: FareRecord | undefined;
    if (isAirportRoute) {
      let fareQuery = supabase.from('airport_transfer_fares').select('*').ilike('city', city);
      if (airportCode) fareQuery = fareQuery.eq('airport_code', airportCode.toUpperCase());
      const { data: fares } = await fareQuery.limit(1);
      fareRecord = fares?.[0] as FareRecord | undefined;
    }

    // Google Maps live duration
    let liveTaxiDuration: string | null = null;
    let liveTaxiMinutes: number | null = null;
    let liveTransitDuration: string | null = null;
    let liveTransitMinutes: number | null = null;

    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const googleOrigin = isReturn ? destination : origin;
    const googleDest = isReturn ? origin : destination;

    if (GOOGLE_MAPS_API_KEY && googleOrigin && googleDest) {
      const transferTracker = trackCost('airport_transfers', 'google_distance_matrix');
      const fetchPromises = [];

      // Driving
      fetchPromises.push(
        googleDistanceMatrix(
          { origins: googleOrigin, destinations: googleDest, mode: 'driving', departureTime: 'now' },
          { tracker: transferTracker, actionType: 'airport_transfers', reason: 'driving' },
        ).then(r => {
          const data = r.data;
          if (data?.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
            const seconds = data.rows[0].elements[0].duration_in_traffic?.value || data.rows[0].elements[0].duration.value;
            liveTaxiDuration = formatDuration(seconds);
            liveTaxiMinutes = Math.round(seconds / 60);
          }
        }).catch(() => {})
      );

      // Transit
      const transitDeparture = arrivalTime ? Math.floor(new Date(arrivalTime).getTime() / 1000).toString() : 'now';
      fetchPromises.push(
        googleDistanceMatrix(
          { origins: googleOrigin, destinations: googleDest, mode: 'transit', departureTime: transitDeparture },
          { tracker: transferTracker, actionType: 'airport_transfers', reason: 'transit' },
        ).then(r => {
          const data = r.data;
          if (data?.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
            const seconds = data.rows[0].elements[0].duration.value;
            liveTransitDuration = formatDuration(seconds);
            liveTransitMinutes = Math.round(seconds / 60);
          }
        }).catch(() => {})
      );

      await Promise.all(fetchPromises);
      await transferTracker.save();
    }

    const options: TransferOption[] = [];
    const pax = travelers || 2;
    const regional = getRegionalEstimate(city);
    const sym = fareRecord?.currency_symbol || regional.symbol;

    // Readable origin/destination labels for route descriptions
    const originLabel = origin || (isAirportRoute ? `${city} Airport` : city);
    const destLabel = destination || (isAirportRoute ? (hotelName || 'hotel') : city);

    // City routes use ~30% of airport fare estimates (avg 3-5km vs 20-40km)
    const cityScaleFactor = 0.3;

    // 1) Taxi/Rideshare
    const taxiDuration = liveTaxiDuration || (fareRecord
      ? formatDurationRange(fareRecord.taxi_duration_min, fareRecord.taxi_duration_max)
      : regional.taxiDuration);
    const taxiMinutes = liveTaxiMinutes || fareRecord?.taxi_duration_max || fareRecord?.taxi_duration_min || 40;

    let taxiCost: string;
    let taxiCostMin: number;
    let taxiCostMax: number;
    if (isAirportRoute) {
      taxiCostMin = fareRecord?.taxi_cost_min || regional.taxiMin;
      taxiCostMax = fareRecord?.taxi_cost_max || regional.taxiMax;
      taxiCost = fareRecord
        ? formatCost(fareRecord.taxi_cost_min, fareRecord.taxi_cost_max, sym, fareRecord.taxi_is_fixed_price)
        : `${sym}${regional.taxiMin}-${regional.taxiMax}`;
    } else {
      taxiCostMin = Math.max(3, Math.round((fareRecord?.taxi_cost_min || regional.taxiMin) * cityScaleFactor));
      taxiCostMax = Math.max(5, Math.round((fareRecord?.taxi_cost_max || regional.taxiMax) * cityScaleFactor));
      taxiCost = `${sym}${taxiCostMin}-${taxiCostMax}`;
    }

    options.push({
      id: 'taxi',
      mode: 'taxi',
      label: 'Taxi / Rideshare',
      icon: '🚕',
      duration: taxiDuration,
      durationMinutes: taxiMinutes,
      estimatedCost: taxiCost,
      costPerPerson: pax > 1 ? `~${sym}${Math.round(taxiCostMin / pax)}-${Math.round(taxiCostMax / pax)} pp` : undefined,
      route: isAirportRoute
        ? `Direct door-to-door from ${isReturn ? (hotelName || 'hotel') : 'airport'} to ${isReturn ? 'airport' : (hotelName || 'hotel')}`
        : `Direct ride from ${originLabel} to ${destLabel}`,
      pros: isAirportRoute
        ? ['Door-to-door, no transfers', 'Best with luggage', 'Available 24/7']
        : ['Door-to-door, fastest option', 'No navigation needed', 'Available on demand'],
      cons: isAirportRoute
        ? ['Traffic can add 20-30 min at peak hours', 'Ride apps may surge price']
        : ['Cost adds up on multiple trips', 'Traffic can vary'],
      notes: liveTaxiDuration ? 'Live traffic estimate' : (fareRecord?.taxi_notes || undefined),
      bookingTip: isAirportRoute
        ? 'Pre-book via hotel or use Uber/Bolt at arrivals'
        : 'Use Uber, Bolt, or local rideshare apps',
    });

    // 2) Train/Metro
    if ((fareRecord && fareRecord.train_cost !== null) || regional.trainCost !== null) {
      const trainDuration = liveTransitDuration || (fareRecord
        ? formatDurationRange(fareRecord.train_duration_min, fareRecord.train_duration_max)
        : regional.trainDuration || '30-45 min');
      const trainMinutes = liveTransitMinutes || fareRecord?.train_duration_max || fareRecord?.train_duration_min || 35;

      let trainCost: string;
      if (isAirportRoute) {
        trainCost = fareRecord?.train_cost
          ? `${sym}${fareRecord.train_cost}`
          : `${sym}${regional.trainCost}`;
      } else {
        const rawCost = fareRecord?.train_cost || regional.trainCost || 5;
        const cityCost = Math.max(1, Math.round(rawCost * cityScaleFactor));
        trainCost = `${sym}${cityCost}`;
      }

      options.push({
        id: 'train',
        mode: 'train',
        label: 'Train / Metro',
        icon: '🚆',
        duration: trainDuration,
        durationMinutes: trainMinutes,
        estimatedCost: trainCost,
        costPerPerson: `${trainCost} pp`,
        trainLine: fareRecord?.train_line || undefined,
        route: isAirportRoute
          ? (fareRecord?.train_line
            ? `${fareRecord.train_line} to city center, then walk/taxi to ${hotelName || 'hotel'}`
            : `Airport express to central station, then metro/taxi`)
          : `Take metro or rail nearest to ${destLabel}`,
        pros: isAirportRoute
          ? ['Cheapest option', 'No traffic delays', 'See the city on the way']
          : ['Affordable and reliable', 'No traffic delays', 'Covers most of the city'],
        cons: isAirportRoute
          ? ['Luggage can be awkward', 'May need a transfer', 'Limited late-night service']
          : ['May need a short walk at each end', 'Crowded at rush hour'],
        notes: fareRecord?.train_notes || undefined,
        bookingTip: isAirportRoute
          ? 'Buy tickets at the airport station or use contactless payment'
          : 'Use contactless payment or buy a day pass',
      });
    }

    // 3) Bus/Shuttle
    if ((fareRecord && fareRecord.bus_cost !== null) || regional.busCost !== null) {
      const busDuration = fareRecord
        ? formatDurationRange(fareRecord.bus_duration_min, fareRecord.bus_duration_max)
        : regional.busDuration || '45-60 min';
      const busMinutes = fareRecord?.bus_duration_max || fareRecord?.bus_duration_min || 50;

      let busCost: string;
      if (isAirportRoute) {
        busCost = fareRecord?.bus_cost
          ? `${sym}${fareRecord.bus_cost}`
          : `${sym}${regional.busCost}`;
      } else {
        const rawCost = fareRecord?.bus_cost || regional.busCost || 4;
        const cityCost = Math.max(1, Math.round(rawCost * cityScaleFactor));
        busCost = `${sym}${cityCost}`;
      }

      options.push({
        id: 'bus',
        mode: 'bus',
        label: isAirportRoute ? 'Airport Bus / Shuttle' : 'Bus',
        icon: '🚌',
        duration: busDuration,
        durationMinutes: busMinutes,
        estimatedCost: busCost,
        costPerPerson: `${busCost} pp`,
        route: isAirportRoute
          ? 'Airport shuttle to city center drop-off point'
          : `Local bus service toward ${destLabel}`,
        pros: isAirportRoute
          ? ['Very affordable', 'Comfortable seating', 'Luggage space included']
          : ['Very affordable', 'Wide route coverage', 'Frequent service in most cities'],
        cons: isAirportRoute
          ? ['Fixed schedule', 'Multiple stops', 'Longer journey time']
          : ['Multiple stops', 'Can be slow in traffic', 'Route may not be direct'],
        notes: fareRecord?.bus_notes || undefined,
        bookingTip: isAirportRoute
          ? 'Check schedule at arrivals — runs every 15-30 min typically'
          : 'Check local transit app for real-time arrivals',
      });
    }

    // 4) Hotel Car Service / Private Transfer — only for airport routes
    if (isAirportRoute) {
      const hotelCarMin = regional.hotelCarMin || 50;
      const hotelCarMax = regional.hotelCarMax || 100;
      options.push({
        id: 'hotel_car',
        mode: 'private',
        label: 'Hotel Car Service',
        icon: '🚘',
        duration: liveTaxiDuration || taxiDuration,
        durationMinutes: taxiMinutes,
        estimatedCost: `${sym}${hotelCarMin}-${hotelCarMax}`,
        route: `Pre-arranged driver waiting at arrivals with name sign`,
        pros: ['Most comfortable', 'Driver waiting at arrivals', 'No navigation needed', 'Premium vehicles'],
        cons: ['Most expensive option', 'Must book in advance'],
        notes: hotelName ? `Ask ${hotelName} concierge about car service` : 'Contact hotel for car service',
        bookingTip: hotelName ? `Book through ${hotelName} when confirming your reservation` : 'Book through your hotel concierge',
      });
    }

    // AI recommendation — use airport-specific logic only for airport routes
    let recommendation: string;
    let recommendedId: string;
    if (isAirportRoute) {
      const archResult = getArchetypeRecommendation(archetype, options, hotelName, pax);
      recommendation = archResult.recommendation;
      recommendedId = archResult.recommendedId;
    } else {
      // City route: context-aware recommendation using origin/destination names and duration
      const taxiOpt = options.find(o => o.id === 'taxi');
      const trainOpt = options.find(o => o.id === 'train');
      const taxiMins = taxiOpt?.durationMinutes || 99;
      const origName = origin || 'your current location';
      const destName = destination || 'your next stop';
      const walkEstimate = Math.round(taxiMins * 3.5); // rough walk time from taxi duration

      if (taxiMins <= 5) {
        // Very short distance — walking is best
        recommendedId = trainOpt ? 'train' : 'taxi';
        recommendation = `It's a short walk from ${origName} to ${destName} — no transport needed unless you prefer a quick ride.`;
      } else if (taxiMins <= 10) {
        recommendedId = 'taxi';
        recommendation = `A quick taxi ride from ${origName} to ${destName}, or walk it in about ${walkEstimate} minutes.`;
      } else if (trainOpt && trainOpt.durationMinutes < taxiMins * 1.5) {
        const trainLabel = trainOpt.label || 'The metro';
        recommendedId = 'train';
        recommendation = `${trainLabel} is a solid option between ${origName} and ${destName} — affordable and avoids traffic.`;
      } else {
        recommendedId = 'taxi';
        recommendation = `A taxi or rideshare is the easiest way from ${origName} to ${destName}.`;
      }
    }

    // Mark recommended option
    for (const opt of options) {
      if (opt.id === recommendedId) {
        opt.recommended = true;
        opt.recommendedFor = archetype || 'you';
      }
    }

    const result: TransferResponse = {
      origin: origin || (isAirportRoute ? `${city} Airport` : city),
      destination: destination || (hotelName || city),
      options,
      aiRecommendation: recommendation,
      source: fareRecord ? (liveTaxiDuration ? 'database+ai' : 'database') : (liveTaxiDuration ? 'ai' : 'estimated'),
      lastVerified: fareRecord?.last_verified_at,
      fetchedAt: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Airport transfers error:', error);
    return new Response(
      JSON.stringify({ success: false, error: "Transfer lookup failed", code: "TRANSFER_ERROR" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
