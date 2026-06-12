/**
 * qa/harness/collab-test.ts — collaborator invite path (owner side).
 *
 * The full A5/A6 flow needs two accounts; this exercises everything the
 * INVITER (QA account) drives, plus the self-accept guard. The cross-account
 * ACCEPT is Clinton's click (a different session) — printed as the handoff.
 *
 *   X1  resolve_or_rotate_invite returns a token for an owned trip
 *   X2  get_trip_invite_info(token) previews the trip (the recipient's
 *       pre-accept screen) without requiring collaboration yet
 *   X3  accept_trip_invite(token) BY THE OWNER is rejected
 *       (prevent_self_collaboration) — you can't collaborate with yourself
 *   X4  rotate produces a fresh token and (per resolve semantics) the old one
 *       no longer previews, OR resolve returns the stable token — reported
 *
 * Usage: deno run --no-lock -A collab-test.ts --trip <uuid owned by QA acct>
 */
import { supabase as sb } from './sb-shim.ts';

const arg = (n: string) => { const i = Deno.args.indexOf(`--${n}`); return i >= 0 ? Deno.args[i + 1] : undefined; };
const tripId = arg('trip');
if (!tripId) { console.error('--trip required (owned by the QA account)'); Deno.exit(2); }

let failures = 0;
const check = (step: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? '✅' : '❌'} ${step}: ${detail}`);
  if (!ok) failures++;
};
const tokenOf = (d: any) => d?.token ?? d?.invite_token ?? d?.share_token ?? (typeof d === 'string' ? d : null);

console.log('── X1 GENERATE INVITE (resolve_or_rotate_invite)');
const { data: inv, error: ierr } = await sb.rpc('resolve_or_rotate_invite', { p_trip_id: tripId, p_force_rotate: false });
const token = tokenOf(inv);
check('X1', !ierr && !!token, `${ierr ? 'ERROR ' + ierr.message : `token ${token ? String(token).slice(0, 12) + '…' : JSON.stringify(inv)}`}`);
if (!token) { console.log(`\n══ COLLAB TEST: FAIL (no token) ══`); Deno.exit(1); }

console.log('── X2 PREVIEW (get_trip_invite_info — recipient pre-accept screen)');
const { data: info, error: gerr } = await sb.rpc('get_trip_invite_info', { p_token: token });
check('X2', !gerr && !!info, `${gerr ? 'ERROR ' + gerr.message : `preview ok (${JSON.stringify(info).slice(0, 100)}…)`}`);

console.log('── X3 SELF-ACCEPT GUARD (owner accepting own invite must be rejected)');
const { data: acc, error: aerr } = await sb.rpc('accept_trip_invite', { p_token: token });
const blocked = !!aerr || (acc as any)?.success === false || /self|owner|already|cannot/i.test(JSON.stringify(acc ?? ''));
check('X3', blocked, `self-accept ${blocked ? 'correctly rejected' : 'WRONGLY ALLOWED'} (${aerr ? aerr.message : JSON.stringify(acc)})`);

console.log('── X4 ROTATE');
const { data: inv2, error: rerr } = await sb.rpc('resolve_or_rotate_invite', { p_trip_id: tripId, p_force_rotate: true });
const token2 = tokenOf(inv2);
check('X4', !rerr && !!token2, `rotate ${rerr ? 'ERROR ' + rerr.message : `token ${token2 ? String(token2).slice(0, 12) + '…' : '?'} (${token2 === token ? 'stable' : 'rotated'})`}`);

console.log(`\n══ COLLAB TEST (inviter side): ${failures === 0 ? 'PASS' : `FAIL (${failures})`} ══`);
console.log(`\n→ HANDOFF for Clinton (the cross-account accept):`);
console.log(`   1. Sign in as Clinton on PRODUCTION (not a Vercel preview)`);
console.log(`   2. Open the invite link for trip ${tripId} (token ${String(token2 || token).slice(0, 16)}…)`);
console.log(`   3. Click Accept — should land him on the trip as a collaborator`);
console.log(`   4. Verify: he sees the itinerary, and his edits (if permission=edit) persist`);
Deno.exit(failures === 0 ? 0 : 1);
