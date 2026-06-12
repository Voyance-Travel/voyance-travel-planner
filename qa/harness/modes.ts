/**
 * qa/harness/modes.ts — Step 5: the trip-creation surfaces beyond the
 * single-city wizard, exercised the SAME way the frontend does.
 *
 *   --mode multicity   2-city / 7-day multi-city trip (below the 8-day split
 *                      threshold): trips + trip_cities inserts, wizard cost
 *                      (7×60 + 60 city fee = 480), generate-trip, poll, audit.
 *   --mode journey     3-city / 10-day trip → runs the REAL frontend
 *                      splitJourneyIfNeeded (via sb-shim import map), expects
 *                      a split, kicks leg 1, waits for the server-side leg
 *                      chain (triggerNextJourneyLeg), audits every leg.
 *   --mode chat        "Just Tell Us": posts a free-text trip description to
 *                      chat-trip-planner, parses the SSE tool-call extraction,
 *                      asserts sanity, then runs the extracted trip through
 *                      the standard path and audits it (must-do included).
 *   --mode manual      "Build Myself": parse-trip-input on a pasted plan →
 *                      trip insert mirroring createTripFromParsed → structural
 *                      checks → Smart Finish (spend smart_finish + enrich-
 *                      manual-trip) → re-checks incl. prompt-leak gate.
 *
 * Run (import map is REQUIRED for journey mode):
 *   deno run --no-lock --no-check --allow-all --sloppy-imports \
 *     --import-map qa/harness/import_map.json qa/harness/modes.ts --mode journey
 */
import { auditTripRow, type AuditIssue } from './audit.ts';
import { supabase as sb } from './sb-shim.ts';
import { splitJourneyIfNeeded } from '../../src/utils/splitJourneyIfNeeded.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const arg = (n: string) => { const i = Deno.args.indexOf(`--${n}`); return i >= 0 ? Deno.args[i + 1] : undefined; };

let failures = 0;
function check(step: string, ok: boolean, detail: string) {
  console.log(`  ${ok ? '✅' : '❌'} ${step}: ${detail}`);
  if (!ok) failures++;
}
function reportIssues(step: string, issues: AuditIssue[]) {
  for (const i of issues) console.log(`     ${i.gate}${i.day != null ? ` D${i.day}` : ''}: ${i.detail}`);
  check(step, issues.length === 0, `12-gate audit (${issues.length} issues)`);
}

const userId = (await sb.auth.getUser()).data.user!.id;
console.log(`signed in; user ${userId}\n`);

async function spend(tripId: string, credits: number, days: number, cities: number) {
  const { data, error } = await sb.functions.invoke('spend-credits', {
    body: {
      action: 'trip_generation', tripId, creditsAmount: credits,
      metadata: { days, cities, complexity: 'standard', multiplier: 1, idempotencyKey: crypto.randomUUID(), defensiveRefundKey: crypto.randomUUID() },
    },
  });
  if (error || (data as any)?.error) throw new Error(`spend-credits: ${error?.message ?? JSON.stringify((data as any)?.error)}`);
}

async function kickoff(body: Record<string, unknown>) {
  const { error } = await sb.functions.invoke('generate-itinerary', { body: { action: 'generate-trip', userId, ...body } });
  if (error) console.warn('  kickoff returned error (may still run):', error.message);
}

async function pollReady(tripId: string, label: string, maxMin = 20): Promise<string> {
  let status = '';
  for (let i = 0; i < maxMin * 4; i++) {
    await sleep(15);
    const { data } = await sb.from('trips').select('itinerary_status').eq('id', tripId).single();
    status = String(data?.itinerary_status ?? '');
    if (i % 8 === 7) console.log(`  [${label} ${(i + 1) * 15}s] ${status}`);
    if (['ready', 'partial', 'failed'].includes(status)) break;
  }
  return status;
}

