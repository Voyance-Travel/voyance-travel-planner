/**
 * qa/harness/concierge-test.ts — AI concierge (itinerary-chat) re-check.
 *
 * The June-8 pass validated the concierge BEFORE this week's persistence
 * refactor. This re-checks the round-trip on the current stack:
 *   C1  itinerary-chat responds to a real edit request with a coherent
 *       message + structured actions
 *   C2  ai_message credit spend works (free-cap or paid)
 *   C3  a follow-up request still returns coherently (multi-turn)
 *   C4  the trip is UNHARMED by a concierge conversation — status stays
 *       ready, day count unchanged (chat must not mutate by itself)
 *
 * Usage: deno run --no-lock -A concierge-test.ts --trip <uuid>
 */
import { supabase as sb } from './sb-shim.ts';

const arg = (n: string) => { const i = Deno.args.indexOf(`--${n}`); return i >= 0 ? Deno.args[i + 1] : undefined; };
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const tripId = arg('trip');
if (!tripId) { console.error('--trip required (a ready trip)'); Deno.exit(2); }
const userId = (await sb.auth.getUser()).data.user!.id;

let failures = 0;
const check = (step: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? '✅' : '❌'} ${step}: ${detail}`);
  if (!ok) failures++;
};

const { data: trip } = await sb.from('trips')
  .select('itinerary_status, itinerary_data, destination').eq('id', tripId).single();
if (!trip || (trip as any).itinerary_status !== 'ready') { console.error(`trip not ready (${(trip as any)?.itinerary_status})`); Deno.exit(2); }
const days0 = ((trip as any).itinerary_data?.days ?? []);
const destination = (trip as any).destination;
console.log(`trip ${tripId}: ${destination}, ${days0.length}d, ready\n`);

// Build the itineraryContext the client sends (trimmed to what the fn reads).
const itineraryContext = {
  tripId, destination,
  days: days0.map((d: any) => ({
    dayNumber: d.dayNumber, date: d.date, theme: d.theme,
    activities: (d.activities ?? []).map((a: any) => ({
      id: a.id, title: a.title, startTime: a.startTime, category: a.category,
      cost: a.cost?.amount ?? a.cost, isLocked: !!(a.isLocked || a.locked),
    })),
  })),
};

async function chat(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const { data, error } = await sb.functions.invoke('itinerary-chat', {
    body: { messages, itineraryContext, conversationId: `qa_${Date.now()}`, stream: false },
  });
  return { data, error };
}

console.log('── C1 CONCIERGE RESPONDS TO AN EDIT REQUEST');
const r1 = await chat([{ role: 'user', content: `Day 2 feels too packed. Can you suggest a more relaxed afternoon?` }]);
const m1 = (r1.data as any)?.message;
const actions1 = (r1.data as any)?.actions;
check('C1', !r1.error && typeof m1 === 'string' && m1.length > 20,
  `response ${r1.error ? 'ERROR ' + r1.error.message : `"${String(m1).slice(0, 80)}…"`}`);
check('C1', Array.isArray(actions1), `structured actions array present (${Array.isArray(actions1) ? actions1.length : 'MISSING'}${Array.isArray(actions1) && actions1.length ? ': ' + actions1.map((a: any) => a.type).join(',') : ''})`);

console.log('── C2 ai_message SPEND');
const { data: sp, error: sperr } = await sb.functions.invoke('spend-credits', {
  body: { action: 'ai_message', tripId, metadata: { idempotencyKey: `ai_message:${tripId}:${Date.now()}` } },
});
check('C2', !sperr && !(sp as any)?.error, `spend ai_message ${sperr ? 'ERROR ' + sperr.message : JSON.stringify({ spent: (sp as any)?.spent, freeCapUsed: (sp as any)?.freeCapUsed })}`);

console.log('── C3 MULTI-TURN COHERENCE');
const r2 = await chat([
  { role: 'user', content: `Day 2 feels too packed.` },
  { role: 'assistant', content: String(m1 ?? 'I can help with that.') },
  { role: 'user', content: `Actually, what's a good vegan dinner spot there instead?` },
]);
const m2 = (r2.data as any)?.message;
check('C3', !r2.error && typeof m2 === 'string' && m2.length > 20, `follow-up ${r2.error ? 'ERROR ' + r2.error.message : `"${String(m2).slice(0, 80)}…"`}`);

console.log('── C4 TRIP UNHARMED BY CONVERSATION');
await sleep(3);
const { data: after } = await sb.from('trips').select('itinerary_status, itinerary_data').eq('id', tripId).single();
const days1 = ((after as any)?.itinerary_data?.days ?? []);
check('C4', (after as any)?.itinerary_status === 'ready', `status still ready (${(after as any)?.itinerary_status})`);
check('C4', days1.length === days0.length, `day count unchanged (${days0.length} → ${days1.length}) — chat must not mutate by itself`);

console.log(`\n══ CONCIERGE TEST: ${failures === 0 ? 'PASS' : `FAIL (${failures} failed checks)`} ══`);
Deno.exit(failures === 0 ? 0 : 1);
