import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  days,
  packageTier,
}: EmbeddedCheckoutModalProps) {
  const [error, setError] = useState<string | null>(null);

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
  }, [priceId, mode, returnPath, productId, credits, tripId, groupTier, days, packageTier]);

  const options = { fetchClientSecret };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto"
        >
          <div className="min-h-screen flex flex-col">
            {/* Header with close button */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-display font-medium text-foreground">
                Complete your purchase: {productName}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Close checkout"
              >
                <X className="h-5 w-5 text-foreground" />
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
