/**
 * JourneyBudgetSummary — Read-only cross-leg budget overview for linked trips.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface LegBudget {
  id: string;
  destination: string;
  journeyOrder: number;
  budgetTotalCents: number | null;
  spentCents: number;
  currency: string;
}

interface JourneyBudgetSummaryProps {
  journeyId: string;
  journeyName: string | null;
  currentTripId: string;
  currency?: string;
}

export function JourneyBudgetSummary({ journeyId, journeyName, currentTripId, currency = 'USD' }: JourneyBudgetSummaryProps) {
  const [legs, setLegs] = useState<LegBudget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJourneyBudgets() {
      // Fetch all legs with budget info
      const { data: trips } = await supabase
        .from('trips')
        .select('id, destination, journey_order, budget_total_cents, budget_currency')
        .eq('journey_id', journeyId)
        .order('journey_order', { ascending: true });

      if (!trips || trips.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch spending for each leg from activity_costs
      const tripIds = trips.map(t => t.id);
      const { data: costs } = await supabase
        .from('activity_costs')
        .select('trip_id, total_cost_usd')
        .in('trip_id', tripIds);

      // Sum spend per trip
      const spendMap = new Map<string, number>();
      (costs || []).forEach(c => {
        const prev = spendMap.get(c.trip_id) || 0;
        // total_cost_usd is in dollars, convert to cents
        spendMap.set(c.trip_id, prev + Math.round((c.total_cost_usd || 0) * 100));
      });

      setLegs(trips.map(t => ({
        id: t.id,
        destination: t.destination,
        journeyOrder: t.journey_order ?? 0,
        budgetTotalCents: t.budget_total_cents,
        spentCents: spendMap.get(t.id) || 0,
        currency: t.budget_currency || currency,
      })));
      setLoading(false);
    }
    fetchJourneyBudgets();
  }, [journeyId, currency]);

  const formatCurrency = (cents: number, cur: string = currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  // Only show if at least one leg has a budget
  const anyBudget = legs.some(l => l.budgetTotalCents && l.budgetTotalCents > 0);
  if (loading || !anyBudget) return null;

  const totalBudget = legs.reduce((sum, l) => sum + (l.budgetTotalCents || 0), 0);
  const totalSpent = legs.reduce((sum, l) => sum + l.spentCents, 0);
  const totalRemaining = totalBudget - totalSpent;
  const totalPercent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card/50 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Full Journey Budget</h4>
          {journeyName && (
            <span className="text-xs text-muted-foreground ml-auto truncate max-w-[140px]">{journeyName}</span>
          )}
        </div>
      </div>

      {/* Per-leg breakdown */}
      <div className="p-4 space-y-3">
        {legs.map(leg => {
          const budget = leg.budgetTotalCents || 0;
          const remaining = budget - leg.spentCents;
          const pct = budget > 0 ? Math.min(100, Math.round((leg.spentCents / budget) * 100)) : 0;
          const isCurrent = leg.id === currentTripId;
          const isOver = remaining < 0;

          return (
            <div
              key={leg.id}
              className={cn(
                'rounded-lg p-3 border transition-colors',
                isCurrent ? 'border-primary/30 bg-primary/5' : 'border-border bg-background'
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className={cn('text-sm font-medium', isCurrent && 'text-primary')}>
                    {leg.destination}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] text-primary/70 font-medium">(current)</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {budget > 0 ? formatCurrency(budget, leg.currency) : 'No budget'}
                </span>
              </div>

              {budget > 0 && (
                <>
                  <Progress value={pct} className="h-1.5 mb-1" />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Spent: {formatCurrency(leg.spentCents, leg.currency)}</span>
                    <span className={cn(isOver && 'text-destructive font-medium')}>
                      {isOver ? `Over by ${formatCurrency(Math.abs(remaining), leg.currency)}` : `${formatCurrency(remaining, leg.currency)} left`}
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Journey total */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-foreground">Journey Total</span>
            <span className="text-sm font-semibold">{formatCurrency(totalBudget)}</span>
          </div>
          <Progress value={totalPercent} className="h-2 mb-1.5" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Spent: {formatCurrency(totalSpent)}</span>
            <span className={cn(totalRemaining < 0 && 'text-destructive font-medium')}>
              {totalRemaining < 0
                ? `Over by ${formatCurrency(Math.abs(totalRemaining))}`
                : `${formatCurrency(totalRemaining)} remaining`}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
