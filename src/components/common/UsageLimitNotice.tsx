/**
 * Usage Limit Notice
 * 
 * Shows transparent usage information before using limited features.
 * Displays remaining monthly limits for free users.
 */

import { AlertCircle, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UsageLimitNoticeProps {
  featureName: string;
  remaining: number;
  limit: number;
  isPaid?: boolean;
  className?: string;
  variant?: 'info' | 'warning' | 'last';
  /** Show as subtle inline text instead of a banner */
  inline?: boolean;
}

export function UsageLimitNotice({
  featureName,
  remaining,
  limit,
  isPaid = false,
  className,
  variant: propVariant,
  inline = false,
}: UsageLimitNoticeProps) {
  // Don't show for paid users (unlimited)
  if (isPaid || remaining === -1) return null;
  
  // Determine variant based on remaining count
  const variant = propVariant ?? (remaining === 1 ? 'last' : remaining <= Math.ceil(limit / 3) ? 'warning' : 'info');
  
  const getMessage = () => {
    if (remaining === 0) {
      return `No ${featureName}s remaining this month.`;
    }
    if (remaining === 1) {
      return `This is your last free ${featureName} this month.`;
    }
    if (remaining === limit) {
      return `You have ${remaining} free ${featureName}${remaining > 1 ? 's' : ''} this month.`;
    }
    return `You have ${remaining} ${featureName}${remaining > 1 ? 's' : ''} remaining this month.`;
  };

  if (inline) {
    return (
      <span className={cn(
        'text-sm',
        variant === 'last' ? 'text-orange-600 dark:text-orange-400' :
        variant === 'warning' ? 'text-amber-600 dark:text-amber-400' :
        'text-muted-foreground',
        className
      )}>
        {remaining}/{limit} {featureName}s
      </span>
    );
  }

  const styles = {
    info: 'bg-muted/50 border-border text-muted-foreground',
    warning: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    last: 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-200',
  };

  const Icon = variant === 'info' ? Info : AlertCircle;

  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm',
      styles[variant],
      className
    )}>
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span>{getMessage()}</span>
    </div>
  );
}

/**
 * Compact inline variant for showing in action buttons or smaller contexts
 */
interface UsageBadgeProps {
  remaining: number;
  isPaid?: boolean;
  className?: string;
  showUnlimited?: boolean;
}

export function UsageBadge({ remaining, isPaid, className, showUnlimited = false }: UsageBadgeProps) {
  if (isPaid || remaining === -1) {
    if (showUnlimited) {
      return (
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary',
          className
        )}>
          <Sparkles className="h-3 w-3 inline mr-0.5" />
          Unlimited
        </span>
      );
    }
    return null;
  }
  if (remaining <= 0) {
    return (
      <span className={cn(
        'text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive',
        className
      )}>
        Limit reached
      </span>
    );
  }
  
  return (
    <span className={cn(
      'text-xs px-1.5 py-0.5 rounded',
      remaining === 1 
        ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
        : 'bg-muted text-muted-foreground',
      className
    )}>
      {remaining} left
    </span>
  );
}

/**
 * Regenerate limit notice - specific to day regeneration
 */
interface RegenerateLimitNoticeProps {
  remaining: number;
  max: number;
  isPaid?: boolean;
  className?: string;
}

export function RegenerateLimitNotice({ remaining, max, isPaid, className }: RegenerateLimitNoticeProps) {
  if (isPaid || remaining === -1) return null;
  
  const isAtLimit = remaining === 0;
  const isLast = remaining === 1;
  
  return (
    <div className={cn(
      'text-xs flex items-center gap-1',
      isAtLimit ? 'text-destructive' : isLast ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground',
      className
    )}>
      <Sparkles className="h-3 w-3" />
      {isAtLimit ? (
        'No regenerates left'
      ) : (
        `${remaining}/${max} regenerates`
      )}
    </div>
  );
}
