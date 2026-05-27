
## What the user is seeing

- Trip `96d47894…` (Barcelona) has `budget_include_hotel = false` (the Start form defaults `includeHotelInBudget || false`).
- `activity_costs` Day 0 has a real `hotel` row at $250 (Hotel Arts Barcelona, written by `logistics-sync`); the other rows sum to ~$22.50, which rounds to "$23".
- `useTripFinancialSnapshot` honors the toggle (`if (cat === 'hotel' && !includeHotel) continue`) and intentionally returns `effectiveHotelCents = 0` + `tripTotalCents ≈ $23`. `useDisplayedTripTotal` → `computeHeaderStripValues` then renders the headline as $23 with no hotel chip.
- The math is doing what the documented Budget Visibility Policy says — **but the UI gives the user zero signal** that a known $250 cost was deliberately excluded. The headline reads as "your whole trip = $23" while the Payments tab still surfaces "Hotel Arts Barcelona — $250" elsewhere, which is the disconnect the user is calling out.

## Goal

Keep the toggle-driven math exactly as-is. Make the exclusion **visible and self-explanatory** in the itinerary header so the $23 number is never read in isolation. Presentation-only change — no snapshot / resolver / DB edits.

## Approach

When the hotel (or flight) toggle is OFF **and** the snapshot knows a real cost exists for that category, the header should:

1. Tag the headline so it's not mistaken for the full trip cost.
2. Render a muted, strikethrough-style "excluded" chip in the equation row so users can see what's been opted out and how much it's worth.

Both signals come from data the snapshot already exposes (`includeHotel`, `includeFlight`, `canonicalHotelCents`, `canonicalFlightCents`, `manualHotelDelta`, `manualFlightDelta`). No new queries.

## Changes

### 1. `src/hooks/useTripFinancialSnapshot.ts` (tiny additive)

Expose two convenience fields on the returned snapshot:

- `excludedHotelCents: number` — `includeHotel === false ? max(0, canonicalHotelCents + manualHotelDelta) : 0`
- `excludedFlightCents: number` — symmetric

These are derived, not stored. They tell the UI "this much real cost is being hidden by the toggle." Default fallback in the snapshot's initial/empty state is `0`.

### 2. `src/lib/itinerary/headerStripValues.ts`

Extend `HeaderStripInputs` / `HeaderStripValues` with:

- `excludedHotelUsd`, `excludedFlightUsd` (inputs, default 0)
- `excludedTotalUsd` (output = sum of the above, ≥ 0)
- `hasExcludedLogistics` (output boolean, true when > $0.50)

`displayedTripTotalUsd` math is **not changed** — toggle policy still wins. Only adds the new fields. Existing tests stay green; add one new case for the excluded-hotel branch.

### 3. `src/hooks/useDisplayedTripTotal.ts`

Pass the new excluded values through to `computeHeaderStripValues` and re-export them on `DisplayedTripTotal` so any future consumer (PaymentsTab badge, etc.) can use the same numbers.

### 4. `src/components/itinerary/EditorialItinerary.tsx` — header row (around L6255–6450)

Two presentational tweaks:

**a. Headline label (Row 1, line ~6259)** — when `hasExcludedLogistics` is true, change the small "Trip Total" caption next to the number to read **"Trip Total · activities only"** (muted suffix). Tooltip on the suffix: "Hotel $250 and/or Flight $X are excluded by your budget settings. Toggle them on under Budget to include."

**b. Equation row (around L6418–6436)** — after the existing `= Trip Total $X` segment, append a muted, strikethrough chip per excluded category when the cost is known:

```text
Days $23  =  Trip Total $23     ·  Hotel $250 (excluded)
```

Visual treatment:
- Wrapper: `text-muted-foreground/60 line-through decoration-muted-foreground/40`
- Separator: `·` (not `+`) so it's clearly outside the equation
- Click target opens the Budget tab (existing `onTabChange?.('budget')` plumbing in the file)
- Suppressed entirely when `hasExcludedLogistics` is false → zero impact on trips with toggles on

### 5. Tests

- `src/lib/itinerary/__tests__/headerStripValues.test.ts` — add cases: hotel-only excluded, flight-only excluded, both excluded, neither (regression).
- Component-level smoke isn't needed — purely cosmetic surface that mirrors the strip values.

## What stays the same

- Toggle policy: hotel/flight rows still excluded from `tripTotalCents` when the toggle is off.
- PaymentsTab numbers, BudgetTab numbers, day badges — none affected.
- No DB writes, no migrations, no edge functions.
- No new snapshot fetches; the data is already in memory.

## Verification

Manual on the Barcelona trip (`96d47894…`):
- Header headline reads "Trip Total · activities only  $23"
- Equation row ends with "· ~~Hotel $250~~ (excluded)" muted text
- Hover/click suffix or chip → tooltip / opens Budget tab

If the user flips `Include Hotel in Budget` ON: headline reverts to plain "Trip Total", strikethrough chip disappears, $23 becomes $273 via the existing snapshot path.

