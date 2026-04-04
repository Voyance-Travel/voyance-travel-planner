/**
 * cascadeTransportToItinerary
 * 
 * Adjusts itinerary day activities when transport data changes.
 * Handles 4 scenarios:
 *   A. Outbound arrival day — first activities start after arrival + transit
 *   B. Return departure day — last activities end before departure - transit
 *   C. Inter-city transport — truncate departing city, delay arriving city
 *   D. Transport time changes — recalculate affected days
 */

import { supabase } from '@/integrations/supabase/client';
import type { TransportDetails, TransportType } from '@/types/tripCity';
import { toast } from 'sonner';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minutes to add after arrival before first activity */
const TRANSIT_BUFFERS = {
  flight: { afterArrival: 105, beforeDeparture: 180 }, // 1h customs + 45m transit | 3h before departure
  train:  { afterArrival: 45,  beforeDeparture: 60 },  // 15m disembark + 30m transit | 30m before + 30m transit
  bus:    { afterArrival: 45,  beforeDeparture: 60 },
  ferry:  { afterArrival: 60,  beforeDeparture: 90 },
  car:    { afterArrival: 30,  beforeDeparture: 30 },
} as const;

function getBuffers(type: TransportType | string | undefined) {
  return TRANSIT_BUFFERS[(type as keyof typeof TRANSIT_BUFFERS)] || TRANSIT_BUFFERS.flight;
}

// ─── Time Utilities ──────────────────────────────────────────────────────────

/** Parse "HH:MM" or "H:MM AM/PM" → minutes since midnight */
function parseTime(t: string | undefined | null): number | null {
  if (!t) return null;
  const s = t.trim().toUpperCase();
  // 24h: "14:30"
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) return parseInt(m24[1]) * 60 + parseInt(m24[2]);
  // 12h: "2:30 PM"
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m12) {
    let h = parseInt(m12[1]);
    const min = parseInt(m12[2]);
    if (m12[3] === 'PM' && h !== 12) h += 12;
    if (m12[3] === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }
  return null;
}

