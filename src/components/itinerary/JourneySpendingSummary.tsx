/**
 * JourneySpendingSummary — Cross-leg spending overview for linked trips on the Payments tab.
 * Shows expected spend (from activity_costs) and paid amounts (from trip_payments).
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface LegSpending {
  id: string;
  destination: string;
  journeyOrder: number;
  budgetTotalCents: number | null;
  expectedCents: number;
  paidCents: number;
  currency: string;
}

interface JourneySpendingSummaryProps {
  journeyId: string;
  journeyName: string | null;
  currentTripId: string;
  currency?: string;
}

export function JourneySpendingSummary({ journeyId, journeyName, currentTripId, currency = 'USD' }: JourneySpendingSummaryProps) {
  const [legs, setLegs] = useState<LegSpending[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: trips } = await supabase
        .from('trips')
        .select('id, destination, journey_order, budget_total_cents, budget_currency')
        .eq('journey_id', journeyId)
        .order('journey_order', { ascending: true });

      if (!trips?.length) { setLoading(false); return; }

      const tripIds = trips.map(t => t.id);

      // Fetch activity_costs for expected spend per leg
      const { data: costs } = await supabase
        .from('activity_costs')
        .select('trip_id, cost_per_person_usd, num_travelers')
        .in('trip_id', tripIds);

      const expectedMap = new Map<string, number>();
      (costs || []).forEach(c => {
        const total = (c.cost_per_person_usd || 0) * (c.num_travelers || 1) * 100; // convert to cents
        expectedMap.set(c.trip_id, (expectedMap.get(c.trip_id) || 0) + total);
      });

      // Fetch payments for paid amounts
      const { data: payments } = await supabase
        .from('trip_payments')
        .select('trip_id, amount_cents, status')
        .in('trip_id', tripIds)
        .is('archived_at', null);

      const paidMap = new Map<string, number>();
      (payments || []).forEach(p => {
        if (p.status === 'paid' || p.status === 'completed') {
          paidMap.set(p.trip_id, (paidMap.get(p.trip_id) || 0) + (p.amount_cents || 0));
        }
      });

      setLegs(trips.map(t => ({
        id: t.id,
        destination: t.destination,
        journeyOrder: t.journey_order ?? 0,
        budgetTotalCents: t.budget_total_cents,
        expectedCents: Math.round(expectedMap.get(t.id) || 0),
        paidCents: paidMap.get(t.id) || 0,
        currency: t.budget_currency || currency,
      })));
      setLoading(false);
    }
    fetch();
  }, [journeyId, currency]);

  const fmt = (cents: number, cur: string = currency) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);

  const totalExpected = legs.reduce((s, l) => s + l.expectedCents, 0);
  const totalPaid = legs.reduce((s, l) => s + l.paidCents, 0);
  const totalBudget = legs.reduce((s, l) => s + (l.budgetTotalCents || 0), 0);

  if (loading || (totalExpected === 0 && totalPaid === 0)) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Journey Spending</h4>
          {journeyName && <span className="text-xs text-muted-foreground ml-auto truncate max-w-[140px]">{journeyName}</span>}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Per-leg one-liner showing expected spend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {legs.map(leg => {
            const displayAmount = leg.expectedCents > 0 ? leg.expectedCents : leg.paidCents;
            const isCurrent = leg.id === currentTripId;
            return (
              <span key={leg.id} className={cn('flex items-center gap-1', isCurrent && 'font-semibold text-primary')}>
                <MapPin className="h-3 w-3 text-muted-foreground" />
                {leg.destination}: {fmt(displayAmount, leg.currency)}
                {leg.paidCents > 0 && leg.expectedCents > 0 && (
                  <span className="text-xs text-muted-foreground">({fmt(leg.paidCents, leg.currency)} paid)</span>
                )}
              </span>
            );
          })}
        </div>

        {/* Progress bars per leg if budgets exist */}
        {totalBudget > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            {legs.filter(l => l.budgetTotalCents && l.budgetTotalCents > 0).map(leg => {
              const spent = leg.expectedCents > 0 ? leg.expectedCents : leg.paidCents;
              const pct = Math.min(100, Math.round((spent / (leg.budgetTotalCents || 1)) * 100));
              const isCurrent = leg.id === currentTripId;
              return (
                <div key={leg.id}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className={cn('font-medium', isCurrent && 'text-primary')}>{leg.destination}</span>
                    <span className="text-muted-foreground">{fmt(spent)} / {fmt(leg.budgetTotalCents || 0)}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </div>
        )}

        {/* Journey total */}
        <div className="pt-3 border-t border-border flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">Journey Total</span>
          <div className="text-right">
            <span className="font-semibold">{fmt(totalExpected > 0 ? totalExpected : totalPaid)}</span>
            {totalBudget > 0 && (
              <span className="text-xs text-muted-foreground ml-1.5">of {fmt(totalBudget)}</span>
            )}
            {totalPaid > 0 && totalExpected > 0 && (
              <span className="text-xs text-muted-foreground ml-1.5">({fmt(totalPaid)} paid)</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
