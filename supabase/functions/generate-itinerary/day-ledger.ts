/**
 * day-ledger.ts — Day Truth Ledger
 *
 * The single deterministic record of "what is true and required for Day N."
 * Built BEFORE generation, injected into the prompt, validated AFTER.
 *
 * Pure function. No IO, no AI.
 */

import { getKnownClosures, type KnownClosure } from '../_shared/known-closures.ts';
import { getPublicHolidayForDate, type PublicHoliday } from '../_shared/public-holidays.ts';

export interface LedgerHardFacts {
  hotel?: { name: string; address?: string; checkIn?: string; checkOut?: string } | null;
  transitionDay?: { from: string; to: string; mode: string; departTime?: string; arriveTime?: string } | null;
  flight?: Record<string, unknown> | null;
  isFirstDay: boolean;
  isLastDay: boolean;
  isHotelChange: boolean;
}

export interface LedgerUserIntent {
  kind: string;          // 'dinner' | 'lunch' | 'activity' | 'spa' | ...
  title: string;
  startTime?: string;    // HH:MM
  endTime?: string;
  source: string;        // 'manual_paste' | 'chat' | 'pinned' | 'edited' | 'harvested'
  note: string;          // Human-readable reminder for the AI
  priority: 'must' | 'should';
  lockedSource?: string; // fingerprint
}

export interface LedgerAlreadyDone {
  title: string;
  dayNumber: number;
}

export interface LedgerClosure {
  reason: string;
  examples?: string[];
}

export interface LedgerFreeSlot {
  from: string; // HH:MM
  to: string;
}

