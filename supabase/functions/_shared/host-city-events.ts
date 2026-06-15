/**
 * host-city-events — curated, AUTHORITATIVE facts for major recurring events in
 * host cities, so the generator can DETERMINISTICALLY inject a real, grounded
 * event experience (a real festival/fan site at a real venue; the real fixture
 * on a match date) instead of relying on the model to improvise — which it does
 * only ~1-in-4 runs and sometimes fabricates ("World Cup Fan Vibes").
 *
 * ── DATA PROVENANCE & MAINTENANCE ─────────────────────────────────────────
 * Each entry cites its source + verification date inline. We assert only
 * STABLE facts (venue/grounds) and VERIFIED dates; we never fabricate a date or
 * a kickoff/start time. Events whose only known venues are ticketed (e.g. the
 * LA 2028 Olympic ceremonies) are intentionally NOT given a deterministic
 * injection — they still get the grounded-prompt + vibe-scrub floor via
 * extract-must-dos' EVENT_THEME_RE. ⚠️ OWNER: verify dates against the official
 * source before launch; recurring-event dates change yearly — update the
 * `window`/`matches` each year (the venues are stable).
 */

export interface HostCityMatch {
  /** ISO date 'YYYY-MM-DD' (local). */
  date: string;
  /** Real fixture, e.g. 'Spain vs Cape Verde'. 'TBD' teams for knockouts. */
  fixture: string;
  stage: string;
  /** 24h local kickoff 'HH:MM' — ONLY when verified, else undefined. */
  kickoffLocal?: string;
}

export interface HostCityEvent {
  id: string;
  /** Display name of the event. */
  event: string;
  /** Matches the event in free-text trip notes. */
  eventRe: RegExp;
  /** Normalized city tokens this applies to (lowercase, a-z + space only). */
  cityKeys: string[];
  /** Inclusive ISO date window the event experience is offered. */
  window: { start: string; end: string };
  /**
   * The real, accessible, grounded experience to anchor the day on — a festival
   * grounds, fan site, or parade route. NOT a ticketed-only venue.
   */
  primaryExperience: {
    /** The activity title, e.g. 'FIFA Fan Festival at Centennial Olympic Park'. */
    name: string;
    /** Real venue/area used for the dedup check + location field. */
    venue: string;
    address?: string;
    /** Description body — the concrete, real details of the experience. */
    note: string;
    /** Default placement (24h) — festivals afternoon, marathons morning. */
    defaultStart?: string;
    defaultEnd?: string;
  };
  /** Optional: a stadium for fixture-based events (World Cup). */
  stadium?: string;
  /** Optional: dated fixtures (World Cup). Empty/undefined for festivals. */
  matches?: HostCityMatch[];
}

// ── Atlanta · FIFA World Cup 2026 ───────────────────────────────────────────
// Sources: FIFA.com, Discover Atlanta, 11Alive, Axios Atlanta (verified 2026-06).
const ATLANTA_WC2026: HostCityEvent = {
  id: 'wc2026-atlanta',
  event: 'FIFA World Cup 2026',
  eventRe: /\b(?:world cup|fifa|wc\s?2026)\b/i,
  cityKeys: ['atlanta'],
  window: { start: '2026-06-11', end: '2026-07-19' },
  primaryExperience: {
    name: 'FIFA Fan Festival at Centennial Olympic Park',
    venue: 'Centennial Olympic Park',
    address: '265 Park Ave SW, Atlanta, GA 30313',
    note: 'Free entry; gates from noon. Match screenings on a 47-foot Jumbotron, the Coca-Cola Fan Zone, a beer garden, food stands, and live music.',
    defaultStart: '15:30',
    defaultEnd: '17:30',
  },
  stadium: 'Mercedes-Benz Stadium',
  matches: [
    { date: '2026-06-15', fixture: 'Spain vs Cape Verde', stage: 'Group H' },
    { date: '2026-06-18', fixture: 'Czechia vs South Africa', stage: 'Group A' },
    { date: '2026-06-21', fixture: 'Spain vs Saudi Arabia', stage: 'Group H' },
    { date: '2026-06-24', fixture: 'Morocco vs Haiti', stage: 'Group C' },
    { date: '2026-06-27', fixture: 'DR Congo vs Uzbekistan', stage: 'Group K' },
    { date: '2026-07-01', fixture: 'Round of 32 match', stage: 'Round of 32' },
    { date: '2026-07-07', fixture: 'Round of 16 match', stage: 'Round of 16' },
    { date: '2026-07-15', fixture: 'Semifinal', stage: 'Semifinal', kickoffLocal: '15:00' },
  ],
};

