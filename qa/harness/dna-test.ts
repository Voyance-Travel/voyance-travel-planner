/**
 * qa/harness/dna-test.ts — DNA + preferences → itinerary differentiation.
 *
 * The personalization layer has had ZERO coverage: every campaign trip was a
 * blank slate (no archetype, no dietary, standard complexity). This seeds a
 * real Travel-DNA profile + user_preferences for the QA account (the same
 * rows the quiz writes), generates a DNA'd trip, and checks:
 *
 *   D1  seed lands (travel_dna_profiles + user_preferences)
 *   D2  generation under constraints still passes the 12 gates
 *   D3  preferences provably reached generation (archetype/dietary evidence
 *       in metadata.generation_context or the itinerary itself)
 *   D4  dietary adherence signal: no meat-flagship dining cards on a vegan
 *       profile; vegan/plant-based positives counted
 *   D5  differentiation: non-meal venue overlap vs the blank-slate control
 *       trip (run-8 Seville) — identical content = personalization no-op
 *
 * Usage: deno run --no-lock -A dna-test.ts [--control <uuid>]
 */
import { auditTripRow } from './audit.ts';
import { supabase as sb } from './sb-shim.ts';

const arg = (n: string) => { const i = Deno.args.indexOf(`--${n}`); return i >= 0 ? Deno.args[i + 1] : undefined; };
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const userId = (await sb.auth.getUser()).data.user!.id;
const CONTROL = arg('control') ?? '38908f04-b702-4106-934f-6252a9159521'; // run-8 Seville 5d, blank slate

