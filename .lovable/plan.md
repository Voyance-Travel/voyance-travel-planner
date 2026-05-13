# "Calculating…" Spinner Never Resolves

## Root cause

The header spinner is driven by `isBudgetCalculating = isBudgetGenerating || financialSnapshot.loading` (`EditorialItinerary.tsx:3778`). `financialSnapshot.loading` flips false at the end of `fetchData`, so the live offender is `isBudgetGenerating`.

`useTripBudget.isGenerating` reads `summary.isGenerating`, which `tripBudgetService.getBudgetSummary` derives as:

```
['queued','generating','partial'].includes(trips.itinerary_status)
```

…and `useTripBudget` polls every 4 s while that flag is true (`refetchInterval`).

Verified in DB — all three reproed trips (Montreal `70f165a8…`, San Juan `fea55309…`, Mexico City `5f54686e…`) have:

```
itinerary_status = 'partial'
metadata.itinerary_frozen_at IS NOT NULL
3 / 3 days populated, every day ≥ 3 activities
chain_error / generation_error: NULL
```

The chain final-pass in `action-generate-trip-day.ts:2808` requires `noFailedDays` to flip status to `'ready'`. `noFailedDays` reads `metadata.failed_day_numbers` — and that array is **never cleared** when a previously failed day succeeds on retry. So a trip that fails day 2 once, retries it successfully, and then completes day 3 stays `'partial'` forever even though all days are real and complete. Status is also `'partial'` in plain "almost-but-not-quite-meaningful" cases (`hasEnoughMeaningful` false).

`'partial'` is a terminal state — no further writes are coming — but the FE treats it as "still generating", polls forever, and never lets the spinner resolve.

## Fix — three layers

### 1. FE: treat frozen + non-active statuses as done

**`src/services/tripBudgetService.ts`** (~L658) — also select `metadata` and exclude `partial` once the itinerary is frozen:

```ts
const { data: tripRow } = await supabase
  .from('trips')
  .select('itinerary_status, metadata')
  .eq('id', tripId).maybeSingle();

const status = (tripRow?.itinerary_status as string | undefined) ?? '';
const frozenAt = (tripRow?.metadata as any)?.itinerary_frozen_at;
// 'partial' is terminal — no more writes are coming. Only the truly-active
// statuses keep the calculating spinner alive. `frozenAt` is belt-and-suspenders
// for any future status added to the active set.
const isGenerating =
  (status === 'queued' || status === 'generating') && !frozenAt;
```

This kills the permanent spinner on every existing stuck trip, stops the 4 s polling loop, and is forward-safe: any future generator path that legitimately needs more writes still flips status to `generating` first.

### 2. FE: snapshot resilience

**`src/hooks/useTripFinancialSnapshot.ts`** `fetchData` has no try/catch. If a Supabase call ever throws (offline, auth blip, RLS denial), `loading` stays `true` forever and the header spinner sticks. Wrap the body in try/catch with `finally { setData(prev => ({ ...prev, loading: false })) }` so a transient failure surfaces as $0 + a console.warn, not a permanent spinner. Existing happy path and event listeners untouched.

### 3. BE: close the chain leak + one-shot backfill

**`supabase/functions/generate-itinerary/action-generate-trip-day.ts`** (final-pass, ~L2770–2810):

- After computing `allDaysHaveActivities && dayCountMatches && hasEnoughMeaningful`, if those three are true, clear stale `failed_day_numbers` from the metadata write so a previously-failed-then-recovered day no longer pins the status to `partial`. Concretely: when persisting the final update (`extraUpdate.metadata`, ~L3379), set `failed_day_numbers: isComplete ? [] : (current ?? [])` and recompute `isComplete` after the clear (or just compute it ignoring `failed_day_numbers` when the recovery conditions are met).
- Keep the `partial` status path for the genuinely-still-broken cases (empty days, bare itineraries) so we don't paper over real failures.

**One-shot migration** — backfill the trips already stuck. Owner-safe, idempotent:

```sql
UPDATE public.trips
SET itinerary_status = 'ready',
    metadata = metadata - 'failed_day_numbers'
WHERE itinerary_status = 'partial'
  AND metadata ? 'itinerary_frozen_at'
  AND itinerary_data ? 'days'
  AND (
    SELECT bool_and(jsonb_array_length(coalesce(d->'activities','[]'::jsonb)) >= 3)
    FROM jsonb_array_elements(itinerary_data->'days') d
  );
```

## Files

- `src/services/tripBudgetService.ts` — ~L650-660
- `src/hooks/useTripFinancialSnapshot.ts` — wrap `fetchData` body
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — final-pass status + `failed_day_numbers` clear
- New migration: `*_unstick_partial_frozen_trips.sql`
- Memory: new `mem://constraints/itinerary/calculating-spinner-resolves` entry; index update

## Acceptance

- All 3 stuck trips (Montreal/SJU/CDMX) load with `itinerary_status='ready'` after the migration; spinner resolves on first frame.
- A future trip that has day 2 fail-then-succeed in the chain reaches `ready`, not `partial`.
- A genuinely incomplete trip (one fully empty day) still shows `partial` and the spinner remains until the user regenerates that day — by design.
- A transient Supabase fetch error in `useTripFinancialSnapshot` no longer wedges the spinner; total reads $0 with a console.warn until the next event-driven refetch.

## Out of scope

- BudgetTab "Calculating…" pill (`BudgetTab.tsx:950`) — same `isGenerating` source, fixed by layer 1 automatically.
- The misc-reserve / orphan-archival logic — unrelated.
- TransitPreview's local "Calculating" — different code path (per-leg), not implicated.
