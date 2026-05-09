# R3.8 — Idempotency for booking-state transitions

## Background

The original report assumed duplicate Stripe webhooks could write duplicate rows to `booking_state_logs`. Investigation shows:

- The table referenced by the RPC (`public.booking_state_log`) was **deliberately dropped** in migration `20260125212256` along with other legacy booking tables.
- `transition_booking_state` still ends with `INSERT INTO booking_state_log (...)`. That INSERT errors on every call, aborting the transition transaction. This is a latent bug that almost certainly caused state transitions to silently fail in production.
- The real audit trail today is the `state_history` JSONB array appended to `trip_activities` earlier in the same RPC.

So R3.8 has two pieces: make the JSONB append idempotent on `trigger_reference`, and remove the dead INSERT that's been swallowing every transition.

## Migration: rewrite `transition_booking_state`

Single migration that `CREATE OR REPLACE FUNCTION`s the RPC. Behavior changes:

1. **Remove** the trailing `INSERT INTO booking_state_log (...) VALUES (...)` block entirely. The table no longer exists.
2. **Idempotency short-circuit**: before the `UPDATE trip_activities`, when `p_trigger_reference IS NOT NULL`, check whether the most recent element of `state_history` already matches both `new_state = p_new_state` and `trigger_reference = p_trigger_reference`. If so, return early:
   ```json
   { "success": true, "idempotent": true, "previous_state": ..., "new_state": ... }
   ```
   No state mutation, no duplicate history entry. Webhook callers treat this as success.
3. **Persist `trigger_reference` in the JSONB entry**. Today the appended `state_history` element only stores `{from, to, at, by}`. Extend it to also include `trigger_source` and `trigger_reference` so the idempotency check has something to look at and the audit trail actually records the Stripe session/charge id.
4. Everything else (auth check, allowed-transition matrix, `booking_state` / `booked_at` / `cancelled_at` / `refunded_at` writes) stays exactly as-is.

Detection logic uses `jsonb_path_exists` against the array (or `state_history -> -1 ->> 'trigger_reference'` if we only want to dedupe the immediately-previous transition — same outcome for the webhook double-fire case).

## Webhook side

No code change in `stripe-webhook/index.ts` is required. Both call sites (lines 286 and 767) already pass `p_trigger_reference` (Stripe session/charge id). The new `idempotent: true` field is additive — existing error handling continues to work.

Optional follow-up note (not in this change): the `if (!stateError)` branches will start succeeding on duplicates instead of erroring. That's the intended behavior for an idempotent endpoint.

## Out of scope

- Re-creating the `booking_state_log` table. The team retired it; we're not bringing it back.
- Changing the trigger_reference values the webhook sends.
- Backfilling historical `state_history` entries with trigger_reference (only forward-looking transitions get the new fields).
- Any change to `trip_payments` UNIQUE constraints (already handles payment-row dedup correctly).

## Verification

1. Replay the same Stripe webhook twice against a test trip → first call returns `success: true, idempotent: false`, second returns `success: true, idempotent: true`. `state_history` array length grows by exactly 1.
2. Call the RPC normally from any other code path with a fresh `p_trigger_reference` → state transitions and history grows as before.
3. Confirm in logs that `transition_booking_state failed` warnings (from the dead INSERT) stop appearing for fresh transitions.

## Memory

Add a Core entry under "Stuck Pending Payment Recovery" referencing the new idempotency contract so future webhook handlers know they can rely on it.
