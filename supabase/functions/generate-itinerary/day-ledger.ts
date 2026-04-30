/**
 * day-ledger.ts — Day Truth Ledger / Day Brief
 *
 * The single deterministic record of "what is true and required for Day N."
 * Built BEFORE generation, injected into the prompt, validated AFTER.
 *
 * Pure function. No IO, no AI.
 *
 * v2 expands the ledger into a richer "Day Brief" by adding:
 *   - destination_facts.events / weather / prayer_times / transit_disruptions
 *   - extra user intents (free-form, not yet locked) from fine-tune notes,
 *     manual-add notes, and the assistant's `record_user_intent` tool
 *   - per-day user constraints (dietary / mobility / budget_for_day)
 *   - forward state — what the next 1–2 days have, to avoid vibe clashes
 *
 * All v2 fields are OPTIONAL on input; old call sites continue to work.
 */

import { getKnownClosures, type KnownClosure } from '../_shared/known-closures.ts';
import { getPublicHolidayForDate, type PublicHoliday } from '../_shared/public-holidays.ts';
import { getDestinationEvents, type DestinationEvent } from '../_shared/destination-events.ts';
import type { WeatherSummary } from '../_shared/weather-fetch.ts';
import type { PrayerTimes } from '../_shared/prayer-times.ts';

export interface LedgerHardFacts {
  hotel?: { name: string; address?: string; checkIn?: string; checkOut?: string } | null;
  transitionDay?: { from: string; to: string; mode: string; departTime?: string; arriveTime?: string } | null;
  flight?: Record<string, unknown> | null;
  isFirstDay: boolean;
  isLastDay: boolean;
  isHotelChange: boolean;
}

export interface LedgerUserIntent {
  kind: string;          // 'dinner' | 'lunch' | 'activity' | 'spa' | 'avoid' | ...
  title: string;
  startTime?: string;    // HH:MM
  endTime?: string;
  source: string;        // 'manual_paste' | 'chat_paste' | 'fine_tune' | 'manual' | 'assistant' | 'pinned' | 'edited'
  note: string;          // Human-readable reminder for the AI
  priority: 'must' | 'should';
  lockedSource?: string; // fingerprint
  /** True if this intent corresponds to a hard-locked DB row. */
  locked?: boolean;
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

export interface LedgerForwardItem {
  dayNumber: number;
  title: string;
  kind: string;
  startTime?: string;
}

export interface LedgerUserConstraints {
  dietary?: string[];
  mobility?: string;
  budgetForDay?: { amount: number; currency: string };
  /** Free-form trip-wide notes that didn't bind to a single day. */
  tripWideNotes?: string[];
}

export interface LedgerDestinationFacts {
  events: DestinationEvent[];
  weather: WeatherSummary | null;
  prayerTimes: PrayerTimes | null;
  transitDisruptions: string[];
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

  // ─── v2 — Day Brief enrichments (all optional) ───
  destinationFacts?: LedgerDestinationFacts;
  forwardState?: LedgerForwardItem[];
  userConstraints?: LedgerUserConstraints;
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

