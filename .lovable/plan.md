## Universal idempotency on `spend-credits`

Close the double-charge window for low-value actions (`ai_message`, `swap_activity`, `add_activity`, `regenerate_day`, etc.). Today the idempotency check only fires for 4 high-value actions, and the lookup itself races against a background ledger insert.

### What's actually in the codebase (matters for the design)

- `credit_ledger` has **no `idempotency_key` column** — the key is stored in `metadata` JSONB and looked up via `.contains('metadata', { idempotencyKey })`. Slow and unindexable.
- The check is gated on `tripId` being present (`if (idempotencyKey && tripId)`), so actions without a trip context (e.g. some `ai_message` calls) wouldn't dedupe even if they passed a key.
- The ledger insert happens in **`EdgeRuntime.waitUntil` background housekeeping AFTER FIFO deduction**. Two clicks ~50ms apart both pass the SELECT (no row yet) and both deduct. The unique-index approach the user suggested is the right fix, but it must be **enforced synchronously** to actually block the race — not from waitUntil.
- Many client call sites already pass `idempotencyKey` (`useGenerationGate`, `useUnlockDay`, `SmartFinishBanner`, `TripConfirmationBanner`, `EditorialItinerary` regenerate_trip, `FindMyHotelsDrawer`, `ItineraryGenerator`). Missing: `ai_message`, `swap_activity`, `add_activity`, `regenerate_day`, `route_optimization`, `transport_mode_change`, `restaurant_rec`, `hotel_search`, `mystery_*`, `generate_blog`, bulk/individual unlock, `dna_feedback`.
- `useSpendCredits` already has an in-memory `pendingRef` dedupe (same tab only) — useful belt-and-suspenders, not a substitute.

### Plan

#### 1. Migration — `credit_ledger.idempotency_key` column + unique partial index

```sql
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Backfill existing rows from metadata so the unique index can build cleanly
UPDATE public.credit_ledger
   SET idempotency_key = metadata->>'idempotencyKey'
 WHERE idempotency_key IS NULL
   AND metadata ? 'idempotencyKey';

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_user_idempotency
  ON public.credit_ledger(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

Partial index keeps NULLs (legacy rows / future actions that opt out — none in the new model) unconstrained. Backfill is safe because metadata-stored keys are already application-unique per user.

#### 2. Synchronous dedup in `spend-credits/index.ts`

Restructure around a **synchronous ledger insert with `ON CONFLICT DO NOTHING`** so the unique index — not a SELECT — is what enforces uniqueness.

Replace the current flow:

```text
[validate] → [SELECT credit_ledger by metadata idempotencyKey]   ← racy
            → [pending_credit_charges insert (sync)]
            → [deductFIFO  (sync)]
            → [Response 200]
            → [waitUntil: ledger insert + cost track + balance sync]
```

with:

```text
[validate] → [require metadata.idempotencyKey for ALL actions]
          → [pre-check via SELECT on idempotency_key column   ← fast path]
              ↳ hit → return cached {idempotent:true, spent}
          → [pending_credit_charges insert]                    (high-value only, unchanged)
          → [deductFIFO  (sync)]
          → [ledger INSERT … ON CONFLICT (user_id, idempotency_key) DO NOTHING returning *]
              ↳ if 0 rows returned → race lost: refund the deduction
                  (call deductFIFO inverse / write a refund ledger row), then return cached spend
              ↳ if 1 row returned → proceed
          → [Response 200]
          → [waitUntil: cost tracking + balance sync only]     (ledger already written)
