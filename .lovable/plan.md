# Orphan-Transit Match Gap — Diacritics + Partial Names + Save-Time Net

## Diagnosis

`pruneOrphanTransits` (supabase/functions/_shared/orphan-transit.ts:88-91) matches a transit's "to X" target against later activities via `normalize()` + token-AND. Two real-world gaps let orphans survive the Executioner:

1. **Diacritic gap.** `normalize()` (line 36) lowercases and strips non-`\p{L}\p{N}` chars but leaves combining marks intact. So `"Walk to Cafe Chris"` → target `"cafe chris"`, while the scheduled card `"Café Chris"` normalizes to `"café chris"`. `blob.includes("cafe chris")` is false (`é` ≠ `e`), and token `"cafe"` is missing from `"café chris"` for the same reason. **Match fails → orphan never dropped.** This is the literal Amsterdam reproducer.
2. **Strict AND-token gap.** Targets like `"Walk to Anne Frank House"` produce tokens `["anne","frank","house"]`, while the real scheduled card is `"Anne Frank Museum"`. One missing token (`house`) kills the AND match.
3. **Generated-after-Executioner gap.** Repair / save-time edits that drop a destination card don't re-run the Executioner. Only universal-quality-pass + action-generate-trip-day call `pruneOrphanTransits`; **no pass runs at save-time**, so chat/edit/undo paths leak.

## Fix — 3 small changes, no behavior change for current passing tests

### 1. orphan-transit.ts — diacritic-safe normalize + relaxed token match

- Update `normalize()` to NFD-normalize and strip combining marks **before** the existing punctuation strip:
  `String(s||'').normalize('NFD').replace(/\p{M}+/gu,'').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu,' ').replace(/\s+/g,' ').trim()`
- After tokenizing `targetNorm`, drop low-signal stop tokens (`the`, `a`, `de`, `la`, `le`, `van`, `het`, `at`, `in`, `on`, `and`, `museum`, `house`, `restaurant`, `cafe`, `bar`, `hotel`) from a `significant` set — but keep them in `targetTokens` for the strict pass.
- Match logic becomes (in order): substring → strict AND on `targetTokens` (unchanged) → **new** majority match: `significant` ≥ 2 tokens AND ≥ ceil(significant.length/2) appear in blob.
- No change to logistics exemption, locked/userPinned skip, or end-of-day Case 1.

### 2. action-save-itinerary.ts — final safety-net pass

After the existing terminal cleanup / departure-day enforcement and BEFORE persist:
```ts
const { pruneOrphanTransits } = await import('../_shared/orphan-transit.ts');
for (const day of days) {
  const removed = pruneOrphanTransits(day.activities || []);
  if (removed > 0) console.warn(`[SAVE_ORPHAN_TRANSIT] day=${day.dayNumber} removed=${removed}`);
}
```
Mirrors the established defense-in-depth pattern (e.g. `[SAVE_DEPARTURE_NET]`, `[POST_CHECKOUT_PRUNE]` from memory). Locked/user-pinned rows already exempt inside the helper.

### 3. orphan-transit.test.ts — lock the new behavior

Add three cases:
- `"Walk to Cafe Chris"` with scheduled `"Café Chris"` → dropped=0 (match via diacritic-strip).
- `"Walk to Anne Frank House"` with scheduled `"Anne Frank Museum"` → dropped=0 (majority match: `anne`+`frank` of 2 significant).
- `"Walk to Bo Innovation"` with scheduled `"Lunch at Quay"` (no overlap) → dropped=1 (negative: majority match doesn't over-trigger).

## Out of scope

- Read-time orphan strip in the parser (current memory rules favor write-time fixes).
- Backfilling historical trips — Executioner runs on next save; save-time net catches legacy edits.
- Changing `isTransitActivity` detection (separate concern).
- Touching the `flight-leg-pick` parity work from the prior turn.

## Verification

- `supabase--test_edge_functions` filtered on `orphan-transit` after edits — existing 6 cases must still pass; 3 new cases must pass.
- `rg "[ORPHAN-TRANSIT]|[SAVE_ORPHAN_TRANSIT]"` in edge logs for the next Amsterdam-shaped trip will show drops at the save-time net if upstream still leaks.

## Files touched

- `supabase/functions/_shared/orphan-transit.ts` (normalize + match)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (1 net loop)
- `supabase/functions/_shared/__tests__/orphan-transit.test.ts` (3 cases)
- `mem/constraints/itinerary/orphan-transit-and-dining-strip.md` (append diacritic + save-net notes)
- `mem/index.md` (one-line bump on existing memory entry)
