/**
 * stripHotelReturnLoop — save-time net for post-checkin "Return to Hotel" loops.
 *
 * Defense-in-depth mirror of `schedule-executioner.ts::enforceImpossibleLogistics`
 * (a-bis) for paths that bypass the Executioner: legacy persisted trips,
 * chat-applied edits, manual paste, and any future write path that calls
 * `action-save-itinerary.normalizeDays` directly.
 *
 * Drops cards on Day 1 that:
 *   - sit AFTER a check-in row
 *   - match `^(return|head back|back|...) to (hotel|<brand>|<hotelName>)`
 *   - start BEFORE 18:00 (legit end-of-day bookends sit ≥18:00 OR carry
 *     `source: 'bookend-*' | 'late_nightlife_bookend'`)
 *   - are NOT locked/user/manual/extracted/pinned/booked
 *   - are NOT source-tagged bookends
 *
 * See mem://constraints/itinerary/post-checkin-hotel-return-loop.md
 */

const HOTEL_RETURN_VERB_RE =
  /^\s*(?:return|head\s+back|back|go\s+back|walk\s+back|shuttle\s+back)\s+to\b/i;
const HOTEL_NOUN_RE =
  /\b(?:hotel|hostel|inn|resort|lodge|ryokan|riad|guesthouse|guest\s*house|b&b|marriott|hilton|hyatt|ritz[\-\s]?carlton|four\s*seasons|st\.?\s*regis|peninsula|aman|belmond|cipriani|gritti|kempinski|rosewood|mandarin\s*oriental|raffles|bvlgari|bulgari|conrad|edition|sofitel|fairmont|shangri[\-\s]?la|intercontinental|le\s*meridien|westin|sheraton|nobu\s*hotel|nh\s*collection|melia)\b/i;
const LOCKED_SOURCE_RE = /^(user|user_added|manual|extracted|pinned|booked|imported)$/i;

function isUserOwned(a: any): boolean {
  if (!a) return false;
  if (a.userAdded || a.userEdited || a.isManual || a.extracted || a.pinned) return true;
  if (a.isLocked === true || a.locked === true || a.lock_state === 'locked') return true;
  const src = String(a.source || '').toLowerCase();
  if (LOCKED_SOURCE_RE.test(src)) return true;
  const basis = String(a?.cost?.basis || a?.estimatedCost?.basis || '').toLowerCase();
  if (basis === 'user' || basis === 'user_override' || basis === 'booked') return true;
  return false;
}

function isBookendSourceTagged(a: any): boolean {
  const src = String(a?.source || '').toLowerCase();
  if (src.startsWith('bookend-') || src === 'late_nightlife_bookend') return true;
  const tags: string[] = Array.isArray(a?.tags) ? a.tags.map((x: any) => String(x).toLowerCase()) : [];
  return tags.some(t => t.startsWith('bookend-') || t === 'late_nightlife_bookend');
}

function parseStartMin(a: any): number | null {
  const raw = a?.startTime ?? a?.start_time ?? a?.time;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (/pm/i.test(raw) && h < 12) h += 12;
  if (/am/i.test(raw) && h === 12) h = 0;
  return h * 60 + mm;
}

export interface StripHotelReturnLoopResult {
  activities: any[];
  droppedCount: number;
  droppedTitles: string[];
}

/**
 * @param activities — single day's activities (caller is responsible for
 *                     scoping to one day)
 * @param dayNumber  — used for sentinel logging only
 * @param isFirstDay — only Day 1 is in-scope; other days no-op
 * @param hotelName  — trip's hotel name, enables matching when AI used the
 *                     branded name instead of "hotel"
 */
export function stripHotelReturnLoop(
  activities: any[],
  opts: { dayNumber: number; isFirstDay: boolean; hotelName?: string | null },
): StripHotelReturnLoopResult {
  if (!opts.isFirstDay || !Array.isArray(activities) || activities.length === 0) {
    return { activities, droppedCount: 0, droppedTitles: [] };
  }
  const firstCheckinIdx = activities.findIndex((a) => {
    const t = String(a?.title || a?.name || '');
    return /\bcheck[-\s]?in\b/i.test(t);
  });
  if (firstCheckinIdx === -1) {
    return { activities, droppedCount: 0, droppedTitles: [] };
  }

  const hotelNeedle = opts.hotelName && opts.hotelName.length >= 3
    ? opts.hotelName.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim()
    : null;

  const droppedTitles: string[] = [];
  const survivors: any[] = [];
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    if (i <= firstCheckinIdx) { survivors.push(a); continue; }
    if (!a || isUserOwned(a) || isBookendSourceTagged(a)) { survivors.push(a); continue; }
    const t = String(a.title || a.name || '');
    if (!HOTEL_RETURN_VERB_RE.test(t)) { survivors.push(a); continue; }
    const hasHotelToken =
      HOTEL_NOUN_RE.test(t) || (hotelNeedle && t.toLowerCase().includes(hotelNeedle));
    if (!hasHotelToken) { survivors.push(a); continue; }
    const startMin = parseStartMin(a);
    // Only drop pre-18:00 cards; legitimate end-of-day rows sit later or carry
    // a bookend source tag (already handled above).
    if (startMin === null || startMin >= 18 * 60) { survivors.push(a); continue; }
    droppedTitles.push(t);
  }

  if (droppedTitles.length === 0) {
    return { activities, droppedCount: 0, droppedTitles: [] };
  }
  console.log(
    `[HOTEL_RETURN_LOOP_STRIP] day=${opts.dayNumber} dropped=${droppedTitles.length} titles=${JSON.stringify(droppedTitles)}`,
  );
  return { activities: survivors, droppedCount: droppedTitles.length, droppedTitles };
}
