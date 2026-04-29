/**
 * Canonical user-anchors module (shared, runtime-agnostic).
 *
 * "User anchors" are concrete itinerary items the user explicitly told us
 * about (chat extraction, form must-dos, multi-city specifics, manual paste,
 * pinned/edited cards). They are the source of truth and must NEVER be
 * silently dropped, renamed, or moved by the AI/cleanup pipeline.
 *
 * This file is duplicated in src/utils/userAnchors.ts so both edge functions
 * (Deno) and the frontend (Vite/React) can produce identical anchor sets.
 * Keep them in sync.
 */

export type UserAnchorSource =
  | 'chat'
  | 'manual_paste'
  | 'single_city'
  | 'multi_city'
  | 'edited'
  | 'pinned';

export interface UserAnchor {
  /** 1-indexed day this anchor applies to. 0 = trip-wide / unassigned. */
  dayNumber: number;
  /** Short title — e.g. "Dinner at TRB Hutong". */
  title: string;
  /** "HH:MM" 24h, optional. */
  startTime?: string;
  /** "HH:MM" 24h, optional. */
  endTime?: string;
  /** activity | dining | accommodation | explore | transit | activity. */
  category: string;
  /** Resolved venue name when extractable. */
  venueName?: string;
  /** Stable fingerprint used to match this anchor against generated activities. */
  lockedSource: string;
  /** Where the anchor came from (for diagnostics + UI). */
  source: UserAnchorSource;
  /** Original raw user text. */
  raw?: string;
}

const DAYTIME_PERIODS: Record<string, string> = {
  morning: '08:00',
  afternoon: '14:00',
  evening: '18:00',
  night: '21:00',
  day: '10:00',
};

function normalizeTimeStr(raw: string): string | undefined {
  const cleaned = raw.trim().replace(/^[~≈]\s*/, '');
  const m12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (m12) {
    let hour = parseInt(m12[1], 10);
    const min = m12[2] ? parseInt(m12[2], 10) : 0;
    const period = m12[3].toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  const m24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    return `${String(parseInt(m24[1], 10)).padStart(2, '0')}:${m24[2]}`;
  }
  return undefined;
}

function detectCategory(text: string): string {
  const t = text.toLowerCase();
  if (/\b(flight|depart|land|airport|train|transfer|arrive|station|ferry|bus)\b/.test(t)) return 'transit';
  if (/\bbreakfast|brunch\b/.test(t)) return 'dining';
  if (/\blunch|dinner|supper\b/.test(t)) return 'dining';
  if (/\b(drinks?|cocktails?|wine bar|bar|coffee)\b/.test(t)) return 'dining';
  if (/\b(hotel|check.?in|check.?out|freshen up|return to)\b/.test(t)) return 'accommodation';
  if (/\b(museum|gallery|tour|visit|mosque|temple|shrine|cathedral|palace)\b/.test(t)) return 'explore';
  if (/\b(spa|wellness|hammam|massage|sauna)\b/.test(t)) return 'activity';
  if (/\b(meeting|presentation|orientation|company|conference|workshop|panel)\b/.test(t)) return 'activity';
  if (/\b(pool|beach|relax|shopping|market|souk|bazaar|wine tasting|volunteering)\b/.test(t)) return 'activity';
  return 'activity';
}

function extractVenue(text: string): string | undefined {
  const at = text.match(/(?:\bat\b|\b@)\s+(.+?)(?:\s*-\s*|$)/i);
  if (at && at[1]) return at[1].trim();
  const meal = text.match(/^(?:breakfast|brunch|lunch|dinner|supper|cocktails?|drinks?)\s+(?!at\b)([A-Z][^,]*)/i);
  if (meal && meal[1]) return meal[1].trim();
  return undefined;
}

function fingerprint(dayNumber: number, title: string, startTime?: string): string {
  const t = title.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
  return `d${dayNumber}|${startTime || ''}|${t}`;
}

/**
 * Parse one day's free-text user plan into a list of structured anchors.
 *
 * Mirrors the parser in compile-prompt.ts (parseUserActivities) so the
 * rest of the pipeline can keep using the same lockedSource fingerprint.
 */
export function parseDayActivities(
  dayNumber: number,
  activitiesString: string,
  source: UserAnchorSource = 'chat',
): UserAnchor[] {
  if (!activitiesString) return [];
  const normalized = activitiesString.replace(/[–—]/g, '-');
  const entries = normalized.split(/,\s*(?=~?\d{1,2}(?::\d{2})?\s*(?:AM|PM)|[A-Z])/i);

  const anchors: UserAnchor[] = [];
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (/\bTBD\b|to be determined|choose|pick\b/i.test(trimmed)) continue;

    let startTime: string | undefined;
    let endTime: string | undefined;
    let activityText = trimmed;

    const timeMatch = trimmed.match(
      /^~?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*(?:-\s*~?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)))?\s*-?\s+(.+)$/i,
    );
    if (timeMatch) {
      startTime = normalizeTimeStr(timeMatch[1]);
      endTime = timeMatch[2] ? normalizeTimeStr(timeMatch[2]) : undefined;
      activityText = timeMatch[3].replace(/^-\s*/, '').trim();
    } else {
      const vague = trimmed.match(/^(Morning|Afternoon|Evening|Night|Day)\s*-\s*(.+)$/i);
      if (vague) {
        startTime = DAYTIME_PERIODS[vague[1].toLowerCase()];
        activityText = vague[2].trim();
      }
    }

    const category = detectCategory(activityText);
    const venueName = extractVenue(activityText);

    anchors.push({
      dayNumber,
      title: activityText,
      startTime,
      endTime,
      category,
      venueName,
      lockedSource: trimmed,
      source,
      raw: trimmed,
    });
  }
  return anchors;
}