export interface DayLedger {
  dayNumber: number;
  date: string;            // YYYY-MM-DD
  dayOfWeek: string;       // 'Saturday'
  city: string;
  country: string;
  hardFacts: LedgerHardFacts;
  userIntent: LedgerUserIntent[];
  alreadyDone: LedgerAlreadyDone[];
  closures: LedgerClosure[];
  freeSlots: LedgerFreeSlot[];
  /** Optional: holiday match for the date */
  holiday?: PublicHoliday | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseHHMM(t?: string): number | null {
  if (!t) return null;
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function minsToHHMM(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${h}:${mm}`;
}

function inferKind(title: string, category?: string): string {
  const t = (title || '').toLowerCase();
  const c = (category || '').toLowerCase();
  if (t.includes('breakfast')) return 'breakfast';
  if (t.includes('lunch')) return 'lunch';
  if (t.includes('dinner')) return 'dinner';
  if (t.includes('drinks') || t.includes('cocktail') || t.includes('bar')) return 'drinks';
  if (t.includes('spa') || t.includes('massage') || t.includes('hammam')) return 'spa';
  if (c) return c;
  return 'activity';
}

export interface BuildDayLedgerInput {
  dayNumber: number;
  date: string;                     // YYYY-MM-DD
  city: string;
  country: string;
  hardFacts: LedgerHardFacts;
  /** User-locked / pasted / pinned activities for this day. */
  anchors: Array<Record<string, any>>;
  /** Activities from prior days (any day < dayNumber). */
  priorDayActivities?: Array<{ title?: string; name?: string; dayNumber: number }>;
}

export function buildDayLedger(input: BuildDayLedgerInput): DayLedger {
  const { dayNumber, date, city, country, hardFacts, anchors, priorDayActivities = [] } = input;

  const d = new Date(date.length > 10 ? date : `${date}T00:00:00`);
  const dow = isNaN(d.getTime()) ? 0 : d.getDay();
  const dayOfWeek = DAY_NAMES[dow];

  // userIntent — keep order, dedupe by title+time
  const seen = new Set<string>();
  const userIntent: LedgerUserIntent[] = [];
  for (const a of anchors || []) {
    const title = (a.title || a.name || '').trim();
    if (!title) continue;
    const startTime = a.startTime || a.start_time || undefined;
    const key = `${title.toLowerCase()}|${startTime || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const source = a.source || a.anchorSource || 'manual_paste';
    const kind = inferKind(title, a.category);
    userIntent.push({
      kind,
      title,
      startTime,
      endTime: a.endTime || a.end_time || undefined,
      source,
      note: `User locked this — DO NOT replace, DO NOT retime, DO NOT drop.`,
      priority: 'must',
      lockedSource: a.lockedSource,
    });
  }

  // alreadyDone — dedupe by title
  const doneSeen = new Set<string>();
  const alreadyDone: LedgerAlreadyDone[] = [];
  for (const p of priorDayActivities) {
    const t = (p.title || p.name || '').trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (doneSeen.has(key)) continue;
    doneSeen.add(key);
    alreadyDone.push({ title: t, dayNumber: p.dayNumber });
  }

  // closures — known weekday closures + holiday
  const known: KnownClosure[] = getKnownClosures(city, dow);
  const closures: LedgerClosure[] = known.map((k) => ({ reason: k.reason, examples: k.examples }));
  const holiday = getPublicHolidayForDate(country, date);
  if (holiday) {
    closures.push({
      reason: `Public holiday: ${holiday.name}${holiday.impact ? ` — ${holiday.impact}` : ''}`,
    });
  }

  // freeSlots — subtract userIntent time-blocks from a default day window
  const dayStart = 8 * 60;   // 08:00
  const dayEnd = 23 * 60;    // 23:00
  const blocks: Array<[number, number]> = [];
  for (const u of userIntent) {
    const s = parseHHMM(u.startTime);
    if (s == null) continue;
    const e = parseHHMM(u.endTime) ?? s + 90; // assume 90m if no endTime
    blocks.push([Math.max(dayStart, s - 15), Math.min(dayEnd, e + 15)]); // 15m buffer
  }
  // Add hotel transitions roughly: check-in 15:00 (first day), check-out 11:00 (last day)
  if (hardFacts.isFirstDay && hardFacts.hotel?.checkIn) {
    const ci = parseHHMM(hardFacts.hotel.checkIn);
    if (ci != null) blocks.push([Math.max(dayStart, ci - 30), Math.min(dayEnd, ci + 60)]);
  }
  blocks.sort((a, b) => a[0] - b[0]);

  const freeSlots: LedgerFreeSlot[] = [];
  let cursor = dayStart;
  for (const [s, e] of blocks) {
    if (s > cursor) freeSlots.push({ from: minsToHHMM(cursor), to: minsToHHMM(s) });
    cursor = Math.max(cursor, e);
  }
  if (cursor < dayEnd) freeSlots.push({ from: minsToHHMM(cursor), to: minsToHHMM(dayEnd) });

  return {
    dayNumber,
    date: date.slice(0, 10),
    dayOfWeek,
    city,
    country,
    hardFacts,
    userIntent,
    alreadyDone,
    closures,
    freeSlots,
    holiday,
  };
}

/**
 * Render the ledger as a fenced prompt section. This is the ONLY thing the AI
 * is allowed to treat as ground truth for the day.
 */
export function renderDayLedgerPrompt(ledger: DayLedger): string {
  const lines: string[] = [];
  lines.push('## DAY TRUTH LEDGER — DO NOT VIOLATE');
  lines.push(`HARD FACTS:`);
  lines.push(`  - Date: ${ledger.date} (${ledger.dayOfWeek}), ${ledger.city}${ledger.country ? `, ${ledger.country}` : ''}`);
  if (ledger.hardFacts.hotel?.name) {
    lines.push(`  - Hotel: ${ledger.hardFacts.hotel.name}${ledger.hardFacts.hotel.address ? ` — ${ledger.hardFacts.hotel.address}` : ''}`);
  }
  if (ledger.hardFacts.transitionDay) {
    const t = ledger.hardFacts.transitionDay;
    lines.push(`  - Transition: ${t.from} → ${t.to} by ${t.mode}${t.departTime ? ` (depart ${t.departTime})` : ''}`);
  }
  if (ledger.hardFacts.isFirstDay) lines.push('  - First day in city');
  if (ledger.hardFacts.isLastDay) lines.push('  - Last day in city');
  if (ledger.hardFacts.isHotelChange) lines.push('  - Hotel change today (move bags between properties)');

  if (ledger.userIntent.length > 0) {
    lines.push('');
    lines.push('USER LOCKED — must keep exactly as written, do NOT replace, do NOT retime, do NOT drop:');
    for (const u of ledger.userIntent) {
      const time = u.startTime ? `${u.startTime}${u.endTime ? `–${u.endTime}` : ''}` : '(no fixed time)';
      lines.push(`  - ${time}  ${u.kind.toUpperCase()} — ${u.title}    [source: ${u.source}]`);
    }
  }

  if (ledger.alreadyDone.length > 0) {
    lines.push('');
    lines.push('ALREADY DONE on prior days — do NOT repeat or re-suggest:');
    // Cap at 30 to keep prompt size reasonable
    for (const p of ledger.alreadyDone.slice(0, 30)) {
      lines.push(`  - ${p.title} (day ${p.dayNumber})`);
    }
  }

  if (ledger.closures.length > 0) {
    lines.push('');
    lines.push('CLOSURES TODAY — do NOT schedule these:');
    for (const c of ledger.closures) {
      const ex = c.examples && c.examples.length > 0 ? `  e.g. ${c.examples.slice(0, 4).join(', ')}` : '';
      lines.push(`  - ${c.reason}${ex}`);
    }
  }

  if (ledger.freeSlots.length > 0) {
    lines.push('');
    lines.push('FREE SLOTS YOU MAY FILL (everything else is locked):');
    for (const s of ledger.freeSlots) {
      lines.push(`  - ${s.from}–${s.to}`);
    }
  }

  return lines.join('\n');
}
