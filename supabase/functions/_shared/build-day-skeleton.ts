// Deterministic Day Skeleton Builder — Phase 2 of the schema-driven pipeline.
//
// Takes the facts that `compileDaySchema` already resolves (day type, flight,
// hotel, pattern group, must-dos) and produces a populated `SkeletonDay`:
// fixed slot order, fixed time windows, must-dos pre-allocated, meals
// pre-allocated. The Filler LLM (Phase 4) will only name venues for empty
// slots — it cannot change times, add slots, reorder, or drop must-dos.
//
// PURELY ADDITIVE in Phase 2: produces the skeleton alongside the existing
// prompt-text output so we can compare side-by-side before the cutover.

import type {
  SkeletonDay,
  SkeletonSlot,
  SkeletonSlotType,
  SkeletonTimeWindow,
  PatternGroupConfig,
  PatternGroup,
  DayType,
  MealType,
  OmittedMustDo,
} from './schema-generation.ts';
import { getPatternGroupConfig } from './pattern-group-configs.ts';
import { getPatternGroupForArchetype } from './archetype-group-mapping.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Inputs (kept narrow on purpose — only what the planner already has)
// ─────────────────────────────────────────────────────────────────────────────

export interface SkeletonMustDoInput {
  /** Stable id used to back-reference the must-do from a slot. */
  id: string;
  title: string;
  /** Optional category hint to choose a compatible slot type. */
  category?: string;
  /** Optional priority — higher gets allocated first. */
  priority?: number;
  /** If true, must be on a specific day (e.g. all-day event). */
  fixedDayNumber?: number;
  /** Optional hard time window the must-do must occupy. */
  fixedTimeWindow?: { startTime: string; endTime: string };
}

export interface BuildSkeletonInput {
  dayNumber: number;
  totalDays: number;
  date: string;
  destination: string;
  isFirstDay: boolean;
  isLastDay: boolean;
  patternGroup?: PatternGroup | null;
  archetypeName?: string | null;

  /** Arrival/departure clock truth (HH:MM 24h). Drives day-type classification. */
  arrivalTime24?: string | null;
  departureTime24?: string | null;
  /** Hotel facts so the skeleton can pin check-in/check-out slots. */
  hasHotelData?: boolean;
  hotelCheckInTime?: string | null;  // default 15:00
  hotelCheckOutTime?: string | null; // default 11:00
  airportTransferMinutes?: number;   // default 60

  /** Must-dos eligible for THIS day (caller pre-filters by fixedDayNumber). */
  mustDos?: SkeletonMustDoInput[];
}