async function readTrip(tripId: string) {
  return (await sb.from('trips').select('itinerary_status, itinerary_data, metadata, destination, journey_id, journey_order, journey_total_legs').eq('id', tripId).single()).data as any;
}

const SETTLE_S = 300;

// ── MODE: multicity (2 cities, 7 days — below split threshold) ─────────────
async function modeMulticity() {
  console.log('── MULTI-CITY (no split): Lisbon 3n + Porto 3n, 7 days');
  const s = new Date(); s.setDate(s.getDate() + 21);
  const e = new Date(s); e.setDate(e.getDate() + 6);
  const mid = new Date(s); mid.setDate(mid.getDate() + 3);
  const { data: trip, error: terr } = await sb.from('trips').insert({
    user_id: userId, name: 'QA Modes — Lisbon+Porto', destination: 'Lisbon, Porto',
    start_date: iso(s), end_date: iso(e), travelers: 1, trip_type: 'vacation',
    budget_tier: 'moderate', is_multi_city: true,
  }).select('id').single();
  if (terr || !trip) { check('M1', false, `trip insert: ${terr?.message}`); return; }
  const tripId = trip.id as string;
  console.log(`  trip ${tripId}`);
  const { error: cerr } = await sb.from('trip_cities').insert([
    { trip_id: tripId, city_order: 0, city_name: 'Lisbon', country: 'Portugal', arrival_date: iso(s), departure_date: iso(mid), nights: 3, generation_status: 'pending', days_total: 4 },
    { trip_id: tripId, city_order: 1, city_name: 'Porto', country: 'Portugal', arrival_date: iso(mid), departure_date: iso(e), nights: 3, generation_status: 'pending', days_total: 4, transport_type: 'train', transition_day_mode: 'half_and_half' },
  ]);
  check('M1', !cerr, `trip_cities insert ${cerr ? 'ERROR ' + cerr.message : 'ok'}`);
  for (const city of ['Lisbon', 'Porto']) {
    try { await sb.functions.invoke('suggest-landmarks', { body: { city, country: 'Portugal' } }); } catch { /* non-blocking */ }
  }
  await spend(tripId, 480, 7, 2); // 7×60 + 60 two-city fee, standard tier
  console.log('  charged 480');
  await kickoff({
    tripId, destination: 'Lisbon, Porto', destinationCountry: 'Portugal',
    startDate: iso(s), endDate: iso(e), travelers: 1, tripType: 'vacation', budgetTier: 'moderate',
    isMultiCity: true, creditsCharged: 480, requestedDays: 7, isFirstTrip: false, mustDoActivities: '', perDayActivities: [],
  });
  const status = await pollReady(tripId, 'multicity');
  console.log(`  terminal: ${status}; settling ${SETTLE_S}s…`);
  await sleep(SETTLE_S);
  const row = await readTrip(tripId);
  check('M1', row.itinerary_status === 'ready', `status=${row.itinerary_status}`);
  const days = row?.itinerary_data?.days ?? [];
  const blob = JSON.stringify(days).toLowerCase();
  check('M1', days.length === 7, `days=${days.length} (want 7)`);
  check('M1', blob.includes('porto'), `second city present in content`);
  reportIssues('M1', auditTripRow(row, { city: 'Lisbon', expectedDays: 7 }));
}

