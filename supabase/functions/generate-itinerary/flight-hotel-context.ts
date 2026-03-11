/**
 * Flight & Hotel Context Module
 * Extracts flight and hotel data from trip records and formats them
 * as AI prompt context with timing constraints.
 */

// =============================================================================
// Types
// =============================================================================

export interface ArrivalRoutingDecision {
  strategy: 'hotel-first' | 'venue-first';
  reason: string;
  firstMustDoName?: string;
  firstMustDoStartTime?: string;
  estimatedAirportToVenueMinutes?: number;
  estimatedAirportToHotelMinutes?: number;
}

export interface FlightHotelContextResult {
  context: string;
  arrivalTime?: string;
  arrivalTime24?: string;
  earliestFirstActivityTime?: string;
  returnDepartureTime?: string;
  returnDepartureTime24?: string;
  latestLastActivityTime?: string;
  hotelName?: string;
  hotelAddress?: string;
  arrivalAirport?: string;
  rawFlightSelection?: unknown;
  rawHotelSelection?: unknown;
  rawFlightIntelligence?: unknown;
  arrivalRouting?: ArrivalRoutingDecision;
}

export interface AirportTransferFare {
  taxiCostMin: number | null;
  taxiCostMax: number | null;
  trainCost: number | null;
  busCost: number | null;
  currency: string;
  currencySymbol: string;
  taxiIsFixedPrice: boolean;
}

export interface DynamicTransferResult {
  recommendedOption?: {
    mode: string;
    priceTotal: number;
    currency: string;
    priceFormatted: string;
    isBookable: boolean;
    bookingUrl?: string;
    productCode?: string;
    source: string;
    durationMinutes: number;
  };
  options: Array<{
    id: string;
    mode: string;
    priceTotal: number;
    currency: string;
    priceFormatted: string;
    isBookable: boolean;
    bookingUrl?: string;
    productCode?: string;
    source: string;
  }>;
  source: 'live' | 'database' | 'estimated';
}

// =============================================================================
// Time Helpers
// =============================================================================

export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  if (!period && hours >= 24) return null;
  return hours * 60 + mins;
}

