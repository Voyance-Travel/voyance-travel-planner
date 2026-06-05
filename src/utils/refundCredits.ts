/**
 * Best-effort credit refund (client side).
 *
 * Mirrors the REFUND contract in the `spend-credits` edge function: the server
 * reverses a prior debit, keyed by the original idempotency key so it can (a)
 * read the actual debited amount for tier-dependent actions whose fixed cost is
 * 0 in REFUNDABLE_COSTS (regenerate_day, swap_activity), and (b) dedup against
 * any defensive/sweep refund of the same charge.
 *
 * Use this whenever credits are spent BEFORE an operation that can fail — if the
 * operation then fails, refund the charge so the user is never billed for a
 * no-op. Retries a few times so a transient network blip doesn't strand credits.
 */
import { supabase } from '@/integrations/supabase/client';

export interface RefundArgs {
  tripId?: string;
  /** Original action, e.g. 'unlock_day' | 'regenerate_day' | 'swap_activity'. */
  originalAction: string;
  /** From the spend response — lets the server find the debit + derive amount. */
  originalIdempotencyKey?: string;
  /** Server-issued pending charge id — preferred dedup key when available. */
  pendingChargeId?: string | null;
  /** Fixed-cost fallback (e.g. UNLOCK_DAY=60) for actions with a known amount. */
  creditsAmount?: number;
  reason: string;
  errorMessage?: string;
}

export async function refundCredits(args: RefundArgs): Promise<boolean> {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { error } = await supabase.functions.invoke('spend-credits', {
        body: {
          action: 'REFUND',
          tripId: args.tripId,
          creditsAmount: args.creditsAmount,
          originalIdempotencyKey: args.originalIdempotencyKey,
          metadata: {
            originalAction: args.originalAction,
            pendingChargeId: args.pendingChargeId ?? undefined,
            reason: args.reason,
            ...(args.errorMessage ? { errorMessage: args.errorMessage } : {}),
          },
        },
      });
      if (error) throw error;
      console.log(`[refundCredits] refunded ${args.originalAction} (${args.reason})`);
      return true;
    } catch (err) {
      console.error(`[refundCredits] attempt ${attempt}/${maxRetries} failed:`, err);
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  console.error(`[refundCredits] all ${maxRetries} attempts failed for ${args.originalAction}`);
  return false;
}
