import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, Loader2, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
// Minimum top-up amount in dollars
const TOPUP_MINIMUM = 5;

interface AddCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance?: number;
}

const PRESET_AMOUNTS = [5, 10, 20, 50];

export function AddCreditsModal({ isOpen, onClose, currentBalance = 0 }: AddCreditsModalProps) {
  const [amount, setAmount] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleAddCredits = async () => {
    const finalAmount = showCustom ? parseFloat(customAmount) : amount;
    
    if (isNaN(finalAmount) || finalAmount < TOPUP_MINIMUM) {
      toast.error(`Minimum top-up is $${TOPUP_MINIMUM}`);
      return;
    }

    setIsLoading(true);
    try {
      const amountCents = Math.round(finalAmount * 100);
      
      const { data, error } = await supabase.functions.invoke('add-credits', {
        body: { amount_cents: amountCents },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl font-serif">
            Add Credits to Your Wallet
          </DialogTitle>
          <DialogDescription className="text-center">
            Credits can be used for route optimization, day builds, and more.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Current Balance */}
          {currentBalance > 0 && (
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-lg font-semibold text-foreground">{formatCurrency(currentBalance)}</p>
            </div>
          )}

          {/* Preset Amounts */}
          {!showCustom ? (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select amount</Label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={amount === preset ? 'default' : 'outline'}
                    onClick={() => setAmount(preset)}
                    className="text-base"
                  >
                    ${preset}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCustom(true)}
                className="w-full text-muted-foreground"
              >
                Enter custom amount
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="custom-amount" className="text-sm font-medium">Custom amount</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const current = parseFloat(customAmount) || TOPUP_MINIMUM;
                    setCustomAmount(Math.max(TOPUP_MINIMUM, current - 5).toString());
                  }}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="custom-amount"
                    type="number"
                    min={TOPUP_MINIMUM}
                    step="1"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="pl-7 text-center text-lg"
                    placeholder={TOPUP_MINIMUM.toString()}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const current = parseFloat(customAmount) || 0;
                    setCustomAmount((current + 5).toString());
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCustom(false);
                  setCustomAmount('');
                }}
                className="w-full text-muted-foreground"
              >
                Use preset amounts
              </Button>
            </div>
          )}

          {/* Summary */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">You'll add</span>
              <span className="text-xl font-semibold text-foreground">
                ${showCustom ? (parseFloat(customAmount) || 0).toFixed(2) : amount.toFixed(2)}
              </span>
            </div>
            
            <Button
              onClick={handleAddCredits}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Wallet className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Processing...' : 'Add Credits'}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Minimum top-up is ${TOPUP_MINIMUM}. Credits never expire.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
