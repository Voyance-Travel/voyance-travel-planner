/**
 * CreditQuickBuy — Popover for quick credit purchases.
 * Anchored to the credit balance pill in the itinerary toolbar.
 */

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Coins, Zap, Crown, ArrowRight } from 'lucide-react';
import { FLEXIBLE_CREDITS, VOYANCE_CLUB_PACKS, formatCredits } from '@/config/pricing';
import { EmbeddedCheckoutModal } from './EmbeddedCheckoutModal';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

interface CreditQuickBuyProps {
  currentBalance: number;
  children: React.ReactNode;
}

export function CreditQuickBuy({ currentBalance, children }: CreditQuickBuyProps) {
  const [open, setOpen] = useState(false);
  const [checkoutConfig, setCheckoutConfig] = useState<{
    priceId: string;
    productId: string;
    credits: number;
    name: string;
  } | null>(null);
  const navigate = useNavigate();

  const handleBuy = (pack: typeof FLEXIBLE_CREDITS[number]) => {
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
