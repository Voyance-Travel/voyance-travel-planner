## Heads-up: schema mismatch in the request

The pasted snippet assumes `user_tiers.credits_remaining` exists. It does not. The actual credit infra is:

- `user_tiers(user_id, tier)` — tier label only (free / flex / voyager / explorer / adventurer). No credit columns.
- `credit_balances(user_id, purchased_credits, free_credits, free_credits_expires_at)` — the live balance cache.
- `credit_purchases` — FIFO source of truth.
- `pending_credit_charges(user_id, trip_id, action, status, idempotency_key, …)` — proof-of-charge written by `spend-credits` BEFORE deduction.
- `deduct_credits_fifo(p_user_id, p_cost)` RPC — atomic FIFO deduction.

Charging today is **client-side only** in `useGenerationGate` (`src/hooks/useGenerationGate.ts:214`): it calls `spend-credits` with `action: 'trip_generation'`, then on success the client invokes `generate-itinerary`. So a stripped/forged client can skip `spend-credits` and call `generate-itinerary` directly — that is the actual abuse vector. Rate limiting only caps the burst, not the total cost.

The fix below plugs that gap **without** inventing schema and **without** double-charging (deduction stays in `spend-credits`, owner of FIFO + idempotency + refund logic).

## Goal

Block paid-generation actions on `generate-itinerary` unless the caller has a server-side proof of charge for this trip in the last 10 minutes. Free tier with $0 balance and an empty client cannot drain LLM/Places spend.

## Gate location

`supabase/functions/generate-itinerary/index.ts`, **after** the user-auth branch resolves (~line 165, just before the rate-limit check) and **only** on the user-auth path — the existing `isServiceRoleCall` self-chain already restricts to whitelisted actions and must keep bypassing this gate so post-auth `generate-trip-day` self-calls work.

## Logic

```text
PAID_GENERATION_ACTIONS = ['generate-trip', 'generate-day', 'regenerate-day', 'generate-full']

if (!isServiceRoleCall && PAID_GENERATION_ACTIONS.includes(action)) {
  tripId = params.tripId
  if (!tripId) → 400 MISSING_TRIP_ID

  // 1. Look up balance + tier (single round-trip, both keyed by user_id)
  const [{ data: balance }, { data: tier }] = await Promise.all([
    serviceClient.from('credit_balances')
      .select('purchased_credits, free_credits')
      .eq('user_id', userId).maybeSingle(),
    serviceClient.from('user_tiers')
      .select('tier').eq('user_id', userId).maybeSingle(),
  ])
  totalCredits = (balance?.purchased_credits ?? 0) + (balance?.free_credits ?? 0)

  // 2. Look for a recent proof-of-charge for THIS trip+action
  //    Map edge action → spend-credits action label
  const SPEND_ACTION = {
    'generate-trip': 'trip_generation',
    'generate-full': 'trip_generation',
    'regenerate-day': 'regenerate_day',
    'generate-day':   'regenerate_day',  // unlock-day path uses unlock_day, but that runs through useUnlockDay → spend-credits before invoke
  }[action]

  const { data: charge } = await serviceClient
    .from('pending_credit_charges')
    .select('id, status, created_at')
    .eq('user_id', userId)
    .eq('trip_id', tripId)
    .eq('action', SPEND_ACTION)
    .in('status', ['pending', 'completed'])
    .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Decide
  if (!charge) {
    // No proof-of-charge → reject. If they also have $0 balance, signal that
    // distinctly so the client can show the upgrade modal instead of a generic error.
    if (totalCredits <= 0 && tier?.tier === 'free') {
      return 403 { code: 'TIER_LIMIT_EXCEEDED',
                   error: 'Free tier credits exhausted. Upgrade to continue generating trips.' }
    }
    return 403 { code: 'GENERATION_NOT_AUTHORIZED',
                 error: 'Generation must be initiated through the app (no charge record found).' }
  }
}
```

Why proof-of-charge instead of a balance-only check: a free user with their daily 5 credits could otherwise call `generate-itinerary` directly five times (skipping `spend-credits`) and burn $10–$25 of LLM/Places spend before the balance hits zero. Binding to `pending_credit_charges` enforces "every generation has been paid through the proper path."

## What we deliberately do NOT do

- **No deduction inside `generate-itinerary`.** `spend-credits` already does that with FIFO + idempotency + refund-on-failure (see `useGenerationGate` defensive-refund flow). Adding a second deduction site would risk double-charging on retries and break the existing `pending_credit_charges` lifecycle.
- **No new `credits_remaining` column on `user_tiers`.** The data already lives in `credit_balances`/`credit_purchases`; duplicating it creates drift.
- **No gate change for service-role self-chain calls** (`generate-trip-day`, `save-itinerary`, etc.). Those run after the originating `generate-trip` already cleared the gate.

## Files touched

- `supabase/functions/generate-itinerary/index.ts` — add the ~30-line gate block in the user-auth branch, before rate-limit check.

No DB migration. No client changes. No `spend-credits` changes.

## Verification

1. **Free user, $0 balance, calls `generate-itinerary` directly** (curl with their JWT, action `generate-trip`, no prior `spend-credits`) → 403 `TIER_LIMIT_EXCEEDED`.
2. **Free user with 5 daily free credits, skips `spend-credits`, calls directly** → 403 `GENERATION_NOT_AUTHORIZED` (balance > 0 but no proof-of-charge).
3. **Paid user, normal flow** (`useGenerationGate` → `spend-credits` → `generate-itinerary`) → proof-of-charge row exists → 200, generation proceeds, credits already deducted by `spend-credits`.
4. **Service-role self-chain** (`generate-trip` → spawns `generate-trip-day`) → bypasses gate, completes normally.
5. **Replay attack** (call `generate-itinerary` 11 minutes after the proof-of-charge) → 403 `GENERATION_NOT_AUTHORIZED` (charge expired).

## Open questions before I implement

I want to confirm two things, since they change the gate's behavior:

1. The `generate-day` action covers two paths today: the unlock-day flow (which runs `spend-credits` with `unlock_day` first) and the regenerate-day flow (`regenerate_day`). I want to gate it against **either** `unlock_day` **or** `regenerate_day` proofs — confirm that's right, or tell me one of them shouldn't gate at all. that's right
2. The 10-minute proof-of-charge freshness window — generation can take 60–90s, but the gate runs at start. 10 minutes is loose enough for retries after a transient failure. OK to keep, or tighten to 5 minutes? it's ok
  &nbsp;

I'll proceed with the defaults above unless you flag otherwise.