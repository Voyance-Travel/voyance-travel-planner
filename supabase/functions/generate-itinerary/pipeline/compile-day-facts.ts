/**
 * compile-day-facts.ts — Extract deterministic truth from trip data.
 *
 * Phase 2: This module consolidates the fact-gathering logic that was
 * previously inline in action-generate-day.ts (lines ~294–880, ~1682–1751).
 *
 * Responsibilities:
 * - Transition day resolution from trip_cities
 * - Locked activity loading from DB / JSON / legacy fallback
 * - Flight/hotel context fetch + per-city overrides + preference fallbacks
 * - Transport preference resolution
 * - Pre-resolution of airport display name and transfer minutes
 *
 * All DB reads happen here. The downstream schema compiler is pure.
 */

import type { LockedActivity, CompiledFacts } from './types.ts';
import {
  parseTimeToMinutes,
  minutesToHHMM,
  addMinutesToHHMM,
  normalizeTo24h,
  getFlightHotelContext,
} from '../flight-hotel-context.ts';
import { getAirportTransferMinutes } from '../generation-utils.ts';

export async function compileDayFacts(
  supabase: any,
  userId: string,
  params: Record<string, any>,
): Promise<CompiledFacts> {
  const {
    tripId, dayNumber, totalDays, destination, destinationCountry, date,
    travelers, preferences, keepActivities, currentActivities,
    isMultiCity: paramIsMultiCity, isTransitionDay: paramIsTransitionDay,
    transitionFrom: paramTransitionFrom, transitionTo: paramTransitionTo,
    transitionMode: paramTransitionMode,
    hotelOverride: paramHotelOverride,
    isFirstDayInCity: paramIsFirstDayInCity, isLastDayInCity: paramIsLastDayInCity,
  } = params;

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSITION DAY RESOLVER
  // ═══════════════════════════════════════════════════════════════════════
  let resolvedIsTransitionDay = !!paramIsTransitionDay;
  let resolvedTransitionFrom = paramTransitionFrom || '';
  let resolvedTransitionTo = paramTransitionTo || '';
  let resolvedTransportMode = paramTransitionMode || '';
  let resolvedTransportDetails: any = null;
  let resolvedNextLegTransport = '';
  let resolvedNextLegCity = '';
  let resolvedNextLegTransportDetails: any = null;
  let resolvedHotelOverride: any = paramHotelOverride || null;
  let resolvedIsMultiCity = !!paramIsMultiCity;
  let resolvedIsLastDayInCity = !!paramIsLastDayInCity;
  let resolvedDestination = destination;
  let resolvedCountry = destinationCountry;
  let resolvedIsHotelChange = false;
  let resolvedPreviousHotelName: string | undefined = undefined;
  let resolvedPreviousHotelAddress: string | undefined = undefined;

  if (tripId && !resolvedIsTransitionDay) {
    try {
      const { data: tripCities } = await supabase
        .from('trip_cities')
        .select('city_name, country, city_order, nights, days_total, transition_day_mode, transport_type, transport_details, hotel_selection')
        .eq('trip_id', tripId)
        .order('city_order', { ascending: true });

      if (tripCities && tripCities.length > 1) {
        resolvedIsMultiCity = true;

        // ── Build a full day→hotel map for hotel-change detection ──
        // We need the trip's actual start date to anchor dates correctly
        let tripStartDate: string | undefined;
        if (tripId) {
          try {
            const { data: tripRow } = await supabase
              .from('trips')
              .select('start_date')
              .eq('id', tripId)
              .single();
            tripStartDate = tripRow?.start_date || undefined;
          } catch (_e) { /* non-blocking */ }
        }
        // Fallbacks: preferences, then request date minus dayNumber offset
        if (!tripStartDate && params.preferences?.startDate) {
          tripStartDate = params.preferences.startDate;
        }
        if (!tripStartDate && date && dayNumber) {
          // date is for the current day; compute trip start by subtracting dayNumber-1 days
          const d = new Date(typeof date === 'string' ? date.split('T')[0] : date);
          d.setDate(d.getDate() - (dayNumber - 1));
          tripStartDate = d.toISOString().split('T')[0];
        }

        type DayHotelEntry = { hotelName?: string; hotelAddress?: string; cityName: string };
        const dayHotelMap: DayHotelEntry[] = [];

        let dayCounter = 0;
        for (const city of tripCities) {
          const cityNights = (city as any).nights || (city as any).days_total || 1;
          const rawHotel = (city as any).hotel_selection;
          const hotelList: any[] = Array.isArray(rawHotel) ? rawHotel : (rawHotel ? [rawHotel] : []);

          for (let n = 0; n < cityNights; n++) {
            dayCounter++;

            // Date-aware hotel resolution for split-stays
            let cityHotel: any = null;
            if (hotelList.length > 1 && tripStartDate) {
              const dayDateObj = new Date(tripStartDate);
              dayDateObj.setDate(dayDateObj.getDate() + (dayCounter - 1));
              const dateStr = dayDateObj.toISOString().split('T')[0];

              cityHotel = hotelList.find((h: any) => {
                const cin = h.checkInDate || h.check_in_date;
                const cout = h.checkOutDate || h.check_out_date;
                if (!cin && cout && dateStr < cout) return true;
                return cin && cout && dateStr >= cin && dateStr < cout;
              });
              if (!cityHotel) {
                const daysPerHotel = Math.max(1, Math.floor(cityNights / hotelList.length));
                const hotelIndex = Math.min(Math.floor(n / daysPerHotel), hotelList.length - 1);
                cityHotel = hotelList[hotelIndex];
                console.log(`[compile-day-facts] Split-stay date inference: day ${n} of ${cityNights} → hotel[${hotelIndex}] "${cityHotel?.name}"`);
              }
            } else {
              cityHotel = hotelList[0] || null;
            }

            dayHotelMap.push({
              hotelName: cityHotel?.name || undefined,
              hotelAddress: cityHotel?.address || undefined,
              cityName: city.city_name,
            });

            if (dayCounter === dayNumber) {
              resolvedDestination = city.city_name || destination;
              resolvedCountry = (city as any).country || destinationCountry;

              // Set hotel override from date-aware map (authoritative)
              if (cityHotel?.name) {
                resolvedHotelOverride = {
                  name: cityHotel.name,
                  address: cityHotel.address,
                  neighborhood: cityHotel.neighborhood,
                  checkIn: cityHotel.checkIn || cityHotel.checkInTime || cityHotel.check_in,
                  checkOut: cityHotel.checkOut || cityHotel.checkOutTime || cityHotel.check_out,
                };
                console.log(`[compile-day-facts] Per-city hotel: "${cityHotel.name}" for ${resolvedDestination}`);
              }

              // Check last day in city → capture next leg transport
              if (n === cityNights - 1) {
                resolvedIsLastDayInCity = true;
                const nextCity = tripCities.find((c: any) => c.city_order === city.city_order + 1);
                if (nextCity) {
                  const isSameCountry = nextCity.country === city.country;
                  resolvedNextLegTransport = (nextCity as any).transport_type || (isSameCountry ? 'train' : 'flight');
                  resolvedNextLegCity = nextCity.city_name || '';
                  if ((nextCity as any).transport_details) {
                    const rawNext = (nextCity as any).transport_details;
                    resolvedNextLegTransportDetails = { ...rawNext };
                    if (rawNext.operator && !rawNext.carrier) resolvedNextLegTransportDetails.carrier = rawNext.operator;
                    if (!rawNext.duration && rawNext.inTransitDuration) resolvedNextLegTransportDetails.duration = rawNext.inTransitDuration;
                    if (resolvedNextLegTransport === 'car') {
                      if (rawNext.pickupLocation && !rawNext.departureStation) resolvedNextLegTransportDetails.departureStation = rawNext.pickupLocation;
                      if (rawNext.rentalCompany && !rawNext.carrier) resolvedNextLegTransportDetails.carrier = rawNext.rentalCompany;
                    }
                  }
                }
              }
              if (n === 0 && city.city_order > 0 && (city as any).transition_day_mode !== 'skip') {
                resolvedIsTransitionDay = true;
                const prevCity = tripCities.find((c: any) => c.city_order === city.city_order - 1);
                resolvedTransitionFrom = prevCity?.city_name || '';
                resolvedTransitionTo = city.city_name || '';
                resolvedTransportMode = (city as any).transport_type || 'train';
                if ((city as any).transport_details) {
                  const raw = (city as any).transport_details;
                  const td: any = { ...raw };
                  if (raw.operator && !raw.carrier) td.carrier = raw.operator;
                  if (resolvedTransportMode === 'flight') {
                    if (raw.departureStation && !raw.departureAirport) td.departureAirport = raw.departureStation;
                    if (raw.arrivalStation && !raw.arrivalAirport) td.arrivalAirport = raw.arrivalStation;
                  }
                  if (resolvedTransportMode === 'car') {
                    if (raw.pickupLocation && !raw.departureStation) td.departureStation = raw.pickupLocation;
                    if (raw.dropoffLocation && !raw.arrivalStation) td.arrivalStation = raw.dropoffLocation;
                    if (raw.rentalCompany && !raw.carrier) td.carrier = raw.rentalCompany;
                  }
                  if (!raw.duration) {
                    if (raw.inTransitDuration) td.duration = raw.inTransitDuration;
                    else if (raw.doorToDoorDuration) td.duration = raw.doorToDoorDuration;
                  }
                  resolvedTransportDetails = td;
                }
              }
              // Don't break yet — continue building the map for context
            }
          }
          if (dayCounter >= dayNumber) break;
        }

        // ── Hotel-change detection from the day→hotel map ──
        const currentIdx = dayNumber - 1;
        if (currentIdx > 0 && currentIdx < dayHotelMap.length) {
          const currentEntry = dayHotelMap[currentIdx];
          const prevEntry = dayHotelMap[currentIdx - 1];
          if (
            prevEntry.cityName === currentEntry.cityName &&
            prevEntry.hotelName &&
            currentEntry.hotelName &&
            prevEntry.hotelName !== currentEntry.hotelName
          ) {
          if (
            prevEntry.cityName === currentEntry.cityName &&
            prevEntry.hotelName &&
            currentEntry.hotelName &&
            prevEntry.hotelName !== currentEntry.hotelName
          ) {
            resolvedIsHotelChange = true;
            resolvedPreviousHotelName = prevEntry.hotelName;
            resolvedPreviousHotelAddress = prevEntry.hotelAddress;
            console.log(`[compile-day-facts] Hotel change detected on day ${dayNumber}: "${prevEntry.hotelName}" → "${currentEntry.hotelName}"`);
          }
        }

        console.log(`[compile-day-facts] Transition resolver: day=${dayNumber}, isTransition=${resolvedIsTransitionDay}, from=${resolvedTransitionFrom}, to=${resolvedTransitionTo}, mode=${resolvedTransportMode}`);
      }

      // ═══════════════════════════════════════════════════════════════════
      // SINGLE-CITY SPLIT-STAY RESOLVER
      // When resolvedHotelOverride is still null (no trip_cities hotel),
      // check trips.hotel_selection for split-stay date matching.
      // ═══════════════════════════════════════════════════════════════════
      if (!resolvedHotelOverride?.name && tripId) {
        try {
          const { data: tripRow } = await supabase
            .from('trips')
            .select('hotel_selection, start_date')
            .eq('id', tripId)
            .single();

          if (tripRow?.hotel_selection) {
            const rawHotel = tripRow.hotel_selection as any;
            const hotelList: any[] = Array.isArray(rawHotel) ? rawHotel : (rawHotel && typeof rawHotel === 'object' && rawHotel.name ? [rawHotel] : []);

            if (hotelList.length > 1) {
              // Use trip start_date for correct date anchoring
              let singleCityStartDate = tripRow.start_date || params.preferences?.startDate;
              if (!singleCityStartDate && date && dayNumber) {
                const d = new Date(typeof date === 'string' ? date.split('T')[0] : date);
                d.setDate(d.getDate() - (dayNumber - 1));
                singleCityStartDate = d.toISOString().split('T')[0];
              }

              // Build day→hotel map for the entire trip to detect changes
              const singleCityHotelMap: Array<{ hotelName?: string; hotelAddress?: string }> = [];
              for (let d = 0; d < totalDays; d++) {
                let dayHotel: any = null;
                if (singleCityStartDate) {
                  const dayDateObj = new Date(singleCityStartDate);
                  dayDateObj.setDate(dayDateObj.getDate() + d);
                  const dateStr = dayDateObj.toISOString().split('T')[0];
                  dayHotel = hotelList.find((h: any) => {
                    const cin = h.checkInDate || h.check_in_date;
                    const cout = h.checkOutDate || h.check_out_date;
                    if (!cin && cout && dateStr < cout) return true;
                    return cin && cout && dateStr >= cin && dateStr < cout;
                  });
                }
                if (!dayHotel) {
                  const daysPerHotel = Math.max(1, Math.floor(totalDays / hotelList.length));
                  const hotelIndex = Math.min(Math.floor(d / daysPerHotel), hotelList.length - 1);
                  dayHotel = hotelList[hotelIndex];
                }
                singleCityHotelMap.push({ hotelName: dayHotel?.name || undefined, hotelAddress: dayHotel?.address || undefined });
              }

              // Resolve current day's hotel
              const currentDayHotel = singleCityHotelMap[dayNumber - 1];
              const matchedHotel = hotelList.find((h: any) => h.name === currentDayHotel?.hotelName);
              if (matchedHotel?.name) {
                resolvedHotelOverride = {
                  name: matchedHotel.name,
                  address: matchedHotel.address,
                  neighborhood: matchedHotel.neighborhood,
                  checkIn: matchedHotel.checkIn || matchedHotel.checkInTime || matchedHotel.check_in,
                  checkOut: matchedHotel.checkOut || matchedHotel.checkOutTime || matchedHotel.check_out,
                };
                console.log(`[compile-day-facts] Single-city split-stay hotel resolved: "${matchedHotel.name}" for day ${dayNumber}`);
              }

              // Detect hotel change
              if (dayNumber > 1) {
                const prevDayHotel = singleCityHotelMap[dayNumber - 2];
                if (
                  prevDayHotel?.hotelName &&
                  currentDayHotel?.hotelName &&
                  prevDayHotel.hotelName !== currentDayHotel.hotelName
                ) {
                  resolvedIsHotelChange = true;
                  resolvedPreviousHotelName = prevDayHotel.hotelName;
                  resolvedPreviousHotelAddress = prevDayHotel.hotelAddress;
                  console.log(`[compile-day-facts] Single-city hotel change on day ${dayNumber}: "${prevDayHotel.hotelName}" → "${currentDayHotel.hotelName}"`);
                }
              }
            } else if (hotelList.length === 1 && hotelList[0]?.name) {
              resolvedHotelOverride = {
                name: hotelList[0].name,
                address: hotelList[0].address,
                neighborhood: hotelList[0].neighborhood,
                checkIn: hotelList[0].checkIn || hotelList[0].checkInTime || hotelList[0].check_in,
                checkOut: hotelList[0].checkOut || hotelList[0].checkOutTime || hotelList[0].check_out,
              };
              console.log(`[compile-day-facts] Single hotel resolved: "${hotelList[0].name}" for day ${dayNumber}`);
            }
          }
        } catch (e) {
          console.warn('[compile-day-facts] Single-city split-stay resolver error (non-blocking):', e);
        }
      }
    } catch (e) {
      console.warn('[compile-day-facts] Could not resolve transition context:', e);
    }
  } else if (resolvedIsTransitionDay) {
    console.log(`[compile-day-facts] Using explicit transition params: from=${resolvedTransitionFrom}, to=${resolvedTransitionTo}, mode=${resolvedTransportMode}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LOCKED ACTIVITIES
  // ═══════════════════════════════════════════════════════════════════════
  let lockedActivities: LockedActivity[] = [];

  // 1) Normalized table
  if (tripId) {
    const { data: dayRow } = await supabase
      .from('itinerary_days')
      .select('id')
      .eq('trip_id', tripId)
      .eq('day_number', dayNumber)
      .maybeSingle();

    if (dayRow) {
      const { data: lockedFromDb } = await supabase
        .from('itinerary_activities')
        .select('*')
        .eq('trip_id', tripId)
        .eq('itinerary_day_id', dayRow.id)
        .eq('is_locked', true);

      if (lockedFromDb && lockedFromDb.length > 0) {
        lockedActivities = lockedFromDb.map((a: any) => ({
          id: a.id,
          title: a.title,
          name: a.name || a.title,
          description: a.description || undefined,
          category: a.category || 'activity',
          startTime: a.start_time || '09:00',
          endTime: a.end_time || '10:00',
          durationMinutes: a.duration_minutes || 60,
          location: a.location as { name?: string; address?: string } || { name: '', address: '' },
          cost: a.cost as { amount: number; currency: string } || { amount: 0, currency: 'USD' },
          isLocked: true,
          tags: a.tags || [],
          bookingRequired: a.booking_required || false,
          tips: a.tips || undefined,
          photos: a.photos,
          transportation: a.transportation,
          rating: a.rating,
          website: a.website,
          viatorProductCode: a.viator_product_code,
          walkingDistance: a.walking_distance,
          walkingTime: a.walking_time,
        }));
        console.log(`[compile-day-facts] ${lockedActivities.length} locked activities from DB for day ${dayNumber}`);
      }
    }
  }

  // 2) JSON fallback
  if (lockedActivities.length === 0 && tripId) {
    const { data: tripData } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .single();

    if (tripData?.itinerary_data) {
      const itineraryData = tripData.itinerary_data as any;
      const dayData = itineraryData.days?.find((d: any) => d.dayNumber === dayNumber);
      if (dayData) {
        const lockedFromJson = dayData.activities.filter((a: any) => a.isLocked);
        if (lockedFromJson.length > 0) {
          lockedActivities = lockedFromJson.map((a: any) => ({
            id: a.id,
            title: a.title || a.name || 'Activity',
            name: a.name || a.title,
            description: a.description,
            category: a.category || 'activity',
            startTime: a.startTime || '09:00',
            endTime: a.endTime || '10:00',
            location: a.location as { name?: string; address?: string },
            cost: a.cost as { amount: number; currency: string },
            isLocked: true,
          }));
          console.log(`[compile-day-facts] ${lockedActivities.length} locked activities from JSON for day ${dayNumber}`);
        }
      }
    }
  }

  // 3) Legacy fallback
  if (lockedActivities.length === 0 && keepActivities && keepActivities.length > 0 && currentActivities) {
    for (const act of currentActivities) {
      if (keepActivities.includes(act.id) && act.isLocked) {
        lockedActivities.push({
          id: act.id,
          title: act.title || act.name || 'Activity',
          name: act.name || act.title,
          description: act.description,
          category: act.category,
          startTime: act.startTime || '09:00',
          endTime: act.endTime || '10:00',
          durationMinutes: act.durationMinutes,
          location: act.location,
          cost: act.cost || act.estimatedCost,
          isLocked: true,
          tags: act.tags,
          bookingRequired: act.bookingRequired,
          tips: act.tips,
          photos: act.photos,
          transportation: act.transportation,
        });
      }
    }
    if (lockedActivities.length > 0) {
      console.log(`[compile-day-facts] ${lockedActivities.length} locked activities from request (legacy)`);
    }
  }

  // Build locked slots instruction
  let lockedSlotsInstruction = '';
  if (lockedActivities.length > 0) {
    const lockedSlotsList = lockedActivities
      .sort((a, b) => (parseTimeToMinutes(a.startTime) ?? 0) - (parseTimeToMinutes(b.startTime) ?? 0))
      .map(a => `- "${a.title}" from ${a.startTime} to ${a.endTime} (category: ${a.category})`)
      .join('\n');

    lockedSlotsInstruction = `
LOCKED ACTIVITIES - DO NOT REGENERATE THESE TIME SLOTS:
The user has locked the following activities. These are FIXED and CANNOT be changed.
You must NOT generate any activities that overlap with these time slots.
Plan activities ONLY for the available gaps between these locked blocks.

Do NOT generate any activity that is similar in type or theme to a locked activity.
For example, if "Comedy Show" is locked, do NOT suggest "Stand-Up Night" or any other comedy activity.
If "US Open" is locked, do NOT suggest "Tennis Match" or any other tennis event.
Each locked activity is unique — do not create alternatives, variations, or substitutes.

${lockedSlotsList}

Generate activities ONLY for the remaining unlocked time periods. 
DO NOT create any activity that starts or ends within a locked time slot.`;

    console.log(`[compile-day-facts] Added ${lockedActivities.length} locked slots to prompt`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FLIGHT/HOTEL CONTEXT + OVERRIDES
  // ═══════════════════════════════════════════════════════════════════════
  let flightContext = tripId ? await getFlightHotelContext(supabase, tripId) : { context: '' };

  // Per-city hotel override
  if (resolvedHotelOverride && resolvedHotelOverride.name) {
    flightContext = {
      ...flightContext,
      hotelName: resolvedHotelOverride.name,
      hotelAddress: resolvedHotelOverride.address || flightContext.hotelAddress,
    };
    console.log(`[compile-day-facts] Hotel override: "${resolvedHotelOverride.name}"`);
    const hotelEnforcement = `\n\n🏨 ACCOMMODATION FOR THIS DAY: "${resolvedHotelOverride.name}"${resolvedHotelOverride.address ? ` — ${resolvedHotelOverride.address}` : ''}.${resolvedHotelOverride.neighborhood ? ` Neighborhood: ${resolvedHotelOverride.neighborhood}.` : ''}\n🚫 CRITICAL: Use "${resolvedHotelOverride.name}" for ALL accommodation references. Do NOT invent or substitute a different hotel name.`;
    flightContext = { ...flightContext, context: (flightContext.context || '') + hotelEnforcement };
  }

  const isFirstDay = dayNumber === 1;
  const isLastDay = dayNumber === totalDays;

  // Preference-based arrival/departure time fallbacks
  if (preferences?.arrivalTime && !flightContext.arrivalTime) {
    const arrival24 = normalizeTo24h(preferences.arrivalTime) || preferences.arrivalTime;
    const ARRIVAL_BUFFER_MINS = 4 * 60;
    const earliestActivity = minutesToHHMM((parseTimeToMinutes(arrival24) || 0) + ARRIVAL_BUFFER_MINS);
    flightContext = {
      ...flightContext,
      arrivalTime: preferences.arrivalTime,
      arrivalTime24: arrival24,
      earliestFirstActivityTime: earliestActivity,
      context: flightContext.context || `Flight arrives at ${preferences.arrivalTime}. Plan Day 1 activities after ${earliestActivity}.`,
    };
    console.log(`[compile-day-facts] Arrival from preferences: ${preferences.arrivalTime}, earliest activity: ${earliestActivity}`);
  }

  if (preferences?.departureTime && !flightContext.returnDepartureTime) {
    const departure24 = normalizeTo24h(preferences.departureTime) || preferences.departureTime;
    const latestActivity = addMinutesToHHMM(departure24, -180);
    flightContext = {
      ...flightContext,
      returnDepartureTime: preferences.departureTime,
      returnDepartureTime24: departure24,
      latestLastActivityTime: latestActivity,
      context: (flightContext.context || '') + ` Return flight departs at ${preferences.departureTime}. Last activity must end by ${latestActivity}.`,
    };
    console.log(`[compile-day-facts] Departure from preferences: ${preferences.departureTime}, latest activity: ${latestActivity}`);
  }

  console.log(`[compile-day-facts] Day ${dayNumber}/${totalDays}, isFirst=${isFirstDay}, isLast=${isLastDay}, isLastInCity=${resolvedIsLastDayInCity}, nextLeg=${resolvedNextLegTransport}→${resolvedNextLegCity}, locked=${lockedActivities.length}`);

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSPORT PREFERENCES
  // ═══════════════════════════════════════════════════════════════════════
  const transportModesFromRequest = preferences?.transportationModes as string[] | undefined;
  const primaryTransportFromRequest = preferences?.primaryTransport as string | undefined;
  const hasRentalCarFromRequest = preferences?.hasRentalCar as boolean | undefined;

  let resolvedTransportModes: string[] = transportModesFromRequest || [];
  let resolvedPrimaryTransport: string | undefined = primaryTransportFromRequest;
  let resolvedHasRentalCar: boolean = hasRentalCarFromRequest || false;

  if (resolvedTransportModes.length === 0 && tripId) {
    try {
      const { data: tripTransport } = await supabase
        .from('trips')
        .select('transportation_preferences')
        .eq('id', tripId)
        .single();

      if (tripTransport?.transportation_preferences) {
        const tp = tripTransport.transportation_preferences as any;
        if (Array.isArray(tp)) {
          resolvedTransportModes = tp.map((t: any) => t.type || t.mode).filter(Boolean);
        } else if (tp.modes) {
          resolvedTransportModes = tp.modes;
          resolvedPrimaryTransport = tp.primaryMode;
          resolvedHasRentalCar = tp.modes?.includes('rental_car') || false;
        }
      }
    } catch (e) {
      console.warn('[compile-day-facts] Could not fetch transport preferences:', e);
    }
  }

  let transportPreferencePrompt = '';
  if (resolvedTransportModes.length > 0) {
    const modeLabels: Record<string, string> = {
      'walking': 'Walking',
      'public_transit': 'Public transit (metro, bus, tram)',
      'rideshare': 'Rideshare/Taxi (Uber, Lyft, local taxi)',
      'rental_car': 'Rental car (driving)',
      'train': 'Train', 'bus': 'Bus', 'car': 'Car', 'ferry': 'Ferry', 'flight': 'Flight',
    };
    const modeList = resolvedTransportModes.map(m => modeLabels[m] || m).join(', ');
    const primary = resolvedPrimaryTransport ? (modeLabels[resolvedPrimaryTransport] || resolvedPrimaryTransport) : null;

    transportPreferencePrompt = `
${'='.repeat(70)}
🚗 USER TRANSPORT PREFERENCES — MUST RESPECT
${'='.repeat(70)}
The traveler has explicitly selected these transport modes: ${modeList}
${primary ? `Primary mode: ${primary}` : ''}
${resolvedHasRentalCar ? 'The traveler HAS a rental car — suggest driving with parking info, NOT public transit for longer distances.' : ''}

RULES:
- ONLY suggest transport modes the user selected
- ${resolvedTransportModes.includes('walking') ? 'Walking: suggest for distances under 15-20 min walk' : 'DO NOT suggest walking as primary transit (brief walks within a venue area are OK)'}
- ${resolvedTransportModes.includes('public_transit') ? 'Public transit: include specific line/route numbers, station names, and fares' : 'DO NOT suggest metro/bus/tram unless the user selected public transit'}
- ${resolvedTransportModes.includes('rideshare') ? 'Rideshare/Taxi: include estimated fare and ride duration' : 'DO NOT suggest Uber/Lyft/taxi unless the user selected rideshare'}
- ${resolvedHasRentalCar ? 'Rental car: suggest driving routes, include parking info and costs at each venue' : 'DO NOT suggest driving/rental car unless the user selected it'}
- NEVER suggest a transport mode the user did NOT select
`;
    console.log(`[compile-day-facts] Transport preferences: ${resolvedTransportModes.join(', ')}${primary ? ` (primary: ${primary})` : ''}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRE-RESOLVE AIRPORT DATA (for pure schema compiler)
  // ═══════════════════════════════════════════════════════════════════════
  let arrivalAirportDisplay = flightContext.arrivalAirport || '';
  if (arrivalAirportDisplay && /^[A-Z]{3}$/i.test(arrivalAirportDisplay)) {
    const code = arrivalAirportDisplay.toUpperCase();
    try {
      const { data: apt } = await supabase
        .from('airports')
        .select('name, code')
        .ilike('code', code)
        .maybeSingle();
      if (apt?.name) {
        arrivalAirportDisplay = `${apt.name} (${code})`;
      } else {
        arrivalAirportDisplay = `${code} Airport`;
      }
    } catch {
      arrivalAirportDisplay = `${code} Airport`;
    }
  } else if (!arrivalAirportDisplay) {
    arrivalAirportDisplay = 'Airport';
  }

  const airportTransferMinutes = destination ? await getAirportTransferMinutes(supabase, destination) : 45;

  return {
    resolvedIsTransitionDay,
    resolvedTransitionFrom,
    resolvedTransitionTo,
    resolvedTransportMode,
    resolvedTransportDetails,
    resolvedNextLegTransport,
    resolvedNextLegCity,
    resolvedNextLegTransportDetails,
    resolvedHotelOverride,
    resolvedIsMultiCity,
    resolvedIsLastDayInCity,
    resolvedDestination,
    resolvedCountry,
    lockedActivities,
    lockedSlotsInstruction,
    flightContext,
    isFirstDay,
    isLastDay,
    resolvedIsHotelChange,
    resolvedPreviousHotelName,
    transportPreferencePrompt,
    resolvedTransportModes,
    resolvedPrimaryTransport,
    resolvedHasRentalCar,
    arrivalAirportDisplay,
    airportTransferMinutes,
  };
}
