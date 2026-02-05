import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
 import { ArrowRight, Sparkles, Ticket, Loader2, Plus, Pencil } from 'lucide-react';
import { CREDIT_PACKS, BOOST_PACK, formatCredits, CREDIT_COSTS } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckoutModal } from './EmbeddedCheckoutModal';
import { ROUTES } from '@/config/routes';
import { useCredits } from '@/hooks/useCredits';
 import { useManualBuilderStore } from '@/stores/manual-builder-store';
 import { toast as sonnerToast } from 'sonner';

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  context?: 'regenerate' | 'route' | 'budget' | 'general' | 'credits' | 'swap' | 'unlock_day' | 'restaurant' | 'ai_message';
  creditsNeeded?: number;
   tripId?: string;
   showManualOption?: boolean;
}

// Action labels for display
const ACTION_LABELS: Record<string, { label: string; cost: number }> = {
  swap: { label: 'Swap activity', cost: CREDIT_COSTS.SWAP_ACTIVITY },
  regenerate: { label: 'Regenerate day', cost: CREDIT_COSTS.REGENERATE_DAY },
  unlock_day: { label: 'Unlock day', cost: CREDIT_COSTS.UNLOCK_DAY },
  restaurant: { label: 'Restaurant rec', cost: CREDIT_COSTS.RESTAURANT_REC },
  ai_message: { label: 'AI message', cost: CREDIT_COSTS.AI_MESSAGE },
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
  
  // Show boost if action cost is affordable with 80 credits (not for unlock_day)
  const canUseBoost = actionCost <= 80 && context !== 'unlock_day';

  const getContextMessage = () => {
    if (context === 'route') {
      return 'Route optimization is free! But you need credits to unlock days first.';
    }
    if (context === 'budget') {
      return 'Group budgeting is included with any unlocked trip.';
    }
    return null; // We'll show the structured display instead
  };

  // For actions that can't use top-up, recommend appropriate pack
  const getRecommendedPack = () => {
    const needed = Math.max(creditsNeeded, actionCost);
    if (needed <= 200) return CREDIT_PACKS[0]; // Single
    if (needed <= 500) return CREDIT_PACKS[1]; // Starter
    if (needed <= 1200) return CREDIT_PACKS[2]; // Explorer
    return CREDIT_PACKS[3]; // Adventurer
  };

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
  const recommended = getRecommendedPack();

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
              {/* Boost Option (primary for small actions) */}
              {canUseBoost && (
                <Button 
                  size="lg" 
                  className="w-full text-base"
                  onClick={() => handleBuyPack(BOOST_PACK)}
                  disabled={loadingPack === 'boost'}
                >
                  {loadingPack === 'boost' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      +80 credits · $8
                    </>
                  )}
                </Button>
              )}

              {/* For unlock_day or when boost doesn't apply, show recommended pack */}
              {!canUseBoost && (
                <div className="rounded-lg border-2 border-primary p-4 bg-primary/5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h4 className="font-medium text-sm">{recommended.name}</h4>
                    </div>
                    <span className="text-sm font-semibold">${recommended.price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {formatCredits(recommended.credits)} credits · {recommended.description}
                  </p>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleBuyPack(recommended)}
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

              {/* "Or get more" section */}
              {canUseBoost && (
                <div className="text-center space-y-2">
                  <p className="text-xs text-muted-foreground">Or get more:</p>
                  <div className="flex items-center justify-center gap-3 text-xs">
                    <button 
                      onClick={() => handleBuyPack(CREDIT_PACKS[0])}
                      className="text-primary hover:underline"
                      disabled={!!loadingPack}
                    >
                      200 for $12
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button 
                      onClick={() => handleBuyPack(CREDIT_PACKS[1])}
                      className="text-primary hover:underline"
                      disabled={!!loadingPack}
                    >
                      500 for $29
                    </button>
                  </div>
                </div>
              )}

              {/* Smaller option when boost doesn't apply */}
              {!canUseBoost && recommended.id !== 'single' && (
                <div className="rounded-lg border border-border p-3 hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Single · 200 credits</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleBuyPack(CREDIT_PACKS[0])}
                      disabled={loadingPack === 'single'}
                    >
                      {loadingPack === 'single' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        '$12'
                      )}
                    </Button>
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
               
               {/* Manual builder option for unlock_day or when explicitly requested */}
               {(showManualOption || context === 'unlock_day') && tripId && (
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
