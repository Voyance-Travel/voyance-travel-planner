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
    const WIN: Record<string, [number, number]> = { breakfast: [300, 690], lunch: [660, 990], dinner: [990, 1410] };
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
        .replace(/\s*\((?:must|must-?do|user|anchor|pinned)[^)]*\)\s*/ig, ' ')   // strip internal "(must)" marker if it leaked into a title
        .replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').replace(/\s*[—–-]\s*$/,'')
        .replace(/\s+(?:and|or|at|the|in|with|to|for|a|an|&)\s*$/i, '')          // strip a dangling trailing conjunction/preposition ("Solo Reflection and")
        .trim();
      if (tt && tt !== before) { a.title = tt; a.name = tt; repaired++; }
    }
    // travel-leg duration backstop: the routing pass can leave a leg with no
    // duration (e.g. a transfer to an un-geocoded "Your Hotel"). Fill any travel
    // card that still has none with a mode-based estimate so every leg shows a time.
    for (const a of d.activities) {
      if (!a) continue;
      const c = catOf(a); const t = titleOf(a);
      const isTravel = c.includes('trans') || /^\s*(travel|taxi|walk|drive|metro|train|bus|head|ride|car|shuttle|ferry|transfer)\b/i.test(t);
      if (!isTravel) continue;
      if (a?.transportation?.duration || a?.travelTime || a?.duration) continue;
      a.duration = /\bwalk\b/.test(t) ? '10 min'
        : /\b(airport|terminal)\b/.test(t) ? '45 min'
        : /\b(metro|subway|train|tram|bus|ferry|boat)\b/.test(t) ? '20 min'
        : /\b(taxi|drive|car|cab|ride|shuttle)\b/.test(t) ? '15 min'
        : '15 min';
      repaired++;
    }
    // past-midnight wrap fix: a late-night activity that cascaded past midnight
    // (00:00–04:59) on a day that ALSO has normal daytime activities is a
    // trailing wrap (e.g. "Late Night Jazz" at 00:39 after a 21:00 tasting) —
    // a naive time-sort puts it BEFORE the morning arrival. Clamp such rows to
    // late evening so they sort after the evening, not before the day.
    const hasDaytime = d.activities.some((a: any) => { const m = parseMins(a?.startTime || a?.time); return m != null && m >= 720; });
    if (hasDaytime) {
      let wrapN = 0;
      for (const a of d.activities) {
        if (!a || isLocked(a) || isLogistics(a)) continue;
        const m = parseMins(a.startTime || a.time);
        if (m != null && m < 300) {
          const nm = Math.min(1380 + wrapN * 12, 1439); // 23:00, 23:12, … capped 23:59
          a.startTime = `${String(Math.floor(nm / 60)).padStart(2, '0')}:${String(nm % 60).padStart(2, '0')}`;
          a.time = a.startTime;
          wrapN++; repaired++;
        }
      }
    }
    // trailing hotel-return order fix: a late enrichment pass (e.g. a nightcap
    // wine bar) can be appended AFTER the end-of-day "Return to Hotel" bookend
    // was already placed by runStep8 — leaving the return ordered/timed BEFORE
    // an activity that now follows it ("Return to Hotel 20:40" then "Nightcap
    // 21:10", i.e. home-then-back-out). Re-time the return to just after the
    // latest real activity and move it to the array tail so the day genuinely
    // ends on the hotel return.
    {
      const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
      const isReturnBookend = (a: any) => {
        if (!a) return false;
        const src = String(a?.source || '').toLowerCase();
        if (/bookend-validator|bookend-synthesized|late_nightlife_bookend/.test(src)) return true;
        return /\b(return to|back to|head back to)\b/i.test(titleOf(a));
      };
      const ret = [...d.activities].reverse().find(isReturnBookend);
      if (ret) {
        const rs = parseMins(ret.startTime || ret.time);
        let latestStart: number | null = null;
        let latestEnd: number | null = null;
        for (const a of d.activities) {
          if (a === ret || isReturnBookend(a) || isLogistics(a) || isBareDeparture(a)) continue;
          if (/check[-\s]?out/i.test(titleOf(a))) continue;
          const s = parseMins(a.startTime || a.time);
          if (s == null) continue;
          if (latestStart == null || s > latestStart) { latestStart = s; latestEnd = parseMins(a.endTime) ?? (s + 60); }
        }
        if (rs != null && latestStart != null && latestStart > rs) {
          let ns = Math.max((latestEnd ?? latestStart) + 10, rs);
          if (ns > 1439) ns = 1439;
          ret.startTime = hhmm(ns); ret.time = ret.startTime;
          ret.endTime = hhmm(Math.min(ns + 25, 1439));
          const i = d.activities.indexOf(ret);
          if (i >= 0 && i !== d.activities.length - 1) { d.activities.splice(i, 1); d.activities.push(ret); }
          repaired++;
        }
      }
    }
    // too-early opening meal (FINAL-gate lift): a breakfast that opens the day
    // before 07:30 must be lifted HERE, not in the predawn normalizer — the
    // executioner re-times the meal AFTER the normalizer runs (Day-4 06:00
    // breakfast survived the earlier lift for exactly this reason). Lift toward
    // 08:00, never overlapping the next real card, and skip morning-departure days.
    {
      const hhmm2 = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
      const acts = d.activities;
      // Skip logistics and USER-locked cards when finding the day's opener — but
      // DO consider an AUTO-locked meal. The meal guard auto-locks breakfasts, so
      // a 06:20 auto-locked breakfast was never the "first" unlocked card and
      // slipped the lift (Lisbon 5d/0must). Only a genuine user/must-do lock is skipped.
      const isUserLocked = (a: any) => isLocked(a) && (
        a?.lockedSource === 'user' || a?.lockedSource === 'must_do' ||
        /\b(user|must[_-]?do|anchor|pinned)\b/i.test(String(a?.lockedSource || a?.lockReason || a?.source || '')));
      const firstIdx = acts.findIndex((a: any) => a && !isLogistics(a) && !isUserLocked(a));
      const first = firstIdx >= 0 ? acts[firstIdx] : null;
      const isMealCard = (a: any) => /dining|food|breakfast|brunch/i.test(catOf(a)) || /\b(breakfast|brunch)\b/i.test(titleOf(a));
      if (first && isMealCard(first)) {
        const s = parseMins(first.startTime || first.time);
        const hasAmDeparture = acts.some((a: any) =>
          isLogistics(a) && /\b(airport|flight|departure)\b/i.test(titleOf(a)) && (parseMins(a.startTime || a.time) ?? 1440) < 720);
        if (s != null && s >= 300 && s < 450 && !hasAmDeparture) {
          // Lift the opener to 08:00 and forward-cascade any same-day card it now
          // overlaps — instead of BAILING when 08:00 would crowd the next card.
          // Lisbon 5d/0must: a 06:20 90-min breakfast with an 08:10 next card left
          // the 06:20 in place under the old "skip if it crowds" rule (H4 breach).
          // Now we slide the breakfast and push only the cards that actually
          // conflict (prevEnd + 15-min gap), bounded so nothing spills past ~23:00.
          const dur = Math.max(30, (parseMins(first.endTime) ?? (s + 75)) - s);
          const target = 8 * 60; // 08:00 — a sane breakfast open
          if (target > s) {
            first.startTime = hhmm2(target); first.time = first.startTime;
            first.endTime = hhmm2(Math.min(target + dur, 1439));
            repaired++;
            let prevEnd = target + dur;
            for (let i = firstIdx + 1; i < acts.length; i++) {
              const a = acts[i];
              const cs = parseMins(a?.startTime || a?.time);
              if (cs == null) continue;
              if (isLogistics(a)) { prevEnd = Math.max(prevEnd, cs); continue; }
              if (cs < prevEnd + 15) {
                const cdur = Math.max(30, (parseMins(a.endTime) ?? (cs + 60)) - cs);
                const nstart = Math.min(prevEnd + 15, 1380);
                a.startTime = hhmm2(nstart); a.time = a.startTime;
                a.endTime = hhmm2(Math.min(nstart + cdur, 1439));
                prevEnd = nstart + cdur;
              } else {
                prevEnd = Math.max(prevEnd, cs);
              }
            }
          }
        }
      }
    }
    // redundant hotel-leg drop: when an accommodation "Return to Hotel" bookend
    // already ends the day, a TRANSPORT "Travel/Return to Hotel" leg at the same
    // hour is the same thing said twice (Day-1 23:44 "Return to Hotel" +
    // "Travel to Hotel"). Keep the accommodation bookend, drop the transit leg.
    {
      const hasReturnBookend = d.activities.some((a: any) =>
        /accommodation/i.test(catOf(a)) && /\b(return|back|head back) to\b[^,]*\bhotel\b/i.test(titleOf(a)));
      if (hasReturnBookend) {
        d.activities = d.activities.filter((a: any) => {
          if (/trans/i.test(catOf(a)) && /\b(travel|return|back|head) to\b[^,]*\bhotel\b/i.test(titleOf(a))) { repaired++; return false; }
          return true;
        });
      }
    }
    // prompt-leak strip (any day)
    d.activities = d.activities.filter((a: any) => {
      if (isLocked(a)) return true;
      if (LEAK_RE.test(titleOf(a)) || LEAK_RE.test(String(a?.description || ''))) { repaired++; return false; }
      return true;
    });
    if (!isLast) return;
    // departure-day post-checkout strip: NOTHING substantial belongs after hotel
    // checkout. When must-dos can't fit earlier days (6 must-dos in 3 days) the
    // injector crams them onto the departure day past checkout — and with no
    // flight clock the strong-barrier strip below never fires (Rome 3d/6must:
    // trattoria 13:20 + "Lunch" 14:50 + "Travel to Hotel" 16:30, all after an
    // 11:10 checkout). Drop post-checkout non-logistics cards + any hotel-return
    // leg (you've left the hotel); keep the checkout itself + onward airport/flight
    // logistics. Dropped must-dos surface as a capacity warning upstream.
    const coMins = d.activities
      .filter((a: any) => /check[-\s]?out/i.test(titleOf(a)))
      .map((a: any) => parseMins(a.startTime || a.time))
      .filter((m: any) => m != null)
      .sort((x: number, y: number) => x - y)[0];
    if (coMins != null) {
      d.activities = d.activities.filter((a: any) => {
        const s = parseMins(a.startTime || a.time);
        if (s == null || s <= coMins) return true;                         // before/at checkout — keep
        if (/check[-\s]?out/i.test(titleOf(a))) return true;               // the checkout card itself
        if (/\b(airport|flight|depart)\b/i.test(titleOf(a))) return true;  // onward departure logistics stay
        if (/\b(return|travel|back|head)\s+to\b[^,]*\bhotel\b/i.test(titleOf(a))) { repaired++; return false; } // hotel-return after checkout = illogical
        if (!isLogistics(a)) { repaired++; return false; }                 // any activity crammed past checkout → drop
        return true;
      });
    }
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
