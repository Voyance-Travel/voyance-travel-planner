/**
 * CreditPacksGrid - Reusable credit pack purchase grid
 * Used on both Pricing page and Profile page
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CREDIT_PACKS, BOOST_PACK, formatCredits } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckoutModal } from '@/components/checkout';

interface CheckoutConfig {
  priceId: string;
  mode: 'subscription' | 'payment';
  productName: string;
  returnPath: string;
  productId?: string;
  credits?: number;
}

interface CreditPacksGridProps {
  showBoost?: boolean;
  returnPath?: string;
  className?: string;
}

const CreditPacksGrid = React.forwardRef<HTMLDivElement, CreditPacksGridProps>(function CreditPacksGrid({ 
  showBoost = true, 
  returnPath = '/profile?payment=success',
  className = '' 
}, ref) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutConfig | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const openCheckout = async (
    pack: { priceId: string; productId: string; credits: number; name: string },
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
      <div className={className}>
        {/* Main Credit Packs */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CREDIT_PACKS.map((pack, index) => {
            const isFeatured = pack.featured;
            return (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-xl p-5 relative ${
                  isFeatured 
                    ? 'bg-primary/5 border-2 border-primary' 
                    : 'bg-card border border-border'
                }`}
              >
                {isFeatured && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Popular
                  </Badge>
                )}
                
                <div className="text-center mb-3">
                  <h3 className="text-sm font-medium text-muted-foreground">{pack.name}</h3>
                  <div className="text-2xl font-bold text-foreground mt-1">${pack.price}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatCredits(pack.credits)} credits
                  </div>
                </div>

                <Button 
                  className="w-full"
                  size="sm"
                  variant={isFeatured ? 'default' : 'outline'}
                  onClick={() => openCheckout(pack, pack.id)}
                  disabled={loadingPlan === pack.id}
                >
                  {loadingPlan === pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get Credits'}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Quick Boost */}
        {showBoost && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Quick boost: </span>
                <span className="text-foreground font-medium">{formatCredits(BOOST_PACK.credits)} credits for ${BOOST_PACK.price}</span>
              </div>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => openCheckout(BOOST_PACK, 'boost')}
                disabled={loadingPlan === 'boost'}
              >
                {loadingPlan === 'boost' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Boost'}
              </Button>
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
