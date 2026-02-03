/**
 * Transit Badge Component
 * Shows distance/transport info between consecutive activities
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Train, Car, ChevronDown, Footprints, Bus } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  walk: <Footprints className="h-3 w-3" />,
  walking: <Footprints className="h-3 w-3" />,
  metro: <Train className="h-3 w-3" />,
  train: <Train className="h-3 w-3" />,
  subway: <Train className="h-3 w-3" />,
  bus: <Bus className="h-3 w-3" />,
  uber: <Car className="h-3 w-3" />,
  taxi: <Car className="h-3 w-3" />,
  driving: <Car className="h-3 w-3" />,
  car: <Car className="h-3 w-3" />,
};

export function TransitBadge({ 
  transportation, 
  tripCurrency, 
  displayCost, 
  showDetails = false 
}: TransitBadgeProps) {
  const [expanded, setExpanded] = useState(showDetails);
  
  const icon = transportIcons[transportation.method.toLowerCase()] || <MapPin className="h-3 w-3" />;
  const costDisplay = transportation.estimatedCost?.amount && transportation.estimatedCost.amount > 0
    ? formatCurrency(displayCost(transportation.estimatedCost.amount), tripCurrency)
    : null;

  return (
    <div className="mt-3 -mb-1">
      {/* Compact inline badge */}
      <div 
        className={cn(
          "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full",
          "bg-secondary/50 border border-border/50 text-xs text-muted-foreground",
          transportation.instructions && "cursor-pointer hover:bg-secondary/80 transition-colors"
        )}
        onClick={() => transportation.instructions && setExpanded(!expanded)}
      >
        <span className="flex items-center gap-1.5">
          {icon}
          <span className="capitalize font-medium">{transportation.method}</span>
        </span>
        
        {transportation.distance && (
          <>
            <span className="text-muted-foreground/50">•</span>
            <span>{transportation.distance}</span>
          </>
        )}
        
        {transportation.duration && (
          <>
            <span className="text-muted-foreground/50">•</span>
            <span>{transportation.duration}</span>
          </>
        )}
        
        {costDisplay && (
          <>
            <span className="text-muted-foreground/50">•</span>
            <span className="font-medium text-foreground">{costDisplay}</span>
          </>
        )}
        
        {transportation.instructions && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-3 w-3" />
          </motion.div>
        )}
      </div>
      
      {/* Expandable instructions */}
      <AnimatePresence>
        {expanded && transportation.instructions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 ml-2 pl-3 border-l-2 border-primary/20 space-y-1.5">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TransitBadge;
