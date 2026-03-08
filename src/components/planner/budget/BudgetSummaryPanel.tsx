/**
 * Budget Summary Panel
 * 
 * Collapsible header showing budget status at a glance.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BudgetSummary } from '@/services/tripBudgetService';

interface BudgetSummaryPanelProps {
  summary: BudgetSummary | null;
  currency?: string;
  onExpandClick?: () => void;
  className?: string;
}

export function BudgetSummaryPanel({ 
  summary, 
  currency = 'USD',
  onExpandClick,
  className 
}: BudgetSummaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!summary) {
    return (
      <div className={cn("bg-card border border-border rounded-lg p-4", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="h-4 w-4" />
          <span className="text-sm">No budget set</span>
          {onExpandClick && (
            <Button variant="link" size="sm" onClick={onExpandClick} className="ml-auto">
              Set Budget
            </Button>
          )}
        </div>
      </div>
    );
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const usedPercent = summary.budgetTotalCents > 0 ? Math.min(summary.usedPercent, 150) : 0;
  const progressColor = summary.status === 'red' ? 'bg-destructive' :
                        summary.status === 'yellow' ? 'bg-yellow-500' :
                        summary.status === 'on_track' ? 'bg-primary' : 'bg-green-500';

  const StatusIcon = summary.status === 'red' || summary.status === 'yellow' 
    ? AlertTriangle 
    : summary.status === 'on_track' ? TrendingUp : CheckCircle;

  const statusColor = summary.status === 'red' ? 'text-destructive' :
                      summary.status === 'yellow' ? 'text-yellow-500' :
                      'text-green-500';

  return (
    <div className={cn("bg-card border border-border rounded-lg overflow-hidden", className)}>
      {/* Collapsed View - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-5 w-5", statusColor)} />
          <div className="text-left">
            <p className="text-sm font-medium">
              {formatCurrency(summary.remainingCents)} remaining
            </p>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(summary.budgetTotalCents || 0)} total
            </p>
          </div>
        </div>

        <div className="flex-1 mx-4">
          <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className={cn("absolute inset-y-0 left-0 rounded-full transition-all", progressColor)}
              style={{ width: `${Math.min(usedPercent, 100)}%` }}
            />
            {usedPercent > 100 && (
              <div 
                className="absolute inset-y-0 bg-destructive/50 rounded-r-full"
                style={{ left: '100%', width: `${Math.min(usedPercent - 100, 50)}%` }}
              />
            )}
          </div>
        </div>

        <Badge variant={summary.status === 'under' ? 'secondary' : summary.status === 'red' ? 'destructive' : 'outline'}>
          {Math.round(summary.usedPercent)}% used
        </Badge>

        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded View */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4 bg-accent/20">
          {/* Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Budget</p>
              <p className="text-lg font-medium">{formatCurrency(summary.budgetTotalCents)}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(summary.budgetPerPersonCents)}/person
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Committed</p>
              <p className="text-lg font-medium">{formatCurrency(summary.totalCommittedCents)}</p>
              <p className="text-xs text-muted-foreground">
                Hotel: {formatCurrency(summary.committedHotelCents)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Planned</p>
              <p className="text-lg font-medium">{formatCurrency(summary.plannedTotalCents)}</p>
              <p className="text-xs text-muted-foreground">
                Activities & food
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Remaining</p>
              <p className={cn("text-lg font-medium", summary.remainingCents < 0 && "text-destructive")}>
                {formatCurrency(summary.remainingCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                ~{formatCurrency(summary.dailyTargetCents)}/day
              </p>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">By Category</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-background rounded p-2">
                <p className="text-muted-foreground">Food</p>
                <p className="font-medium">{formatCurrency(summary.plannedFoodCents)}</p>
              </div>
              <div className="bg-background rounded p-2">
                <p className="text-muted-foreground">Activities</p>
                <p className="font-medium">{formatCurrency(summary.plannedActivitiesCents)}</p>
              </div>
              <div className="bg-background rounded p-2">
                <p className="text-muted-foreground">Transit</p>
                <p className="font-medium">{formatCurrency(summary.plannedTransitCents)}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          {onExpandClick && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onExpandClick}>
                Manage Budget
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BudgetSummaryPanel;
