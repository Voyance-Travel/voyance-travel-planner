# Refund silent credit loss on chat-Assistant Apply failures

## Scope verification (matches user's question)

**`ai_message` is already free.** Confirmed in `ItineraryAssistant.tsx:108` (`// ai_message is now free — no cap tracking needed`) and in core memory ("AI chat is free; credits deducted only for structural changes applied"). The chargeable event is **clicking Apply** on a proposed action — which charges `SWAP_ACTIVITY` or `REGENERATE_DAY`. So the refund target is the Apply path, not every chat message. ✅

**`swap_activity` and `add_activity` in `EditorialItinerary.tsx`** charge credits, then mutate React state (`setDays(...)`) and dispatch a debounced auto-save. There is **no awaitable failure surface** between the spend and the user-visible "swapped/added" outcome — `handleConfirmSwap` (line ~3962) and `handleAddActivity` (line ~5398) are local state operations. The auto-save timer (`useEffect` after `setHasChanges(true)`) is fire-and-forget and not currently hooked back to refunds; wrapping it would mean watching state from the wrong scope. **Out of scope** for this fix; flag for follow-up.

The actual silent-loss surface is the **chat-Assistant Apply path**, where `spendCredits.mutateAsync(...)` is followed by `await executeAction(...)`. `executeAction` invokes `generate-itinerary` (swap/regenerate/rewrite) and returns `{ success: false, error }` on every failure path — currently the catch / `result.success === false` branches just toast and **leave the credit deducted**.

## File: `src/components/itinerary/ItineraryAssistant.tsx`

Around lines 376-577 (`handleActionApply`).

### Capture spend context

Where credits are spent (line 383-388), capture `idempotencyKey` and `pendingChargeId` from the response (already exposed by `useSpendCredits` after the prior fix):

```ts
let spendContext: { idempotencyKey?: string; pendingChargeId?: string | null } | undefined;
if (creditAction) {
  const creditResult = await spendCredits.mutateAsync({ action: creditAction, tripId, metadata: { ... } });
  if (!creditResult.success) throw new Error('Insufficient credits');
  spendContext = {
    idempotencyKey: (creditResult as { idempotencyKey?: string }).idempotencyKey,
    pendingChargeId: (creditResult as { pendingChargeId?: string | null }).pendingChargeId ?? null,
  };
}
```

### Add a refund helper inside `handleActionApply`

Maps the assistant's chargeable action types to the `originalAction` strings the REFUND handler in `spend-credits` already understands:

```ts
const refundOriginalAction =
  creditAction === 'SWAP_ACTIVITY'    ? 'swap_activity'
  : creditAction === 'REGENERATE_DAY' ? 'regenerate_day'
  : null;

const refundOnFailure = async (reason: string, errorMessage?: string) => {
  if (!spendContext?.idempotencyKey || !refundOriginalAction) return;
  try {
    await supabase.functions.invoke('spend-credits', {
      body: {
        action: 'REFUND',
        tripId,
        metadata: {
          originalAction: refundOriginalAction,
          pendingChargeId: spendContext.pendingChargeId ?? undefined,
          reason,
          ...(errorMessage ? { errorMessage } : {}),
        },
        originalIdempotencyKey: spendContext.idempotencyKey,
      },
    });
  } catch (refundErr) {
    console.error('[ActionExecutor] Refund failed:', refundErr);
  }
};
```

Server-side this routes through the existing REFUND handler (`spend-credits/index.ts:368-540`) with `originalIdempotencyKey` defensive lookup, dedup by `pendingChargeId`, ledger row, balance restore.

### Wire refund into the two failure paths

**Path A — `result.success === false`** (currently the `else` branch around line 555):

```ts
} else {
  await refundOnFailure('execution_failed', result.error || result.message);
  toast.error('Action failed — credits refunded', { id: actionId, description: result.message });
}
```

**Path B — thrown exception** (`catch (error)` around line 559):

```ts
await refundOnFailure('execution_threw', error instanceof Error ? error.message : String(error));
toast.error('Failed to execute action — credits refunded', { id: actionId, description: ... });
```

### Add `swap_activity` to `REFUNDABLE_COSTS`

`supabase/functions/spend-credits/index.ts` (the REFUND handler already lists `regenerate_day` from the prior fix). Add `SWAP_ACTIVITY` / `swap_activity` with `0` (tier-dependent — defensive lookup populates from the original ledger row via `originalIdempotencyKey`):

```ts
const REFUNDABLE_COSTS: Record<string, number> = {
  ...,
  SWAP_ACTIVITY: 0, swap_activity: 0,
};
```

## Out of scope (and why)

- **`ai_message` refund** — chat is free; no charge to refund. The user's spec confirms "free until you click Apply".
- **`add_activity` / `swap_activity` from EditorialItinerary** — local state mutations with no awaitable failure surface. The realistic failure (autosave / cost-sync) is decoupled from the spend by debounced effects; refunding requires reworking the autosave contract, not a try/catch wrap. Logging this as a separate issue.
- **No new RPC, no migration** — uses existing REFUND action and the `idempotency_key` column added in the prior migration.

## Verification

1. Mock `executeSwapAction` to return `{ success: false, error: 'No alternatives' }` → toast says "credits refunded", `credit_ledger` shows spend + refund (transaction_type='refund'), balance restored.
2. Mock `executeRewriteDayAction` to throw → same outcome via the catch path.
3. Successful Apply → no refund row.
4. Double-trigger by retry → second REFUND returns `idempotent: true` via `pendingChargeId` dedup.
