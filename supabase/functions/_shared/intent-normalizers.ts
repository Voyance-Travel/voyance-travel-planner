/**
 * intent-normalizers.ts — Convert legacy/inflight inputs into structured
 * `DayIntentInput[]` rows ready for `upsertDayIntents`.
 *
 * Used by the four entry points so each entry point produces normalized
 * day-scoped rows instead of stuffing strings into metadata blobs.
 */

import type { DayIntentInput, IntentPriority } from './day-intents-store.ts';
import { inferKindFromText, normalizeKind } from './day-intents-store.ts';
import { parseFineTuneIntoDailyIntents } from './parse-fine-tune-intents.ts';

/**
 * A "hard fact" is an intent specific enough to lock verbatim:
 *   - has an explicit time (HH:MM), AND
 *   - title contains a Proper-Noun-looking venue name (≥1 capitalized word
 *     that isn't a meal label like "Dinner" / "Lunch" / "Spa").
 * Locked rows are restored verbatim by the anchor-guard pipeline.
 */
const MEAL_LABELS = new Set([
  'Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Drinks', 'Cocktails',
  'Spa', 'Massage', 'Hammam', 'Activity', 'Tour', 'Visit',
]);

function looksLikeNamedVenue(title: string): boolean {
  if (!title) return false;
  // Strip leading meal/kind word
  const cleaned = title.replace(/^(at|to|for)\s+/i, '').trim();
  // Look for a capitalized word that isn't a generic meal label
  const tokens = cleaned.split(/\s+/);
  for (const tok of tokens) {
    if (/^[A-Z][\w'’&.-]{1,}$/.test(tok) && !MEAL_LABELS.has(tok)) return true;
  }
  // "at <Name>" pattern
  if (/\bat\s+[A-Z]/.test(title)) return true;
  return false;
}

function stableHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 10);
}

/**
 * Decide whether a parsed intent qualifies as a hard fact (locked verbatim).
 * Only applies to non-avoid kinds. Returns a `{ locked, lockedSource }` patch.
 */
