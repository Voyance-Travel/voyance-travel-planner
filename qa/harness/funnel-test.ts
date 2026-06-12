/**
 * qa/harness/funnel-test.ts — free-first-trip funnel (run after the owner
 * resets profiles.first_trip_used=false on the QA account).
 *
 * F1  flag is false pre-test
 * F2  first trip generates FREE: no spend-credits call, kickoff without
 *     creditsCharged authorized via the flag (the post-migration-drift fix)
 * F3  zero trip_generation charge in the ledger for that trip; day count
 *     reported (first-trip preview is expected to be 2 of N days)
 * F4  flag flips to true only after generation completes
 * F5  a SECOND uncharged kickoff is rejected (GENERATION_NOT_AUTHORIZED)
 *
 * Usage: deno run --no-lock -A funnel-test.ts
 */
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
const flag = async () => (await sb.from('profiles').select('first_trip_used').eq('id', userId).single()).data?.first_trip_used;
const kickoff = async (body: Record<string, unknown>) => {
  const session = (await sb.auth.getSession()).data.session!;
  const r = await fetch(`${URL_}/functions/v1/generate-itinerary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': ANON },
    body: JSON.stringify({ action: 'generate-trip', userId, ...body }),
  });
  return { status: r.status, text: (await r.text()).slice(0, 250) };
};

console.log('── F1 FLAG PRE-CHECK');
const f0 = await flag();
check('F1', f0 === false, `first_trip_used=${f0} (want false — owner reset)`);
if (f0 !== false) Deno.exit(2);

console.log('── F2 FREE FIRST TRIP (no spend, no creditsCharged)');
const s = new Date(); s.setDate(s.getDate() + 45);
const e = new Date(s); e.setDate(e.getDate() + 3);
const { data: trip, error: terr } = await sb.from('trips').insert({
  user_id: userId, name: 'QA Funnel — Marrakech', destination: 'Marrakech, Morocco',
  start_date: iso(s), end_date: iso(e), travelers: 1, trip_type: 'vacation', budget_tier: 'moderate',
}).select('id').single();
if (terr || !trip) { check('F2', false, `trip insert: ${terr?.message}`); Deno.exit(1); }
console.log(`  trip ${trip.id}`);
try { await sb.functions.invoke('suggest-landmarks', { body: { city: 'Marrakech', country: 'Morocco' } }); } catch { /* non-blocking */ }
const k1 = await kickoff({
  tripId: trip.id, destination: 'Marrakech, Morocco', destinationCountry: 'Morocco',
  startDate: iso(s), endDate: iso(e), travelers: 1, tripType: 'vacation', budgetTier: 'moderate',
  isMultiCity: false, requestedDays: 4, isFirstTrip: true, mustDoActivities: '', perDayActivities: [],
  // deliberately NO creditsCharged and NO prior spend-credits call
});
check('F2', k1.status === 200 || k1.status === 202, `uncharged kickoff HTTP ${k1.status}${k1.status >= 400 ? ' — ' + k1.text : ''}`);
let status = '';
for (let i = 0; i < 60; i++) {
  await sleep(15);
  const { data } = await sb.from('trips').select('itinerary_status').eq('id', trip.id).single();
  status = String(data?.itinerary_status ?? '');
  if (i % 8 === 7) console.log(`  [${(i + 1) * 15}s] ${status}`);
  if (['ready', 'partial', 'failed'].includes(status)) break;
}
console.log(`  terminal: ${status}; settling 120s…`);
await sleep(120);

console.log('── F3 NO CHARGE + PREVIEW SHAPE');
const { data: ledger } = await sb.from('credit_ledger')
  .select('action_type, credits_delta').eq('trip_id', trip.id).eq('transaction_type', 'spend');
const spends = (ledger ?? []).filter((r: any) => Number(r.credits_delta) < 0);
check('F3', spends.length === 0, `trip_generation charges for this trip: ${spends.length} (${JSON.stringify(spends)})`);
const { data: row } = await sb.from('trips').select('itinerary_status, itinerary_data, unlocked_day_count, metadata').eq('id', trip.id).single();
const days = (row as any)?.itinerary_data?.days ?? [];
const nonEmpty = days.filter((d: any) => Array.isArray(d?.activities) && d.activities.length > 0).length;
console.log(`  status=${(row as any)?.itinerary_status} days=${days.length} nonEmpty=${nonEmpty} unlocked_day_count=${(row as any)?.unlocked_day_count}`);
check('F3', nonEmpty >= 2, `at least the 2-day preview generated (${nonEmpty} non-empty days)`);

console.log('── F4 FLAG CONSUMPTION');
const f1 = await flag();
check('F4', f1 === true, `first_trip_used=${f1} after completion (want true)`);

console.log('── F5 SECOND UNCHARGED KICKOFF REJECTED');
const s2 = new Date(); s2.setDate(s2.getDate() + 52);
const e2 = new Date(s2); e2.setDate(e2.getDate() + 3);
const { data: trip2 } = await sb.from('trips').insert({
  user_id: userId, name: 'QA Funnel — Second Trip', destination: 'Fes, Morocco',
  start_date: iso(s2), end_date: iso(e2), travelers: 1, trip_type: 'vacation', budget_tier: 'moderate',
}).select('id').single();
const k2 = await kickoff({
  tripId: trip2!.id, destination: 'Fes, Morocco', destinationCountry: 'Morocco',
  startDate: iso(s2), endDate: iso(e2), travelers: 1, tripType: 'vacation', budgetTier: 'moderate',
  isMultiCity: false, requestedDays: 4, isFirstTrip: false, mustDoActivities: '', perDayActivities: [],
});
check('F5', k2.status === 402 || k2.status === 403, `uncharged second kickoff HTTP ${k2.status} (want 402/403) — ${k2.text.slice(0, 120)}`);
// hygiene: make sure the rejected trip didn't start generating anyway
await sleep(10);
const { data: t2 } = await sb.from('trips').select('itinerary_status').eq('id', trip2!.id).single();
check('F5', !['generating', 'ready', 'partial'].includes(String(t2?.itinerary_status)), `second trip status=${t2?.itinerary_status} (must not generate)`);

console.log(`\n══ FUNNEL TEST: ${failures === 0 ? 'PASS' : `FAIL (${failures} failed checks)`} ══`);
Deno.exit(failures === 0 ? 0 : 1);
