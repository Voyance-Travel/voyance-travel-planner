/**
 * Transit Badge Component
 * Collapsed by default — shows a thin dotted line with icon + duration.
 * Expands on tap to reveal full details, instructions, and mode switcher.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Train, Car, ChevronDown, Footprints, Bus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface TransitBadgeProps {
  transportation: {
    method: string;
    duration: string;
    distance?: string;
    estimatedCost?: { amount: number; currency: string };
    instructions?: string;
  };
  tripCurrency: string;
  displayCost: (amountInUSD: number) => number;
  showDetails?: boolean;
  onTransportModeChange?: (newMode: string) => Promise<void>;
  isChangingMode?: boolean;
}

function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
  if (amount === null || amount === undefined || amount === 0) return '';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
}

const transportIcons: Record<string, React.ReactNode> = {
  walk: <Footprints className="h-2.5 w-2.5" />,
  walking: <Footprints className="h-2.5 w-2.5" />,
  metro: <Train className="h-2.5 w-2.5" />,
  train: <Train className="h-2.5 w-2.5" />,
  subway: <Train className="h-2.5 w-2.5" />,
  bus: <Bus className="h-2.5 w-2.5" />,
  uber: <Car className="h-2.5 w-2.5" />,
  taxi: <Car className="h-2.5 w-2.5" />,
  driving: <Car className="h-2.5 w-2.5" />,
  car: <Car className="h-2.5 w-2.5" />,
};

const AVAILABLE_MODES = [
  { value: 'walking', label: 'Walk', icon: <Footprints className="h-3.5 w-3.5" /> },
  { value: 'metro', label: 'Metro', icon: <Train className="h-3.5 w-3.5" /> },
  { value: 'bus', label: 'Bus', icon: <Bus className="h-3.5 w-3.5" /> },
  { value: 'uber', label: 'Rideshare', icon: <Car className="h-3.5 w-3.5" /> },
  { value: 'taxi', label: 'Taxi', icon: <Car className="h-3.5 w-3.5" /> },
];

export function TransitBadge({ 
  transportation, 
  tripCurrency, 
  displayCost, 
  showDetails = false,
  onTransportModeChange,
  isChangingMode = false,
}: TransitBadgeProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(isMobile ? false : showDetails);
  
  const icon = transportIcons[(transportation.method || 'walk').toLowerCase()] || <MapPin className="h-2.5 w-2.5" />;
  const currentMode = (transportation.method || 'walk').toLowerCase();
  const isWalking = ['walk', 'walking'].includes(currentMode);

  const costDisplay = !isWalking && transportation.estimatedCost?.amount && transportation.estimatedCost.amount > 0
    ? formatCurrency(displayCost(transportation.estimatedCost.amount), tripCurrency)
    : null;

  const handleModeSelect = async (mode: string) => {
    if (mode === currentMode || !onTransportModeChange) return;
    await onTransportModeChange(mode);
  };

  return (
    <div className="mt-1 mb-0">
      {/* Collapsed: thin dotted line with icon + duration + tap to expand */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 py-1 group cursor-pointer",
          "transition-colors"
        )}
      >
        {/* Left dashed line */}
        <div className="flex-1 border-t border-dashed border-border/30" />

        {/* Icon + duration pill */}
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors shrink-0">
          {isChangingMode ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : (
            icon
          )}
          {transportation.duration && (
            <span>{transportation.duration}</span>
          )}
          {costDisplay && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span>{costDisplay}</span>
            </>
          )}
          {isWalking && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-green-600/70">Free</span>
            </>
          )}
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronDown className="h-2 w-2" />
          </motion.div>
        </span>

        {/* Right dashed line */}
        <div className="flex-1 border-t border-dashed border-border/30" />
      </button>

      {/* Expanded: details + mode picker */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="py-1.5 px-3 ml-4 space-y-2">
              {/* Instructions */}
              {transportation.instructions && (
                <div className="pl-3 border-l-2 border-primary/20 space-y-1.5">
                  {transportation.instructions.includes('→') ? (
                    transportation.instructions.split('→').map((step, idx) => {
                      const trimmedStep = step.trim();
                      if (!trimmedStep) return null;
                      return (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <div className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-medium shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <span className="text-muted-foreground">{trimmedStep}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground/80">
                      {transportation.instructions}
                    </p>
                  )}
                </div>
              )}

              {/* Mode picker — always visible when expanded and editable */}
              {onTransportModeChange && !isChangingMode && (
                <div className="pt-1">
                  <p className="text-[10px] text-muted-foreground/60 mb-1.5">Change transport:</p>
                  <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide sm:flex-wrap sm:overflow-visible">
                    {AVAILABLE_MODES.map(mode => {
                      const isActive = mode.value === currentMode ||
                        (currentMode === 'walk' && mode.value === 'walking');
                      return (
                        <button
                          key={mode.value}
                          onClick={(e) => { e.stopPropagation(); handleModeSelect(mode.value); }}
                          disabled={isActive}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary border-primary/30 font-medium"
                              : "bg-background border-border hover:border-primary/50 hover:text-foreground text-muted-foreground"
                          )}
                        >
                          {mode.icon}
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TransitBadge;
