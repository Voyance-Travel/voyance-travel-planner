/**
 * TransitModePicker — Tappable transport row that expands to show
 * alternative transport modes with route details from airport-transfers.
 * Two-level expansion: Level 1 = options list, Level 2 = route details per option.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Car, Train, Bus, Footprints, Navigation2, Clock, ChevronDown, ChevronUp,
  Sparkles, Check, Loader2, Edit3, MoveUp, MoveDown, Trash2, Calendar,
  MoreHorizontal, ThumbsUp, ThumbsDown, Ship, Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RouteDetails {
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
    travelMode: string;
    transitDetails?: {
      lineName: string;
      vehicleType: string;
      departureStop: string;
      arrivalStop: string;
      numStops: number;
    };
  }>;
  summary: string;
  totalDuration: string;
  totalDistance: string;
}

interface TransportOptionData {
  id: string;
  mode: string;
  label: string;
  icon: string;
  duration: string;
  durationMinutes: number;
  estimatedCost: string;
  costPerPerson?: string;
  route?: string;
  notes?: string;
  pros?: string[];
  cons?: string[];
  trainLine?: string;
  bookingTip?: string;
  recommended?: boolean;
}

interface TransitModePickerProps {
  activity: any;
  activityIndex: number;
  dayIndex: number;
  activityTitle: string;
  transportIcon: React.ReactNode;
  durationText: string | null;
  transportCost: number | null;
  isLast: boolean;
  isEditable: boolean;
  city: string;
  tripId: string;
  tripCurrency: string;
  travelers?: number;
  transitOrigin?: string;
  onEdit: (dayIndex: number, activityIndex: number, activity: any) => void;
  onMove: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onMoveToDay?: (fromDay: number, activityId: string, toDay: number) => void;
  onRemove?: (dayIndex: number, activityId: string) => void;
  totalActivities: number;
  totalDays: number;
  formatCurrency: (c: number) => string;
  onActivityUpdated?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTransitDestination(title: string): string {
  const toMatch = title.match(/(?:to|toward|towards)\s+(.+?)(?:\s+via\b.*)?$/i);
  return toMatch?.[1]?.trim() || title;
}

function getModeIcon(mode: string) {
  const m = (mode || '').toLowerCase();
  if (m.includes('taxi') || m.includes('rideshare') || m.includes('car') || m.includes('uber'))
    return <Car className="h-4 w-4" />;
  if (m.includes('train') || m.includes('metro') || m.includes('subway'))
    return <Train className="h-4 w-4" />;
  if (m.includes('bus') || m.includes('shuttle'))
    return <Bus className="h-4 w-4" />;
  if (m.includes('walk'))
    return <Footprints className="h-4 w-4" />;
  if (m.includes('ferry') || m.includes('boat'))
    return <Ship className="h-4 w-4" />;
  return <Navigation2 className="h-4 w-4" />;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TransitModePicker({
  activity,
  activityIndex,
  dayIndex,
  activityTitle,
  transportIcon,
  durationText,
  transportCost,
  isLast,
  isEditable,
  city,
  tripId,
  tripCurrency,
  travelers,
  transitOrigin,
  onEdit,
  onMove,
  onMoveToDay,
  onRemove,
  totalActivities,
  totalDays,
  formatCurrency,
  onActivityUpdated,
}: TransitModePickerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [options, setOptions] = useState<TransportOptionData[]>([]);
  const [aiRecommendation, setAiRecommendation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);
  const [routeDetailsCache, setRouteDetailsCache] = useState<Record<string, RouteDetails | null>>({});
  const [loadingRouteId, setLoadingRouteId] = useState<string | null>(null);
  const [showAllStepsFor, setShowAllStepsFor] = useState<string | null>(null);

  const safeTitle = activityTitle || '';
  const transitDestination = parseTransitDestination(safeTitle);
  const isAirportRoute = safeTitle.toLowerCase().includes('airport');

  const fetchOptions = useCallback(async () => {
    if (hasFetched || isLoading) return;
    setIsLoading(true);
    try {
      const origin = transitOrigin || city;
      const destination = transitDestination + ', ' + city;

      const { data, error } = await supabase.functions.invoke('airport-transfers', {
        body: { origin, destination, city },
      });

      if (!error && data?.options) {
        let filtered = (data.options as TransportOptionData[]);

        // Filter airport-specific options for non-airport routes
        if (!isAirportRoute) {
          filtered = filtered
            .filter(opt => opt.id !== 'hotel_car')
            .map(opt => {
              if (opt.label === 'Airport Bus / Shuttle') {
                return { ...opt, label: 'Bus / Shuttle' };
              }
              return opt;
            });
        }

        // Add Walk option for non-airport routes
        if (!isAirportRoute) {
          filtered.push({
            id: 'walk',
            mode: 'walk',
            label: 'Walk',
            icon: '🚶',
            duration: 'Varies',
            durationMinutes: 0,
            estimatedCost: 'Free',
            route: `Walk to ${transitDestination}`,
            pros: ['Free', 'See the neighborhood up close', 'Good for short distances'],
            cons: ['Weather dependent', 'Not practical for long distances or with luggage'],
            notes: 'Best for distances under 20 minutes',
          });
        }

        setOptions(filtered);
        setAiRecommendation(data.aiRecommendation || '');

        // Fetch real walking data for the Walk option
        if (!isAirportRoute && filtered.some(o => o.id === 'walk')) {
          const walkOrigin = transitOrigin || city;
          const walkDest = transitDestination + ', ' + city;
          supabase.functions.invoke('route-details', {
            body: { origin: walkOrigin, destination: walkDest, mode: 'walking' },
          }).then(({ data: walkData }) => {
            if (walkData?.totalDuration && walkData?.totalDistance) {
              setOptions(prev => prev.map(o => {
                if (o.id === 'walk') {
                  return {
                    ...o,
                    duration: walkData.totalDuration,
                    estimatedCost: 'Free',
                    route: `Walk ${walkData.totalDuration} (${walkData.totalDistance})`,
                    notes: `${walkData.totalDistance} walk`,
                  };
                }
                return o;
              }));
            }
          }).catch(() => { /* keep "Varies" as fallback */ });
        }
      }
    } catch (err) {
      console.error('Failed to fetch transit options:', err);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [city, transitDestination, transitOrigin, activity, hasFetched, isLoading, isAirportRoute]);

  const handleExpand = () => {
    if (!isEditable) return;
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) setExpandedOptionId(null);
    if (next && !hasFetched) fetchOptions();
  };

  const handleSelectOption = useCallback(async (option: TransportOptionData) => {
    const shortMode = option.mode === 'walk' ? 'Walk'
      : option.mode === 'taxi' ? 'Taxi'
      : option.mode === 'uber' ? 'Rideshare'
      : option.mode === 'train' || option.mode === 'metro' ? (option.trainLine || 'Train')
      : option.mode === 'transit' ? 'Transit'
      : option.mode === 'bus' ? 'Bus'
      : option.mode === 'ferry' ? 'Ferry'
      : option.label;

    const newTitle = option.mode === 'walk'
      ? `Walk to ${transitDestination}`
      : `Travel to ${transitDestination} via ${shortMode}`;

    const parsedCost = parseFloat(option.estimatedCost.replace(/[^0-9.]/g, '')) || 0;

    setSelectedMode(option.id);

    try {
      const updatedActivity = {
        ...activity,
        title: newTitle,
        duration: option.duration,
        durationMinutes: option.durationMinutes,
        cost: {
          ...(activity.cost || {}),
          amount: parsedCost,
        },
      };

      onEdit(dayIndex, activityIndex, updatedActivity);
      setIsExpanded(false);
      onActivityUpdated?.();
    } catch (err) {
      console.error('Failed to update transit activity:', err);
      setSelectedMode(null);
    }
  }, [activity, activityIndex, dayIndex, onEdit, onActivityUpdated, transitDestination]);

  const fetchRouteDetails = useCallback(async (option: TransportOptionData) => {
    if (routeDetailsCache[option.id] !== undefined || loadingRouteId === option.id) return;
    setLoadingRouteId(option.id);
    try {
      const googleMode = option.mode === 'taxi' || option.mode === 'uber' || option.mode === 'rideshare' ? 'driving'
        : option.mode === 'train' || option.mode === 'metro' || option.mode === 'bus' || option.mode === 'transit' ? 'transit'
        : option.mode === 'walk' ? 'walking'
        : 'driving';

      const origin = transitOrigin || city;
      const destination = transitDestination + ', ' + city;

      const { data, error } = await supabase.functions.invoke('route-details', {
        body: { origin, destination, mode: googleMode },
      });

      if (!error && data?.steps?.length > 0) {
        setRouteDetailsCache(prev => ({ ...prev, [option.id]: data as RouteDetails }));
      } else {
        setRouteDetailsCache(prev => ({ ...prev, [option.id]: null }));
      }
    } catch {
      setRouteDetailsCache(prev => ({ ...prev, [option.id]: null }));
    } finally {
      setLoadingRouteId(null);
    }
  }, [routeDetailsCache, loadingRouteId, transitOrigin, activity, city, transitDestination]);

  const toggleOptionDetail = (optionId: string, option?: TransportOptionData) => {
    const next = expandedOptionId === optionId ? null : optionId;
    setExpandedOptionId(next);
    if (next && option && routeDetailsCache[optionId] === undefined) {
      fetchRouteDetails(option);
    }
  };

  return (
    <div>
      {/* Tappable transit row */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 sm:px-4 py-2 group/activity",
          !isLast && !isExpanded && "border-b border-border/30",
          isEditable && "cursor-pointer hover:bg-secondary/20 transition-colors",
        )}
        data-tour="transit-row"
        onClick={handleExpand}
        role={isEditable ? 'button' : undefined}
        tabIndex={isEditable ? 0 : undefined}
      >
        {/* Dotted timeline connector */}
        <div className="flex flex-col items-center gap-0.5 shrink-0 text-border">
          <div className="w-px h-2 border-l border-dashed" />
          <div className="w-px h-2 border-l border-dashed" />
        </div>

        {/* Icon */}
        <span className="text-muted-foreground shrink-0">{transportIcon}</span>

        {/* Title */}
        <span className="text-xs text-muted-foreground truncate sm:whitespace-normal min-w-0">
          {activityTitle}
        </span>

        {/* Duration pill */}
        {durationText && (
          <span className="text-[10px] font-medium text-muted-foreground bg-secondary/50 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
            {durationText}
          </span>
        )}

        {/* Cost */}
        {transportCost != null && (
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
            {formatCurrency(transportCost)}
          </span>
        )}

        {/* Expand indicator */}
        {isEditable && (
          <span className="text-muted-foreground/50 shrink-0 ml-auto">
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        )}

      </div>

      {/* Expandable options panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn("overflow-hidden", !isLast && "border-b border-border/30")}
          >
            <div className="px-4 pb-3 space-y-2">
              {/* AI Recommendation */}
              {aiRecommendation && !isLoading && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">AI Recommendation</p>
                    <p className="text-xs text-foreground/80 mt-0.5">{aiRecommendation}</p>
                  </div>
                </div>
              )}

              {/* Loading */}
              {isLoading && (
                <div className="flex items-center justify-center py-6 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Finding transport options...</span>
                </div>
              )}

              {/* Options list — Level 1 */}
              {!isLoading && options.map((option) => {
                const isCurrentMode = safeTitle.toLowerCase().includes((option.mode || '').toLowerCase()) ||
                  safeTitle.toLowerCase().includes((option.label || '').toLowerCase().split(' ')[0]);
                const isDetailExpanded = expandedOptionId === option.id;

                return (
                  <div
                    key={option.id}
                    className={cn(
                      "rounded-lg border transition-all overflow-hidden",
                      isCurrentMode
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-card hover:border-primary/30",
                      option.recommended && !isCurrentMode && "border-primary/20 bg-primary/[0.02]"
                    )}
                  >
                    {/* Level 1: Option summary row — tap to expand details */}
                    <button
                      onClick={() => toggleOptionDetail(option.id, option)}
                      className={cn(
                        "flex items-center gap-2.5 p-2.5 w-full text-left transition-colors",
                        !isCurrentMode && "hover:bg-secondary/10"
                      )}
                    >
                      <span className="text-muted-foreground shrink-0">{getModeIcon(option.mode)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground">{option.label}</span>
                          {option.recommended && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20">
                              <ThumbsUp className="h-2 w-2 mr-0.5" />
                              Best
                            </Badge>
                          )}
                          {isCurrentMode && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20">
                              <Check className="h-2 w-2 mr-0.5" />
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> {option.duration}
                          </span>
                          <span className="font-medium text-foreground">{option.estimatedCost}</span>
                          {option.costPerPerson && (
                            <span className="text-muted-foreground">({option.costPerPerson})</span>
                          )}
                        </div>
                      </div>
                      <span className="text-muted-foreground/40 shrink-0">
                        {isDetailExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </span>
                    </button>

                    {/* Level 2: Route details — expanded on tap */}
                    <AnimatePresence>
                      {isDetailExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/30">
                            {/* Step-by-step route from Google Maps Directions */}
                            {loadingRouteId === option.id && (
                              <div className="flex items-center gap-2 py-2">
                                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                <span className="text-[11px] text-muted-foreground">Loading route details...</span>
                              </div>
                            )}

                            {routeDetailsCache[option.id]?.steps && routeDetailsCache[option.id]!.steps.length > 0 ? (() => {
                              const MAX_INLINE_STEPS = 5;
                              const steps = routeDetailsCache[option.id]!.steps;
                              const showAll = showAllStepsFor === option.id;
                              const visibleSteps = showAll ? steps : steps.slice(0, MAX_INLINE_STEPS);
                              const hiddenCount = steps.length - MAX_INLINE_STEPS;

                              return (
                              <div className="space-y-1.5">
                                {routeDetailsCache[option.id]!.summary && (
                                  <p className="text-[11px] font-medium text-foreground">{routeDetailsCache[option.id]!.summary}</p>
                                )}
                                {routeDetailsCache[option.id]!.totalDuration && (
                                  <p className="text-[10px] text-muted-foreground">
                                    {routeDetailsCache[option.id]!.totalDuration} · {routeDetailsCache[option.id]!.totalDistance}
                                  </p>
                                )}
                                {visibleSteps.map((step, idx) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold shrink-0 mt-0.5">
                                      {idx + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] text-foreground/90 leading-snug">{step.instruction}</p>
                                      {step.transitDetails && (
                                        <div className="flex items-center gap-1 mt-0.5 text-[10px] bg-secondary/40 rounded px-1.5 py-0.5 w-fit">
                                          <Train className="h-2.5 w-2.5 text-primary shrink-0" />
                                          <span className="font-medium text-foreground">{step.transitDetails.lineName}</span>
                                          <span className="text-muted-foreground">
                                            {step.transitDetails.departureStop} → {step.transitDetails.arrivalStop}
                                            {step.transitDetails.numStops > 0 && ` (${step.transitDetails.numStops} stop${step.transitDetails.numStops > 1 ? 's' : ''})`}
                                          </span>
                                        </div>
                                      )}
                                      {step.distance && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{step.distance} · {step.duration}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {hiddenCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowAllStepsFor(showAll ? null : option.id);
                                    }}
                                    className="text-xs text-primary hover:text-primary/80 font-medium pt-1"
                                  >
                                    {showAll ? 'Show fewer steps' : `+ ${hiddenCount} more step${hiddenCount > 1 ? 's' : ''}`}
                                  </button>
                                )}
                              </div>
                              );
                            })() : loadingRouteId !== option.id ? (
                              /* Fallback to generic route from airport-transfers */
                              <>
                                {option.route && (
                                  <div className="text-xs text-foreground/80">
                                    <span className="font-medium text-foreground">Route: </span>
                                    {option.route}
                                  </div>
                                )}
                                {option.trainLine && (
                                  <div className="flex items-center gap-1.5 text-xs text-foreground/80 bg-secondary/30 rounded px-2 py-1">
                                    <Train className="h-3 w-3 text-primary shrink-0" />
                                    Take the <span className="font-medium">{option.trainLine}</span>
                                  </div>
                                )}
                              </>
                            ) : null}

                            {/* Pros */}
                            {option.pros && option.pros.length > 0 && (
                              <div className="space-y-1">
                                {option.pros.map((pro, i) => (
                                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-green-700 dark:text-green-400">
                                    <ThumbsUp className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                                    <span>{pro}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Cons */}
                            {option.cons && option.cons.length > 0 && (
                              <div className="space-y-1">
                                {option.cons.map((con, i) => (
                                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                                    <ThumbsDown className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                                    <span>{con}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Notes */}
                            {option.notes && (
                              <p className="text-[10px] text-muted-foreground italic">{option.notes}</p>
                            )}

                            {/* Booking tip */}
                            {option.bookingTip && (
                              <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-secondary/20 rounded px-2 py-1.5">
                                <Info className="h-3 w-3 shrink-0 mt-0.5" />
                                <span><span className="font-medium">Tip:</span> {option.bookingTip}</span>
                              </div>
                            )}

                            {/* Select button */}
                            {!isCurrentMode && isEditable && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectOption(option);
                                }}
                                className="w-full text-xs font-medium text-primary hover:text-primary/80 py-2 rounded-lg border border-primary/20 hover:bg-primary/5 transition-colors mt-1"
                              >
                                Switch to {option.label}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* No options */}
              {!isLoading && hasFetched && options.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3 italic">
                  No alternative transport options available for this route.
                </p>
              )}

              {/* Collapse */}
              <button
                onClick={() => setIsExpanded(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground w-full text-center py-1 transition-colors"
              >
                Collapse
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
