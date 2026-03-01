/**
 * GroupBudgetDisplay — Shows the group credit pool status.
 * Progress bar, remaining credits, recent transactions, top-up button for owner.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Users, Coins, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCredits } from '@/config/pricing';

interface GroupBudgetDisplayProps {
  tripId: string;
  onTopUp?: () => void;
  className?: string;
}

export function GroupBudgetDisplay({ tripId, onTopUp, className }: GroupBudgetDisplayProps) {
  const { user } = useAuth();

  const { data: budget, isLoading } = useQuery({
    queryKey: ['group-budget', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_budgets')
        .select('id, tier, initial_credits, remaining_credits, owner_id')
        .eq('trip_id', tripId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
    staleTime: 30_000,
  });

  const { data: recentTx } = useQuery({
    queryKey: ['group-budget-tx', budget?.id],
    queryFn: async () => {
      if (!budget?.id) return [];
      const { data, error } = await supabase
        .from('group_budget_transactions')
        .select('id, user_id, action_type, credits_spent, was_free, created_at')
        .eq('group_budget_id', budget.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!budget?.id,
    staleTime: 30_000,
  });

  // Still loading
  if (isLoading) return null;

  // No budget yet — show purchase prompt for owner
  if (!budget) {
    if (!user || !onTopUp) return null;
    return (
      <div className={cn('rounded-lg border border-dashed border-border bg-card/50 p-4 space-y-2', className)}>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Group Credits</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Fund a shared credit pool so your group can swap activities, get AI tips, and personalize the trip.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={onTopUp}
        >
          <Plus className="h-3 w-3" />
          <Coins className="h-3 w-3" />
          Purchase group credits
        </Button>
      </div>
    );
  }

  const pct = budget.initial_credits > 0
    ? Math.max(0, Math.min(100, (budget.remaining_credits / budget.initial_credits) * 100))
    : 0;
  const isLow = pct > 0 && pct <= 20;
  const isDepleted = budget.remaining_credits <= 0;
  const isOwner = user?.id === budget.owner_id;

  const tierLabel = budget.tier === 'small' ? 'Small' : budget.tier === 'medium' ? 'Medium' : 'Large';

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{tierLabel} Group Pool</span>
        </div>
        <span className={cn(
          'text-xs font-semibold',
          isDepleted ? 'text-destructive' : isLow ? 'text-gold' : 'text-muted-foreground'
        )}>
          {formatCredits(budget.remaining_credits)} / {formatCredits(budget.initial_credits)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full',
            isDepleted ? 'bg-destructive/50' : isLow ? 'bg-gold' : 'bg-primary'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Recent activity */}
      {recentTx && recentTx.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Recent</span>
          {recentTx.slice(0, 3).map(tx => (
            <div key={tx.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {tx.action_type.replace(/_/g, ' ')}
              </span>
              <span className={tx.was_free ? 'text-muted-foreground' : 'text-foreground font-medium'}>
                {tx.was_free ? 'Free' : `-${tx.credits_spent}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Top-up for owner */}
      {isOwner && onTopUp && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={onTopUp}
        >
          <Plus className="h-3 w-3" />
          <Coins className="h-3 w-3" />
          Top up pool
        </Button>
      )}
    </div>
  );
}
