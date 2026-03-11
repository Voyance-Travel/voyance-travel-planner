// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// This file is a copy of src/lib/schema-compiler/day-skeletons.ts with import paths
// adjusted for the Deno edge function environment.
// If you modify this file, also update the src/ version.
// ============================================================

import type { DaySlot, DayType } from './types.ts';

export function buildBaseSkeleton(dayType: DayType): DaySlot[] {
  switch (dayType) {
    case 'morning_arrival':
      return buildMorningArrivalSkeleton();
    case 'midday_arrival':
      return buildMiddayArrivalSkeleton();
    case 'latenight_arrival':
      return buildLateNightArrivalSkeleton();
    case 'standard':
      return buildStandardDaySkeleton();
    case 'departure':
      return buildDepartureDaySkeleton();
    case 'transition':
      return buildTransitionDaySkeleton();
    default:
      return buildStandardDaySkeleton();
  }
}

function makeSlot(
  position: number,
  dayPrefix: string,
  overrides: Partial<DaySlot>
): DaySlot {
  return {
    slotId: `${dayPrefix}_slot_${String(position).padStart(2, '0')}`,
    slotType: 'activity',
    status: 'empty',
    required: true,
    position,
    timeWindow: null,
    ...overrides,
  };
}

function buildMorningArrivalSkeleton(): DaySlot[] {
  const d = 'arrival_morning';
  return [
    makeSlot(0, d, { slotType: 'arrival', status: 'empty', required: true, timeWindow: { earliest: '05:00', latest: '11:00', duration: { min: 30, max: 45 } } }),
    makeSlot(1, d, { slotType: 'transport', status: 'empty', required: true, aiInstruction: 'Transport from airport to hotel', timeWindow: null }),
    makeSlot(2, d, { slotType: 'hotel_checkin', status: 'empty', required: true, timeWindow: null }),
    makeSlot(3, d, { slotType: 'meal', mealType: 'lunch', required: true, timeWindow: { earliest: '11:30', latest: '14:00', duration: { min: 45, max: 75 } }, aiInstruction: 'Find a lunch spot near the hotel or first afternoon activity.' }),
    makeSlot(4, d, { slotType: 'activity', required: true, aiInstruction: 'Find an afternoon sightseeing or cultural activity.' }),
    makeSlot(5, d, { slotType: 'activity', required: true, aiInstruction: 'Find an afternoon activity.' }),
    makeSlot(6, d, { slotType: 'activity', required: false, aiInstruction: 'Find a late afternoon activity.' }),
    makeSlot(7, d, { slotType: 'activity', required: false, aiInstruction: 'Find an additional activity if the day has room.' }),
    makeSlot(8, d, { slotType: 'meal', mealType: 'dinner', required: true, timeWindow: { earliest: '18:30', latest: '21:00', duration: { min: 45, max: 75 } }, aiInstruction: 'Find a dinner restaurant.' }),
    makeSlot(9, d, { slotType: 'evening', required: false, timeWindow: { earliest: '20:00', latest: '23:00', duration: { min: 60, max: 150 } }, aiInstruction: 'Find an evening activity — nightlife, show, rooftop bar, or entertainment.' }),
  ];
}

function buildMiddayArrivalSkeleton(): DaySlot[] {
  const d = 'arrival_midday';
  return [
    makeSlot(0, d, { slotType: 'arrival', status: 'empty', required: true, timeWindow: { earliest: '11:00', latest: '16:00', duration: { min: 30, max: 45 } } }),
    makeSlot(1, d, { slotType: 'transport', status: 'empty', required: true, aiInstruction: 'Transport from airport to hotel' }),
    makeSlot(2, d, { slotType: 'hotel_checkin', status: 'empty', required: true }),
    makeSlot(3, d, { slotType: 'meal', mealType: 'lunch', required: true, timeWindow: { earliest: '13:00', latest: '16:00', duration: { min: 45, max: 75 } }, aiInstruction: 'Find a late lunch spot near the hotel.' }),
    makeSlot(4, d, { slotType: 'activity', required: true, aiInstruction: 'Find an afternoon activity — something doable in the remaining daylight.' }),
    makeSlot(5, d, { slotType: 'activity', required: false, aiInstruction: 'Find a second afternoon activity if time allows.' }),
    makeSlot(6, d, { slotType: 'meal', mealType: 'dinner', required: true, timeWindow: { earliest: '18:30', latest: '21:00', duration: { min: 45, max: 75 } }, aiInstruction: 'Find a dinner restaurant.' }),
    makeSlot(7, d, { slotType: 'evening', required: false, timeWindow: { earliest: '20:00', latest: '23:00', duration: { min: 60, max: 150 } }, aiInstruction: 'Find an evening activity.' }),
  ];
}

function buildLateNightArrivalSkeleton(): DaySlot[] {
  const d = 'arrival_late';
  return [
    makeSlot(0, d, { slotType: 'arrival', status: 'empty', required: true, timeWindow: { earliest: '16:00', latest: '23:59', duration: { min: 30, max: 45 } } }),
    makeSlot(1, d, { slotType: 'transport', status: 'empty', required: true, aiInstruction: 'Transport from airport to hotel' }),
    makeSlot(2, d, { slotType: 'hotel_checkin', status: 'empty', required: true }),
    makeSlot(3, d, { slotType: 'meal', mealType: 'dinner', required: true, timeWindow: { earliest: '19:00', latest: '22:00', duration: { min: 45, max: 75 } }, aiInstruction: 'Find a dinner spot near the hotel. The traveler just arrived — keep it easy.' }),
    makeSlot(4, d, { slotType: 'evening', required: false, timeWindow: { earliest: '21:00', latest: '23:59', duration: { min: 60, max: 120 } }, aiInstruction: 'Optional light evening activity — only if DNA supports nightlife.' }),
  ];
}

