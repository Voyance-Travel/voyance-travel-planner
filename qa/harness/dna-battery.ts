/**
 * qa/harness/dna-battery.ts — DNA depth battery (4 trips, sequential).
 *
 *   T1  cultural_anthropologist + relaxed + vegan — Bologna 4d   (baseline)
 *   T2  urban_nomad + packed + vegan — Bologna 4d                (archetype/pace contrast)
 *   T3  cultural_anthropologist + halal + avoid nightlife — Munich 4d (constraint stress:
 *       halal + no-alcohol in beer country; also probes the nightcap injector vs avoid)
 *   T4  repeat of T1 — Bologna 4d                                 (stability)
 *
 * Verdicts:
 *   B1  all four pass the 12-gate audit under their constraints
 *   B2  pacing: relaxed (T1) has measurably lighter days than packed (T2)
 *   B3  archetype differentiation: T1 vs T2 activity overlap LOW (<50%)
 *   B4  dietary: vegan trips carry no meat-flagships; halal trip carries no
 *       pork/alcohol-flagship dining
 *   B5  avoid-categories: T3 has no nightcap/bar/nightlife cards
 *   B6  stability: T4 keeps T1's dietary + pacing adherence (overlap reported)
 *
 * Leaves the QA profile as anthropologist/relaxed/vegan (the documented state).
 */
import { auditTripRow } from './audit.ts';
import { supabase as sb } from './sb-shim.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const userId = (await sb.auth.getUser()).data.user!.id;

let failures = 0;
const check = (step: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? '✅' : '❌'} ${step}: ${detail}`);
  if (!ok) failures++;
};

async function setProfile(archetype: string, pace: string, dietary: string[], avoid: string[]) {
  const { data: dnaRow } = await sb.from('travel_dna_profiles').select('id').eq('user_id', userId).maybeSingle();
  await sb.from('travel_dna_profiles').update({
    primary_archetype_name: archetype, dna_confidence_score: 90,
    summary: `QA battery profile: ${archetype}, ${pace}, ${dietary.join('/') || 'no dietary'}.`,
    calculated_at: new Date().toISOString(),
  }).eq('id', dnaRow!.id);
  const { data: prefRow } = await sb.from('user_preferences').select('id').eq('user_id', userId).maybeSingle();
  await sb.from('user_preferences').update({
    dietary_restrictions: dietary, travel_pace: pace, avoid_categories: avoid,
    interests: ['food', 'history', 'architecture'],
  }).eq('id', prefRow!.id);
}

async function generate(name: string, city: string, country: string, days: number, meta: Record<string, unknown>): Promise<any> {
  const s = new Date(); s.setDate(s.getDate() + 70);
  const e = new Date(s); e.setDate(e.getDate() + days - 1);
  const { data: trip, error: terr } = await sb.from('trips').insert({
    user_id: userId, name, destination: `${city}, ${country}`,
    start_date: iso(s), end_date: iso(e), travelers: 1, trip_type: 'vacation', budget_tier: 'moderate',
    metadata: meta,
  }).select('id').single();
  if (terr || !trip) throw new Error(`trip insert: ${terr?.message}`);
  console.log(`  trip ${trip.id}`);
  try { await sb.functions.invoke('suggest-landmarks', { body: { city, country } }); } catch { /* non-blocking */ }
  const credits = Math.ceil((days * 60 * 1.15) / 10) * 10;
  const { data: sp, error: sperr } = await sb.functions.invoke('spend-credits', {
    body: { action: 'trip_generation', tripId: trip.id, creditsAmount: credits, metadata: { days, cities: 1, complexity: 'custom', multiplier: 1.15, idempotencyKey: crypto.randomUUID(), defensiveRefundKey: crypto.randomUUID() } },
  });
  if (sperr || (sp as any)?.error) throw new Error(`spend: ${sperr?.message ?? JSON.stringify((sp as any)?.error)}`);
  const session = (await sb.auth.getSession()).data.session!;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const kr = await fetch(`${URL_}/functions/v1/generate-itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': ANON },
      body: JSON.stringify({
        action: 'generate-trip', tripId: trip.id, userId,
        destination: `${city}, ${country}`, destinationCountry: country,
        startDate: iso(s), endDate: iso(e), travelers: 1, tripType: 'vacation', budgetTier: 'moderate',
        isMultiCity: false, creditsCharged: credits, requestedDays: days, isFirstTrip: false,
        mustDoActivities: '', perDayActivities: [],
      }),
    });
    if (kr.ok) { await kr.text().catch(() => null); break; }
    console.warn(`  kickoff attempt ${attempt}: ${kr.status}`);
    if (attempt === 1) await sleep(20);
  }
  let status = '';
  for (let i = 0; i < 60; i++) {
    await sleep(15);
    const { data } = await sb.from('trips').select('itinerary_status').eq('id', trip.id).single();
    status = String(data?.itinerary_status ?? '');
    if (['ready', 'partial', 'failed'].includes(status)) break;
  }
  console.log(`  terminal: ${status}; settling 300s…`);
  await sleep(300);
  const { data: row } = await sb.from('trips').select('itinerary_status, itinerary_data, metadata, destination').eq('id', trip.id).single();
  return { id: trip.id, row };
}

