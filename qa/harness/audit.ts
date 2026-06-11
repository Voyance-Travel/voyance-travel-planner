/**
 * qa/harness/audit.ts — the single source of truth for "is this trip CLEAN?"
 *
 * Consolidates every gate this project has ever failed on, MVP + strict content:
 *   G1  status ready + fully_persisted + expected day count + all days non-empty
 *   G2  integrity contract carries no blocking codes
 *   G3  meal earlier than 06:30
 *   G4  nightcap-titled card before 17:00
 *   G5  dinner starting after 21:45 (late-dinner sequence bug)
 *   G6  placeholder meal names ("Lunch in <city>", "find a local spot…")
 *   G7  out-of-script garble (stray CJK in a Latin-dominant title)
 *   G8  cross-day duplicate venue by CORE tokens (catches variant titles)
 *   G9  thin middle day (<2 real non-meal/non-logistics activities)
 *   G10 non-logistics activity after the departure barrier on the last day
 *   G11 vague/placeholder titles + prompt-scaffolding leaks
 *   G12 must-do appears exactly once (when --mustdo given)
 *
 * Modes:
 *   deno run -A audit.ts --file days.json [--city "Athens"] [--mustdo "Acropolis"]
 *   deno run -A audit.ts --trip <uuid> [...]   (needs SUPABASE_URL + SUPABASE_KEY env —
 *                                               a user JWT or service key; never committed)
 */

export interface AuditIssue { gate: string; day: number | null; detail: string }

const lc = (s: unknown) => String(s ?? '').toLowerCase();
const T = (a: any) => String(a?.title ?? a?.name ?? '');
const pMin = (s: unknown) => { const m = String(s ?? '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const start = (a: any) => pMin(a?.startTime ?? a?.time);

const isLog = (a: any) =>
  ['transport', 'transportation', 'transit', 'flight', 'accommodation', 'logistics'].includes(lc(a?.category)) ||
  /check.?in|check.?out|transfer|airport|\bflight\b|return to|travel to|\bdepart/i.test(lc(T(a)));
const DRINK = /nightcap|drinks|cocktail|wine bar|\bbar\b|aperitif|nightlife|pub/i;
const isMeal = (a: any) => {
  if (DRINK.test(lc(T(a)))) return false;
  if (['breakfast', 'lunch', 'dinner', 'dining', 'food', 'restaurant', 'brunch'].includes(lc(a?.category))) return true;
  return /\b(breakfast|brunch|lunch|dinner)\b/i.test(lc(T(a)));
};
const isNightcap = (t: string) => /\bnight ?cap\b|late[- ]?night (?:drink|jazz|stroll|out|bar|bite)|evening (?:drink|nightcap)/i.test(t);

const VAGUE = new Set(['activity', 'lunch', 'dinner', 'breakfast', 'explore', 'free time', 'leisure', 'sightseeing', 'meal', 'restaurant', 'cafe', 'dining', 'activities', 'afternoon', 'morning', 'evening']);
const LEAK = /(as an ai|i cannot|research context|prompt instruction|placeholder|lorem|\btbd\b|\btodo\b|step \d|scaffold)/i;
const PLACEHOLDER_MEAL = /find (?:a |your )?(?:local|good|great|perfect)?\s*(?:spot|place|restaurant|caf[eé]|eatery)/i;
const OUT_SCRIPT = /[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]/g;

const STOP_CORE = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'at', 'on', 'by', 'with', 'your', 'via', 'for',
  'wander', 'wandering', 'explore', 'exploring', 'visit', 'visiting', 'tour', 'touring', 'discover', 'discovering',
  'stroll', 'strolling', 'see', 'seeing', 'experience', 'experiencing', 'roam', 'free', 'follow', 'nose', 'hop', 'hopping',
  'bar', 'drinks', 'nightcap', 'note', 'location', 'nearby', 'around', 'through', 'walk', 'walking', 'open', 'afternoon',
  'morning', 'evening', 'reflection', 'solo', 'neighborhood', 'neighbourhood', 'area', 'district', 'quarter']);
