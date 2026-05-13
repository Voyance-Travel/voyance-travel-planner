## The bug

Budget tab "Trip Expenses" card shows a persistent **Calculating…** pill (and `animate-pulse` on the price). The recent fix to `getBudgetSummary.isGenerating` (mem: *Calculating Spinner Resolves*) excluded `status='partial'` and any frozen status, but it does **not** handle a trip that was abandoned mid-generation: `itinerary_status='generating'` + `metadata.itinerary_frozen_at` never stamped.

Three such ghost trips currently live in the DB (Venice, May 7, ~6 days ago, 0 cost rows). If a user opens one — or a fresh trip whose generation crashed before the chain orchestrator stamped `itinerary_frozen_at` — the Budget tab spinner is permanent because:

- `getBudgetSummary` returns `isGenerating: true` forever (the only false branches are non-`generating`/`queued` statuses or a frozen stamp).
- React-Query keeps polling every 4 s, but `getBudgetSummary` keeps returning `true`, so the spinner never resolves.

`useTripFinancialSnapshot.loading` already self-heals via try/catch, so the **Itinerary header** Calculating pill resolves after the first read; the **Budget tab** uses `summary.isGenerating` which has no such escape hatch — that's why the bug is now Budget-tab-specific.

## Fix

Add a stale-generation gate to `getBudgetSummary.isGenerating` so an abandoned `generating` status flips false after a sane idle window, even without `itinerary_frozen_at`. Mirror the same idea in the JSON activity_costs read so a partially-written trip (cost rows present, no frozen stamp) doesn't keep claiming "still generating".

### Steps

1. **`src/services/tripBudgetService.ts` — tighten the gate** (lines 658–664)
   Read `updated_at` alongside `itinerary_status` / `metadata`. Compute:
   ```ts
   const isLive = status === 'queued' || status === 'generating';
   const ageMs  = Date.now() - new Date(tripRow.updated_at).getTime();
   // Reasonable upper bound: chain generator finishes within 8 min for any trip.
   // After 10 min of no `updated_at` movement we treat the trip as stalled and
   // stop showing "Calculating…" (the spinner is misleading at that point).
   const STALE_GENERATION_MS = 10 * 60 * 1000;
   const isGenerating = isLive && !frozenAt && ageMs < STALE_GENERATION_MS;
   if (isLive && !frozenAt && ageMs >= STALE_GENERATION_MS) {
     console.warn(`[getBudgetSummary] stale generation detected — flipping isGenerating off (tripId=${tripId} status=${status} ageMs=${ageMs})`);
   }
   ```
   This also kills the 4 s polling loop the moment we judge the trip stalled.

2. **`src/services/tripBudgetService.ts` — heal cost rows** (no row migration needed; the gate is read-side only). The 3 stale Venice trips have 0 cost rows so they show $0 anyway — once the spinner resolves the user sees a sensible empty Budget tab and can retry generation.

3. **`src/hooks/useTripFinancialSnapshot.ts`** — no change required. Its `loading` flag already self-heals via try/catch and the `isBudgetGenerating || snapshot.loading` gate on the Itinerary header was previously fixed. We add no new behavior here; the bug is summary-side only.

4. **Backfill (optional, single SQL migration)** — flip the 3 abandoned Venice trips so they appear correctly in trip lists:
   ```sql
   UPDATE trips
   SET    itinerary_status = 'failed',
          metadata          = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('failure_reason','stale_generation_cleanup_2026_05_13')
   WHERE  itinerary_status  = 'generating'
     AND  updated_at         < now() - interval '1 day'
     AND  (metadata->>'itinerary_frozen_at') IS NULL;
   ```
   This is a one-shot consistency cleanup, not required for the spinner fix.

5. **Test (`src/services/__tests__/tripBudgetService.test.ts` — add or extend)**
   - "isGenerating=true when status=generating, no frozen stamp, updated_at recent"
   - "isGenerating=false when status=generating, no frozen stamp, updated_at > 10 min ago" ← the bug case
   - "isGenerating=false when status=generating + frozen_at set" (existing)
   - "isGenerating=false when status=ready" (existing)

6. **Memory** — extend `mem://constraints/itinerary/calculating-spinner-resolves` with: "Stale-generation gate: `getBudgetSummary` flips isGenerating false when `now − trips.updated_at > 10 min`, even if status is still `generating`. Closes ghost-trip Calculating pill on Budget tab when chain orchestrator crashed before `itinerary_frozen_at` stamp."

### Verification

- Open one of the 3 May-7 Venice trips → Calculating pill no longer renders, Budget tab shows $0 with "Estimated total for N travelers" copy.
- A genuinely live generation (status=generating, updated within last few minutes) still shows Calculating.
- Unit tests pass.

### Out of scope

- Auto-restarting stalled generations. That's a separate "stuck trip recovery" UX (existing `incomplete-generation-recovery` feature) — this plan only fixes the misleading spinner.
- Itinerary header Calculating pill (already fixed by the snapshot-loading try/catch + `partial`/frozen exclusion).