// ── Munich · Oktoberfest 2026 ────────────────────────────────────────────────
// Source: oktoberfest.de / muenchen.de (verified 2026-06). 191st Oktoberfest,
// Theresienwiese, Sep 19 – Oct 4 2026; free entry, beer tents open ~10:00.
const MUNICH_OKTOBERFEST_2026: HostCityEvent = {
  id: 'oktoberfest-munich-2026',
  event: 'Oktoberfest',
  eventRe: /\boktoberfest\b|\bwiesn\b/i,
  cityKeys: ['munich', 'munchen', 'muenchen'],
  window: { start: '2026-09-19', end: '2026-10-04' },
  primaryExperience: {
    name: 'Oktoberfest at the Theresienwiese',
    venue: 'Theresienwiese',
    address: 'Theresienwiese, 80336 München, Germany',
    note: 'The original Oktoberfest fairgrounds — free entry to the grounds; 14 large beer tents (reserve ahead on weekends), Bavarian food, and fairground rides. Traditional dress (Tracht) encouraged.',
    defaultStart: '13:00',
    defaultEnd: '16:00',
  },
};

// ── New Orleans · Mardi Gras 2027 ────────────────────────────────────────────
// Source: mardigrasneworleans.com / neworleans.com / nola.com (verified 2026-06).
// Fat Tuesday Feb 9 2027; major parades roll the final days along the Uptown /
// St. Charles Avenue route (free, public).
const NOLA_MARDIGRAS_2027: HostCityEvent = {
  id: 'mardigras-neworleans-2027',
  event: 'Mardi Gras',
  eventRe: /\bmardi\s?gras\b|\bfat tuesday\b|\bcarnival\b/i,
  cityKeys: ['new orleans', 'nola'],
  window: { start: '2027-02-03', end: '2027-02-09' },
  primaryExperience: {
    name: 'Mardi Gras parades on St. Charles Avenue',
    venue: 'St. Charles Avenue',
    address: 'St. Charles Ave, New Orleans, LA',
    note: 'Catch a Mardi Gras krewe parade along the classic Uptown/St. Charles Avenue route — free and public; bring a bag for throws (beads, doubloons). Parades roll mostly afternoon into evening the final days before Fat Tuesday (Feb 9, 2027).',
    defaultStart: '15:00',
    defaultEnd: '18:00',
  },
};

// ── New York City · TCS New York City Marathon 2026 ──────────────────────────
// Source: nyrr.org (verified 2026-06). Sun Nov 1 2026; 5-borough course,
// Staten Island start → Central Park finish. Free to spectate along the route.
const NYC_MARATHON_2026: HostCityEvent = {
  id: 'nyc-marathon-2026',
  event: 'TCS New York City Marathon',
  eventRe: /\bmarathon\b/i,
  cityKeys: ['new york', 'nyc', 'manhattan', 'brooklyn'],
  window: { start: '2026-11-01', end: '2026-11-01' },
  primaryExperience: {
    name: 'Cheer the NYC Marathon on First Avenue',
    venue: 'First Avenue, Manhattan',
    address: 'First Ave, Manhattan, New York, NY',
    note: 'Watch the TCS New York City Marathon (50th running of the five-borough course) — free to spectate. First Avenue in Manhattan (Mile ~16–18) is one of the loudest stretches; the finish line is in Central Park. Runners pass mid-morning into the afternoon.',
    defaultStart: '10:30',
    defaultEnd: '12:30',
  },
};

export const HOST_CITY_EVENTS: HostCityEvent[] = [
  ATLANTA_WC2026,
  MUNICH_OKTOBERFEST_2026,
  NOLA_MARDIGRAS_2027,
  NYC_MARATHON_2026,
];