// ── metric helpers ──────────────────────────────────────────────────────────
const lc = (s: unknown) => String(s ?? '').toLowerCase();
const isLog = (a: any) => ['transport', 'transportation', 'transit', 'flight', 'accommodation', 'logistics'].includes(lc(a?.category)) || /check.?in|check.?out|transfer|airport|\bflight\b|return to|travel to|\bdepart/i.test(lc(a?.title));
const isMeal = (a: any) => ['breakfast', 'lunch', 'dinner', 'dining', 'restaurant'].includes(lc(a?.category)) || /\b(breakfast|brunch|lunch|dinner)\b/i.test(lc(a?.title));
const pMin = (s: unknown) => { const m = String(s ?? '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
function pacing(row: any) {
  const days = row?.itinerary_data?.days ?? [];
  const mids = days.filter((d: any) => d.dayNumber > 1 && d.dayNumber < days.length);
  const realPerDay = mids.map((d: any) => (d.activities ?? []).filter((a: any) => !isLog(a) && !isMeal(a)).length);
  const firstStarts = mids.map((d: any) => Math.min(...(d.activities ?? []).map((a: any) => pMin(a.startTime || a.time) ?? 1440)));
  return {
    avgReal: realPerDay.length ? +(realPerDay.reduce((a: number, b: number) => a + b, 0) / realPerDay.length).toFixed(1) : 0,
    avgFirstStart: firstStarts.length ? Math.round(firstStarts.reduce((a: number, b: number) => a + b, 0) / firstStarts.length) : 0,
    totalCards: days.reduce((n: number, d: any) => n + (d.activities ?? []).length, 0),
  };
}
const core = (t: string) => lc(t).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
  .filter((w) => w.length >= 4 && !['visit', 'explore', 'tour', 'walk', 'evening', 'morning', 'afternoon', 'bologna', 'munich', 'with', 'your', 'hotel', 'return', 'travel', 'check'].includes(w))
  .sort().join(' ');
const titleSet = (row: any) => new Set<string>(((row?.itinerary_data?.days ?? []) as any[]).flatMap((d: any) => (d.activities ?? [])
  .filter((a: any) => !isLog(a) && !isMeal(a)).map((a: any) => core(a?.title ?? '')).filter((s: string) => s.length >= 4)));
const overlapPct = (a: Set<string>, b: Set<string>) => a.size ? Math.round(([...a].filter((t) => b.has(t)).length / a.size) * 100) : 0;
const diningBlob = (row: any) => ((row?.itinerary_data?.days ?? []) as any[]).flatMap((d: any) => (d.activities ?? []).filter(isMeal))
  .map((a: any) => `${a.title} ${a.description ?? ''}`).join(' | ');

// ── run ─────────────────────────────────────────────────────────────────────
console.log('── T1 cultural_anthropologist · relaxed · vegan — Bologna 4d');
await setProfile('cultural_anthropologist', 'relaxed', ['vegan'], []);
const t1 = await generate('QA Battery T1 — Bologna anthro', 'Bologna', 'Italy', 4,
  { dietaryRestrictions: ['vegan'], interestCategories: ['food', 'history'], additionalNotes: 'Slow mornings, plant-based only.' });

console.log('── T2 urban_nomad · packed · vegan — Bologna 4d');
await setProfile('urban_nomad', 'packed', ['vegan'], []);
const t2 = await generate('QA Battery T2 — Bologna nomad', 'Bologna', 'Italy', 4,
  { dietaryRestrictions: ['vegan'], interestCategories: ['nightlife', 'street culture'], additionalNotes: 'Pack the days, plant-based only.' });

console.log('── T3 cultural_anthropologist · halal · avoid nightlife — Munich 4d');
await setProfile('cultural_anthropologist', 'moderate', ['halal'], ['nightlife', 'bars']);
const t3 = await generate('QA Battery T3 — Munich halal', 'Munich', 'Germany', 4,
  { dietaryRestrictions: ['halal'], interestCategories: ['history', 'architecture'], additionalNotes: 'Halal food only, no alcohol venues, no nightlife.' });

console.log('── T4 repeat of T1 (stability) — Bologna 4d');
await setProfile('cultural_anthropologist', 'relaxed', ['vegan'], []);
const t4 = await generate('QA Battery T4 — Bologna anthro repeat', 'Bologna', 'Italy', 4,
  { dietaryRestrictions: ['vegan'], interestCategories: ['food', 'history'], additionalNotes: 'Slow mornings, plant-based only.' });

// ── verdicts ────────────────────────────────────────────────────────────────
console.log('\n── B1 GATES UNDER CONSTRAINTS');
for (const [label, t, city, days] of [['T1', t1, 'Bologna', 4], ['T2', t2, 'Bologna', 4], ['T3', t3, 'Munich', 4], ['T4', t4, 'Bologna', 4]] as const) {
  const issues = auditTripRow((t as any).row, { city, expectedDays: days });
  for (const i of issues) console.log(`     ${label} ${i.gate}${i.day != null ? ` D${i.day}` : ''}: ${i.detail}`);
  check('B1', (t as any).row.itinerary_status === 'ready' && issues.length === 0, `${label} ready + audit (${issues.length} issues)`);
}

console.log('── B2 PACING (relaxed T1 vs packed T2)');
const p1 = pacing(t1.row), p2 = pacing(t2.row);
console.log(`  T1 relaxed: avg ${p1.avgReal} real/mid-day, first start ~${Math.floor(p1.avgFirstStart / 60)}:${String(p1.avgFirstStart % 60).padStart(2, '0')}, ${p1.totalCards} cards`);
console.log(`  T2 packed:  avg ${p2.avgReal} real/mid-day, first start ~${Math.floor(p2.avgFirstStart / 60)}:${String(p2.avgFirstStart % 60).padStart(2, '0')}, ${p2.totalCards} cards`);
check('B2', p2.avgReal > p1.avgReal || p2.totalCards > p1.totalCards, `packed denser than relaxed (real/day ${p2.avgReal} vs ${p1.avgReal}; cards ${p2.totalCards} vs ${p1.totalCards})`);

console.log('── B3 ARCHETYPE DIFFERENTIATION (T1 vs T2, same city, same diet)');
const o12 = overlapPct(titleSet(t1.row), titleSet(t2.row));
check('B3', o12 < 50, `activity overlap ${o12}% (want <50%)`);

console.log('── B4 DIETARY');
// 'bolognese' alone is a CUISINE adjective in Bologna ("vegan versions of
// Bolognese classics") — battery run 1 false-flagged 3 vegan-positive cards
// on it. Match explicit meat dishes instead; 'tortellini in brodo' added
// (meat-filled pasta in meat broth — the one genuine miss of run 1).
const VEGAN_CONFLICT = /\bmortadella\b|prosciutto|tagliatelle al rag[uù]|rag[uù] alla bolognese|tortellini in brodo|salumeria|steakhouse|\btartare\b|porchetta/i;
const HALAL_CONFLICT = /schweinshaxe|pork knuckle|bratwurst|schnitzel.{0,20}pork|beer hall|brauhaus|biergarten|wei[sß]wurst|schweins|hofbr[äa]u/i;
for (const [label, t, re] of [['T1 vegan', t1, VEGAN_CONFLICT], ['T2 vegan', t2, VEGAN_CONFLICT], ['T4 vegan', t4, VEGAN_CONFLICT], ['T3 halal/alcohol', t3, HALAL_CONFLICT]] as const) {
  const blob = diningBlob((t as any).row);
  const hits = blob.match(re as RegExp) || [];
  check('B4', hits.length === 0, `${label}: ${hits.length === 0 ? 'no conflict venues' : 'CONFLICTS: ' + hits.slice(0, 3).join(', ')}`);
}

console.log('── B5 AVOID-CATEGORIES (T3: no nightlife/nightcap/bar cards)');
const t3cards = ((t3.row as any)?.itinerary_data?.days ?? []).flatMap((d: any) => (d.activities ?? []));
const nightlife = t3cards.filter((a: any) => /night ?cap|night ?life|\bbar\b|cocktail|\bpub\b|brewery|beer/i.test(`${a?.title ?? ''}`));
for (const n of nightlife) console.log(`     nightlife card: "${n.title}"`);
check('B5', nightlife.length === 0, `${nightlife.length} nightlife/alcohol cards on an avoid-nightlife halal profile`);

console.log('── B6 STABILITY (T4 repeats T1 config)');
const p4 = pacing(t4.row);
const o14 = overlapPct(titleSet(t1.row), titleSet(t4.row));
console.log(`  T4: avg ${p4.avgReal} real/mid-day; overlap with T1: ${o14}% (same profile — moderate overlap expected, reported not gated)`);
check('B6', Math.abs(p4.avgReal - p1.avgReal) <= 2, `pacing stable across runs (|${p4.avgReal} - ${p1.avgReal}| <= 2)`);

console.log(`\n══ DNA BATTERY: ${failures === 0 ? 'PASS' : `FAIL (${failures} failed checks)`} ══`);
console.log(`trips: T1=${t1.id} T2=${t2.id} T3=${t3.id} T4=${t4.id}`);
Deno.exit(failures === 0 ? 0 : 1);
