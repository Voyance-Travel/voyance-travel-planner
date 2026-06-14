/**
 * qa/harness/s1-daytrip.ts — VERIFY the local-day-trip retrofit (27ea6d118)
 * against the DEPLOYED generate-itinerary. Creates a real 0-night Atlanta trip
 * in the QA account, drives generate-trip-day day 1, reads it back, and grades:
 *   - zero hotel cards (no check-in / return-to-hotel / checkout / taxi-to-hotel)
 *   - zero flight/airport cards
 *   - 3 meals (breakfast/lunch/dinner)
 *   - real Atlanta venues, no generic filler, no literal "World Cup" card
 *   - metadata.quality.bookend_trace.reason === 'local_day_trip'
 * Usage:  deno run --no-lock -A s1-daytrip.ts
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
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const sb = createClient(URL_, ANON);
const { data: auth, error: aerr } = await sb.auth.signInWithPassword({
  email: Deno.env.get('VOYANCE_EMAIL')!, password: Deno.env.get('VOYANCE_PASSWORD')!,
});
if (aerr || !auth.user) { console.error('sign-in failed:', aerr?.message); Deno.exit(2); }
const userId = auth.user.id;

// --date YYYY-MM-DD to target a specific day (default: an in-window World Cup
// match date so the CURATED deterministic injection is exercised, not just the
// prompt layer). 2026-06-21 = Spain vs Saudi Arabia at Mercedes-Benz Stadium.
const dateArg = (() => { const i = Deno.args.indexOf('--date'); return i >= 0 ? Deno.args[i + 1] : undefined; })();
const day = dateArg || '2026-06-21';

const { data: trip, error: terr } = await sb.from('trips').insert({
  user_id: userId, name: 'QA S1 — Atlanta day trip', destination: 'Atlanta, GA',
  start_date: day, end_date: day, travelers: 2, trip_type: 'vacation', budget_tier: 'moderate',
  metadata: { additionalNotes: 'Walking around, World Cup vibes', interestCategories: ['sightseeing', 'food'] },
}).select('id').single();
if (terr || !trip) { console.error('trip insert:', terr?.message); Deno.exit(2); }
console.log(`trip ${trip.id} — Atlanta 0-night (${day} → ${day})`);

const session = (await sb.auth.getSession()).data.session!;
const res = await fetch(`${URL_}/functions/v1/generate-itinerary`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': ANON },
  body: JSON.stringify({
    action: 'generate-trip-day', tripId: trip.id, dayNumber: 1, totalDays: 1,
    destination: 'Atlanta, GA', destinationCountry: 'United States', date: day,
    travelers: 2, tripType: 'vacation', budgetTier: 'moderate', preferences: ['sightseeing', 'food'],
  }),
});
console.log(`generate-trip-day → HTTP ${res.status}`);
const bodyText = await res.text().catch(() => '');
if (!res.ok) console.log(`  body: ${bodyText.slice(0, 400)}`);
await sleep(8);

const { data: row } = await sb.from('trips')
  .select('itinerary_status, itinerary_data').eq('id', trip.id).single();
const d0 = (row as any)?.itinerary_data?.days?.[0];
if (!d0) { console.error('no day0 persisted; status=', (row as any)?.itinerary_status, 'raw:', bodyText.slice(0, 300)); Deno.exit(1); }

const acts = (d0.activities || []) as any[];
const titles = acts.map((a) => `${a.startTime || a.time || '--:--'}  ${a.title || a.name}  [${a.category || ''}]`);
console.log(`\n── Day 1 (${acts.length} activities) ──`);
for (const t of titles) console.log('  ' + t);

const all = titles.join('\n');
const HOTEL = /check[\s-]?in|check[\s-]?out|return to .*hotel|taxi to your hotel|transfer to your hotel|to your hotel/i;
const FLIGHT = /\bflight\b|airport|terminal|boarding/i;
const FILLER = /free downtown|things to do|explore the area|^activity$|find (a|your) (local|the perfect)/i;
const WORLDCUP_LITERAL = acts.some((a) => /^world cup$|the world cup$/i.test(String(a.title || a.name || '').trim()));
// Fabricated vague event-vibe filler (the bug): "{event} (fan )?vibes/spirit/themed/atmosphere".
const EVENT_VIBE_FILLER = acts.some((a) => /\b(world cup|olympics?|fifa|super bowl|festival)\b/i.test(String(a.title || a.name || '')) && /\b(?:fan\s+)?(?:vibes?|spirit|fever|atmosphere|energy|themed)\b/i.test(String(a.title || a.name || '')));
// Grounded event content we LIKE (informational): fan fest / watch party / downtown bar.
const groundedEvent = acts.filter((a) => /\bfan\s*fest(ival)?\b|\bfan\s*zone\b|\bwatch(ing)?\b|\bwatch\s*party\b|\bmatch\b|\bsports?\s*bar\b|\bbrewery\b|\bpub\b/i.test(String(a.title || a.name || '')));
const mealHits = (re: RegExp) => acts.some((a) => re.test(`${a.title || ''} ${a.name || ''}`) || /dining/i.test(String(a.category || '')) && re.test(String(a.title || a.name || '')));
const hasBreakfast = acts.some((a) => /breakfast|brunch/i.test(`${a.title || a.name}`));
const hasLunch = acts.some((a) => /lunch/i.test(`${a.title || a.name}`));
const hasDinner = acts.some((a) => /dinner/i.test(`${a.title || a.name}`));
const sightseeing = acts.filter((a) => /sightseeing|attraction|activity|experience|culture/i.test(String(a.category || '')) && !HOTEL.test(String(a.title || a.name || '')));

const trace = d0.metadata?.quality?.bookend_trace;
const mealAudit = d0.metadata?.quality?.meal_audit;
const execAudit = d0.metadata?.quality?.executioner_audit;

const checks: [string, boolean][] = [
  ['no hotel cards', !acts.some((a) => HOTEL.test(String(a.title || a.name || '')))],
  ['no flight/airport cards', !acts.some((a) => FLIGHT.test(String(a.title || a.name || '')))],
  ['breakfast present', hasBreakfast],
  ['lunch present', hasLunch],
  ['dinner present', hasDinner],
  ['has real sightseeing (≥2)', sightseeing.length >= 2],
  ['no generic filler', !acts.some((a) => FILLER.test(String(a.title || a.name || '')))],
  ['no literal "World Cup" card', !WORLDCUP_LITERAL],
  ['no fabricated "{event} vibes" filler', !EVENT_VIBE_FILLER],
  ['bookend_trace.reason === local_day_trip', trace?.reason === 'local_day_trip'],
  ['bookend_trace.isDepartureDay === false', trace?.isDepartureDay === false],
];

console.log('\n── metadata.quality traces ──');
console.log('  bookend_trace:', JSON.stringify(trace));
console.log('  meal_audit:', JSON.stringify(mealAudit));
console.log('  executioner_audit:', JSON.stringify(execAudit));

console.log(`\n── event integration (informational) ──`);
console.log(`  grounded event experiences (fan fest / watch party / sports bar): ${groundedEvent.length}`);
for (const a of groundedEvent) console.log(`    + ${a.title || a.name}`);

console.log('\n── GRADE ──');
let pass = 0;
for (const [name, ok] of checks) { console.log(`  ${ok ? '✅' : '❌'} ${name}`); if (ok) pass++; }
console.log(`\n${pass}/${checks.length} checks passed — trip ${trip.id}`);
Deno.exit(pass === checks.length ? 0 : 1);
