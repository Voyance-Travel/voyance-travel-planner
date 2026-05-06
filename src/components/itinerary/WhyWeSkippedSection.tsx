/**
 * Better Alternatives Section (formerly "Why We Skipped")
 * 
 * Displays local-favorite alternatives to commonly visited tourist spots,
 * framed positively as insider recommendations.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Compass, Star, DollarSign, Clock, Gem, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface SkippedItem {
  name: string;
  reason: string;
  category?: 'overpriced' | 'overcrowded' | 'overhyped' | 'tourist-trap' | 'better-alternative' | 'local-favorite' | 'better-value' | 'hidden-gem' | 'insider-pick';
  savingsEstimate?: {
    money?: string;
    time?: string;
  };
  betterAlternative?: string;
  localAlternative?: string;
}

interface WhyWeSkippedSectionProps {
  skippedItems: SkippedItem[];
  destination: string;
  className?: string;
  isLoading?: boolean;
}

export function WhyWeSkippedSection({
  skippedItems,
  destination,
  className,
  isLoading = false,
}: WhyWeSkippedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Hide entirely only if there's nothing to show AND nothing being loaded
  if (skippedItems.length === 0 && !isLoading) return null;

  const categoryIcons: Record<string, React.ReactNode> = {
    'local-favorite': <Star className="h-3.5 w-3.5" />,
    'better-value': <DollarSign className="h-3.5 w-3.5" />,
    'hidden-gem': <Gem className="h-3.5 w-3.5" />,
    'insider-pick': <Compass className="h-3.5 w-3.5" />,
    // Legacy categories mapped to positive icons
    'overpriced': <DollarSign className="h-3.5 w-3.5" />,
    'overcrowded': <Star className="h-3.5 w-3.5" />,
    'overhyped': <Compass className="h-3.5 w-3.5" />,
    'tourist-trap': <Star className="h-3.5 w-3.5" />,
    'better-alternative': <Gem className="h-3.5 w-3.5" />,
  };

  const categoryLabels: Record<string, string> = {
    'local-favorite': 'Local Favorite',
    'better-value': 'Better Value',
    'hidden-gem': 'Hidden Gem',
    'insider-pick': 'Insider Pick',
    // Legacy categories mapped to positive labels
    'overpriced': 'Better Value',
    'overcrowded': 'Local Alternative',
    'overhyped': 'Insider Pick',
    'tourist-trap': 'Local Favorite',
    'better-alternative': 'Hidden Gem',
  };

  return (
    <div className={cn('rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/5 dark:border-primary/20', className)}>
      {/* Header - Always visible */}
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-transparent"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Compass className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-medium text-foreground">
              Better Alternatives
            </h4>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              {skippedItems.length === 0 && isLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Finding local picks for {destination}…
                </>
              ) : (
                <>
                  {skippedItems.length} local pick{skippedItems.length !== 1 ? 's' : ''} for {destination}
                  {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                </>
              )}
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
              {skippedItems.length === 0 && isLoading ? (
                <>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="p-3 rounded-lg bg-background/80 border border-border">
                      <div className="flex items-start gap-3">
                        <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-4/5" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground text-center pt-1 italic flex items-center justify-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Curating local insights…
                  </p>
                </>
              ) : (
                <>
                  {skippedItems.map((item, index) => {
                    const alternative = item.localAlternative || item.betterAlternative;
                    const safeCategory = (item.category && categoryLabels[item.category])
                      ? item.category
                      : 'local-favorite';
                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-3 rounded-lg bg-background/80 border border-border"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            {categoryIcons[safeCategory]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {alternative ? (
                                <h5 className="text-sm font-medium text-foreground">
                                  {alternative}
                                </h5>
                              ) : (
                                <h5 className="text-sm font-medium text-foreground">
                                  {item.name}
                                </h5>
                              )}
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                {categoryLabels[safeCategory]}
                              </span>
                            </div>
                            {alternative && (
                              <p className="text-xs text-muted-foreground mb-1">
                                Instead of {item.name}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {item.reason}
                            </p>

                            {/* Value Gained */}
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
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Trust Statement */}
                  <p className="text-xs text-muted-foreground text-center pt-2 italic">
                    These picks come from local insights - the spots residents actually love.
                  </p>

                  {isLoading && (
                    <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Refreshing…
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default WhyWeSkippedSection;
