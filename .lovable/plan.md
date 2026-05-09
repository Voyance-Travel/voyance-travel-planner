## Fix 2.1 — Decide the fate of `purchase-smart-finish`

### Status check (already done)
The `supabase/functions/purchase-smart-finish/` folder was deleted in an earlier turn. A repo-wide `rg` confirms:

- No code in `src/` or `supabase/functions/` references `purchase-smart-finish`.
- `stripe-webhook/index.ts` has zero `smart_finish` branches.
- The Smart Finish purchase flow already runs end-to-end through credits: `SmartFinishBanner.tsx` deducts 50 credits via `pricing.ts:18` then directly sets `smart_finish_purchased = true` on the trip row (lines 300/323/365).
- `enrich-manual-trip` is the only other writer of that flag, also via the credits path.

So the recommended path **(b) delete** is effectively complete in the codebase. The single remaining loose end is the **deployed copy of the function still living in the Supabase project** — it's unreferenced source-side but may still be invokable.

### Action
1. Remove the orphan deployment by calling `supabase--delete_edge_functions` with `["purchase-smart-finish"]`. This guarantees the parallel paid-but-unfulfilled codepath is gone end-to-end (no surprise invocations from old clients, bookmarks, or stale `curl` scripts).
2. Update `@security-memory` to record that the Smart Finish Stripe checkout function was intentionally removed and that any future claim of "Smart Finish needs its own Stripe session" must instead extend the existing credits flow.

### Out of scope
- Re-introducing a Stripe path for Smart Finish (path (a)). The credits flow is the canonical purchase route — re-adding a Stripe checkout would split fulfillment again.
- Touching `smart_finish_purchased` columns or `SmartFinishBanner.tsx` business logic.
- Webhook changes — there's nothing to remove.

### Validation
- After deletion, attempting `supabase.functions.invoke('purchase-smart-finish', ...)` returns 404 (expected).
- `SmartFinishBanner` purchase flow continues to deduct 50 credits and flip `smart_finish_purchased` (no behavior change).
- A grep for `purchase-smart-finish` returns zero hits anywhere.
