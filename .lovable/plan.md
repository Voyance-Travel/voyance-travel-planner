# Clean up the two console errors

The itinerary still loads — both errors are noise, not functional breakage — but they shouldn't show in console. Two unrelated issues, one fix each.

## 1. `422` from `generate-itinerary` (save-itinerary)

**What's happening**
- `action-save-itinerary.ts` line 1478 returns HTTP **422** with `code: 'NEEDS_REGENERATION'` whenever the persist-time validator (`_shared/validate-itinerary-for-persist.ts`) finds any per-day issue (missing meal, empty dining description, predawn card, etc.).
- The trip still saves (`persistedDespiteErrors: true`), which is why the itinerary renders.
- Per the **Persist-Issues Toast User-Only** memory, the front-end already suppresses the toast for `self-heal-*` / `skipLedgerCheck` reasons, but the underlying `fetch` still resolves with HTTP 422 — so Chrome logs `Failed to load resource: 422` to the console regardless of how the client handles the body.
- The two 422 hits in the trace line up with two page-load self-heals firing into save-itinerary.

**Fix**
- Change the validation-failure branch in `action-save-itinerary.ts` to return **HTTP 200** with the same `success: false, code: 'NEEDS_REGENERATION'` body. The body already carries `persistedDespiteErrors: true` plus the errors/warnings arrays, so every client-side branch that today reads `code === 'NEEDS_REGENERATION'` keeps working — they just don't surface as a red console error.
- Reserve real non-200 status only for hard failures (auth, db write error, etc.), which already use `errorJson`.

This mirrors how other "soft" verdicts are already returned (e.g. cost-repair writes a 200 with `success: false`). No behavior change for the user; only the console noise goes away.

## 2. `<circle> attribute r: Expected length, "undefined"` from `motion-*.js`

**What's happening**
- The chunk name `motion-*` = framer-motion. The only `motion.circle` elements in the codebase that animate `r` are in `src/components/planner/shared/GenerationAnimation.tsx` (lines 87–108): three `<motion.circle>` with `animate={{ r: [52, 72] }}` style keyframes.
- During the very first frame, framer-motion can emit an interim DOM update where `r` is `undefined` if the initial `r` was set as a JSX attribute (not as a `style`/`initial`). That triggers exactly the "Expected length, undefined" warning.

**Fix**
- For each animated `<motion.circle>` in `GenerationAnimation.tsx`, also pass `initial={{ r: <number> }}` matching the first keyframe (52 / 48 / etc.). framer-motion then has a known starting numeric value and never momentarily writes `undefined` to the DOM attribute.
- Leaves the visual identical.

## Out of scope

- The underlying persist-validator errors (real "needs regeneration" issues) — those are surfaced via the existing in-app banner system and are tracked separately. This change only stops them from polluting the browser console.
- The unrelated `403` resource line in the trace looks like a third-party asset (not generate-itinerary); will investigate only if it persists after these two changes.

## Files to touch

- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (one return statement, ~L1469–1478)
- `src/components/planner/shared/GenerationAnimation.tsx` (add `initial={{ r }}` to ~3 motion.circle elements)
