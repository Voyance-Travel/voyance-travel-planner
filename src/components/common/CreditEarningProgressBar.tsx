/**
 * Credit Earning Progress Bar
 * Floating widget showing unclaimed bonus opportunities
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, ChevronDown, ChevronUp, Check, Sparkles } from 'lucide-react';
import { useBonusCredits, BONUS_INFO, BonusType } from '@/hooks/useBonusCredits';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Conditions for each bonus type
const BONUS_CONDITIONS: Record<BonusType, {
  action: string;
  route?: string;
}> = {
  welcome: {
    action: 'Sign up and verify email',
  },
  launch: {
    action: 'Join during launch period',
  },
  quiz_completion: {
    action: 'Complete the Travel DNA quiz',
    route: '/quiz',
  },
  preferences_completion: {
    action: 'Set your travel preferences',
    route: '/profile?tab=preferences',
  },
  first_share: {
    action: 'Share your first trip',
  },
  second_itinerary: {
    action: 'Create your second trip',
    route: '/plan',
  },
};

interface CreditEarningProgressBarProps {
  className?: string;
}

export function CreditEarningProgressBar({ className }: CreditEarningProgressBarProps) {
  const { user } = useAuth();
  const { claimedBonuses, hasClaimedBonus, isLoading } = useBonusCredits();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!user || isLoading) return null;

  // Filter to show actionable bonuses (exclude welcome/launch as they're auto-granted)
  const actionableBonuses: BonusType[] = ['quiz_completion', 'preferences_completion', 'first_share', 'second_itinerary'];
  const unclaimedActionable = actionableBonuses.filter(type => !hasClaimedBonus(type));
  const claimedActionable = actionableBonuses.filter(type => hasClaimedBonus(type));

  // Calculate progress
  const totalBonuses = actionableBonuses.length;
  const claimedCount = claimedActionable.length;
  const progress = (claimedCount / totalBonuses) * 100;

  // Calculate potential credits
  const potentialCredits = unclaimedActionable.reduce(
    (sum, type) => sum + BONUS_INFO[type].credits,
    0
  );

  // Don't show if all bonuses claimed
  if (unclaimedActionable.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'fixed bottom-4 right-4 z-40 w-80 rounded-xl border bg-card shadow-lg',
        className
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <Gift className="h-5 w-5 text-accent" />
          </div>
          <div className="text-left">
            <p className="font-medium text-sm">Earn Free Credits</p>
            <p className="text-xs text-muted-foreground">
              {potentialCredits} credits available
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {claimedCount}/{totalBonuses} completed
        </p>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="p-4 space-y-3">
              {actionableBonuses.map((type) => {
                const claimed = hasClaimedBonus(type);
                const info = BONUS_INFO[type];
                const condition = BONUS_CONDITIONS[type];

                return (
                  <div
                    key={type}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg transition-colors',
                      claimed ? 'opacity-60' : 'hover:bg-muted/50'
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-lg',
                        claimed ? 'bg-green-500/10' : 'bg-accent/10'
                      )}
                    >
                      {claimed ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <span>{info.icon}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', claimed && 'line-through')}>
                        {condition.action}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-sm font-bold',
                        claimed ? 'text-muted-foreground' : 'text-accent'
                      )}
                    >
                      +{info.credits}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Motivational footer */}
            <div className="px-4 pb-4">
              <div className="p-3 rounded-lg bg-accent/5 border border-accent/10 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Complete all tasks to earn {actionableBonuses.reduce((s, t) => s + BONUS_INFO[t].credits, 0)} bonus credits!
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default CreditEarningProgressBar;