```

Concrete changes around lines 596–760:

- **Drop the `HIGH_VALUE_ACTIONS_REQUIRING_KEY` gate.** Require `metadata.idempotencyKey` for every spend (no `tripId` precondition).
  ```ts
  if (!idempotencyKey) {
    return errorResponse(
      'metadata.idempotencyKey is required',
      'MISSING_IDEMPOTENCY_KEY',
      400,
    );
  }
  ```
- **Pre-check on the column** (replaces the `metadata @> {…}` query):
  ```ts
  const { data: existing } = await supabaseAdmin
    .from('credit_ledger')
    .select('id, credits_delta, created_at')
    .eq('user_id', user.id)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({
      success: true,
      spent: Math.abs(existing.credits_delta),
      action,
      idempotent: true,
      duplicate: true,
      originalSpendAt: existing.created_at,
      newBalance: { … syncBalanceCache(…) },
    }), { status: 200, headers: jsonHeaders });
  }
  ```
- **Move the ledger insert OUT of `waitUntil` and BEFORE the response**, with `idempotency_key` as a top-level column (still mirror into metadata for back-compat with downstream consumers reading the JSONB key — `originalIdempotencyKey` refund flow at line 395 already reads it from metadata).
  ```ts
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('credit_ledger')
    .insert({
      user_id: user.id,
      transaction_type: 'spend',
      credits_delta: -deductResult.deducted,
      action_type: action,
      trip_id: tripId || null,
      idempotency_key: idempotencyKey,
      metadata: { ...metadata, idempotencyKey, defensiveRefundKey, pendingChargeId, … },
      notes: `${action.replace(/_/g, ' ')} - ${deductResult.deducted} credits`,
    })
    .select('id, credits_delta, created_at')
    .single();

  if (insErr && insErr.code === '23505') {
    // Race: another request committed first. Refund this deduction
    // and return the original row.
    await refundFIFO(supabaseAdmin, user.id, deductResult); // reverse the FIFO debit
    const { data: original } = await supabaseAdmin
      .from('credit_ledger')
      .select('id, credits_delta, created_at')
      .eq('user_id', user.id).eq('idempotency_key', idempotencyKey).single();
    return cachedResponse(original);
  }
  ```
  Net effect: `INSERT … ON CONFLICT DO NOTHING` semantics via the 23505 catch. Two simultaneous double-clicks → exactly one ledger row, one debit; the loser's deduction is reversed before the response.
- **Background `waitUntil`** keeps only the non-critical bits: `trip_cost_tracking` insert, `syncBalanceCache`. Ledger is no longer eventual.

> Trade-off: Response gets ~one extra DB round-trip (the ledger insert). Worth it — the previous "waitUntil ledger" pattern is exactly what made same-millisecond double-clicks slip through and is the root cause of every double-charge bug we've seen on this surface.

#### 3. Client — auto-generate idempotency key in the central hook

Most call sites don't need to be touched. Generate the key inside `src/hooks/useSpendCredits.ts` so every spend gets one even if the caller forgot:

```ts
// in mutationFn, before invoke()
const idempotencyKey =
  (params.metadata?.idempotencyKey as string | undefined) ??
  `${params.action}:${params.tripId ?? 'no-trip'}:${user.id}:${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

const { data, error } = await supabase.functions.invoke('spend-credits', {
  body: {
    …,
    metadata: { ...params.metadata, idempotencyKey },
  },
});
```

This means **zero changes** to the long tail of callers — they automatically become idempotent on retry **within a single mutation invocation**. The existing `pendingRef` dedup keeps double-click within the same tab from generating two different keys (it short-circuits before invoke).

For callers that explicitly want cross-retry idempotency (network blip, same key on retry), they keep passing `metadata.idempotencyKey` and we honor it (the `??` above). All current explicit callers (`useGenerationGate`, `useUnlockDay`, `SmartFinishBanner`, etc.) keep working unchanged.

> Not auto-generating per-render: the key is generated **inside `mutationFn`**, so it's stable for the duration of one mutation call (including react-query's automatic retries on transient errors, since the same params object is reused). It does NOT persist across explicit user re-clicks — that's the point: a deliberate second click is a new spend, a phantom retry isn't.

#### 4. Verification

- Double-click "Apply" on AI chat → 1 ledger row, 1 debit, 2nd request returns `{idempotent: true, duplicate: true}`.
- Forced 50ms parallel curl on `swap_activity` with same `idempotencyKey` → 1 row, loser refunded, both responses report same `spent`.
- Two tabs sending the same explicit key → second returns cached response.
- Existing flows: `trip_generation`, `smart_finish`, `hotel_optimization`, `regenerate_trip`, `unlock_day` continue to work (their explicit keys flow through unchanged).
- Refund flow at line 395 (`metadata @> { idempotencyKey: originalIdempotencyKey }`) keeps working because we still write the key into metadata.

#### 5. Out of scope

- Migrating the line-395 defensive-refund lookup from metadata to the new column (works either way; can be a follow-up).
- Adding a TTL/cleanup on idempotency keys (the natural one is already "lifetime of the user's ledger" which is fine).
- Per-action client refactor to manually thread keys (not needed; hook auto-gens).
- `chat_idempotency_cache` table — separate system, untouched.