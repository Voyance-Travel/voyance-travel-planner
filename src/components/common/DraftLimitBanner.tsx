/**
 * Draft Limit Banner
 * 
 * Shows a dismissible banner when user is approaching or at their draft limit.
 * Used on trip creation and dashboard pages.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraftLimitCheck } from '@/hooks/useDraftLimitCheck';
import { ROUTES } from '@/config/routes';

interface DraftLimitBannerProps {
  /** Whether to show the banner even when not at limit */
  showWarning?: boolean;
  /** Custom class name */
  className?: string;
}

export function DraftLimitBanner({ showWarning = true, className = '' }: DraftLimitBannerProps) {
  const navigate = useNavigate();
  const { canCreateDraft, remaining, maxDrafts, message, isLoading, upgradePath } = useDraftLimitCheck();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if loading, dismissed, or unlimited
  if (isLoading || dismissed || maxDrafts === -1) {
    return null;
  }

  // Show warning when at 1 remaining (approaching limit)
  const isApproaching = remaining === 1 && canCreateDraft;
  const isAtLimit = !canCreateDraft;

  // Don't show if not at limit and not approaching (unless showWarning is false)
  if (!isAtLimit && !isApproaching) {
    return null;
  }

  const handleUpgrade = () => {
    const highlight = upgradePath || 'monthly';
    navigate(`${ROUTES.PRICING}?highlight=${highlight}`);
  };

  return (
    <div
      className={`relative flex items-center justify-between gap-4 p-4 rounded-lg ${
        isAtLimit 
          ? 'bg-red-500/10 border border-red-500/30' 
          : 'bg-amber-500/10 border border-amber-500/30'
      } ${className}`}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle 
          className={`w-5 h-5 flex-shrink-0 ${isAtLimit ? 'text-red-500' : 'text-amber-500'}`} 
        />
        <div>
          <p className={`text-sm font-medium ${isAtLimit ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {isAtLimit ? 'Draft Limit Reached' : 'Approaching Draft Limit'}
          </p>
          <p className="text-sm text-muted-foreground">
            {message}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleUpgrade} className="gap-1.5">
          Upgrade
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
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

export default DraftLimitBanner;
