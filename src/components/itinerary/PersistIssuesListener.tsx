import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

type PersistIssueCode =
  | 'EMPTY_DAY'
  | 'MISSING_REQUIRED_MEAL'
  | 'EMPTY_DINING_DESCRIPTION'
  | 'PHANTOM_PREDAWN_CARD'
  | 'OVERLONG_ACTIVITY'
  | 'WRAP_GAP_OVER_3H'
  | 'MISSING_HOTEL_RETURN'
  | 'CURRENCY_MISMATCH';

interface PersistIssue {
  code: PersistIssueCode | string;
  severity?: 'error' | 'warning';
  dayNumber?: number;
  detail?: string;
  activityId?: string;
}

interface PersistIssuesEventDetail {
  tripId?: string;
  errors?: PersistIssue[];
  warnings?: PersistIssue[];
  persistedDespiteErrors?: boolean;
}

const FIX_SUFFIX = ' — regenerate this day to fix';

const HUMAN: Record<string, (i: PersistIssue) => string> = {
  EMPTY_DAY: (i) => `Day ${i.dayNumber} has no activities${FIX_SUFFIX}`,
  MISSING_REQUIRED_MEAL: (i) => `Day ${i.dayNumber}: ${i.detail || 'meal missing'}${FIX_SUFFIX}`,
  EMPTY_DINING_DESCRIPTION: (i) => `Day ${i.dayNumber}: restaurant card missing description${FIX_SUFFIX}`,
  PHANTOM_PREDAWN_CARD: (i) => `Day ${i.dayNumber}: ${i.detail || 'phantom pre-dawn card'}${FIX_SUFFIX}`,
  OVERLONG_ACTIVITY: (i) => `Day ${i.dayNumber}: ${i.detail || 'activity duration > 6h'}${FIX_SUFFIX}`,
  WRAP_GAP_OVER_3H: (i) => `Day ${i.dayNumber}: 3+ hour unscheduled gap${FIX_SUFFIX}`,
  MISSING_HOTEL_RETURN: (i) => `Day ${i.dayNumber}: no hotel return at end of day${FIX_SUFFIX}`,
  CURRENCY_MISMATCH: (i) =>
    i.dayNumber != null
      ? `Currency mismatch on Day ${i.dayNumber}${FIX_SUFFIX}`
      : `Currency mismatch detected${FIX_SUFFIX}`,
};

function describe(i: PersistIssue): string {
  const fn = HUMAN[i.code];
  if (fn) return fn(i);
  return `${i.code}${i.detail ? `: ${i.detail}` : ''}`;
}

export function PersistIssuesListener() {
  const recentRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    function handle(ev: Event) {
      const detail = (ev as CustomEvent<PersistIssuesEventDetail>).detail;
      if (!detail) return;
      const errors = detail.errors || [];
      const warnings = detail.warnings || [];
      const all: PersistIssue[] = [...errors, ...warnings];
      if (all.length === 0) return;

      const errorSet = new Set(errors);

      // Group by dayNumber (fallback bucket key '_' for trip-level)
      const byDay = new Map<number | string, PersistIssue[]>();
      for (const issue of all) {
        const key = issue.dayNumber ?? '_';
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(issue);
      }

      const now = Date.now();
      // Drop stale dedupe entries
      for (const [k, t] of recentRef.current) {
        if (now - t > 5000) recentRef.current.delete(k);
      }

      for (const [day, issues] of byDay) {
        const codes = [...new Set(issues.map((i) => i.code))].sort().join(',');
        const dedupeKey = `${detail.tripId ?? '_'}:${day}:${codes}`;
        if (recentRef.current.has(dedupeKey)) continue;
        recentRef.current.set(dedupeKey, now);

        const isError = issues.some((i) => errorSet.has(i));
        const heading =
          typeof day === 'number' ? `Day ${day} needs regeneration` : 'Trip needs regeneration';
        const body = issues.map(describe).join('\n');

        const fn = isError ? toast.error : toast.warning;
        fn(heading, { description: body, duration: 10000 });
      }
    }

    window.addEventListener('itinerary-persist-issues', handle);
    return () => window.removeEventListener('itinerary-persist-issues', handle);
  }, []);

  return null;
}

export default PersistIssuesListener;
