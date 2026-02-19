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
        const { data: staleCharges } = await supabase
          .from('pending_credit_charges')
          .select('id, credits_amount, action, created_at')
          .eq('trip_id', tripId)
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .lt('created_at', cutoff);

        if (!staleCharges?.length) return;

        console.log(`[StalePendingCharge] Found ${staleCharges.length} stale pending charge(s) for trip ${tripId}`);

        for (const charge of staleCharges) {
          try {
            // Issue refund
            const { data: refundData, error: refundError } = await supabase.functions.invoke('spend-credits', {
              body: {
                action: 'REFUND',
                tripId,
                metadata: {
                  reason: 'stale_pending_charge_auto_refund',
                  originalAction: charge.action,
                  pendingChargeId: charge.id,
                },
              },
            });

            if (refundError || !refundData?.success) {
              console.error(`[StalePendingCharge] Refund failed for ${charge.id}:`, refundError ?? refundData);
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
          } catch (err) {
            console.error(`[StalePendingCharge] Error processing charge ${charge.id}:`, err);
          }
        }

        // Show toast and invalidate caches
        toast.info('A previous Smart Finish attempt failed — your credits have been refunded.', {
          duration: 6000,
        });
        queryClient.invalidateQueries({ queryKey: ['credits'] });
        queryClient.invalidateQueries({ queryKey: ['entitlements'] });
      } catch (err) {
        console.error('[StalePendingCharge] Check failed:', err);
      }
    };

    checkAndRefund();
  }, [tripId, queryClient]);
}
