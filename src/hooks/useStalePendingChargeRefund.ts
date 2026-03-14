/**
 * useStalePendingChargeRefund
 * 
 * On trip page load, checks for any "pending" Smart Finish charges older than 2 minutes
 * that were never resolved (completed or refunded). If found, triggers a refund and
 * marks the charge as refunded. This catches edge cases where the client crashed,
 * the network dropped, or the edge function timed out silently.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const MAX_REFUND_ATTEMPTS = 3;

export function useStalePendingChargeRefund(tripId: string | undefined) {
  const queryClient = useQueryClient();
  const hasChecked = useRef(false);

  useEffect(() => {
    if (!tripId || hasChecked.current) return;
    hasChecked.current = true;

    const checkAndRefund = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Find stale pending charges for this trip
        const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
        const { data: staleCharges } = await (supabase
          .from('pending_credit_charges')
          .select('id, credits_amount, action, created_at, refund_attempts')
          .eq('trip_id', tripId)
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .lt('created_at', cutoff) as any);

        if (!staleCharges?.length) return;

        console.log(`[StalePendingCharge] Found ${staleCharges.length} stale pending charge(s) for trip ${tripId}`);

        let anyRefunded = false;

        for (const charge of staleCharges) {
          const attempts = (charge as any).refund_attempts ?? 0;

          // SessionStorage guard: skip charges that already failed this session
          const failedKey = `stale_refund_failed_${charge.id}`;
          try {
            if (sessionStorage.getItem(failedKey)) {
              console.log(`[StalePendingCharge] Skipping ${charge.id} — already failed this session`);
              continue;
            }
          } catch { /* sessionStorage unavailable */ }

          // Max attempts reached — mark as failed and stop retrying
          if (attempts >= MAX_REFUND_ATTEMPTS) {
            if (attempts === MAX_REFUND_ATTEMPTS) {
              console.warn(`[StalePendingCharge] Max refund attempts (${MAX_REFUND_ATTEMPTS}) reached for ${charge.id} — marking as failed`);
              await (supabase
                .from('pending_credit_charges')
                .update({
                  status: 'failed',
                  resolved_at: new Date().toISOString(),
                  resolution_note: `Auto-marked failed after ${MAX_REFUND_ATTEMPTS} refund attempts`,
                  refund_attempts: attempts,
                } as any)
                .eq('id', charge.id) as any);
            }
            continue;
          }

          try {
            // Increment attempt counter before trying
            await (supabase
              .from('pending_credit_charges')
              .update({ refund_attempts: attempts + 1 } as any)
              .eq('id', charge.id) as any);

            // Issue refund
            const { data: refundData, error: refundError } = await supabase.functions.invoke('spend-credits', {
              body: {
                action: 'REFUND',
                tripId,
                creditsAmount: charge.credits_amount,
                metadata: {
                  reason: 'stale_pending_charge_auto_refund',
                  originalAction: charge.action,
                  pendingChargeId: charge.id,
                },
              },
            });

            if (refundError || !refundData?.success) {
              console.error(`[StalePendingCharge] Refund failed for ${charge.id} (attempt ${attempts + 1}/${MAX_REFUND_ATTEMPTS}):`, refundError ?? refundData);
              try { sessionStorage.setItem(failedKey, 'true'); } catch { /* */ }
              continue;
            }

            // Mark as refunded
            await supabase
              .from('pending_credit_charges')
              .update({
                status: 'refunded',
                resolved_at: new Date().toISOString(),
                resolution_note: 'Auto-refunded: stale pending charge detected on trip load',
              })
              .eq('id', charge.id);

            console.log(`[StalePendingCharge] Auto-refunded charge ${charge.id}: +${charge.credits_amount} credits`);
            anyRefunded = true;
          } catch (err) {
            console.error(`[StalePendingCharge] Error processing charge ${charge.id} (attempt ${attempts + 1}/${MAX_REFUND_ATTEMPTS}):`, err);
            try { sessionStorage.setItem(failedKey, 'true'); } catch { /* */ }
          }
        }

        if (anyRefunded) {
          queryClient.invalidateQueries({ queryKey: ['credits'] });
          queryClient.invalidateQueries({ queryKey: ['entitlements'] });
        }
      } catch (err) {
        console.error('[StalePendingCharge] Check failed:', err);
      }
    };

    checkAndRefund();
  }, [tripId, queryClient]);
}