function buildStandardDaySkeleton(): DaySlot[] {
  const d = 'standard';
  return [
    makeSlot(0, d, { slotType: 'meal', mealType: 'breakfast', required: true, timeWindow: { earliest: '07:00', latest: '10:00', duration: { min: 30, max: 60 } }, aiInstruction: 'Find a breakfast spot.' }),
    makeSlot(1, d, { slotType: 'activity', required: true, aiInstruction: 'Find a morning activity.' }),
    makeSlot(2, d, { slotType: 'activity', required: true, aiInstruction: 'Find a mid-morning activity.' }),
    makeSlot(3, d, { slotType: 'meal', mealType: 'lunch', required: true, timeWindow: { earliest: '11:30', latest: '14:00', duration: { min: 45, max: 75 } }, aiInstruction: 'Find a lunch spot.' }),
    makeSlot(4, d, { slotType: 'activity', required: true, aiInstruction: 'Find an afternoon activity.' }),
    makeSlot(5, d, { slotType: 'activity', required: false, aiInstruction: 'Find a late afternoon activity.' }),
    makeSlot(6, d, { slotType: 'activity', required: false, aiInstruction: 'Find an additional activity if the day has room.' }),
    makeSlot(7, d, { slotType: 'meal', mealType: 'dinner', required: true, timeWindow: { earliest: '18:30', latest: '21:00', duration: { min: 45, max: 75 } }, aiInstruction: 'Find a dinner restaurant.' }),
    makeSlot(8, d, { slotType: 'evening', required: false, timeWindow: { earliest: '20:00', latest: '23:59', duration: { min: 60, max: 150 } }, aiInstruction: 'Find an evening activity.' }),
  ];
}

function buildDepartureDaySkeleton(): DaySlot[] {
  const d = 'departure';
  return [
    makeSlot(0, d, { slotType: 'meal', mealType: 'breakfast', required: true, timeWindow: { earliest: '07:00', latest: '10:00', duration: { min: 30, max: 60 } }, aiInstruction: 'Find a breakfast spot.' }),
    makeSlot(1, d, { slotType: 'hotel_checkout', status: 'empty', required: true }),
    makeSlot(2, d, { slotType: 'activity', required: false, aiInstruction: 'Find a morning activity near the hotel or on the way to the airport.' }),
    makeSlot(3, d, { slotType: 'activity', required: false, aiInstruction: 'Find an additional activity if time allows before departure.' }),
    makeSlot(4, d, { slotType: 'meal', mealType: 'lunch', required: false, timeWindow: { earliest: '11:30', latest: '14:00', duration: { min: 45, max: 75 } }, aiInstruction: 'Find a lunch spot if there is time before heading to the airport.' }),
    makeSlot(5, d, { slotType: 'transport', status: 'empty', required: true, aiInstruction: 'Transport from last activity to airport' }),
    makeSlot(6, d, { slotType: 'departure', status: 'empty', required: true }),
  ];
}

function buildTransitionDaySkeleton(): DaySlot[] {
  const d = 'transition';
  return [
    makeSlot(0, d, {
      slotType: 'meal',
      mealType: 'breakfast',
      required: true,
      timeWindow: { earliest: '07:00', latest: '10:00', duration: { min: 30, max: 60 } },
      aiInstruction: 'Find a breakfast spot in the ORIGIN city before departure.',
    }),
    makeSlot(1, d, {
      slotType: 'hotel_checkout',
      status: 'empty',
      required: true,
    }),
    makeSlot(2, d, {
      slotType: 'activity',
      required: false,
      aiInstruction: 'Find a quick morning activity in the ORIGIN city, if time allows before transit departure.',
    }),
    makeSlot(3, d, {
      slotType: 'transport',
      status: 'empty',
      required: true,
      aiInstruction: 'Transport from hotel/activity to transit hub in ORIGIN city.',
    }),
    makeSlot(4, d, {
      slotType: 'transport',
      status: 'empty',
      required: true,
      aiInstruction: 'Inter-city transit. This is the main travel segment between cities.',
    }),
    makeSlot(5, d, {
      slotType: 'transport',
      status: 'empty',
      required: true,
      aiInstruction: 'Transport from transit hub to hotel in DESTINATION city.',
    }),
    makeSlot(6, d, {
      slotType: 'hotel_checkin',
      status: 'empty',
      required: true,
    }),
    makeSlot(7, d, {
      slotType: 'activity',
      required: false,
      aiInstruction: 'Find an afternoon/evening activity in the DESTINATION city near the hotel.',
    }),
    makeSlot(8, d, {
      slotType: 'meal',
      mealType: 'dinner',
      required: true,
      timeWindow: { earliest: '18:30', latest: '21:00', duration: { min: 45, max: 75 } },
      aiInstruction: 'Find a dinner spot in the DESTINATION city. The traveler just arrived — a neighborhood restaurant near the hotel works well.',
    }),
    makeSlot(9, d, {
      slotType: 'evening',
      required: false,
      timeWindow: { earliest: '20:00', latest: '23:00', duration: { min: 60, max: 120 } },
      aiInstruction: 'Optional evening activity in the DESTINATION city. Keep it easy — it was a travel day.',
    }),
  ];
}
