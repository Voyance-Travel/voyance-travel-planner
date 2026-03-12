// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// This file is a copy of src/lib/schema-compiler/schema-validator.ts with import paths
// adjusted for the Deno edge function environment.
// If you modify this file, also update the src/ version.
// ============================================================

import type {
  DaySchema,
  DaySlot,
  SlotValidation,
  SlotOverride,
} from './types.ts';

export interface ValidationResult {
  passed: boolean;
  validations: SlotValidation[];
  overrides: SlotOverride[];
  severity: 'pass' | 'low' | 'medium' | 'high';
  summary: string;
  correctedActivities: AiActivity[];
}

export interface AiActivity {
  id?: string;
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  location?: string;
  cost?: number;
  bookingRequired?: boolean;
  personalization?: string;
  tips?: string;
  crowdLevel?: string;
  isHiddenGem?: boolean;
  hasTimingHack?: boolean;
  suggestedFor?: string;
  [key: string]: unknown;
}

export function validateAgainstSchema(
  schema: DaySchema,
  aiActivities: AiActivity[]
): ValidationResult {
  const validations: SlotValidation[] = [];
  const overrides: SlotOverride[] = [];
  let corrected = [...aiActivities.map(a => ({ ...a }))];

  validations.push(checkSlotCount(schema, corrected));

  const integrityResults = checkFilledSlotIntegrity(schema, corrected, overrides);
  validations.push(...integrityResults.validations);
  corrected = integrityResults.corrected;

  validations.push(...checkTimeWindowCompliance(schema, corrected));
  validations.push(...checkDurationCompliance(corrected));
  validations.push(...checkMealPresence(schema, corrected));

  if (schema.travelers.length > 1) {
    const groupResult = checkGroupAttribution(schema, corrected, overrides);
    validations.push(...groupResult.validations);
    corrected = groupResult.corrected;
  }

  validations.push(...checkGapDetection(corrected));
  validations.push(...checkCategoryDiversity(corrected));

  const hasHigh = validations.some(v => !v.passed && v.severity === 'high');
  const hasMedium = validations.some(v => !v.passed && v.severity === 'medium');
  const hasLow = validations.some(v => !v.passed && v.severity === 'low');

  const severity = hasHigh ? 'high' : hasMedium ? 'medium' : hasLow ? 'low' : 'pass';
  const failedChecks = validations.filter(v => !v.passed);

  const summary = severity === 'pass'
    ? `Day ${schema.dayNumber}: All ${validations.length} checks passed.`
    : `Day ${schema.dayNumber}: ${failedChecks.length} of ${validations.length} checks failed. Severity: ${severity}. Issues: ${failedChecks.map(v => v.message).join('; ')}`;

  return {
    passed: severity === 'pass' || severity === 'low',
    validations,
    overrides,
    severity,
    summary,
    correctedActivities: corrected,
  };
}

function checkSlotCount(schema: DaySchema, activities: AiActivity[]): SlotValidation {
  const expectedRequired = schema.slots.filter(s => s.required).length;
  const actual = activities.length;
  const totalSlots = schema.slots.length;
  const passed = actual >= expectedRequired;
  const sev = actual < expectedRequired - 1 ? 'high' : actual < expectedRequired ? 'medium' : 'low';

  return {
    slotId: 'global', slotType: 'activity', check: 'slot_count',
    passed, severity: passed ? 'low' : sev,
    message: passed
      ? `Slot count OK: ${actual} activities for ${totalSlots} schema slots (${expectedRequired} required).`
      : `Slot count MISMATCH: AI returned ${actual} activities but ${expectedRequired} required slots expected (${totalSlots} total).`,
  };
}

