/**
 * FreeActionsCounter — Compact sidebar widget showing remaining free actions per trip.
 * Displays per-action breakdown with tier badge and CTA when exhausted.
 */

import { motion } from 'framer-motion';
import { Repeat, RefreshCw, MessageCircle, UtensilsCrossed, Crown, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type FreeCaps, type EntitlementsResponse } from '@/hooks/useEntitlements';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

interface FreeActionsCounterProps {
  entitlements: EntitlementsResponse | undefined;
  className?: string;
}

const ACTION_CONFIG = [
  { key: 'swaps' as const, label: 'Swaps', icon: Repeat },
  { key: 'regenerates' as const, label: 'Regens', icon: RefreshCw },
  { key: 'ai_messages' as const, label: 'AI Chat', icon: MessageCircle },
  { key: 'restaurant_recs' as const, label: 'Restaurants', icon: UtensilsCrossed },
];

const TIER_LABELS: Record<string, string> = {
  voyager: 'Voyager',
  explorer: 'Explorer',
  adventurer: 'Adventurer',
};

export function FreeActionsCounter({ entitlements, className }: FreeActionsCounterProps) {
  const navigate = useNavigate();

  if (!entitlements) return null;

  const { free_caps, remaining_free_actions, tier } = entitlements;
  const isClub = tier === 'voyager' || tier === 'explorer' || tier === 'adventurer';
  const allExhausted = ACTION_CONFIG.every(a => (remaining_free_actions?.[a.key] ?? 0) <= 0);

  return (
    <div className={cn('rounded-lg border border-border bg-card p-3 space-y-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Free Actions</span>
        {isClub && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
            <Crown className="h-2.5 w-2.5" />
            {TIER_LABELS[tier]}
          </span>
        )}
      </div>

      {/* Per-action bars */}
      <div className="space-y-1.5">
        {ACTION_CONFIG.map(({ key, label, icon: Icon }) => {
          const remaining = remaining_free_actions?.[key] ?? 0;
          const cap = free_caps?.[key] ?? 0;
          const pct = cap > 0 ? Math.max(0, Math.min(100, (remaining / cap) * 100)) : 0;
          const isLow = remaining > 0 && remaining <= Math.ceil(cap * 0.25);

          return (
            <div key={key} className="flex items-center gap-2">
              <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={cn(
                      'h-full rounded-full',
                      remaining <= 0 ? 'bg-destructive/50' : isLow ? 'bg-gold' : 'bg-primary'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
              </div>
              <span className={cn(
                'text-[10px] tabular-nums font-medium shrink-0 w-8 text-right',
                remaining <= 0 ? 'text-destructive' : isLow ? 'text-gold' : 'text-muted-foreground'
              )}>
                {remaining}/{cap}
              </span>
            </div>
          );
        })}
      </div>

      {/* CTA when all exhausted */}
      {allExhausted && (
        <button
          onClick={() => navigate(ROUTES.PRICING)}
          className="flex items-center justify-center gap-1.5 w-full text-[11px] font-medium text-primary hover:text-primary/80 py-1.5 transition-colors"
        >
          <Coins className="h-3 w-3" />
          Get more credits
        </button>
      )}
    </div>
  );
}
