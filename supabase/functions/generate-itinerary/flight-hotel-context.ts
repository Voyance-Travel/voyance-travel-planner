/**
 * Flight & Hotel Context Module
 * Extracts flight and hotel data from trip records and formats them
 * as AI prompt context with timing constraints.
 */

// =============================================================================
// Types
// =============================================================================

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
// Main: getFlightHotelContext
// =============================================================================

export async function getFlightHotelContext(supabase: any, tripId: string): Promise<FlightHotelContextResult> {
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
            const intelAvailable = ((firstDest!.availableFrom || (firstDest as any).available_from) as string);
            const intelTime = intelAvailable.includes('T') ? intelAvailable.split('T')[1]?.substring(0, 5) : intelAvailable;
            if (intelTime) {
              const normalized = normalizeTo24h(intelTime);
              if (normalized) {
                earliestFirstActivity = normalized;
                const arrivalDt = (firstDest!.arrivalDatetime || (firstDest as any).arrival_datetime) as string | null;
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
            const intelUntil = ((lastDest!.availableUntil || (lastDest as any).available_until) as string);
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
    if (trip.is_multi_city) {
      try {
        const { data: tripCities } = await supabase
          .from('trip_cities')
          .select('city_name, hotel_selection, arrival_date, departure_date')
          .eq('trip_id', tripId)
          .order('city_order', { ascending: true });
        
        if (tripCities && tripCities.length > 0) {
          // Extract ALL hotels per city (not just first) to support split stays
          const extractAllHotels = (hs: any): any[] => {
            if (Array.isArray(hs) && hs.length > 0) return hs.filter((h: any) => h?.name);
            if (hs && typeof hs === 'object' && hs.name) return [hs];
            return [];
          };

          const citiesWithHotels = tripCities
            .map((c: any) => ({ ...c, _hotels: extractAllHotels(c.hotel_selection) }))
            .filter((c: any) => c._hotels.length > 0);

          if (citiesWithHotels.length > 0) {
            // Set primary hotel from first city's first hotel
            hotel = citiesWithHotels[0]._hotels[0] as HotelInfo;
            hotelName = (hotel as any)?.name || '';
            hotelAddress = (hotel as any)?.address || '';
            console.log(`[FlightHotel] Parsed hotel from trip_cities (${citiesWithHotels[0].city_name}): ${hotel?.name || 'No name'}`);

            // Check if ANY city has multiple hotels (split stay within a city)
            const anyCityHasSplitStay = citiesWithHotels.some((c: any) => c._hotels.length > 1);

            if (anyCityHasSplitStay) {
              // Build combined split-stay schedule from all cities
              splitStayHotels = citiesWithHotels.flatMap((c: any) =>
                c._hotels.map((h: any) => ({
                  ...h,
                  checkInDate: h.checkInDate || c.arrival_date || undefined,
                  checkOutDate: h.checkOutDate || c.departure_date || undefined,
                }))
              );

              console.log(`[FlightHotel] Multi-city split stay detected: ${splitStayHotels.length} hotels across ${citiesWithHotels.length} cities`);

              const hotelSchedule = splitStayHotels.map((h: any, i: number) => {
                const accomType = h.accommodationType || 'hotel';
                const accomEmoji = accomType === 'airbnb' ? '🏠' : accomType === 'rental' ? '🏡' : accomType === 'hostel' ? '🛏️' : '🏨';
                return `  ${i + 1}. ${accomEmoji} ${h.name}${h.address ? ` — ${h.address}` : ''}${h.neighborhood ? ` (${h.neighborhood})` : ''}\n     Check-in: ${h.checkInDate || 'trip start'} | Check-out: ${h.checkOutDate || 'trip end'}${h.checkInTime ? ` | Time: ${h.checkInTime}` : ''}`;
              }).join('\n');

              sections.push(`\n${'='.repeat(40)}\n🏨 SPLIT STAY — MULTIPLE ACCOMMODATIONS\n${'='.repeat(40)}\nThis traveler is doing a SPLIT STAY with ${splitStayHotels.length} different accommodations:\n${hotelSchedule}\n\n⚠️ CRITICAL SPLIT STAY RULES:\n• Each day MUST use the correct hotel based on the date ranges above.\n• On hotel transition days: start from the outgoing hotel, check out, then check in to the new hotel.\n• Activities should be clustered near the hotel that is active for that day.\n• Day 1 of each new hotel should include check-in logistics.\n• The last day at each hotel should include check-out before the transition.`);
            } else if (citiesWithHotels.length > 1) {
              // Multiple cities but each has only one hotel — per-city summary
              const hotelSummary = citiesWithHotels.map((c: any) => 
                `• ${c.city_name}: ${c._hotels[0].name}${c._hotels[0].address ? ` (${c._hotels[0].address})` : ''}`
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
      arrivalAirport: (() => {
        // Prefer legs[].arrival.airport (same logic as prompt-library.ts)
        const legs = Array.isArray(flightRaw?.legs) ? flightRaw.legs as any[] : [];
        if (legs.length > 0) {
          const destLeg = legs.find((l: any) => l.isDestinationArrival) || legs[0];
          const legAirport = destLeg?.arrival?.airport;
          if (legAirport) return legAirport as string;
        }
        // Fallback to flat field
        return (flightRaw?.arrivalAirport as string) || undefined;
      })(),
      rawFlightSelection: trip.flight_selection,
      rawHotelSelection: trip.hotel_selection,
      rawFlightIntelligence: trip.flight_intelligence,
    };
  } catch (e) {
    console.error('[FlightHotel] Error:', e);
    return { context: '' };
  }
}

// =============================================================================
// Arrival / Departure Timing Enforcement — shared, reusable functions
// =============================================================================

const TRANSPORT_CATS = ['TRANSPORT', 'TRAVEL', 'FLIGHT', 'TRANSIT'];

/**
 * Filter out activities that start before arrival + 2h buffer.
 * Preserves transport, flight, transit, and check-in activities.
 */
export function enforceArrivalTiming(activities: any[], arrivalTime24: string): any[] {
  const arrivalMins = parseTimeToMinutes(arrivalTime24) || 0;
  if (arrivalMins <= 0) return activities;

  const earliestAllowed = arrivalMins + 120; // 2 hours after landing
  const before = activities.length;

  const filtered = activities.filter((a: any) => {
    const cat = ((a.category || '') as string).toUpperCase();
    if (TRANSPORT_CATS.includes(cat)) return true;
    if ((cat === 'STAY' || cat === 'ACCOMMODATION') && /check.?in/i.test(a.title || '')) return true;
    if (/arrival|landing|airport/i.test(a.title || '')) return true;

    const actMins = parseTimeToMinutes(a.startTime || a.start_time || '') || 0;
    if (actMins > 0 && actMins < earliestAllowed) {
      console.warn(`[ARRIVAL] Removed "${a.title}" at ${a.startTime || a.start_time} — before arrival + 2h (${arrivalTime24} + 2h = ${minutesToHHMM(earliestAllowed)})`);
      return false;
    }
    return true;
  });

  if (filtered.length < before) {
    console.log(`[enforceArrivalTiming] Removed ${before - filtered.length} activities before arrival buffer`);
  }
  return filtered;
}

/**
 * Filter out activities that start after departure - buffer.
 * Buffer: 120 min for trains, 180 min for flights (default).
 * Preserves transport, flight, transit, departure, and check-out activities.
 */
export function enforceDepartureTiming(activities: any[], departureTime24: string, transportType?: string): any[] {
  const departureMins = parseTimeToMinutes(departureTime24) || 0;
  if (departureMins <= 0) return activities;

  const isTrain = transportType && /train|rail|eurostar|tgv|thalys/i.test(transportType);
  const bufferMins = isTrain ? 120 : 180;
  const latestAllowed = departureMins - bufferMins;
  if (latestAllowed <= 0) return activities;

  const before = activities.length;

  const filtered = activities.filter((a: any) => {
    const cat = ((a.category || '') as string).toUpperCase();
    if (TRANSPORT_CATS.includes(cat)) return true;
    if ((cat === 'STAY' || cat === 'ACCOMMODATION') && /check.?out/i.test(a.title || '')) return true;
    if (/departure|heading home|airport|station/i.test(a.title || '')) return true;

    const actMins = parseTimeToMinutes(a.startTime || a.start_time || '') || 0;
    if (actMins > 0 && actMins > latestAllowed) {
      console.warn(`[DEPARTURE] Removed "${a.title}" at ${a.startTime || a.start_time} — after departure - ${bufferMins / 60}h (${departureTime24} - ${bufferMins / 60}h = ${minutesToHHMM(latestAllowed)}) [transport: ${transportType || 'flight'}]`);
      return false;
    }
    return true;
  });

  if (filtered.length < before) {
    console.log(`[enforceDepartureTiming] Removed ${before - filtered.length} activities after departure buffer (${bufferMins}min for ${transportType || 'flight'})`);
  }
  return filtered;
}
