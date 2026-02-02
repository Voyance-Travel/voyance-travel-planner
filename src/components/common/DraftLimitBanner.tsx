/**
 * Draft Limit Banner
 * 
 * Shows credit balance and prompts users to get more credits when low.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, ArrowRight, Sparkles, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraftLimitCheck } from '@/hooks/useDraftLimitCheck';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { CREDIT_COSTS, formatCredits } from '@/config/pricing';

interface DraftLimitBannerProps {
  /** Custom class name */
  className?: string;
  /** Compact mode for inline display */
  compact?: boolean;
}

export function DraftLimitBanner({ className = '', compact = false }: DraftLimitBannerProps) {
  const navigate = useNavigate();
  const { canCreateDraft, currentCredits, canUnlockDay, message, isLoading, needsCredits } = useDraftLimitCheck();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if loading, dismissed, or has plenty of credits
  if (isLoading || dismissed || currentCredits >= CREDIT_COSTS.UNLOCK_DAY * 3) {
    return null;
  }

  // Show warning when can't unlock a day
  const isLowCredits = currentCredits > 0 && currentCredits < CREDIT_COSTS.UNLOCK_DAY;
  const isOutOfCredits = currentCredits === 0 || needsCredits;

  // Don't show if not worth showing
  if (!isLowCredits && !isOutOfCredits) {
    return null;
  }

  const handleGetCredits = () => {
    navigate(ROUTES.PRICING);
  };

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-2 text-sm',
        isOutOfCredits ? 'text-destructive' : 'text-muted-foreground',
        className
      )}>
        <Ticket className="h-3.5 w-3.5" />
        <span>{formatCredits(currentCredits)} credits</span>
        {isOutOfCredits && (
          <Button size="sm" variant="link" className="h-auto p-0 text-primary" onClick={handleGetCredits}>
            Get more
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex items-center justify-between gap-4 p-4 rounded-lg',
        isOutOfCredits 
          ? 'bg-destructive/10 border border-destructive/30' 
          : isLowCredits
          ? 'bg-amber-500/10 border border-amber-500/30'
          : 'bg-muted/50 border border-border',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {isOutOfCredits || isLowCredits ? (
          <AlertTriangle 
            className={cn(
              'w-5 h-5 flex-shrink-0',
              isOutOfCredits ? 'text-destructive' : 'text-amber-500'
            )} 
          />
        ) : (
          <Ticket className="w-5 h-5 flex-shrink-0 text-primary" />
        )}
        <div>
          <p className={cn(
            'text-sm font-medium',
            isOutOfCredits ? 'text-destructive' : isLowCredits ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
          )}>
            {isOutOfCredits ? 'Out of Credits' : isLowCredits ? 'Low on Credits' : 'Credits'}
          </p>
          <p className="text-sm text-muted-foreground">
            {message}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(isOutOfCredits || isLowCredits) && (
          <Button size="sm" variant={isOutOfCredits ? 'default' : 'outline'} onClick={handleGetCredits} className="gap-1.5">
            Get Credits
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
        {!isOutOfCredits && (
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
 * Blocking modal when user has no credits
 */
interface DraftLimitBlockerProps {
  onClose?: () => void;
}

export function DraftLimitBlocker({ onClose }: DraftLimitBlockerProps) {
  const navigate = useNavigate();
  const { canUnlockDay, message, isLoading } = useDraftLimitCheck();

  // Don't show if can unlock or loading
  if (isLoading || canUnlockDay) {
    return null;
  }

  const handleGetCredits = () => {
    navigate(ROUTES.PRICING);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md mx-4 text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
          <Ticket className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Need More Credits</h2>
          <p className="text-muted-foreground">{message}</p>
        </div>
        <div className="space-y-3">
          <Button onClick={handleGetCredits} className="w-full gap-2">
            <Sparkles className="w-4 h-4" />
            Get Credits
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="w-full">
              Maybe Later
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Credits never expire once purchased
        </p>
      </div>
    </div>
  );
}

export default DraftLimitBanner;
