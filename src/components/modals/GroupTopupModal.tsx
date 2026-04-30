/**
 * GroupTopupModal — Owner can fund the shared group pool two ways:
 *   1. Transfer credits from their personal balance.
 *   2. Buy a fresh credit pack and route it directly into the pool.
 */

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Coins, Loader2, Plus, ShoppingCart, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatCredits, FLEXIBLE_CREDITS, type FlexibleCreditPack } from '@/config/pricing';
import { EmbeddedCheckoutModal } from '@/components/checkout/EmbeddedCheckoutModal';
import { cn } from '@/lib/utils';

interface GroupTopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  creditsAvailable: number;
}

const PRESETS = [50, 100, 200];

export function GroupTopupModal({ isOpen, onClose, tripId, creditsAvailable }: GroupTopupModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Tab 1 — transfer
  const [selected, setSelected] = useState<number>(100);
  const [loading, setLoading] = useState(false);

  // Tab 2 — buy pack via embedded Stripe checkout
  const [checkoutPack, setCheckoutPack] = useState<FlexibleCreditPack | null>(null);

  const canAfford = creditsAvailable >= selected;

  const handleTransfer = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('topup-group-budget', {
        body: { tripId, credits: selected },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Added ${formatCredits(selected)} credits to the group pool`);

      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
        queryClient.invalidateQueries({ queryKey: ['entitlements', user.id] });
        queryClient.invalidateQueries({ queryKey: ['group-budget', tripId] });
        queryClient.invalidateQueries({ queryKey: ['group-budget-tx'] });
      }

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to top up';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const closeCheckout = () => {
    setCheckoutPack(null);
    // After checkout closes, refresh group budget so newly-credited credits appear
    queryClient.invalidateQueries({ queryKey: ['group-budget', tripId] });
    queryClient.invalidateQueries({ queryKey: ['group-budget-tx'] });
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !checkoutPack} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <div className="px-6 pt-6 pb-3 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-serif font-medium text-foreground">Top Up Group Pool</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Fund the shared pool from your balance, or buy a fresh pack
            </p>
          </div>

          <Tabs defaultValue="transfer" className="w-full">
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="transfer" className="gap-1.5">
                  <Coins className="h-3.5 w-3.5" />
                  From my balance
                </TabsTrigger>
                <TabsTrigger value="buy" className="gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Buy new pack
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ========== Tab 1: Transfer from balance ========== */}
            <TabsContent value="transfer" className="mt-0">
              <div className="px-6 py-3 mt-2 border-y border-border bg-muted/30">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Your balance</span>
                  <span className="font-semibold text-foreground">{formatCredits(creditsAvailable)}</span>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map(amount => (
                    <button
                      key={amount}
                      onClick={() => setSelected(amount)}
                      className={cn(
                        'py-2.5 rounded-lg text-sm font-medium border transition-colors',
                        selected === amount
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-foreground hover:border-primary/50'
                      )}
                    >
                      {formatCredits(amount)}
                    </button>
                  ))}
                </div>

                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleTransfer}
                  disabled={loading || !canAfford}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Coins className="h-4 w-4" />
                      Add {formatCredits(selected)} credits
                    </>
                  )}
                </Button>

                {!canAfford && (
                  <p className="text-center text-xs text-destructive">
                    Not enough credits in your balance. Switch to "Buy new pack"
                  </p>
                )}
              </div>
            </TabsContent>

            {/* ========== Tab 2: Buy fresh pack into the pool ========== */}
            <TabsContent value="buy" className="mt-0">
              <div className="px-6 py-3 mt-2 border-y border-border bg-muted/30">
                <p className="text-xs text-muted-foreground text-center">
                  Credits go straight into this trip's group pool. Your personal balance stays untouched.
                </p>
              </div>

              <div className="px-6 py-4 space-y-2">
                {FLEXIBLE_CREDITS.map(pack => (
                  <button
                    key={pack.id}
                    onClick={() => setCheckoutPack(pack)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg',
                      'border border-border bg-card hover:border-primary/50 hover:bg-primary/5',
                      'transition-colors text-left'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{pack.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCredits(pack.credits)} credits · ${pack.perCredit}/credit
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      ${pack.price}
                    </div>
                  </button>
                ))}
                <p className="pt-1 text-center text-[11px] text-muted-foreground">
                  Secure checkout via Stripe
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Embedded checkout — credits routed directly into group pool via destination=group_pool */}
      {checkoutPack && (
        <EmbeddedCheckoutModal
          isOpen={!!checkoutPack}
          onClose={closeCheckout}
          priceId={checkoutPack.priceId}
          mode="payment"
          productName={`${checkoutPack.name} → Group Pool`}
          productId={checkoutPack.productId}
          credits={checkoutPack.credits}
          tripId={tripId}
          destination="group_pool"
          returnPath={`/trip/${tripId}?group_topup=success`}
        />
      )}
    </>
  );
}
