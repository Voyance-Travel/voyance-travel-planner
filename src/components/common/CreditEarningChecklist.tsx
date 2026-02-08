/**
 * Credit Earning Checklist
 * Dashboard component showing all bonus opportunities
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Gift, ChevronRight, Sparkles } from 'lucide-react';
import { useBonusCredits, BONUS_INFO, BonusType } from '@/hooks/useBonusCredits';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Routes for each bonus type
const BONUS_ROUTES: Partial<Record<BonusType, string>> = {
  quiz_completion: '/quiz',
  preferences_completion: '/profile?tab=preferences',
  first_share: '/trips',
  second_itinerary: '/plan',
};

interface CreditEarningChecklistProps {
  className?: string;
  compact?: boolean;
}

export const CreditEarningChecklist = React.forwardRef<HTMLDivElement, CreditEarningChecklistProps>(function CreditEarningChecklist({ className, compact = false }, ref) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasClaimedBonus, isLoading } = useBonusCredits();

  if (!user || isLoading) return null;

  // All bonus types in order of typical user journey
  const allBonuses: BonusType[] = [
    'welcome',
    'launch',
    'quiz_completion',
    'preferences_completion',
    'first_share',
    'second_itinerary',
  ];

  // Calculate total earned and potential
  const earnedCredits = allBonuses
    .filter(type => hasClaimedBonus(type))
    .reduce((sum, type) => sum + BONUS_INFO[type].credits, 0);

  const potentialCredits = allBonuses
    .filter(type => !hasClaimedBonus(type))
    .reduce((sum, type) => sum + BONUS_INFO[type].credits, 0);

  const handleNavigate = (type: BonusType) => {
    const route = BONUS_ROUTES[type];
    if (route) {
      navigate(route);
    }
  };

  if (compact) {
    // Compact version for sidebar/card
    const nextUnclaimed = allBonuses.find(type => !hasClaimedBonus(type) && BONUS_ROUTES[type]);
    
    if (!nextUnclaimed) return null;

    const info = BONUS_INFO[nextUnclaimed];
    
    return (
      <button
        onClick={() => handleNavigate(nextUnclaimed)}
        className={cn(
          'w-full p-3 rounded-lg bg-accent/5 border border-accent/10 hover:bg-accent/10 transition-colors text-left',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{info.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Earn +{info.credits} credits</p>
            <p className="text-xs text-muted-foreground truncate">{info.title}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>
    );
  }

  return (
    <div className={cn('rounded-xl border bg-card p-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
          <Gift className="h-6 w-6 text-accent" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Earn Free Credits</h3>
          <p className="text-sm text-muted-foreground">
            Complete tasks to unlock rewards
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-2xl font-bold text-accent">{earnedCredits}</p>
          <p className="text-xs text-muted-foreground">Credits Earned</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-2xl font-bold text-muted-foreground">{potentialCredits}</p>
          <p className="text-xs text-muted-foreground">Available to Earn</p>
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {allBonuses.map((type, index) => {
          const claimed = hasClaimedBonus(type);
          const info = BONUS_INFO[type];
          const hasRoute = !!BONUS_ROUTES[type];
          const isClickable = !claimed && hasRoute;

          return (
            <motion.div
              key={type}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <button
                onClick={() => isClickable && handleNavigate(type)}
                disabled={!isClickable}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                  claimed 
                    ? 'bg-green-500/5 border border-green-500/20' 
                    : isClickable 
                      ? 'bg-muted/50 hover:bg-muted border border-transparent'
                      : 'bg-muted/30 border border-transparent opacity-60'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    claimed ? 'bg-green-500/10' : 'bg-accent/10'
                  )}
                >
                  {claimed ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <span className="text-base">{info.icon}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium',
                    claimed && 'text-green-600 dark:text-green-400'
                  )}>
                    {info.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {info.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-bold',
                      claimed ? 'text-green-600 dark:text-green-400' : 'text-accent'
                    )}
                  >
                    +{info.credits}
                  </span>
                  {isClickable && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Footer motivation */}
      {potentialCredits > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/10 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Complete all tasks to maximize your free credits!
          </p>
        </div>
      )}
    </div>
  );
});

export default CreditEarningChecklist;
