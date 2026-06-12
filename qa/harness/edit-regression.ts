/**
 * qa/harness/edit-regression.ts — Step 4: editing-tools regression pass.
 *
 * Persistence was refactored under the editing tools (finalGate, verdict strip,
 * merge_trip_day RPC, frozen/regression guards). This exercises every editing
 * surface the SAME way the frontend does, against a real ready trip, asserting
 * after each step that (a) the edit actually persisted, (b) the trip stays
 * ready/fully_persisted, and (c) at the end the full 12-gate audit still passes.
 *
 * Steps:
 *   E1 LOCK      toggle-activity-lock on a day-2 activity
 *   E2 MOVE      shift an unlocked card's startTime; save-itinerary autosave
 *   E3 ADD       insert a custom card; autosave
 *   E4 SWAP      rename a card to a different venue; autosave
 *   E5 DELETE    remove the E3 card; autosave (regression-guard tolerance)
 *   E6 BAY       seed metadata.holding_bay; place-held-item preview + add
 *   E7 REGEN     spend REGENERATE_DAY → generate-day (locked card must survive)
 *                → client-style autosave of the returned day
 *   E8 AUDIT     full auditTripRow on the final row
 *
 * Usage:
 *   deno run --no-lock -A edit-regression.ts --trip <uuid> --city Valencia --days 4 [--day 2]
 *
 * Env: same as soak.ts (qa/harness/.env).
 */
import { auditTripRow } from './audit.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

function loadEnvFile(path: string, map: Record<string, string> = {}) {
  try {
    for (const line of Deno.readTextFileSync(path).split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/);
      if (!m) continue;
      const k = map[m[1]] ?? m[1];
      if (!Deno.env.get(k) && m[2].trim()) Deno.env.set(k, m[2].trim());
    }
  } catch { /* absent — fine */ }
}
const here = new URL('.', import.meta.url).pathname;
loadEnvFile(`${here}.env`);
loadEnvFile(`${here}../../.env`, { VITE_SUPABASE_URL: 'SUPABASE_URL', VITE_SUPABASE_PUBLISHABLE_KEY: 'SUPABASE_ANON_KEY' });

