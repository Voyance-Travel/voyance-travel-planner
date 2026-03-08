/**
 * CreditQuickBuy — Popover for quick credit purchases.
 * Anchored to the credit balance pill in the itinerary toolbar.
 * When tripId is provided, shows trip-specific credit spending breakdown.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Coins, Zap, Crown, ArrowRight, Receipt } from 'lucide-react';
import { FLEXIBLE_CREDITS, VOYANCE_CLUB_PACKS, formatCredits } from '@/config/pricing';
import { EmbeddedCheckoutModal } from './EmbeddedCheckoutModal';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isIAPAvailable, purchaseByPackId } from '@/services/iapService';
import { useToast } from '@/hooks/use-toast';

interface CreditQuickBuyProps {
  currentBalance: number;
  tripId?: string;
  children: React.ReactNode;
}

const ACTION_LABELS: Record<string, string> = {
  trip_generation: 'Trip generation',
  unlock_day: 'Day unlock',
  group_unlock: 'Bulk unlock',
  swap_activity: 'Activity swap',
  regenerate_day: 'Day regeneration',
  ai_message: 'AI message',
  hotel_search: 'Hotel search',
  restaurant_rec: 'Restaurant rec',
  smart_finish: 'Smart finish',
  hotel_optimization: 'Hotel optimization',
  mystery_getaway: 'Mystery getaway',
  transport_mode_change: 'Transport change',
};

export function CreditQuickBuy({ currentBalance, tripId, children }: CreditQuickBuyProps) {
  const [open, setOpen] = useState(false);
  const [checkoutConfig, setCheckoutConfig] = useState<{
    priceId: string;
    productId: string;
    credits: number;
    name: string;
  } | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch trip-specific spending when tripId is provided and popover is open
  const { data: tripSpending } = useQuery({
    queryKey: ['trip-spending', tripId, user?.id],
    queryFn: async () => {
      if (!tripId || !user?.id) return null;
      const { data, error } = await supabase
        .from('credit_ledger_safe')
        .select('action_type, credits_delta')
        .eq('user_id', user.id)
        .eq('trip_id', tripId)
        .eq('transaction_type', 'spend')
        .lt('credits_delta', 0);

      if (error) {
        console.error('[CreditQuickBuy] Trip spending query error:', error);
        return null;
      }

      // Group by action_type
      const grouped: Record<string, { count: number; total: number }> = {};
      let grandTotal = 0;
      for (const row of data || []) {
        const key = row.action_type || 'other';
        const amount = Math.abs(row.credits_delta);
        if (!grouped[key]) grouped[key] = { count: 0, total: 0 };
        grouped[key].count += 1;
        grouped[key].total += amount;
        grandTotal += amount;
      }

      return { grouped, grandTotal };
    },
    enabled: !!tripId && !!user?.id && open,
    staleTime: 30_000,
  });

  const { toast } = useToast();

  const handleBuy = async (pack: typeof FLEXIBLE_CREDITS[number]) => {
    // iOS native IAP path
    if (isIAPAvailable()) {
      setOpen(false);
      const result = await purchaseByPackId(pack.id);
      if (result.success) {
        toast({ title: 'Purchase complete!', description: `${formatCredits(result.credits || pack.credits)} credits added.` });
      } else if (result.error !== 'cancelled') {
        toast({ title: 'Purchase failed', description: result.error || 'Please try again.', variant: 'destructive' });
      }
      return;
    }

    // Web: Stripe
    setOpen(false);
    setCheckoutConfig({
      priceId: pack.priceId,
      productId: pack.productId,
      credits: pack.credits,
      name: pack.name,
    });
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {children}
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="center" sideOffset={8}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Your Credits</span>
              <div className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-semibold text-primary">{formatCredits(currentBalance)}</span>
              </div>
            </div>
          </div>

          {/* Trip Spending Breakdown */}
          {tripId && tripSpending && tripSpending.grandTotal > 0 && (
            <div className="px-4 py-3 border-b border-border bg-muted/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Spent on this trip
                </span>
                <span className="ml-auto text-xs font-semibold text-foreground">
                  {formatCredits(tripSpending.grandTotal)}
                </span>
              </div>
              <div className="space-y-1">
                {Object.entries(tripSpending.grouped)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([action, { count, total }]) => (
                    <div key={action} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {ACTION_LABELS[action] || action.replace(/_/g, ' ')}
                        {count > 1 && <span className="text-muted-foreground/60"> ×{count}</span>}
                      </span>
                      <span className="text-foreground font-medium">-{formatCredits(total)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Quick Top-Up Options */}
          <div className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Quick Top-Up</p>
            {FLEXIBLE_CREDITS.map((pack, i) => (
              <button
                key={pack.id}
                onClick={() => handleBuy(pack)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {formatCredits(pack.credits)} credits
                  </span>
                  {i === 1 && (
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">Popular</span>
                  )}
                  {i === 2 && (
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-accent/10 text-accent-foreground">Best Value</span>
                  )}
                </div>
                <span className="text-sm font-semibold text-foreground">${pack.price}</span>
              </button>
            ))}
          </div>

          {/* Voyance Club Upsell + See All */}
          <div className="px-3 pb-3 space-y-2">
            <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Save more with Voyance Club</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                From ${VOYANCE_CLUB_PACKS[0].price}/pack · Credits never expire
              </p>
            </div>
            <button
              onClick={() => { setOpen(false); navigate(ROUTES.PRICING); }}
              className="flex items-center justify-center gap-1.5 w-full text-xs text-primary hover:underline py-1"
            >
              See all plans <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Embedded Checkout Modal */}
      {checkoutConfig && (
        <EmbeddedCheckoutModal
          isOpen={!!checkoutConfig}
          onClose={() => setCheckoutConfig(null)}
          priceId={checkoutConfig.priceId}
          mode="payment"
          productName={`${checkoutConfig.name} - ${formatCredits(checkoutConfig.credits)} Credits`}
          returnPath={window.location.pathname + window.location.search}
          productId={checkoutConfig.productId}
          credits={checkoutConfig.credits}
        />
      )}
    </>
  );
}