/** Extract anchors from a single must-do entry that may carry a "Day N" prefix. */
function parseMustDoEntry(entry: string, source: UserAnchorSource): UserAnchor | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  const dayMatch = trimmed.match(/^Day\s+(\d+)\b[:\-\s]*(.*)$/i);
  const dayNumber = dayMatch ? parseInt(dayMatch[1], 10) : 0;
  const text = dayMatch ? dayMatch[2].trim() : trimmed;
  if (!text) return null;

  // Reuse the per-day leading-time parser so titles match across sources
  // (e.g. "7:30 PM - Dinner at TRB Hutong" → title "Dinner at TRB Hutong").
  let startTime: string | undefined;
  let endTime: string | undefined;
  let title = text;
  const lead = text.match(
    /^~?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*(?:-\s*~?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)))?\s*-?\s+(.+)$/i,
  );
  if (lead) {
    startTime = normalizeTimeStr(lead[1]);
    endTime = lead[2] ? normalizeTimeStr(lead[2]) : undefined;
    title = lead[3].replace(/^-\s*/, '').trim();
  } else {
    const inline = text.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM))(?:\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)))?/i);
    if (inline) {
      startTime = normalizeTimeStr(inline[1]);
      if (inline[2]) endTime = normalizeTimeStr(inline[2]);
    }
  }

  return {
    dayNumber,
    title,
    startTime,
    endTime,
    category: detectCategory(title),
    venueName: extractVenue(title),
    lockedSource: trimmed,
    source,
    raw: trimmed,
  };
}

export interface BuildAnchorsInput {
  /** Day-level user plans, keyed by 1-indexed dayNumber. */
  perDayActivities?: Array<{ dayNumber: number; activities: string }> | null;
  /** Flat must-do list (may be string[] or comma-joined string). */
  mustDoActivities?: string | string[] | null;
  /** Default source label when one isn't already encoded in the entry. */
  source: UserAnchorSource;
}

/**
 * Compute a deduplicated list of canonical anchors from any combination of
 * structured per-day plans and flat must-do strings/arrays.
 */
export function buildUserAnchors(input: BuildAnchorsInput): UserAnchor[] {
  const seen = new Set<string>();
  const out: UserAnchor[] = [];

  const push = (a: UserAnchor) => {
    const key = fingerprint(a.dayNumber, a.title, a.startTime);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(a);
  };

  // 1) Per-day structured anchors are the highest fidelity.
  if (Array.isArray(input.perDayActivities)) {
    for (const day of input.perDayActivities) {
      if (!day || !day.activities) continue;
      for (const a of parseDayActivities(day.dayNumber, day.activities, input.source)) {
        push(a);
      }
    }
  }

  // 2) Must-do list — entries can carry "Day N" prefixes.
  const rawMustDo = input.mustDoActivities;
  const mustDoList: string[] = Array.isArray(rawMustDo)
    ? rawMustDo.flatMap((s) => String(s).split(/\n+/))
    : (typeof rawMustDo === 'string'
      ? rawMustDo.split(/\n+|,\s*(?=Day\s+\d+\b)/i)
      : []);
  for (const raw of mustDoList) {
    const a = parseMustDoEntry(raw, input.source);
    if (a) push(a);
  }

  return out;
}

/** Convert an anchor into a normalized itinerary activity object. */
export function anchorToActivity(a: UserAnchor, idx: number): Record<string, unknown> {
  return {
    id: `anchor-d${a.dayNumber}-${idx}-${Date.now()}`,
    title: a.title,
    name: a.title,
    startTime: a.startTime,
    endTime: a.endTime,
    category: a.category,
    venue_name: a.venueName,
    location: a.venueName ? { name: a.venueName, address: '' } : undefined,
    cost: { amount: 0, currency: 'USD' },
    locked: true,
    isLocked: true,
    lockedSource: a.lockedSource,
    anchorSource: a.source,
    durationMinutes: a.startTime && a.endTime ? diffMinutes(a.startTime, a.endTime) : 60,
  };
}

function diffMinutes(start: string, end: string): number {
  const s = start.match(/^(\d{1,2}):(\d{2})$/);
  const e = end.match(/^(\d{1,2}):(\d{2})$/);
  if (!s || !e) return 60;
  const sm = parseInt(s[1], 10) * 60 + parseInt(s[2], 10);
  const em = parseInt(e[1], 10) * 60 + parseInt(e[2], 10);
  return Math.max(15, em - sm);
}
