/**
 * CreditPacksGrid - Two-tier credit purchase grid
 * Quick Top-Up rows + Voyance Club cards
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Sparkles, Check, Crown, Zap, Award, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FLEXIBLE_CREDITS, VOYANCE_CLUB_PACKS, formatCredits } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckoutModal } from '@/components/checkout';
import { cn } from '@/lib/utils';
import { isNativeIOS, openWebsitePurchase } from '@/services/iapService';

interface CheckoutConfig {
  priceId: string;
  mode: 'subscription' | 'payment';
  productName: string;
  returnPath: string;
  productId?: string;
  credits?: number;
}

interface CreditPacksGridProps {
  showClub?: boolean;
  returnPath?: string;
  className?: string;
}

const CreditPacksGrid = React.forwardRef<HTMLDivElement, CreditPacksGridProps>(function CreditPacksGrid({ 
  showClub = true, 
  returnPath = '/profile?payment=success',
  className = '' 
}, ref) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutConfig | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const openCheckout = async (
    pack: { priceId: string; productId: string; credits: number; name: string; id?: string },
    planKey: string
  ) => {
    setLoadingPlan(planKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sign in first", description: "Create an account to get started." });
        navigate('/signin?redirect=/profile');
        return;
      }

      // iOS native: link out to website (Apple US storefront rules)
      if (isNativeIOS()) {
        await openWebsitePurchase(pack.id);
        return;
      }

      // Web: Stripe Embedded Checkout
      setCheckoutConfig({ 
        priceId: pack.priceId, 
        mode: 'payment', 
        productName: `${pack.name} - ${formatCredits(pack.credits)} Credits`, 
        returnPath,
        productId: pack.productId,
        credits: pack.credits,
      });
    } catch (error) {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <>
      <div ref={ref} className={className}>
        {/* Quick Top-Up */}
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Zap className="h-3 w-3" /> Quick Top-Up
          </p>
          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {FLEXIBLE_CREDITS.map((pack, index) => (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm text-foreground font-medium">
                  {formatCredits(pack.credits)} credits
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">${pack.price}</span>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => openCheckout(pack, pack.id)}
                    disabled={loadingPlan === pack.id}
                    className="min-w-[60px]"
                  >
                    {loadingPlan === pack.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Buy'}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Voyance Club */}
        {showClub && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Crown className="h-3 w-3" /> Voyance Club
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {VOYANCE_CLUB_PACKS.map((pack, index) => {
                const isFeatured = pack.featured;
                return (
                  <motion.div
                    key={pack.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'rounded-xl p-4 relative',
                      isFeatured 
                        ? 'bg-primary/5 border-2 border-primary' 
                        : 'bg-card border border-border'
                    )}
                  >
                    {isFeatured && (
                      <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px]">
                        <Star className="w-2.5 h-2.5 mr-0.5" />
                        Popular
                      </Badge>
                    )}
                    
                    <div className="mb-2">
                      <h3 className="text-sm font-semibold text-foreground">{pack.name}</h3>
                      <div className="text-xl font-bold text-foreground">${pack.price}</div>
                    </div>

                    <p className="text-xs text-muted-foreground mb-2">
                      {formatCredits(pack.baseCredits)} <span className="text-primary">+ {formatCredits(pack.bonusCredits)} bonus</span> = <span className="font-semibold text-foreground">{formatCredits(pack.totalCredits)}</span>
                    </p>

                    <ul className="space-y-1 mb-3">
                      {pack.perks.slice(0, 2).map((perk, pi) => (
                        <li key={pi} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Check className="h-3 w-3 text-primary shrink-0" />
                          {perk}
                        </li>
                      ))}
                    </ul>

                    <Button 
                      className="w-full"
                      size="sm"
                      variant={isFeatured ? 'default' : 'outline'}
                      onClick={() => openCheckout({ ...pack, credits: pack.totalCredits }, pack.id)}
                      disabled={loadingPlan === pack.id}
                    >
                      {loadingPlan === pack.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Get ${pack.name}`}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {checkoutConfig && (
        <EmbeddedCheckoutModal
          isOpen={!!checkoutConfig}
          onClose={() => setCheckoutConfig(null)}
          priceId={checkoutConfig.priceId}
          mode={checkoutConfig.mode}
          productName={checkoutConfig.productName}
          returnPath={checkoutConfig.returnPath}
          productId={checkoutConfig.productId}
          credits={checkoutConfig.credits}
        />
      )}
    </>
  );
});

export default CreditPacksGrid;
