# Fix overlap detection bypass in TripHealthPanel

Replace the day-wide `allTimed` early-return gate with a per-pair gate so one untimed stub card no longer silences all overlap warnings on its day (Rome regression: 5 visible overlaps hidden).

## Changes — `src/components/trip/TripHealthPanel.tsx`

### 1. Lines 270–277 — replace the gate

Remove the `allTimed`/early-return block and replace it with a populate-only pass that collects ids of untimed non-transit activities into `_untimedIds`. Comment marks this as the "Per-pair gate" with a "Rome regression" note.

### 2. Conflict loop at line 432 — skip per pair

At the very top of the `for (let i = 0; i < timed.length - 1; i++)` body (the overlap/conflict pass), add a `continue` that skips when either endpoint id is in `_untimedIds`.

### Technical note — id field

`timed[i]` entries are produced by the `.map(({ a, idx }) => ({ source, sourceIdx, name, ... }))` at line 315–351 and do not carry a top-level `id`. The skip check must read `timed[i].source?.id` (not `timed[i].id`) to actually match the ids populated into `_untimedIds`. Without this adjustment the `continue` would be a dead branch.

Populate side uses `String(a?.id || '')` per the user's spec; the skip side will mirror with `String(timed[i].source?.id || '')` and `timed[i + 1].source?.id`.

### 3. Buffer loop at line 491

Same per-pair `continue` guard added at the top of the missing-buffer loop, for consistency (otherwise an untimed stub between two timed activities could trigger a phantom <5min buffer warning between them).

## Out of scope

- No changes to cascade-preview logic, rendered-vs-cascade drift check, or gap detection.
- No changes to which categories count as transit/hotel-return.
- No UI/styling changes.

## Acceptance

All 4 greps in the task pass:
1. `grep -n "Per-pair gate"` → 1 hit
2. `grep -n "_untimedIds"` → ≥3 hits (declare + populate + ≥1 skip; will actually be 4 with buffer-loop skip)
3. `grep -c "if (!allTimed) return"` → 0
4. `grep -n "Rome regression"` → 1 hit

## Post-deploy test

Load Rome trip → Health panel surfaces 5 overlap issues (Colosseum/Trapizzino, Regola/Trattoria, Basilica/hotel-return, E-Bike/Da Enzo, Museum/Checkout). Untimed cards adjacent to timed cards do not trigger phantom warnings.
