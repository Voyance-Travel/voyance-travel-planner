const CATEGORY_HOURS: Record<string, { open: number; close: number; label: string }> = {
  museum:    { open: 9 * 60,  close: 18 * 60,  label: 'museum' },
  basilica:  { open: 8 * 60,  close: 18 * 60,  label: 'basilica' },
  church:    { open: 8 * 60,  close: 18 * 60,  label: 'church' },
  cathedral: { open: 8 * 60,  close: 18 * 60,  label: 'cathedral' },
  cemetery:  { open: 9 * 60,  close: 18 * 60,  label: 'cemetery' },
  gallery:   { open: 10 * 60, close: 19 * 60,  label: 'gallery' },
  market:    { open: 7 * 60,  close: 15 * 60,  label: 'market' },
  palace:    { open: 9 * 60,  close: 17 * 60,  label: 'palace' },
  ruins:     { open: 9 * 60,  close: 19 * 60,  label: 'ruins' },
};

const TITLE_KEYWORDS: Array<{ re: RegExp; key: string }> = [
  { re: /\b(museum|museo)\b/i, key: 'museum' },
  { re: /\bbasilica\b/i, key: 'basilica' },
  { re: /\b(church|chiesa|kirche|iglesia)\b/i, key: 'church' },
  { re: /\bcathedral\b/i, key: 'cathedral' },
  { re: /\b(cemetery|cimitero)\b/i, key: 'cemetery' },
  { re: /\b(gallery|galleria)\b/i, key: 'gallery' },
  { re: /\b(market|mercato)\b/i, key: 'market' },
  { re: /\b(palace|palazzo)\b/i, key: 'palace' },
  { re: /\b(ruins|forum|colosseum)\b/i, key: 'ruins' },
];

function parseMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

function venueProfile(act: any): { open: number; close: number; label: string } | null {
  const title = String(act?.title || act?.name || '');
  for (const { re, key } of TITLE_KEYWORDS) {
    if (re.test(title)) return CATEGORY_HOURS[key] ?? null;
  }
  return null;
}

export interface HoursViolation {
  activityId: string;
  title: string;
  reason: string;
}

/** validateClosingHours — flags activities scheduled past a venue's typical close. */
export function validateClosingHours(activities: any[]): { violations: HoursViolation[] } {
  const violations: HoursViolation[] = [];
  if (!Array.isArray(activities)) return { violations };
  for (const a of activities) {
    const profile = venueProfile(a);
    if (!profile) continue;
    const start = parseMin(a?.startTime || a?.start_time);
    const end   = parseMin(a?.endTime   || a?.end_time);
    if (start === null) continue;
    const closeStr = `${Math.floor(profile.close/60)}:${String(profile.close%60).padStart(2,'0')}`;
    if (end !== null && end > profile.close) {
      violations.push({ activityId: String(a?.id || ''), title: String(a?.title || ''), reason: `${profile.label} scheduled to ${a.endTime} — typical close ${closeStr}` });
    } else if (start > profile.close) {
      violations.push({ activityId: String(a?.id || ''), title: String(a?.title || ''), reason: `${profile.label} starts after typical close ${closeStr}` });
    }
  }
  return { violations };
}
