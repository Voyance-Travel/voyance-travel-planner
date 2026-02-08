 import { Lock, Sparkles, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
 import { useManualBuilderStore } from '@/stores/manual-builder-store';
 import { useOutOfCredits } from '@/contexts/OutOfCreditsContext';
 import { CREDIT_COSTS } from '@/config/pricing';
 import { toast } from 'sonner';

interface DayLockOverlayProps {
  dayNumber: number;
  totalDays: number;
  onUnlock?: () => void;
   tripId?: string;
   onManualBuild?: () => void;
   currentBalance?: number;
}

/**
 * Overlay shown on locked days for free users.
 * Shows a teaser of what's in the day with a call to unlock.
 */
 export function DayLockOverlay({ dayNumber, totalDays, onUnlock, tripId, onManualBuild, currentBalance = 0 }: DayLockOverlayProps) {
   const { enableManualBuilder } = useManualBuilderStore();
   const { showOutOfCredits } = useOutOfCredits();

  const handleUnlock = () => {
    if (onUnlock) {
      onUnlock();
    } else {
      showOutOfCredits({
        action: 'UNLOCK_DAY',
        creditsNeeded: CREDIT_COSTS.UNLOCK_DAY,
        creditsAvailable: currentBalance,
        tripId,
      });
    }
  };

   const handleManualBuild = () => {
     if (tripId) {
       enableManualBuilder(tripId);
       toast.success('Manual builder mode enabled! You can now edit freely.');
     }
     onManualBuild?.();
   };
 
  return (
    <div className="relative">
      {/* Blurred content placeholder */}
      <div className="bg-gradient-to-b from-secondary/50 to-secondary/80 rounded-xl p-6 min-h-[200px] relative overflow-hidden">
        {/* Faux activity cards - blurred */}
        <div className="space-y-3 opacity-30 blur-sm pointer-events-none">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card/50 rounded-lg p-4 h-16" />
          ))}
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <div className="text-center max-w-xs">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            
            <h3 className="font-serif font-bold text-lg mb-1">
              Day {dayNumber} of {totalDays}
            </h3>
            
            <p className="text-sm text-muted-foreground mb-4">
              Unlock to see all activities, swap options, and route optimization for this day.
            </p>

            <Button onClick={handleUnlock} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Unlock Full Itinerary
            </Button>
            
             {tripId && (
               <button
                 onClick={handleManualBuild}
                 className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-4 transition-colors mx-auto"
               >
                 <Pencil className="h-3 w-3" />
                 I'll build it myself
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
