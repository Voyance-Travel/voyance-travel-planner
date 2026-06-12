/**
 * qa/harness/save-noop-test.ts — does a VERBATIM save-itinerary (no edits)
 * mangle a ready trip? Captures before/after to disk and diffs meal cards,
 * titles, and status. Usage:
 *   deno run --no-lock -A save-noop-test.ts --trip <uuid>
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

function loadEnvFile(path: string, map: Record<string, string> = {}) {
  try {
    for (const line of Deno.readTextFileSync(path).split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/);
      if (!m) continue;
      const k = map[m[1]] ?? m[1];
      if (!Deno.env.get(k) && m[2].trim()) Deno.env.set(k, m[2].trim());
    }
  } catch { /* absent */ }
}
const here = new URL('.', import.meta.url).pathname;
loadEnvFile(`${here}.env`);
const arg = (n: string) => { const i = Deno.args.indexOf(`--${n}`); return i >= 0 ? Deno.args[i + 1] : undefined; };
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

const tripId = arg('trip');
if (!tripId) { console.error('--trip required'); Deno.exit(2); }
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
const { data: auth, error: aerr } = await sb.auth.signInWithPassword({
  email: Deno.env.get('VOYANCE_EMAIL')!, password: Deno.env.get('VOYANCE_PASSWORD')!,
});
if (aerr || !auth.user) { console.error('sign-in failed:', aerr?.message); Deno.exit(2); }

const read = async () => (await sb.from('trips').select('itinerary_status, itinerary_data, metadata, destination').eq('id', tripId).single()).data as any;
const before = await read();
if (!before) { console.error('trip not found'); Deno.exit(2); }
Deno.writeTextFileSync(`/tmp/noop-before-${tripId}.json`, JSON.stringify(before, null, 2));
console.log(`before: status=${before.itinerary_status} days=${before.itinerary_data?.days?.length} → /tmp/noop-before-${tripId}.json`);

const { data, error } = await sb.functions.invoke('generate-itinerary', {
  body: {
    action: 'save-itinerary', tripId,
    itinerary: { days: before.itinerary_data.days, status: 'ready', savedAt: new Date().toISOString() },
    saveReason: 'user-editor-autosave',
  },
});
console.log(`save: ${error ? 'ERROR ' + error.message : 'ok'}${(data as any)?.error ? ' API ERROR ' + JSON.stringify((data as any).error) : ''}`);
await sleep(5);

const after = await read();
Deno.writeTextFileSync(`/tmp/noop-after-${tripId}.json`, JSON.stringify(after, null, 2));
console.log(`after: status=${after.itinerary_status} → /tmp/noop-after-${tripId}.json`);

const cards = (row: any) => (row.itinerary_data?.days ?? []).flatMap((d: any) =>
  (d.activities ?? []).map((a: any) => `D${d.dayNumber} ${a.startTime || a.time || '--:--'} ${a.title || a.name}`));
const b = cards(before), a = cards(after);
const lost = b.filter((x: string) => !a.includes(x));
const gained = a.filter((x: string) => !b.includes(x));
console.log(`\nstatus: ${before.itinerary_status} → ${after.itinerary_status}`);
console.log(`cards: ${b.length} → ${a.length}`);
if (lost.length) { console.log('LOST:'); for (const x of lost) console.log(`  - ${x}`); }
if (gained.length) { console.log('GAINED:'); for (const x of gained) console.log(`  + ${x}`); }
if (!lost.length && !gained.length && before.itinerary_status === after.itinerary_status) console.log('NO-OP CLEAN ✅');
else console.log('MUTATED ❌');
Deno.exit(lost.length || gained.length || before.itinerary_status !== after.itinerary_status ? 1 : 0);
