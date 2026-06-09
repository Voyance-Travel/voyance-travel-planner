/**
 * itinerary-self-check.ts — generation-time quality gate.
 *
 * The same checks as scripts/itinerary-output-qa.mjs, but run INSIDE the
 * generate-itinerary edge function as the final step before persist. Purpose:
 * nothing broken ships. It (1) repairs the HIGH-severity issues that are
 * deterministically fixable and would still reach the user (activities after
 * departure, prompt-scaffolding leaked as cards, duplicate departure rows),
 * then (2) scores the result and returns the remaining issues so the caller
 * can stamp the score into trip metadata for live observability.
 *
 * Deterministic + side-effect-free except for the in-place repairs in
 * selfCheckAndRepair(). Safe to call once per generation on the merged days.
 */

export interface QualityIssue { type: string; severity: 'high' | 'med' | 'low'; day: number; msg: string; }
export interface SelfCheckResult { score: number; issues: QualityIssue[]; repaired: number; }

const titleOf = (a: any) => String(a?.title || a?.name || '').toLowerCase();
const catOf = (a: any) => String(a?.category || a?.type || '').toLowerCase();
const LOGISTICS = new Set(['transport', 'transportation', 'transit', 'flight', 'accommodation', 'stay', 'logistics', 'transfer', 'check-in', 'check-out', 'hotel']);
const isLogistics = (a: any) => LOGISTICS.has(catOf(a)) || /^\s*(travel|transfer|walk|drive|taxi|train|bus|metro|tram|ride|depart|return to|head to|check[- ]?in|check[- ]?out)\b/i.test(titleOf(a));
const isMeal = (a: any) => ['dining', 'restaurant', 'food', 'cafe', 'meal'].includes(catOf(a)) || /\b(breakfast|brunch|lunch|dinner)\b/.test(titleOf(a));
const mealType = (a: any): string | null => { const t = titleOf(a); for (const m of ['breakfast', 'lunch', 'dinner']) if (t.includes(m)) return m; return null; };
const isLocked = (a: any) => a?.locked || a?.isLocked || a?.lock_state === 'locked';
function parseMins(s: any): number | null { const m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; }

