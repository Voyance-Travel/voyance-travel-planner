/**
 * Payment Verification Hook
 * Handles automatic payment verification when returning from Stripe checkout
 */

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { toFriendlyError } from '@/utils/friendlyErrors';
import { verifyPayment } from '@/services/tripPaymentsAPI';

interface UsePaymentVerificationOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function usePaymentVerification(options: UsePaymentVerificationOptions = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const verificationAttempted = useRef(false);

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');

    // Only verify if we have payment=success and session_id, and haven't attempted yet
    if (paymentStatus === 'success' && sessionId && !verificationAttempted.current) {
      verificationAttempted.current = true;
      
      const verify = async () => {
        // Verifying payment session
        
        try {
          const result = await verifyPayment(sessionId);
          
          if (result.success && result.status === 'paid') {
            toast.success('Payment confirmed! Your booking is complete.');
            options.onSuccess?.();
          } else if (result.success && result.status === 'pending') {
            toast.info('Payment is being processed. Please wait...');
          } else {
            toast.error(toFriendlyError(result.error));
            options.onError?.(result.error || 'Verification failed');
          }
        } catch (err) {
          console.error('[usePaymentVerification] Error:', err);
          toast.error('Failed to verify payment');
          options.onError?.('Verification exception');
        }

        // Clean up URL params after verification attempt
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('payment');
        newParams.delete('session_id');
        setSearchParams(newParams, { replace: true });
      };

      verify();
    }
  }, [searchParams, setSearchParams, options]);

  return {
    isVerifying: searchParams.get('payment') === 'success' && !!searchParams.get('session_id'),
  };
}
