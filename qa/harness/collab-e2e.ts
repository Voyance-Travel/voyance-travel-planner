/**
 * qa/harness/collab-e2e.ts — full two-account collaborator flow, driven end
 * to end (no manual clicking).
 *
 * Account A (inviter)  = VOYANCE_EMAIL / VOYANCE_PASSWORD  (the QA account)
 * Account B (acceptor) = COLLAB2_EMAIL / COLLAB2_PASSWORD  (owner adds to
 *                        qa/harness/.env — any second real account, e.g.
 *                        Clinton or ashtonlaurenn; values never printed)
 *
 *   E1  A generates a fresh invite on a trip A owns (rotate → clean token)
 *   E2  B (signed in separately) previews via get_trip_invite_info
 *   E3  B accepts via accept_trip_invite — success
 *   E4  a trip_collaborators row now links B to the trip
 *   E5  B can READ the trip's itinerary (RLS lets the collaborator in)
 *   E6  re-accept by B is idempotent (already a collaborator, no dup/no error)
 *
 * Usage: deno run --no-lock -A collab-e2e.ts --trip <uuid owned by account A>
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

function loadEnvFile(path: string) {
  try {
    for (const line of Deno.readTextFileSync(path).split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/);
      if (m && !Deno.env.get(m[1]) && m[2].trim()) Deno.env.set(m[1], m[2].trim());
    }
  } catch { /* absent */ }
}
loadEnvFile(new URL('.env', import.meta.url).pathname);

const arg = (n: string) => { const i = Deno.args.indexOf(`--${n}`); return i >= 0 ? Deno.args[i + 1] : undefined; };
const tripId = arg('trip');
const URL_ = Deno.env.get('SUPABASE_URL')!, ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const A_EMAIL = Deno.env.get('VOYANCE_EMAIL'), A_PASS = Deno.env.get('VOYANCE_PASSWORD');
// second account: accept either COLLAB2_* or VOYANCE_*2 naming
const B_EMAIL = Deno.env.get('COLLAB2_EMAIL') ?? Deno.env.get('VOYANCE_EMAIL2');
const B_PASS = Deno.env.get('COLLAB2_PASSWORD') ?? Deno.env.get('VOYANCE_PASSWORD2');
if (!tripId) { console.error('--trip required (owned by account A)'); Deno.exit(2); }
const missing = [['VOYANCE_EMAIL', A_EMAIL], ['VOYANCE_PASSWORD', A_PASS], ['COLLAB2_EMAIL', B_EMAIL], ['COLLAB2_PASSWORD', B_PASS]].filter(([, v]) => !v).map(([k]) => k);
if (missing.length) { console.error(`missing env: ${missing.join(', ')} — add the 2nd account to qa/harness/.env (COLLAB2_EMAIL / COLLAB2_PASSWORD)`); Deno.exit(2); }

let failures = 0;
const check = (step: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? '✅' : '❌'} ${step}: ${detail}`);
  if (!ok) failures++;
};
const tokenOf = (d: any) => d?.token ?? d?.invite_token ?? d?.share_token ?? (typeof d === 'string' ? d : null);

// two independent signed-in clients
const A = createClient(URL_, ANON);
const B = createClient(URL_, ANON);
const aAuth = await A.auth.signInWithPassword({ email: A_EMAIL!, password: A_PASS! });
const bAuth = await B.auth.signInWithPassword({ email: B_EMAIL!, password: B_PASS! });
if (aAuth.error || !aAuth.data.user) { console.error('account A sign-in failed:', aAuth.error?.message); Deno.exit(2); }
if (bAuth.error || !bAuth.data.user) { console.error('account B sign-in failed:', bAuth.error?.message); Deno.exit(2); }
const bId = bAuth.data.user.id;
if (aAuth.data.user.id === bId) { console.error('A and B are the SAME account — set a different COLLAB2_EMAIL'); Deno.exit(2); }
console.log(`A=${aAuth.data.user.email} (inviter)  B=${bAuth.data.user.email} (acceptor)\n`);

console.log('── E1 A GENERATES A FRESH INVITE');
const { data: inv, error: ierr } = await A.rpc('resolve_or_rotate_invite', { p_trip_id: tripId, p_force_rotate: true });
const token = tokenOf(inv);
check('E1', !ierr && !!token, `${ierr ? 'ERROR ' + ierr.message : `token ${token ? String(token).slice(0, 12) + '…' : JSON.stringify(inv)}`}`);
if (!token) { console.log('\n══ COLLAB E2E: FAIL (no token) ══'); Deno.exit(1); }

console.log('── E2 B PREVIEWS THE INVITE');
const { data: info, error: gerr } = await B.rpc('get_trip_invite_info', { p_token: token });
check('E2', !gerr && (info as any)?.valid !== false, `${gerr ? 'ERROR ' + gerr.message : 'preview ok'}`);

console.log('── E3 B ACCEPTS');
const { data: acc, error: aerr } = await B.rpc('accept_trip_invite', { p_token: token });
const accepted = !aerr && ((acc as any)?.success === true || (acc as any)?.success === undefined && !/error/i.test(JSON.stringify(acc)));
check('E3', accepted, `${aerr ? 'ERROR ' + aerr.message : JSON.stringify(acc)}`);

console.log('── E4 COLLABORATOR ROW LINKS B → TRIP');
await new Promise((r) => setTimeout(r, 2000));
const { data: collabRow } = await A.from('trip_collaborators').select('user_id, permission, accepted_at').eq('trip_id', tripId).eq('user_id', bId).maybeSingle();
check('E4', !!collabRow, `trip_collaborators row present (permission=${(collabRow as any)?.permission}, accepted_at=${(collabRow as any)?.accepted_at ? 'set' : 'null'})`);

console.log('── E5 B CAN READ THE TRIP (RLS admits the collaborator)');
const { data: bView, error: berr } = await B.from('trips').select('id, destination, itinerary_status, itinerary_data').eq('id', tripId).maybeSingle();
const bDays = (bView as any)?.itinerary_data?.days?.length ?? 0;
check('E5', !berr && !!bView && bDays > 0, `B sees trip ${berr ? 'ERROR ' + berr.message : `(${(bView as any)?.destination}, ${bDays} days, ${(bView as any)?.itinerary_status})`}`);

console.log('── E6 RE-ACCEPT IS IDEMPOTENT');
const { data: acc2, error: a2err } = await B.rpc('accept_trip_invite', { p_token: token });
const okIdem = !a2err && /already|collaborator|success/i.test(JSON.stringify(acc2 ?? ''));
check('E6', okIdem || !a2err, `re-accept ${a2err ? 'ERROR ' + a2err.message : JSON.stringify(acc2)}`);
const { data: dupCheck } = await A.from('trip_collaborators').select('user_id').eq('trip_id', tripId).eq('user_id', bId);
check('E6', (dupCheck?.length ?? 0) === 1, `exactly one collaborator row (no duplicate) — found ${dupCheck?.length ?? 0}`);

console.log(`\n══ COLLAB E2E (both accounts driven): ${failures === 0 ? 'PASS' : `FAIL (${failures})`} ══`);
Deno.exit(failures === 0 ? 0 : 1);
