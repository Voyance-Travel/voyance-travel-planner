/**
 * qa/harness/unlock-test.ts — day-unlock purchase, client-faithful
 * (mirrors useUnlockDay: spend unlock_day → generate-day → max-based
 * unlocked_day_count bump).
 *
 * U1  paid unlock_day spend lands (-60 committed, balance drops)
 * U2  generate-day for the unlocked day authorized by that charge + returns a day
 * U3  unlocked_day_count bumps (max-based) and the day persists non-empty
 *
 * Usage: deno run --no-lock -A unlock-test.ts --trip <uuid> --day 3
 */
import { supabase as sb } from './sb-shim.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const arg = (n: string) => { const i = Deno.args.indexOf(`--${n}`); return i >= 0 ? Deno.args[i + 1] : undefined; };
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const tripId = arg('trip'); const dayN = Number(arg('day') ?? 3);
if (!tripId) { console.error('--trip required'); Deno.exit(2); }
const userId = (await sb.auth.getUser()).data.user!.id;

let failures = 0;
const check = (step: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? '✅' : '❌'} ${step}: ${detail}`);
  if (!ok) failures++;
};
const balance = async (): Promise<number> => {
  const { data } = await sb.from('credit_purchases').select('remaining').eq('user_id', userId).gt('remaining', 0);
  return (data ?? []).reduce((s: number, r: any) => s + Number(r.remaining || 0), 0);
};

const { data: trip } = await sb.from('trips')
  .select('destination, start_date, end_date, travelers, trip_type, budget_tier, unlocked_day_count, itinerary_data')
  .eq('id', tripId).single();
if (!trip) { console.error('trip not found'); Deno.exit(2); }
const totalDays = ((trip as any).itinerary_data?.days ?? []).length ||
  Math.round((new Date((trip as any).end_date).getTime() - new Date((trip as any).start_date).getTime()) / 86400000) + 1;
console.log(`trip ${tripId}: ${(trip as any).destination}, ${totalDays}d, unlocked_day_count=${(trip as any).unlocked_day_count}\n`);

console.log('── U1 PAID UNLOCK SPEND');
const b0 = await balance();
const idempotencyKey = `unlock_day_${tripId}_d${dayN}_${Date.now()}`;
const { data: sp, error: sperr } = await sb.functions.invoke('spend-credits', {
  body: {
    action: 'unlock_day', tripId, creditsAmount: 60, idempotencyKey,
    metadata: { type: 'single_day_unlock', dayNumber: dayN, destination: (trip as any).destination, idempotencyKey },
  },
});
check('U1', !sperr && !(sp as any)?.error, `spend ${sperr ? 'ERROR ' + sperr.message : JSON.stringify({ spent: (sp as any)?.spent ?? (sp as any)?.creditsSpent, freeCapUsed: (sp as any)?.freeCapUsed })}`);
await sleep(3);
const b1 = await balance();
check('U1', b1 === b0 - 60, `balance ${b0} → ${b1} (want ${b0 - 60})`);

console.log('── U2 GENERATE UNLOCKED DAY');
const dateObj = new Date((trip as any).start_date); dateObj.setDate(dateObj.getDate() + dayN - 1);
const session = (await sb.auth.getSession()).data.session!;
const r = await fetch(`${URL_}/functions/v1/generate-itinerary`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': ANON },
  body: JSON.stringify({
    action: 'generate-day', tripId, dayNumber: dayN, totalDays,
    destination: (trip as any).destination, date: dateObj.toISOString().slice(0, 10),
    travelers: (trip as any).travelers ?? 1, tripType: (trip as any).trip_type ?? 'vacation',
    budgetTier: (trip as any).budget_tier ?? 'moderate',
  }),
});
const text = await r.text();
let day: any = null; try { day = JSON.parse(text)?.day; } catch { /* judged below */ }
check('U2', r.ok && Array.isArray(day?.activities) && day.activities.length > 0,
  `generate-day HTTP ${r.status}, ${day?.activities?.length ?? 0} activities${r.ok ? '' : ' — ' + text.slice(0, 150)}`);

console.log('── U3 COUNT BUMP + PERSISTENCE');
// client-mirror: max-based bump
const { data: cur } = await sb.from('trips').select('unlocked_day_count').eq('id', tripId).single();
const newCount = Math.max((cur as any)?.unlocked_day_count ?? 0, dayN);
const { error: bumpErr } = await sb.from('trips').update({ unlocked_day_count: newCount }).eq('id', tripId);
check('U3', !bumpErr, `count bump ${bumpErr ? 'ERROR ' + bumpErr.message : `→ ${newCount}`}`);
await sleep(10);
const { data: after } = await sb.from('trips').select('unlocked_day_count, itinerary_status, itinerary_data').eq('id', tripId).single();
const dAfter = ((after as any)?.itinerary_data?.days ?? []).find((d: any) => d?.dayNumber === dayN);
check('U3', (after as any)?.unlocked_day_count === newCount, `unlocked_day_count=${(after as any)?.unlocked_day_count}`);
check('U3', Array.isArray(dAfter?.activities) && dAfter.activities.length > 0, `day ${dayN} persisted with ${dAfter?.activities?.length ?? 0} activities`);
check('U3', (after as any)?.itinerary_status === 'ready', `status=${(after as any)?.itinerary_status}`);

console.log(`\n══ UNLOCK TEST: ${failures === 0 ? 'PASS' : `FAIL (${failures} failed checks)`} ══`);
Deno.exit(failures === 0 ? 0 : 1);
