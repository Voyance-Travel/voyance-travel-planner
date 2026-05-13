/**
 * inferArrivalMinsFromSchedule — return start time (in minutes since midnight)
 * of the first activity that represents real "experience" content, skipping
 * bookend / logistics cards (transit, transfer, transport, travel-to-hotel,
 * airport pickup, hotel check-in, accommodation drops, etc.).
 *
 * Used by the read-side health engine + backend meal-policy fallback so a
 * synthetic "Travel to Hotel 08:00" card never gets treated as the trip's
 * actual arrival clock.
 */

const SKIP_CATEGORIES = new Set([
  'check-in', 'check-out', 'hotel', 'accommodation',
  'transit', 'transportation', 'transfer', 'transport', 'travel',
  'logistics', 'commute', 'bookend', 'hotel_return', 'airport_transfer',
]);

const SKIP_TITLE_RE = /^\s*(?:travel|transfer|drive|taxi|metro|train|bus|tram|ride|airport pickup|pickup|arrival|return|luggage drop|baggage drop|drop[- ]?off|check[- ]?in)\b/i;

function parseClockToMinutes(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  const iso = t.match(/T(\d{1,2}):(\d{2})/);
  if (iso) return parseInt(iso[1], 10) * 60 + parseInt(iso[2], 10);
  const ampm = t.toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    const p = ampm[3];
    if (p === 'PM' && h !== 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  return null;
}

export function inferArrivalMinsFromSchedule(activities: any): number | null {
  if (!Array.isArray(activities)) return null;
  for (const a of activities) {
    if (!a || typeof a !== 'object') continue;
    const cat = String((a as any).category || (a as any).type || '').toLowerCase();
    if (SKIP_CATEGORIES.has(cat)) continue;
    const title = String((a as any).title || (a as any).name || '');
    if (SKIP_TITLE_RE.test(title)) continue;
    const m = parseClockToMinutes(
      (a as any).startTime || (a as any).time || (a as any).start_time
    );
    if (m !== null && m > 0) return m;
  }
  return null;
}
