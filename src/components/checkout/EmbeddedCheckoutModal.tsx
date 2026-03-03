import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

// Defer Stripe initialization until first use
let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe('pk_live_51RJawaJytioXyqq9n5emMW9beYC8p5gGvNyWiNlcYevo4Ibe3YkTtrNGrqA70kSRn1tAX8W8xo0E9eI9x6swFYV700LWTtv0ea');
  }
  return stripePromise;
}

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
          // Credit purchase fields
          productId,
          credits,
          // Group unlock fields
          tripId,
          groupTier,
          // Legacy day purchase fields
          days,
          packageTier,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data.clientSecret;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize checkout';
      setError(message);
      throw err;
    }
  }, [priceId, mode, returnPath, productId, credits, tripId, groupTier, days, packageTier]);

  const options = { fetchClientSecret };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-display">
            Complete your purchase: {productName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6 pt-4">
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
              <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
