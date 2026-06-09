#!/usr/bin/env node
/**
 * itinerary-output-qa.mjs — Output-quality auditor for generated itineraries.
 *
 * The rest of our QA verifies that FEATURES WORK (swap persists, credits deduct,
 * data migrated). This one verifies that the OUTPUT IS GOOD — it reads the actual
 * generated `itinerary_data` and flags the *logic* failures a feature-QA can't see:
 *   - activities scheduled AFTER the departure (or duplicate "Departure" rows)
 *   - geographic zig-zags (the day crosses the city instead of clustering)
 *   - placeholder/uniform travel times that don't reflect real distance
 *   - out-of-order schedules, activities after checkout/hotel-return
 *   - meal absurdities (duplicate meals; a full mid-trip day with none)
 *   - hero image that's the wrong city / on the dead old host
 * Optional: an LLM "skeptical traveler" pass per day (set OPENROUTER_API_KEY).
 *
 * USAGE
 *   node scripts/itinerary-output-qa.mjs --file /tmp/trip.json        # one trip (dev)
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/itinerary-output-qa.mjs --limit 20
 *   ... --llm        # also run the LLM critique (needs OPENROUTER_API_KEY)
 *   ... --json       # machine-readable report to stdout
 * Exit code is non-zero when any trip scores below --min (default 80).
 */

const NEW_HOST = 'qpwexpjqzsdkjkvgcntx.supabase.co';
const OLD_HOST = 'jsxplunjjvxuejeouwob.supabase.co';
// A small city gazetteer so we can flag "Madrid photo on a Barcelona trip".
const KNOWN_CITIES = ['madrid','barcelona','paris','london','rome','lisbon','porto','vienna','seville','florence','venice','milan','amsterdam','berlin','prague','budapest','dublin','tokyo','kyoto','osaka','bangkok','singapore','sydney','dubai','istanbul','marrakech','cairo','athens','reykjavik','santorini','bali','seoul','hanoi'];

// ── geometry / parsing ──────────────────────────────────────────────────────
function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function coordsOf(act) {
  const c = act?.location?.coordinates || act?.coordinates || act?.location?.coords;
  if (c && typeof c.lat === 'number' && typeof c.lng === 'number') return { lat: c.lat, lng: c.lng };
  if (Array.isArray(c) && c.length === 2) return { lat: c[0], lng: c[1] };
  return null;
}
function parseMins(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = +m[1]; const min = +m[2];
  if (m[3]) { const pm = /pm/i.test(m[3]); if (pm && h !== 12) h += 12; if (!pm && h === 12) h = 0; }
  return h * 60 + min;
}
const titleOf = (a) => String(a?.title || a?.name || '').toLowerCase();
const catOf = (a) => String(a?.category || a?.type || '').toLowerCase();
const LOGISTICS = new Set(['transport','transportation','transit','flight','accommodation','stay','logistics','transfer','check-in','check-out','hotel']);
const isLogistics = (a) => LOGISTICS.has(catOf(a)) || /^\s*(travel|transfer|walk|drive|taxi|train|bus|metro|tram|ride|depart|return to|head to|check[- ]?in|check[- ]?out)\b/i.test(titleOf(a));
const isMeal = (a) => ['dining','restaurant','food','cafe','meal'].includes(catOf(a)) || /\b(breakfast|brunch|lunch|dinner|cocktails?|drinks)\b/.test(titleOf(a));
const mealType = (a) => { const t = titleOf(a); for (const m of ['breakfast','lunch','dinner']) if (t.includes(m)) return m; if (t.includes('brunch')) return 'brunch'; return null; };
const durStr = (a) => a?.transportation?.duration || a?.travelTime || (catOf(a).includes('trans') ? (a?.duration || '') : '');