let failures = 0;
const check = (step: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? '✅' : '❌'} ${step}: ${detail}`);
  if (!ok) failures++;
};

console.log('── D1 SEED DNA + PREFERENCES (the rows the quiz writes)');
{
  const { data: existing } = await sb.from('travel_dna_profiles').select('id').eq('user_id', userId).maybeSingle();
  const dnaRow = {
    user_id: userId,
    primary_archetype_name: 'The Cultural Anthropologist',
    dna_confidence_score: 90, // integer column (0–100), not a 0–1 float
    summary: 'QA-seeded: slow-paced cultural traveler, vegan, food+history focused.',
    calculated_at: new Date().toISOString(),
  };
  const dnaRes = existing?.id
    ? await sb.from('travel_dna_profiles').update(dnaRow).eq('id', existing.id)
    : await sb.from('travel_dna_profiles').insert(dnaRow);
  check('D1', !dnaRes.error, `travel_dna_profiles ${dnaRes.error ? 'ERROR ' + dnaRes.error.message : 'ok (archetype: The Cultural Anthropologist)'}`);

  const { data: prefExisting } = await sb.from('user_preferences').select('id').eq('user_id', userId).maybeSingle();
  const prefRow = {
    user_id: userId,
    dietary_restrictions: ['vegan'],
    interests: ['food', 'history', 'architecture'],
    travel_pace: 'relaxed',
    travel_vibes: ['local culture', 'hidden gems'],
    emotional_drivers: ['curiosity'],
    quiz_completed: true,
  };
  const prefRes = prefExisting?.id
    ? await sb.from('user_preferences').update(prefRow).eq('id', prefExisting.id)
    : await sb.from('user_preferences').insert(prefRow);
  check('D1', !prefRes.error, `user_preferences ${prefRes.error ? 'ERROR ' + prefRes.error.message : 'ok (vegan, relaxed, food/history)'}`);
}

console.log('── D2 GENERATE UNDER CONSTRAINTS (Seville 5d, same as control)');
const s = new Date(); s.setDate(s.getDate() + 60);
const e = new Date(s); e.setDate(e.getDate() + 4);
const { data: trip, error: terr } = await sb.from('trips').insert({
  user_id: userId, name: 'QA DNA — Seville', destination: 'Seville, Spain',
  start_date: iso(s), end_date: iso(e), travelers: 1, trip_type: 'vacation', budget_tier: 'moderate',
  metadata: {
    dietaryRestrictions: ['vegan'],
    interestCategories: ['food', 'history'],
    additionalNotes: 'Slow mornings, long lunches, plant-based food only, avoid crowded tourist rushes.',
  },
}).select('id').single();
if (terr || !trip) { check('D2', false, `trip insert: ${terr?.message}`); Deno.exit(1); }
console.log(`  trip ${trip.id}`);
{
  const { data: spendRes, error: sperr } = await sb.functions.invoke('spend-credits', {
    body: {
      action: 'trip_generation', tripId: trip.id, creditsAmount: 350, // 5×60 ×1.15 custom tier, rounded to 10
      metadata: { days: 5, cities: 1, complexity: 'custom', multiplier: 1.15, idempotencyKey: crypto.randomUUID(), defensiveRefundKey: crypto.randomUUID() },
    },
  });
  if (sperr || (spendRes as any)?.error) { check('D2', false, `spend: ${sperr?.message ?? JSON.stringify((spendRes as any)?.error)}`); Deno.exit(1); }
  console.log('  charged 350 (custom-tier 1.15× — DNA adds complexity factors)');
  const session = (await sb.auth.getSession()).data.session!;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const kr = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': Deno.env.get('SUPABASE_ANON_KEY')! },
      body: JSON.stringify({
        action: 'generate-trip', tripId: trip.id, userId,
        destination: 'Seville, Spain', destinationCountry: 'Spain',
        startDate: iso(s), endDate: iso(e), travelers: 1, tripType: 'vacation', budgetTier: 'moderate',
        isMultiCity: false, creditsCharged: 350, requestedDays: 5, isFirstTrip: false,
        mustDoActivities: '', perDayActivities: [],
      }),
    });
    if (kr.ok) { await kr.text().catch(() => null); break; }
    console.warn(`  kickoff attempt ${attempt}: ${kr.status} ${(await kr.text().catch(() => '')).slice(0, 120)}`);
    if (attempt === 1) await sleep(20);
  }
}
let status = '';
for (let i = 0; i < 60; i++) {
  await sleep(15);
  const { data } = await sb.from('trips').select('itinerary_status').eq('id', trip.id).single();
  status = String(data?.itinerary_status ?? '');
  if (i % 8 === 7) console.log(`  [${(i + 1) * 15}s] ${status}`);
  if (['ready', 'partial', 'failed'].includes(status)) break;
}
console.log(`  terminal: ${status}; settling 300s…`);
await sleep(300);
const { data: row } = await sb.from('trips').select('itinerary_status, itinerary_data, metadata, destination').eq('id', trip.id).single();
check('D2', (row as any)?.itinerary_status === 'ready', `status=${(row as any)?.itinerary_status}`);
const issues = auditTripRow(row, { city: 'Seville', expectedDays: 5 });
for (const i of issues) console.log(`     ${i.gate}${i.day != null ? ` D${i.day}` : ''}: ${i.detail}`);
check('D2', issues.length === 0, `12-gate audit under constraints (${issues.length} issues)`);

console.log('── D3 PREFERENCES REACHED GENERATION');
const days = (row as any)?.itinerary_data?.days ?? [];
const blob = JSON.stringify(days).toLowerCase();
const ctx = JSON.stringify((row as any)?.metadata?.generation_context ?? '') .toLowerCase();
const archetypeEvidence = ctx.includes('anthropologist') || blob.includes('anthropologist');
const dietaryEvidence = /vegan|plant[- ]based|vegetarian/.test(ctx) || /vegan|plant[- ]based/.test(blob);
console.log(`  archetype in context/blob: ${archetypeEvidence}; dietary in context/blob: ${dietaryEvidence}`);
check('D3', archetypeEvidence || dietaryEvidence, `at least one preference signal visibly reached generation (archetype=${archetypeEvidence}, dietary=${dietaryEvidence})`);

console.log('── D4 VEGAN ADHERENCE SIGNAL');
const dining = days.flatMap((d: any) => (d.activities ?? []).filter((a: any) =>
  /dining|restaurant|food/.test(String(a?.category ?? '').toLowerCase()) || /\b(breakfast|brunch|lunch|dinner)\b/i.test(String(a?.title ?? ''))));
const MEAT_FLAGSHIP = /\bjam[óo]n\b|ib[ée]rico|steakhouse|\basador\b|marisquer[íi]a|suckling pig|carniceri|oyster bar|\bchuleta\b/i;
const conflicts = dining.filter((a: any) => MEAT_FLAGSHIP.test(`${a?.title ?? ''} ${a?.description ?? ''}`));
const positives = dining.filter((a: any) => /vegan|plant[- ]based|vegetari/i.test(`${a?.title ?? ''} ${a?.description ?? ''}`));
console.log(`  dining cards: ${dining.length}; vegan-positive: ${positives.length}; meat-flagship conflicts: ${conflicts.length}`);
for (const c of conflicts) console.log(`     conflict: "${c.title}"`);
check('D4', conflicts.length === 0, `no meat-flagship dining on a vegan profile (${conflicts.length} conflicts)`);

console.log('── D5 DIFFERENTIATION vs BLANK-SLATE CONTROL');
const { data: ctrl } = await sb.from('trips').select('itinerary_data').eq('id', CONTROL).single();
const core = (t: string) => String(t).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
  .filter((w) => w.length >= 4 && !['visit', 'explore', 'tour', 'walk', 'evening', 'morning', 'afternoon', 'seville', 'with', 'your', 'hotel', 'return', 'travel', 'check'].includes(w))
  .sort().join(' ');
const titles = (j: any) => new Set<string>(((j?.days ?? []) as any[]).flatMap((d: any) => (d.activities ?? [])
  .filter((a: any) => !/transport|transit|accommodation|logistics|dining|restaurant/.test(String(a?.category ?? '').toLowerCase()))
  .map((a: any) => core(a?.title ?? ''))
  .filter((s: string) => s.length >= 4)));
const A = titles((row as any)?.itinerary_data), B = titles((ctrl as any)?.itinerary_data);
const overlap = [...A].filter((t) => B.has(t)).length;
const pct = A.size ? Math.round((overlap / A.size) * 100) : 0;
console.log(`  DNA trip activities: ${A.size}; control: ${B.size}; overlap: ${overlap} (${pct}%)`);
check('D5', pct < 80, `differentiated from blank-slate control (${pct}% overlap; >=80% = personalization no-op)`);

console.log(`\n══ DNA TEST: ${failures === 0 ? 'PASS' : `FAIL (${failures} failed checks)`} ══`);
console.log('note: QA account now carries a seeded DNA profile (vegan / Cultural Anthropologist) — future harness trips will be DNA-influenced.');
Deno.exit(failures === 0 ? 0 : 1);
