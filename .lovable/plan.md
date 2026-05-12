## Status: Already implemented in the previous turn

All requested changes are already in the codebase. Verified just now:

### Backend gate — `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- Line 187–188: reads `skipLedgerCheck` + `saveReason` from request body.
- Line 770–780: `ledgerCheck` is gated behind `if (!skipLedgerCheck)`. When skipped, logs `[save-itinerary] ledgerCheck SKIPPED reason=<saveReason>` and uses `itineraryDays` verbatim (no removal, no insertion).
- Meal-guard pass at lines 360–500 is left unconditional (inject-only — never removes), as specified.
- No other destructive `itineraryDays = …` / `.splice` / `.filter` mutation was added behind the flag because none exists outside `ledgerCheck`'s writeback (terminalCleanup/scrub passes only mutate per-activity fields, not the days array).

### Meal exemption — `supabase/functions/generate-itinerary/ledger-check.ts`
- Lines 297–313: `repeat_already_done` block exempts rows whose category ∈ `{dining, restaurant, breakfast, brunch, lunch, dinner, cafe}` OR title matches `/\b(breakfast|brunch|lunch|dinner|supper|nightcap)\b/i`. Logs `[ledger-check] meal-recurrence exempted day=N title=…`.

### Self-heal callers — `src/pages/TripDetail.tsx`
All page-load self-heal `save-itinerary` invocations thread `skipLedgerCheck: true` with a labelled `saveReason`:
- L711 local-sync → `self-heal-local-sync`
- L1320 rebuild-from-tables → `self-heal-rebuild-from-tables`
- L1446 / L1455 version restore (direct invoke + safeUpdate fallback) → `self-heal-version-restore` / `…-fallback`
- L1501 / L1510 empty-day placeholder (direct invoke + safeUpdate fallback) → `self-heal-empty-day-placeholder` / `…-fallback`

### Plumbing — `src/services/safeUpdateItineraryData.ts`
- L31, L127: `skipLedgerCheck` + `reason` options forwarded into the `save-itinerary` body.

### Mutating callers correctly NOT flagged
- `src/services/itineraryActionExecutor.ts:952` (chat actions) — destructive ledgerCheck is the legitimate path here, flag intentionally absent.
- Generation pipeline's terminal save in `generation-core.ts` — flag intentionally absent.

### Memory + tests
- `mem://constraints/itinerary/ledger-check-mutation-only` is in Core index.
- Deno test `ledger-check.test.ts` and Vitest `selfHealSkipsLedger.test.ts` were added in the prior turn.

## Nothing to do

If you've reloaded Faro/Bruges/Istanbul and meals are STILL eroding, the failure is somewhere else (e.g. a self-heal path I missed, or `itineraryActionExecutor` being invoked during reload). Reply with the specific trip + reload sequence and I'll trace from the `[save-itinerary] ledgerCheck SKIPPED` log — if you see the log, the gate is working; if you don't, there's another save path that needs the flag.