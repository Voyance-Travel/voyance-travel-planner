/**
 * parse-fine-tune-intents.ts
 *
 * Parses free-form trip notes (the "Fine-Tune" textarea, `additionalNotes`,
 * or any user-supplied trip-wide blob) into structured per-day user intents
 * that feed the Day Brief / Day Truth Ledger.
 *
 * Supported phrasings:
 *   - "Day 3: dinner at Belcanto"
 *   - "April 19 — go to JNcQUOI Asia"
 *   - "Sunday: spa morning"
 *   - "tonight" / "tomorrow" / "first night" / "last night" (resolved against trip dates)
 *   - Trip-wide notes (no day marker) → returned as `tripWide` constraints
 *
 * Pure function. No IO. No AI.
 */

export interface ParsedDailyIntent {
  dayNumber: number;
  /** Original line as the user wrote it. */
  raw: string;
  /** Cleaned title (day marker stripped, leading verbs trimmed). */
  title: string;
  /** Inferred kind: dinner, lunch, breakfast, drinks, spa, activity, avoid. */
  kind: string;
  /** Optional HH:MM start time if the user mentioned one. */
  startTime?: string;
  /** Priority — explicit "must" / "want" / "need" → 'must', otherwise 'should'. */
  priority: 'must' | 'should';
  source: 'fine_tune';
}

export interface ParseFineTuneInput {
  /** Free-form text from the user. */
  notes: string;
  /** Trip start date YYYY-MM-DD — used to resolve "April 19", "Sunday", "tonight". */
  tripStartDate?: string;
  /** Total trip days — used to clamp out-of-range Day numbers and resolve "last night". */
  totalDays?: number;
}

export interface ParseFineTuneResult {
  /** Per-day structured intents. */
  perDay: ParsedDailyIntent[];
  /** Lines with no day marker — applied to every day's user_constraints. */
  tripWide: string[];
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

const DAY_NAMES: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
};

const MUST_KEYWORDS = /\b(must|want|need|require|please|definitely|gotta|going to|will)\b/i;