// ── MODE: journey (3 cities, 10 days — real split util) ────────────────────
async function modeJourney() {
  console.log('── JOURNEY SPLIT: Rome 3n + Florence 3n + Venice 3n, 10 days');
  const s = new Date(); s.setDate(s.getDate() + 28);
  const e = new Date(s); e.setDate(e.getDate() + 9);
  const { data: trip, error: terr } = await sb.from('trips').insert({
    user_id: userId, name: 'QA Modes — Italy Journey', destination: 'Rome, Florence, Venice',
    start_date: iso(s), end_date: iso(e), travelers: 1, trip_type: 'vacation',
    budget_tier: 'moderate', is_multi_city: true,
  }).select('id').single();
  if (terr || !trip) { check('M2', false, `trip insert: ${terr?.message}`); return; }
  const tripId = trip.id as string;
  console.log(`  trip ${tripId}`);
  for (const city of ['Rome', 'Florence', 'Venice']) {
    try { await sb.functions.invoke('suggest-landmarks', { body: { city, country: 'Italy' } }); } catch { /* non-blocking */ }
  }
  // THE REAL PRODUCT CODE — src/utils/splitJourneyIfNeeded via sb-shim.
  const split = await splitJourneyIfNeeded(
    tripId,
    [
      { city: 'Rome', country: 'Italy', nights: 3 },
      { city: 'Florence', country: 'Italy', nights: 3 },
      { city: 'Venice', country: 'Italy', nights: 3 },
    ],
    [
      { type: 'train', fromCity: 'Rome', toCity: 'Florence' },
      { type: 'train', fromCity: 'Florence', toCity: 'Venice' },
    ],
    iso(s), iso(e), {},
  );
  check('M2', !!split?.didSplit, `didSplit=${String(split?.didSplit)} legs=${split?.legCount ?? 0}`);
  if (!split?.didSplit) return;
  const { data: legs } = await sb.from('trips')
    .select('id, destination, start_date, end_date, journey_order, journey_total_legs, itinerary_status')
    .eq('journey_id', (await sb.from('trips').select('journey_id').eq('id', split.firstLegTripId).single()).data!.journey_id)
    .order('journey_order');
  check('M2', (legs?.length ?? 0) === 3, `${legs?.length ?? 0} leg rows (want 3)`);
  if (!legs?.length) return;
  for (const l of legs) console.log(`  leg ${l.journey_order}: ${l.destination} ${l.start_date}→${l.end_date} [${l.itinerary_status}] ${l.id}`);

  const leg1 = legs[0];
  await spend(leg1.id, 720, 10, 3); // 10×60 + 120 three-city fee — one charge for the journey
  console.log('  charged 720 (journey total, on leg 1)');
  const leg1Days = Math.round((new Date(leg1.end_date).getTime() - new Date(leg1.start_date).getTime()) / 86400000) + 1;
  await kickoff({
    tripId: leg1.id, destination: leg1.destination, destinationCountry: 'Italy',
    startDate: leg1.start_date, endDate: leg1.end_date, travelers: 1, tripType: 'vacation', budgetTier: 'moderate',
    isMultiCity: false, creditsCharged: 720, requestedDays: leg1Days, isFirstTrip: false, mustDoActivities: '', perDayActivities: [],
  });

  // The edge function chains legs (triggerNextJourneyLeg) — wait for ALL.
  const deadline = Date.now() + 45 * 60 * 1000;
  let statuses: string[] = [];
  while (Date.now() < deadline) {
    await sleep(30);
    const { data: cur } = await sb.from('trips').select('journey_order, itinerary_status').in('id', legs.map((l) => l.id)).order('journey_order');
    statuses = (cur ?? []).map((l: any) => l.itinerary_status);
    if (statuses.every((st) => ['ready', 'partial', 'failed'].includes(st))) break;
    if (Math.floor((Date.now() % 180000) / 30000) === 0) console.log(`  legs: [${statuses.join(', ')}]`);
  }
  console.log(`  terminal legs: [${statuses.join(', ')}]; settling ${SETTLE_S}s…`);
  await sleep(SETTLE_S);
  const cities = ['Rome', 'Florence', 'Venice'];
  for (let i = 0; i < legs.length; i++) {
    const row = await readTrip(legs[i].id);
    check('M2', row.itinerary_status === 'ready', `leg ${i + 1} (${cities[i]}) status=${row.itinerary_status}`);
    const legDays = Math.round((new Date(legs[i].end_date).getTime() - new Date(legs[i].start_date).getTime()) / 86400000) + 1;
    reportIssues(`M2 leg ${i + 1}`, auditTripRow(row, { city: cities[i], expectedDays: legDays }));
  }
}

