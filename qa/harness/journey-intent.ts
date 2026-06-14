/**
 * qa/harness/journey-intent.ts — STAGE A (intent capture) of the User-Journey
 * test plan, run against the DEPLOYED chat-trip-planner. For each priority
 * persona it sends the free-text message a real user would type and inspects
 * the extracted trip shape — the plan's #1 risk ("context-inappropriate
 * questions = instant fail"). This is the headless layer; rendering / quiz-DNA /
 * shareability still need a live UI pass.
 *   deno run --no-lock -A journey-intent.ts
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
const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const sb = createClient(URL_, ANON);
const { data: auth, error: aerr } = await sb.auth.signInWithPassword({
  email: Deno.env.get('VOYANCE_EMAIL')!, password: Deno.env.get('VOYANCE_PASSWORD')!,
});
if (aerr || !auth.user) { console.error('sign-in failed:', aerr?.message); Deno.exit(2); }

async function turn(messages: any[]): Promise<{ argText: string; assistantText: string; ok: boolean; status: number }> {
  const session = (await sb.auth.getSession()).data.session!;
  const res = await fetch(`${URL_}/functions/v1/chat-trip-planner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': ANON },
    body: JSON.stringify({ messages }),
  });
  const raw = await res.text();
  let argText = '', assistantText = '';
  for (const line of raw.split('\n')) {
    const m = line.match(/^data:\s*(\{.*\})\s*$/);
    if (!m) continue;
    try {
      const chunk = JSON.parse(m[1]);
      const d = chunk?.choices?.[0]?.delta;
      if (Array.isArray(d?.tool_calls)) for (const tc of d.tool_calls) argText += tc?.function?.arguments ?? '';
      if (typeof d?.content === 'string') assistantText += d.content;
    } catch { /* keep scanning */ }
  }
  return { argText, assistantText, ok: res.ok, status: res.status };
}

// Faithful to the REAL multi-turn flow: if the planner asks a clarifying
// question instead of extracting, reply with `followup` and read the next turn.
async function extract(message: string, followup?: string): Promise<any> {
  let { argText, assistantText, ok, status } = await turn([{ role: 'user', content: message }]);
  if (!argText && followup && ok) {
    const r2 = await turn([
      { role: 'user', content: message },
      { role: 'assistant', content: assistantText },
      { role: 'user', content: followup },
    ]);
    argText = r2.argText || argText;
    assistantText = r2.assistantText || assistantText;
    ok = r2.ok; status = r2.status;
  }
  let extracted: any = null;
  try { extracted = JSON.parse(argText); } catch { /* asked again */ }
  return { extracted, assistantText, ok, status };
}

