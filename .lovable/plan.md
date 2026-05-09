## Scope adjustment

Of the 8 findings in your brief, only 5 remain actionable after verification:

- **#1 (share RPC anon GRANT)** — moot. Verified in DB: `anon` already holds EXECUTE on both `get_consumer_shared_trip` and `toggle_consumer_trip_share` via Postgres' default PUBLIC grant. No fix needed.
- **#2 (`purchase-smart-finish` orphaned)** — moot. Function was deleted last turn in the orphan cleanup.
- **#4 (`spend-group-credits` race)** — moot. Function was deleted last turn in the orphan cleanup.
- **#3, #5, #6, #7, #8** — all verified, all actionable.

This plan covers the 5 real items.

---

## Fix 1 — Atomic top-up for group budgets (CRITICAL, #3)

**Problem.** `topup-group-budget/index.ts` lines 88–92 read `budget.remaining_credits` then writes `budget.remaining_credits + credits`. Two concurrent top-ups read the same value and one overwrites the other, losing credits.

**Fix.** New SQL function + replace the read-modify-write with a single RPC call.

Migration:
```sql
CREATE OR REPLACE FUNCTION public.add_to_group_budget(
  p_budget_id uuid,
  p_credits   int
) RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.group_budgets
     SET remaining_credits = remaining_credits + p_credits,
         updated_at = now()
   WHERE id = p_budget_id
  RETURNING remaining_credits;
$$;

REVOKE ALL ON FUNCTION public.add_to_group_budget(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_to_group_budget(uuid, int) TO service_role;
```

Edit `supabase/functions/topup-group-budget/index.ts`: replace the `.update({ remaining_credits: budget.remaining_credits + credits })` block with `await supabaseAdmin.rpc('add_to_group_budget', { p_budget_id: budget.id, p_credits: credits })`. The single SQL `UPDATE … SET x = x + n` is atomic at the row level under the default isolation, so concurrent top-ups serialize cleanly.

No change to the personal-side deduction — that path already uses the atomic `deduct_credits_fifo` RPC.

---

## Fix 2 — Stripe checkout idempotency (#7)

**Problem.** Three checkout creators pass no `idempotencyKey`. A retry (browser refresh, network blip, double-click) creates a second session and can produce a duplicate charge if the user completes both.

**Fix.** Add a deterministic idempotency key per logical purchase intent at the SDK call site:

- `create-checkout/index.ts`: derive from `userId + priceId + (days ?? '') + (returnPath ?? '')` hashed (or just concatenated) into a short stable string. Pass as second arg to `stripe.checkout.sessions.create(params, { idempotencyKey })`.
- `purchase-trip-pass/index.ts`: key = `trip_pass:${userId}:${trip_id}`.
- `add-credits/index.ts`: key = `credit_topup:${userId}:${amount_cents}` plus a coarse time bucket (e.g. `Math.floor(Date.now()/60000)`) so legitimate repeat top-ups within the same minute still collapse but later ones don't.

This is a minimal-risk Stripe SDK feature; no schema or webhook changes required.

---

## Fix 3 — Require idempotency key for spend-credits (#8)

**Problem.** `spend-credits/index.ts` checks for `metadata.idempotencyKey` only if the client provides one. Frontends that forget it can double-charge on retries.

**Fix.** For high-value actions (the existing `HIGH_VALUE_ACTIONS` list at line ~580: `trip_generation`, `smart_finish`, `hotel_optimization`, `regenerate_trip`), reject the request with HTTP 400 when `metadata.idempotencyKey` is absent. Other actions remain best-effort. This forces callers of expensive flows to opt into safety without breaking cheap ones.

Audit `src/` for callers of those four actions and ensure each passes a stable key (typically `${tripId}:${action}:${attemptId}`).

---

## Fix 4 — Distinguish share-link failure modes (#5)

**Problem.** `get_consumer_shared_trip` returns `{error: 'Trip not found or sharing is disabled'}` for both states. Owners who disabled sharing and visitors with a stale link get the same opaque message.

**Fix.** Update the RPC to distinguish:
- Token doesn't match any trip → `{error_code: 'not_found', error: 'This share link is invalid.'}`
- Token matches but `share_enabled = false` → `{error_code: 'sharing_disabled', error: 'The owner has paused sharing for this trip.'}`

Update `ConsumerTripShare.tsx:99–106` to render different copy per `error_code`, with a clear CTA ("Ask the trip owner for a new link" vs "Sharing is paused").

---

## Fix 5 — Don't expose share toggle until itinerary is persisted (#6)

**Problem.** `getOrCreatePublicTripShareLink` in `src/services/publicShareLink.ts` toggles `share_enabled = true` regardless of whether `itinerary_data` has any days. A visitor following the link sees an empty trip.

**Fix.** Two parts:
1. RPC-level guard in `toggle_consumer_trip_share`: when `p_enabled = true`, refuse if `itinerary_data->'days'` is null/empty array. Return `{success: false, reason: 'itinerary_not_ready'}`.
2. UI: in the Share button's onClick handler (caller of `getOrCreatePublicTripShareLink`), surface `reason === 'itinerary_not_ready'` as a toast: "Generate your itinerary first to share it."

---

## Out of scope

- Re-creating the deleted `purchase-smart-finish` and `spend-group-credits` functions. If either is needed, that's a separate feature decision, not a bug fix.
- Refactoring the credit ledger architecture.
- Anything in findings #1, #2, #4.

## Validation

- Manual: run two simultaneous top-up requests against a test trip; confirm both deltas land.
- Manual: complete a Stripe checkout, immediately retry from the browser back button; confirm same `cs_…` session reused (or no duplicate charge).
- Manual: open share link with sharing toggled off — confirm distinct "paused" copy. Open with bogus token — confirm "invalid" copy.
- Manual: try to enable sharing on a trip with no days — confirm toast, no DB write.

## Deliverables

- 1 new migration (`add_to_group_budget` function + grants, plus updated `toggle_consumer_trip_share` body for fix 5, plus updated `get_consumer_shared_trip` body for fix 4).
- Edits in: `topup-group-budget/index.ts`, `create-checkout/index.ts`, `purchase-trip-pass/index.ts`, `add-credits/index.ts`, `spend-credits/index.ts`, `src/services/publicShareLink.ts`, `src/pages/ConsumerTripShare.tsx`, and the share-button caller component (TBD during implementation).
