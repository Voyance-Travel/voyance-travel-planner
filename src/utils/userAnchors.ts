/**
 * Canonical user-anchors module (frontend mirror).
 *
 * Keep this file in sync with supabase/functions/_shared/user-anchors.ts.
 * It is duplicated because Vite cannot import from supabase/functions and
 * Deno cannot import from src/.
 */

export type UserAnchorSource =
  | 'chat'
  | 'manual_paste'
  | 'single_city'
  | 'multi_city'
  | 'edited'
  | 'pinned';

export interface UserAnchor {
  dayNumber: number;
  title: string;
  startTime?: string;
  endTime?: string;
  category: string;
  venueName?: string;
  lockedSource: string;
  source: UserAnchorSource;
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

    anchors.push({
      dayNumber,
      title: activityText,
      startTime,
      endTime,
      category: detectCategory(activityText),
      venueName: extractVenue(activityText),
      lockedSource: trimmed,
      source,
      raw: trimmed,
    });
  }
  return anchors;
}

function parseMustDoEntry(entry: string, source: UserAnchorSource): UserAnchor | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  const dayMatch = trimmed.match(/^Day\s+(\d+)\b[:\-\s]*(.*)$/i);
  const dayNumber = dayMatch ? parseInt(dayMatch[1], 10) : 0;
  const text = dayMatch ? dayMatch[2].trim() : trimmed;
  if (!text) return null;

  const timeRange = text.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM))(?:\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)))?/i);
  let startTime: string | undefined;
  let endTime: string | undefined;
  if (timeRange) {
    startTime = normalizeTimeStr(timeRange[1]);
    if (timeRange[2]) endTime = normalizeTimeStr(timeRange[2]);
  }

  return {
    dayNumber,
    title: text,
    startTime,
    endTime,
    category: detectCategory(text),
    venueName: extractVenue(text),
    lockedSource: trimmed,
    source,
    raw: trimmed,
  };
}

export interface BuildAnchorsInput {
  perDayActivities?: Array<{ dayNumber: number; activities: string }> | null;
  mustDoActivities?: string | string[] | null;
  source: UserAnchorSource;
}

export function buildUserAnchors(input: BuildAnchorsInput): UserAnchor[] {
  const seen = new Set<string>();
  const out: UserAnchor[] = [];
  const push = (a: UserAnchor) => {
    const key = fingerprint(a.dayNumber, a.title, a.startTime);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(a);
  };

  if (Array.isArray(input.perDayActivities)) {
    for (const day of input.perDayActivities) {
      if (!day || !day.activities) continue;
      for (const a of parseDayActivities(day.dayNumber, day.activities, input.source)) {
        push(a);
      }
    }
  }

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