function arg(name: string): string | undefined {
  const i = Deno.args.indexOf(`--${name}`);
  return i >= 0 ? Deno.args[i + 1] : undefined;
}
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const lc = (s: unknown) => String(s ?? '').toLowerCase();
const pMin = (s: unknown) => { const m = String(s ?? '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const isLog = (a: any) => ['transport', 'transportation', 'transit', 'flight', 'accommodation', 'logistics'].includes(lc(a?.category)) || /check.?in|check.?out|transfer|airport|\bflight\b|return to|travel to|\bdepart/i.test(lc(a?.title || a?.name));
const isMeal = (a: any) => ['breakfast', 'lunch', 'dinner', 'dining', 'restaurant'].includes(lc(a?.category)) || /\b(breakfast|brunch|lunch|dinner)\b/i.test(lc(a?.title || a?.name));

let failures = 0;
function check(step: string, ok: boolean, detail: string) {
  console.log(`  ${ok ? '✅' : '❌'} ${step}: ${detail}`);
  if (!ok) failures++;
}

if (import.meta.main) {
  const URL_ = Deno.env.get('SUPABASE_URL'), ANON = Deno.env.get('SUPABASE_ANON_KEY');
  const EMAIL = Deno.env.get('VOYANCE_EMAIL'), PASS = Deno.env.get('VOYANCE_PASSWORD');
  const missing = [['SUPABASE_URL', URL_], ['SUPABASE_ANON_KEY', ANON], ['VOYANCE_EMAIL', EMAIL], ['VOYANCE_PASSWORD', PASS]]
    .filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) { console.error(`missing env: ${missing.join(', ')}`); Deno.exit(2); }
  const tripId = arg('trip'); const city = arg('city') ?? ''; const expectedDays = Number(arg('days') ?? 0);
  const dayN = Number(arg('day') ?? 2);
  if (!tripId || !city || !expectedDays) { console.error('usage: --trip <uuid> --city <bare city> --days <n> [--day 2]'); Deno.exit(2); }

  const sb = createClient(URL_!, ANON!);
  const { data: auth, error: aerr } = await sb.auth.signInWithPassword({ email: EMAIL!, password: PASS! });
  if (aerr || !auth.user) { console.error('sign-in failed:', aerr?.message); Deno.exit(2); }
  console.log(`signed in as ${auth.user.email}; trip ${tripId} (${city} ${expectedDays}d), editing day ${dayN}\n`);

  const readTrip = async () => {
    const { data, error } = await sb.from('trips')
      .select('itinerary_status, itinerary_data, metadata, destination')
      .eq('id', tripId).single();
    if (error || !data) { console.error('trip read failed:', error?.message); Deno.exit(2); }
    return data as any;
  };
  const daysOf = (row: any) => (Array.isArray(row?.itinerary_data?.days) ? row.itinerary_data.days : []);
  const dayOf = (row: any) => daysOf(row).find((d: any) => d?.dayNumber === dayN);
  const findCard = (row: any, pred: (a: any) => boolean) => (dayOf(row)?.activities ?? []).find(pred);
  const statusOk = (row: any, step: string) => {
    check(step, row.itinerary_status === 'ready', `itinerary_status=${row.itinerary_status} (want ready)`);
    const fp = row?.metadata?.fully_persisted;
    check(step, fp !== false, `metadata.fully_persisted=${JSON.stringify(fp)} (must not be false)`);
  };
  // Client-faithful autosave: full payload, whitelisted user saveReason.
  const autosave = async (days: any[], step: string) => {
    const { data, error } = await sb.functions.invoke('generate-itinerary', {
      body: {
        action: 'save-itinerary', tripId,
        itinerary: { days, status: 'ready', savedAt: new Date().toISOString() },
        saveReason: 'user-editor-autosave',
      },
    });
    check(step, !error && !(data as any)?.error, `save-itinerary ${error ? 'ERROR ' + error.message : (data as any)?.error ? 'API ERROR ' + JSON.stringify((data as any).error) : 'ok'}`);
    await sleep(3);
  };

  const t0 = await readTrip();
  if (t0.itinerary_status !== 'ready') { console.error(`precondition: trip not ready (${t0.itinerary_status}) — pick a clean streak trip`); Deno.exit(2); }
  const baseDay = dayOf(t0);
  if (!baseDay) { console.error(`precondition: no day ${dayN} in itinerary`); Deno.exit(2); }

  // ── E1 LOCK ───────────────────────────────────────────────────────────────
  console.log('── E1 LOCK');
  const lockTarget = (baseDay.activities ?? []).find((a: any) => !isLog(a) && !isMeal(a) && a?.id);
  if (!lockTarget) { console.error('no lockable activity on the day'); Deno.exit(2); }
  {
    const { data, error } = await sb.functions.invoke('generate-itinerary', {
      body: {
        action: 'toggle-activity-lock', tripId,
        activityId: lockTarget.id, isLocked: true,
        dayNumber: dayN, activityTitle: lockTarget.title || lockTarget.name, startTime: lockTarget.startTime || lockTarget.time,
      },
    });
    check('E1', !error && !(data as any)?.error, `toggle-activity-lock ${error ? 'ERROR ' + error.message : 'ok'} ("${lockTarget.title || lockTarget.name}")`);
    await sleep(3);
    const row = await readTrip();
    const after = findCard(row, (a) => a?.id === lockTarget.id || lc(a?.title || a?.name) === lc(lockTarget.title || lockTarget.name));
    const jsonLocked = !!(after?.isLocked || after?.locked || after?.lock_state === 'locked');
    const { data: normRow } = await sb.from('itinerary_activities').select('is_locked').eq('trip_id', tripId).eq('external_id', lockTarget.id).maybeSingle();
    check('E1', jsonLocked || normRow?.is_locked === true, `lock persisted (json=${jsonLocked}, table=${normRow?.is_locked ?? 'n/a'})`);
    statusOk(row, 'E1');
  }

  // ── E2 MOVE (time edit) ───────────────────────────────────────────────────
  console.log('── E2 MOVE');
  let moveId = '', moveTarget = '';
  {
    const row = await readTrip();
    const days = daysOf(row);
    const d = days.find((x: any) => x?.dayNumber === dayN);
    const card = (d.activities ?? []).find((a: any) =>
      !isLog(a) && a?.id && a.id !== lockTarget.id && pMin(a?.startTime || a?.time) != null && pMin(a.startTime || a.time)! >= 600 && pMin(a.startTime || a.time)! <= 1020);
    if (!card) { console.error('no movable daytime card'); Deno.exit(2); }
    const oldT = card.startTime || card.time;
    const nm = Math.min(pMin(oldT)! + 15, 1020);
    moveTarget = `${String(Math.floor(nm / 60)).padStart(2, '0')}:${String(nm % 60).padStart(2, '0')}`;
    moveId = card.id;
    card.startTime = moveTarget; card.time = moveTarget;
    await autosave(days, 'E2');
    const row2 = await readTrip();
    const after = findCard(row2, (a) => a?.id === moveId);
    check('E2', !!after, `card still present after move ("${card.title || card.name}")`);
    check('E2', (after?.startTime || after?.time) === moveTarget,
      `startTime ${oldT} → wanted ${moveTarget}, persisted ${(after?.startTime || after?.time) ?? 'MISSING'}${(after?.startTime || after?.time) !== moveTarget ? ' (edit overridden or reverted)' : ''}`);
    statusOk(row2, 'E2');
  }

  // ── E3 ADD ────────────────────────────────────────────────────────────────
  console.log('── E3 ADD');
  const addId = `qa-add-${Date.now()}`;
  {
    const row = await readTrip();
    const days = daysOf(row);
    const d = days.find((x: any) => x?.dayNumber === dayN);
    d.activities.push({
      id: addId, title: 'Coffee at Café QA Regression', name: 'Coffee at Café QA Regression',
      category: 'cafe', description: 'Harness-inserted card (E3).',
      startTime: '17:30', time: '17:30', endTime: '18:00', durationMinutes: 30,
      location: { name: 'Café QA Regression' }, source: 'user_added',
    });
    d.activities.sort((a: any, b: any) => (pMin(a?.startTime || a?.time) ?? 1e9) - (pMin(b?.startTime || b?.time) ?? 1e9));
    await autosave(days, 'E3');
    const row2 = await readTrip();
    check('E3', !!findCard(row2, (a) => a?.id === addId), 'added card persisted');
    statusOk(row2, 'E3');
  }

  // ── E4 SWAP (venue replace, client-style) ─────────────────────────────────
  console.log('── E4 SWAP');
  let swapId = '';
  {
    const row = await readTrip();
    const days = daysOf(row);
    const d = days.find((x: any) => x?.dayNumber === dayN);
    const card = (d.activities ?? []).find((a: any) => !isLog(a) && a?.id && a.id !== lockTarget.id && a.id !== addId && !(a.isLocked || a.locked));
    if (!card) { console.error('no swappable card'); Deno.exit(2); }
    swapId = card.id;
    card.title = 'Visit at QA Swap Venue'; card.name = card.title;
    card.location = { ...(card.location || {}), name: 'QA Swap Venue' };
    card.source = 'user-swap';
    await autosave(days, 'E4');
    const row2 = await readTrip();
    const after = findCard(row2, (a) => a?.id === swapId);
    check('E4', lc(after?.title) === 'visit at qa swap venue', `swap persisted (title now "${after?.title ?? 'MISSING'}")`);
    statusOk(row2, 'E4');
  }

  // ── E5 DELETE ─────────────────────────────────────────────────────────────
  console.log('── E5 DELETE');
  {
    const row = await readTrip();
    const days = daysOf(row);
    const d = days.find((x: any) => x?.dayNumber === dayN);
    const before = d.activities.length;
    d.activities = d.activities.filter((a: any) => a?.id !== addId);
    check('E5', d.activities.length === before - 1, 'local removal staged');
    await autosave(days, 'E5');
    const row2 = await readTrip();
    check('E5', !findCard(row2, (a) => a?.id === addId), 'deleted card gone after save (regression guard tolerated -1)');
    statusOk(row2, 'E5');
  }

  // ── E6 HOLDING BAY ────────────────────────────────────────────────────────
  console.log('── E6 HOLDING BAY');
  {
    const row = await readTrip();
    const meta = { ...(row.metadata || {}) };
    meta.holding_bay = [{
      id: 'held-qa-regression', source: 'capacity_overflow',
      label: 'QA Held Item — local market visit', resolved: null,
      originalMustDo: 'local market visit', createdAt: new Date().toISOString().slice(0, 10),
    }];
    const { error: merr } = await sb.from('trips').update({ metadata: meta }).eq('id', tripId);
    check('E6', !merr, `seed holding_bay ${merr ? 'ERROR ' + merr.message : 'ok'}`);
    const { data: prev, error: perr } = await sb.functions.invoke('generate-itinerary', {
      body: { action: 'place-held-item', tripId, heldItemId: 'held-qa-regression', dayNumber: dayN, mode: 'preview' },
    });
    check('E6', !perr && !(prev as any)?.error, `preview ${perr ? 'ERROR ' + perr.message : 'ok'}`);
    const { data: placed, error: plerr } = await sb.functions.invoke('generate-itinerary', {
      body: { action: 'place-held-item', tripId, heldItemId: 'held-qa-regression', dayNumber: dayN, mode: 'add' },
    });
    check('E6', !plerr && !(placed as any)?.error, `add ${plerr ? 'ERROR ' + plerr.message : 'ok'}`);
    await sleep(3);
    const row2 = await readTrip();
    const placedCard = findCard(row2, (a) => lc(a?.source) === 'held-item-placed');
    check('E6', !!placedCard, `placed card on day ${dayN}: "${placedCard?.title ?? 'MISSING'}"`);
    const bay = row2?.metadata?.holding_bay;
    check('E6', !Array.isArray(bay) || bay.length === 0, `bay emptied (count=${Array.isArray(bay) ? bay.length : 0})`);
    statusOk(row2, 'E6');
  }

  // ── E7 REGENERATE DAY (locked card must survive) ──────────────────────────
  console.log('── E7 REGENERATE DAY');
  {
    // Mirror useSpendCredits: config key REGENERATE_DAY maps to api action
    // 'regenerate_day' and ALWAYS carries an idempotencyKey in metadata.
    const { data: sc, error: scerr } = await sb.functions.invoke('spend-credits', {
      body: {
        action: 'regenerate_day', tripId, dayIndex: dayN - 1,
        metadata: { idempotencyKey: `regenerate_day:${tripId}:qa:${Date.now()}-${crypto.randomUUID().slice(0, 8)}` },
      },
    });
    check('E7', !scerr && !(sc as any)?.error, `spend regenerate_day ${scerr ? 'ERROR ' + scerr.message : (sc as any)?.error ? 'API ERROR ' + JSON.stringify((sc as any).error) : 'ok'}`);
    const row = await readTrip();
    const days = daysOf(row);
    const d = days.find((x: any) => x?.dayNumber === dayN);
    const backendActivities = (d.activities ?? []).map((a: any) => ({
      id: a.id, name: a.title || a.name, title: a.title || a.name, description: a.description,
      category: a.category, startTime: a.startTime || a.time, endTime: a.endTime,
      location: a.location, cost: a.cost, estimatedCost: a.cost,
      isLocked: !!(a.isLocked || a.locked), durationMinutes: a.durationMinutes, tags: a.tags,
    }));
    const keepActivities = backendActivities.filter((a: any) => a.isLocked).map((a: any) => a.id);
    check('E7', keepActivities.includes(lockTarget.id), `locked card in keepActivities (${keepActivities.length} kept)`);
    const { data: gen, error: gerr } = await sb.functions.invoke('generate-itinerary', {
      body: {
        action: 'generate-day', tripId, dayNumber: dayN, totalDays: expectedDays,
        destination: row.destination, date: d.date,
        travelers: 1, budgetTier: 'moderate', tripType: 'vacation',
        previousDayActivities: (d.activities ?? []).map((a: any) => a.title || a.name).filter(Boolean),
        keepActivities, currentActivities: backendActivities, variationNonce: Date.now(),
      },
    });
    const newDay = (gen as any)?.day;
    check('E7', !gerr && !!newDay && Array.isArray(newDay.activities) && newDay.activities.length > 0,
      `generate-day ${gerr ? 'ERROR ' + gerr.message : `returned ${newDay?.activities?.length ?? 0} activities`}`);
    if (newDay?.activities?.length) {
      const survived = newDay.activities.some((a: any) => a?.id === lockTarget.id || lc(a?.title || a?.name) === lc(lockTarget.title || lockTarget.name));
      check('E7', survived, `locked card survived regeneration ("${lockTarget.title || lockTarget.name}")`);
      // client-style: splice the returned day in and autosave the full payload
      newDay.dayNumber = dayN; newDay.date = d.date; newDay.title = d.title; newDay.theme = d.theme;
      const spliced = days.map((x: any) => (x?.dayNumber === dayN ? newDay : x));
      await autosave(spliced, 'E7');
    }
    await sleep(10); // server-side persist + autosave settle
    const row2 = await readTrip();
    const dAfter = dayOf(row2);
    check('E7', Array.isArray(dAfter?.activities) && dAfter.activities.length > 0, `day ${dayN} non-empty after regen (${dAfter?.activities?.length ?? 0} cards)`);
    const lockedAfter = (dAfter?.activities ?? []).some((a: any) => a?.id === lockTarget.id || lc(a?.title || a?.name) === lc(lockTarget.title || lockTarget.name));
    check('E7', lockedAfter, 'locked card present in persisted day');
    statusOk(row2, 'E7');
  }

  // ── E8 FULL AUDIT ─────────────────────────────────────────────────────────
  console.log('── E8 FULL AUDIT');
  {
    const row = await readTrip();
    const issues = auditTripRow(row, { city, expectedDays });
    // The harness's own E4 swap card ("QA Swap Venue") can trip vague-title
    // heuristics — filter only issues that point at harness-named cards.
    const real = issues.filter((i) => !/qa swap venue|qa regression|qa held item/i.test(i.detail));
    for (const i of real) console.log(`     ${i.gate}${i.day != null ? ` D${i.day}` : ''}: ${i.detail}`);
    check('E8', real.length === 0, `post-editing 12-gate audit (${real.length} issues${issues.length !== real.length ? `, ${issues.length - real.length} harness-named filtered` : ''})`);
  }

  console.log(`\n══ EDIT REGRESSION: ${failures === 0 ? 'PASS' : `FAIL (${failures} failed checks)`} ══`);
  Deno.exit(failures === 0 ? 0 : 1);
}
