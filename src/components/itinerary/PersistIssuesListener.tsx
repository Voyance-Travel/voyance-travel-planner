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
  /** Caller reason from safeUpdateItineraryData. `self-heal-*` and
   *  `integrity-blocked-resync` are silently dropped — only user-initiated
   *  saves should surface "needs regeneration" toasts. See
   *  mem://constraints/itinerary/persist-issues-toast-user-only. */
  source?: string;
  errors?: PersistIssue[];
  warnings?: PersistIssue[];
  persistedDespiteErrors?: boolean;
}

const FIX_SUFFIX = ' - regenerate this day to fix';

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

/** Sources that must NEVER produce a user-visible toast. Belt-and-braces:
 *  upstream `safeUpdateItineraryData` already suppresses self-heal saves,
 *  but any other dispatcher (now or future) gets caught here too. */
function isSilentSource(source: string | undefined): boolean {
  if (!source) return false;
  if (source.startsWith('self-heal-')) return true;
  if (source === 'integrity-blocked-resync') return true;
  return false;
}

/** Informational codes that confirm a logistics-only day is correct by design.
 *  Surfacing them as "Day N needs regeneration" is a UI lie. */
const BENIGN_INFORMATIONAL_CODES = new Set<string>([
  'DEPARTURE_DAY_LIGHT',
  'ARRIVAL_DAY_LIGHT',
]);

// Module-scoped so the buffer survives re-renders/unmounts within the session.
const loadedTrips = new Set<string>();

export function PersistIssuesListener() {
  const recentRef = useRef<Map<string, number>>(new Map());
  const bufferRef = useRef<Map<string, PersistIssuesEventDetail[]>>(new Map());

  useEffect(() => {
    function showToastsFor(detail: PersistIssuesEventDetail) {
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

    function handle(ev: Event) {
      const detail = (ev as CustomEvent<PersistIssuesEventDetail>).detail;
      if (!detail) return;

      // Defense-in-depth: drop silent (self-heal) sources outright.
      if (isSilentSource(detail.source)) return;

      const tripKey = detail.tripId ?? '_';

      // Buffer until the trip is fully loaded — page-load false alarms
      // happen in this window. See plan .lovable/plan.md.
      if (!loadedTrips.has(tripKey)) {
        const bucket = bufferRef.current.get(tripKey) || [];
        bucket.push(detail);
        // Keep most recent 5 to avoid unbounded growth
        if (bucket.length > 5) bucket.shift();
        bufferRef.current.set(tripKey, bucket);
        return;
      }

      showToastsFor(detail);
    }

    function handleLoaded(ev: Event) {
      const tripId = (ev as CustomEvent<{ tripId?: string }>).detail?.tripId;
      const tripKey = tripId ?? '_';
      loadedTrips.add(tripKey);
      const buffered = bufferRef.current.get(tripKey);
      bufferRef.current.delete(tripKey);
      if (!buffered) return;
      for (const detail of buffered) {
        // Re-filter — silent sources are already gated above, but a buffered
        // event from an unknown source is treated as user-initiated only if
        // its source isn't silent.
        if (isSilentSource(detail.source)) continue;
        showToastsFor(detail);
      }
    }

    function handleRegenStart(ev: Event) {
      // While a user-initiated regenerate is in flight, any persist-issues
      // event for this trip is part of the regen burst — re-buffer it the
      // same way we do for first-paint. Cleared by `voyance:trip-loaded`
      // (which TripDetail re-fires once the trip is back to a steady state).
      const tripId = (ev as CustomEvent<{ tripId?: string }>).detail?.tripId;
      const tripKey = tripId ?? '_';
      loadedTrips.delete(tripKey);
      bufferRef.current.delete(tripKey);
    }

    window.addEventListener('itinerary-persist-issues', handle);
    window.addEventListener('voyance:trip-loaded', handleLoaded);
    window.addEventListener('voyance:trip-regenerating-start', handleRegenStart);
    return () => {
      window.removeEventListener('itinerary-persist-issues', handle);
      window.removeEventListener('voyance:trip-loaded', handleLoaded);
      window.removeEventListener('voyance:trip-regenerating-start', handleRegenStart);
    };
  }, []);

  return null;
}

export default PersistIssuesListener;
