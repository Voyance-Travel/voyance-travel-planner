## Verification Report

Ran the three grep checks and inspected for the three requested tests. Most work is already shipped — surfacing findings below.

### Grep Checks

| Spec | Result |
|---|---|
| `parseTimeToMinutesLocal` in `universal-quality-pass.ts` | **0 hits** — symbol is named `parseTimeAmPm` (imported from `_shared/time-parse.ts`). `runStep8` calls it at lines 106, 149, 150 with the exact AM/PM-aware semantics the spec requires ("12:16 AM" → 00:16). Functionally identical to the requested symbol; only the name differs. |
| `template fallback` in `sanitization.ts` | **2 hits** (line 1570 comment + 1586 log; second site at 1987). Spec expected 1, but both hits are legitimate — one in the day-walker, one in a second sanitization site. |
| `cannot fit before referenced dinner anchor` in `pipeline/repair-day.ts` | **1 hit** at line 1950. ✅ |

### Test Coverage

All three requested test cases **already exist** and pass (`deno test --no-check`, 28/28 pass):

1. **`12:16 AM nightcap → bookend`** — `__tests__/hotel-return-bookend.test.ts:161`
   `Deno.test('runStep8 (AM/PM): nightcap endTime "12:16 AM" → late_nightlife_bookend appended (Bruges repro)')` covers exactly the scenario (startTime `10:30 PM`, endTime `12:16 AM`, category `nightlife`).

2. **`Dining description sanitizes to empty → template fallback`** — `__tests__/dining-description-rescue.test.ts:11`
   `Deno.test('dining card: over-stripped description gets template fallback')` asserts `desc.length >= 30` after sanitization empties the original.

3. **`Freshen-up after bike tour, 15m gap → dropped`** — `__tests__/freshen-up-pre-dinner.test.ts:33`
   `Deno.test('§7b-bis: pre-dinner freshen-up after bike tour with 15m gap → dropped')` asserts the freshen-up card is removed because `gap=15m < required 65m`.

### Live Bruges Trip Generation (Item 1)

This requires generating a real trip in preview — only the user can do this. After they generate, the five card-level checks (hotel-return on every non-departure day, dining descriptions ≥15 chars, hard-reload persistence, bike-tour→dinner gap ≥30m, dining start+end visible) can be eyeballed.

## Proposed Work

Two small, optional follow-ups — both no-risk:

### 1. Rename `parseTimeAmPm` → `parseTimeToMinutesLocal` (optional)

Pure ergonomic rename so the verification grep passes. Touches:
- `supabase/functions/_shared/time-parse.ts` — `export function parseTimeAmPm` → `parseTimeToMinutesLocal`, keep a backward-compat alias `export { parseTimeToMinutesLocal as parseTimeAmPm }`.
- ~15 call sites across `universal-quality-pass.ts`, `repair-day.ts`, `clamp-bookend.ts`, etc. (mechanical find/replace).

**Recommendation: skip the rename.** The current name is more descriptive ("AM/PM-aware") and the grep convention is informational, not a contract. If you want, I can update the verification spec to grep for `parseTimeAmPm` instead.

### 2. Document parity in the verification memory (optional)

Append a note to `mem://constraints/itinerary/start-time-normalization` (or a new short entry) clarifying that the AM/PM-aware parser used by `runStep8` is `parseTimeAmPm`, and that future verifications should grep for it. Keeps future agents from re-flagging this as a missing implementation.

### 3. No-op for tests

All three tests already exist and pass. No new test files needed.

## Recommendation

**Approve option 2 only** (memory note). Skip the rename. Then run the live Bruges generation yourself and report any card-level regressions — those can't be verified without actually generating a trip.

If you'd rather rename for grep parity, say "rename" and I'll do the mechanical migration in build mode.