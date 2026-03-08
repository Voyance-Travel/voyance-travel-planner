/**
 * Transit Badge Component
 * Collapsed by default — shows a thin dotted line with icon + duration.
 * Expands on tap to reveal full details, cost, instructions, and mode switcher.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Train, Car, ChevronDown, ChevronUp, Footprints, Bus, ArrowRightLeft, Loader2, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CREDIT_COSTS } from '@/config/pricing';
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
  /** When provided, shows transport mode switcher */
  onTransportModeChange?: (newMode: string) => Promise<void>;
  isChangingMode?: boolean;
}

function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
  if (amount === null || amount === undefined || amount === 0) return '';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
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
  { value: 'bus', label: 'Bus', icon: <Bus className="h-3.5 w-3.5" /> },
  { value: 'metro', label: 'Metro', icon: <Train className="h-3.5 w-3.5" /> },
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
  const [expanded, setExpanded] = useState(showDetails);
  const [showModePicker, setShowModePicker] = useState(false);
  
  const icon = transportIcons[transportation.method.toLowerCase()] || <MapPin className="h-2.5 w-2.5" />;
  const costDisplay = transportation.estimatedCost?.amount && transportation.estimatedCost.amount > 0
    ? formatCurrency(displayCost(transportation.estimatedCost.amount), tripCurrency)
    : null;

  const currentMode = transportation.method.toLowerCase();

  const handleModeSelect = async (mode: string) => {
    if (mode === currentMode || !onTransportModeChange) return;
    setShowModePicker(false);
    await onTransportModeChange(mode);
  };

  return (
    <div className="mt-1 mb-0">
      {/* Collapsed: thin dotted line with icon + duration */}
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

      {/* Expanded: full details */}
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
              {/* Method + distance + cost row */}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium capitalize">
                  {icon}
                  {transportation.method}
                </span>
                {transportation.distance && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span>{transportation.distance}</span>
                  </>
                )}
                {transportation.duration && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span>{transportation.duration}</span>
                  </>
                )}
                {costDisplay && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span>{costDisplay}</span>
                  </>
                )}

                {/* Change mode button */}
                {onTransportModeChange && !isChangingMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowModePicker(!showModePicker);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] ml-auto",
                      "border border-dashed border-border/60 text-muted-foreground",
                      "hover:border-primary/50 hover:text-primary transition-colors",
                      showModePicker && "border-primary/50 text-primary bg-primary/5"
                    )}
                    title={`Change transport mode (${CREDIT_COSTS.TRANSPORT_MODE_CHANGE} credits)`}
                  >
                    <ArrowRightLeft className="h-2.5 w-2.5" />
                    <span className="hidden sm:inline">Change</span>
                  </button>
                )}
              </div>

              {/* Mode picker */}
              <AnimatePresence>
                {showModePicker && onTransportModeChange && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {AVAILABLE_MODES.map(mode => {
                        const isActive = mode.value === currentMode || 
                          (currentMode === 'walk' && mode.value === 'walking');
                        return (
                          <button
                            key={mode.value}
                            onClick={() => handleModeSelect(mode.value)}
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
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-1">
                        <Coins className="h-2.5 w-2.5" />
                        {CREDIT_COSTS.TRANSPORT_MODE_CHANGE} credits
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TransitBadge;
