/**
 * qa/harness/soak.ts — fire N trips through the SAME path the wizard uses
 * (createTrip insert → spend-credits → generate-trip), poll to terminal,
 * settle, then judge each with audit.ts. Stops on first FAIL by default
 * (the owner's streak rule: any fail resets the count).
 *
 * Env (never committed — set in shell or qa/harness/.env):
 *   SUPABASE_URL        https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY   anon key (for sign-in)
 *   VOYANCE_EMAIL       test account email
 *   VOYANCE_PASSWORD    test account password
 *
 * Usage:
 *   deno run -A soak.ts                  # full default matrix (20)
 *   deno run -A soak.ts --count 2        # first N of the matrix
 *   deno run -A soak.ts --city "Athens, Greece" --days 5   # single targeted trip
 *   deno run -A soak.ts --no-stop        # keep going past failures (report all)
 */
import { auditTripRow, type AuditIssue } from './audit.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// 20-city default matrix: catalog-rich, thin-catalog, CJK, accented-Latin; 3–7 days.
const MATRIX: Array<{ city: string; days: number }> = [
  { city: 'Athens, Greece', days: 5 },        // thin-day repeat offender
  { city: 'Reykjavik, Iceland', days: 6 },    // thin catalog
  { city: 'Osaka, Japan', days: 5 },          // CJK
  { city: 'Porto, Portugal', days: 4 },       // accents
  { city: 'Krakow, Poland', days: 4 },
  { city: 'Seville, Spain', days: 5 },
  { city: 'Hanoi, Vietnam', days: 5 },
  { city: 'Copenhagen, Denmark', days: 4 },
  { city: 'Dubrovnik, Croatia', days: 4 },
  { city: 'Naples, Italy', days: 5 },
  { city: 'Taipei, Taiwan', days: 5 },        // CJK
  { city: 'Edinburgh, Scotland', days: 4 },
  { city: 'Cusco, Peru', days: 5 },           // thin catalog
  { city: 'Fes, Morocco', days: 4 },          // thin catalog
  { city: 'Munich, Germany', days: 4 },
  { city: 'Valencia, Spain', days: 4 },
  { city: 'Kyiv, Ukraine', days: 4 },         // thin catalog
  { city: 'Bangkok, Thailand', days: 6 },
  { city: 'Quebec City, Canada', days: 4 },
  { city: 'Tbilisi, Georgia', days: 5 },      // thin catalog
];

const POLL_S = 15, POLL_MAX = 60, SETTLE_S = 90;

function arg(name: string): string | undefined {
  const i = Deno.args.indexOf(`--${name}`);
  return i >= 0 ? Deno.args[i + 1] : undefined;
}
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const iso = (d: Date) => d.toISOString().slice(0, 10);