// ── MODE: chat ("Just Tell Us") ─────────────────────────────────────────────
async function modeChat() {
  console.log('── JUST TELL US: free-text → extraction → standard generation');
  const s = new Date(); s.setDate(s.getDate() + 35);
  const e = new Date(s); e.setDate(e.getDate() + 4);
  const msg = `I want 5 days in Lisbon, Portugal from ${iso(s)} to ${iso(e)}, one traveler, mid-range budget. I love seafood and riding the old trams. I absolutely must see the Belém Tower.`;
  const session = (await sb.auth.getSession()).data.session!;
  const res = await fetch(`${URL_}/functions/v1/chat-trip-planner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': ANON },
    body: JSON.stringify({ messages: [{ role: 'user', content: msg }] }),
  });
  check('M3', res.ok, `chat-trip-planner HTTP ${res.status}`);
  const raw = await res.text();
  // SSE stream of OpenAI-style chunks; tool-call arguments arrive fragmented.
  let argText = '';
  for (const line of raw.split('\n')) {
    const m = line.match(/^data:\s*(\{.*\})\s*$/);
    if (!m) continue;
    try {
      const chunk = JSON.parse(m[1]);
      const tcs = chunk?.choices?.[0]?.delta?.tool_calls;
      if (Array.isArray(tcs)) for (const tc of tcs) argText += tc?.function?.arguments ?? '';
    } catch { /* keep scanning */ }
  }
  let extracted: any = null;
  try { extracted = JSON.parse(argText); } catch { /* judged below */ }
  check('M3', !!extracted, `extraction parsed (${argText.length} chars of tool args)`);
  if (!extracted) { console.log('  raw head:', raw.slice(0, 300)); return; }
  console.log(`  extracted: dest="${extracted.destination}" ${extracted.startDate ?? extracted.dates?.start} → ${extracted.endDate ?? extracted.dates?.end}`);
  const dest = String(extracted.destination ?? '');
  const sd = String(extracted.startDate ?? extracted.dates?.start ?? '');
  const ed = String(extracted.endDate ?? extracted.dates?.end ?? '');
  check('M3', /lisbon/i.test(dest), `destination mentions Lisbon ("${dest}")`);
  check('M3', sd === iso(s) && ed === iso(e), `dates ${sd}→${ed} match requested ${iso(s)}→${iso(e)}`);
  check('M3', /bel[ée]m/i.test(String(extracted.mustDoActivities ?? '')), `must-do captured ("${String(extracted.mustDoActivities ?? '').slice(0, 60)}")`);

  // Confirm-card path: extracted details drive the STANDARD creation flow.
  const { data: trip, error: terr } = await sb.from('trips').insert({
    user_id: userId, name: 'QA Modes — Chat Lisbon', destination: 'Lisbon, Portugal',
    start_date: iso(s), end_date: iso(e), travelers: 1, trip_type: 'vacation', budget_tier: 'moderate',
  }).select('id').single();
  if (terr || !trip) { check('M3', false, `trip insert: ${terr?.message}`); return; }
  console.log(`  trip ${trip.id}`);
  try { await sb.functions.invoke('suggest-landmarks', { body: { city: 'Lisbon', country: 'Portugal' } }); } catch { /* non-blocking */ }
  await spend(trip.id, 300, 5, 1);
  await kickoff({
    tripId: trip.id, destination: 'Lisbon, Portugal', destinationCountry: 'Portugal',
    startDate: iso(s), endDate: iso(e), travelers: 1, tripType: 'vacation', budgetTier: 'moderate',
    isMultiCity: false, creditsCharged: 300, requestedDays: 5, isFirstTrip: false,
    mustDoActivities: String(extracted.mustDoActivities ?? 'Belém Tower'), perDayActivities: [],
  });
  const status = await pollReady(trip.id, 'chat');
  console.log(`  terminal: ${status}; settling ${SETTLE_S}s…`);
  await sleep(SETTLE_S);
  const row = await readTrip(trip.id);
  check('M3', row.itinerary_status === 'ready', `status=${row.itinerary_status}`);
  reportIssues('M3', auditTripRow(row, { city: 'Lisbon', expectedDays: 5, mustDo: 'Belém Tower' }));
}

// ── MODE: manual ("Build Myself" + Smart Finish) ────────────────────────────
async function modeManual() {
  console.log('── BUILD MYSELF: parse → save → Smart Finish');
  const s = new Date(); s.setDate(s.getDate() + 40);
  const pasted = `Trip to Seville, Spain — ${iso(s)}, 3 days, 1 person

Day 1 - Arrival
Morning: Arrive and check into hotel near Barrio Santa Cruz
Afternoon: Wander the Barrio Santa Cruz alleys
Lunch: Tapas at Bar Las Teresas (~€20)
Evening: Sunset at Metropol Parasol

Day 2 - Landmarks
Morning: Seville Cathedral and La Giralda tower (€12)
Lunch: Somewhere near the cathedral
Afternoon: Real Alcázar palace and gardens (€15)
Evening: Flamenco show at La Casa del Flamenco (€25)

Day 3 - Riverside
Morning: Walk along the Guadalquivir, Torre del Oro
Lunch: Triana market food stalls
Afternoon: Plaza de España and María Luisa Park
Evening: Farewell dinner`;
  const { data: parsed, error: perr } = await sb.functions.invoke('parse-trip-input', { body: { text: pasted } });
  check('M4', !perr && !!(parsed as any), `parse-trip-input ${perr ? 'ERROR ' + perr.message : 'ok'}`);
  const p: any = (parsed as any)?.parsed ?? parsed;
  const pDays: any[] = Array.isArray(p?.days) ? p.days : [];
  check('M4', pDays.length === 3, `parsed days=${pDays.length} (want 3)`);
  check('M4', /seville/i.test(String(p?.destination ?? '')), `destination "${p?.destination}"`);
  if (pDays.length === 0) return;

  // Mirror createTripFromParsed: card-shaped days, every activity a user anchor.
  const t24 = (t: string) => {
    const m = String(t ?? '').match(/(\d{1,2}):(\d{2})/); if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    const w = String(t ?? '').toLowerCase();
    return w.includes('morning') ? '09:00' : w.includes('lunch') ? '12:30' : w.includes('afternoon') ? '14:30' : w.includes('evening') || w.includes('dinner') ? '19:00' : '10:00';
  };
  const days = pDays.map((d: any, i: number) => {
    const date = new Date(s); date.setDate(date.getDate() + i);
    return {
      dayNumber: d.dayNumber ?? i + 1, date: iso(date), title: d.theme || `Day ${i + 1}`, theme: d.theme,
      activities: (d.activities ?? []).filter((a: any) => !a.isOption).map((a: any, j: number) => ({
        id: `manual-${i + 1}-${j}`, title: a.name, name: a.name, category: a.category || 'activity',
        description: a.notes || '', startTime: t24(a.time), time: t24(a.time),
        location: a.location ? { name: a.location } : undefined, source: 'manual_paste',
      })),
    };
  });
  const e = new Date(s); e.setDate(e.getDate() + pDays.length - 1);
  const anchors = days.flatMap((d: any) => d.activities.map((a: any) => ({
    dayNumber: d.dayNumber, title: a.title, startTime: a.startTime, category: a.category,
    venueName: a.location?.name, lockedSource: `manual_paste:${a.title}`, source: 'manual_paste', raw: a.title,
  })));
  const { data: trip, error: terr } = await sb.from('trips').insert({
    user_id: userId, name: 'QA Modes — Manual Seville', destination: 'Seville, Spain',
    start_date: iso(s), end_date: iso(e), travelers: 1, trip_type: 'leisure', budget_tier: 'moderate',
    status: 'draft', creation_source: 'manual_paste', is_multi_city: false,
    itinerary_data: { days, status: 'ready', savedAt: new Date().toISOString() },
    unlocked_day_count: days.length,
    metadata: { source: 'manual_paste', currency: 'EUR', userAnchors: anchors, lastUpdated: new Date().toISOString() },
  }).select('id').single();
  if (terr || !trip) { check('M4', false, `trip insert: ${terr?.message}`); return; }
  console.log(`  trip ${trip.id}`);
  const before = await readTrip(trip.id);
  const bDays = before?.itinerary_data?.days ?? [];
  check('M4', bDays.length === 3 && bDays.every((d: any) => (d.activities ?? []).length > 0), `manual trip renders (${bDays.length} days, all non-empty)`);

  // Smart Finish — separate credit action + enrich-manual-trip.
  const { data: sf, error: sferr } = await sb.functions.invoke('spend-credits', {
    body: { action: 'smart_finish', tripId: trip.id, creditsAmount: 50, metadata: { idempotencyKey: crypto.randomUUID() } },
  });
  check('M4', !sferr && !(sf as any)?.error, `spend smart_finish ${sferr ? 'ERROR ' + sferr.message : 'ok'}`);
  const { data: enr, error: eerr } = await sb.functions.invoke('enrich-manual-trip', {
    body: { tripId: trip.id, itinerary: { days, destination: 'Seville, Spain' } },
  });
  check('M4', !eerr && !(enr as any)?.error, `enrich-manual-trip ${eerr ? 'ERROR ' + eerr.message : 'ok'}`);
  // Smart Finish is ASYNC full generation (V2 chain) — the function returns
  // immediately, wipes itinerary_data, and regenerates with the user's
  // research as hard anchors. Poll to terminal like any generation.
  const sfStatus = await pollReady(trip.id, 'smart-finish');
  console.log(`  smart-finish terminal: ${sfStatus}; settling ${SETTLE_S}s…`);
  await sleep(SETTLE_S);
  const after = await readTrip(trip.id);
  const aDays = after?.itinerary_data?.days ?? [];
  const blob = JSON.stringify(aDays);
  check('M4', after.itinerary_status === 'ready', `post-Smart-Finish status=${after.itinerary_status}`);
  check('M4', aDays.length === 3, `3 days post-enrich (${aDays.length})`);
  // The enrich prompt promises: "Keep all user-provided anchors."
  const anchorsKept = ['Las Teresas', 'Alcázar', 'Casa del Flamenco'].filter((t) => blob.includes(t));
  check('M4', anchorsKept.length === 3, `user anchors preserved (${anchorsKept.length}/3: ${anchorsKept.join(', ')})`);
  const leak = /research context|content note|verified venue list|do not invent|source_notes|as an ai\b/i.test(blob);
  check('M4', !leak, `no prompt-scaffolding leak post-enrich`);
  reportIssues('M4', auditTripRow(after, { city: 'Seville', expectedDays: 3 }));
}

if (import.meta.main) {
  const mode = arg('mode');
  if (mode === 'multicity') await modeMulticity();
  else if (mode === 'journey') await modeJourney();
  else if (mode === 'chat') await modeChat();
  else if (mode === 'manual') await modeManual();
  else if (mode === 'all') { await modeManual(); await modeChat(); await modeMulticity(); await modeJourney(); }
  else { console.error('usage: --mode multicity|journey|chat|manual|all'); Deno.exit(2); }
  console.log(`\n══ MODES (${mode}): ${failures === 0 ? 'PASS' : `FAIL (${failures} failed checks)`} ══`);
  Deno.exit(failures === 0 ? 0 : 1);
}