function normCity(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * findHostCityEvent — returns the matching curated event + the match on `dateISO`
 * (if any), but ONLY when the trip notes actually reference the event (so a
 * generic trip during the window is unaffected). Null otherwise.
 */
export function findHostCityEvent(
  destination: unknown,
  dateISO: unknown,
  notes: unknown,
): { event: HostCityEvent; matchOnDate: HostCityMatch | null } | null {
  const city = normCity(destination);
  const date = typeof dateISO === 'string' ? dateISO.slice(0, 10) : '';
  const notesStr = String(notes ?? '');
  if (!city || !date || !notesStr.trim()) return null;
  for (const ev of HOST_CITY_EVENTS) {
    if (!ev.cityKeys.some((k) => city.includes(k))) continue;
    if (date < ev.window.start || date > ev.window.end) continue;
    if (!ev.eventRe.test(notesStr)) continue;
    const matchOnDate = ev.matches?.find((m) => m.date === date) || null;
    return { event: ev, matchOnDate };
  }
  return null;
}

/**
 * buildEventActivity — a real, grounded event activity for the day. For
 * fixture-based events (World Cup) on a match date it folds in the real fixture
 * (and the verified kickoff, if any); otherwise it's the primary experience.
 * Timing comes from the event's defaults; the pipeline's repair/sort passes
 * place it. No fabricated times.
 */
export function buildEventActivity(
  event: HostCityEvent,
  matchOnDate: HostCityMatch | null,
  idSuffix = 'hce',
): any {
  const pe = event.primaryExperience;
  let description = pe.note;
  if (matchOnDate) {
    const isTeams = / vs /i.test(matchOnDate.fixture);
    const kick = matchOnDate.kickoffLocal ? ` (kickoff ${matchOnDate.kickoffLocal} ET)` : '';
    const watch = isTeams
      ? `Today's ${event.event} match — ${matchOnDate.fixture}${kick}${event.stadium ? ` at ${event.stadium}` : ''} — screens live here.`
      : `Today's ${event.event} ${matchOnDate.stage}${kick} screens live here.`;
    description = `${watch} ${pe.note}${matchOnDate.kickoffLocal ? '' : ` Confirm exact kickoff on the official ${event.event} schedule.`}`;
  }
  return {
    id: `${idSuffix}-event`,
    title: pe.name,
    name: pe.name,
    category: 'activity',
    startTime: pe.defaultStart || '15:30',
    endTime: pe.defaultEnd || '17:30',
    location: pe.venue,
    address: pe.address,
    description,
    source: 'host-city-event',
  };
}

/**
 * ensureHostCityEventExperience — DETERMINISTIC guarantee. If a curated event
 * applies to this day and no activity already sits at the primary-experience
 * venue, inject the real event activity. Mutates + returns the activities array.
 */
export function ensureHostCityEventExperience(
  activities: any[],
  ctx: { destination: unknown; dateISO: unknown; notes: unknown; dayNumber?: number },
): { activities: any[]; injected: boolean; event: HostCityEvent | null } {
  const acts = Array.isArray(activities) ? activities : [];
  const found = findHostCityEvent(ctx.destination, ctx.dateISO, ctx.notes);
  if (!found) return { activities: acts, injected: false, event: null };
  const venueLc = found.event.primaryExperience.venue.toLowerCase();
  // Token-based venue match (tolerant of "Centennial Park" vs "Centennial
  // Olympic Park") rather than a brittle full-substring match.
  const venueTokens = venueLc.split(/\s+/).map((t) => t.replace(/[^a-z]/g, '')).filter((t) => t.length > 3);
  const hayOf = (a: any) => `${String(a?.title ?? a?.name ?? '')} ${String(a?.location?.name ?? a?.location ?? '')}`.toLowerCase();
  const isTransitOrProtected = (a: any) => {
    if (a?.locked || a?.isLocked || a?.isUserAuthored) return true;
    const cat = String(a?.category ?? '').toLowerCase();
    const title = String(a?.title ?? a?.name ?? '').toLowerCase();
    return /\b(transit|transport|transfer|logistics|commute|flight|accommodation)\b/.test(cat)
      || /\b(taxi|transfer|drive|driving|travel (?:to|through|past)|head (?:to|toward)|pass(?:ing)? through|walk (?:to|past)|en route|uber|lyft)\b/.test(title);
  };
  const isFanFestish = (a: any) => /fan\s*fest(?:ival)?\b|fan\s*zone\b/.test(hayOf(a));
  const atCuratedVenue = (a: any) => venueTokens.length > 0 && venueTokens.filter((tok) => hayOf(a).includes(tok)).length >= Math.max(1, venueTokens.length - 1);

  // An existing card that REPRESENTS this event experience: a fan-fest-ish card
  // (even at the wrong venue, e.g. the model put it at "Georgia World Congress
  // Center" instead of Centennial Olympic Park) OR a bare card sitting at the
  // curated venue ("Explore Centennial Olympic Park" with no event framing).
  const idx = acts.findIndex((a) => a && a.source !== 'host-city-event' && !isTransitOrProtected(a) && (isFanFestish(a) || atCuratedVenue(a)));

  if (idx >= 0) {
    const ex = acts[idx];
    // Already the authoritative experience (a real fan fest AT the curated
    // venue) — leave it; don't double-inject.
    if (isFanFestish(ex) && atCuratedVenue(ex)) {
      return { activities: acts, injected: false, event: found.event };
    }
    // UPGRADE a bare-venue card OR a wrong-venue fan-fest to the curated, real
    // experience — correct venue + what's actually there (jumbotron, fan zone,
    // today's fixture) — keeping the model's chosen time slot so the schedule
    // isn't disturbed. This is the "it just named the park, not the fan fest"
    // fix + the "fan fest at the wrong venue" fix.
    const card = buildEventActivity(found.event, found.matchOnDate, `hce-d${ctx.dayNumber ?? 1}`);
    card.startTime = ex.startTime ?? ex.time ?? card.startTime;
    card.time = card.startTime;
    card.endTime = ex.endTime ?? card.endTime;
    const out = [...acts];
    out[idx] = card;
    return { activities: out, injected: true, event: found.event };
  }

  // No event card at all — inject the curated one into a real gap.
  const card = buildEventActivity(found.event, found.matchOnDate, `hce-d${ctx.dayNumber ?? 1}`);
  const placed = placeCardInGap(acts, card);
  return { activities: placed, injected: true, event: found.event };
}

const _pm = (s: any): number | null => { const m = String(s ?? '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const _fm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * placeCardInGap — slot the event card into a REAL free gap in the day so it
 * never double-books. Earlier the card was pushed at a fixed 15:30 + naive
 * re-sort, which collided with whatever the model scheduled there (e.g. a fan
 * fest overlapping the High Museum). We find the gap nearest the card's
 * preferred start that fits its duration (with a 15-min buffer), shrink it to
 * fit if needed, and only fall back to "after the last activity" when the day
 * is genuinely packed. Mutates card times; returns the sorted activities.
 */
function placeCardInGap(acts: any[], card: any): any[] {
  const BUF = 15;
  const prefStart = _pm(card.startTime) ?? (15 * 60 + 30);
  const wantDur = Math.max(60, ((_pm(card.endTime) ?? 0) - (_pm(card.startTime) ?? 0)) || 120);
  const DAY_START = 8 * 60, DAY_END = 23 * 60;
  const timed = acts
    .map((a) => ({ s: _pm(a.startTime || a.time), e: _pm(a.endTime) }))
    .filter((x): x is { s: number; e: number } => x.s != null)
    .map((x) => ({ s: x.s, e: x.e ?? x.s + 60 }))
    .sort((a, b) => a.s - b.s);

  // Build the free gaps across the day.
  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = DAY_START;
  for (const t of timed) {
    if (t.s - cursor >= 60 + 2 * BUF) gaps.push({ start: cursor, end: t.s });
    cursor = Math.max(cursor, t.e);
  }
  if (DAY_END - cursor >= 60 + 2 * BUF) gaps.push({ start: cursor, end: DAY_END });

  let chosen: { start: number; dur: number } | null = null;
  let bestDist = Infinity;
  for (const g of gaps) {
    const avail = (g.end - BUF) - (g.start + BUF);
    if (avail < 60) continue;
    const dur = Math.min(wantDur, avail);
    const start = Math.min(Math.max(prefStart, g.start + BUF), g.end - BUF - dur);
    const dist = Math.abs(start - prefStart);
    if (dist < bestDist) { bestDist = dist; chosen = { start, dur }; }
  }
  if (chosen) {
    card.startTime = _fm(chosen.start); card.time = card.startTime; card.endTime = _fm(chosen.start + chosen.dur);
  } else {
    // Day is packed — append after the last activity (still no overlap).
    const lastEnd = timed.length ? Math.max(...timed.map((t) => t.e)) : prefStart;
    const start = lastEnd + BUF;
    card.startTime = _fm(start); card.time = card.startTime; card.endTime = _fm(start + Math.min(wantDur, 120));
  }
  acts.push(card);
  return acts.sort((a, b) => ((_pm(a.startTime || a.time) ?? 9999) - (_pm(b.startTime || b.time) ?? 9999)));
}
