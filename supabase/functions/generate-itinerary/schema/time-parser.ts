// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// This file is a copy of src/lib/schema-compiler/time-parser.ts with import paths
// adjusted for the Deno edge function environment.
// If you modify this file, also update the src/ version.
// ============================================================

export function normalizeTimeText(text: string): string {
  return text
    .replace(/\bnoon\b/gi, '12:00pm')
    .replace(/\bmidnight\b/gi, '12:00am')
    .replace(/\bmidday\b/gi, '12:00pm')
    .replace(/\bhalf\s*past\s*(\d+)/gi, '$1:30')
    .replace(/\bquarter\s*past\s*(\d+)/gi, '$1:15')
    .replace(/\bquarter\s*to\s*(\d+)/gi, (_, h) => `${parseInt(h) - 1}:45`);
}

export function extractTimeRange(text: string): { startTime: string; endTime: string } | null {
  const normalized = normalizeTimeText(text);
  const timePattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const match = normalized.match(timePattern);
  if (!match) return null;

  let startStr = match[1].trim();
  let endStr = match[2].trim();

  const endHasAmPm = /am|pm/i.test(endStr);
  const startHasAmPm = /am|pm/i.test(startStr);

  if (endHasAmPm && !startHasAmPm) {
    const startHour = parseInt(startStr);
    const endIsPm = /pm/i.test(endStr);
    if (endIsPm && startHour <= 11) {
      startStr += 'am';
    } else {
      startStr += endIsPm ? 'pm' : 'am';
    }
  }

  const startTime = parseToHHMM(startStr);
  const endTime = parseToHHMM(endStr);
  if (!startTime || !endTime) return null;

  return { startTime, endTime };
}

export function parseToHHMM(timeStr: string): string | null {
  if (!timeStr) return null;
  const cleaned = timeStr.trim().toLowerCase();

  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24 && !cleaned.includes('am') && !cleaned.includes('pm')) {
    const h = parseInt(match24[1]);
    const m = parseInt(match24[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  const match12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    let h = parseInt(match12[1]);
    const m = parseInt(match12[2] || '0');
    const isPm = match12[3].toLowerCase() === 'pm';
    if (h === 12) {
      h = isPm ? 12 : 0;
    } else if (isPm) {
      h += 12;
    }
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  return null;
}

export function cleanActivityTitle(rawTitle: string): string {
  if (!rawTitle) return rawTitle;

  let cleaned = rawTitle;

  // Step 1: Remove full time range patterns WITH their surrounding prepositions
  cleaned = cleaned.replace(/\b(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:to|until|through|-|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi, '');

  // Step 2: Remove noon/midnight range patterns with prepositions
  cleaned = cleaned.replace(/\b(?:from\s+)?(?:noon|midnight|midday)\s*(?:to|until|through|-|–|—)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '');
  cleaned = cleaned.replace(/\b(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|until|through|-|–|—)\s*(?:noon|midnight|midday)\b/gi, '');

  // Step 3: Remove standalone time references with prepositions
  cleaned = cleaned.replace(/\b(?:from|until|till|to|through|starting\s+at|ending\s+at|at|by|before|after)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)|noon|midnight|midday)\b/gi, '');

  // Step 4: Remove any remaining standalone time patterns
  cleaned = cleaned.replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '');

  // Step 5: Remove orphaned prepositions left behind
  cleaned = cleaned.replace(/\b(?:from|until|till|through|starting|ending)\s*(?:from|until|till|through|starting|ending|\s)*$/gi, '');
  cleaned = cleaned.replace(/\s+(?:from|until|till|through)\s+(?:from|until|till|through|\s)*\s*/gi, ' ');

  // Step 6: Clean up extra whitespace and trailing punctuation
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  cleaned = cleaned.replace(/[,\-–—]\s*$/, '').trim();

  return cleaned;
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutes(time: string, mins: number): string {
  return minutesToTime(parseTimeToMinutes(time) + mins);
}

export function subtractMinutes(time: string, mins: number): string {
  return minutesToTime(parseTimeToMinutes(time) - mins);
}
