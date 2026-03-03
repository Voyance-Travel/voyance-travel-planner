/**
 * OutOfCreditsModal — Global popup when user runs out of credits.
 * Shows current balance, what they tried to do, and purchase options.
 * Auto-triggered by useSpendCredits on insufficient credits.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, Zap, Sparkles, ArrowRight, Loader2, Eye, Users } from 'lucide-react';
import { CREDIT_PACKS, BOOST_PACK, CREDIT_COSTS, formatCredits, getRecommendedPack, CREDIT_EXPIRATION_COPY } from '@/config/pricing';
import { EmbeddedCheckoutModal } from './EmbeddedCheckoutModal';
import { useOutOfCredits } from '@/contexts/OutOfCreditsContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ROUTES } from '@/config/routes';
import { useTripPermission } from '@/services/tripCollaboratorsAPI';

const ACTION_LABELS: Partial<Record<keyof typeof CREDIT_COSTS, string>> = {
  SWAP_ACTIVITY: 'Swap Activity',
  REGENERATE_DAY: 'Regenerate Day',
  AI_MESSAGE: 'AI Message',
  RESTAURANT_REC: 'Restaurant Pick',
  UNLOCK_DAY: 'Unlock Day',
  HOTEL_SEARCH: 'Hotel Search',
  MYSTERY_GETAWAY: 'Mystery Getaway',
  TRANSPORT_MODE_CHANGE: 'Change Transport',
};

export function OutOfCreditsModal() {
  const { state, dismiss } = useOutOfCredits();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [checkoutConfig, setCheckoutConfig] = useState<{
    priceId: string;
    productId: string;
    credits: number;
    name: string;
  } | null>(null);

  const { action, creditsNeeded = 0, creditsAvailable = 0, tripId } = state;

  // Check if user is a guest on this trip (not the owner)
  const { data: tripPermission } = useTripPermission(tripId);
  const isGuestOnSharedTrip = tripId && tripPermission && !tripPermission.isOwner && tripPermission.permission !== null;

  const actionCost = creditsNeeded || (action ? CREDIT_COSTS[action] : 0);
  const actionLabel = (action === 'UNLOCK_DAY' && creditsNeeded > CREDIT_COSTS.UNLOCK_DAY)
    ? 'Unlock All Remaining Days'
    : action ? ACTION_LABELS[action] || action : 'this action';
  const deficit = Math.max(0, actionCost - creditsAvailable);

  // Determine recommended pack
  const showBoost = actionCost <= BOOST_PACK.credits && deficit > 0;
  const recommended = getRecommendedPack(actionCost);

  const handleBuyPack = async (pack: { priceId: string; productId: string; credits: number; name: string; id?: string }) => {
    const packId = (pack as any).id || pack.name;
    setLoadingPack(packId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Sign in first', description: 'Create an account to get started.' });
        navigate('/signin?redirect=/pricing');
        dismiss();
        return;
      }
      setCheckoutConfig({
        priceId: pack.priceId,
        productId: pack.productId,
        credits: pack.credits,
        name: pack.name,
      });
    } catch {
      toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setLoadingPack(null);
    }
  };

  const handleExploreFree = () => {
    if (tripId) {
      navigate(`/trip/${tripId}`, { replace: true });
    }
    dismiss();
  };

  const handleDismiss = () => {
    dismiss();
    // Clean up ?generate=true from URL to stop the infinite spinner
    if (tripId) {
      navigate(`/trip/${tripId}`, { replace: true });
    }
  };

  return (
    <>
      <Dialog open={state.isOpen && !checkoutConfig} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
        <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="bg-destructive/10 px-6 pt-6 pb-4 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/15 mb-3"
            >
              <Coins className="h-6 w-6 text-destructive" />
            </motion.div>
            <h2 className="text-lg font-serif font-medium text-foreground">
              Not enough credits
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {actionLabel} requires <span className="font-semibold text-foreground">{formatCredits(actionCost)}</span> credits
            </p>
          </div>

          {/* Balance display */}
          <div className="px-6 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your balance</span>
              <span className="font-semibold text-foreground">{formatCredits(creditsAvailable)} credits</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground">Need</span>
              <span className="font-semibold text-destructive">+{formatCredits(deficit)} more</span>
            </div>
          </div>

          {/* Guest on shared trip hint */}
          {isGuestOnSharedTrip && (
            <div className="px-6 py-3 border-b border-border bg-primary/5">
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  You're a guest on this trip. Ask the trip owner to unlock AI features for you, or purchase credits for your own account.
                </p>
              </div>
            </div>
          )}

          {/* Purchase options */}
          <div className="px-6 py-4 space-y-3">
            {/* Primary CTA */}
            {showBoost ? (
              <Button
                size="lg"
                className="w-full gap-2"
                onClick={() => handleBuyPack(BOOST_PACK)}
                disabled={loadingPack === 'boost'}
              >
                {loadingPack === 'boost' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Quick Boost · {formatCredits(BOOST_PACK.credits)} credits · ${BOOST_PACK.price}
                  </>
                )}
              </Button>
            ) : recommended ? (
              <Button
                size="lg"
                className="w-full gap-2"
                onClick={() => handleBuyPack(recommended)}
                disabled={loadingPack === recommended.id}
              >
                {loadingPack === recommended.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {recommended.name} · {formatCredits(recommended.credits)} credits · ${recommended.price}
                  </>
                )}
              </Button>
            ) : null}

            {/* Secondary option */}
            {showBoost && recommended && (recommended as any).priceId !== BOOST_PACK.priceId && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => handleBuyPack(recommended)}
                disabled={loadingPack === recommended.id}
              >
                {loadingPack === recommended.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    {recommended.name} · {formatCredits(recommended.credits)} credits · ${recommended.price}
                    <ArrowRight className="h-3 w-3" />
                  </>
                )}
              </Button>
            )}

            {!showBoost && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => handleBuyPack(BOOST_PACK)}
                disabled={loadingPack === 'boost'}
              >
                {loadingPack === 'boost' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Zap className="h-3 w-3" />
                    Quick Boost · {formatCredits(BOOST_PACK.credits)} credits · ${BOOST_PACK.price}
                  </>
                )}
              </Button>
            )}

            {/* View all packs */}
            <p className="text-center text-xs text-muted-foreground">
              <button
                onClick={() => { dismiss(); navigate(ROUTES.PRICING); }}
                className="text-primary hover:underline"
              >
                View all credit packs →
              </button>
            </p>

            {/* Manual builder escape hatch */}
            {tripId && (
              <div className="pt-2 mt-1 border-t border-border">
                <button
                  onClick={handleExploreFree}
                  className="flex items-center justify-center gap-2 w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
                >
                  <Eye className="h-3 w-3" />
                  I'll explore the free days for now
                </button>
              </div>
            )}

            {/* Monthly grant reminder */}
            <p className="text-center text-[10px] text-muted-foreground">
              You get 150 free credits every month. {CREDIT_EXPIRATION_COPY.purchasedCreditsNotice}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded Checkout */}
      {checkoutConfig && (
        <EmbeddedCheckoutModal
          isOpen={!!checkoutConfig}
          onClose={() => {
            setCheckoutConfig(null);
            dismiss();
          }}
          priceId={checkoutConfig.priceId}
          mode="payment"
          productName={`${checkoutConfig.name} - ${formatCredits(checkoutConfig.credits)} Credits`}
          returnPath={window.location.pathname + window.location.search}
          productId={checkoutConfig.productId}
          credits={checkoutConfig.credits}
        />
      )}
    </>
  );
}
