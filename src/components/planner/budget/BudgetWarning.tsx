/**
 * Budget Warning Toast
 *
 * Actionable budget warning that appears when users are over budget.
 * Takes EXPLICIT primitive props (not a summary blob) so the percent and
 * dollar overage are guaranteed to come from the same source of truth.
 */

import { AlertTriangle, XCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BudgetWarningProps {
  status: 'yellow' | 'red';
  /** Total used as a percentage of budget (e.g. 138 for 138%) */
  usedPercent: number;
  /** Cents over budget when status === 'red'. Ignored otherwise. */
  overageCents: number;
  /** Cents remaining when status === 'yellow'. Ignored otherwise. */
  remainingCents: number;
  currency: string;
  onDismiss?: () => void;
  onRebalance?: () => void;
  onSwapSuggestion?: () => void;
  className?: string;
}

export function BudgetWarning({
  status,
  usedPercent,
  overageCents,
  remainingCents,
  currency,
  onDismiss,
  onRebalance,
  onSwapSuggestion,
  className,
}: BudgetWarningProps) {
  const isRed = status === 'red';
  const safeUsedPercent = isFinite(usedPercent) ? Math.round(usedPercent) : 0;
  const safeOveragePercent = isFinite(usedPercent) ? Math.max(0, Math.round(usedPercent - 100)) : 0;
  const safeOverageCents = isFinite(overageCents) ? Math.max(0, overageCents) : 0;
  const safeRemainingCents = isFinite(remainingCents) ? Math.max(0, remainingCents) : 0;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg border",
        isRed
          ? "bg-destructive/10 border-destructive/30 text-destructive"
          : "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
        className
      )}
    >
      {isRed ? (
        <XCircle className="h-5 w-5 flex-shrink-0" />
      ) : (
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium">
          {isRed ? 'Over Budget' : 'Approaching Budget Limit'}
        </p>
        <p className="text-sm opacity-80">
          {isRed
            ? `You're ${formatCurrency(safeOverageCents)} (${safeOveragePercent}%) over your budget.`
            : `You've used ${safeUsedPercent}% of your budget — ${formatCurrency(safeRemainingCents)} remaining.`
          }
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {onSwapSuggestion && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSwapSuggestion}
            className={cn(
              isRed ? "hover:bg-destructive/20" : "hover:bg-yellow-500/20"
            )}
          >
            <ArrowRight className="h-4 w-4 mr-1" />
            Swap Ideas
          </Button>
        )}

        {onRebalance && isRed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRebalance}
            className="hover:bg-destructive/20"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Rebalance
          </Button>
        )}

        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="h-8 w-8"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default BudgetWarning;
