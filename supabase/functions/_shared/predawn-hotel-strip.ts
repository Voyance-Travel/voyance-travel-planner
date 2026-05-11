/**
 * Shared pre-dawn hotel-return stripper.
 *
 * Removes ANY activity (regardless of position) that:
 *  - starts between 00:00 and 04:59 in any of startTime/start_time/time, AND
 *  - looks like a hotel/return/accommodation entry (title regex OR
 *    accommodation/stay category/type).
 *
 * Pre-dawn hotel returns are wraparound/spillover bugs; they are NEVER
 * legitimate plan items. Mutates the array in place. Returns removed count.
 */
const HOTEL_TITLE_RE =
  /\b(?:return\s+to|check.?in|check.?out|hotel|freshen\s+up|rest\s+and\s+refresh|retire|settle|wind\s+down|end.?of.?day|back\s+to)\b/i;

function startMinsOf(act: any): number | null {
  // Inspect every time field — sort uses `startTime` first, but the LLM
  // sometimes only sets `start_time` or `time`. If ANY of them lands in
  // 00:00–04:59 we treat the row as pre-dawn.
  const candidates = [act?.startTime, act?.start_time, act?.time].filter(
    (v) => typeof v === 'string' && v.length > 0,
  );
  let earliest: number | null = null;
  for (const t of candidates) {
    const m = String(t).match(/(\d{1,2}):(\d{2})/);
    if (!m) continue;
    let h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (/pm/i.test(String(t)) && h < 12) h += 12;
    if (/am/i.test(String(t)) && h === 12) h = 0;
    const mins = h * 60 + mm;
    if (earliest === null || mins < earliest) earliest = mins;
  }
  return earliest;
}

export function stripPreDawnHotelReturns(
  activities: any[],
  context?: { dayNumber?: number; label?: string },
): number {
  if (!Array.isArray(activities) || activities.length === 0) return 0;
  const label = context?.label || 'predawn-strip';
  const dayLabel = context?.dayNumber != null ? `day ${context.dayNumber}` : '';

  let removed = 0;
  let skippedLateNightlife = 0;
  // Scan the WHOLE array — pre-dawn hotel returns can show up in the middle
  // when sorts are unstable or when prior cleanup leaves a gap.
  for (let i = activities.length - 1; i >= 0; i--) {
    const act = activities[i];
    const mins = startMinsOf(act);
    if (mins === null || mins >= 5 * 60) continue;

    // ALLOWLIST: legitimate post-midnight hotel-return injected by runStep8's
    // late-nightlife-bleed branch (e.g., speakeasy/nightcap ending 00:20 →
    // taxi back at 00:25). Without this guard the very next predawn-strip
    // pass eats the card we just minted.
    const src = String(act?.source || '').toLowerCase();
    const tags = Array.isArray(act?.tags) ? act.tags.map((t: unknown) => String(t).toLowerCase()) : [];
    if (src === 'late_nightlife_bookend' || tags.includes('late_nightlife_bookend')) {
      skippedLateNightlife++;
      continue;
    }

    const title = String(act?.title || act?.name || '').toLowerCase();
    const cat = String(act?.category || '').toLowerCase();
    const type = String(act?.type || '').toLowerCase();
    const isHotelEntry =
      HOTEL_TITLE_RE.test(title) ||
      cat === 'accommodation' ||
      cat === 'stay' ||
      cat === 'hotel' ||
      type === 'stay' ||
      type === 'accommodation';

    if (!isHotelEntry) continue;

    console.warn(
      `[${label}] PRE-DAWN HOTEL STRIP ${dayLabel}: removing "${act?.title}" at startTime=${
        act?.startTime
      } start_time=${act?.start_time} time=${act?.time}`,
    );
    activities.splice(i, 1);
    removed++;
  }

  if (skippedLateNightlife > 0) {
    console.log(`[${label}] day=${context?.dayNumber ?? '?'} kept ${activities.length} cards (skipped:${skippedLateNightlife} late_nightlife_bookend)`);
  }
  return removed;
}

export const __PREDAWN_HOTEL_TITLE_RE = HOTEL_TITLE_RE;
