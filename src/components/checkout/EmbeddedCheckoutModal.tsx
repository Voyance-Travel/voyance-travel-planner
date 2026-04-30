import { useState, useCallback, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { isNativeIOS, openWebsitePurchase } from '@/services/iapService';

// Initialize Stripe with publishable key
const stripePromise = loadStripe('pk_live_51RJawaJytioXyqq9n5emMW9beYC8p5gGvNyWiNlcYevo4Ibe3YkTtrNGrqA70kSRn1tAX8W8xo0E9eI9x6swFYV700LWTtv0ea');

interface EmbeddedCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  priceId: string;
  mode: 'subscription' | 'payment';
  productName: string;
  returnPath?: string;
  // Credit purchase fields
  productId?: string;
  credits?: number;
  // Group unlock fields
  tripId?: string;
  groupTier?: 'small' | 'medium' | 'large';
  // Group-pool credit destination — routes purchased credits into a trip's shared pool
  destination?: 'group_pool';
  // Legacy day fields (deprecated)
  days?: number;
  packageTier?: 'essential' | 'complete';
}

export function EmbeddedCheckoutModal({
  isOpen,
  onClose,
  priceId,
  mode,
  productName,
  returnPath = '/profile',
  productId,
  credits,
  tripId,
  groupTier,
  destination,
  days,
  packageTier,
}: EmbeddedCheckoutModalProps) {
  const [error, setError] = useState<string | null>(null);

  // Safety net: redirect to website if somehow opened on iOS native
  useEffect(() => {
    if (isNativeIOS() && isOpen) {
      openWebsitePurchase();
      onClose();
    }
  }, [isOpen, onClose]);

  const fetchClientSecret = useCallback(async () => {
    try {
      setError(null);
      
      const { data, error: fnError } = await supabase.functions.invoke('create-embedded-checkout', {
        body: { 
          priceId, 
          mode, 
          returnPath,
          productId,
          credits,
          tripId,
          groupTier,
          destination,
          days,
          packageTier,
        },
      });

      if (fnError) {
        console.error('[EmbeddedCheckout] Function error:', { message: fnError.message, priceId, mode });
        throw new Error(fnError.message);
      }

      if (data?.error) {
        console.error('[EmbeddedCheckout] Data error:', { error: data.error, priceId, mode });
        throw new Error(data.error);
      }

      return data.clientSecret;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize checkout';
      console.error('[EmbeddedCheckout] Error:', { message, err, priceId, mode });
      setError(message);
      throw err;
    }
  }, [priceId, mode, returnPath, productId, credits, tripId, groupTier, destination, days, packageTier]);

  const options = { fetchClientSecret };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-background overflow-y-auto"
        >
          <div className="min-h-screen flex flex-col">
            {/* Header with close button */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                </div>
                <div>
                  <h2 className="text-base font-display font-semibold text-foreground">
                    Complete your purchase
                  </h2>
                  <p className="text-xs text-muted-foreground">{productName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Close checkout"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Checkout container — full width, no overflow constraints */}
            <div className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
              {error ? (
                <div className="text-center py-8">
                  <p className="text-destructive mb-4">{error}</p>
                  <button 
                    onClick={() => setError(null)}
                    className="text-primary hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div id="checkout" className="min-h-[400px]">
                  <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Loading placeholder for when checkout is initializing
export function CheckoutLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Loading secure checkout...</p>
    </div>
  );
}
