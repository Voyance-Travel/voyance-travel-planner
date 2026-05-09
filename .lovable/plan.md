## Fix 2.2: Atomic group-budget mutations

### Current state (verified)
- `topup-group-budget/index.ts` already uses the atomic `add_to_group_budget(uuid, int)` RPC (lines 88-95). No change needed there.
- `spend-group-credits` edge function **does not exist** in this codebase (`ls supabase/functions | grep group` returns only `purchase-group-unlock` and `topup-group-budget`).
- The actual remaining non-atomic read-modify-write is in **`supabase/functions/stripe-webhook/index.ts` lines 452-502** — the `group_pool_credit_purchase` branch reads `remaining_credits` then writes `budget.remaining_credits + creditsToAdd`. Two concurrent Stripe webhooks for the same budget can lose an update.

### Changes

**1. New migration** (`supabase/migrations/<ts>_atomic_group_budget.sql`):
- Add `public.spend_from_group_budget(p_budget_id uuid, p_cost int) RETURNS jsonb` — atomic conditional decrement returning `{success:true, remaining_credits}` or `{success:false, reason:'insufficient'}`. `SECURITY DEFINER`, `search_path = public`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO service_role` (matching the pattern of existing `add_to_group_budget`). Provided defensively for the next group-spend caller; no current invoker.
- Leave existing `add_to_group_budget` untouched (already atomic and granted to `service_role`).

**2. `supabase/functions/stripe-webhook/index.ts`** (lines 491-502):
- Replace the `.from('group_budgets').update({ remaining_credits: budget.remaining_credits + creditsToAdd, ... })` block with an `rpc('add_to_group_budget', { p_budget_id: budget.id, p_credits: creditsToAdd })` call.
- The returning value becomes the new `remaining_credits`; use it in the success log on line 528 instead of recomputing `budget.remaining_credits + creditsToAdd`.
- Keep the surrounding fetch (still needed for `owner_id` / fallback-to-personal-balance check) and all logging/idempotency unchanged.

### Out of scope
- No frontend changes.
- No edits to `topup-group-budget` (already atomic).
- No new `spend-group-credits` edge function — the user's plan referenced one that doesn't exist; the spend RPC ships ready for the next caller without inventing a function nothing uses.
- No changes to `purchase-group-unlock` (it INSERTs a fresh row, not a read-modify-write).

### Validation
- Stripe webhook: re-run / replay a `group_pool_credit_purchase` event in test mode; ledger and `group_budget_transactions` rows still appear, `remaining_credits` increments by exactly `creditsToAdd`.
- `supabase--linter` after migration to catch any function-grant warnings.