/** Minutes since midnight → "HH:MM" */
function formatTime(mins: number): string {
  const clamped = Math.max(0, Math.min(mins, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CascadeChange {
  dayNumber: number;
  dayLabel: string;
  removedActivities: string[];
  shiftedActivities: string[];
  addedBlocks: string[];
}

export interface CascadeResult {
  changed: boolean;
  changes: CascadeChange[];
  updatedDays: any[];
}

interface TransportInfo {
  type: TransportType | string;
  departureTime?: string; // HH:MM
  arrivalTime?: string;   // HH:MM
  fromCity?: string;
  toCity?: string;
}

// ─── Core Cascade Logic ──────────────────────────────────────────────────────

/**
 * Truncate a day's activities to end before a cutoff time.
 * Adds a "Head to station/airport" block at the transition point.
 */
function truncateDayBefore(
  day: any,
  cutoffMinutes: number,
  stationLabel: string
): CascadeChange {
  const change: CascadeChange = {
    dayNumber: day.dayNumber,
    dayLabel: day.theme || `Day ${day.dayNumber}`,
    removedActivities: [],
    shiftedActivities: [],
    addedBlocks: [],
  };

  const activities = [...(day.activities || [])];
  const kept: any[] = [];
  
  for (const act of activities) {
    const start = parseTime(act.startTime);
    const end = parseTime(act.endTime);
    
    // Keep activities that end before the cutoff
    if (end !== null && end <= cutoffMinutes) {
      kept.push(act);
    } else if (start !== null && start < cutoffMinutes) {
      // Activity spans the cutoff — truncate its end time
      kept.push({
        ...act,
        endTime: formatTime(cutoffMinutes - 15),
        durationMinutes: Math.max(15, cutoffMinutes - 15 - start),
      });
      change.shiftedActivities.push(act.name || act.title || 'Activity');
    } else {
      change.removedActivities.push(act.name || act.title || 'Activity');
    }
  }

  // Add departure block
  const departureBlock = {
    id: `transport-depart-${day.dayNumber}`,
    name: `Head to ${stationLabel}`,
    title: `Head to ${stationLabel}`,
    description: `Leave for ${stationLabel} to catch your transport.`,
    category: 'transport',
    categoryIcon: 'car',
    startTime: formatTime(cutoffMinutes),
    endTime: formatTime(cutoffMinutes + 30),
    durationMinutes: 30,
    isLocked: false,
    isTransportBlock: true,
    location: { name: stationLabel, address: stationLabel },
    cost: { amount: 0, currency: 'USD' },
  };
  kept.push(departureBlock);
  change.addedBlocks.push(`Head to ${stationLabel}`);

  day.activities = kept;
  return change;
}

/**
 * Shift a day's activities to start after an earliest-start time.
 * Removes activities that can't fit and optionally adds an arrival block.
 */
function shiftDayAfter(
  day: any,
  earliestMinutes: number,
  arrivalLabel?: string
): CascadeChange {
  const change: CascadeChange = {
    dayNumber: day.dayNumber,
    dayLabel: day.theme || `Day ${day.dayNumber}`,
    removedActivities: [],
    shiftedActivities: [],
    addedBlocks: [],
  };

  const activities = [...(day.activities || [])];
  
  // Check if a check-in or arrival activity already exists in the day
  const arrivalBlocks: any[] = [];
  const existingCheckin = (day.activities || []).find((act: any) =>
    act.title?.toLowerCase().includes('check in') ||
    act.title?.toLowerCase().includes('check-in') ||
    act.title?.toLowerCase().includes('checkin') ||
    act.title?.toLowerCase().includes('arrive') ||
    act.category === 'accommodation' ||
    act.isTransportBlock
  );

  if (arrivalLabel && !existingCheckin) {
    // Only add generic check-in block if one doesn't already exist
    const checkinBlock = {
      id: `transport-arrive-${day.dayNumber}`,
      name: `Arrive & Check In`,
      title: `Arrive & Check In`,
      description: `Arrive at hotel, check in, and freshen up.`,
      category: 'transport',
      categoryIcon: 'hotel',
      startTime: formatTime(earliestMinutes - 45),
      endTime: formatTime(earliestMinutes),
      durationMinutes: 45,
      isLocked: false,
      isTransportBlock: true,
      location: { name: arrivalLabel, address: arrivalLabel },
      cost: { amount: 0, currency: 'USD' },
    };
    arrivalBlocks.push(checkinBlock);
    change.addedBlocks.push('Arrive & Check In');
  }

  // Late arrival (after 7 PM / 19:00) — keep only evening activities
  if (earliestMinutes >= 19 * 60) {
    const eveningActivities = activities.filter(act => {
      const start = parseTime(act.startTime);
      return start !== null && start >= earliestMinutes;
    });
    
    // If no evening activities exist, keep at most 1 dinner activity
    if (eveningActivities.length === 0) {
      const dinner = activities.find(act => 
        (act.category === 'dining' || act.category === 'restaurant') &&
        parseTime(act.startTime) !== null
      );
      if (dinner) {
        dinner.startTime = formatTime(earliestMinutes + 15);
        dinner.endTime = formatTime(earliestMinutes + 90);
        eveningActivities.push(dinner);
        change.shiftedActivities.push(dinner.name || dinner.title || 'Dinner');
      }
    }
    
    const removedNames = activities
      .filter(a => !eveningActivities.includes(a))
      .map(a => a.name || a.title || 'Activity');
    change.removedActivities.push(...removedNames);
    
    day.activities = [...arrivalBlocks, ...eveningActivities];
    return change;
  }

  // Normal case: shift activities forward
  const kept: any[] = [];
  let currentTime = earliestMinutes;

  // Sort by original start time
  const sorted = activities.sort((a: any, b: any) => {
    const aStart = parseTime(a.startTime) ?? 0;
    const bStart = parseTime(b.startTime) ?? 0;
    return aStart - bStart;
  });

  for (const act of sorted) {
    const origStart = parseTime(act.startTime);
    const duration = act.durationMinutes || 60;
    
    // Skip activities whose original end was before the new earliest start
    if (origStart !== null && (origStart + duration) < earliestMinutes) {
      // Keep critical structural activities: meals, check-in, accommodation
      const isStructural = act.category === 'dining' || act.category === 'restaurant' ||
        act.category === 'accommodation' ||
        act.title?.toLowerCase().includes('check in') ||
        act.title?.toLowerCase().includes('check-in') ||
        act.title?.toLowerCase().includes('hotel');
      if (!isStructural) {
        change.removedActivities.push(act.name || act.title || 'Activity');
        continue;
      }
    }

    // Place this activity at currentTime
    const newStart = Math.max(currentTime, origStart ?? currentTime);
    const newEnd = newStart + duration;
    
    // Don't go past midnight
    if (newEnd > 23 * 60 + 30) {
      change.removedActivities.push(act.name || act.title || 'Activity');
      continue;
    }

    if (newStart !== origStart) {
      change.shiftedActivities.push(act.name || act.title || 'Activity');
    }

    kept.push({
      ...act,
      startTime: formatTime(newStart),
      endTime: formatTime(newEnd),
    });
    
    currentTime = newEnd + 15; // 15 min buffer between activities
  }

  day.activities = [...arrivalBlocks, ...kept];
  return change;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Apply transport cascade to arrival day (Scenario A).
 * Call when outbound flight/transport is saved or updated.
 */
export function cascadeArrivalDay(
  days: any[],
  arrivalTimeStr: string,
  transportType: TransportType | string = 'flight',
  hotelName?: string
): CascadeResult {
  if (!days.length) return { changed: false, changes: [], updatedDays: days };
  
  const arrivalMins = parseTime(arrivalTimeStr);
  if (arrivalMins === null) return { changed: false, changes: [], updatedDays: days };
  
  const buffer = getBuffers(transportType);
  const earliestActivity = arrivalMins + buffer.afterArrival;
  
  const updatedDays = days.map(d => ({ ...d, activities: [...(d.activities || [])] }));
  const firstDay = updatedDays[0];
  
  const change = shiftDayAfter(firstDay, earliestActivity, hotelName || 'Hotel');
  
  return {
    changed: change.removedActivities.length > 0 || change.shiftedActivities.length > 0 || change.addedBlocks.length > 0,
    changes: [change],
    updatedDays,
  };
}

/**
 * Apply transport cascade to departure day (Scenario B).
 * Call when return flight/transport is saved or updated.
 */
export function cascadeDepartureDay(
  days: any[],
  departureTimeStr: string,
  transportType: TransportType | string = 'flight',
  stationName?: string
): CascadeResult {
  if (!days.length) return { changed: false, changes: [], updatedDays: days };
  
  const departureMins = parseTime(departureTimeStr);
  if (departureMins === null) return { changed: false, changes: [], updatedDays: days };
  
  const buffer = getBuffers(transportType);
  const latestEndTime = departureMins - buffer.beforeDeparture;
  
  const updatedDays = days.map(d => ({ ...d, activities: [...(d.activities || [])] }));
  const lastDay = updatedDays[updatedDays.length - 1];
  
  const change = truncateDayBefore(lastDay, latestEndTime, stationName || 'Airport');
  
  return {
    changed: change.removedActivities.length > 0 || change.shiftedActivities.length > 0 || change.addedBlocks.length > 0,
    changes: [change],
    updatedDays,
  };
}

/**
 * Apply transport cascade to inter-city transition (Scenario C).
 * Adjusts the last day of departing city and first day of arriving city.
 * Works on the full trip days array — caller provides the day indices.
 */
export function cascadeInterCityTransport(
  days: any[],
  departingDayIndex: number,
  arrivingDayIndex: number,
  transport: TransportInfo
): CascadeResult {
  if (!days.length) return { changed: false, changes: [], updatedDays: days };
  
  const depMins = parseTime(transport.departureTime);
  const arrMins = parseTime(transport.arrivalTime);
  
  if (depMins === null && arrMins === null) {
    return { changed: false, changes: [], updatedDays: days };
  }

  const buffer = getBuffers(transport.type);
  const updatedDays = days.map(d => ({ ...d, activities: [...(d.activities || [])] }));
  const changes: CascadeChange[] = [];

  // Truncate departing city's last day
  if (depMins !== null && departingDayIndex >= 0 && departingDayIndex < updatedDays.length) {
    const cutoff = depMins - buffer.beforeDeparture;
    const stationLabel = transport.type === 'flight' 
      ? `${transport.fromCity || ''} Airport`.trim()
      : `${transport.fromCity || ''} Station`.trim();
    const change = truncateDayBefore(updatedDays[departingDayIndex], cutoff, stationLabel);
    if (change.removedActivities.length || change.shiftedActivities.length || change.addedBlocks.length) {
      changes.push(change);
    }
  }

  // Shift arriving city's first day
  if (arrMins !== null && arrivingDayIndex >= 0 && arrivingDayIndex < updatedDays.length) {
    const earliest = arrMins + buffer.afterArrival;
    const change = shiftDayAfter(updatedDays[arrivingDayIndex], earliest, `${transport.toCity || ''} Hotel`.trim());
    if (change.removedActivities.length || change.shiftedActivities.length || change.addedBlocks.length) {
      changes.push(change);
    }
  }

  return {
    changed: changes.length > 0,
    changes,
    updatedDays,
  };
}

/**
 * Full cascade: analyzes all transport data for a trip and adjusts all affected days.
 * Handles single-city (outbound + return flights) and multi-city scenarios.
 */
export async function cascadeAllTransport(
  tripId: string,
  itineraryDays: any[],
  flightSelection?: any,
  tripCities?: any[]
): Promise<CascadeResult> {
  if (!itineraryDays?.length) return { changed: false, changes: [], updatedDays: itineraryDays };

  let updatedDays = itineraryDays.map(d => ({ ...d, activities: [...(d.activities || [])] }));
  const allChanges: CascadeChange[] = [];

  // ── Single-city: outbound + return ──
  if (!tripCities?.length && flightSelection) {
    const legs = flightSelection.legs || [];
    
    // Find the destination arrival leg (user-marked or heuristic)
    const markedArrival = legs.find((l: any) => l.isDestinationArrival);
    const outbound = markedArrival || legs[0] || flightSelection.departure;
    
    // Find the destination departure leg (user-marked or last leg)
    const markedDeparture = legs.find((l: any) => l.isDestinationDeparture);
    const returnLeg = markedDeparture || (legs.length >= 2 ? legs[legs.length - 1] : flightSelection.return);

    // ─── Cross-day flight detection ───
    // If outbound departs on one date and arrives on a later date,
    // Day 1 is a departure travel day — cascade arrival to Day 2 instead.
    const outboundDepartDate = outbound?.departure?.date as string | undefined;
    const outboundArriveDate = outbound?.arrival?.date as string | undefined;
    const isCrossDayFlight = outboundDepartDate && outboundArriveDate
      && outboundArriveDate.substring(0, 10) > outboundDepartDate.substring(0, 10);

    // Outbound arrival
    if (outbound?.arrival?.time) {
      if (isCrossDayFlight && updatedDays.length >= 2) {
        // Cross-day: skip Day 1 (travel day), apply arrival cascade to Day 2
        console.log('[cascade] Cross-day flight detected — applying arrival cascade to Day 2');
        const day2Only = [updatedDays[1]];
        const result = cascadeArrivalDay(day2Only, outbound.arrival.time, 'flight');
        if (result.changed) {
          updatedDays[1] = result.updatedDays[0];
          allChanges.push(...result.changes);
        }
      } else {
        // Same-day: apply to Day 1 as usual
        const result = cascadeArrivalDay(updatedDays, outbound.arrival.time, 'flight');
        if (result.changed) {
          updatedDays = result.updatedDays;
          allChanges.push(...result.changes);
        }
      }
    }

    // Return departure
    if (returnLeg?.departure?.time) {
      const result = cascadeDepartureDay(updatedDays, returnLeg.departure.time, 'flight');
      if (result.changed) {
        updatedDays = result.updatedDays;
        allChanges.push(...result.changes);
      }
    }
  }

  // ── Multi-city: inter-city transport ──
  if (tripCities?.length) {
    // First city: inbound arrival (prefer user-marked destination arrival leg from flight_selection)
    const firstCity = tripCities[0];
    const firstCityLegs = flightSelection?.legs || [];
    const markedArrival = firstCityLegs.find((l: any) => l.isDestinationArrival);
    const inboundLeg = markedArrival || firstCityLegs[0] || flightSelection?.departure;
    const inboundArrivalTime = inboundLeg?.arrival?.time || firstCity?.transport_details?.arrivalTime;
    const inboundType = inboundLeg?.arrival?.time ? 'flight' : (firstCity?.transport_type || 'flight');

    if (inboundArrivalTime) {
      // Check for cross-day flight in multi-city too
      const inboundDepartDate = inboundLeg?.departure?.date as string | undefined;
      const inboundArriveDate = inboundLeg?.arrival?.date as string | undefined;
      const isCrossDayInbound = inboundDepartDate && inboundArriveDate
        && inboundArriveDate.substring(0, 10) > inboundDepartDate.substring(0, 10);

      if (isCrossDayInbound && updatedDays.length >= 2) {
        // Cross-day: apply arrival cascade to Day 2
        console.log('[cascade] Multi-city cross-day inbound — applying arrival cascade to Day 2');
        const day2Only = [updatedDays[1]];
        const result = cascadeArrivalDay(day2Only, inboundArrivalTime, inboundType);
        if (result.changed) {
          updatedDays[1] = result.updatedDays[0];
          allChanges.push(...result.changes);
        }
      } else {
        const result = cascadeArrivalDay(updatedDays, inboundArrivalTime, inboundType);
        if (result.changed) {
          updatedDays = result.updatedDays;
          allChanges.push(...result.changes);
        }
      }
    }

    // Inter-city transitions
    let dayOffset = 0;
    for (let i = 0; i < tripCities.length; i++) {
      const city = tripCities[i];
      const cityNights = city.nights || city.days_total || 0;

      // If this city has transport TO it from the previous city (i > 0)
      if (i > 0 && city.transport_details) {
        const td = city.transport_details as TransportDetails;
        const prevCity = tripCities[i - 1];
        const prevCityNights = prevCity.nights || prevCity.days_total || 0;
        const departingDayIdx = dayOffset - 1; // last day of prev city
        const arrivingDayIdx = dayOffset; // first day of this city

        if (td.departureTime || td.arrivalTime) {
          const result = cascadeInterCityTransport(updatedDays, departingDayIdx, arrivingDayIdx, {
            type: city.transport_type || 'train',
            departureTime: td.departureTime,
            arrivalTime: td.arrivalTime,
            fromCity: prevCity.city_name,
            toCity: city.city_name,
          });
          if (result.changed) {
            updatedDays = result.updatedDays;
            allChanges.push(...result.changes);
          }
        }
      }

      dayOffset += cityNights;
    }

    // Last city: return departure (prefer user-marked destination departure leg)
    const lastCity = tripCities[tripCities.length - 1];
    if (flightSelection && updatedDays.length > 0) {
      const legs = flightSelection.legs || [];
      const markedDeparture = legs.find((l: any) => l.isDestinationDeparture);
      const returnLeg = markedDeparture || (legs.length >= 2 ? legs[legs.length - 1] : flightSelection.return);
      if (returnLeg?.departure?.time) {
        const result = cascadeDepartureDay(
          updatedDays,
          returnLeg.departure.time,
          'flight'
        );
        if (result.changed) {
          updatedDays = result.updatedDays;
          allChanges.push(...result.changes);
        }
      }
    }
  }

  return {
    changed: allChanges.length > 0,
    changes: allChanges,
    updatedDays,
  };
}

// ─── Persistence Helper ──────────────────────────────────────────────────────

/**
 * Run cascade and persist updated itinerary to the database.
 * Shows toast notifications about what changed.
 * Returns true if changes were made.
 */
export async function runCascadeAndPersist(
  tripId: string,
  itineraryDays: any[],
  flightSelection?: any,
  tripCities?: any[]
): Promise<boolean> {
  try {
    const result = await cascadeAllTransport(tripId, itineraryDays, flightSelection, tripCities);
    
    if (!result.changed) return false;

    // Persist updated days
    const { data: tripData } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .single();

    if (tripData?.itinerary_data) {
      const itineraryData = tripData.itinerary_data as any;
      itineraryData.days = result.updatedDays;
      
      const { saveItineraryOptimistic } = await import('@/services/itineraryOptimisticUpdate');
      const saveResult = await saveItineraryOptimistic(tripId, itineraryData);
      if (!saveResult.success && saveResult.error === 'version_conflict') {
        console.warn('[cascade] Version conflict during transport cascade — another edit occurred');
      }
    }

    // Show toast notifications
    showCascadeToasts(result.changes);
    
    return true;
  } catch (err) {
    console.error('[cascade] Failed to apply transport cascade:', err);
    return false;
  }
}

/**
 * Show user-friendly toast notifications about cascade changes.
 */
function showCascadeToasts(changes: CascadeChange[]) {
  if (!changes.length) return;

  const totalRemoved = changes.reduce((n, c) => n + c.removedActivities.length, 0);
  const totalShifted = changes.reduce((n, c) => n + c.shiftedActivities.length, 0);
  const totalAdded = changes.reduce((n, c) => n + c.addedBlocks.length, 0);
  const dayLabels = changes.map(c => c.dayLabel).join(', ');

  if (totalRemoved > 0) {
    const removedNames = changes.flatMap(c => c.removedActivities).slice(0, 3);
    const moreCount = totalRemoved - removedNames.length;
    const removedText = removedNames.join(', ') + (moreCount > 0 ? ` +${moreCount} more` : '');
    toast.info(`✈️ Itinerary adjusted. Removed ${totalRemoved} activit${totalRemoved === 1 ? 'y' : 'ies'} on ${dayLabels}`, {
      description: removedText,
      duration: 6000,
    });
  } else if (totalShifted > 0) {
    toast.info(`✈️ Itinerary adjusted. Shifted ${totalShifted} activit${totalShifted === 1 ? 'y' : 'ies'} on ${dayLabels}`, {
      duration: 4000,
    });
  } else if (totalAdded > 0) {
    toast.info(`✈️ Added transport blocks to ${dayLabels}`, {
      duration: 3000,
    });
  }
}
