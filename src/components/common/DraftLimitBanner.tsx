/**
 * Draft Limit Banner
 * 
 * Shows a banner when user is approaching or at their monthly itinerary limit.
 * Free tier: 5 itineraries/month with Day 1 only visibility.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraftLimitCheck } from '@/hooks/useDraftLimitCheck';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

interface DraftLimitBannerProps {
  /** Custom class name */
  className?: string;
  /** Compact mode for inline display */
  compact?: boolean;
}

export function DraftLimitBanner({ className = '', compact = false }: DraftLimitBannerProps) {
  const navigate = useNavigate();
  const { canCreateDraft, remaining, maxDrafts, message, isLoading, upgradePath, isFreeUser } = useDraftLimitCheck();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if loading, dismissed, unlimited, or not free user
  if (isLoading || dismissed || maxDrafts === -1 || !isFreeUser) {
    return null;
  }

  // Show warning when at 1 remaining (approaching limit)
  const isApproaching = remaining === 1 && canCreateDraft;
  const isAtLimit = !canCreateDraft;

  // Always show for free users to communicate limits
  const showUsageInfo = isFreeUser && remaining > 1 && remaining < maxDrafts;

  // Don't show if not at limit, not approaching, and not useful info
  if (!isAtLimit && !isApproaching && !showUsageInfo) {
    return null;
  }

  const handleUpgrade = () => {
    navigate(`${ROUTES.PRICING}?highlight=trip_pass`);
  };

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-2 text-sm',
        isAtLimit ? 'text-destructive' : 'text-muted-foreground',
        className
      )}>
        <Sparkles className="h-3.5 w-3.5" />
        <span>{remaining === -1 ? 'Unlimited' : `${remaining}/${maxDrafts} itineraries`}</span>
        {isAtLimit && (
          <Button size="sm" variant="link" className="h-auto p-0 text-primary" onClick={handleUpgrade}>
            Upgrade
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex items-center justify-between gap-4 p-4 rounded-lg',
        isAtLimit 
          ? 'bg-destructive/10 border border-destructive/30' 
          : isApproaching
          ? 'bg-amber-500/10 border border-amber-500/30'
          : 'bg-muted/50 border border-border',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {isAtLimit || isApproaching ? (
          <AlertTriangle 
            className={cn(
              'w-5 h-5 flex-shrink-0',
              isAtLimit ? 'text-destructive' : 'text-amber-500'
            )} 
          />
        ) : (
          <Sparkles className="w-5 h-5 flex-shrink-0 text-primary" />
        )}
        <div>
          <p className={cn(
            'text-sm font-medium',
            isAtLimit ? 'text-destructive' : isApproaching ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
          )}>
            {isAtLimit ? 'Monthly Limit Reached' : isApproaching ? 'Last Itinerary' : 'Free Tier'}
          </p>
          <p className="text-sm text-muted-foreground">
            {message}
            {isFreeUser && !isAtLimit && ' · Day 1 only, 3 regenerates'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(isAtLimit || isApproaching) && (
          <Button size="sm" variant={isAtLimit ? 'default' : 'outline'} onClick={handleUpgrade} className="gap-1.5">
            Unlock Full Access
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
        {!isAtLimit && (
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Blocking modal when user has reached their limit
 */
interface DraftLimitBlockerProps {
  onClose?: () => void;
}

export function DraftLimitBlocker({ onClose }: DraftLimitBlockerProps) {
  const navigate = useNavigate();
  const { canCreateDraft, message, isLoading } = useDraftLimitCheck();

  // Don't show if can create or loading
  if (isLoading || canCreateDraft) {
    return null;
  }

  const handleUpgrade = () => {
    navigate(`${ROUTES.PRICING}?highlight=trip_pass`);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md mx-4 text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Monthly Limit Reached</h2>
          <p className="text-muted-foreground">{message}</p>
        </div>
        <div className="space-y-3">
          <Button onClick={handleUpgrade} className="w-full gap-2">
            <Sparkles className="w-4 h-4" />
            Unlock Full Trip — $24.99
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="w-full">
              Maybe Later
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Your limit resets at the start of each month
        </p>
      </div>
    </div>
  );
}

export default DraftLimitBanner;
