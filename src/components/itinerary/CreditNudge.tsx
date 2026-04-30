/**
 * Inline credit nudge — appears when a user can't afford an action.
 * Shows a soft upsell with recommended pack + quick buy button.
 * Embeds Stripe checkout directly in-page via EmbeddedCheckoutModal.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Crown, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CREDIT_COSTS, FLEXIBLE_CREDITS, VOYANCE_CLUB_PACKS, BOOST_PACK, getRecommendedPack, formatCredits } from '@/config/pricing';
import { EmbeddedCheckoutModal } from '@/components/checkout/EmbeddedCheckoutModal';
import { isNativeIOS, openWebsitePurchase } from '@/services/iapService';

interface CreditNudgeProps {
  action: keyof typeof CREDIT_COSTS;
  currentBalance: number;
  onDismiss: () => void;
  compact?: boolean;
}

const ACTION_LABELS: Partial<Record<keyof typeof CREDIT_COSTS, string>> = {
  SWAP_ACTIVITY: 'swap this activity',
  ADD_ACTIVITY: 'add this activity',
  REGENERATE_DAY: 'regenerate this day',
  AI_MESSAGE: 'send a message',
  RESTAURANT_REC: 'get restaurant picks',
  UNLOCK_DAY: 'unlock this day',
  HOTEL_SEARCH: 'search hotels',
};

export function CreditNudge({ action, currentBalance, onDismiss, compact }: CreditNudgeProps) {
  const [checkoutPack, setCheckoutPack] = useState<{
    priceId: string;
    name: string;
    credits: number;
    productId: string;
    mode: 'payment';
  } | null>(null);
  const cost = CREDIT_COSTS[action];
  const deficit = cost - currentBalance;
  const recommended = getRecommendedPack(deficit);
  const actionLabel = ACTION_LABELS[action] || 'perform this action';

  // Guard: never render an upsell when the user already has enough credits.
  // Previously this displayed "0 more credits needed... action costs 10",
  // which contradicted itself. Affordable actions should not mount this component.
  if (deficit <= 0) return null;

  // Show smallest flex credit if deficit is small
  const showQuickTopUp = deficit <= BOOST_PACK.credits;
  const primaryPack = showQuickTopUp ? BOOST_PACK : recommended;

  if (!primaryPack) return null;

  const handleBuyPack = async (pack: { priceId: string; name: string; credits: number; productId: string; id?: string }) => {
    // iOS native: link out to website
    if (isNativeIOS()) {
      await openWebsitePurchase(pack.id);
      return;
    }
    setCheckoutPack({ priceId: pack.priceId, name: pack.name, credits: pack.credits, productId: pack.productId, mode: 'payment' });
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-sm"
        >
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-primary/10 text-muted-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>

          <div className={compact ? 'p-3' : 'p-4'}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Coins size={14} className="text-primary" />
              </div>
              <p className={`font-medium text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                {formatCredits(deficit)} more credits needed to {actionLabel}
              </p>
            </div>

            {/* Balance context */}
            <p className="text-xs text-muted-foreground mb-3">
              You have <span className="font-semibold text-foreground">{formatCredits(currentBalance)}</span> credits
              {' · '}this action costs <span className="font-semibold text-foreground">{formatCredits(cost)}</span>
            </p>

            {/* Pack options */}
            <div className={`flex gap-2 ${compact ? 'flex-col' : 'flex-wrap'}`}>
              {/* Primary recommendation */}
              <Button
                size="sm"
                className="gap-1.5 flex-1"
                onClick={() => handleBuyPack({ ...primaryPack, id: primaryPack.id })}
              >
                <Zap size={13} />
                {primaryPack.name} · {formatCredits(primaryPack.credits)} credits · ${primaryPack.price}
              </Button>

              {/* Show Club option if primary is a flex credit */}
              {showQuickTopUp && recommended && recommended.id !== BOOST_PACK.id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => handleBuyPack({ ...recommended, id: recommended.id })}
                >
                  <Crown size={13} />
                  {recommended.name} · {formatCredits(recommended.credits)} credits · ${recommended.price}
                </Button>
              )}

              {/* Show quick top-up if primary is a club pack */}
              {!showQuickTopUp && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => handleBuyPack({ ...BOOST_PACK, id: BOOST_PACK.id })}
                >
                  <Zap size={13} />
                  Quick Top-Up · {BOOST_PACK.credits} credits · ${BOOST_PACK.price}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Embedded Stripe Checkout */}
      {checkoutPack && (
        <EmbeddedCheckoutModal
          isOpen={!!checkoutPack}
          onClose={() => setCheckoutPack(null)}
          priceId={checkoutPack.priceId}
          mode="payment"
          productName={checkoutPack.name}
          returnPath={window.location.pathname + window.location.search}
          productId={checkoutPack.productId}
          credits={checkoutPack.credits}
        />
      )}
    </>
  );
}
