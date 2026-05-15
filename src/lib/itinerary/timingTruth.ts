// Canonical activity-timing accessor used by both the health validator AND
// any component that needs to know what the user actually sees on screen.
// Single source of truth — if the underlying activity carries adjusted_start_time
// (post-cascade) we prefer that, falling back to startTime.

export function canonicalStart(act: any): string | null {
  if (!act) return null;
  return (
    (typeof act.adjustedStartTime === 'string' && act.adjustedStartTime) ||
    (typeof act.adjusted_start_time === 'string' && act.adjusted_start_time) ||
    (typeof act.startTime === 'string' && act.startTime) ||
    (typeof act.start_time === 'string' && act.start_time) ||
    null
  );
}

export function canonicalEnd(act: any): string | null {
  if (!act) return null;
  return (
    (typeof act.adjustedEndTime === 'string' && act.adjustedEndTime) ||
    (typeof act.adjusted_end_time === 'string' && act.adjusted_end_time) ||
    (typeof act.endTime === 'string' && act.endTime) ||
    (typeof act.end_time === 'string' && act.end_time) ||
    null
  );
}

export function parseHM(t: string | null): number | null {
  if (!t) return null;
  const m = String(t).trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}