if (import.meta.main) {
  const URL_ = Deno.env.get('SUPABASE_URL'), ANON = Deno.env.get('SUPABASE_ANON_KEY');
  const EMAIL = Deno.env.get('VOYANCE_EMAIL'), PASS = Deno.env.get('VOYANCE_PASSWORD');
  if (!URL_ || !ANON || !EMAIL || !PASS) { console.error('need SUPABASE_URL, SUPABASE_ANON_KEY, VOYANCE_EMAIL, VOYANCE_PASSWORD'); Deno.exit(2); }
  const sb = createClient(URL_, ANON);
  const { data: auth, error: aerr } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASS });
  if (aerr || !auth.user) { console.error('sign-in failed:', aerr?.message); Deno.exit(2); }
  console.log(`signed in as ${auth.user.email}`);

  const single = arg('city');
  const plan = single
    ? [{ city: single, days: Number(arg('days') ?? 4) }]
    : MATRIX.slice(0, Number(arg('count') ?? MATRIX.length));
  const stopOnFail = !Deno.args.includes('--no-stop');

  const results: Array<{ city: string; days: number; tripId: string; pass: boolean; issues: AuditIssue[] }> = [];
  let streak = 0;

  for (const [n, t] of plan.entries()) {
    console.log(`\n── [${n + 1}/${plan.length}] ${t.city} ${t.days}d ──`);
    // dates: ~2 weeks out, length = days
    const s = new Date(); s.setDate(s.getDate() + 14);
    const e = new Date(s); e.setDate(e.getDate() + t.days - 1);

    // 1) createTrip — same columns the wizard inserts
    const { data: trip, error: terr } = await sb.from('trips').insert({
      user_id: auth.user.id,
      name: `QA Soak — ${t.city.split(',')[0]}`,
      destination: t.city,
      start_date: iso(s), end_date: iso(e),
      travelers: 1, trip_type: 'vacation', budget_tier: 'moderate',
    }).select('id').single();
    if (terr || !trip) { console.error('  trip insert failed:', terr?.message); Deno.exit(2); }
    const tripId = trip.id as string;
    console.log(`  trip ${tripId}`);

    // 2) spend-credits — same gate the wizard runs (charges days*60)
    const credits = t.days * 60;
    const { data: sc, error: scerr } = await sb.functions.invoke('spend-credits', {
      body: {
        action: 'trip_generation', tripId, creditsAmount: credits,
        metadata: { days: t.days, cities: 1, complexity: 'standard', multiplier: 1, idempotencyKey: crypto.randomUUID(), defensiveRefundKey: crypto.randomUUID() },
      },
    });
    if (scerr || sc?.error) { console.error('  spend-credits failed:', scerr?.message ?? sc?.error, '(top up credits?)'); Deno.exit(2); }
    console.log(`  charged ${credits} credits`);

    // 3) generate-trip — same kickoff body the wizard sends
    const { error: gerr } = await sb.functions.invoke('generate-itinerary', {
      body: {
        action: 'generate-trip', tripId,
        destination: t.city, destinationCountry: t.city.split(',').pop()?.trim() ?? '',
        startDate: iso(s), endDate: iso(e),
        travelers: 1, tripType: 'vacation', budgetTier: 'moderate',
        userId: auth.user.id, isMultiCity: false, creditsCharged: credits,
        requestedDays: t.days, isFirstTrip: false, mustDoActivities: '', perDayActivities: [],
      },
    });
    if (gerr) console.warn('  kickoff returned error (may still run):', gerr.message);

    // 4) poll → settle → audit
    let status = '';
    for (let i = 0; i < POLL_MAX; i++) {
      await sleep(POLL_S);
      const { data: row } = await sb.from('trips').select('itinerary_status').eq('id', tripId).single();
      status = String(row?.itinerary_status ?? '');
      if (i % 4 === 3) console.log(`  [${(i + 1) * POLL_S}s] ${status}`);
      if (['ready', 'partial', 'failed'].includes(status)) break;
    }
    console.log(`  terminal: ${status}; settling ${SETTLE_S}s…`);
    await sleep(SETTLE_S);

    const { data: full } = await sb.from('trips').select('itinerary_status, itinerary_data, metadata, destination').eq('id', tripId).single();
    const issues = auditTripRow(full, { city: t.city.split(',')[0], expectedDays: t.days });
    const pass = issues.length === 0;
    results.push({ city: t.city, days: t.days, tripId, pass, issues });
    if (pass) { streak++; console.log(`  ✅ PASS  (streak ${streak})`); }
    else {
      streak = 0;
      console.log(`  ❌ FAIL  (${issues.length}):`);
      for (const i of issues) console.log(`     ${i.gate}${i.day != null ? ` D${i.day}` : ''}: ${i.detail}`);
      if (stopOnFail) break;
    }
  }

  console.log('\n══ SUMMARY ══');
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.city} ${r.days}d  ${r.tripId}${r.pass ? '' : `  [${r.issues.map((i) => i.gate).join(', ')}]`}`);
  console.log(`clean streak: ${streak}/${plan.length}`);
  Deno.exit(results.every((r) => r.pass) ? 0 : 1);
}