const KIND_INFER = [
  { kw: /\b(breakfast|brunch)\b/i, kind: 'breakfast' },
  { kw: /\blunch\b/i, kind: 'lunch' },
  { kw: /\bdinner\b/i, kind: 'dinner' },
  { kw: /\b(drinks|cocktails?|bar|aperitif|happy hour|nightcap)\b/i, kind: 'drinks' },
  { kw: /\b(spa|massage|hammam|sauna|wellness)\b/i, kind: 'spa' },
  { kw: /\b(avoid|skip|no |don'?t|do not)\b/i, kind: 'avoid' },
];

function diffDays(fromYMD: string, toYMD: string): number | null {
  const a = new Date(`${fromYMD}T00:00:00`);
  const b = new Date(`${toYMD}T00:00:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function inferKind(text: string): string {
  for (const r of KIND_INFER) if (r.kw.test(text)) return r.kind;
  return 'activity';
}

function extractTime(text: string): string | undefined {
  // 7pm, 7:30pm, 19:00, 7 pm, 8:15 PM
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return undefined;
  let hour = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toLowerCase();
  if (hour < 0 || hour > 23 || min < 0 || min > 59) return undefined;
  // Only treat as time if it has am/pm OR colon (avoid matching plain numbers)
  if (!ampm && !m[2]) return undefined;
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function cleanTitle(line: string): string {
  return line
    // Strip leading day markers
    .replace(/^\s*(Day\s+\d+|April\s+\d+|May\s+\d+|June\s+\d+|July\s+\d+|August\s+\d+|September\s+\d+|October\s+\d+|November\s+\d+|December\s+\d+|January\s+\d+|February\s+\d+|March\s+\d+|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|tonight|tomorrow|first night|last night)\b\s*[-:—–]?\s*/i, '')
    // Strip leading bullets
    .replace(/^[•\-*]\s*/, '')
    // Strip leading "I want to / we'll / let's / please"
    .replace(/^(i (would |'d )?(like|love|want|need)( to)?|we (would |'d )?(like|love|want|need)( to)?|let'?s|please)\s+/i, '')
    .trim();
}

/**
 * Resolve a single line into { dayNumber, raw, title, kind, startTime, priority }.
 * Returns null if no day marker is found.
 */
function resolveLine(
  line: string,
  tripStartDate: string | undefined,
  totalDays: number,
): ParsedDailyIntent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let dayNumber: number | null = null;

  // "Day N"
  const dayMatch = trimmed.match(/\bDay\s+(\d+)\b/i);
  if (dayMatch) {
    const n = parseInt(dayMatch[1], 10);
    if (n >= 1 && (!totalDays || n <= totalDays)) dayNumber = n;
  }

  // "Month Day" e.g. "April 19", "Apr 19th"
  if (dayNumber == null && tripStartDate) {
    const monthDay = trimmed.match(/\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
    if (monthDay) {
      const month = MONTHS[monthDay[1].toLowerCase()];
      const day = parseInt(monthDay[2], 10);
      if (month != null && day >= 1 && day <= 31) {
        const start = new Date(`${tripStartDate}T00:00:00`);
        if (!isNaN(start.getTime())) {
          // Try same year as trip start; if before start, try next year
          let target = new Date(start.getFullYear(), month, day);
          if (target < start) target = new Date(start.getFullYear() + 1, month, day);
          const ymd = target.toISOString().slice(0, 10);
          const delta = diffDays(tripStartDate, ymd);
          if (delta != null && delta >= 0 && (!totalDays || delta < totalDays)) {
            dayNumber = delta + 1;
          }
        }
      }
    }
  }

  // Day-of-week — only if unique within the trip (otherwise ambiguous)
  if (dayNumber == null && tripStartDate && totalDays > 0) {
    const dowMatch = trimmed.match(/\b(sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b/i);
    if (dowMatch) {
      const targetDow = DAY_NAMES[dowMatch[1].toLowerCase()];
      const start = new Date(`${tripStartDate}T00:00:00`);
      if (!isNaN(start.getTime())) {
        const matches: number[] = [];
        for (let i = 0; i < totalDays; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          if (d.getDay() === targetDow) matches.push(i + 1);
        }
        if (matches.length === 1) dayNumber = matches[0];
        // If multiple matches, ambiguous — leave as tripWide
      }
    }
  }

  // Relative markers
  if (dayNumber == null) {
    if (/\bfirst night\b/i.test(trimmed) || /\barrival night\b/i.test(trimmed)) dayNumber = 1;
    else if (/\blast night\b/i.test(trimmed) || /\bfinal night\b/i.test(trimmed)) {
      if (totalDays > 0) dayNumber = totalDays;
    }
    // "tonight" / "tomorrow" without a current-day reference are ambiguous — skip
  }

  if (dayNumber == null) return null;

  const startTime = extractTime(trimmed);
  const kind = inferKind(trimmed);
  const priority = MUST_KEYWORDS.test(trimmed) ? 'must' : 'should';
  const title = cleanTitle(trimmed) || trimmed;

  return {
    dayNumber,
    raw: trimmed,
    title,
    kind,
    startTime,
    priority,
    source: 'fine_tune',
  };
}

export function parseFineTuneIntoDailyIntents(input: ParseFineTuneInput): ParseFineTuneResult {
  const perDay: ParsedDailyIntent[] = [];
  const tripWide: string[] = [];
  const notes = (input.notes || '').trim();
  if (!notes) return { perDay, tripWide };

  const totalDays = input.totalDays || 0;

  // Split into logical lines: support both newlines and bullet-style separators
  const rawLines = notes
    .split(/\r?\n|(?<=[.!?])\s{2,}/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of rawLines) {
    const intent = resolveLine(line, input.tripStartDate, totalDays);
    if (intent) perDay.push(intent);
    else tripWide.push(line);
  }

  return { perDay, tripWide };
}
