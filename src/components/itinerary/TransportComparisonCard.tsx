/**
 * TransportComparisonCard
 * 
 * Renders inline transport comparison options for transition days in multi-city trips.
 * Shows 3+ options with costs, durations, pros/cons, and allows selection.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Train, Plane, Bus, Car, Ship, ArrowRight, Clock, Wallet, Star, MapPin, Lightbulb, Check, ChevronDown, ChevronUp, ExternalLink, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TransportOption } from './EditorialItinerary';

interface TransportComparisonCardProps {
  transitionFrom: string;
  transitionTo: string;
  options: TransportOption[];
  selectedId?: string;
  onSelect?: (optionId: string) => void;
  onAddCustom?: () => void;
  className?: string;
}

const MODE_ICONS: Record<string, React.ElementType> = {
  train: Train,
  flight: Plane,
  bus: Bus,
  car: Car,
  ferry: Ship,
};

const MODE_LABELS: Record<string, string> = {
  train: 'Train',
  flight: 'Flight',
  bus: 'Bus',
  car: 'Drive',
  ferry: 'Ferry',
};

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${Math.round(amount)}`;
  }
}

export function TransportComparisonCard({
  transitionFrom,
  transitionTo,
  options,
  selectedId,
  onSelect,
  onAddCustom,
  className,
}: TransportComparisonCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localSelectedId, setLocalSelectedId] = useState(selectedId);

  if (!options || options.length === 0) return null;

  const handleSelect = (optionId: string) => {
    setLocalSelectedId(optionId);
    onSelect?.(optionId);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          <span>{transitionFrom}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{transitionTo}</span>
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
          {options.length} options
        </Badge>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {options.map((option) => {
          const Icon = MODE_ICONS[option.mode] || Train;
          const isSelected = localSelectedId === option.id;
          const isExpanded = expandedId === option.id;

          return (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                className={cn(
                  'transition-all duration-200 cursor-pointer border',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:shadow-sm',
                  option.isRecommended && !isSelected && 'border-primary/30'
                )}
                onClick={() => handleSelect(option.id)}
              >
                <CardContent className="p-3 space-y-2">
                  {/* Top row: mode + operator + badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'p-1.5 rounded-md',
                        isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground">{option.operator}</span>
                          {option.isRecommended && (
                            <Badge className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20">
                              <Star className="h-2.5 w-2.5 mr-0.5" />
                              Recommended
                            </Badge>
                          )}
                          {isSelected && (
                            <Badge className="text-[9px] px-1 py-0 bg-primary text-primary-foreground">
                              <Check className="h-2.5 w-2.5 mr-0.5" />
                              Selected
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {MODE_LABELS[option.mode] || option.mode}
                        </span>
                      </div>
                    </div>

                    {/* Cost */}
                    <div className="sm:text-right">
                      <div className="text-sm font-semibold text-foreground">
                        {formatCurrency(option.cost.total, option.cost.currency)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatCurrency(option.cost.perPerson, option.cost.currency)}/person
                      </div>
                    </div>
                  </div>

                  {/* Duration + Route */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{option.doorToDoorDuration} door-to-door</span>
                    </div>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{option.inTransitDuration} in transit</span>
                  </div>

                  {/* Departure → Arrival */}
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate max-w-[140px]">{option.departure.point}</span>
                    <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate max-w-[140px]">{option.arrival.point}</span>
                  </div>

                  {/* Pros/Cons pills */}
                  <div className="flex flex-wrap gap-1">
                    {option.pros.slice(0, 2).map((pro, i) => (
                      <Badge key={`pro-${i}`} variant="outline" className="text-[9px] px-1.5 py-0 bg-green-500/5 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                        {pro}
                      </Badge>
                    ))}
                    {option.cons.slice(0, 1).map((con, i) => (
                      <Badge key={`con-${i}`} variant="outline" className="text-[9px] px-1.5 py-0 bg-orange-500/5 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800">
                        {con}
                      </Badge>
                    ))}
                  </div>

                  {/* Recommendation reason */}
                  {option.isRecommended && option.recommendationReason && (
                    <p className="text-[11px] text-primary/80 italic">
                      💡 {option.recommendationReason}
                    </p>
                  )}

                  {/* Expand/collapse for details */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(isExpanded ? null : option.id);
                    }}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {isExpanded ? 'Less details' : 'More details'}
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 pt-1 border-t border-border/50"
                    >
                      {/* All pros */}
                      {option.pros.length > 0 && (
                        <div>
                          <span className="text-[10px] font-medium text-green-700 dark:text-green-400">Pros</span>
                          <ul className="mt-0.5 space-y-0.5">
                            {option.pros.map((pro, i) => (
                              <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                                <span className="text-green-500 mt-0.5">+</span> {pro}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* All cons */}
                      {option.cons.length > 0 && (
                        <div>
                          <span className="text-[10px] font-medium text-orange-700 dark:text-orange-400">Cons</span>
                          <ul className="mt-0.5 space-y-0.5">
                            {option.cons.map((con, i) => (
                              <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                                <span className="text-orange-500 mt-0.5">−</span> {con}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Scenic opportunities */}
                      {option.scenicOpportunities && option.scenicOpportunities.length > 0 && (
                        <div>
                          <span className="text-[10px] font-medium text-foreground">🏞️ En Route</span>
                          <ul className="mt-0.5 space-y-0.5">
                            {option.scenicOpportunities.map((scenic, i) => (
                              <li key={i} className="text-[11px] text-muted-foreground">• {scenic}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Booking tip */}
                      {option.bookingTip && (
                        <div className="flex items-start gap-1.5 bg-muted/50 rounded-md p-2">
                          <Lightbulb className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                          <span className="text-[11px] text-muted-foreground">{option.bookingTip}</span>
                        </div>
                      )}

                      {/* Booking link */}
                      {option.bookingUrl && (
                        <a
                          href={option.bookingUrl.startsWith('http') ? option.bookingUrl : `https://${option.bookingUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                          Book at {option.bookingWebsite || option.bookingUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}

                      {/* Cost breakdown */}
                      {!option.cost.includesTransfers && (
                        <p className="text-[10px] text-muted-foreground italic">
                          ⚠️ Price does not include transfers to/from station/airport
                        </p>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Add your own transport */}
      {onAddCustom && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs border-dashed"
          onClick={onAddCustom}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add your own transport
        </Button>
      )}

      <p className="text-[10px] text-muted-foreground/60 px-1 italic">
        Prices are estimates. Book externally, then paste your confirmation back here
      </p>
    </div>
  );
}
