import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Ticket, Loader2 } from 'lucide-react';
import { CREDIT_PACKS, formatCredits } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckoutModal } from './EmbeddedCheckoutModal';
import { ROUTES } from '@/config/routes';

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  context?: 'regenerate' | 'route' | 'budget' | 'general' | 'credits' | 'swap' | 'unlock_day' | 'restaurant' | 'ai_message';
  creditsNeeded?: number;
}

export function UpgradePrompt({
  isOpen,
  onClose,
  featureName = 'this feature',
  context = 'general',
  creditsNeeded = 0,
}: UpgradePromptProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [checkoutConfig, setCheckoutConfig] = useState<{
    priceId: string;
    productId: string;
    credits: number;
    name: string;
  } | null>(null);

  const getContextMessage = () => {
    if (creditsNeeded > 0) {
      return `You need ${formatCredits(creditsNeeded)} more credits to continue.`;
    }
    switch (context) {
      case 'regenerate':
        return 'You need credits to regenerate this day.';
      case 'swap':
        return 'You need credits to swap this activity.';
      case 'unlock_day':
        return 'You need credits to unlock this day.';
      case 'restaurant':
        return 'You need credits for AI restaurant recommendations.';
      case 'ai_message':
        return 'You need credits to use the AI companion.';
      case 'route':
        return 'Route optimization is free! But you need credits to unlock days first.';
      case 'budget':
        return 'Group budgeting is included with any unlocked trip.';
      case 'credits':
        return 'You\'re running low on credits. Top up to keep planning.';
      default:
        return `To use ${featureName}, you need more credits.`;
    }
  };

  // Get recommended pack based on credits needed
  const getRecommendedPack = () => {
    if (creditsNeeded <= 200) return CREDIT_PACKS[0]; // Single
    if (creditsNeeded <= 500) return CREDIT_PACKS[1]; // Starter
    if (creditsNeeded <= 1200) return CREDIT_PACKS[2]; // Explorer
    return CREDIT_PACKS[3]; // Adventurer
  };

  const handleBuyPack = async (pack: typeof CREDIT_PACKS[number]) => {
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

  const recommended = getRecommendedPack();

  return (
    <>
      <Dialog open={isOpen && !checkoutConfig} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Ticket className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl font-serif">
              Get More Credits
            </DialogTitle>
            <DialogDescription className="text-center">
              {getContextMessage()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-4">
            {/* Recommended Pack */}
            <div className="rounded-lg border-2 border-primary p-4 bg-primary/5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-sm">{recommended.name}</h4>
                  <span className="text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground rounded">Recommended</span>
                </div>
                <span className="text-sm font-semibold">${recommended.price}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {formatCredits(recommended.credits)} credits — {recommended.description}
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

            {/* Smaller Option */}
            {recommended.id !== 'single' && (
              <div className="rounded-lg border border-border p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-sm">Single</h4>
                  </div>
                  <span className="text-sm font-semibold">$12</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  200 credits — 1 day + extras
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => handleBuyPack(CREDIT_PACKS[0])}
                  disabled={loadingPack === 'single'}
                >
                  {loadingPack === 'single' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Get Single
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* View all options */}
            <p className="text-center text-xs text-muted-foreground">
              <button 
                onClick={() => { onClose(); navigate(ROUTES.PRICING); }}
                className="text-primary hover:underline"
              >
                View all credit packs →
              </button>
            </p>
          </div>
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
