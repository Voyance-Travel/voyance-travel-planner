/**
 * Credit Balance Card - Displays user's credit balance for the credit-based pricing model
 */

import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { 
  Ticket, 
  Sparkles, 
  RefreshCw, 
  Clock, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCredits, useRefreshCredits } from '@/hooks/useCredits';
import { formatCredits } from '@/config/pricing';

interface CreditBalanceCardProps {
  onBuyCredits?: () => void;
  className?: string;
}

export default function CreditBalanceCard({ onBuyCredits, className }: CreditBalanceCardProps) {
  const { data, isLoading, error } = useCredits();
  const refreshBalance = useRefreshCredits();

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
          <p className="text-sm">Failed to load credit balance</p>
        </div>
      </div>
    );
  }

  const { 
    totalCredits = 0, 
    purchasedCredits = 0, 
    effectiveFreeCredits = 0, 
    freeCreditsExpired = false,
    balance 
  } = data || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative bg-gradient-to-br from-card via-card to-muted/30 rounded-xl border border-border overflow-hidden",
        className
      )}
    >
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Ticket className="h-4 w-4 text-primary" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Credit Balance
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
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Available Credits</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-serif font-medium text-foreground tracking-tight">
                {formatCredits(totalCredits)}
              </span>
              <span className="text-lg text-muted-foreground">credits</span>
            </div>
            {(purchasedCredits > 0 || effectiveFreeCredits > 0) && (
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                {purchasedCredits > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    {formatCredits(purchasedCredits)} purchased
                  </span>
                )}
                {effectiveFreeCredits > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    {formatCredits(effectiveFreeCredits)} free
                  </span>
                )}
                {freeCreditsExpired && (balance?.free_credits || 0) > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <Clock className="h-3 w-3" />
                    {formatCredits(balance?.free_credits || 0)} expired
                  </span>
                )}
              </div>
            )}
          </div>

          {onBuyCredits && (
            <Button 
              onClick={onBuyCredits}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Get More Credits
            </Button>
          )}
        </div>

        {/* Free credits expiration warning */}
        {balance?.free_credits_expires_at && effectiveFreeCredits > 0 && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Free credits expire {formatDistanceToNow(new Date(balance.free_credits_expires_at), { addSuffix: true })}
            </p>
          </div>
        )}

        {/* Empty state */}
        {totalCredits === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              You don't have any credits yet. Get a pack to start planning!
            </p>
            {onBuyCredits && (
              <Button onClick={onBuyCredits} variant="outline">
                Browse Credit Packs
              </Button>
            )}
          </div>
        )}

        {/* Purchased credits never expire note */}
        {purchasedCredits > 0 && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Purchased credits never expire
          </p>
        )}
      </div>
    </motion.div>
  );
}
