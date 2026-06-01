# Plan: Checkout Backward-Anchor Enforcement

## Problem

On the last day, `compile-day-schema.ts` writes a checkout time into the prompt but nothing enforces it deterministically. The LLM emits overlapping activities (e.g., church 10:05–11:05 over 11:00 checkout) and no downstream pass repairs the overlap. The Executioner has no checkout-aware rule.

## Fix (3 layers)

### 1. Prompt hardening — `pipeline/compile-day-schema.ts`
In each last-day branch that emits a checkout time (`checkoutEnd` / `checkout` / `checkoutTime` — the 4 existing blocks around lines 451, 580, 636, 694, 774), add an explicit **HARD CONSTRAINT** line:

```
HARD: Every non-checkout, non-bookend activity scheduled BEFORE checkout MUST have endTime ≤ {checkoutStart} − 15 min. Overlapping checkout is a defect.
```

Pure prompt text addition — no logic change.

### 2. Executioner rule — `_shared/schedule-executioner.ts`
- Add new `ExecutionerCode`: `CHECKOUT_OVERLAP_TRIMMED`.
- Add counter `checkoutOverlapsTrimmed: number`.
- Add a new pass `enforceCheckoutAnchor(day, ctx, counters)` that runs only when `ctx.isLastDay`:
  1. Find the checkout activity (category `accommodation` + title regex `/check[\s-]?out/i`, or `subcategory === 'checkout'`).
  2. Compute `checkoutStart` in minutes.
  3. For every non-locked, non-bookend, non-checkout activity with `endTime > checkoutStart − 15`:
     - If `startTime ≥ checkoutStart − 15` and not user-pinned → drop it (it would have to start after checkout, which the post-checkout sequence already covers via existing logic). Emit `CHECKOUT_OVERLAP_TRIMMED` with `repaired:true`.
     - Else (activity starts earlier but ends inside the buffer) → clamp `endTime = checkoutStart − 15`; if resulting duration < 30 min, drop the activity instead. Emit `CHECKOUT_OVERLAP_TRIMMED`.
  4. Locked / user / manual / extracted / pinned rows: flag with `repaired:false` (telemetry only), never mutate — consistent with existing Universal Locking.
- Wire `enforceCheckoutAnchor` into `runScheduleExecutioner` right after the existing flight-anchor pass (1A) and before midnight-spill (1B), so cascade reflows operate on the corrected schedule.
- Extend `toExecutionerAuditCodes` to surface `EXEC_CHECKOUT_OVERLAP_TRIMMED`.

### 3. Validator audit code — `pipeline/validate-day.ts`
- Add `FAILURE_CODES.CHECKOUT_OVERLAP` (warn, not critical — Executioner repairs deterministically).
- Add `checkCheckoutOverlap(day, ctx)` on last day mirroring the executioner detection. Used for trace/telemetry parity (so audits surface legacy trips with un-repaired overlaps).

## Tests

New `supabase/functions/_shared/__tests__/checkout-anchor-enforcement.test.ts`:
- Activity 10:05–11:05 with checkout 11:00 → endTime clamped to 10:45 (15 min buffer).
- Activity 11:30–12:30 with checkout 11:00 → preserved (post-checkout window).
- Activity 10:55–11:10 with checkout 11:00 → dropped (would clamp to <30 min).
- Locked activity 10:05–11:05 → preserved, issue emitted with `repaired:false`.
- Non-last-day → no-op.

## Memory

Add `mem://constraints/itinerary/checkout-backward-anchor.md` documenting the 15-min buffer rule, three layers, sentinels (`[EXEC_CHECKOUT_OVERLAP_TRIMMED]`), and Universal-Locking exemption. Add one-line index entry under Core.

## Out of scope

- Changing the 15-min buffer to a per-hotel travel-time estimate (would require Google Distance Matrix on every last-day repair — defer).
- Re-running fill-dead-gaps after trim (existing executioner gap-refill already runs as final stage).
- Modifying the 4 different last-day prompt branches' fundamental timeline templates.
