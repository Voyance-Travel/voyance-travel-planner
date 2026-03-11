// src/lib/schema-compiler/time-parser.ts
// Parse natural language time expressions into HH:MM format.
// Solves Fix 19 Bug 2: "Noon" and other natural language times not parsed.
//
// ISOLATION: Pure utility functions. No external dependencies.

/**
 * Normalize natural language time words to standard format.
 * "Noon" → "12:00pm", "midnight" → "12:00am", etc.
 */
export function normalizeTimeText(text: string): string {
  return text
    .replace(/\bnoon\b/gi, '12:00pm')
    .replace(/\bmidnight\b/gi, '12:00am')
    .replace(/\bmidday\b/gi, '12:00pm')
    .replace(/\bhalf\s*past\s*(\d+)/gi, '$1:30')
    .replace(/\bquarter\s*past\s*(\d+)/gi, '$1:15')
    .replace(/\bquarter\s*to\s*(\d+)/gi, (_, h) => `${parseInt(h) - 1}:45`);
}

/**
 * Extract a time range from a text string.
 * Returns { startTime, endTime } in HH:MM (24h) format, or null if not found.
 *
 * Handles formats:
 * - "9am-5pm", "9:00am-5:00pm", "09:00-17:00"
 * - "Noon-4:30pm", "9am to 5pm", "9am – 5pm"
 * - "9-5pm" (infers am/pm from context)
 */
export function extractTimeRange(text: string): { startTime: string; endTime: string } | null {
  // First normalize natural language
  const normalized = normalizeTimeText(text);

  // Pattern: HH:MM(am/pm) separator HH:MM(am/pm)
  // Separators: -, –, —, to, through
  const timePattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const match = normalized.match(timePattern);

  if (!match) return null;

  let startStr = match[1].trim();
  let endStr = match[2].trim();

  // If end has am/pm but start doesn't, infer start's am/pm
  const endHasAmPm = /am|pm/i.test(endStr);
  const startHasAmPm = /am|pm/i.test(startStr);

  if (endHasAmPm && !startHasAmPm) {
    // If end is pm and start is a small number, start is probably am
    const startHour = parseInt(startStr);
    const endIsPm = /pm/i.test(endStr);
    if (endIsPm && startHour <= 11) {
      startStr += 'am';
    } else {
      // Same period
      startStr += endIsPm ? 'pm' : 'am';
    }
  }

  const startTime = parseToHHMM(startStr);
  const endTime = parseToHHMM(endStr);

  if (!startTime || !endTime) return null;

  return { startTime, endTime };
}

/**
 * Parse a single time string to HH:MM (24-hour format).
 * "9am" → "09:00", "5:30pm" → "17:30", "14:00" → "14:00"
 */
export function parseToHHMM(timeStr: string): string | null {
  if (!timeStr) return null;

  const cleaned = timeStr.trim().toLowerCase();

  // Already in 24h format (HH:MM)
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24 && !cleaned.includes('am') && !cleaned.includes('pm')) {
    const h = parseInt(match24[1]);
    const m = parseInt(match24[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // 12h format with am/pm
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

/**
 * Clean an activity title by removing time ranges from it.
 * "US Open Noon-4:30pm" → "US Open"
 * "US Open 9am-5pm" → "US Open"
 * "Broadway Show 8pm-10:30pm" → "Broadway Show"
 *
 * Solves Fix 19 Bug 2: garbled activity titles.
 */
export function cleanActivityTitle(rawTitle: string): string {
  if (!rawTitle) return rawTitle;

  let cleaned = rawTitle;

  // Step 1: Remove full time range patterns WITH their surrounding prepositions
  // "from 9am to 5pm", "from 9:00 AM until 4:30 PM", "9am-5pm", "9am - 5pm"
  cleaned = cleaned.replace(/\b(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:to|until|through|-|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi, '');

  // Step 2: Remove noon/midnight range patterns with prepositions
  cleaned = cleaned.replace(/\b(?:from\s+)?(?:noon|midnight|midday)\s*(?:to|until|through|-|–|—)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '');
  cleaned = cleaned.replace(/\b(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|until|through|-|–|—)\s*(?:noon|midnight|midday)\b/gi, '');

  // Step 3: Remove standalone time references with prepositions
  // "from 9am", "until 5pm", "starting at noon", "at 9:00 AM", "by 4:30 PM"
  cleaned = cleaned.replace(/\b(?:from|until|till|to|through|starting\s+at|ending\s+at|at|by|before|after)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)|noon|midnight|midday)\b/gi, '');

  // Step 4: Remove any remaining standalone time patterns
  cleaned = cleaned.replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '');

  // Step 5: Remove orphaned prepositions left behind (at end of string)
  cleaned = cleaned.replace(/\b(?:from|until|till|through|starting|ending)\s*(?:from|until|till|through|starting|ending|\s)*$/gi, '');
  // Mid-string orphaned prepositions
  cleaned = cleaned.replace(/\s+(?:from|until|till|through)\s+(?:from|until|till|through|\s)*\s*/gi, ' ');

  // Step 6: Clean up extra whitespace and trailing punctuation
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  cleaned = cleaned.replace(/[,\-–—]\s*$/, '').trim();

  return cleaned;
}

// --- Time arithmetic utilities ---

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440; // handle negative/overflow
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
