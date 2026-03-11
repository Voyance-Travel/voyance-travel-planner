// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// This file is a copy of src/lib/schema-compiler/departure-validator.ts
// with import paths adjusted for the Deno edge function environment.
// If you modify this file, also update the src/ version.
// ============================================================

import { parseTimeToMinutes, minutesToTime } from './time-parser.ts';

export interface DepartureConstraints {
  boardingTime: string;
  arriveAirportTime: string;
  leaveForAirportTime: string;
  lastActivityEndTime: string;
  dayEndTime: string;
}

export function buildDepartureConstraints(
  flightTime: string,
  transportMinutes: number = 60,
  isDomestic: boolean = true
): DepartureConstraints {
  const flightMins = parseTimeToMinutes(flightTime);

  if (flightMins === null || isNaN(flightMins)) {
    return {
      boardingTime: '17:30',
      arriveAirportTime: '16:30',
      leaveForAirportTime: '15:30',
      lastActivityEndTime: '15:15',
      dayEndTime: '15:15',
    };
  }

  const checkInBuffer = isDomestic ? 90 : 150;
  const preTransportBuffer = 15;

  const boardingMins = flightMins - 30;
  const arriveAirportMins = flightMins - checkInBuffer;
  const leaveMins = arriveAirportMins - transportMinutes;
  const lastActivityMins = leaveMins - preTransportBuffer;

  return {
    boardingTime: minutesToTime(boardingMins),
    arriveAirportTime: minutesToTime(arriveAirportMins),
    leaveForAirportTime: minutesToTime(leaveMins),
    lastActivityEndTime: minutesToTime(lastActivityMins),
    dayEndTime: minutesToTime(lastActivityMins),
  };
}

export function validateDepartureTimeline(
  activities: any[],
  flightTime: string,
  transportMinutes: number = 60
): { validated: any[]; warnings: string[] } {
  const constraints = buildDepartureConstraints(flightTime, transportMinutes);
  const cutoffMins = parseTimeToMinutes(constraints.leaveForAirportTime);
  const flightMins = parseTimeToMinutes(flightTime);
  const warnings: string[] = [];

  if (cutoffMins === null || flightMins === null) {
    return { validated: activities, warnings };
  }

  const DEPARTURE_KEYWORDS = ['boarding', 'departure', 'flight out', 'take off', 'takeoff'];
  const AIRPORT_KEYWORDS = ['airport', 'terminal'];
  const TRANSPORT_TO_AIRPORT_KEYWORDS = [
    'transfer to', 'transport to airport', 'car to airport',
    'taxi to airport', 'uber to airport', 'ride to airport',
  ];

  const validated = activities
    .map(act => {
      const startMins = parseTimeToMinutes(act.startTime);
      if (startMins === null) return act;

      const titleLower = (act.title || '').toLowerCase();

      const isBoarding = DEPARTURE_KEYWORDS.some(k => titleLower.includes(k));

      if (isBoarding && startMins > flightMins) {
        warnings.push(
          `Boarding "${act.title}" at ${act.startTime} is AFTER flight at ${flightTime} — fixing to ${constraints.boardingTime}`
        );
        return { ...act, startTime: constraints.boardingTime };
      }

      const isDepartureRelated =
        isBoarding ||
        AIRPORT_KEYWORDS.some(k => titleLower.includes(k)) ||
        TRANSPORT_TO_AIRPORT_KEYWORDS.some(k => titleLower.includes(k));

      if (!isDepartureRelated && startMins > cutoffMins) {
        warnings.push(
          `Activity "${act.title}" at ${act.startTime} is after departure cutoff ${constraints.leaveForAirportTime} — removing`
        );
        return null;
      }

      return act;
    })
    .filter(Boolean);

  const hasTransportToAirport = validated.some((a: any) => {
    const t = (a.title || '').toLowerCase();
    return (
      TRANSPORT_TO_AIRPORT_KEYWORDS.some(k => t.includes(k)) ||
      (t.includes('transport') && AIRPORT_KEYWORDS.some(k => t.includes(k)))
    );
  });

  if (!hasTransportToAirport) {
    warnings.push('No transport-to-airport activity found — injecting one');
    validated.push({
      title: 'Transport to Airport',
      category: 'transport',
      startTime: constraints.leaveForAirportTime,
      endTime: constraints.arriveAirportTime,
      duration: `${transportMinutes} minutes`,
      description: 'Transfer to the airport for your departure flight.',
      isGenerated: true,
    });
  }

  validated.sort((a: any, b: any) => {
    const aMins = parseTimeToMinutes(a.startTime) ?? 0;
    const bMins = parseTimeToMinutes(b.startTime) ?? 0;
    return aMins - bMins;
  });

  return { validated, warnings };
}
