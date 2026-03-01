/**
 * GroupUnlockModal — Purchase a group unlock using credits (primary) or Stripe (fallback).
 * Recommends tier based on collaborator count.
 */

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Coins, CreditCard, Loader2, Check } from 'lucide-react';
import { GROUP_UNLOCK_TIERS, formatCredits, type GroupUnlockPack } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EmbeddedCheckoutModal } from '@/components/checkout/EmbeddedCheckoutModal';

interface GroupUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  collaboratorCount: number;
  creditsAvailable: number;
}

function getRecommendedTier(count: number): string {
  if (count <= 3) return 'small';
  if (count <= 8) return 'medium';
  return 'large';
}

export function GroupUnlockModal({
  isOpen,
  onClose,
  tripId,
  collaboratorCount,
  creditsAvailable,
}: GroupUnlockModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [checkoutConfig, setCheckoutConfig] = useState<{
    priceId: string;
    productId: string;
    name: string;
    tier: 'small' | 'medium' | 'large';
    tripId: string;
  } | null>(null);

  const recommended = getRecommendedTier(collaboratorCount);

  const handleCreditPurchase = async (pack: GroupUnlockPack) => {
    setLoading(pack.id);
    try {
      const { data, error } = await supabase.functions.invoke('purchase-group-unlock', {
        body: { tripId, tier: pack.tier },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error === 'Insufficient credits') {
          // Fall through to Stripe
          setCheckoutConfig({
            priceId: pack.priceId,
            productId: pack.productId,
            name: pack.name,
            tier: pack.tier,
            tripId,
          });
          return;
        }
        throw new Error(data.error);
      }

      toast.success(`${pack.name} activated! ${formatCredits(pack.creditCost)} credits from pool.`);

      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
        queryClient.invalidateQueries({ queryKey: ['entitlements', user.id] });
        queryClient.invalidateQueries({ queryKey: ['group-budget', tripId] });
      }

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to purchase';
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen && !checkoutConfig} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-serif font-medium text-foreground">Enable Group Editing</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {collaboratorCount} collaborator{collaboratorCount !== 1 ? 's' : ''} on this trip
            </p>
          </div>

          <div className="px-6 py-4 space-y-3">
            {GROUP_UNLOCK_TIERS.map(pack => {
              const isRec = pack.tier === recommended;
              const canAfford = creditsAvailable >= pack.creditCost;

              return (
                <div
                  key={pack.id}
                  className={cn(
                    'rounded-lg border p-4 space-y-2 transition-colors',
                    isRec ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-foreground">{pack.name}</span>
                      {isRec && (
                        <span className="ml-2 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          Recommended
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Up to {pack.maxTravelers} travelers · {formatCredits(pack.creditCost)} credit pool
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => handleCreditPurchase(pack)}
                      disabled={loading === pack.id || !canAfford}
                    >
                      {loading === pack.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Coins className="h-3 w-3" />
                          {formatCredits(pack.creditCost)} credits
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setCheckoutConfig({
                        priceId: pack.priceId,
                        productId: pack.productId,
                        name: pack.name,
                        tier: pack.tier,
                        tripId,
                      })}
                    >
                      <CreditCard className="h-3 w-3" />
                      ${pack.price}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-6 pb-4">
            <p className="text-center text-[10px] text-muted-foreground">
              Shared free caps: 10 swaps · 5 regens · 20 AI · 5 restaurants
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {checkoutConfig && (
        <EmbeddedCheckoutModal
          isOpen={!!checkoutConfig}
          onClose={() => {
            setCheckoutConfig(null);
            onClose();
          }}
          priceId={checkoutConfig.priceId}
          mode="payment"
          productName={checkoutConfig.name}
          returnPath={window.location.pathname + window.location.search}
          productId={checkoutConfig.productId}
          tripId={checkoutConfig.tripId}
          groupTier={checkoutConfig.tier}
        />
      )}
    </>
  );
}
