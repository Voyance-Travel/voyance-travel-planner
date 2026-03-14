/**
 * Budget Warning Toast
 * 
 * Actionable budget warning that appears when users are over budget.
 */

import { AlertTriangle, XCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BudgetSummary } from '@/services/tripBudgetService';

interface BudgetWarningProps {
  summary: BudgetSummary;
  onDismiss?: () => void;
  onRebalance?: () => void;
  onSwapSuggestion?: () => void;
  className?: string;
}

export function BudgetWarning({
  summary,
  onDismiss,
  onRebalance,
  onSwapSuggestion,
  className,
}: BudgetWarningProps) {
  const isRed = summary.status === 'red';
  const rawOveragePercent = summary.usedPercent - 100;
  const overagePercent = isFinite(rawOveragePercent) ? Math.round(rawOveragePercent) : 0;
  const rawOverageCents = summary.totalCommittedCents + summary.plannedTotalCents - summary.budgetTotalCents;
  const overageCents = isFinite(rawOverageCents) ? rawOverageCents : 0;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: summary.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  if (summary.status !== 'yellow' && summary.status !== 'red') {
    return null;
  }

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
          {isRed ? 'Over Budget' : 'Trending Over Budget'}
        </p>
        <p className="text-sm opacity-80">
          {isRed 
            ? `You're ${formatCurrency(Math.abs(overageCents))} (${overagePercent}%) over your budget.`
            : `You're trending ${overagePercent}% over. Consider some swaps.`
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
