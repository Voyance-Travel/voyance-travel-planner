/**
 * GroupTopupModal — Owner can add credits from personal balance to the group pool.
 * Preset amounts (50, 100, 200) with custom option.
 */

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatCredits } from '@/config/pricing';
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
  const [selected, setSelected] = useState<number>(100);
  const [loading, setLoading] = useState(false);

  const canAfford = creditsAvailable >= selected;

  const handleTopup = async () => {
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-serif font-medium text-foreground">Top Up Group Pool</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Transfer credits from your balance to the shared pool
          </p>
        </div>

        <div className="px-6 py-3 border-y border-border bg-muted/30">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your balance</span>
            <span className="font-semibold text-foreground">{formatCredits(creditsAvailable)}</span>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Preset buttons */}
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

          {/* Action */}
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={handleTopup}
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
              Not enough credits in your balance
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
