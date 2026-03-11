// src/lib/schema-compiler/constraint-filler.ts
// Fill skeleton slots with known trip data (flights, hotel).
// Must-do pre-filling is handled separately in Fix 22E.

import type { DaySlot } from '@/types/schema-generation';
import type { CompilerInput } from './compile-day-schema';

/**
 * Fill arrival, departure, transport, and hotel slots with trip data.
 * This replaces the AI's job for these predictable, data-driven slots.
 */
export function fillFlightAndHotelSlots(
  slots: DaySlot[],
  input: CompilerInput
): DaySlot[] {
  let filled = [...slots];

  // === Gap 10: Build synthetic arrival/departure from preferences when flight data missing ===
  let effectiveArrival = input.arrivalFlight;
  let effectiveDeparture = input.departureFlight;

  if (!effectiveArrival && input.preferredArrivalTime && input.dayNumber === 1) {
    effectiveArrival = {
      arrivalTime: input.preferredArrivalTime,
      airportName: 'Airport',
      airportCode: '',
    };
  }

  if (!effectiveDeparture && input.preferredDepartureTime && input.dayNumber === input.totalDays) {
    effectiveDeparture = {
      departureTime: input.preferredDepartureTime,
      airportName: 'Airport',
      airportCode: '',
      isDomestic: true, // default to domestic buffer
    };
  }

  // Fill arrival slot from flight data (real or synthetic)
  if (effectiveArrival) {
    filled = filled.map(slot => {
      if (slot.slotType === 'arrival') {
        return {
          ...slot,
          status: 'filled' as const,
          filledData: {
            title: `Arrive in ${input.destination}`,
            category: 'arrival',
            startTime: effectiveArrival!.arrivalTime,
            endTime: addMinutes(effectiveArrival!.arrivalTime, 30),
            location: effectiveArrival!.airportCode
              ? `${effectiveArrival!.airportName} (${effectiveArrival!.airportCode})`
              : effectiveArrival!.airportName,
            cost: 0,
            source: 'flight_data' as const,
            notes: 'Deplane, collect baggage, and head to ground transport.',
          },
        };
      }
      return slot;
    });

    // Fill the first transport slot (airport → hotel)
    const arrivalEndTime = addMinutes(effectiveArrival.arrivalTime, 30);
    filled = filled.map((slot, idx) => {
      if (slot.slotType === 'transport' && idx <= 2) {
        return {
          ...slot,
          status: 'empty' as const,
          aiInstruction: effectiveArrival!.airportCode
            ? `Transport from ${effectiveArrival!.airportName} (${effectiveArrival!.airportCode}) to ${input.hotel?.name || 'the hotel'}. Estimated departure: ${arrivalEndTime}.`
            : `Transport from airport to ${input.hotel?.name || 'the hotel'}. Estimated departure: ${arrivalEndTime}.`,
          timeWindow: {
            earliest: arrivalEndTime,
            latest: addMinutes(arrivalEndTime, 30),
            duration: { min: 30, max: 90 },
          },
        };
      }
      return slot;
    });
  }

  // Fill hotel check-in slot
  if (input.hotel) {
    filled = filled.map(slot => {
      if (slot.slotType === 'hotel_checkin') {
        const checkInTime = input.hotel!.checkInTime || '15:00';
        return {
          ...slot,
          status: 'filled' as const,
          filledData: {
            title: `Check in at ${input.hotel!.name}`,
            category: 'hotel',
            startTime: checkInTime,
            endTime: addMinutes(checkInTime, 30),
            location: input.hotel!.address,
            cost: 0,
            source: 'hotel_data' as const,
            notes: 'Check in and freshen up.',
          },
        };
      }
      return slot;
    });
  }

  // Fill hotel checkout slot (departure day)
  if (input.hotel) {
    filled = filled.map(slot => {
      if (slot.slotType === 'hotel_checkout') {
        const checkOutTime = input.hotel!.checkOutTime || '11:00';
        return {
          ...slot,
          status: 'filled' as const,
          filledData: {
            title: `Check out of ${input.hotel!.name}`,
            category: 'hotel',
            startTime: checkOutTime,
            endTime: addMinutes(checkOutTime, 15),
            location: input.hotel!.address,
            cost: 0,
            source: 'hotel_data' as const,
            notes: 'Check out and store luggage if needed.',
          },
        };
      }
      return slot;
    });
  }

  // Fill departure slot from flight data (real or synthetic)
  if (effectiveDeparture) {
    const bufferMinutes = effectiveDeparture.isDomestic ? 90 : 120;
    const departureTime = effectiveDeparture.departureTime;
    const arriveAirportBy = subtractMinutes(departureTime, bufferMinutes);
    const transferDuration = 60;
    const leaveLastActivityBy = subtractMinutes(arriveAirportBy, transferDuration);

    // Fill departure slot
    filled = filled.map(slot => {
      if (slot.slotType === 'departure') {
        return {
          ...slot,
          status: 'filled' as const,
          filledData: {
            title: `Depart from ${input.destination}`,
            category: 'departure',
            startTime: arriveAirportBy,
            endTime: departureTime,
            location: effectiveDeparture!.airportCode
              ? `${effectiveDeparture!.airportName} (${effectiveDeparture!.airportCode})`
              : effectiveDeparture!.airportName,
            cost: 0,
            source: 'flight_data' as const,
            notes: `Arrive at airport by ${arriveAirportBy} for ${bufferMinutes}-minute check-in/security buffer. Flight departs ${departureTime}.`,
          },
        };
      }
      return slot;
    });

    // Fill the last transport slot (last activity → airport)
    filled = filled.map(slot => {
      if (slot.slotType === 'transport' && slot.position >= filled.length - 3) {
        return {
          ...slot,
          status: 'empty' as const,
          aiInstruction: effectiveDeparture!.airportCode
            ? `Transport to ${effectiveDeparture!.airportName} (${effectiveDeparture!.airportCode}). MUST ARRIVE by ${arriveAirportBy}. Depart from last activity by ${leaveLastActivityBy} at the latest.`
            : `Transport to airport. MUST ARRIVE by ${arriveAirportBy}. Depart from last activity by ${leaveLastActivityBy} at the latest.`,
          timeWindow: {
            earliest: subtractMinutes(leaveLastActivityBy, 15),
            latest: leaveLastActivityBy,
            duration: { min: 30, max: 90 },
          },
        };
      }
      return slot;
    });

    // Remove activity/meal slots that don't fit before the departure constraint
    filled = filled.filter(slot => {
      if (
        (slot.slotType === 'activity' || (slot.slotType === 'meal' && slot.mealType === 'lunch')) &&
        slot.timeWindow
      ) {
        const slotEarliest = parseTimeToMinutes(slot.timeWindow.earliest);
        const mustLeaveBy = parseTimeToMinutes(leaveLastActivityBy);
        if (slotEarliest + (slot.timeWindow.duration?.min || 60) > mustLeaveBy) {
          return false;
        }
      }
      return true;
    });

    // Re-index positions after removal
    filled = filled.map((slot, idx) => ({ ...slot, position: idx }));
  }

  return filled;
}

// --- Time utility functions ---

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMinutes(time: string, mins: number): string {
  return minutesToTime(parseTimeToMinutes(time) + mins);
}

function subtractMinutes(time: string, mins: number): string {
  return minutesToTime(Math.max(0, parseTimeToMinutes(time) - mins));
}