const DEP_RE = /\b(airport|station|terminal|transfer to|head to|taxi to|depart|fly home|flight home|heading home|boarding|security)\b/;
const isBareDeparture = (a: any) => { const t = titleOf(a); return /\bdepart(?:ure|ing|s)?\b/.test(t) && !/\b(flight|transfer|airport|station|terminal|check)\b/.test(t); };
const isStrongBarrier = (a: any) => catOf(a) === 'flight' || (['transport', 'transportation', 'transit', 'logistics'].includes(catOf(a)) && /\b(airport|station|terminal|transfer|head to|taxi to|boarding|security)\b/.test(titleOf(a)));
const LEAK_RE = /\b(user-provided anchors|dna-matched|incorporate all|expand with|researched places|exact hh:?mm|keep all user|then expand|additional dna|user'?s researched)\b/i;
const VAGUE_RE = /\b(find a local|a local (restaurant|spot|caf[eé]|bar|venue|eatery)|or similar|or high[- ]?end|boutique wellness|local spa|nearby caf[eé]|placeholder|your choice|in the destination)\b/i;

/** Run the quality checks WITHOUT mutating. Returns issues + a 0–100 score. */
export function checkItineraryQuality(days: any[]): { score: number; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  const add = (severity: QualityIssue['severity'], type: string, day: number, msg: string) => issues.push({ severity, type, day, msg });
  const total = days.length;

  // cross-day duplicate venues (non-logistics)
  const seen: Record<string, Set<number>> = {};
  days.forEach((d, di) => (d?.activities || []).forEach((a: any) => {
    if (isLogistics(a)) return;
    const key = String(a?.location?.name || a?.venue_name || a?.title || a?.name || '').toLowerCase()
      .replace(/^\s*[a-z' ]*\b(breakfast|brunch|lunch|dinner|nightcap|drinks?|coffee|cocktails?|tea|supper|aperitivo|aperitif)\b\s+(at|in|with|@|by)\s+/i, '')
      .replace(/\s+/g, ' ').trim();
    if (key.length < 6) return;
    (seen[key] = seen[key] || new Set()).add(di + 1);
  }));
  for (const [k, set] of Object.entries(seen)) if (set.size >= 2) add('med', 'DUPLICATE_VENUE', 0, `"${k}" repeats on days ${[...set].join(',')}`);

  days.forEach((d, idx) => {
    const acts = (d?.activities || []).filter(Boolean);
    const isLast = idx === total - 1;
    // departure-day. A real departure day legitimately has a Transfer + a
    // Flight, so only flag MULTIPLE BARE "Departure" placeholders, and only
    // flag non-logistics, non-MEAL activities after the barrier (a breakfast
    // before a midday flight is fine).
    if (isLast) {
      const bareDeps = acts.filter(isBareDeparture);
      if (bareDeps.length > 1) add('high', 'DEPARTURE_DAY', idx + 1, `${bareDeps.length} bare Departure rows`);
      // Leisure can't follow the EARLIEST barrier (you've left for the airport);
      // NOTHING (meals included) can follow the LATEST barrier (the flight).
      const sb = acts.map((a: any) => isStrongBarrier(a) ? parseMins(a.startTime || a.time) : null).filter((m: any) => m != null).sort((x: number, y: number) => x - y);
      const early = sb[0] ?? null, late = sb[sb.length - 1] ?? null;
      for (const a of acts) { if (isLogistics(a)) continue; const s = parseMins(a.startTime || a.time); if (s == null) continue; if ((late != null && s >= late) || (early != null && s >= early && !isMeal(a))) add('high', 'DEPARTURE_DAY', idx + 1, `"${a.title || a.name}" after departure`); }
    }
    // prompt-leak + vague titles
    for (const a of acts) {
      if (LEAK_RE.test(titleOf(a)) || LEAK_RE.test(String(a?.description || ''))) add('high', 'PROMPT_LEAK', idx + 1, `scaffolding card "${(a.title || a.name || '').slice(0, 40)}"`);
      else if (!isLogistics(a) && VAGUE_RE.test(titleOf(a))) add('med', 'VAGUE_TITLE', idx + 1, `vague "${a.title || a.name}"`);
    }
    // meals — duplicate same-type, wrong time
    const meals = acts.filter((a: any) => mealType(a));
    for (const m of ['breakfast', 'lunch', 'dinner']) if (meals.filter((a: any) => mealType(a) === m).length > 1) add('med', 'MEALS', idx + 1, `duplicate ${m}`);
    const WIN: Record<string, [number, number]> = { breakfast: [300, 690], lunch: [660, 960], dinner: [1020, 1380] };
    for (const a of meals) { const mt = mealType(a); const s = parseMins(a.startTime || a.time); if (mt && WIN[mt] && s != null && (s < WIN[mt][0] || s > WIN[mt][1])) add('med', 'MEALS', idx + 1, `${mt} at bad time`); }
    // after hotel-return / checkout
    let term = false;
    for (const a of acts) { if (term && !isLogistics(a) && !isMeal(a)) add('med', 'SEQUENCE', idx + 1, `"${a.title || a.name}" after checkout`); if (/return to (your )?hotel|check[- ]?out/.test(titleOf(a))) term = true; }
  });

  const penalty = issues.reduce((s, i) => s + (i.severity === 'high' ? 25 : i.severity === 'med' ? 8 : 2), 0);
  return { score: Math.max(0, 100 - penalty), issues };
}

/**
 * Repair HIGH-severity, deterministically-fixable issues in place, then score.
 * - strips non-logistics activities scheduled at/after the departure barrier
 *   (last day), preserving locked items + protected meals;
 * - removes prompt-scaffolding cards;
 * - collapses duplicate bare "Departure" rows (keep the last).
 * Returns the post-repair score + remaining issues + repair count.
 */
export function selfCheckAndRepair(days: any[]): SelfCheckResult {
  let repaired = 0;
  const total = days.length;
  days.forEach((d, idx) => {
    if (!Array.isArray(d?.activities)) return;
    const isLast = idx === total - 1;
    // vague-title clean (all days): the meal guard can inject "Lunch — find a
    // local spot in <city>" placeholders AFTER the per-day sanitize, especially
    // for cities not in the swap catalog. Strip the placeholder phrasing here as
    // the final pass. Non-destructive text edit, applied even to locked cards.
    for (const a of d.activities) {
      if (!a) continue;
      let tt = String(a.title || a.name || '');
      const before = tt;
      tt = tt.replace(/\s*[—–-]\s*find (?:a |your )?(?:local|the perfect|a good|a great)?\s*(?:spot|place|restaurant|caf[eé]|eatery|gem|favou?rite|meal)\b/ig, '')
        .replace(/\s*\(?\bor (?:similar|high[- ]?end|comparable)[^)]*\)?/ig, '')
        .replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').replace(/\s*[—–-]\s*$/,'').trim();
      if (tt && tt !== before) { a.title = tt; a.name = tt; repaired++; }
    }
    // prompt-leak strip (any day)
    d.activities = d.activities.filter((a: any) => {
      if (isLocked(a)) return true;
      if (LEAK_RE.test(titleOf(a)) || LEAK_RE.test(String(a?.description || ''))) { repaired++; return false; }
      return true;
    });
    if (!isLast) return;
    // collapse duplicate bare "Departure" placeholders (keep the last); strip
    // non-logistics, non-meal activities scheduled at/after the strong barrier.
    const bareMins = d.activities.filter(isBareDeparture).map((a: any) => parseMins(a.startTime || a.time)).filter((m: any) => m != null).sort((x: number, y: number) => x - y);
    const keepBare = bareMins.length ? bareMins[bareMins.length - 1] : null;
    const sb = d.activities.map((a: any) => isStrongBarrier(a) ? parseMins(a.startTime || a.time) : null).filter((m: any) => m != null).sort((x: number, y: number) => x - y);
    const early = sb[0] ?? null, late = sb[sb.length - 1] ?? null;
    d.activities = d.activities.filter((a: any) => {
      const s = parseMins(a.startTime || a.time);
      // NOTHING (not even a locked/auto-locked meal) can occur after the flight
      // has departed — strip it regardless of lock.
      if (s != null && late != null && s >= late && !isLogistics(a)) { repaired++; return false; }
      if (isLocked(a)) return true;
      if (isBareDeparture(a)) { const m = parseMins(a.startTime || a.time); if (keepBare != null && m != null && m !== keepBare) { repaired++; return false; } return true; }
      if (isLogistics(a)) return true;
      // leisure (non-meal) can't follow the earliest barrier (left for the airport).
      if (s != null && early != null && s >= early && !isMeal(a)) { repaired++; return false; }
      return true;
    });
  });
  const { score, issues } = checkItineraryQuality(days);
  return { score, issues, repaired };
}
