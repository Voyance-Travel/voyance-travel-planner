import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Loader2, Plus, Pencil, Crown, Zap } from 'lucide-react';
import { FLEXIBLE_CREDITS, VOYANCE_CLUB_PACKS, BOOST_PACK, formatCredits, CREDIT_COSTS, getRecommendedPack } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckoutModal } from './EmbeddedCheckoutModal';
import { ROUTES } from '@/config/routes';
import { useCredits } from '@/hooks/useCredits';
import { isNativeIOS, openWebsitePurchase } from '@/services/iapService';
import { useManualBuilderStore } from '@/stores/manual-builder-store';
import { toast as sonnerToast } from 'sonner';

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  context?: 'regenerate' | 'route' | 'budget' | 'general' | 'credits' | 'swap' | 'trip_generation' | 'hotel_search';
  creditsNeeded?: number;
  tripId?: string;
  showManualOption?: boolean;
}

// Action labels for display
const ACTION_LABELS: Record<string, { label: string; cost: number }> = {
  swap: { label: 'Swap activity', cost: CREDIT_COSTS.SWAP_ACTIVITY },
  regenerate: { label: 'Regenerate day', cost: CREDIT_COSTS.REGENERATE_DAY },
  trip_generation: { label: 'Generate trip', cost: 0 },
  hotel_search: { label: 'Hotel search', cost: CREDIT_COSTS.HOTEL_SEARCH },
};

export function UpgradePrompt({
  isOpen,
  onClose,
  featureName = 'this feature',
  context = 'general',
  creditsNeeded = 0,
  tripId,
  showManualOption = false,
}: UpgradePromptProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: creditBalance } = useCredits();
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [checkoutConfig, setCheckoutConfig] = useState<{
    priceId: string;
    productId: string;
    credits: number;
    name: string;
  } | null>(null);
  const { enableManualBuilder } = useManualBuilderStore();

  const currentBalance = creditBalance?.totalCredits ?? 0;
  const actionInfo = context && ACTION_LABELS[context];
  const actionCost = actionInfo?.cost ?? creditsNeeded;
  const actionLabel = actionInfo?.label ?? featureName;
   
  const handleManualBuild = () => {
    if (tripId) {
      enableManualBuilder(tripId);
      sonnerToast.success('Manual builder mode enabled! You can now edit freely.');
    }
    onClose();
  };
  
  // Use smallest flex credit for small actions
  const canUseQuickTopUp = actionCost <= BOOST_PACK.credits && context !== 'trip_generation';

  const getContextMessage = () => {
    if (context === 'route') return 'Route optimization is free! Unlock at least one day to optimize your route.';
    if (context === 'budget') return 'Group budgeting is included with any unlocked trip.';
    return null;
  };

  const recommended = getRecommendedPack(Math.max(creditsNeeded, actionCost));

  const handleBuyPack = async (pack: { priceId: string; productId: string; credits: number; name: string; id: string }) => {
    setLoadingPack(pack.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sign in first", description: "Create an account to get started." });
        navigate('/signin?redirect=/pricing');
        onClose();
        return;
      }

      // iOS native: link out to website
      if (isNativeIOS()) {
        await openWebsitePurchase(pack.id);
        onClose();
        return;
      }
      
      setCheckoutConfig({
        priceId: pack.priceId,
        productId: pack.productId,
        credits: pack.credits,
        name: pack.name,
      });
    } catch (error) {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoadingPack(null);
    }
  };

  const contextMessage = getContextMessage();

  return (
    <>
      <Dialog open={isOpen && !checkoutConfig} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-center text-lg font-serif">
              {actionLabel}: {actionCost} credits
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              Your balance: {formatCredits(currentBalance)} credits
            </DialogDescription>
          </DialogHeader>

          {contextMessage ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              {contextMessage}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Quick Top-Up for small actions */}
              {canUseQuickTopUp && (
                <Button 
                  size="lg" 
                  className="w-full text-base"
                  onClick={() => handleBuyPack(BOOST_PACK)}
                  disabled={loadingPack === BOOST_PACK.id}
                >
                  {loadingPack === BOOST_PACK.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      +{BOOST_PACK.credits} credits · ${BOOST_PACK.price}
                    </>
                  )}
                </Button>
              )}

              {/* Recommended pack for larger needs */}
              {!canUseQuickTopUp && recommended && (
                <div className="rounded-lg border-2 border-primary p-4 bg-primary/5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {'type' in recommended && recommended.type === 'club' ? (
                        <Crown className="h-4 w-4 text-primary" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-primary" />
                      )}
                      <h4 className="font-medium text-sm">{recommended.name}</h4>
                    </div>
                    <span className="text-sm font-semibold">${recommended.price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {formatCredits(recommended.credits)} credits
                  </p>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleBuyPack(recommended as any)}
                    disabled={loadingPack === recommended.id}
                  >
                    {loadingPack === recommended.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Get {recommended.name}
                        <ArrowRight className="ml-2 h-3 w-3" />
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Alternative options */}
              {canUseQuickTopUp && (
                <div className="text-center space-y-2">
                  <p className="text-xs text-muted-foreground">Or get more:</p>
                  <div className="flex items-center justify-center gap-3 text-xs">
                    <button 
                      onClick={() => handleBuyPack(FLEXIBLE_CREDITS[1] as any)}
                      className="text-primary hover:underline"
                      disabled={!!loadingPack}
                    >
                      {formatCredits(FLEXIBLE_CREDITS[1].credits)} for ${FLEXIBLE_CREDITS[1].price}
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button 
                      onClick={() => handleBuyPack(VOYANCE_CLUB_PACKS[0] as any)}
                      className="text-primary hover:underline"
                      disabled={!!loadingPack}
                    >
                      {formatCredits(VOYANCE_CLUB_PACKS[0].totalCredits)} for ${VOYANCE_CLUB_PACKS[0].price}
                    </button>
                  </div>
                </div>
              )}

              {/* View all packs link */}
              <p className="text-center text-xs text-muted-foreground pt-1">
                <button 
                  onClick={() => { onClose(); navigate(ROUTES.PRICING); }}
                  className="text-primary hover:underline"
                >
                  View all credit packs →
                </button>
              </p>
               
              {/* Manual builder option */}
              {(showManualOption || context === 'trip_generation') && tripId && (
                <div className="pt-3 mt-2 border-t border-border">
                  <button
                    onClick={handleManualBuild}
                    className="flex items-center justify-center gap-2 w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    I'll build it myself
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Embedded Checkout Modal */}
      {checkoutConfig && (
        <EmbeddedCheckoutModal
          isOpen={!!checkoutConfig}
          onClose={() => {
            setCheckoutConfig(null);
            onClose();
          }}
          priceId={checkoutConfig.priceId}
          mode="payment"
          productName={`${checkoutConfig.name} - ${formatCredits(checkoutConfig.credits)} Credits`}
          returnPath="/profile?tab=subscription&credits_added=true"
          productId={checkoutConfig.productId}
          credits={checkoutConfig.credits}
        />
      )}
    </>
  );
}
