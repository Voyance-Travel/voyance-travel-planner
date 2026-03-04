/**
 * Locked Day Card
 * 
 * Clean blank canvas shown for days beyond the free preview.
 * Two clear paths: let Voyance finish it (credits) or build manually.
 */

import { motion } from 'framer-motion';
import { Sparkles, Pencil, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useManualBuilderStore } from '@/stores/manual-builder-store';
import { useOutOfCredits } from '@/contexts/OutOfCreditsContext';
import { CREDIT_COSTS } from '@/config/pricing';
import { toast } from 'sonner';

interface LockedDayCardProps {
  dayNumber: number;
  title: string;
  activityCount: number;
  teaserLine: string;
  intelligenceBadges: {
    finds: number;
    timingHacks: number;
    trapsAvoided: number;
    tips: number;
  };
  onUnlock: () => void;
  creditsNeeded: number;
  className?: string;
  tripId?: string;
  onManualBuild?: () => void;
  isFirstTrip?: boolean;
  canAfford?: boolean;
  currentBalance?: number;
  isUnlocking?: boolean;
  unlockError?: string | null;
}

export function LockedDayCard({
  dayNumber,
  title,
  onUnlock,
  creditsNeeded,
  className,
  tripId,
  onManualBuild,
  isFirstTrip = false,
  canAfford = false,
  currentBalance = 0,
  isUnlocking = false,
  unlockError = null,
}: LockedDayCardProps) {
  const { enableManualBuilder } = useManualBuilderStore();
  const { showOutOfCredits } = useOutOfCredits();

  const handleManualBuild = () => {
    if (tripId) {
      enableManualBuilder(tripId);
      toast.success('Manual builder mode enabled! Edit freely.');
    }
    onManualBuild?.();
  };

  const handleFinishForMe = () => {
    if (canAfford) {
      onUnlock();
    } else {
      showOutOfCredits({
        action: 'UNLOCK_DAY',
        creditsNeeded: CREDIT_COSTS.UNLOCK_DAY,
        creditsAvailable: currentBalance,
        tripId,
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6 min-h-[400px]",
        className
      )}
    >
      {/* Day label */}
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
        Day {dayNumber}
      </span>

      {/* Title */}
      <h3 className="text-2xl font-serif font-medium text-foreground mb-2">
        {title || `Day ${dayNumber}`}
      </h3>

      {/* Subtitle */}
      <p className="text-sm text-muted-foreground max-w-sm mb-10">
        {isFirstTrip
          ? "Your first 2 days are free. Want us to plan this day too?"
          : "Want us to plan this day for you?"}
      </p>

      {/* Two clear CTA buttons */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button
          onClick={handleFinishForMe}
          disabled={isUnlocking}
          className="w-full gap-2.5 rounded-xl h-12 text-sm font-medium"
          size="lg"
        >
          {isUnlocking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Unlocking Day {dayNumber}...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {canAfford ? 'Plan this day for me' : 'Finish it for me'}
            </>
          )}
        </Button>

        {tripId && (
          <Button
            variant="ghost"
            onClick={handleManualBuild}
            className="w-full gap-2.5 rounded-xl h-12 text-sm font-medium text-muted-foreground hover:text-foreground"
            size="lg"
          >
            <Pencil className="h-4 w-4" />
            I'll do it myself
          </Button>
        )}
      </div>

      {/* Inline error state */}
      {unlockError && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-destructive mt-4 text-center max-w-xs"
        >
          {unlockError}. Please try again.
        </motion.p>
      )}

      {/* Subtle credit hint - only when they can't afford */}
      {!canAfford && !isFirstTrip && !unlockError && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xs text-muted-foreground/60 mt-6 flex items-center gap-1.5"
        >
          <CreditCard className="h-3 w-3" />
          {creditsNeeded} credits per day
        </motion.p>
      )}
    </motion.div>
  );
}

export default LockedDayCard;
