import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bus, Train, Car, Footprints, DollarSign, Ruler, Check, Coins } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCredits } from '@/config/pricing';

export type TransportModeOption = 'bus' | 'train' | 'rideshare' | 'taxi' | 'walking' | 'cheapest';
export type DistanceUnit = 'km' | 'miles';

export interface OptimizePreferences {
  transportModes: TransportModeOption[];
  distanceUnit: DistanceUnit;
}

interface OptimizePreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (preferences: OptimizePreferences) => void;
  isOptimizing?: boolean;
  /** Credit cost for this optimization (0 = free) */
  creditCost?: number;
  /** Whether this is the user's first trip (free optimization) */
  isFirstTrip?: boolean;
  /** User's current credit balance */
  userBalance?: number;
  /** Whether credit spending is in progress */
  isSpending?: boolean;
}

const TRANSPORT_OPTIONS: { id: TransportModeOption; label: string; icon: typeof Bus; description: string }[] = [
  { id: 'train', label: 'Train / Metro', icon: Train, description: 'Subway, metro, rail' },
  { id: 'bus', label: 'Bus', icon: Bus, description: 'City buses, coaches' },
  { id: 'rideshare', label: 'Rideshare', icon: Car, description: 'Uber, Lyft, Bolt' },
  { id: 'taxi', label: 'Taxi', icon: Car, description: 'Traditional taxis' },
  { id: 'walking', label: 'Walking', icon: Footprints, description: 'On foot when practical' },
  { id: 'cheapest', label: 'Cheapest Option', icon: DollarSign, description: 'Always pick lowest cost' },
];

const UNIT_OPTIONS: { id: DistanceUnit; label: string }[] = [
  { id: 'km', label: 'Kilometers' },
  { id: 'miles', label: 'Miles' },
];

export default function OptimizePreferencesDialog({
  open,
  onOpenChange,
  onConfirm,
  isOptimizing,
  creditCost = 0,
  isFirstTrip = false,
  userBalance = 0,
  isSpending = false,
}: OptimizePreferencesDialogProps) {
  const [selectedModes, setSelectedModes] = useState<TransportModeOption[]>(['train', 'bus', 'walking']);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');

  const isFree = isFirstTrip || creditCost === 0;
  const insufficientCredits = !isFree && userBalance < creditCost;
  const creditsNeeded = insufficientCredits ? creditCost - userBalance : 0;
  const lowBalanceWarning = !isFree && !insufficientCredits && (userBalance - creditCost) < 50;

  const toggleMode = (mode: TransportModeOption) => {
    if (mode === 'cheapest') {
      setSelectedModes(prev => prev.includes('cheapest') ? [] : ['cheapest']);
      return;
    }
    setSelectedModes(prev => {
      const withoutCheapest = prev.filter(m => m !== 'cheapest');
      if (withoutCheapest.includes(mode)) {
        return withoutCheapest.filter(m => m !== mode);
      }
      return [...withoutCheapest, mode];
    });
  };

  const handleConfirm = () => {
    onConfirm({
      transportModes: selectedModes.length > 0 ? selectedModes : ['train', 'bus', 'walking'],
      distanceUnit,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-primary" />
            Optimization Preferences
          </DialogTitle>
          <DialogDescription>
            Choose your transport preferences and distance units
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Transport Modes */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              What transport are you willing to take?
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {TRANSPORT_OPTIONS.map((option) => {
                const isSelected = selectedModes.includes(option.id);
                const Icon = option.icon;
                const isCheapestSelected = selectedModes.includes('cheapest');
                const isDisabled = option.id !== 'cheapest' && isCheapestSelected;

                return (
                  <motion.button
                    key={option.id}
                    type="button"
                    whileHover={{ scale: isDisabled ? 1 : 1.02 }}
                    whileTap={{ scale: isDisabled ? 1 : 0.98 }}
                    onClick={() => !isDisabled && toggleMode(option.id)}
                    disabled={isDisabled}
                    className={cn(
                      'p-3 rounded-lg border-2 text-left transition-all relative',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-muted-foreground/50',
                      isDisabled && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Icon className={cn(
                        'w-4 h-4',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )} />
                      <span className={cn(
                        'text-sm font-medium',
                        isSelected ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {option.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 pl-6">
                      {option.description}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Distance Units */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              Distance units
            </h4>
            <div className="flex gap-2">
              {UNIT_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant={distanceUnit === option.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDistanceUnit(option.id)}
                  className="flex-1"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Insufficient credits warning */}
          {insufficientCredits && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-destructive font-medium">
                You need {creditsNeeded} more credits to optimize routes
              </p>
              <a
                href="/profile?tab=credits"
                className="text-xs text-primary underline mt-1 inline-block"
              >
                Get more credits →
              </a>
            </div>
          )}

          {/* Low balance warning */}
          {lowBalanceWarning && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                This will leave you with {formatCredits(userBalance - creditCost)} credits remaining
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isOptimizing || isSpending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isOptimizing || isSpending || selectedModes.length === 0 || insufficientCredits}
          >
            {isOptimizing || isSpending ? (
              'Optimizing...'
            ) : isFree ? (
              'Optimize Routes'
            ) : (
              <span className="flex items-center gap-1.5">
                Optimize Routes
                <span className="inline-flex items-center gap-0.5 text-xs opacity-80">
                  · <Coins className="w-3 h-3" /> {creditCost}
                </span>
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
