/**
 * OutOfFreeActionsModal — Shown when free uses exhausted for an action type.
 * Offers: continue with credits (if affordable) or get more credits.
 */

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Zap, Coins, ArrowRight } from 'lucide-react';
import { CREDIT_COSTS, formatCredits } from '@/config/pricing';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

const ACTION_DISPLAY: Record<string, { label: string; costKey: keyof typeof CREDIT_COSTS }> = {
  swap_activity: { label: 'activity swap', costKey: 'SWAP_ACTIVITY' },
  regenerate_day: { label: 'day regeneration', costKey: 'REGENERATE_DAY' },
  ai_message: { label: 'AI message', costKey: 'AI_MESSAGE' },
  restaurant_rec: { label: 'restaurant pick', costKey: 'RESTAURANT_REC' },
  transport_mode_change: { label: 'transport change', costKey: 'TRANSPORT_MODE_CHANGE' },
};

interface OutOfFreeActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: string;
  creditsAvailable: number;
  /** Called when user chooses "Continue with credits" */
  onContinue: () => void;
}

export function OutOfFreeActionsModal({
  isOpen,
  onClose,
  actionType,
  creditsAvailable,
  onContinue,
}: OutOfFreeActionsModalProps) {
  const navigate = useNavigate();
  const display = ACTION_DISPLAY[actionType] || { label: actionType.replace(/_/g, ' '), costKey: 'SWAP_ACTIVITY' as const };
  const cost = CREDIT_COSTS[display.costKey];
  const canAfford = creditsAvailable >= cost;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gold/10 px-6 pt-6 pb-4 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/15 mb-3"
          >
            <Zap className="h-6 w-6 text-gold" />
          </motion.div>
          <h2 className="text-lg font-serif font-medium text-foreground">
            Free {display.label}s used up
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Each additional {display.label} costs{' '}
            <span className="font-semibold text-foreground">{formatCredits(cost)} credits</span>
          </p>
        </div>

        {/* Balance */}
        <div className="px-6 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your balance</span>
            <span className="font-semibold text-foreground">{formatCredits(creditsAvailable)} credits</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 space-y-3">
          {canAfford ? (
            <>
              <Button size="lg" className="w-full gap-2" onClick={onContinue}>
                <Zap className="h-4 w-4" />
                Continue · {formatCredits(cost)} credits
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                <button
                  onClick={() => { onClose(); navigate(ROUTES.PRICING); }}
                  className="text-primary hover:underline"
                >
                  Get more credits →
                </button>
              </p>
            </>
          ) : (
            <>
              <Button
                size="lg"
                className="w-full gap-2"
                onClick={() => { onClose(); navigate(ROUTES.PRICING); }}
              >
                <Coins className="h-4 w-4" />
                Get more credits
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-center text-xs text-destructive">
                You need {formatCredits(cost - creditsAvailable)} more credits
              </p>
            </>
          )}

          <button
            onClick={onClose}
            className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors"
          >
            Not now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