const j = (v: any) => JSON.stringify(v ?? '');
type Check = [string, boolean];
const SCENARIOS: Array<{ id: string; name: string; msg: string; followup?: string; checks: (e: any, txt: string) => Check[] }> = [
  {
    id: 'S1', name: 'Day Trip in Atlanta',
    msg: "I want to spend a day in Atlanta on 2026-08-08 (just that one day), 2 of us, just walking around and seeing the sights. No flights or hotel — I live here.",
    checks: (e, _t) => {
      const dest = String(e?.destination ?? '');
      const oneDay = e?.startDate && (e?.startDate === e?.endDate);
      const flightish = JSON.stringify(e ?? {}).toLowerCase();
      return [
        ['captures Atlanta', /atlanta/i.test(dest)],
        ['single day (start === end)', !!oneDay],
        ['not multi-city', !e?.isMultiCity],
        ['no flight intent injected', !/"flight"|needsflight|arrivalairport/i.test(flightish)],
      ];
    },
  },
  {
    id: 'S4', name: 'Train multi-city Paris→Amsterdam→Brussels',
    msg: "A 10-day trip from 2026-10-05 to 2026-10-14 for 2 people, flying into Paris, then taking the train to Amsterdam and Brussels. We do NOT want to fly between the cities.",
    followup: "4 nights in Paris, 3 in Amsterdam, 3 in Brussels. Train between all of them, no flights between cities.",
    checks: (e, _t) => {
      const blob = JSON.stringify(e ?? {}).toLowerCase();
      return [
        ['multi-city detected', !!e?.isMultiCity || /amsterdam/.test(blob) && /brussels/.test(blob)],
        ['all 3 cities captured', /paris/.test(blob) && /amsterdam/.test(blob) && /brussels/.test(blob)],
        ['train intent captured (not flight between cities)', /train/.test(blob)],
        ['travelers = 2', Number(e?.travelers) === 2],
      ];
    },
  },
  {
    id: 'S3', name: "Girls' trip Barcelona + Madrid",
    msg: "Girls' trip for 4 of us, 7 days from 2026-07-10 to 2026-07-16 in Spain — Barcelona and Madrid, taking the train between them. We want beaches, nightlife, shopping and great food.",
    checks: (e, _t) => {
      const blob = JSON.stringify(e ?? {}).toLowerCase();
      return [
        ['both cities captured', /barcelona/.test(blob) && /madrid/.test(blob)],
        ['multi-city', !!e?.isMultiCity || (/barcelona/.test(blob) && /madrid/.test(blob))],
        ['group of 4', Number(e?.travelers) === 4],
        ['interests captured (beach/nightlife/shopping)', /(beach|nightlife|shopping)/.test(blob)],
      ];
    },
  },
  {
    id: 'S8', name: 'Work trip + weekend extension (NYC)',
    msg: "I'm in New York City for work and want to plan just the weekend, Friday 2026-10-09 through Sunday 2026-10-11, for 1 person. I'm already here, no flights or hotel needed.",
    followup: "Relaxed stuff — good food, a neighborhood walk, maybe live music. I've been working all week, nothing touristy.",
    checks: (e, _t) => {
      const blob = JSON.stringify(e ?? {}).toLowerCase();
      return [
        ['captures New York', /new york|nyc/.test(blob)],
        ['no flight/arrival intent (already there)', !/"flight"|arrivalairport|needsflight/.test(blob)],
        ['short stay (≤3 days) if dates set', !e?.startDate || !e?.endDate || (new Date(e.endDate).getTime() - new Date(e.startDate).getTime()) / 864e5 <= 3],
      ];
    },
  },
  {
    id: 'S10', name: 'No destination — discovery (3h from Atlanta)',
    msg: "I just need to get away this weekend. Somewhere within a 3-hour flight from Atlanta. I don't even know where — what do you suggest?",
    checks: (e, txt) => {
      const askedOrSuggested = (!e || !e?.destination) || /suggest|recommend|consider|how about|options|where/i.test(txt);
      const namesPlaces = /(savannah|charleston|miami|new orleans|nashville|cancun|nyc|new york|chicago|denver)/i.test(txt + j(e));
      return [
        ['does NOT silently lock a single city', !(e?.destination && !/atlanta/i.test(String(e.destination)) && !askedOrSuggested)],
        ['enters discovery / suggests options', askedOrSuggested || namesPlaces],
      ];
    },
  },
];

console.log('STAGE A — intent capture (deployed chat-trip-planner)\n');
let pass = 0, total = 0;
for (const sc of SCENARIOS) {
  const { extracted, assistantText, ok, status } = await extract(sc.msg, sc.followup);
  console.log(`\n══ ${sc.id} · ${sc.name} ══`);
  if (!ok) { console.log(`  ❌ chat-trip-planner HTTP ${status}`); continue; }
  console.log(`  extracted: dest=${j(extracted?.destination)} dates=${j(extracted?.startDate)}→${j(extracted?.endDate)} travelers=${j(extracted?.travelers)} multiCity=${j(extracted?.isMultiCity)}`);
  if (assistantText.trim()) console.log(`  assistant: "${assistantText.trim().slice(0, 160)}"`);
  const checks = sc.checks(extracted, assistantText);
  for (const [name, okc] of checks) { total++; if (okc) pass++; console.log(`    ${okc ? '✅' : '❌'} ${name}`); }
}
console.log(`\n──────────\nSTAGE A: ${pass}/${total} checks passed across ${SCENARIOS.length} personas`);
