import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Wallet, Sparkles, ArrowRight, Zap, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ROUTES } from '@/config/routes';
import { CREDIT_COSTS, TOPUP_OPTIONS } from '@/config/pricing';
import { useToast } from '@/hooks/use-toast';

interface CreditTopUpPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onCreditsPurchased?: () => void;
  actionName?: string;
  requiredCredits?: number;
  currentBalance?: number;
}

export function CreditTopUpPrompt({
  isOpen,
  onClose,
  onCreditsPurchased,
  actionName = 'regenerate this day',
  requiredCredits = CREDIT_COSTS.BUILD_DAY,
  currentBalance = 0,
}: CreditTopUpPromptProps) {
  const [loading, setLoading] = useState<number | null>(null);
  const { toast } = useToast();

  const handleTopUp = async (amountCents: number) => {
    setLoading(amountCents);
    
    try {
      const { data, error } = await supabase.functions.invoke('add-credits', {
        body: { amount_cents: amountCents }
      });

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
        // Close modal and let them know
        toast({
          title: "Complete your purchase",
          description: "A new tab opened for payment. Return here when done.",
        });
        onClose();
      }
    } catch (error) {
      console.error('Top up error:', error);
      toast({
        title: "Failed to start checkout",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const formatCredits = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Credits Needed
          </DialogTitle>
          <DialogDescription className="text-center">
            You need {formatCredits(requiredCredits)} in credits to {actionName}.
            {currentBalance > 0 && (
              <span className="block mt-1 text-muted-foreground">
                Current balance: {formatCredits(currentBalance)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Quick top-up options */}
          <div className="grid grid-cols-2 gap-3">
            {TOPUP_OPTIONS.map((option) => (
              <Button
                key={option.amount}
                variant="outline"
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => handleTopUp(option.amount)}
                disabled={loading !== null}
              >
                <span className="font-semibold text-lg">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.amount >= requiredCredits ? '✓ Covers this action' : 'Quick top-up'}
                </span>
              </Button>
            ))}
          </div>

          {/* Subscription upsell */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl p-4 border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Unlimited with Monthly</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Get unlimited day regenerations, route optimization, and group tools for $15.99/mo
                </p>
                <Button asChild size="sm" className="mt-3 w-full" variant="default">
                  <Link to={ROUTES.PRICING}>
                    View Plans
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Balance info */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span>Your wallet balance</span>
            </div>
            <span className="font-semibold">{formatCredits(currentBalance)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
