/**
 * Why We Skipped Section
 * 
 * Displays tourist traps and overrated spots that were intentionally
 * excluded from the itinerary, with reasoning.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MapPinOff, AlertTriangle, DollarSign, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface SkippedItem {
  name: string;
  reason: string;
  category?: 'overpriced' | 'overcrowded' | 'overhyped' | 'tourist-trap' | 'better-alternative';
  savingsEstimate?: {
    money?: string;
    time?: string;
  };
  betterAlternative?: string;
}

interface WhyWeSkippedSectionProps {
  skippedItems: SkippedItem[];
  destination: string;
  className?: string;
}

export function WhyWeSkippedSection({
  skippedItems,
  destination,
  className,
}: WhyWeSkippedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (skippedItems.length === 0) return null;

  const categoryIcons: Record<string, React.ReactNode> = {
    'overpriced': <DollarSign className="h-3.5 w-3.5" />,
    'overcrowded': <Users className="h-3.5 w-3.5" />,
    'overhyped': <AlertTriangle className="h-3.5 w-3.5" />,
    'tourist-trap': <MapPinOff className="h-3.5 w-3.5" />,
    'better-alternative': <MapPinOff className="h-3.5 w-3.5" />,
  };

  const categoryLabels: Record<string, string> = {
    'overpriced': 'Overpriced',
    'overcrowded': 'Overcrowded',
    'overhyped': 'Overhyped',
    'tourist-trap': 'Tourist Trap',
    'better-alternative': 'Better Option Exists',
  };

  return (
    <div className={cn('rounded-xl border border-rose-200/50 bg-rose-50/30 dark:bg-rose-950/10 dark:border-rose-900/30', className)}>
      {/* Header - Always visible */}
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-transparent"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
            <MapPinOff className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-medium text-foreground">
              Why We Skipped These
            </h4>
            <p className="text-xs text-muted-foreground">
              {skippedItems.length} tourist trap{skippedItems.length !== 1 ? 's' : ''} avoided in {destination}
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </Button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {skippedItems.map((item, index) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-3 rounded-lg bg-background/80 border border-border"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      {categoryIcons[item.category || 'tourist-trap']}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="text-sm font-medium text-foreground line-through opacity-70">
                          {item.name}
                        </h5>
                        {item.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-medium">
                            {categoryLabels[item.category]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.reason}
                      </p>
                      
                      {/* Savings or Alternative */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {item.savingsEstimate?.money && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
                            <DollarSign className="h-2.5 w-2.5" />
                            Save {item.savingsEstimate.money}
                          </span>
                        )}
                        {item.savingsEstimate?.time && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            Save {item.savingsEstimate.time}
                          </span>
                        )}
                        {item.betterAlternative && (
                          <span className="text-[10px] text-primary">
                            Instead: {item.betterAlternative}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Trust Statement */}
              <p className="text-xs text-muted-foreground text-center pt-2 italic">
                When we steer you away from tourist traps, you know our recommendations are genuine.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default WhyWeSkippedSection;
