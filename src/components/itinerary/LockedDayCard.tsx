/**
 * Locked Day Card
 * 
 * Shown for days beyond the free 2-day preview.
 * Two variants:
 * 1. First-trip users (0 credits) → explain free preview, offer manual build or get credits
 * 2. Returning users without enough credits → buy credits CTA, then auto-generate
 */

import { motion } from 'framer-motion';
import { Lock, Sparkles, Clock, MapPinOff, Target, Pencil, CreditCard, Gift, Loader2 } from 'lucide-react';
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
  /** Whether this is the user's first trip (got 2 free days) */
  isFirstTrip?: boolean;
  /** Whether user can afford to unlock this day */
  canAfford?: boolean;
  /** Current credit balance */
  currentBalance?: number;
}

export function LockedDayCard({
  dayNumber,
  title,
  activityCount,
  teaserLine,
  intelligenceBadges,
  onUnlock,
  creditsNeeded,
  className,
  tripId,
  onManualBuild,
  isFirstTrip = false,
  canAfford = false,
  currentBalance = 0,
}: LockedDayCardProps) {
  const { enableManualBuilder } = useManualBuilderStore();
  const { showOutOfCredits } = useOutOfCredits();
     
  const totalBadges = 
    intelligenceBadges.finds + 
    intelligenceBadges.timingHacks + 
    intelligenceBadges.trapsAvoided + 
    intelligenceBadges.tips;
 
  const handleManualBuild = () => {
    if (tripId) {
      enableManualBuilder(tripId);
      toast.success('Manual builder mode enabled! Edit freely.');
    }
    onManualBuild?.();
  };

  const handleGetCredits = () => {
    showOutOfCredits({
      action: 'UNLOCK_DAY',
      creditsNeeded: CREDIT_COSTS.UNLOCK_DAY,
      creditsAvailable: currentBalance,
      tripId,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-2xl border border-border bg-card overflow-hidden",
        className
      )}
    >
      {/* Blurred background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-muted/50 backdrop-blur-sm" />
      
      {/* Content */}
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Day {dayNumber}
              </span>
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-serif font-medium text-foreground">
              {title}
            </h3>
          </div>
          
          {/* Activity count */}
          <div className="text-right">
            <span className="text-2xl font-bold text-foreground">{activityCount}</span>
            <span className="text-xs text-muted-foreground block">activities</span>
          </div>
        </div>

        {/* Teaser line */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {teaserLine}
        </p>

        {/* Intelligence badges */}
        {totalBadges > 0 && (
          <div className="flex items-center gap-3 mb-6">
            {intelligenceBadges.finds > 0 && (
              <div className="flex items-center gap-1 text-xs text-primary">
                <Sparkles className="h-3 w-3" />
                <span>{intelligenceBadges.finds}</span>
              </div>
            )}
            {intelligenceBadges.timingHacks > 0 && (
              <div className="flex items-center gap-1 text-xs text-accent">
                <Clock className="h-3 w-3" />
                <span>{intelligenceBadges.timingHacks}</span>
              </div>
            )}
            {intelligenceBadges.trapsAvoided > 0 && (
              <div className="flex items-center gap-1 text-xs text-primary">
                <Sparkles className="h-3 w-3" />
                <span>{intelligenceBadges.trapsAvoided}</span>
              </div>
            )}
            {intelligenceBadges.tips > 0 && (
              <div className="flex items-center gap-1 text-xs text-gold">
                <Target className="h-3 w-3" />
                <span>{intelligenceBadges.tips}</span>
              </div>
            )}
            <span className="text-xs text-muted-foreground">insights waiting</span>
          </div>
        )}

        {/* Blurred activity previews - decorative */}
        <div className="space-y-2 mb-6 opacity-40 blur-[2px] pointer-events-none">
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
            >
              <div className="w-8 h-8 rounded-lg bg-muted" />
              <div className="flex-1">
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-2 w-16 bg-muted/50 rounded mt-1" />
              </div>
            </div>
          ))}
        </div>

        {/* === CTA SECTION - depends on user state === */}
        {isFirstTrip ? (
          /* FIRST TRIP: Explain free preview + offer paths */
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Gift className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your first 2 days are <span className="font-medium text-foreground">free</span>! 
                Unlock remaining days with credits to get full venue details, photos & tips.
              </p>
            </div>

            <Button
              onClick={handleGetCredits}
              className="w-full gap-2 rounded-xl"
              size="lg"
            >
              <CreditCard className="h-4 w-4" />
              Get Credits to Unlock
            </Button>

            {tripId && (
              <Button
                variant="outline"
                onClick={handleManualBuild}
                className="w-full gap-2 rounded-xl"
                size="lg"
              >
                <Pencil className="h-4 w-4" />
                I'll build it myself
              </Button>
            )}
          </div>
        ) : canAfford ? (
          /* HAS CREDITS: Auto-unlock handles it. Show loading fallback. */
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Unlocking...</span>
            </div>
          </div>
        ) : (
          /* NO CREDITS: Buy credits then generate */
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <CreditCard className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                You need more credits to unlock this day.
              </p>
            </div>

            <Button
              onClick={handleGetCredits}
              className="w-full gap-2 rounded-xl"
              size="lg"
            >
              <CreditCard className="h-4 w-4" />
              Get Credits to Unlock
            </Button>

            {tripId && (
              <Button
                variant="outline"
                onClick={handleManualBuild}
                className="w-full gap-2 rounded-xl"
                size="lg"
              >
                <Pencil className="h-4 w-4" />
                I'll build it myself
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Decorative lock overlay */}
      <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-muted/80 flex items-center justify-center">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
    </motion.div>
  );
}

export default LockedDayCard;