const coreKey = (raw: unknown): string => {
  const toks = String(raw ?? '').toLowerCase()
    .replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/).filter(Boolean).filter((t) => t.length >= 3 && !STOP_CORE.has(t));
  return [...new Set(toks)].sort().join(' ');
};

export function auditDays(days: any[], opts: { city?: string; mustDo?: string; expectedDays?: number } = {}): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const add = (gate: string, day: number | null, detail: string) => issues.push({ gate, day, detail });
  const total = days.length;
  if (opts.expectedDays && total !== opts.expectedDays) add('G1.days', null, `have ${total}, expected ${opts.expectedDays}`);
  const cityLc = lc(opts.city ?? '').trim();
  const seenCore = new Map<string, number>(); // coreKey -> first day

  days.forEach((d: any, idx: number) => {
    const dn = Number(d?.dayNumber ?? idx + 1);
    const acts: any[] = Array.isArray(d?.activities) ? d.activities : [];
    const isLast = idx === total - 1;
    if (acts.length === 0) { add('G1.empty', dn, 'day has zero activities'); return; }

    for (const a of acts) {
      const t = T(a); const s = start(a);
      if (isMeal(a)) {
        if (s != null && s < 390) add('G3.earlyMeal', dn, `"${t}" at ${a.startTime}`);
        if (/\bdinner\b/i.test(t) && s != null && s > 1305) add('G5.lateDinner', dn, `"${t}" at ${a.startTime}`);
        const blob = lc(t) + ' ' + lc(a?.location?.name);
        if (PLACEHOLDER_MEAL.test(blob)) add('G6.placeholderMeal', dn, `"${t}" / loc "${a?.location?.name ?? ''}"`);
        else if (cityLc && new RegExp(`^(breakfast|brunch|lunch|dinner)\\s+(in|at)\\s+${cityLc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i').test(t.trim()))
          add('G6.placeholderMeal', dn, `"${t}"`);
      }
      if (isNightcap(t) && s != null && s < 1020) add('G4.nightcapEarly', dn, `"${t}" at ${a.startTime}`);
      const cjk = (t.match(OUT_SCRIPT) || []).length;
      const latin = (t.match(/[a-zA-Z]/g) || []).length;
      if (latin >= 3 && cjk > 0 && cjk <= 3) add('G7.garble', dn, `"${t}"`);
      if (!isLog(a) && !isMeal(a)) {
        if (VAGUE.has(lc(t).trim())) add('G11.vague', dn, `"${t}"`);
        if (LEAK.test(t)) add('G11.leak', dn, `"${t}"`);
        const ck = coreKey(a?.location?.name || t);
        if (ck.length >= 4) {
          if (seenCore.has(ck) && seenCore.get(ck) !== dn) add('G8.venueDup', dn, `"${t}" (~${ck}) also D${seenCore.get(ck)}`);
          else if (!seenCore.has(ck)) seenCore.set(ck, dn);
        }
      } else if (isMeal(a)) {
        // repeated RESTAURANT across days (same core venue) — "Lunch at El Turix"
        // on D1 and D2 is a curation miss the owner explicitly flagged. Generic
        // placeholders are G6's job, skip them here.
        const blob2 = lc(t) + ' ' + lc(a?.location?.name);
        if (!PLACEHOLDER_MEAL.test(blob2)) {
          const ck = coreKey(a?.location?.name || t);
          if (ck.length >= 4 && (!cityLc || ck !== coreKey(cityLc))) {
            if (seenCore.has(ck) && seenCore.get(ck) !== dn) add('G8.mealVenueDup', dn, `"${t}" (~${ck}) also D${seenCore.get(ck)}`);
            else if (!seenCore.has(ck)) seenCore.set(ck, dn);
          }
        }
      }
    }
    // thin middle day
    if (dn > 1 && dn < total) {
      const real = acts.filter((a) => !isLog(a) && !isMeal(a) && !isNightcap(T(a))).length;
      if (real < 2) add('G9.thinMiddleDay', dn, `${real} real activities`);
    }
    // post-departure activities (last day)
    if (isLast && total > 1) {
      const deps = acts.filter((a) => /airport|\bflight\b|\bdepart/i.test(lc(T(a)))).map(start).filter((m): m is number => m != null);
      if (deps.length > 0) {
        const cut = Math.max(...deps);
        for (const a of acts) {
          const s = start(a);
          if (s != null && s > cut + 5 && !isLog(a)) add('G10.postDeparture', dn, `"${T(a)}" at ${a.startTime}`);
        }
      }
    }
  });

  if (opts.mustDo) {
    const md = lc(opts.mustDo);
    const n = days.flatMap((d: any) => (Array.isArray(d?.activities) ? d.activities : []))
      .filter((a: any) => (lc(T(a)) + ' ' + lc(a?.location?.name)).includes(md)).length;
    if (n === 0) add('G12.mustDoMissing', null, `"${opts.mustDo}" not found`);
    if (n > 1) add('G12.mustDoDup', null, `"${opts.mustDo}" appears ${n}x`);
  }
  return issues;
}

export function auditTripRow(row: any, opts: { city?: string; mustDo?: string; expectedDays?: number } = {}): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const days: any[] = Array.isArray(row?.itinerary_data?.days) ? row.itinerary_data.days : [];
  if (String(row?.itinerary_status) !== 'ready') issues.push({ gate: 'G1.status', day: null, detail: `status=${row?.itinerary_status}` });
  if (row?.metadata?.fully_persisted !== true) issues.push({ gate: 'G1.fullyPersisted', day: null, detail: 'not stamped' });
  const codes: string[] = Array.isArray(row?.metadata?.integrity_contract?.codes) ? row.metadata.integrity_contract.codes : [];
  const blocking = codes.filter((c) => c === 'LOGISTICS_ONLY_CURATED_DAY' || c === 'MEAL_COVERAGE_MISSING');
  if (blocking.length) issues.push({ gate: 'G2.integrity', day: null, detail: blocking.join(',') });
  return [...issues, ...auditDays(days, opts)];
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (import.meta.main) {
  const args = new Map<string, string>();
  const argv = Deno.args;
  for (let i = 0; i < argv.length; i += 2) if (argv[i]?.startsWith('--')) args.set(argv[i].slice(2), argv[i + 1] ?? '');
  const opts = { city: args.get('city'), mustDo: args.get('mustdo'), expectedDays: args.get('days') ? Number(args.get('days')) : undefined };

  let issues: AuditIssue[]; let label: string;
  if (args.has('file')) {
    const days = JSON.parse(Deno.readTextFileSync(args.get('file')!));
    label = args.get('file')!;
    issues = auditDays(Array.isArray(days) ? days : days?.days ?? [], opts);
  } else if (args.has('trip')) {
    const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_KEY');
    if (!url || !key) { console.error('need SUPABASE_URL + SUPABASE_KEY env'); Deno.exit(2); }
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const sb = createClient(url, key);
    const { data, error } = await sb.from('trips').select('itinerary_status, itinerary_data, metadata, destination').eq('id', args.get('trip')!).single();
    if (error || !data) { console.error('trip fetch failed:', error?.message); Deno.exit(2); }
    label = `${data.destination} ${args.get('trip')!.slice(0, 8)}`;
    issues = auditTripRow(data, { ...opts, city: opts.city ?? data.destination?.split(',')[0] });
  } else {
    console.error('usage: audit.ts --file days.json | --trip <uuid>  [--city X] [--mustdo Y] [--days N]');
    Deno.exit(2);
  }

  if (issues.length === 0) { console.log(`PASS  ${label}`); Deno.exit(0); }
  console.log(`FAIL  ${label}  (${issues.length} issue${issues.length > 1 ? 's' : ''})`);
  for (const i of issues) console.log(`  ${i.gate}${i.day != null ? ` D${i.day}` : ''}: ${i.detail}`);
  Deno.exit(1);
}
