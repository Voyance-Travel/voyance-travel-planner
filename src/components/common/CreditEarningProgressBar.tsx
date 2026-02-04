/**
 * Credit Earning Progress Bar
 * Floating widget showing unclaimed bonus opportunities
 * 
 * Now starts collapsed and auto-expands after 3 seconds for first-time visibility
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, ChevronDown, ChevronUp, Check, Sparkles, X } from 'lucide-react';
import { useBonusCredits, BONUS_INFO, BonusType } from '@/hooks/useBonusCredits';
import { useAuth } from '@/contexts/AuthContext';
import { POPUP_STORAGE } from '@/stores/popup-coordination-store';
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
    route: '/start',
  },
};

// How long before we remind users about unclaimed credits
const COLLAPSE_REMINDER_KEY = 'voyance_progress_bar_last_collapsed';
const REMINDER_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface CreditEarningProgressBarProps {
  className?: string;
}

export function CreditEarningProgressBar({ className }: CreditEarningProgressBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasClaimedBonus, isLoading } = useBonusCredits();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Auto-expand after delay on first visit (or after reminder interval)
  useEffect(() => {
    if (!user || isLoading || isDismissed) return;

    const lastCollapsed = localStorage.getItem(COLLAPSE_REMINDER_KEY);
    const shouldAutoExpand = !lastCollapsed || 
      (Date.now() - parseInt(lastCollapsed, 10)) > REMINDER_INTERVAL_MS;

    if (shouldAutoExpand) {
      const timer = setTimeout(() => {
        setIsExpanded(true);
      }, 3000); // 3 second delay
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, isDismissed]);

  const handleCollapse = () => {
    setIsExpanded(false);
    localStorage.setItem(COLLAPSE_REMINDER_KEY, Date.now().toString());
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(COLLAPSE_REMINDER_KEY, Date.now().toString());
  };

  const handleActionClick = (route?: string) => {
    if (route) {
      navigate(route);
    }
  };

  if (!user || isLoading || isDismissed) return null;

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

  // Don't show on certain pages to avoid clutter
  const hiddenPaths = ['/quiz', '/profile'];
  if (hiddenPaths.some(path => location.pathname.startsWith(path))) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn(
        'fixed bottom-4 right-4 z-40 w-72 sm:w-80 rounded-xl border bg-card shadow-lg',
        className
      )}
    >
      {/* Header - always visible */}
      <div className="flex items-center">
        <button
          onClick={() => isExpanded ? handleCollapse() : setIsExpanded(true)}
          className="flex-1 p-3 sm:p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors rounded-tl-xl"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="font-medium text-sm">Earn Free Credits</p>
            <p className="text-xs text-muted-foreground truncate">
              {potentialCredits} credits available
            </p>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
        </button>
        <button
          onClick={handleDismiss}
          className="p-2 mr-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-3 sm:px-4 pb-3">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
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
            <div className="p-3 sm:p-4 space-y-2">
              {actionableBonuses.map((type) => {
                const claimed = hasClaimedBonus(type);
                const info = BONUS_INFO[type];
                const condition = BONUS_CONDITIONS[type];

                return (
                  <button
                    key={type}
                    onClick={() => !claimed && handleActionClick(condition.route)}
                    disabled={claimed || !condition.route}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
                      claimed 
                        ? 'opacity-60 cursor-default' 
                        : condition.route 
                          ? 'hover:bg-muted/50 cursor-pointer' 
                          : 'cursor-default'
                    )}
                  >
                    <div
                      className={cn(
                        'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-base flex-shrink-0',
                        claimed ? 'bg-green-500/10' : 'bg-accent/10'
                      )}
                    >
                      {claimed ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <span>{info.icon}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs sm:text-sm font-medium truncate', claimed && 'line-through')}>
                        {condition.action}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-xs sm:text-sm font-bold flex-shrink-0',
                        claimed ? 'text-muted-foreground' : 'text-accent'
                      )}
                    >
                      +{info.credits}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Motivational footer */}
            <div className="px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="p-2 sm:p-3 rounded-lg bg-accent/5 border border-accent/10 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent flex-shrink-0" />
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
