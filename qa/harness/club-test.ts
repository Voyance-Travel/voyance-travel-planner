/**
 * qa/harness/club-test.ts — Voyance Club tier behavior (no purchase).
 *
 * PRECONDITION (owner-run, since user_tiers is server-managed / RLS-locked):
 *   INSERT INTO user_tiers (user_id, tier) VALUES ('<QA uid>', 'adventurer')
 *   ON CONFLICT (user_id) DO UPDATE SET tier='adventurer', updated_at=now();
 *
 * Verifies the tier actually CHANGES behavior vs free:
 *   K1  get-entitlements reports isClubMember + the club tier
 *   K2  elevated free-cap: a club tier grants MORE free regenerates than free.
 *       Burns regenerate_day free spends on a fresh trip and counts how many
 *       come back freeCapUsed before the first paid one — must match the tier
 *       cap (voyager 2 / explorer 3 / adventurer 5), not the free-tier scaled cap.
 *
 * Usage: deno run --no-lock -A club-test.ts --trip <uuid>  [--expect adventurer]
 * REVERT after: UPDATE user_tiers SET tier='free' WHERE user_id='<QA uid>';
 */
import { supabase as sb } from './sb-shim.ts';

const arg = (n: string) => { const i = Deno.args.indexOf(`--${n}`); return i >= 0 ? Deno.args[i + 1] : undefined; };
const tripId = arg('trip');
const expectTier = arg('expect') ?? 'adventurer';
const TIER_REGEN_CAP: Record<string, number> = { voyager: 2, explorer: 3, adventurer: 5 };
if (!tripId) { console.error('--trip required'); Deno.exit(2); }
const userId = (await sb.auth.getUser()).data.user!.id;

let failures = 0;
const check = (step: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? '✅' : '❌'} ${step}: ${detail}`);
  if (!ok) failures++;
};

console.log('── K1 ENTITLEMENTS REPORT CLUB MEMBERSHIP');
const { data: ent, error: eerr } = await sb.functions.invoke('get-entitlements', { body: { tripId } });
const tier = (ent as any)?.tier ?? (ent as any)?.entitlements?.tier;
const isClub = (ent as any)?.isClubMember ?? (ent as any)?.entitlements?.isClubMember ?? ['voyager', 'explorer', 'adventurer'].includes(String(tier));
check('K1', !eerr, `get-entitlements ${eerr ? 'ERROR ' + eerr.message : 'ok'}`);
check('K1', String(tier) === expectTier, `tier=${tier} (expected ${expectTier} — did the owner set user_tiers?)`);
check('K1', !!isClub, `isClubMember=${isClub}`);
if (String(tier) !== expectTier) {
  console.log('\n  ⚠️  tier not set — run the precondition SQL, then re-run.');
  Deno.exit(2);
}

console.log(`── K2 ELEVATED FREE-CAP (${expectTier} → ${TIER_REGEN_CAP[expectTier]} free regenerates)`);
let freeCount = 0, firstPaidAt = -1;
for (let i = 0; i < TIER_REGEN_CAP[expectTier] + 2; i++) {
  const { data: sp, error } = await sb.functions.invoke('spend-credits', {
    body: { action: 'regenerate_day', tripId, dayIndex: 1, metadata: { idempotencyKey: `club-probe:${crypto.randomUUID()}` } },
  });
  if (error || (sp as any)?.error) { console.log(`   spend ${i} error: ${error?.message ?? (sp as any)?.error}`); break; }
  if ((sp as any)?.freeCapUsed) freeCount++;
  else { firstPaidAt = i; break; }
}
console.log(`   free regenerates granted before first paid: ${freeCount}`);
check('K2', freeCount === TIER_REGEN_CAP[expectTier],
  `free-cap = ${freeCount}, tier cap = ${TIER_REGEN_CAP[expectTier]} (free tier would be lower/scaled)`);

console.log(`\n══ CLUB TEST: ${failures === 0 ? 'PASS' : `FAIL (${failures})`} ══`);
console.log(`→ REVERT: UPDATE user_tiers SET tier='free' WHERE user_id='${userId}';`);
Deno.exit(failures === 0 ? 0 : 1);
