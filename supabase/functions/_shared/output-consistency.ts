// Post-generation consistency validator. Catches LLM output that is
// internally inconsistent (title temporal words vs scheduled time,
// duplicate day themes within a trip, etc.) and emits warnings the
// repair pipeline can act on.

interface ActivityLike {
  id?: string;
  title?: string;
  startTime?: string;
  start_time?: string;
}

interface DayLike {
  dayNumber?: number;
  theme?: string;
  title?: string;
  activities?: ActivityLike[];
}

export interface ConsistencyIssue {
  type: 'title_time_mismatch' | 'duplicate_day_theme';
  dayNumber: number;
  activityId?: string;
  detail: string;
  suggestion: string;
}

function parseHM(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

// Title-time mismatch: temporal words in title that contradict the scheduled hour.
const TEMPORAL_WORD_WINDOWS: Array<{ re: RegExp; validRange: [number, number]; label: string }> = [
  { re: /\b(morning|sunrise|dawn|early|breakfast|brunch)\b/i, validRange: [6 * 60, 11 * 60], label: 'morning' },
  { re: /\b(midday|noon|lunch)\b/i, validRange: [11 * 60, 14 * 60], label: 'midday' },
  { re: /\b(afternoon)\b/i, validRange: [12 * 60, 17 * 60], label: 'afternoon' },
  { re: /\b(evening|sunset|dusk|dinner|cocktail|aperitivo)\b/i, validRange: [17 * 60, 22 * 60], label: 'evening' },
  { re: /\b(night|nightlife|nightcap|late.?night|after.?dark)\b/i, validRange: [20 * 60, 26 * 60], label: 'night' },
];

export function validateActivityTitleTime(act: ActivityLike, dayNumber: number): ConsistencyIssue | null {
  const title = String(act?.title || '');
  if (!title) return null;
  const start = parseHM(act?.startTime || act?.start_time);
  if (start === null) return null;
  for (const w of TEMPORAL_WORD_WINDOWS) {
    if (!w.re.test(title)) continue;
    const [lo, hi] = w.validRange;
    const normalizedStart = start < 6 * 60 ? start + 24 * 60 : start; // late-night wrap
    if (normalizedStart < lo || normalizedStart > hi) {
      return {
        type: 'title_time_mismatch',
        dayNumber,
        activityId: act?.id,
        detail: `"${title}" implies ${w.label} (${Math.floor(lo/60)}-${Math.floor(hi/60)}h) but scheduled at ${act.startTime || act.start_time}`,
        suggestion: `Either rename to remove "${w.label}" wording, or reschedule into ${w.label} window.`,
      };
    }
  }
  return null;
}

export function validateDayThemes(days: DayLike[]): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const seen = new Map<string, number[]>();
  for (const d of days || []) {
    const theme = String(d?.theme || d?.title || '').toLowerCase().trim();
    if (!theme || theme.length < 5) continue;
    if (!seen.has(theme)) seen.set(theme, []);
    seen.get(theme)!.push(Number(d?.dayNumber || 0));
  }
  for (const [theme, dayNums] of seen) {
    if (dayNums.length > 1) {
      issues.push({
        type: 'duplicate_day_theme',
        dayNumber: dayNums[1],
        detail: `Theme "${theme}" used on days ${dayNums.join(', ')}`,
        suggestion: `Rename day ${dayNums[1]}+ to a distinct theme.`,
      });
    }
  }
  return issues;
}

export function validateDayConsistency(day: DayLike): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const dn = Number(day?.dayNumber || 0);
  if (!dn) return issues;
  for (const act of (day?.activities || [])) {
    const issue = validateActivityTitleTime(act, dn);
    if (issue) issues.push(issue);
  }
  return issues;
}
