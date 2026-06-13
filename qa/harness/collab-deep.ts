/**
 * qa/harness/collab-deep.ts — collaborator SECURITY boundary, not just happy path.
 *
 * The fast E2E proved B can read a trip AFTER accepting. It did NOT prove the
 * access boundary actually does work — that B couldn't read it before, can't
 * read trips it was never invited to, and can't write/delete beyond its grant.
 * This tests the RLS boundary in both directions with negative controls.
 *
 * Uses a CLEAN trip B is not yet on (--trip), and a CONTROL trip B is never
 * invited to (--control). Resets B off the target first so before/after is real.
 *
 *   D1  BEFORE accept: B CANNOT read the target trip (RLS denies)       [neg]
 *   D2  B CANNOT read the control trip it's never invited to            [neg]
 *   D3  invalid/garbage token is rejected                               [neg]
 *   D4  A invites on the target, B accepts                              [happy]
 *   D5  AFTER accept: B CAN read the target (access actually flipped)
 *   D6  view-permission B CANNOT update the trip (direct write blocked) [neg]
 *   D7  view-permission B CANNOT delete the trip                        [neg]
 *   D8  A elevates B to edit (update_collaborator_permission)
 *   D9  B STILL cannot change ownership or delete (privilege ceiling)   [neg]
 *   D10 A revokes B (removes the row) → B can no longer read            [revocation]
 *
 * Usage: deno run --no-lock -A collab-deep.ts --trip <A-owned, B-not-on> --control <A-owned other>
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

function loadEnvFile(path: string) {
  try { for (const line of Deno.readTextFileSync(path).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/);
    if (m && !Deno.env.get(m[1]) && m[2].trim()) Deno.env.set(m[1], m[2].trim());
  } } catch { /* */ }
}
loadEnvFile(new URL('.env', import.meta.url).pathname);
const arg = (n: string) => { const i = Deno.args.indexOf(`--${n}`); return i >= 0 ? Deno.args[i + 1] : undefined; };
const tripId = arg('trip'), controlId = arg('control');
if (!tripId || !controlId) { console.error('--trip and --control required (both A-owned; B on neither)'); Deno.exit(2); }

const URL_ = Deno.env.get('SUPABASE_URL')!, ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const A = createClient(URL_, ANON), B = createClient(URL_, ANON);
const aAuth = await A.auth.signInWithPassword({ email: Deno.env.get('VOYANCE_EMAIL')!, password: Deno.env.get('VOYANCE_PASSWORD')! });
const bAuth = await B.auth.signInWithPassword({ email: (Deno.env.get('COLLAB2_EMAIL') ?? Deno.env.get('VOYANCE_EMAIL2'))!, password: (Deno.env.get('COLLAB2_PASSWORD') ?? Deno.env.get('VOYANCE_PASSWORD2'))! });
if (aAuth.error || bAuth.error) { console.error('sign-in failed'); Deno.exit(2); }
const bId = bAuth.data.user!.id;
console.log(`A=${aAuth.data.user!.email}  B=${bAuth.data.user!.email}\n`);

let failures = 0;
const check = (s: string, ok: boolean, d: string) => { console.log(`  ${ok ? '✅' : '❌'} ${s}: ${d}`); if (!ok) failures++; };
const tokenOf = (d: any) => d?.token ?? d?.invite_token ?? (typeof d === 'string' ? d : null);

// RESET: make sure B is NOT on the target trip so before/after is meaningful.
await A.from('trip_collaborators').delete().eq('trip_id', tripId).eq('user_id', bId);
await new Promise((r) => setTimeout(r, 800));

console.log('── D1 NEG: B cannot read target BEFORE accepting');
{
  const { data } = await B.from('trips').select('id').eq('id', tripId).maybeSingle();
  check('D1', !data, `B reads target pre-accept → ${data ? 'VISIBLE (RLS HOLE!)' : 'denied (correct)'}`);
}
console.log('── D2 NEG: B cannot read a control trip it was never invited to');
{
  const { data } = await B.from('trips').select('id').eq('id', controlId).maybeSingle();
  check('D2', !data, `B reads control → ${data ? 'VISIBLE (RLS HOLE!)' : 'denied (correct)'}`);
}
console.log('── D3 NEG: invalid token rejected');
{
  const { data, error } = await B.rpc('accept_trip_invite', { p_token: 'totally-bogus-token-xyz' });
  const rejected = !!error || (data as any)?.success === false || /invalid|not found|expired/i.test(JSON.stringify(data ?? ''));
  check('D3', rejected, `bogus token → ${rejected ? 'rejected (correct)' : 'ACCEPTED (' + JSON.stringify(data) + ')'}`);
}

