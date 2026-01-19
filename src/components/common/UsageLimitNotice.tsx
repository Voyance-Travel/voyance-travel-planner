/**
 * Usage Limit Notice
 * 
 * Shows transparent usage information before using limited features.
 * Displays remaining monthly limits for free users.
 */

import { AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UsageLimitNoticeProps {
  featureName: string;
  remaining: number;
  limit: number;
  isPaid?: boolean;
  className?: string;
  variant?: 'info' | 'warning' | 'last';
}

export function UsageLimitNotice({
  featureName,
  remaining,
  limit,
  isPaid = false,
  className,
  variant: propVariant,
}: UsageLimitNoticeProps) {
  // Don't show for paid users (unlimited)
  if (isPaid) return null;
  
  // Determine variant based on remaining count
  const variant = propVariant ?? (remaining === 1 ? 'last' : remaining <= Math.ceil(limit / 3) ? 'warning' : 'info');
  
  const getMessage = () => {
    if (remaining === 1) {
      return `This is your last free ${featureName} this month.`;
    }
    if (remaining === limit) {
      return `You have ${remaining} free ${featureName}${remaining > 1 ? 's' : ''} this month.`;
    }
    return `You have ${remaining} ${featureName}${remaining > 1 ? 's' : ''} remaining this month.`;
  };

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
}

export function UsageBadge({ remaining, isPaid, className }: UsageBadgeProps) {
  if (isPaid) return null;
  if (remaining <= 0) return null;
  
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