// ── per-day checks ──────────────────────────────────────────────────────────
function auditDay(day, idx, total) {
  const issues = [];
  const acts = (day.activities || []).filter(Boolean);
  const isLast = idx === total - 1;
  const add = (sev, msg) => issues.push({ sev, msg, day: idx + 1 });

  // 1) DEPARTURE-DAY logic
  if (isLast) {
    const isDep = (a) => /\b(airport|station|terminal|transfer to|head to|taxi to|depart|fly home|flight home|heading home|boarding|security)\b/.test(titleOf(a)) || catOf(a) === 'flight';
    const depRows = acts.filter(isDep);
    const barrier = depRows.map((a) => parseMins(a.startTime || a.time)).filter((m) => m != null).sort((x, y) => x - y)[0] ?? null;
    if (depRows.length > 1) add('high', `duplicate departure rows (${depRows.length}: ${depRows.map((a) => `"${a.title || a.name}"`).join(', ')})`);
    if (barrier != null) {
      for (const a of acts) {
        const s = parseMins(a.startTime || a.time);
        if (s != null && s >= barrier && !isLogistics(a)) add('high', `"${a.title || a.name}" at ${a.startTime || a.time} is scheduled AFTER departure (barrier ${Math.floor(barrier/60)}:${String(barrier%60).padStart(2,'0')})`);
      }
    }
  }

  // 2) GEOGRAPHIC zig-zag (non-meal located stops, in order)
  const stops = acts.filter((a) => !isMeal(a) && !isLogistics(a) && coordsOf(a)).map((a) => ({ t: a.title || a.name, c: coordsOf(a) }));
  if (stops.length >= 3) {
    let actual = 0; for (let i = 1; i < stops.length; i++) actual += haversineKm(stops[i-1].c, stops[i].c) || 0;
    // nearest-neighbour optimal from the first stop
    const rest = stops.slice(1).map((s) => s.c); let cur = stops[0].c, opt = 0;
    while (rest.length) { let bi = 0, bd = Infinity; rest.forEach((c, i) => { const d = haversineKm(cur, c); if (d < bd) { bd = d; bi = i; } }); opt += bd; cur = rest.splice(bi, 1)[0]; }
    if (opt > 0.1 && actual > opt * 1.4 && (actual - opt) > 3) add('med', `geographic zig-zag: ${actual.toFixed(1)}km path vs ~${opt.toFixed(1)}km clustered (${(actual/opt).toFixed(1)}x)`);
    for (let i = 1; i < stops.length; i++) { const d = haversineKm(stops[i-1].c, stops[i].c); if (d && d > 8) add('med', `long intra-city hop: "${stops[i-1].t}" → "${stops[i].t}" is ${d.toFixed(1)}km`); }
  }

  // 3) TRAVEL-TIME consistency
  const legs = acts.filter((a) => catOf(a).includes('trans')).map(durStr);
  const present = legs.filter((d) => d && String(d).trim());
  if (legs.length >= 3 && present.length >= 3 && new Set(present.map((d) => String(d).replace(/\s/g, '').toLowerCase())).size === 1)
    add('med', `placeholder travel times: all ${legs.length} legs are "${present[0]}" (doesn't reflect distance)`);
  if (legs.length >= 2 && present.length < legs.length) add('low', `${legs.length - present.length}/${legs.length} travel legs have no duration`);

  // 4) SEQUENCE sanity
  let prev = -1, sawTerminal = false;
  for (const a of acts) {
    const s = parseMins(a.startTime || a.time);
    if (s != null) { if (s < prev - 30) add('low', `out-of-order: "${a.title || a.name}" at ${a.startTime || a.time} starts before the previous card`); prev = Math.max(prev, s); }
    if (sawTerminal && !isLogistics(a) && !isMeal(a)) add('med', `"${a.title || a.name}" is scheduled after hotel-return/checkout`);
    if (/return to (your )?hotel|check[- ]?out/.test(titleOf(a))) sawTerminal = true;
  }

  // 5) MEAL sanity (conservative — only obvious cases)
  const meals = acts.map(mealType).filter(Boolean);
  for (const m of ['breakfast','lunch','dinner']) if (meals.filter((x) => x === m).length > 1) add('med', `duplicate ${m} on the day`);
  if (!isLast && idx !== 0 && acts.filter((a) => !isLogistics(a)).length >= 4 && meals.length === 0) add('med', 'full mid-trip day with zero meals');

  return issues;
}

// ── per-trip ────────────────────────────────────────────────────────────────
function auditTrip(trip) {
  const dest = String(trip.destination || '').toLowerCase().split(',')[0].trim();
  const days = trip.itinerary_data?.days || [];
  const issues = [];
  days.forEach((d, i) => issues.push(...auditDay(d, i, days.length)));

  // hero image: old host or wrong city
  const hero = trip.metadata?.hero_image || trip.metadata?.heroImage || '';
  if (hero.includes(OLD_HOST)) issues.push({ sev: 'high', msg: `hero image still on the OLD host (breaks on decommission): ${hero.split('/').pop()}`, day: 0 });
  if (hero) { const fn = hero.split('/').pop().toLowerCase(); const wrong = KNOWN_CITIES.find((c) => c !== dest && fn.includes(c)); if (wrong && dest) issues.push({ sev: 'high', msg: `hero image looks like ${wrong}, not ${dest}: ${hero.split('/').pop()}`, day: 0 }); }

  const penalty = issues.reduce((s, i) => s + (i.sev === 'high' ? 25 : i.sev === 'med' ? 8 : 2), 0);
  return { id: trip.id, destination: trip.destination, dayCount: days.length, score: Math.max(0, 100 - penalty), issues };
}