function maybeLock(args: {
  source: string;
  dayNumber?: number | null;
  title: string;
  startTime?: string | null;
  kind: string;
}): { locked: boolean; lockedSource: string | null } {
  if (args.kind === 'avoid' || args.kind === 'note' || args.kind === 'constraint') {
    return { locked: false, lockedSource: null };
  }
  if (!args.startTime) return { locked: false, lockedSource: null };
  if (!looksLikeNamedVenue(args.title)) return { locked: false, lockedSource: null };
  const key = `${args.source}|${args.dayNumber ?? '*'}|${args.title.toLowerCase()}|${args.startTime}`;
  return { locked: true, lockedSource: `${args.source}:${stableHash(key)}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) FINE-TUNE NOTES  →  intents
// ─────────────────────────────────────────────────────────────────────────────

export function intentsFromFineTuneNotes(args: {
  notes: string;
  tripStartDate?: string;
  totalDays?: number;
}): DayIntentInput[] {
  const { perDay, tripWide } = parseFineTuneIntoDailyIntents({
    notes: args.notes || '',
    tripStartDate: args.tripStartDate,
    totalDays: args.totalDays,
  });

  const out: DayIntentInput[] = [];

  for (const p of perDay) {
    const kind = p.kind === 'avoid' ? 'avoid' : normalizeKind(p.kind);
    const title = p.title || p.raw;
    const lock = maybeLock({ source: 'fine_tune', dayNumber: p.dayNumber, title, startTime: p.startTime, kind });
    out.push({
      dayNumber: p.dayNumber,
      source: 'fine_tune',
      kind,
      title,
      rawText: p.raw,
      startTime: p.startTime || null,
      priority: kind === 'avoid' ? 'avoid' : (p.priority as IntentPriority),
      locked: lock.locked,
      lockedSource: lock.lockedSource,
    });
  }

  for (const w of tripWide) {
    out.push({
      dayNumber: null,
      source: 'fine_tune',
      kind: 'note',
      title: w.length > 140 ? w.slice(0, 137) + '…' : w,
      rawText: w,
      priority: 'should',
      locked: false,
    });
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) USER ANCHORS (manual paste / pin / edit)  →  intents (locked)
// ─────────────────────────────────────────────────────────────────────────────

export interface UserAnchorLike {
  dayNumber: number;
  title: string;
  startTime?: string;
  endTime?: string;
  category?: string;
  source?: string;          // 'manual_paste' | 'chat_paste' | 'pin' | 'edit' | ...
  lockedSource?: string;
}

export function intentsFromUserAnchors(
  anchors: UserAnchorLike[] | undefined | null,
  fallbackSource: 'manual_paste' | 'pin' | 'edit' | 'manual_add' = 'manual_paste',
): DayIntentInput[] {
  if (!Array.isArray(anchors) || anchors.length === 0) return [];
  const out: DayIntentInput[] = [];
  for (const a of anchors) {
    const title = (a.title || '').trim();
    if (!title || !a.dayNumber) continue;
    const kind = a.category
      ? mapCategoryToKind(a.category, title)
      : inferKindFromText(title);
    const source = mapAnchorSource(a.source, fallbackSource);
    out.push({
      dayNumber: a.dayNumber,
      source,
      kind,
      title,
      rawText: a.lockedSource || title,
      startTime: a.startTime || null,
      endTime: a.endTime || null,
      priority: 'must',
      locked: true,
      lockedSource: a.lockedSource,
    });
  }
  return out;
}

function mapAnchorSource(
  raw: string | undefined,
  fallback: 'manual_paste' | 'pin' | 'edit' | 'manual_add',
): DayIntentInput['source'] {
  const s = (raw || '').toLowerCase();
  if (s.includes('chat')) return 'chat_planner';
  if (s.includes('paste') || s.includes('manual_paste')) return 'manual_paste';
  if (s.includes('pin')) return 'pin';
  if (s.includes('edit')) return 'edit';
  if (s.includes('manual_add') || s.includes('manual')) return 'manual_add';
  return fallback;
}

function mapCategoryToKind(category: string, title: string): DayIntentInput['kind'] {
  const c = category.toLowerCase();
  if (c.includes('dining') || c.includes('food') || c.includes('restaurant')) {
    return inferKindFromText(title); // breakfast/lunch/dinner specifically
  }
  if (c.includes('transit') || c.includes('transport')) return 'transport';
  if (c.includes('event')) return 'event';
  if (c.includes('spa') || c.includes('wellness')) return 'spa';
  if (c.includes('note')) return 'note';
  return inferKindFromText(title);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) CHAT-PLANNER EXTRACTION  →  intents
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatExtractedInput {
  mustDoActivities?: string;
  additionalNotes?: string;
  perDayActivities?: Array<{ dayNumber: number; activities: string }>;
  userConstraints?: Array<{
    type: string;
    description: string;
    day?: number;
    time?: string;
    endTime?: string;
    allDay?: boolean;
  }>;
  tripStartDate?: string;
  totalDays?: number;
}

export function intentsFromChatPlannerExtraction(args: ChatExtractedInput): DayIntentInput[] {
  const out: DayIntentInput[] = [];

  // 3a. perDayActivities — comma-separated activities per day (most structured).
  for (const d of args.perDayActivities || []) {
    if (!d || !d.dayNumber) continue;
    const items = splitDayActivitiesString(d.activities || '');
    for (const item of items) {
      if (!item.title) continue;
      out.push({
        dayNumber: d.dayNumber,
        source: 'chat_planner',
        kind: inferKindFromText(item.title),
        title: item.title,
        rawText: item.raw,
        startTime: item.startTime || null,
        endTime: item.endTime || null,
        priority: 'must', // user explicitly listed it on this day
        locked: false,
      });
    }
  }

  // 3b. userConstraints — already structured by the chat planner.
  for (const c of args.userConstraints || []) {
    if (!c || !c.description) continue;
    const desc = String(c.description).trim();
    if (!desc) continue;
    const isAvoid = c.type === 'avoid';
    const isFlight = c.type === 'flight';
    const isAllDay = c.type === 'full_day_event' || !!c.allDay;
    const kind: DayIntentInput['kind'] =
      isAvoid ? 'avoid' :
      isFlight ? 'transport' :
      c.type === 'preference' ? 'constraint' :
      c.type === 'time_block' || isAllDay ? 'event' :
      inferKindFromText(desc);
    out.push({
      dayNumber: c.day ?? null,
      source: 'chat_planner',
      kind,
      title: desc.length > 140 ? desc.slice(0, 137) + '…' : desc,
      rawText: desc,
      startTime: c.time || null,
      endTime: c.endTime || null,
      priority: isAvoid ? 'avoid' : 'must',
      locked: false,
      metadata: { fullDayEvent: isAllDay || undefined },
    });
  }

  // 3c. mustDoActivities — fallback comma-separated string. Only used if
  // perDayActivities didn't already cover it. Day inference is best-effort.
  if (args.mustDoActivities && (!args.perDayActivities || args.perDayActivities.length === 0)) {
    const items = splitMustDoString(args.mustDoActivities);
    for (const item of items) {
      out.push({
        dayNumber: item.dayNumber ?? null,
        source: 'chat_planner',
        kind: inferKindFromText(item.title),
        title: item.title,
        rawText: item.raw,
        startTime: item.startTime || null,
        priority: 'must',
        locked: false,
      });
    }
  }

  // 3d. additionalNotes — re-use the fine-tune parser, tag as chat_planner.
  if (args.additionalNotes && args.additionalNotes.trim()) {
    const fromNotes = intentsFromFineTuneNotes({
      notes: args.additionalNotes,
      tripStartDate: args.tripStartDate,
      totalDays: args.totalDays,
    });
    for (const it of fromNotes) out.push({ ...it, source: 'chat_planner' });
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) ASSISTANT CHAT  →  single intent
// ─────────────────────────────────────────────────────────────────────────────

export function intentFromAssistantTool(args: {
  dayNumber?: number | null;
  title: string;
  kind?: string;
  priority?: 'must' | 'should';
  startTime?: string;
  raw?: string;
}): DayIntentInput | null {
  const title = (args.title || '').trim();
  if (!title) return null;
  const kind = args.kind ? normalizeKind(args.kind) : inferKindFromText(title);
  return {
    dayNumber: args.dayNumber ?? null,
    source: 'assistant_chat',
    kind,
    title,
    rawText: args.raw || title,
    startTime: args.startTime || null,
    priority: kind === 'avoid' ? 'avoid' : (args.priority === 'must' ? 'must' : 'should'),
    locked: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

interface SplitItem {
  title: string;
  raw: string;
  startTime?: string;
  endTime?: string;
  dayNumber?: number;
}

function splitDayActivitiesString(s: string): SplitItem[] {
  const normalized = s.replace(/[–—]/g, '-').trim();
  if (!normalized) return [];
  const parts = normalized.split(/,\s*(?=~?\d{1,2}(?::\d{2})?\s*(?:AM|PM)|[A-Z])/i);
  const out: SplitItem[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (/\bTBD\b|to be determined|choose|pick\b/i.test(t)) continue;
    const m = t.match(/^~?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:-\s*~?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?))?\s*-?\s+(.+)$/i);
    if (m) {
      out.push({
        title: stripVerbs(m[3].replace(/^-\s*/, '')),
        raw: t,
        startTime: to24h(m[1]) || undefined,
        endTime: m[2] ? to24h(m[2]) || undefined : undefined,
      });
    } else {
      out.push({ title: stripVerbs(t), raw: t });
    }
  }
  return out;
}

function splitMustDoString(s: string): SplitItem[] {
  const items: SplitItem[] = [];
  const parts = (s || '').split(/[,\n]+/).map((x) => x.trim()).filter(Boolean);
  for (const part of parts) {
    const dayMatch = part.match(/\bDay\s+(\d+)\b/i);
    const dn = dayMatch ? parseInt(dayMatch[1], 10) : undefined;
    const time = extractTimeLoose(part);
    items.push({
      title: stripVerbs(part.replace(/\bDay\s+\d+\b/i, '').trim()) || part,
      raw: part,
      startTime: time,
      dayNumber: dn,
    });
  }
  return items;
}

function stripVerbs(s: string): string {
  return s.replace(/^(visit|see|do|go to|hit|try|grab|have|enjoy|tour|explore)\s+/i, '').trim();
}

function extractTimeLoose(s: string): string | undefined {
  const m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!m) return undefined;
  return to24h(`${m[1]}${m[2] ? ':' + m[2] : ''} ${m[3]}`) || undefined;
}

function to24h(raw: string): string | null {
  const cleaned = raw.trim();
  const m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || min < 0 || min > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
