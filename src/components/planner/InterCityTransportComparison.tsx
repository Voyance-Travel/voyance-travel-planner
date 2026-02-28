/**
 * InterCityTransportComparison
 * 
 * Pre-generation module that shows AI-generated transport comparison
 * options between multi-city destinations. Wraps TransportComparisonCard
 * with fetching logic and persists selection to trip_cities.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightLeft, Loader2, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TransportComparisonCard } from '@/components/itinerary/TransportComparisonCard';
import { useTransportComparison } from '@/hooks/useTransportComparison';
import type { TransportOption } from '@/components/itinerary/EditorialItinerary';

export interface CityTransition {
  fromCity: string;
  fromCountry?: string;
  toCity: string;
  toCountry?: string;
  index: number; // position in the route (0-based)
}

export interface MissingLeg {
  from?: string;
  fromCity?: string;
  to?: string;
  toCity?: string;
  reason?: string;
  suggestedDateRange?: { earliest?: string; latest?: string };
  priority?: string;
}

interface InterCityTransportComparisonProps {
  transitions: CityTransition[];
  travelers: number;
  archetype?: string;
  budgetTier?: string;
  travelDate?: string;
  currency?: string;
  /** Called when user selects an option for a transition */
  onSelect?: (transitionIndex: number, option: TransportOption) => void;
  /** Selections map: transitionIndex → selected option id */
  selections?: Record<number, string>;
  /** Missing legs from flight intelligence */
  missingLegs?: MissingLeg[];
  className?: string;
}

function TransitionComparison({
  transition,
  travelers,
  archetype,
  budgetTier,
  travelDate,
  currency,
  selectedId,
  onSelect,
}: {
  transition: CityTransition;
  travelers: number;
  archetype?: string;
  budgetTier?: string;
  travelDate?: string;
  currency?: string;
  selectedId?: string;
  onSelect?: (option: TransportOption) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const { data, isLoading, error, refetch } = useTransportComparison({
    fromCity: transition.fromCity,
    fromCountry: transition.fromCountry,
    toCity: transition.toCity,
    toCountry: transition.toCountry,
    travelers,
    archetype,
    budgetTier,
    travelDate,
    currency,
  });

  // Auto-select recommended option if nothing selected
  useEffect(() => {
    if (data?.options && !selectedId && onSelect) {
      const recommended = data.options.find(o => o.isRecommended);
      if (recommended) onSelect(recommended);
    }
  }, [data?.options, selectedId, onSelect]);

  const handleSelect = (optionId: string) => {
    const option = data?.options.find(o => o.id === optionId);
    if (option && onSelect) onSelect(option);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {transition.fromCity} → {transition.toCity}
          </span>
          {selectedId && data?.options && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {data.options.find(o => o.id === selectedId)?.operator || 'Selected'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              {isLoading && (
                <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Comparing transport options…
                </div>
              )}

              {error && (
                <div className="flex flex-col items-center gap-2 py-6 text-sm">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <p className="text-muted-foreground">Couldn't load transport options</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refetch()}
                    className="text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Try again
                  </Button>
                </div>
              )}

              {data?.options && data.options.length > 0 && (
                <>
                  <TransportComparisonCard
                    transitionFrom={transition.fromCity}
                    transitionTo={transition.toCity}
                    options={data.options}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                  />
                  {data.disclaimer && (
                    <p className="text-[10px] text-muted-foreground/60 mt-2 italic px-1">
                      ⚠️ {data.disclaimer}
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function InterCityTransportComparison({
  transitions,
  travelers,
  archetype,
  budgetTier,
  travelDate,
  currency,
  onSelect,
  selections = {},
  missingLegs,
  className,
}: InterCityTransportComparisonProps) {
  if (transitions.length === 0) return null;

  // Check if a transition matches a missing leg
  const findMissingLeg = (transition: CityTransition) => {
    if (!missingLegs || missingLegs.length === 0) return undefined;
    return missingLegs.find(leg => {
      const legFrom = (leg.fromCity || leg.from || '').toLowerCase();
      const legTo = (leg.toCity || leg.to || '').toLowerCase();
      const tFrom = transition.fromCity.toLowerCase();
      const tTo = transition.toCity.toLowerCase();
      return (tFrom.includes(legFrom) || legFrom.includes(tFrom)) &&
             (tTo.includes(legTo) || legTo.includes(tTo));
    });
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 px-1">
        <ArrowRightLeft className="h-4 w-4 text-primary" />
        <span className="text-xs tracking-[0.12em] uppercase text-muted-foreground font-medium">
          Transportation between cities
        </span>
      </div>

      {transitions.map((transition) => {
        const missing = findMissingLeg(transition);
        return (
          <div key={`${transition.fromCity}-${transition.toCity}`}>
            {missing && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      ⚠️ Not yet booked: {transition.fromCity} → {transition.toCity}
                    </p>
                    {missing.reason && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{missing.reason}</p>
                    )}
                    {missing.suggestedDateRange && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Suggested booking window: {missing.suggestedDateRange.earliest} – {missing.suggestedDateRange.latest}
                      </p>
                    )}
                    <Badge variant="outline" className="mt-1.5 text-[10px] border-amber-400 text-amber-700 dark:text-amber-300">
                      {missing.priority === 'CRITICAL' ? '🔴 Critical' : '🟡 Needs booking'}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            )}
            <TransitionComparison
              transition={transition}
              travelers={travelers}
              archetype={archetype}
              budgetTier={budgetTier}
              travelDate={travelDate}
              currency={currency}
              selectedId={selections[transition.index]}
              onSelect={(option) => onSelect?.(transition.index, option)}
            />
          </div>
        );
      })}
    </div>
  );
}
