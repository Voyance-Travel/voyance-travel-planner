/**
 * NightsRedistributionModal
 * Shown when a user changes trip dates on a multi-city trip.
 * Lets them adjust how nights are split across cities.
 */
import { useState, useMemo, useEffect } from 'react';
import { Minus, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { NightsRedistribution } from '@/utils/syncTripCitiesNights';

interface NightsRedistributionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalNights: number;
  initialRedistribution: NightsRedistribution[];
  onConfirm: (redistribution: NightsRedistribution[]) => Promise<void>;
  hasItinerary: boolean;
}

export function NightsRedistributionModal({
  open,
  onOpenChange,
  totalNights,
  initialRedistribution,
  onConfirm,
  hasItinerary,
}: NightsRedistributionModalProps) {
  const [redistribution, setRedistribution] = useState<NightsRedistribution[]>(initialRedistribution);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when modal opens with new data
  useState(() => {
    setRedistribution(initialRedistribution);
  });

  const currentTotal = useMemo(
    () => redistribution.reduce((s, r) => s + r.newNights, 0),
    [redistribution]
  );

  const isValid = currentTotal === totalNights;

  const adjustNights = (cityId: string, delta: number) => {
    setRedistribution(prev =>
      prev.map(r => {
        if (r.cityId !== cityId) return r;
        const next = r.newNights + delta;
        if (next < 1) return r; // minimum 1 night
        return { ...r, newNights: next };
      })
    );
  };

  const handleConfirm = async () => {
    if (!isValid) return;
    setIsSaving(true);
    try {
      await onConfirm(redistribution);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const citiesWithRemovedDays = redistribution.filter(r => r.newNights < r.oldNights);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redistribute Nights</DialogTitle>
          <DialogDescription>
            Your trip is now {totalNights} night{totalNights !== 1 ? 's' : ''}.
            Adjust how nights are split across your cities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {redistribution.map(r => (
            <div key={r.cityId} className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{r.cityName}</p>
                {r.newNights !== r.oldNights && (
                  <p className="text-xs text-muted-foreground">
                    was {r.oldNights} night{r.oldNights !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => adjustNights(r.cityId, -1)}
                  disabled={r.newNights <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center font-mono text-sm tabular-nums">
                  {r.newNights}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => adjustNights(r.cityId, 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}

          {/* Running total */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-sm font-medium">Total</span>
            <span className={`text-sm font-mono tabular-nums ${isValid ? 'text-foreground' : 'text-destructive font-bold'}`}>
              {currentTotal} / {totalNights}
            </span>
          </div>

          {!isValid && (
            <p className="text-xs text-destructive">
              Total must equal {totalNights} night{totalNights !== 1 ? 's' : ''}.
              {currentTotal > totalNights
                ? ` Remove ${currentTotal - totalNights} night${currentTotal - totalNights !== 1 ? 's' : ''}.`
                : ` Add ${totalNights - currentTotal} more night${totalNights - currentTotal !== 1 ? 's' : ''}.`}
            </p>
          )}

          {hasItinerary && citiesWithRemovedDays.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-accent/50 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                {citiesWithRemovedDays.map(c => c.cityName).join(' and ')} will
                have fewer days. Extra itinerary days will be removed.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isSaving}>
            {isSaving ? 'Saving...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