  // ─── v2 — optional ───
  /** Soft user intents (fine-tune, assistant chat, manual notes) — not yet locked. */
  extraIntents?: Array<{
    title: string;
    startTime?: string;
    endTime?: string;
    kind?: string;
    source?: string;
    priority?: 'must' | 'should';
    raw?: string;
  }>;
  /** What's planned for tomorrow / day-after — fed back to avoid vibe clashes. */
  forwardActivities?: Array<{
    dayNumber: number;
    title?: string;
    name?: string;
    category?: string;
    startTime?: string;
  }>;
  /** Per-day user constraints, if available. */
  userConstraints?: LedgerUserConstraints;
  /** Optional pre-fetched weather summary. */
  weather?: WeatherSummary | null;
  /** Optional pre-fetched prayer times. */
  prayerTimes?: PrayerTimes | null;
  /** Optional transit disruptions, if known. */
  transitDisruptions?: string[];
}

export function buildDayLedger(input: BuildDayLedgerInput): DayLedger {
  const {
    dayNumber, date, city, country, hardFacts,
    anchors, priorDayActivities = [],
    extraIntents = [], forwardActivities = [],
    userConstraints, weather = null, prayerTimes = null,
    transitDisruptions = [],
  } = input;

  const d = new Date(date.length > 10 ? date : `${date}T00:00:00`);
  const dow = isNaN(d.getTime()) ? 0 : d.getDay();
  const dayOfWeek = DAY_NAMES[dow];

  // userIntent — keep order, dedupe by title+time.
  // Locked anchors first (priority='must'), then soft extraIntents.
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
      locked: true,
    });
  }

  for (const ei of extraIntents || []) {
    const title = (ei.title || '').trim();
    if (!title) continue;
    const startTime = ei.startTime;
    const key = `${title.toLowerCase()}|${startTime || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = ei.kind || inferKind(title);
    const source = ei.source || 'fine_tune';
    const priority = ei.priority || 'should';
    const verb = priority === 'must' ? 'MUST appear' : 'SHOULD appear';
    userIntent.push({
      kind,
      title,
      startTime,
      endTime: ei.endTime,
      source,
      note: `User said: "${ei.raw || title}" — ${verb} in this day.`,
      priority,
      locked: false,
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

  // ─── v2 — destination facts ───
  const events = date ? getDestinationEvents(city, date.slice(0, 10)) : [];
  const destinationFacts: LedgerDestinationFacts = {
    events,
    weather: weather ?? null,
    prayerTimes: prayerTimes ?? null,
    transitDisruptions: transitDisruptions || [],
  };

  // ─── v2 — forward state (next 1–2 days) ───
  const forwardState: LedgerForwardItem[] = [];
  for (const f of forwardActivities || []) {
    const dn = f.dayNumber;
    if (typeof dn !== 'number' || dn <= dayNumber || dn > dayNumber + 2) continue;
    const title = (f.title || f.name || '').trim();
    if (!title) continue;
    forwardState.push({
      dayNumber: dn,
      title,
      kind: inferKind(title, f.category),
      startTime: f.startTime,
    });
  }

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
    destinationFacts,
    forwardState,
    userConstraints,
  };
}

/**
 * Render the ledger as a fenced prompt section. This is the ONLY thing the AI
 * is allowed to treat as ground truth for the day.
 */
export function renderDayLedgerPrompt(ledger: DayLedger): string {
  const lines: string[] = [];
  lines.push('## DAY BRIEF — DO NOT VIOLATE');
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

  // ─── DESTINATION FACTS ───
  const df = ledger.destinationFacts;
  if (df) {
    if (df.weather && df.weather.summary) {
      lines.push('');
      lines.push(`WEATHER: ${df.weather.summary}`);
    }
    if (df.events && df.events.length > 0) {
      lines.push('');
      lines.push('LOCAL EVENTS TODAY — adapt the day around these:');
      for (const e of df.events) {
        lines.push(`  - ${e.name} — ${e.impact}`);
      }
    }
    if (df.prayerTimes && (df.prayerTimes.dhuhr || df.prayerTimes.maghrib)) {
      const pt = df.prayerTimes;
      lines.push('');
      lines.push(`PRAYER TIMES: Fajr ${pt.fajr || '—'}, Dhuhr ${pt.dhuhr || '—'}, Asr ${pt.asr || '—'}, Maghrib ${pt.maghrib || '—'}, Isha ${pt.isha || '—'}.${pt.note ? ` ${pt.note}` : ''}`);
    }
    if (df.transitDisruptions && df.transitDisruptions.length > 0) {
      lines.push('');
      lines.push('TRANSIT DISRUPTIONS:');
      for (const t of df.transitDisruptions) lines.push(`  - ${t}`);
    }
  }

  // ─── USER REQUIRED ───
  if (ledger.userIntent.length > 0) {
    const must = ledger.userIntent.filter((u) => u.priority === 'must');
    const should = ledger.userIntent.filter((u) => u.priority !== 'must');
    if (must.length > 0) {
      lines.push('');
      lines.push('USER REQUIRED — DO NOT DROP, DO NOT REPLACE, DO NOT RETIME:');
      for (const u of must) {
        const time = u.startTime ? `${u.startTime}${u.endTime ? `–${u.endTime}` : ''}` : '(no fixed time)';
        lines.push(`  - ${time}  ${u.kind.toUpperCase()} — ${u.title}    [source: ${u.source}]`);
      }
    }
    if (should.length > 0) {
      lines.push('');
      lines.push('USER PREFERENCES — try to honour these unless impossible:');
      for (const u of should) {
        const time = u.startTime ? `${u.startTime}${u.endTime ? `–${u.endTime}` : ''}` : '(flexible)';
        lines.push(`  - ${time}  ${u.kind.toUpperCase()} — ${u.title}    [source: ${u.source}]`);
      }
    }
  }

  // ─── USER CONSTRAINTS ───
  const uc = ledger.userConstraints;
  if (uc) {
    const bits: string[] = [];
    if (uc.dietary && uc.dietary.length > 0) bits.push(`dietary: ${uc.dietary.join(', ')}`);
    if (uc.mobility) bits.push(`mobility: ${uc.mobility}`);
    if (uc.budgetForDay) bits.push(`budget today: ${uc.budgetForDay.amount} ${uc.budgetForDay.currency}`);
    if (bits.length > 0) {
      lines.push('');
      lines.push(`USER CONSTRAINTS: ${bits.join(' · ')}`);
    }
    if (uc.tripWideNotes && uc.tripWideNotes.length > 0) {
      lines.push('');
      lines.push('TRIP-WIDE NOTES from the user (apply across days):');
      for (const n of uc.tripWideNotes.slice(0, 8)) lines.push(`  - ${n}`);
    }
  }

  if (ledger.alreadyDone.length > 0) {
    lines.push('');
    lines.push('ALREADY DONE on prior days — do NOT repeat or re-suggest:');
    for (const p of ledger.alreadyDone.slice(0, 30)) {
      lines.push(`  - ${p.title} (day ${p.dayNumber})`);
    }
  }

  if (ledger.forwardState && ledger.forwardState.length > 0) {
    lines.push('');
    lines.push('UPCOMING DAYS already have these — keep variety, no vibe clash:');
    for (const f of ledger.forwardState.slice(0, 12)) {
      lines.push(`  - day ${f.dayNumber}: ${f.kind.toUpperCase()} — ${f.title}`);
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
