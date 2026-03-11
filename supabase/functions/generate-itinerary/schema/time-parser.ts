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
  return rawTitle
    .replace(/\b(?:noon|midnight|midday)\s*[-–—to]+\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–—to]+\s*(?:noon|midnight|midday)\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–—to]+\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '')
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
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
