## Goal

Stop showing the generic red "Your itinerary is missing activities / Regenerate itinerary" banner for trips that have a full plan but failed a soft integrity check (flight-anchor mismatch, orphan transit, missing meal coverage). Show an accurate, code-specific message instead. Reserve the generic banner + Regenerate CTA for the one case it's actually correct: the LLM returned an empty activities array.

## Where the banner lives

`src/components/itinerary/EditorialItinerary.tsx` lines 6238–6267. Today its only gate is:

```ts
itineraryStatus === 'failed' &&
(generationFailureReason === 'empty_itinerary' ||
 generationFailureReason === 'incomplete_itinerary')
```

The same metadata that drives the gate also carries `metadata.integrity_contract.codes: string[]` (written by `applyIntegrityContractToFreezeStamp` in `supabase/functions/_shared/itinerary-integrity-contract.ts`, and surfaced as `integrityContract` at EditorialItinerary line 3127). We'll consume it here.

## What to build

### 1. Code → copy map (new small helper)

New file `src/lib/itinerary/integrityBannerCopy.ts`:

- `integrityCodeMessage(code: string): { title: string; body: string } | null` covering at minimum:
  - `FLIGHT_ANCHOR_COMMIT_MISMATCH` → "Flight arrival time couldn't be confirmed" / "Your schedule may be slightly off near arrival — double-check the first activity's start time."
  - `FINAL_ORPHAN_TRANSIT` → "One transit connection needs adjustment" / "A taxi or transfer doesn't line up with the next stop. You can edit or remove it from the day."
  - `MEAL_COVERAGE_MISSING` → "Some meals couldn't be scheduled" / "One or more days are missing a breakfast, lunch, or dinner slot."
- `pickBannerVariant(opts)` that, given `itineraryStatus`, `generationFailureReason`, `integrityCodes`, and `meaningfulActivityCount`, returns one of:
  - `{ kind: 'empty', ... }` — only when `generationFailureReason === 'empty_itinerary'` OR `meaningfulActivityCount === 0`. Generic copy + Regenerate CTA. (Today's behavior, preserved.)
  - `{ kind: 'incomplete', ... }` — only when `generationFailureReason === 'incomplete_itinerary'` AND `meaningfulActivityCount === 0` (degenerate hotel-only / single-filler trip). Generic copy + Regenerate CTA.
  - `{ kind: 'integrity', items: Array<{ code, title, body }> }` — when status is `partial` OR `failed` with non-empty `integrity_contract.codes` AND meaningful activities exist. Amber, NO Regenerate CTA (these are soft, fixable inline).
  - `null` — nothing to show.

Drop unknown codes silently; if all codes are unknown, return `null` (don't render an empty amber box).

### 2. EditorialItinerary wiring

In `EditorialItinerary.tsx` near the existing banner (≈6238):

- Pull `integrityCodes = (parsedMetadata?.integrity_contract?.codes ?? []) as string[]` and `meaningfulCount = days.reduce((n, d) => n + (d.activities?.filter(isMeaningful).length ?? 0), 0)` (reuse the existing `classifyItineraryCompleteness` count if convenient — call it once and memoize).
- Replace the existing JSX block with a single `bannerVariant = pickBannerVariant(...)` switch:
  - `empty` / `incomplete` → render the current red destructive banner verbatim (copy unchanged, Regenerate CTA unchanged).
  - `integrity` → render an amber (`bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200`) banner listing each item's title; expand to body on first item, additional items as a compact list. No Regenerate CTA. Keep dismissible behavior consistent with other amber notices (no persistence required).
  - `null` → render nothing.

No other call sites change. `BudgetTab.tsx`'s `isEmptyItineraryFailure` / `isIncompleteItineraryFailure` paths stay as-is — they already gate on `tripStatus === 'failed'` and don't surface integrity codes.

### 3. Tests

New `src/lib/itinerary/__tests__/integrityBannerCopy.test.ts`:

- empty itinerary → `kind: 'empty'`
- incomplete + 0 meaningful → `kind: 'incomplete'`
- partial + `['FLIGHT_ANCHOR_COMMIT_MISMATCH']` + 12 activities → `kind: 'integrity'` with one item
- partial + `['FINAL_ORPHAN_TRANSIT', 'MEAL_COVERAGE_MISSING']` → two items, ordered as passed
- partial + unknown code only → `null`
- ready + no codes → `null`

## Out of scope

- No backend / integrity-contract changes.
- No changes to commit-gate / freeze-stamp logic.
- No changes to BudgetTab or PaymentsTab.
- No new dismiss-state persistence (not requested).

## Files touched

- New: `src/lib/itinerary/integrityBannerCopy.ts`
- New: `src/lib/itinerary/__tests__/integrityBannerCopy.test.ts`
- Edit: `src/components/itinerary/EditorialItinerary.tsx` (banner block ~6238–6267 + tiny memo for codes/meaningfulCount above it)