function checkFilledSlotIntegrity(
  schema: DaySchema,
  activities: AiActivity[],
  overrides: SlotOverride[]
): { validations: SlotValidation[]; corrected: AiActivity[] } {
  const validations: SlotValidation[] = [];
  const corrected = [...activities];
  const filledSlots = schema.slots.filter(s => s.status === 'filled' && s.filledData);

  for (const slot of filledSlots) {
    const data = slot.filledData!;
    // Match by title first (exact or substring) to avoid false matches when
    // two activities share the same startTime (e.g. breakfast and a must-do both at 09:00).
    let matchIdx = corrected.findIndex(
      a => a.title != null && data.title != null &&
        a.title.toLowerCase() === data.title.toLowerCase()
    );
    if (matchIdx === -1) {
      // Fuzzy title match — first 15 chars
      const prefix = (data.title || '').toLowerCase().substring(0, 15);
      if (prefix.length > 3) {
        matchIdx = corrected.findIndex(
          a => a.title?.toLowerCase().includes(prefix)
        );
      }
    }
    if (matchIdx === -1) {
      // Fallback: match by startTime only if title didn't match
      matchIdx = corrected.findIndex(a => a.startTime === data.startTime);
    }

    if (matchIdx === -1) {
      validations.push({
        slotId: slot.slotId, slotType: slot.slotType, check: 'filled_slot_integrity',
        passed: false, severity: 'medium',
        message: `Filled slot "${data.title}" (${slot.slotType}) is missing from AI response.`,
      });
      continue;
    }

    const activity = corrected[matchIdx];
    let modified = false;

    if (activity.title !== data.title) {
      overrides.push({
        slotId: slot.slotId, field: 'title',
        originalValue: activity.title, correctedValue: data.title,
        reason: 'AI modified a locked slot title. Overwriting with original.',
      });
      corrected[matchIdx] = { ...corrected[matchIdx], title: data.title };
      modified = true;
    }

    if (activity.startTime !== data.startTime || activity.endTime !== data.endTime) {
      overrides.push({
        slotId: slot.slotId, field: 'time',
        originalValue: `${activity.startTime}-${activity.endTime}`,
        correctedValue: `${data.startTime}-${data.endTime}`,
        reason: 'AI modified locked slot timing. Overwriting with original.',
      });
      corrected[matchIdx] = { ...corrected[matchIdx], startTime: data.startTime, endTime: data.endTime };
      modified = true;
    }

    if (data.cost !== undefined && activity.cost !== data.cost && data.cost > 0) {
      overrides.push({
        slotId: slot.slotId, field: 'cost',
        originalValue: activity.cost, correctedValue: data.cost,
        reason: 'AI modified locked slot cost. Overwriting with original.',
      });
      corrected[matchIdx] = { ...corrected[matchIdx], cost: data.cost };
      modified = true;
    }

    validations.push({
      slotId: slot.slotId, slotType: slot.slotType, check: 'filled_slot_integrity',
      passed: !modified, severity: 'low',
      message: modified
        ? `Filled slot "${data.title}" was modified by AI — auto-corrected.`
        : `Filled slot "${data.title}" preserved correctly.`,
    });
  }

  return { validations, corrected };
}

function checkTimeWindowCompliance(schema: DaySchema, activities: AiActivity[]): SlotValidation[] {
  const validations: SlotValidation[] = [];
  const emptySlots = schema.slots.filter(s => s.status === 'empty' && s.timeWindow);

  for (const slot of emptySlots) {
    if (!slot.timeWindow) continue;

    const activity = activities.find(a => {
      const startMin = parseTimeToMinutes(a.startTime);
      const windowEarliest = parseTimeToMinutes(slot.timeWindow!.earliest);
      const windowLatest = parseTimeToMinutes(slot.timeWindow!.latest) + slot.timeWindow!.duration.max;
      return startMin >= windowEarliest - 60 && startMin <= windowLatest + 60;
    });

    if (!activity) continue;

    const startMin = parseTimeToMinutes(activity.startTime);
    const earliest = parseTimeToMinutes(slot.timeWindow.earliest);
    const latest = parseTimeToMinutes(slot.timeWindow.latest);
    const withinWindow = startMin >= earliest - 30 && startMin <= latest + 30;

    validations.push({
      slotId: slot.slotId, slotType: slot.slotType, check: 'time_window',
      passed: withinWindow, severity: 'low',
      message: withinWindow
        ? `"${activity.title}" starts at ${activity.startTime}, within window ${slot.timeWindow.earliest}-${slot.timeWindow.latest}.`
        : `"${activity.title}" starts at ${activity.startTime}, outside window ${slot.timeWindow.earliest}-${slot.timeWindow.latest}.`,
    });
  }

  return validations;
}

function checkDurationCompliance(activities: AiActivity[]): SlotValidation[] {
  const validations: SlotValidation[] = [];

  for (const activity of activities) {
    if (!activity.startTime || !activity.endTime) continue;
    const durationMin = parseTimeToMinutes(activity.endTime) - parseTimeToMinutes(activity.startTime);

    if (durationMin < 15 || durationMin > 480) {
      validations.push({
        slotId: 'duration_check', slotType: 'activity', check: 'duration',
        passed: false, severity: durationMin < 0 ? 'high' : 'low',
        message: `"${activity.title}" has duration ${durationMin} min (${activity.startTime}-${activity.endTime}). ${durationMin < 0 ? 'Negative duration!' : 'Unusual duration.'}`,
      });
    }
  }

  return validations;
}