export function minutesToHHMM(totalMinutes: number): string {
  const mins = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutesToHHMM(timeHHMM: string, deltaMins: number): string {
  const base = parseTimeToMinutes(timeHHMM);
  if (base === null) return timeHHMM;
  return minutesToHHMM(base + deltaMins);
}

export function normalizeTo24h(timeStr: string): string | null {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return null;
  return minutesToHHMM(mins);
}

// =============================================================================
// Dynamic Transfer Pricing
// =============================================================================

export async function getDynamicTransferPricing(
  supabaseUrl: string,
  origin: string,
  destination: string,
  city: string,
  travelers: number = 2,
  date?: string
): Promise<DynamicTransferResult | null> {
  try {
    console.log(`[TransferPricing] Fetching dynamic pricing for ${origin} → ${destination}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/transfer-pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        destination,
        city,
        travelers,
        date,
        transferType: origin.toLowerCase().includes('airport') ? 'airport_arrival' : 'point_to_point',
      }),
    });

    if (!response.ok) {
      console.warn('[TransferPricing] Edge function error:', response.status);
      return null;
    }

    const data = await response.json();
    console.log(`[TransferPricing] Got ${data.options?.length || 0} options, source: ${data.source}`);
    
    return data;
  } catch (e) {
    console.warn('[TransferPricing] Error:', e);
    return null;
  }
}

// =============================================================================
// Airport Transfer Time
// =============================================================================

export async function getAirportTransferTime(supabase: any, destination: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('destinations')
      .select('city, airport_transfer_minutes')
      .or(`city.ilike.%${destination}%,country.ilike.%${destination}%`)
      .limit(1);
    
    if (error || !data?.length) {
      console.log(`[AirportTransfer] No destination found for "${destination}", using default 45 min`);
      return 45;
    }
    
    const transferTime = data[0].airport_transfer_minutes || 45;
    console.log(`[AirportTransfer] Found ${data[0].city}: ${transferTime} minutes`);
    return transferTime;
  } catch (e) {
    console.error('[AirportTransfer] Error fetching transfer time:', e);
    return 45;
  }
}

// =============================================================================
// Airport-to-Area Travel Estimates (minutes)
// Used for venue-first vs hotel-first routing decisions on Day 1
// =============================================================================

const AIRPORT_AREA_ESTIMATES: Record<string, Record<string, number>> = {
  'LGA': {
    'flushing': 15, 'corona': 15, 'usta': 15, 'us open': 15, 'citi field': 15,
    'astoria': 10, 'jackson heights': 15, 'long island city': 15,
    'midtown': 30, 'manhattan': 35, 'times square': 35, 'theater district': 35,
    'upper east side': 25, 'upper west side': 30, 'central park': 30,
    'chelsea': 35, 'soho': 40, 'tribeca': 40, 'financial district': 45,
    'brooklyn': 40, 'williamsburg': 35, 'dumbo': 40,
    'yankee stadium': 25, 'bronx': 20, 'msg': 35, 'madison square garden': 35,
    'barclays': 40, 'garden': 35,
  },
  'JFK': {
    'flushing': 25, 'corona': 25, 'usta': 25, 'us open': 25,
    'midtown': 50, 'manhattan': 55, 'times square': 55,
    'brooklyn': 30, 'williamsburg': 35, 'dumbo': 35, 'barclays': 35,
    'long island city': 35, 'astoria': 40,
    'chelsea': 50, 'soho': 45, 'tribeca': 45, 'financial district': 45,
    'msg': 50, 'madison square garden': 50,
  },
  'EWR': {
    'midtown': 40, 'manhattan': 45, 'times square': 45,
    'chelsea': 40, 'soho': 40, 'tribeca': 40, 'financial district': 35,
    'brooklyn': 50, 'jersey city': 15, 'hoboken': 20,
    'msg': 40, 'madison square garden': 40,
    'flushing': 60, 'usta': 60, 'us open': 60,
  },
  'LAX': {
    'santa monica': 20, 'venice': 15, 'beverly hills': 25, 'hollywood': 30,
    'downtown': 35, 'dtla': 35, 'koreatown': 30, 'west hollywood': 30,
    'malibu': 40, 'pasadena': 45, 'burbank': 40,
    'anaheim': 40, 'disneyland': 40, 'long beach': 25,
    'sofi': 10, 'sofi stadium': 10, 'inglewood': 10, 'the forum': 10,
  },
  'ORD': {
    'downtown': 35, 'loop': 35, 'magnificent mile': 30, 'river north': 30,
    'wicker park': 25, 'lincoln park': 25, 'wrigleyville': 20, 'wrigley field': 20,
    'hyde park': 45, 'south loop': 35, 'soldier field': 35,
    'united center': 30, 'guaranteed rate field': 40,
  },
  'MDW': {
    'downtown': 25, 'loop': 25, 'magnificent mile': 30,
    'wrigleyville': 35, 'wrigley field': 35, 'hyde park': 20,
    'soldier field': 25, 'united center': 20,
  },
  'SFO': {
    'downtown': 30, 'union square': 30, 'fishermans wharf': 35, 'north beach': 35,
    'mission': 25, 'castro': 25, 'haight': 30, 'marina': 35,
    'palo alto': 20, 'stanford': 20, 'san jose': 35,
    'oracle park': 25, 'chase center': 25,
  },
  'MIA': {
    'south beach': 25, 'miami beach': 25, 'downtown': 15, 'brickell': 15,
    'wynwood': 15, 'little havana': 15, 'coconut grove': 20,
    'coral gables': 20, 'key biscayne': 25, 'hard rock stadium': 30,
  },
  'DCA': {
    'national mall': 10, 'downtown': 10, 'georgetown': 15, 'dupont circle': 15,
    'capitol hill': 10, 'white house': 12, 'adams morgan': 15,
    'arlington': 5, 'pentagon': 5, 'alexandria': 15,
  },
  'IAD': {
    'downtown': 45, 'national mall': 45, 'georgetown': 45,
    'tysons': 20, 'reston': 15, 'dulles': 5,
  },
  'BOS': {
    'downtown': 15, 'back bay': 20, 'beacon hill': 15, 'north end': 15,
    'cambridge': 25, 'harvard': 25, 'fenway': 20, 'fenway park': 20,
    'seaport': 10, 'south boston': 10,
  },
  'ATL': {
    'downtown': 15, 'midtown': 20, 'buckhead': 25, 'decatur': 25,
    'little five points': 20, 'ponce city market': 20,
  },
  'DEN': {
    'downtown': 35, 'lodo': 35, 'rino': 35, 'capitol hill': 35,
    'boulder': 60, 'golden': 50, 'coors field': 35,
  },
  'SEA': {
    'downtown': 25, 'pike place': 25, 'capitol hill': 25, 'fremont': 30,
    'ballard': 35, 'university district': 30, 't-mobile park': 25,
  },
};

/**
 * Determine whether Day 1 should route airport→venue or airport→hotel first.
 * 
 * Uses a static lookup of airport-to-area estimates. If the first must-do
 * activity is closer to the airport than the hotel AND the time window is
 * too tight for a hotel detour, returns 'venue-first'.
 */
export function determineArrivalRouting(
  arrivalAirport: string | undefined,
  arrivalTime24: string | undefined,
  firstMustDo: { name: string; startTime?: string; location?: string } | null,
  hotelAddress: string | undefined
): ArrivalRoutingDecision {
  if (!firstMustDo || !arrivalAirport || !arrivalTime24) {
    return { strategy: 'hotel-first', reason: 'Missing arrival airport, time, or must-do activity' };
  }

  const airportCode = arrivalAirport.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3);
  const airportEstimates = AIRPORT_AREA_ESTIMATES[airportCode];
  if (!airportEstimates) {
    return { strategy: 'hotel-first', reason: `No transit estimates for airport ${airportCode}` };
  }

  // Match venue against known areas
  const venueLower = (firstMustDo.name + ' ' + (firstMustDo.location || '')).toLowerCase();
  let airportToVenue = -1;
  for (const [keyword, minutes] of Object.entries(airportEstimates)) {
    if (venueLower.includes(keyword)) {
      airportToVenue = minutes;
      break;
    }
  }
  if (airportToVenue < 0) {
    return { strategy: 'hotel-first', reason: `Cannot estimate transit to "${firstMustDo.name}" from ${airportCode}` };
  }

  // Match hotel against known areas
  const hotelLower = (hotelAddress || '').toLowerCase();
  let airportToHotel = -1;
  for (const [keyword, minutes] of Object.entries(airportEstimates)) {
    if (hotelLower.includes(keyword)) {
      airportToHotel = minutes;
      break;
    }
  }
  if (airportToHotel < 0) {
    // Default hotel estimate: 45 min (conservative)
    airportToHotel = 45;
  }

  // If venue is NOT closer than hotel, always hotel-first
  if (airportToVenue >= airportToHotel) {
    return {
      strategy: 'hotel-first',
      reason: `${firstMustDo.name} (~${airportToVenue} min) is not closer than hotel (~${airportToHotel} min)`,
    };
  }

  // Venue IS closer — check if time window allows hotel detour
  const arrivalMins = parseTimeToMinutes(arrivalTime24);
  const mustDoStartTime = firstMustDo.startTime;
  const mustDoMins = mustDoStartTime ? parseTimeToMinutes(mustDoStartTime) : null;

  const deplaneBuffer = 30; // deplane + exit airport
  const hotelDetourTotal = airportToHotel + 30 + airportToHotel; // to hotel + drop bags + back to venue area

  if (mustDoMins !== null && arrivalMins !== null) {
    const timeWindow = mustDoMins - arrivalMins;
    if (timeWindow < hotelDetourTotal + deplaneBuffer) {
      return {
        strategy: 'venue-first',
        reason: `${firstMustDo.name} is ${airportToVenue} min from ${airportCode} vs ${airportToHotel} min to hotel. Only ${timeWindow} min before it starts — hotel detour would take ${hotelDetourTotal + deplaneBuffer}+ min.`,
        firstMustDoName: firstMustDo.name,
        firstMustDoStartTime: mustDoStartTime,
        estimatedAirportToVenueMinutes: airportToVenue,
        estimatedAirportToHotelMinutes: airportToHotel,
      };
    }
    return {
      strategy: 'hotel-first',
      reason: `Enough time (${timeWindow} min window) for hotel stop before ${firstMustDo.name}`,
    };
  }

  // No explicit start time — if venue is significantly closer, go venue-first
  if (airportToVenue <= airportToHotel * 0.5) {
    return {
      strategy: 'venue-first',
      reason: `${firstMustDo.name} is much closer (~${airportToVenue} min vs ~${airportToHotel} min to hotel) and no explicit start time — routing direct.`,
      firstMustDoName: firstMustDo.name,
      estimatedAirportToVenueMinutes: airportToVenue,
      estimatedAirportToHotelMinutes: airportToHotel,
    };
  }

  return {
    strategy: 'hotel-first',
    reason: `Venue is closer but not significantly (${airportToVenue} vs ${airportToHotel} min) — defaulting to hotel-first`,
  };
}

// =============================================================================
// Main: getFlightHotelContext
// =============================================================================

export async function getFlightHotelContext(
  supabase: any,
  tripId: string,
  mustDoData?: { name: string; startTime?: string; location?: string } | null
): Promise<FlightHotelContextResult> {
  console.log(`[FlightHotel] ============ CHECKING FLIGHT & HOTEL DATA ============`);
  console.log(`[FlightHotel] Trip ID: ${tripId}`);
  
  try {
    const { data: trip, error } = await supabase
      .from('trips')
      .select('flight_selection, hotel_selection, is_multi_city, flight_intelligence')
      .eq('id', tripId)
      .maybeSingle();

    if (error || !trip) {
      console.log(`[FlightHotel] ❌ Failed to fetch trip data:`, error?.message || 'No trip found');
      return { context: '' };
    }
    
    console.log(`[FlightHotel] flight_selection present: ${!!trip.flight_selection}`);
    console.log(`[FlightHotel] hotel_selection present: ${!!trip.hotel_selection}`);

    const sections: string[] = [];
    let arrivalTimeStr: string | undefined;
    let arrivalTime24: string | undefined;
    let earliestFirstActivity: string | undefined;
    let returnDepartureTimeStr: string | undefined;
    let returnDepartureTime24: string | undefined;
    let latestLastActivity: string | undefined;
    let hotelName: string | undefined;
    let hotelAddress: string | undefined;

    // Parse flight information
    const flightRaw = trip.flight_selection as Record<string, unknown> | null;
    
    if (flightRaw) {
      const flightInfo: string[] = [];
      
      const nestedDeparture = flightRaw.departure as Record<string, unknown> | undefined;
      const nestedReturn = flightRaw.return as Record<string, unknown> | undefined;
      
      const manualArrival = (nestedDeparture?.arrival as Record<string, unknown>)?.time as string | undefined;
      const searchArrival = nestedDeparture?.arrivalTime as string | undefined;
      const flatArrival = flightRaw.arrivalTime as string | undefined;
      const outboundArrival = manualArrival || searchArrival || flatArrival;
      
      const manualReturnDep = (nestedReturn?.departure as Record<string, unknown>)?.time as string | undefined;
      const searchReturnDep = nestedReturn?.departureTime as string | undefined;
      const flatReturnDep = flightRaw.returnDepartureTime as string | undefined;
      const returnDeparture = manualReturnDep || searchReturnDep || flatReturnDep;
      
      console.log(`[FlightContext] Parsing flight_selection - manual arrival: ${manualArrival}, search arrival: ${searchArrival}, flat arrival: ${flatArrival} → using: ${outboundArrival}`);
      
      const departureAirport = flightRaw.departureAirport as string | undefined;
      const arrivalAirport = flightRaw.arrivalAirport as string | undefined;
      
      if (departureAirport && arrivalAirport) {
        flightInfo.push(`✈️ Outbound: ${departureAirport} → ${arrivalAirport}`);
      }
      
      const outboundDeparture = (nestedDeparture?.departureTime as string) || (flightRaw.departureTime as string);
      if (outboundDeparture) {
        flightInfo.push(`  Departure: ${outboundDeparture}`);
      }
      
      if (outboundArrival) {
        arrivalTimeStr = outboundArrival;
        arrivalTime24 = normalizeTo24h(outboundArrival) || (outboundArrival.includes('T') ? normalizeTo24h(new Date(outboundArrival).toTimeString()) || undefined : undefined);
        flightInfo.push(`  Arrival: ${arrivalTimeStr}${arrivalTime24 ? ` (24h: ${arrivalTime24})` : ''}`);

        if (arrivalTime24) {
          const ARRIVAL_BUFFER_MINS = 4 * 60;
          earliestFirstActivity = minutesToHHMM((parseTimeToMinutes(arrivalTime24) || 0) + ARRIVAL_BUFFER_MINS);
        }

        console.log(`[FlightContext] Raw arrival: "${outboundArrival}", arrival24: ${arrivalTime24}, earliest sightseeing: ${earliestFirstActivity}`);
      }
      
      if (returnDeparture) {
        returnDepartureTimeStr = returnDeparture;
        returnDepartureTime24 = normalizeTo24h(returnDeparture) || undefined;
        flightInfo.push(`✈️ Return departure: ${returnDepartureTimeStr}`);

        if (returnDepartureTime24) {
          const DEPARTURE_BUFFER_MINS = 3 * 60;
          latestLastActivity = minutesToHHMM((parseTimeToMinutes(returnDepartureTime24) || 0) - DEPARTURE_BUFFER_MINS);
        }

        console.log(`[FlightContext] Return raw ${returnDepartureTimeStr}, return24: ${returnDepartureTime24}, latest activity: ${latestLastActivity}`);
      }

      // Flight intelligence override
      const flightIntel = trip.flight_intelligence as Record<string, unknown> | null;
      if (flightIntel) {
        const schedule = (flightIntel.destinationSchedule || flightIntel.destination_schedule) as Array<Record<string, unknown>> | undefined;
        if (schedule && Array.isArray(schedule)) {
          const firstDest = schedule.find((d: any) => d.isFirstDestination || d.is_first_destination);
          if (firstDest?.availableFrom || (firstDest as any)?.available_from) {
            const intelAvailable = ((firstDest.availableFrom || (firstDest as any).available_from) as string);
            const intelTime = intelAvailable.includes('T') ? intelAvailable.split('T')[1]?.substring(0, 5) : intelAvailable;
            if (intelTime) {
              const normalized = normalizeTo24h(intelTime);
              if (normalized) {
                earliestFirstActivity = normalized;
                const arrivalDt = (firstDest.arrivalDatetime || (firstDest as any).arrival_datetime) as string | null;
                if (arrivalDt?.includes('T')) {
                  const actualTime = arrivalDt.split('T')[1]?.substring(0, 5);
                  if (actualTime) {
                    const actualNormalized = normalizeTo24h(actualTime);
                    if (actualNormalized) {
                      arrivalTime24 = actualNormalized;
                      arrivalTimeStr = actualTime;
                    }
                  }
                }
                if (arrivalTime24) {
                  const arrivalMins = parseTimeToMinutes(arrivalTime24) || 0;
                  const earliestMins = parseTimeToMinutes(earliestFirstActivity) || 0;
                  const minEarliest = arrivalMins + 240;
                  if (earliestMins < minEarliest) {
                    earliestFirstActivity = minutesToHHMM(minEarliest);
                  }
                }
                console.log(`[FlightContext] ✈️ OVERRIDDEN by flight intelligence: arrival=${arrivalTime24}, earliest=${earliestFirstActivity}`);
              }
            }
          }
          const lastDest = schedule.find((d: any) => d.isLastDestination || d.is_last_destination);
          if (lastDest?.availableUntil || (lastDest as any)?.available_until) {
            const intelUntil = ((lastDest.availableUntil || (lastDest as any).available_until) as string);
            const untilTime = intelUntil.includes('T') ? intelUntil.split('T')[1]?.substring(0, 5) : intelUntil;
            if (untilTime) {
              const normalized = normalizeTo24h(untilTime);
              if (normalized) {
                latestLastActivity = normalized;
                console.log(`[FlightContext] ✈️ Last day OVERRIDDEN by intelligence: latest=${latestLastActivity}`);
              }
            }
          }
        }
      }
      
      if (flightInfo.length > 0) {
        let flightConstraints = `\n${'='.repeat(40)}\n✈️ FLIGHT SCHEDULE - CRITICAL CONSTRAINTS\n${'='.repeat(40)}\n${flightInfo.join('\n')}`;
        
        if (earliestFirstActivity) {
          flightConstraints += `\n\n🚨 DAY 1 TIMING CONSTRAINT:`;
          flightConstraints += `\n   - Flight lands at ${arrivalTime24 || arrivalTimeStr}`;
          flightConstraints += `\n   - Allow 4 hours for: customs/immigration, baggage, transport to hotel, check-in`;
          flightConstraints += `\n   - EARLIEST first sightseeing activity: ${earliestFirstActivity} (NOT earlier!)`;
          flightConstraints += `\n   - If arrival is late (after 6 PM), Day 1 should only include: arrival → transfer → check-in → (optional) quick dinner near hotel → rest`;
        }
        
        if (latestLastActivity) {
          flightConstraints += `\n\n🚨 LAST DAY TIMING CONSTRAINT:`;
          flightConstraints += `\n   - Return flight departs at ${returnDepartureTimeStr}`;
          flightConstraints += `\n   - Allow 3 hours for: checkout, transport to airport, check-in, security`;
          flightConstraints += `\n   - LATEST activity before airport transfer: ${latestLastActivity}`;
        }
        
        sections.push(flightConstraints);
      }
    }

    // Parse hotel information
    interface HotelInfo {
      name?: string;
      address?: string;
      neighborhood?: string;
      checkIn?: string;
      checkOut?: string;
      accommodationType?: string;
    }
    
    const hotelRaw = trip.hotel_selection;
    let hotel: HotelInfo | null = null;
    let splitStayHotels: Array<HotelInfo & { checkInDate?: string; checkOutDate?: string }> = [];
    
    if (Array.isArray(hotelRaw) && hotelRaw.length > 0) {
      if (hotelRaw.length > 1 && hotelRaw.some((h: any) => h.checkInDate)) {
        splitStayHotels = hotelRaw as Array<HotelInfo & { checkInDate?: string; checkOutDate?: string }>;
        hotel = hotelRaw[0] as HotelInfo;
        console.log(`[FlightHotel] Split stay detected: ${splitStayHotels.length} hotels`);
        
        const hotelSchedule = splitStayHotels.map((h: any, i: number) => {
          const accomType = h.accommodationType || 'hotel';
          const accomEmoji = accomType === 'airbnb' ? '🏠' : accomType === 'rental' ? '🏡' : accomType === 'hostel' ? '🛏️' : '🏨';
          return `  ${i + 1}. ${accomEmoji} ${h.name}${h.address ? ` — ${h.address}` : ''}${h.neighborhood ? ` (${h.neighborhood})` : ''}\n     Check-in: ${h.checkInDate || 'trip start'} | Check-out: ${h.checkOutDate || 'trip end'}${h.checkInTime ? ` | Time: ${h.checkInTime}` : ''}`;
        }).join('\n');
        
        sections.push(`\n${'='.repeat(40)}\n🏨 SPLIT STAY — MULTIPLE ACCOMMODATIONS\n${'='.repeat(40)}\nThis traveler is doing a SPLIT STAY with ${splitStayHotels.length} different accommodations:\n${hotelSchedule}\n\n⚠️ CRITICAL SPLIT STAY RULES:\n• Each day MUST use the correct hotel based on the date ranges above.\n• On hotel transition days: start from the outgoing hotel, check out, then check in to the new hotel.\n• Activities should be clustered near the hotel that is active for that day.\n• Day 1 of each new hotel should include check-in logistics.\n• The last day at each hotel should include check-out before the transition.`);
      } else {
        hotel = hotelRaw[0] as HotelInfo;
        hotelName = (hotel as any)?.name || '';
        hotelAddress = (hotel as any)?.address || '';
        console.log(`[FlightHotel] Parsed hotel from array: ${hotel?.name || 'No name'}`);
      }
    } else if (hotelRaw && typeof hotelRaw === 'object' && !Array.isArray(hotelRaw)) {
      hotel = hotelRaw as HotelInfo;
      console.log(`[FlightHotel] Parsed hotel from legacy object: ${hotel?.name || 'No name'}`);
    }
    
    // Multi-city fallback
    if (!hotel && trip.is_multi_city) {
      try {
        const { data: tripCities } = await supabase
          .from('trip_cities')
          .select('city_name, hotel_selection')
          .eq('trip_id', tripId)
          .order('city_order', { ascending: true });
        
        if (tripCities && tripCities.length > 0) {
          const extractHotel = (hs: any): any | null => {
            if (Array.isArray(hs) && hs.length > 0) return hs[0];
            if (hs && typeof hs === 'object' && hs.name) return hs;
            return null;
          };
          const citiesWithHotels = tripCities
            .map((c: any) => ({ ...c, _hotel: extractHotel(c.hotel_selection) }))
            .filter((c: any) => c._hotel?.name);
          if (citiesWithHotels.length > 0) {
            hotel = citiesWithHotels[0]._hotel as HotelInfo;
            console.log(`[FlightHotel] Parsed hotel from trip_cities (${citiesWithHotels[0].city_name}): ${hotel?.name || 'No name'}`);
            
            if (citiesWithHotels.length > 1) {
              const hotelSummary = citiesWithHotels.map((c: any) => 
                `• ${c.city_name}: ${c._hotel.name}${c._hotel.address ? ` (${c._hotel.address})` : ''}`
              ).join('\n');
              sections.push(`\n${'='.repeat(40)}\n🏨 PER-CITY ACCOMMODATIONS\n${'='.repeat(40)}\n${hotelSummary}\n⚠️ Each city has its own hotel. Use the correct hotel as the daily base for that city's days.`);
            }
          }
        }
      } catch (e) {
        console.warn(`[FlightHotel] Failed to read trip_cities hotels:`, e);
      }
    }
    
    // Standard hotel context
    if (hotel && splitStayHotels.length === 0) {
      const hotelInfo: string[] = [];
      const accomType = (hotel as any).accommodationType || 'hotel';
      const accomEmoji = accomType === 'airbnb' ? '🏠' : accomType === 'rental' ? '🏡' : accomType === 'hostel' ? '🛏️' : '🏨';
      const accomLabel = accomType === 'airbnb' ? 'Airbnb' : accomType === 'rental' ? 'Vacation Rental' : accomType === 'hostel' ? 'Hostel' : 'Hotel';
      if (hotel.name) {
        hotelInfo.push(`${accomEmoji} ${accomLabel}: ${hotel.name}`);
        hotelName = hotel.name;
      }
      if (hotel.address) {
        hotelInfo.push(`   Address: ${hotel.address}`);
        hotelAddress = hotel.address;
      }
      if (hotel.neighborhood) {
        hotelInfo.push(`   Neighborhood: ${hotel.neighborhood}`);
      }
      if (hotelInfo.length > 0) {
        sections.push(`\n${'='.repeat(40)}\n${accomEmoji} ACCOMMODATION — ${accomLabel.toUpperCase()} (Use as daily starting/ending point)\n${'='.repeat(40)}\n${hotelInfo.join('\n')}\n⚠️ Start each day from the ${accomLabel.toLowerCase()} area and end nearby for easy return.\n⚠️ CRITICAL: Day 1 activities must NOT begin before check-in is complete. Standard check-in is 3:00 PM - do not schedule sightseeing before this unless arrival is very early.`);
      }
    } else if (!hotel) {
      console.log(`[FlightHotel] ⚠️ NO HOTEL DATA FOUND - hotel_selection is empty or missing`);
      console.log(`[FlightHotel] Raw hotel_selection value:`, JSON.stringify(hotelRaw));
    }

    return {
      context: sections.join('\n'),
      arrivalTime: arrivalTimeStr,
      arrivalTime24,
      earliestFirstActivityTime: earliestFirstActivity,
      returnDepartureTime: returnDepartureTimeStr,
      returnDepartureTime24,
      latestLastActivityTime: latestLastActivity,
      hotelName,
      hotelAddress,
      arrivalAirport: (flightRaw?.arrivalAirport as string) || undefined,
      rawFlightSelection: trip.flight_selection,
      rawHotelSelection: trip.hotel_selection,
      rawFlightIntelligence: trip.flight_intelligence,
    };
  } catch (e) {
    console.error('[FlightHotel] Error:', e);
    return { context: '' };
  }
}
