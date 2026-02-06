/**
 * Inline credit nudge — appears when a user can't afford an action.
 * Shows a soft upsell with recommended pack + quick buy button.
 * Embeds Stripe checkout directly in-page via EmbeddedCheckoutModal.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Sparkles, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CREDIT_COSTS, CREDIT_PACKS, BOOST_PACK, getRecommendedPack, formatCredits } from '@/config/pricing';
import { EmbeddedCheckoutModal } from '@/components/checkout/EmbeddedCheckoutModal';

interface CreditNudgeProps {
  /** The action the user tried to perform */
  action: keyof typeof CREDIT_COSTS;
  /** User's current credit balance */
  currentBalance: number;
  /** Called when the user dismisses the nudge */
  onDismiss: () => void;
  /** Optional: compact variant for tighter spaces */
  compact?: boolean;
}

const ACTION_LABELS: Partial<Record<keyof typeof CREDIT_COSTS, string>> = {
  SWAP_ACTIVITY: 'swap this activity',
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
    mode: 'payment';
  } | null>(null);

  const cost = CREDIT_COSTS[action];
  const deficit = cost - currentBalance;
  const recommended = getRecommendedPack(deficit);
  const actionLabel = ACTION_LABELS[action] || 'perform this action';

  // Show boost if deficit is small, otherwise recommended pack
  const showBoost = deficit <= BOOST_PACK.credits;
  const primaryPack = showBoost ? BOOST_PACK : recommended;

  if (!primaryPack) return null;

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
                onClick={() => setCheckoutPack({
                  priceId: primaryPack.priceId,
                  name: primaryPack.name,
                  mode: 'payment',
                })}
              >
                <Zap size={13} />
                {primaryPack.name} · {formatCredits(primaryPack.credits)} credits · ${primaryPack.price}
              </Button>

              {/* Show alternative if boost isn't the primary */}
              {!showBoost && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setCheckoutPack({
                    priceId: BOOST_PACK.priceId,
                    name: BOOST_PACK.name,
                    mode: 'payment',
                  })}
                >
                  <Sparkles size={13} />
                  Quick Boost · {BOOST_PACK.credits} credits · ${BOOST_PACK.price}
                </Button>
              )}

              {/* Show a bigger pack if primary is boost */}
              {showBoost && recommended && (recommended as any).priceId !== BOOST_PACK.priceId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setCheckoutPack({
                    priceId: recommended.priceId,
                    name: recommended.name,
                    mode: 'payment',
                  })}
                >
                  {recommended.name} · {formatCredits(recommended.credits)} credits · ${recommended.price}
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
        />
      )}
    </>
  );
}
