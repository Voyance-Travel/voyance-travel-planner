/**
 * host-city-events — curated, AUTHORITATIVE facts for major events in host
 * cities, so the generator can DETERMINISTICALLY inject a real, grounded event
 * experience (a real Fan Festival at a real venue; the real fixture on a match
 * date) instead of relying on the model to improvise — which it does only
 * ~1-in-4 runs and sometimes fabricates ("World Cup Fan Vibes").
 *
 * ── DATA PROVENANCE & MAINTENANCE ─────────────────────────────────────────
 * Seeded from public sources (FIFA.com, Discover Atlanta, 11Alive, Axios
 * Atlanta) as of June 2026. The Fan Festival venue/dates are well-established;
 * exact match KICKOFF times are intentionally OMITTED unless verified (only the
 * semifinal had a stated 3 p.m. ET). We never assert a kickoff time we can't
 * verify — a wrong time is worse than none. ⚠️ OWNER: verify against the
 * official FIFA schedule before launch; schedules can change. One tournament =
 * this data goes stale after 2026-07-19.
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
  /** Normalized city tokens this applies to (lowercase). */
  cityKeys: string[];
  /** Inclusive ISO date window the event experience is offered. */
  window: { start: string; end: string };
  fanFestival: {
    name: string;
    venue: string;
    address: string;
    /** Free-form note on hours/entry shown in the activity description. */
    note: string;
  };
  stadium: string;
  matches: HostCityMatch[];
}

/**
 * Atlanta — FIFA World Cup 2026. Matches at Mercedes-Benz Stadium; the free
 * FIFA Fan Festival at Centennial Olympic Park (gates from noon, 47-ft
 * Jumbotron screenings, Coca-Cola Fan Zone, beer garden, concerts).
 */
const ATLANTA_WC2026: HostCityEvent = {
  id: 'wc2026-atlanta',
  event: 'FIFA World Cup 2026',
  eventRe: /\b(?:world cup|fifa|wc\s?2026)\b/i,
  cityKeys: ['atlanta'],
  window: { start: '2026-06-11', end: '2026-07-19' },
  fanFestival: {
    name: 'FIFA Fan Festival at Centennial Olympic Park',
    venue: 'Centennial Olympic Park',
    address: '265 Park Ave SW, Atlanta, GA 30313',
    note: 'Free entry; gates from noon. Match screenings on a 47-foot Jumbotron, the Coca-Cola Fan Zone, a beer garden, food stands, and live music.',
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

export const HOST_CITY_EVENTS: HostCityEvent[] = [ATLANTA_WC2026];

function normCity(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * findHostCityEvent — returns the matching curated event + the match on `dateISO`
 * (if any), but ONLY when the trip notes actually reference the event (so a
 * generic Atlanta trip during the window is unaffected). Null otherwise.
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
    const matchOnDate = ev.matches.find((m) => m.date === date) || null;
    return { event: ev, matchOnDate };
  }
  return null;
}

/**
 * buildFanFestivalActivity — a real, grounded event activity for the day,
 * tailored to whether there is a match on the date. Timing is a flexible
 * afternoon slot (the festival is all-day); the pipeline's repair/sort passes
 * place it. No fabricated kickoff time — only the verified one (if present) is
 * stated, otherwise we point at the screenings.
 */
export function buildFanFestivalActivity(
  event: HostCityEvent,
  matchOnDate: HostCityMatch | null,
  idSuffix = 'hce',
): any {
  const ff = event.fanFestival;
  let description: string;
  if (matchOnDate) {
    const isTeams = / vs /i.test(matchOnDate.fixture);
    const kick = matchOnDate.kickoffLocal ? ` (kickoff ${matchOnDate.kickoffLocal} ET)` : '';
    const watch = isTeams
      ? `Catch today's ${event.event} match — ${matchOnDate.fixture}${kick} at ${event.stadium} — live on the 47-foot Jumbotron`
      : `Catch today's ${event.event} ${matchOnDate.stage}${kick} live on the 47-foot Jumbotron`;
    description = `${watch}. ${ff.note} Confirm exact kickoff on the official ${event.event} schedule.`;
  } else {
    description = `Soak up the ${event.event} atmosphere at the official fan festival. ${ff.note}`;
  }
  return {
    id: `${idSuffix}-fanfest`,
    title: ff.name,
    name: ff.name,
    category: 'activity',
    startTime: '15:30',
    endTime: '17:30',
    location: ff.venue,
    address: ff.address,
    description,
    source: 'host-city-event',
  };
}

/**
 * ensureHostCityEventExperience — DETERMINISTIC guarantee. If a curated event
 * applies to this day and no activity already sits at the fan-festival venue,
 * inject the real fan-festival activity. Mutates + returns the activities array.
 * Returns whether it injected.
 */
export function ensureHostCityEventExperience(
  activities: any[],
  ctx: { destination: unknown; dateISO: unknown; notes: unknown; dayNumber?: number },
): { activities: any[]; injected: boolean; event: HostCityEvent | null } {
  const acts = Array.isArray(activities) ? activities : [];
  const found = findHostCityEvent(ctx.destination, ctx.dateISO, ctx.notes);
  if (!found) return { activities: acts, injected: false, event: null };
  const venueLc = found.event.fanFestival.venue.toLowerCase();
  const already = acts.some((a) => {
    const t = `${a?.title ?? a?.name ?? ''} ${a?.location ?? ''}`.toLowerCase();
    return t.includes(venueLc) || /fan fest(?:ival)?\b/.test(t);
  });
  if (already) return { activities: acts, injected: false, event: found.event };
  const card = buildFanFestivalActivity(found.event, found.matchOnDate, `hce-d${ctx.dayNumber ?? 1}`);
  acts.push(card);
  return { activities: acts, injected: true, event: found.event };
}