console.log('── D4 A invites, B accepts');
const { data: inv } = await A.rpc('resolve_or_rotate_invite', { p_trip_id: tripId, p_force_rotate: true });
const token = tokenOf(inv);
const { data: acc, error: aerr } = await B.rpc('accept_trip_invite', { p_token: token });
check('D4', !aerr && (acc as any)?.success === true, `accept → ${aerr ? 'ERR ' + aerr.message : JSON.stringify(acc).slice(0, 80)}`);
await new Promise((r) => setTimeout(r, 1000));

console.log('── D5 AFTER accept: B CAN read target (access flipped)');
{
  const { data } = await B.from('trips').select('id, destination').eq('id', tripId).maybeSingle();
  check('D5', !!data, `B reads target post-accept → ${data ? 'visible (correct)' : 'STILL DENIED (accept did nothing)'}`);
}

console.log('── D6 NEG: view-permission B cannot UPDATE the trip');
{
  const { data, error } = await B.from('trips').update({ name: 'HACKED BY VIEWER' }).eq('id', tripId).select('id');
  const blocked = !!error || !data || data.length === 0;
  check('D6', blocked, `view-B update → ${blocked ? 'blocked (correct)' : 'WROTE ' + data.length + ' rows (RLS HOLE!)'}`);
}
console.log('── D7 NEG: view-permission B cannot DELETE the trip');
{
  const { data, error } = await B.from('trips').delete().eq('id', tripId).select('id');
  const blocked = !!error || !data || data.length === 0;
  check('D7', blocked, `view-B delete → ${blocked ? 'blocked (correct)' : 'DELETED (RLS HOLE!)'}`);
}

console.log('── D8 A elevates B to edit permission');
{
  const { data: row } = await A.from('trip_collaborators').select('id').eq('trip_id', tripId).eq('user_id', bId).maybeSingle();
  const { error } = await A.rpc('update_collaborator_permission', { p_collaborator_id: (row as any)?.id, p_permission: 'edit' });
  await new Promise((r) => setTimeout(r, 800));
  const { data: after } = await A.from('trip_collaborators').select('permission').eq('id', (row as any)?.id).maybeSingle();
  check('D8', !error && (after as any)?.permission === 'edit', `elevate → permission=${(after as any)?.permission} ${error ? 'ERR ' + error.message : ''}`);
}
console.log('── D9 NEG: even as editor, B cannot change OWNERSHIP or delete');
{
  const { data: own } = await B.from('trips').update({ user_id: bId }).eq('id', tripId).select('id');
  check('D9', !own || own.length === 0, `edit-B reassign owner → ${(!own || own.length === 0) ? 'blocked (correct)' : 'STOLE OWNERSHIP (HOLE!)'}`);
  const { data: del } = await B.from('trips').delete().eq('id', tripId).select('id');
  check('D9', !del || del.length === 0, `edit-B delete → ${(!del || del.length === 0) ? 'blocked (correct)' : 'DELETED (HOLE!)'}`);
}

console.log('── D10 REVOCATION: A removes B → B can no longer read');
{
  await A.from('trip_collaborators').delete().eq('trip_id', tripId).eq('user_id', bId);
  await new Promise((r) => setTimeout(r, 1000));
  const { data } = await B.from('trips').select('id').eq('id', tripId).maybeSingle();
  check('D10', !data, `post-revoke read → ${data ? 'STILL VISIBLE (revocation broken!)' : 'denied (correct)'}`);
}

console.log(`\n══ COLLAB DEEP (RLS boundary + negatives): ${failures === 0 ? 'PASS' : `FAIL (${failures})`} ══`);
Deno.exit(failures === 0 ? 0 : 1);
