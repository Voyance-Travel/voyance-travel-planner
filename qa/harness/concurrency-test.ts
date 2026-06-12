/**
 * qa/harness/concurrency-test.ts — simultaneous generation load.
 *
 * Every prior run (both QA eras) generated trips SEQUENTIALLY. The known
 * parallel-race class (per-day read-modify-write) is mitigated by merge_trip_day
 * + authoritative finalize, but real simultaneous load — N trips' day-chains
 * interleaving on shared infra — was never exercised. This fires N full
 * wizard-path generations at the same instant and audits every one.
 *
 * Usage: deno run --no-lock -A concurrency-test.ts [--n 5]
 */
import { auditTripRow } from './audit.ts';
import { supabase as sb } from './sb-shim.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const arg = (n: string) => { const i = Deno.args.indexOf(`--${n}`); return i >= 0 ? Deno.args[i + 1] : undefined; };
const userId = (await sb.auth.getUser()).data.user!.id;

const CITIES: Array<[string, string]> = [
  ['Valencia', 'Spain'], ['Porto', 'Portugal'], ['Krakow', 'Poland'],
  ['Copenhagen', 'Denmark'], ['Dubrovnik', 'Croatia'], ['Edinburgh', 'Scotland'],
];
const N = Math.min(Number(arg('n') ?? 5), CITIES.length);
const DAYS = 4;

async function launch(city: string, country: string): Promise<{ city: string; tripId: string }> {
  const s = new Date(); s.setDate(s.getDate() + 80);
  const e = new Date(s); e.setDate(e.getDate() + DAYS - 1);
  const { data: trip, error: terr } = await sb.from('trips').insert({
    user_id: userId, name: `QA Concurrency — ${city}`, destination: `${city}, ${country}`,
    start_date: iso(s), end_date: iso(e), travelers: 1, trip_type: 'vacation', budget_tier: 'moderate',
  }).select('id').single();
  if (terr || !trip) throw new Error(`${city} insert: ${terr?.message}`);
  const credits = Math.ceil((DAYS * 60 * 1.15) / 10) * 10; // QA profile is custom-tier (DNA seeded)
  const { data: sp, error: sperr } = await sb.functions.invoke('spend-credits', {
    body: { action: 'trip_generation', tripId: trip.id, creditsAmount: credits, metadata: { days: DAYS, cities: 1, complexity: 'custom', multiplier: 1.15, idempotencyKey: crypto.randomUUID(), defensiveRefundKey: crypto.randomUUID() } },
  });
  if (sperr || (sp as any)?.error) throw new Error(`${city} spend: ${sperr?.message ?? JSON.stringify((sp as any)?.error)}`);
  const session = (await sb.auth.getSession()).data.session!;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const kr = await fetch(`${URL_}/functions/v1/generate-itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': ANON },
      body: JSON.stringify({
        action: 'generate-trip', tripId: trip.id, userId,
        destination: `${city}, ${country}`, destinationCountry: country,
        startDate: iso(s), endDate: iso(e), travelers: 1, tripType: 'vacation', budgetTier: 'moderate',
        isMultiCity: false, creditsCharged: credits, requestedDays: DAYS, isFirstTrip: false,
        mustDoActivities: '', perDayActivities: [],
      }),
    });
    if (kr.ok) { await kr.text().catch(() => null); break; }
    console.warn(`  ${city} kickoff attempt ${attempt}: HTTP ${kr.status}`);
    if (attempt === 1) await sleep(20);
  }
  console.log(`  launched ${city} (${trip.id})`);
  return { city, tripId: trip.id };
}

console.log(`── LAUNCHING ${N} GENERATIONS SIMULTANEOUSLY`);
const launched = await Promise.all(CITIES.slice(0, N).map(([c, k]) => launch(c, k)));

console.log('── POLLING ALL TO TERMINAL');
const deadline = Date.now() + 25 * 60 * 1000;
let statuses: Record<string, string> = {};
while (Date.now() < deadline) {
  await sleep(20);
  const { data } = await sb.from('trips').select('id, itinerary_status').in('id', launched.map((l) => l.tripId));
  statuses = Object.fromEntries((data ?? []).map((r: any) => [r.id, r.itinerary_status]));
  const vals = launched.map((l) => statuses[l.tripId] ?? '?');
  if (vals.every((v) => ['ready', 'partial', 'failed'].includes(v))) break;
}
console.log('  terminal:', launched.map((l) => `${l.city}=${statuses[l.tripId]}`).join(' '));
console.log('  settling 300s…');
await sleep(300);

console.log('── AUDITING ALL');
let failures = 0;
for (const l of launched) {
  const { data: row } = await sb.from('trips').select('itinerary_status, itinerary_data, metadata, destination').eq('id', l.tripId).single();
  const issues = auditTripRow(row, { city: l.city, expectedDays: DAYS });
  const ok = (row as any).itinerary_status === 'ready' && issues.length === 0;
  if (!ok) failures++;
  console.log(`  ${ok ? '✅' : '❌'} ${l.city}: status=${(row as any).itinerary_status}, audit=${issues.length} issues`);
  for (const i of issues) console.log(`     ${i.gate}${i.day != null ? ` D${i.day}` : ''}: ${i.detail}`);
}
console.log(`\n══ CONCURRENCY (${N} simultaneous): ${failures === 0 ? 'PASS' : `FAIL (${failures}/${N} trips)`} ══`);
Deno.exit(failures === 0 ? 0 : 1);
