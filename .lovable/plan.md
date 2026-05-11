## M4 — Walk-over-threshold leak (Palacio Real → DiverXO 1h27m walk)

### Diagnosis

Contrary to the brief, the WALK_OVER_THRESHOLD validate→repair→gate cascade **already exists** with the canonical 30 min / 1500 m thresholds (`supabase/functions/_shared/transit-mode.ts`, wired into `validate-day.ts:1149`, `repair-day.ts:3568`, `validation-gate.ts:100`, plus the post-LLM sanitizer `enforceTransitModeByDistance` in `sanitization.ts:878`). A 1h27m / ~3.5 km walk *should* have been caught — so the bug is a **detection leak**, not a missing rule.

Two concrete leak paths in the current code:

**Leak 1 — Title-only walk cards bypass the validator.** `checkWalkOverThreshold` (validate-day.ts:1154-1155) hard-gates on `transportation.method ∈ {walk, walking}`:

```ts
const method = String(t.method || '').toLowerCase();
if (method !== 'walk' && method !== 'walking') continue;
```

If the LLM emits a card titled `"Walk to DiverXO"` with category `transport` but **omits or empties** `transportation.method` (a recurring failure mode — the title alone implies the mode), `isTransitActivity` accepts it but the method gate skips it. The sanitizer in `sanitization.ts:890` already handles this with a `titleStartsWalk` fallback; the validator does not. This is the most likely root cause for Madrid.

**Leak 2 — Sanitizer needs both endpoint coords.** `enforceTransitModeByDistance` (sanitization.ts:894-904) returns `false` whenever `extractCoords(prev)` or `extractCoords(next)` fails. On Day 1 generation, before venue enrichment fully populates `location.coordinates` on every card, prev/next coords are routinely absent → sanitizer no-ops → walk survives until validate-day, where Leak 1 lets it through too.

**Leak 3 — Repair fallback ignores known coords.** Repair §15b (repair-day.ts:3584) uses `pickTransitFallback(distM > 0 ? distM : null, ...)` — if the LLM didn't stamp `distanceMeters` on the transit block, repair defaults to a 20-min taxi at $15 instead of computing haversine from the surrounding activities' coords (which are usually present by the repair stage post-enrichment).

### Fix

All work is in **one shared file** + **two pipeline files** + **one test file**.

#### 1. `supabase/functions/generate-itinerary/pipeline/validate-day.ts` — close Leak 1

In `checkWalkOverThreshold`, mirror the sanitizer's title fallback so an empty/missing method doesn't bypass the hard threshold:

```ts
const titleStartsWalk = /^\s*(?:walk|walking|stroll)\b/i.test(act.title || act.name || '');
const isWalkLike = method === 'walk' || method === 'walking' || (method === '' && titleStartsWalk);
if (!isWalkLike) continue;
```

Also extend the duration-inference cascade (lines 1156-1179) to read `act.durationMinutes` / `act.duration_minutes` / `act.duration` if `transportation.duration*` are missing — so a card with `durationMinutes: 87` at the top level still flags.

#### 2. `supabase/functions/generate-itinerary/sanitization.ts` — close Leak 2

In `enforceTransitModeByDistance`, when prev/next coord lookup fails, accept a duration-only signal:

```ts
if (!originCoords || !destCoords) {
  // Fallback: if the card itself has a duration > MAX_WALK_DURATION_MINUTES,
  // override mode without distance — duration alone proves it's not a real walk.
  const durMin = Number(t?.durationMinutes) || parseDurationStr(t?.duration) || 0;
  if (durMin > MAX_WALK_DURATION_MINUTES) {
    /* override to uber/metro using pickTransitFallback(null, durMin, destName) */
  }
  return false;
}
```

This eliminates the "needs both endpoints" silent skip without introducing false positives (we only act when we already know the duration exceeds the walking ceiling).

#### 3. `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — close Leak 3

In §15b, before calling `pickTransitFallback`, attempt a haversine derive from `activities[idx-1]?.location` and `activities[idx+1]?.location` (using the existing `extractCoords` + `haversineMeters` from `_shared/transit-mode.ts`). Pass the computed distance into `pickTransitTier` so the resulting tier reflects real geography (metro under 5 km, rideshare beyond) instead of always defaulting to a 20-min taxi.

#### 4. (Optional, deferred) Luxury-tier tighter caps

The brief proposes lowering thresholds to 20 min / 1 km for splurge / luxury archetypes. The three leaks above are the primary bug — once fixed, the existing 30 min / 1500 m ceiling already catches the Palacio Real → DiverXO case. **Recommend deferring** the luxury sub-cap until we confirm the leak fix alone resolves the recurring pattern; otherwise we risk over-converting in-neighborhood walks that luxury travelers genuinely want (Plaza Mayor → Mercado de San Miguel, etc.). Will add as a follow-up if needed.

### Tests (`__tests__/walk-over-threshold.test.ts`)

Add three regression cases:

1. **Title-only walk, no method** — `{ title: 'Walk to DiverXO', category: 'transport', startTime: '12:30', endTime: '13:57', transportation: {} }` → flags critical.
2. **Top-level duration only** — `{ title: 'Walk to Salamanca', transportation: { method: 'walk' }, durationMinutes: 87 }` (no transport-block duration) → flags critical.
3. **Sanitizer duration fallback** — `enforceTransitModeByDistance` on a `method=walk, durationMinutes=87` card with no coords on prev/next → mutates to uber/metro.

### Memory

Update `mem://constraints/itinerary/transit-mode-distance-guard` to document the title-only / duration-only fallback so future edits don't regress the gate.

### Out of scope

- No prompt changes (LLM behavior is best-effort; the post-LLM cascade is the contract).
- No new credit-charging behavior; repair is silent as today.
- No archetype-aware threshold (deferred per §4).