export interface BuildSkeletonResult {
  skeleton: SkeletonDay;
  omitted: OmittedMustDo[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return h * 60 + mm;
}

function fromMinutes(min: number): string {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function classifyDayType(input: BuildSkeletonInput): DayType {
  if (input.isLastDay && input.departureTime24) return 'departure';
  if (input.isFirstDay && input.arrivalTime24) {
    const am = toMinutes(input.arrivalTime24) ?? 12 * 60;
    if (am < 6 * 60) return 'latenight_arrival'; // overnight red-eye
    if (am < 12 * 60) return 'morning_arrival';
    if (am < 18 * 60) return 'midday_arrival';
    return 'latenight_arrival';
  }
  return 'standard';
}

let _slotSeq = 0;
function nextSlotId(dayNumber: number, slotType: SkeletonSlotType): string {
  _slotSeq += 1;
  return `d${dayNumber}-${slotType}-${_slotSeq}`;
}

function emptySlot(
  dayNumber: number,
  slotType: SkeletonSlotType,
  position: number,
  timeWindow: SkeletonTimeWindow | null,
  opts: {
    required?: boolean;
    aiInstruction?: string;
    mealType?: MealType;
    mealInstruction?: string;
  } = {},
): SkeletonSlot {
  return {
    slotId: nextSlotId(dayNumber, slotType),
    slotType,
    status: 'empty',
    required: opts.required ?? false,
    position,
    timeWindow,
    mealType: opts.mealType,
    mealInstruction: opts.mealInstruction,
    aiInstruction: opts.aiInstruction,
  };
}

function filledSlot(
  dayNumber: number,
  slotType: SkeletonSlotType,
  position: number,
  filled: SkeletonSlot['filledData'] & object,
  opts: { required?: boolean; mustDoRef?: string } = {},
): SkeletonSlot {
  return {
    slotId: nextSlotId(dayNumber, slotType),
    slotType,
    status: 'filled',
    required: opts.required ?? true,
    position,
    timeWindow: {
      earliest: filled.startTime,
      latest: filled.startTime,
      duration: {
        min: Math.max(0, (toMinutes(filled.endTime) ?? 0) - (toMinutes(filled.startTime) ?? 0)),
        max: Math.max(0, (toMinutes(filled.endTime) ?? 0) - (toMinutes(filled.startTime) ?? 0)),
      },
    },
    filledData: filled,
    mustDoRef: opts.mustDoRef,
  };
}

function mealWindow(
  cfg: PatternGroupConfig,
  meal: MealType,
  dayStartMin: number,
  dayEndMin: number,
): SkeletonTimeWindow {
  // Conservative bands per meal — Filler LLM picks the actual time.
  const bands: Record<MealType, [number, number]> = {
    breakfast: [Math.max(dayStartMin, 7 * 60), Math.min(dayEndMin, 10 * 60 + 30)],
    lunch: [Math.max(dayStartMin, 12 * 60), Math.min(dayEndMin, 14 * 60 + 30)],
    dinner: [Math.max(dayStartMin, 18 * 60), Math.min(dayEndMin, 22 * 60)],
  };
  const [lo, hi] = bands[meal];
  return {
    earliest: fromMinutes(lo),
    latest: fromMinutes(hi),
    duration: { min: cfg.mealDuration.min, max: cfg.mealDuration.max },
  };
}

function mustDoCompatibleSlotType(category?: string): SkeletonSlotType {
  const c = (category ?? '').toLowerCase();
  if (/dining|restaurant|food|meal|breakfast|lunch|dinner/.test(c)) return 'meal';
  if (/night|bar|club|evening|cocktail/.test(c)) return 'evening';
  return 'must_do';
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildEmptyDaySkeleton(input: BuildSkeletonInput): BuildSkeletonResult {
  _slotSeq = 0; // deterministic per-day ids in a single build
  const patternGroup: PatternGroup =
    input.patternGroup ?? getPatternGroupForArchetype(input.archetypeName ?? '');
  const cfg = getPatternGroupConfig(patternGroup);
  const dayType = classifyDayType(input);

  const transferMins = input.airportTransferMinutes ?? 60;
  const slots: SkeletonSlot[] = [];
  const omitted: OmittedMustDo[] = [];

  // Day window from pattern group, adjusted by hard flight clocks.
  let dayStartMin = toMinutes(cfg.dayStartTime) ?? 9 * 60;
  let dayEndMin = toMinutes(cfg.dayEndTime) ?? 22 * 60;

  // 1) ARRIVAL pins (Day 1 with a flight) ──────────────────────────────
  if (input.isFirstDay && input.arrivalTime24) {
    const arr = toMinutes(input.arrivalTime24)!;
    const customsEnd = arr + 60;
    const transferEnd = customsEnd + transferMins;
    const hotelStdMin = toMinutes(input.hotelCheckInTime ?? '15:00') ?? 15 * 60;
    const canCheckIn = transferEnd >= hotelStdMin;

    slots.push(
      filledSlot(input.dayNumber, 'arrival', slots.length, {
        title: `Arrival`,
        category: 'transport',
        startTime: fromMinutes(arr),
        endTime: fromMinutes(customsEnd),
        source: 'flight_data',
      }),
      filledSlot(input.dayNumber, 'transport', slots.length, {
        title: 'Transfer to hotel',
        category: 'transit',
        startTime: fromMinutes(customsEnd),
        endTime: fromMinutes(transferEnd),
        source: 'flight_data',
      }),
    );

    if (input.hasHotelData) {
      const checkInStart = canCheckIn ? transferEnd : hotelStdMin;
      slots.push(
        filledSlot(input.dayNumber, canCheckIn ? 'hotel_checkin' : 'transport', slots.length, {
          title: canCheckIn ? 'Hotel check-in' : 'Bag drop at hotel',
          category: 'accommodation',
          startTime: fromMinutes(canCheckIn ? checkInStart : transferEnd),
          endTime: fromMinutes((canCheckIn ? checkInStart : transferEnd) + 30),
          source: 'hotel_data',
        }),
      );
      // Push the usable day start to AFTER bags are settled.
      dayStartMin = Math.max(dayStartMin, (canCheckIn ? checkInStart : transferEnd) + 30);
    } else {
      dayStartMin = Math.max(dayStartMin, transferEnd + 30);
    }
  }

  // 2) DEPARTURE pins (last day with a flight) ─────────────────────────
  const departureBlockStart = (() => {
    if (!(input.isLastDay && input.departureTime24)) return null;
    const dep = toMinutes(input.departureTime24)!;
    // Standard pre-flight buffer (international) — Phase 4 will refine per mode.
    const buffer = 180;
    const transferStart = dep - buffer - transferMins;
    const checkoutMax = toMinutes(input.hotelCheckOutTime ?? '11:00') ?? 11 * 60;
    const checkoutEnd = Math.min(checkoutMax, transferStart - 30);
    return { dep, transferStart, checkoutEnd };
  })();

  if (departureBlockStart) {
    const { dep, transferStart, checkoutEnd } = departureBlockStart;
    dayEndMin = Math.min(dayEndMin, transferStart);
    if (input.hasHotelData) {
      slots.push(
        filledSlot(input.dayNumber, 'hotel_checkout', 9999, {
          title: 'Hotel check-out',
          category: 'accommodation',
          startTime: fromMinutes(Math.max(checkoutEnd - 15, dayStartMin)),
          endTime: fromMinutes(checkoutEnd),
          source: 'hotel_data',
        }),
      );
    }
    slots.push(
      filledSlot(input.dayNumber, 'transport', 9999, {
        title: 'Transfer to airport',
        category: 'transit',
        startTime: fromMinutes(transferStart),
        endTime: fromMinutes(dep - 180),
        source: 'flight_data',
      }),
      filledSlot(input.dayNumber, 'departure', 9999, {
        title: 'Departure',
        category: 'transport',
        startTime: fromMinutes(dep - 180),
        endTime: fromMinutes(dep),
        source: 'flight_data',
      }),
    );
  }

  // 3) MEAL slots (empty, AI fills name) ───────────────────────────────
  const requiredMeals: MealType[] = (() => {
    if (dayType === 'morning_arrival' || dayType === 'standard') {
      const meals: MealType[] = [];
      if (cfg.breakfastRequired || dayType === 'standard') meals.push('breakfast');
      meals.push('lunch', 'dinner');
      return meals;
    }
    if (dayType === 'midday_arrival') return ['lunch', 'dinner'];
    if (dayType === 'latenight_arrival') return ['dinner'];
    if (dayType === 'departure') {
      // Conservative: always breakfast; lunch depends on departure clock (filler handles).
      const dep = toMinutes(input.departureTime24 ?? '') ?? 0;
      const meals: MealType[] = ['breakfast'];
      if (dep >= 16 * 60) meals.push('lunch');
      return meals;
    }
    return ['breakfast', 'lunch', 'dinner'];
  })();

  for (const meal of requiredMeals) {
    const win = mealWindow(cfg, meal, dayStartMin, dayEndMin);
    if (toMinutes(win.earliest)! > toMinutes(win.latest)!) continue; // no room
    slots.push(
      emptySlot(input.dayNumber, 'meal', slots.length, win, {
        required: true,
        mealType: meal,
        mealInstruction: cfg.mealInstruction,
        aiInstruction: `Name a real ${meal} venue in ${input.destination} consistent with the traveler's pattern group "${patternGroup}".`,
      }),
    );
  }

  // 4) MUST-DO allocation (priority desc, into empty activity slots) ───
  const dayMustDos = (input.mustDos ?? []).filter(
    (m) => m.fixedDayNumber == null || m.fixedDayNumber === input.dayNumber,
  );
  const sortedMustDos = [...dayMustDos].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  for (const md of sortedMustDos) {
    if (md.fixedTimeWindow) {
      slots.push(
        filledSlot(input.dayNumber, mustDoCompatibleSlotType(md.category), slots.length, {
          title: md.title,
          category: md.category ?? 'activity',
          startTime: md.fixedTimeWindow.startTime,
          endTime: md.fixedTimeWindow.endTime,
          source: 'must_do',
        }, { mustDoRef: md.id }),
      );
    } else {
      // Try to fit as an empty must_do slot in the activity band.
      const win: SkeletonTimeWindow = {
        earliest: fromMinutes(dayStartMin),
        latest: fromMinutes(dayEndMin),
        duration: { min: 60, max: 120 },
      };
      slots.push(
        emptySlot(input.dayNumber, mustDoCompatibleSlotType(md.category), slots.length, win, {
          required: true,
          aiInstruction: `MUST schedule: ${md.title}. Pick a believable time inside the window.`,
        }),
      );
      // Stamp mustDoRef on the just-pushed slot.
      slots[slots.length - 1].mustDoRef = md.id;
    }
  }

  // 5) ACTIVITY slots (empty filler) ──────────────────────────────────
  // Reserve slots so the Filler LLM has room to add neighborhood activities.
  // Capacity is whatever the pattern group's activity range allows minus
  // already-pinned must-dos and meals.
  const pinnedActivityCount = slots.filter(
    (s) => s.slotType === 'must_do' || s.slotType === 'activity' || s.slotType === 'evening',
  ).length;
  const targetActivitySlots = Math.max(
    cfg.activitySlots.min - pinnedActivityCount,
    0,
  );
  for (let i = 0; i < targetActivitySlots; i++) {
    slots.push(
      emptySlot(input.dayNumber, 'activity', slots.length, {
        earliest: fromMinutes(dayStartMin),
        latest: fromMinutes(dayEndMin),
        duration: { min: 60, max: 120 },
      }, {
        required: false,
        aiInstruction: `Choose an activity in ${input.destination} consistent with pattern group "${patternGroup}".`,
      }),
    );
  }

  // 6) EVENING slots (empty filler — pattern group decides density) ────
  for (let i = 0; i < cfg.eveningSlots.min; i++) {
    slots.push(
      emptySlot(input.dayNumber, 'evening', slots.length, {
        earliest: fromMinutes(Math.max(dayStartMin, 19 * 60)),
        latest: fromMinutes(dayEndMin),
        duration: { min: 60, max: 120 },
      }, {
        required: false,
        aiInstruction: `Choose an evening activity in ${input.destination} consistent with pattern group "${patternGroup}".`,
      }),
    );
  }

  // 7) UNSCHEDULED blocks (e.g. gentle pattern's free time) ────────────
  for (let i = 0; i < cfg.unscheduledBlocks; i++) {
    slots.push(
      emptySlot(input.dayNumber, 'unscheduled', slots.length, null, {
        required: false,
        aiInstruction: 'Free time to explore at your own pace.',
      }),
    );
  }

  // Stable position numbering after departure pins (which used 9999).
  slots.sort((a, b) => a.position - b.position);
  slots.forEach((s, i) => { s.position = i; });

  const skeleton: SkeletonDay = {
    dayNumber: input.dayNumber,
    dayType,
    patternGroup,
    archetypeName: input.archetypeName ?? '',
    destination: input.destination,
    date: input.date,
    slots,
    constraints: {
      dayStartTime: fromMinutes(dayStartMin),
      dayEndTime: fromMinutes(dayEndMin),
      maxActivitySlots: cfg.activitySlots.max,
      mealWeight: cfg.mealWeight,
      bufferMinutes: cfg.bufferMinutes,
      unscheduledBlocks: cfg.unscheduledBlocks,
      eveningSlots: cfg.eveningSlots.max,
    },
  };

  return { skeleton, omitted };
}
