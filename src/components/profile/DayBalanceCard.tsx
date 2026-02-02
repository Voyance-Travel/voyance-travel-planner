/**
 * Day Balance Card - Displays user's day balance for the new day-based pricing model
 */

import { motion } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  Calendar, 
  Sparkles, 
  RefreshCw, 
  Shuffle, 
  Clock, 
  Crown,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDayBalance, useRefreshDayBalance, DayBalanceData } from '@/hooks/useDayBalance';

interface DayBalanceCardProps {
  onBuyDays?: () => void;
  className?: string;
}

export default function DayBalanceCard({ onBuyDays, className }: DayBalanceCardProps) {
  const { data, isLoading, error } = useDayBalance();
  const refreshBalance = useRefreshDayBalance();

  if (isLoading) {
    return (
      <div className={cn("bg-card rounded-xl border border-border p-6", className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-card rounded-xl border border-destructive/50 p-6", className)}>
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">Failed to load day balance</p>
        </div>
      </div>
    );
  }

  const { balance, totalDays, hasActiveTier, isComplete, isEssential, freeDaysExpired, effectiveFreeDays } = data || {
    balance: null,
    totalDays: 0,
    hasActiveTier: false,
    isComplete: false,
    isEssential: false,
    freeDaysExpired: false,
    effectiveFreeDays: 0,
  };

  const tierLabel = isComplete ? 'Complete' : isEssential ? 'Essential' : 'Free';
  const tierColor = isComplete ? 'text-primary' : isEssential ? 'text-accent' : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative bg-gradient-to-br from-card via-card to-muted/30 rounded-xl border border-border overflow-hidden",
        className
      )}
    >
      {/* Tier badge */}
      {hasActiveTier && (
        <div className="absolute top-0 right-0 px-3 py-1.5 bg-gradient-to-l from-primary/10 to-transparent">
          <div className="flex items-center gap-1.5">
            <Crown className={cn("h-3.5 w-3.5", tierColor)} />
            <span className={cn("text-xs font-semibold uppercase tracking-wide", tierColor)}>
              {tierLabel} Tier
            </span>
          </div>
        </div>
      )}

      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Day Balance
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshBalance}
            className="ml-auto h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Main balance display */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Available Days</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-serif font-medium text-foreground tracking-tight">
                {totalDays}
              </span>
              <span className="text-lg text-muted-foreground">days</span>
            </div>
            {balance && (
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  {balance.purchased_days} purchased
                </span>
                {effectiveFreeDays > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    {effectiveFreeDays} free
                  </span>
                )}
                {freeDaysExpired && balance.free_days > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <Clock className="h-3 w-3" />
                    {balance.free_days} expired
                  </span>
                )}
              </div>
            )}
          </div>

          {onBuyDays && (
            <Button 
              onClick={onBuyDays}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Buy More Days
            </Button>
          )}
        </div>

        {/* Swaps and Regenerates */}
        {balance && (
          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Shuffle className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Swaps Remaining</p>
                <p className="text-lg font-medium text-foreground">
                  {balance.swaps_remaining !== null ? balance.swaps_remaining : '∞'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <RefreshCw className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Regenerates Left</p>
                <p className="text-lg font-medium text-foreground">
                  {balance.regenerates_remaining !== null ? balance.regenerates_remaining : '∞'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Free days expiration warning */}
        {balance?.free_days_expires_at && effectiveFreeDays > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Free days expire {formatDistanceToNow(new Date(balance.free_days_expires_at), { addSuffix: true })}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!balance && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              You don't have any days yet. Purchase a package to get started!
            </p>
            {onBuyDays && (
              <Button onClick={onBuyDays} variant="outline">
                Browse Packages
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
