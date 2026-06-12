/**
 * qa/harness/refund-test.ts — REFUND mechanics, client-faithful.
 *
 * Mirrors EditorialItinerary's refundRegenCredits: spend regenerate_day with a
 * client idempotencyKey, then REFUND via originalIdempotencyKey (the defensive
 * path — no pendingChargeId, exactly what fires when a regenerate fails).
 *
 * R1  paid spend lands (-30 committed ledger row, balance drops)
 * R2  REFUND restores the credits (+30 refund row, balance restored)
 * R3  SECOND identical REFUND must NOT double-credit (idempotency)
 *
 * Usage: deno run --no-lock -A refund-test.ts --trip <uuid>
 */
import { supabase as sb } from './sb-shim.ts';

const arg = (n: string) => { const i = Deno.args.indexOf(`--${n}`); return i >= 0 ? Deno.args[i + 1] : undefined; };
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const tripId = arg('trip');
if (!tripId) { console.error('--trip required (one whose free regenerate cap is already consumed)'); Deno.exit(2); }
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

console.log('── R1 PAID SPEND');
// Burn through any remaining free-cap regenerates first (zero-cost) — the
// refund path only exists for PAID spends.
let burned = 0;
for (let i = 0; i < 25; i++) {
  const { data: probe } = await sb.functions.invoke('spend-credits', {
    body: { action: 'regenerate_day', tripId, dayIndex: 1, metadata: { idempotencyKey: `qa-burn:${crypto.randomUUID()}` } },
  });
  if (!(probe as any)?.freeCapUsed) {
    // That one was PAID — refund it immediately and proceed with a clean,
    // instrumented paid spend below.
    if ((probe as any)?.spent > 0) {
      await sb.functions.invoke('spend-credits', {
        body: { action: 'REFUND', tripId, metadata: { originalAction: 'regenerate_day', reason: 'qa_burn_cleanup' }, originalIdempotencyKey: undefined, creditsAmount: (probe as any).spent },
      });
    }
    break;
  }
  burned++;
}
console.log(`  free-cap spends burned: ${burned}`);
const b0 = await balance();
const key = `regenerate_day:${tripId}:qa-refund:${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const { data: sp, error: sperr } = await sb.functions.invoke('spend-credits', {
  body: { action: 'regenerate_day', tripId, dayIndex: 1, metadata: { idempotencyKey: key } },
});
check('R1', !sperr && !(sp as any)?.error, `spend ${sperr ? 'ERROR ' + sperr.message : JSON.stringify({ spent: (sp as any)?.spent, freeCapUsed: (sp as any)?.freeCapUsed })}`);
if ((sp as any)?.freeCapUsed) {
  console.error('  free cap still active after burn loop — aborting');
  Deno.exit(2);
}
await sleep(3);
const b1 = await balance();
check('R1', b1 === b0 - 30, `balance ${b0} → ${b1} (want ${b0 - 30})`);
const { data: spendRow } = await sb.from('credit_ledger')
  .select('credits_delta, metadata').eq('user_id', userId).eq('trip_id', tripId)
  .eq('transaction_type', 'spend').contains('metadata', { idempotencyKey: key }).maybeSingle();
check('R1', Number(spendRow?.credits_delta) === -30 && (spendRow?.metadata as any)?.status === 'committed',
  `ledger row delta=${spendRow?.credits_delta} status=${(spendRow?.metadata as any)?.status}`);

console.log('── R2 DEFENSIVE REFUND');
const { data: rf, error: rferr } = await sb.functions.invoke('spend-credits', {
  body: {
    action: 'REFUND', tripId,
    metadata: { originalAction: 'regenerate_day', reason: 'qa_refund_test' },
    originalIdempotencyKey: key,
  },
});
check('R2', !rferr && (rf as any)?.success === true, `refund ${rferr ? 'ERROR ' + rferr.message : JSON.stringify({ refunded: (rf as any)?.refunded, idempotent: (rf as any)?.idempotent })}`);
await sleep(3);
const b2 = await balance();
check('R2', b2 === b0, `balance restored ${b1} → ${b2} (want ${b0})`);

console.log('── R3 DOUBLE-REFUND GUARD');
const { data: rf2, error: rf2err } = await sb.functions.invoke('spend-credits', {
  body: {
    action: 'REFUND', tripId,
    metadata: { originalAction: 'regenerate_day', reason: 'qa_refund_test_retry' },
    originalIdempotencyKey: key,
  },
});
console.log(`  second refund response: ${rf2err ? 'ERROR ' + rf2err.message : JSON.stringify({ success: (rf2 as any)?.success, refunded: (rf2 as any)?.refunded, idempotent: (rf2 as any)?.idempotent })}`);
await sleep(3);
const b3 = await balance();
check('R3', b3 === b0, `no double credit: balance ${b2} → ${b3} (want ${b0}; ${b3 > b0 ? 'DOUBLE-REFUNDED +' + (b3 - b0) : 'ok'})`);

console.log('── R4 UNLINKED REFUND (minting probe)');
// A REFUND carrying only an originalAction — no pendingChargeId, no
// originalIdempotencyKey — has nothing tying it to a real spend. If the
// handler credits it anyway, any client can mint 30 credits per call.
const { data: rf3, error: rf3err } = await sb.functions.invoke('spend-credits', {
  body: { action: 'REFUND', tripId, metadata: { originalAction: 'regenerate_day', reason: 'qa_unlinked_probe' } },
});
console.log(`  unlinked refund response: ${rf3err ? 'ERROR ' + rf3err.message : JSON.stringify({ success: (rf3 as any)?.success, refunded: (rf3 as any)?.refunded })}`);
await sleep(3);
const b4 = await balance();
check('R4', b4 === b3, `no unlinked minting: balance ${b3} → ${b4} (${b4 > b3 ? 'MINTED +' + (b4 - b3) : 'unchanged — ok'})`);

console.log(`\n══ REFUND TEST: ${failures === 0 ? 'PASS' : `FAIL (${failures} failed checks)`} ══`);
Deno.exit(failures === 0 ? 0 : 1);