// ── data source ─────────────────────────────────────────────────────────────
async function fetchTrips({ file, limit }) {
  if (file) {
    const raw = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
    return Array.isArray(raw) ? raw : (raw.trips || [raw]);
  }
  const url = process.env.SUPABASE_URL || `https://${NEW_HOST}`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY (or use --file). Service key bypasses RLS to read all trips.');
  const r = await fetch(`${url}/rest/v1/trips?select=id,destination,metadata,flight_selection,itinerary_data&itinerary_data=not.is.null&order=updated_at.desc&limit=${limit}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`Supabase fetch ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── optional LLM "skeptical traveler" pass ──────────────────────────────────
async function llmCritique(trip) {
  const key = process.env.OPENROUTER_API_KEY; if (!key) return [];
  const out = [];
  const days = trip.itinerary_data?.days || [];
  for (let i = 0; i < days.length; i++) {
    const lines = (days[i].activities || []).map((a) => `${a.startTime || a.time || '??'} [${catOf(a)}] ${a.title || a.name}`).join('\n');
    const prompt = `You are a skeptical, well-travelled reviewer reading Day ${i+1} of ${days.length} of a trip to ${trip.destination}.\n${lines}\n\nList ONLY genuine logic problems a traveler would notice (activities after they've left for the airport, criss-crossing the city, meals at impossible times, nonsensical ordering). If the day is sensible, reply exactly "OK". Be terse.`;
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'anthropic/claude-3.5-sonnet', messages: [{ role: 'user', content: prompt }], max_tokens: 300 }) });
      const j = await r.json(); const txt = (j.choices?.[0]?.message?.content || '').trim();
      if (txt && !/^ok\.?$/i.test(txt)) out.push({ sev: 'llm', msg: `Day ${i+1} LLM: ${txt.replace(/\n+/g, ' ')}`, day: i + 1 });
    } catch (_) { /* non-blocking */ }
  }
  return out;
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const file = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
  const limit = args.includes('--limit') ? +args[args.indexOf('--limit') + 1] : 20;
  const min = args.includes('--min') ? +args[args.indexOf('--min') + 1] : 80;
  const useLlm = args.includes('--llm');
  const asJson = args.includes('--json');

  const trips = await fetchTrips({ file, limit });
  const reports = [];
  for (const t of trips) {
    const rep = auditTrip(t);
    if (useLlm) rep.issues.push(...(await llmCritique(t)));
    rep.score = Math.max(0, 100 - rep.issues.reduce((s, i) => s + (i.sev === 'high' ? 25 : i.sev === 'med' ? 8 : i.sev === 'llm' ? 10 : 2), 0));
    reports.push(rep);
  }

  if (asJson) { console.log(JSON.stringify(reports, null, 2)); }
  else {
    const C = { red: '\x1b[31m', yel: '\x1b[33m', grn: '\x1b[32m', dim: '\x1b[2m', rst: '\x1b[0m', bold: '\x1b[1m' };
    for (const r of reports) {
      const col = r.score >= 90 ? C.grn : r.score >= 75 ? C.yel : C.red;
      console.log(`\n${C.bold}${r.destination}${C.rst} ${C.dim}(${r.id?.slice(0,8)}, ${r.dayCount}d)${C.rst}  ${col}score ${r.score}/100${C.rst}`);
      if (!r.issues.length) console.log(`  ${C.grn}✓ no logic issues${C.rst}`);
      for (const i of r.issues.sort((a,b) => a.day - b.day)) {
        const s = i.sev === 'high' ? `${C.red}● HIGH${C.rst}` : i.sev === 'med' ? `${C.yel}● MED ${C.rst}` : i.sev === 'llm' ? `${C.yel}● LLM ${C.rst}` : `${C.dim}● low ${C.rst}`;
        console.log(`  ${s} ${i.day ? `D${i.day} ` : '   '}${i.msg}`);
      }
    }
    const avg = reports.length ? Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length) : 0;
    const failing = reports.filter((r) => r.score < min);
    console.log(`\n${C.bold}── ${reports.length} trips · avg ${avg}/100 · ${failing.length} below ${min} ──${C.rst}`);
  }
  process.exit(reports.some((r) => r.score < min) ? 1 : 0);
}
main().catch((e) => { console.error('itinerary-output-qa error:', e.message); process.exit(2); });
