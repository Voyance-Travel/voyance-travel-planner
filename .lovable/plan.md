## Stop the reload-loop meal erosion

### Root cause (confirmed)

`TripDetail.fetchTripData()` runs self-heal effects on every hard reload (empty-day version restore + placeholder materialization, lines ~1384–1506). They re-invoke `generate-itinerary` with `action: 'save-itinerary'`, which runs `ledgerCheck` (action-save-itinerary.ts:768). `ledgerCheck` does fuzzy `repeat_already_done` removal (ledger-check.ts:288–322) — an activity on Day N whose title fuzzy-matches anything in `alreadyDone` (Days 1..N-1) is dropped, unless it is locked or matches `isDailyAnchor`. Meals are NOT in `isDailyAnchor`, so a Day-2 "Breakfast at Café X" matches Day-1 "Breakfast at Café X" → dropped → trimmed result is persisted to `trips.itinerary_data` and `itinerary_days` → next reload reads the trimmed version → loop tightens.

### Fix (two complementary guards)

**1. Skip destructive ledgerCheck on non-mutating saves.**

- Add an opt-in flag `skipLedgerCheck?: boolean` (and a `saveReason?: string` for log attribution) to the `save-itinerary` action body in `supabase/functions/generate-itinerary/action-save-itinerary.ts`.
- When set, bypass STEP 2.6 entirely (the `ledgerCheck` invocation at line 768 and the `itineraryDays = lc.days` writeback at 774–775) — still keep `dayLedgers` snapshot, fulfillment reconcile, and presentation-gate computation, all of which are non-destructive.
- All TripDetail self-heal call sites pass `skipLedgerCheck: true, saveReason: 'self-heal-<kind>'`:
  - L1444 (version-history restore save)
  - L1497 (empty-day placeholder materialization)
  - Any other reload-time save where the user has not interacted (audit `TripDetail.tsx` for `action: 'save-itinerary'` and `safeUpdateItineraryData`).
- Mutating call sites (chat actions, manual edits, refresh-day, reorder) keep the default — they should still get ledger enforcement because the user is actively changing the plan.

**2. Treat meals as recurring (anchor-class) so they survive even when ledger does run.**

In `supabase/functions/generate-itinerary/ledger-check.ts` `repeat_already_done` block (≈line 297):

- Exempt meal-category rows (`dining|breakfast|brunch|lunch|dinner|cafe` OR title matches the meal regex `\b(breakfast|brunch|lunch|dinner|supper|nightcap)\b`) from fuzzy-removal — they SHOULD repeat across days. The same canonical/venue-dedup pass is still run by the cross-day venue dedup helper for actual same-venue repetition; the looser fuzzy match here is what's eating distinct meals.
- Closure-violation pass (line 324+) is unaffected.

### Telemetry & safety

- Log a single `[save-itinerary] ledgerCheck SKIPPED reason=<saveReason>` line when bypassed.
- Add `[ledger-check] meal-recurrence exempted day=N title=…` debug when the new exemption fires.
- Existing `safeUpdateItineraryData` integrity guard already blocks shrinkage when called from React save funnels; this fix closes the path that bypasses it (direct `functions.invoke` from self-heal).

### Verification

- New Deno test `ledger-check.test.ts`: Day 2 "Breakfast at Cafe Aurora" with Day 1 "Breakfast at Cafe Aurora" in `alreadyDone` is preserved; non-meal duplicate (Louvre) is still removed.
- New Vitest in `src/lib/itinerary/__tests__/`: mock `supabase.functions.invoke` and assert TripDetail self-heal invocations include `skipLedgerCheck: true`.
- Manual: reload Faro/Bruges/Istanbul trips ≥3 times; meal counts stable across reloads; `[save-itinerary] ledgerCheck SKIPPED reason=self-heal-…` appears in edge logs; no `repeat_already_done` warnings on meals.

### Memory

- New constraint: `mem://constraints/itinerary/ledger-check-mutation-only` — "ledgerCheck destructive passes (`repeat_already_done`, closure-violation, vibe-clash mutate) only run when the save originates from a user mutation. Reload/self-heal saves MUST pass `skipLedgerCheck: true`. Meals are exempt from `repeat_already_done` regardless." Add to Core index.

### Files touched

- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (gate STEP 2.6)
- `supabase/functions/generate-itinerary/ledger-check.ts` (meal exemption)
- `supabase/functions/generate-itinerary/ledger-check.test.ts` (new test)
- `src/pages/TripDetail.tsx` (pass `skipLedgerCheck` from self-heal sites)
- `src/services/safeUpdateItineraryData.ts` (forward `skipLedgerCheck` option through to backend save)
- `src/lib/itinerary/__tests__/selfHealSkipsLedger.test.ts` (new)
- `mem://constraints/itinerary/ledger-check-mutation-only.md` + `mem://index.md`

### Out of scope

- No change to ledgerCheck's vibe-clash, closure, or fulfillment logic for mutating saves.
- No change to the integrity guard, fingerprint, or DB-as-source-of-truth wiring (already in place from the prior fix).
- No change to `itinerary_days` table sync — once the JSON is correct, sync follows.