function checkMealPresence(schema: DaySchema, activities: AiActivity[]): SlotValidation[] {
  const validations: SlotValidation[] = [];
  const requiredMeals = schema.slots.filter(s => s.slotType === 'meal' && s.required && s.mealType);

  for (const mealSlot of requiredMeals) {
    const mealType = mealSlot.mealType!;

    let found = activities.some(
      a => a.category === 'dining' || a.category?.toLowerCase().includes(mealType)
    );

    if (!found && mealSlot.timeWindow) {
      const earliest = parseTimeToMinutes(mealSlot.timeWindow.earliest);
      const latest = parseTimeToMinutes(mealSlot.timeWindow.latest) + (mealSlot.timeWindow.duration?.max || 120);
      found = activities.some(a => {
        if (a.category !== 'dining') return false;
        const startMin = parseTimeToMinutes(a.startTime);
        return startMin >= earliest - 60 && startMin <= latest;
      });
    }

    validations.push({
      slotId: mealSlot.slotId, slotType: 'meal', check: 'meal_presence',
      passed: found, severity: found ? 'low' : 'medium',
      message: found
        ? `${mealType} meal found in itinerary.`
        : `MISSING: Required ${mealType} meal not found in AI response.`,
    });
  }

  return validations;
}

function checkGroupAttribution(
  schema: DaySchema,
  activities: AiActivity[],
  overrides: SlotOverride[]
): { validations: SlotValidation[]; corrected: AiActivity[] } {
  const validations: SlotValidation[] = [];
  const corrected = [...activities];
  const allIds = schema.travelers.map(t => t.id).join(',');
  let missingCount = 0;

  for (let i = 0; i < corrected.length; i++) {
    if (!corrected[i].suggestedFor) {
      missingCount++;
      overrides.push({
        slotId: `activity_${i}`, field: 'suggestedFor',
        originalValue: null, correctedValue: allIds,
        reason: 'Group trip activity missing suggestedFor. Backfilled with all traveler IDs.',
      });
      corrected[i] = { ...corrected[i], suggestedFor: allIds };
    }
  }

  validations.push({
    slotId: 'global', slotType: 'activity', check: 'group_attribution',
    passed: missingCount === 0, severity: 'low',
    message: missingCount === 0
      ? 'All activities have suggestedFor attribution.'
      : `${missingCount} activities were missing suggestedFor — auto-backfilled.`,
  });

  return { validations, corrected };
}

function checkGapDetection(activities: AiActivity[]): SlotValidation[] {
  const validations: SlotValidation[] = [];
  const sorted = [...activities].sort((a, b) =>
    parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
  );

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = parseTimeToMinutes(sorted[i].endTime);
    const nextStart = parseTimeToMinutes(sorted[i + 1].startTime);
    const gap = nextStart - currentEnd;
    const isSleepingHours = currentEnd >= 23 * 60 || nextStart <= 7 * 60;

    if (gap > 90 && !isSleepingHours) {
      validations.push({
        slotId: `gap_${i}`, slotType: 'activity', check: 'gap_detection',
        passed: false, severity: gap > 150 ? 'medium' : 'low',
        message: `${gap} minute gap between "${sorted[i].title}" (ends ${sorted[i].endTime}) and "${sorted[i + 1].title}" (starts ${sorted[i + 1].startTime}).`,
      });
    }
  }

  if (validations.length === 0) {
    validations.push({
      slotId: 'global', slotType: 'activity', check: 'gap_detection',
      passed: true, severity: 'low', message: 'No significant gaps detected.',
    });
  }

  return validations;
}

function checkCategoryDiversity(activities: AiActivity[]): SlotValidation[] {
  const validations: SlotValidation[] = [];
  const skipCats = new Set(['dining', 'hotel', 'transport', 'arrival', 'departure', 'free_time']);
  const nonMeal = activities.filter(a => !skipCats.has(a.category));

  for (let i = 0; i < nonMeal.length - 1; i++) {
    if (nonMeal[i].category === nonMeal[i + 1].category) {
      validations.push({
        slotId: `diversity_${i}`, slotType: 'activity', check: 'category_diversity',
        passed: false, severity: 'low',
        message: `Consecutive same-category: "${nonMeal[i].title}" and "${nonMeal[i + 1].title}" are both "${nonMeal[i].category}".`,
      });
    }
  }

  if (validations.length === 0) {
    validations.push({
      slotId: 'global', slotType: 'activity', check: 'category_diversity',
      passed: true, severity: 'low', message: 'Good category diversity — no consecutive same-category activities.',
    });
  }

  return validations;
}

function parseTimeToMinutes(time: string): number {
  if (!time || !time.includes(':')) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}
