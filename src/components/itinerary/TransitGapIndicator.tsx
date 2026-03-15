/**
 * TransitGapIndicator — Tappable transport row between non-transport activities.
 * Shows estimated travel mode and time, expands to show alternative transport options.
 * Mirrors the TransitModePicker UX so all transit gaps are consistent.
 */

import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Footprints, AlertTriangle, Clock, Train, Car, Bus,
  Navigation2, ChevronDown, ChevronUp, Sparkles, Loader2, Ship,
  ThumbsUp, ThumbsDown, Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

// ─── Types ─────────────────────────────────────────────────────────────

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

interface TransitGapIndicatorProps {
  /** Minutes between end of previous activity and start of next */
  gapMinutes: number;
  /** Transport data from the previous activity (if available from optimization) */
  transportation?: {
    method: string;
    duration: string;
  } | null;
  /** Whether full TransitBadge is already visible (avoid duplication) */
  hasTransitBadge?: boolean;
  /** Category/type of the current (previous) activity */
  currentCategory?: string;
  /** Category/type of the next activity */
  nextCategory?: string;
  /** Whether the two activities share the same location */
  sameLocation?: boolean;
  /** City name for fetching transport options */
  city?: string;
  /** Name/address of previous activity (origin) */
  originName?: string;
  /** Name/address of next activity (destination) */
  destinationName?: string;
  /** Whether this gap is editable (user can expand) */
  isEditable?: boolean;
  /** Currency for displaying costs */
  tripCurrency?: string;
  /** Number of travelers */
  travelers?: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const n = timeStr.trim().toUpperCase();
  const m = n.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/** Compute gap in minutes between two activities by their time strings */
export function computeGapMinutes(
  prevEndTime?: string,
  prevStartTime?: string,
  prevDuration?: string,
  nextStartTime?: string,
): number | null {
  const nextStart = parseTimeToMinutes(nextStartTime);
  if (nextStart === null) return null;

  let prevEnd = parseTimeToMinutes(prevEndTime);
  
  if (prevEnd === null) {
    const prevStart = parseTimeToMinutes(prevStartTime);
    if (prevStart === null) return null;
    
    let durationMin = 60;
    if (prevDuration) {
      const d = prevDuration.toLowerCase();
      const hoursMatch = d.match(/([\d.]+)\s*(?:hours?|hrs?|h)/);
      const minsMatch = d.match(/([\d.]+)\s*(?:minutes?|mins?|m(?!onth))/);
      durationMin = 0;
      if (hoursMatch) durationMin += parseFloat(hoursMatch[1]) * 60;
      if (minsMatch) durationMin += parseFloat(minsMatch[1]);
      if (durationMin === 0) durationMin = 60;
    }
    
    prevEnd = prevStart + durationMin;
  }

  return nextStart - prevEnd;
}

function getModeIcon(mode: string) {
  const m = mode.toLowerCase();
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

function getGapTransportIcon(method?: string, gapMinutes?: number) {
  if (method) {
    const m = method.toLowerCase();
    if (m.includes('metro') || m.includes('train') || m.includes('subway')) return <Train className="h-3.5 w-3.5" />;
    if (m.includes('taxi') || m.includes('uber') || m.includes('car') || m.includes('cab') || m.includes('driv')) return <Car className="h-3.5 w-3.5" />;
    if (m.includes('bus') || m.includes('shuttle')) return <Bus className="h-3.5 w-3.5" />;
    if (m.includes('walk') || m.includes('stroll')) return <Footprints className="h-3.5 w-3.5" />;
  }
  // Infer from gap time
  if (gapMinutes != null && gapMinutes <= 15) return <Footprints className="h-3.5 w-3.5" />;
  return <Car className="h-3.5 w-3.5" />;
}

function getGapTransportLabel(method?: string, gapMinutes?: number): string {
  if (method) {
    const m = method.toLowerCase();
    if (m.includes('metro') || m.includes('subway')) return 'Metro';
    if (m.includes('train')) return 'Train';
    if (m.includes('taxi') || m.includes('cab')) return 'Taxi';
    if (m.includes('uber') || m.includes('rideshare')) return 'Rideshare';
    if (m.includes('bus')) return 'Bus';
    if (m.includes('walk') || m.includes('stroll')) return 'Walk';
    if (m.includes('shuttle')) return 'Shuttle';
    return method;
  }
  if (gapMinutes != null && gapMinutes <= 15) return 'Walk';
  return 'Travel';
}

const TRANSIT_CATEGORIES = ['transit', 'transportation', 'transfer', 'taxi', 'transport', 'commute', 'travel'];

function isTransitCategory(cat?: string): boolean {
  if (!cat) return false;
  const lower = cat.toLowerCase();
  return TRANSIT_CATEGORIES.some(t => lower.includes(t));
}

// ─── Component ─────────────────────────────────────────────────────────

export function TransitGapIndicator({
  gapMinutes,
  transportation,
  hasTransitBadge,
  currentCategory,
  nextCategory,
  sameLocation,
  city,
  originName,
  destinationName,
  isEditable = false,
  tripCurrency = 'USD',
  travelers = 1,
}: TransitGapIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [options, setOptions] = useState<TransportOptionData[]>([]);
  const [aiRecommendation, setAiRecommendation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Compute derived values before any hooks that depend on them
  const eitherIsTransit = isTransitCategory(currentCategory) || isTransitCategory(nextCategory);
  const skipBufferWarning = sameLocation;
  const isZeroGap = !skipBufferWarning && gapMinutes <= 0;
  const isTightGap = !skipBufferWarning && gapMinutes > 0 && gapMinutes < 15;
  const transportMethod = transportation?.method;
  const modeLabel = getGapTransportLabel(transportMethod, gapMinutes);
  const modeIcon = getGapTransportIcon(transportMethod, gapMinutes);
  const durationLabel = transportation?.duration || `${Math.abs(gapMinutes)} min`;
  const canExpand = isEditable && !!city && !!destinationName;
  const shouldHide = hasTransitBadge || eitherIsTransit;

  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);
  const [routeDetailsCache, setRouteDetailsCache] = useState<Record<string, RouteDetails | null>>({});
  const [loadingRouteId, setLoadingRouteId] = useState<string | null>(null);
  const [showAllStepsFor, setShowAllStepsFor] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    if (hasFetched || isLoading || !city || !destinationName) return;
    setIsLoading(true);
    try {
      const origin = originName || city;
      const destination = destinationName + ', ' + city;

      const { data, error } = await supabase.functions.invoke('airport-transfers', {
        body: { origin, destination, city },
      });

      if (!error && data?.options) {
        let filtered = (data.options as TransportOptionData[]);

        // Filter airport-specific options for non-airport routes
        filtered = filtered
          .filter(opt => opt.id !== 'hotel_car')
          .map(opt => {
            if (opt.label === 'Airport Bus / Shuttle') {
              return { ...opt, label: 'Bus / Shuttle' };
            }
            return opt;
          });

        // Add Walk option
        filtered.push({
          id: 'walk',
          mode: 'walk',
          label: 'Walk',
          icon: '🚶',
          duration: 'Varies',
          durationMinutes: 0,
          estimatedCost: 'Free',
          route: `Walk to ${destinationName}`,
          pros: ['Free', 'See the neighborhood up close'],
          cons: ['Weather dependent', 'Not practical for long distances'],
          notes: 'Best for distances under 20 minutes',
        });

        setOptions(filtered);
        setAiRecommendation(data.aiRecommendation || '');

        // Fire-and-forget: fetch real walking data
        if (filtered.some(o => o.id === 'walk')) {
          supabase.functions.invoke('route-details', {
            body: { origin, destination, mode: 'walking' },
          }).then(({ data: walkData }) => {
            if (walkData?.totalDuration && walkData?.totalDistance) {
              setOptions(prev => prev.map(o => {
                if (o.id === 'walk') {
                  return {
                    ...o,
                    duration: walkData.totalDuration,
                    route: `Walk ${walkData.totalDuration} (${walkData.totalDistance})`,
                    notes: `${walkData.totalDistance} walk`,
                  };
                }
                return o;
              }));
            }
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to fetch transit gap options:', err);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [city, destinationName, originName, hasFetched, isLoading]);

  const fetchRouteDetails = useCallback(async (option: TransportOptionData) => {
    if (routeDetailsCache[option.id] !== undefined || loadingRouteId === option.id) return;
    setLoadingRouteId(option.id);
    try {
      const googleMode = option.mode === 'taxi' || option.mode === 'uber' || option.mode === 'rideshare' ? 'driving'
        : option.mode === 'train' || option.mode === 'metro' || option.mode === 'bus' || option.mode === 'transit' ? 'transit'
        : option.mode === 'walk' ? 'walking'
        : 'driving';

      const origin = originName || city;
      const destination = (destinationName || '') + ', ' + city;

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
  }, [routeDetailsCache, loadingRouteId, originName, city, destinationName]);

  const toggleOptionDetail = (optionId: string, option?: TransportOptionData) => {
    const next = expandedOptionId === optionId ? null : optionId;
    setExpandedOptionId(next);
    if (next && option && routeDetailsCache[optionId] === undefined) {
      fetchRouteDetails(option);
    }
  };

  const handleExpand = () => {
    if (!canExpand) return;
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) setExpandedOptionId(null);
    if (next && !hasFetched) fetchOptions();
  };

  // Early returns after all hooks
  if (shouldHide) return null;

  return (
    <div>
      {/* Tappable transit row — styled like TransitModePicker */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2",
          canExpand && "cursor-pointer hover:bg-secondary/20 transition-colors",
        )}
        onClick={handleExpand}
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : undefined}
      >
        {/* Dotted timeline connector */}
        <div className="flex flex-col items-center gap-0.5 shrink-0 text-border">
          <div className="w-px h-2 border-l border-dashed" />
          <div className="w-px h-2 border-l border-dashed" />
        </div>

        {/* Icon */}
        <span className={cn(
          "shrink-0",
          isZeroGap ? "text-destructive" : "text-muted-foreground",
        )}>
          {isZeroGap ? <AlertTriangle className="h-3.5 w-3.5" /> : modeIcon}
        </span>

        {/* Label: method + destination */}
        <span className={cn(
          "text-xs truncate min-w-0",
          isZeroGap ? "text-destructive font-medium" : "text-muted-foreground",
        )}>
          {isZeroGap
            ? 'No travel buffer'
            : destinationName
              ? `${modeLabel} to ${destinationName}`
              : modeLabel
          }
        </span>

        {/* Duration pill */}
        {!isZeroGap && (
          <span className={cn(
            "text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap",
            isTightGap
              ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20"
              : "text-muted-foreground bg-secondary/50",
          )}>
            {durationLabel}{isTightGap ? ' (tight)' : ''}
          </span>
        )}

        {/* Expand indicator */}
        {canExpand && (
          <span className="text-muted-foreground/50 shrink-0 ml-auto">
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        )}
      </div>

      {/* Expanded transport options panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/30"
          >
            <div className="px-4 py-3 space-y-2 bg-secondary/5">
              {/* AI recommendation */}
              {aiRecommendation && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/10 mb-3">
                  <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">
                      AI Recommendation
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{aiRecommendation}</p>
                  </div>
                </div>
              )}

              {/* Loading state */}
              {isLoading && (
                <div className="flex items-center justify-center py-4 gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Finding transport options…</span>
                </div>
              )}

              {/* Options list */}
              {!isLoading && options.map(option => (
                <div
                  key={option.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-background hover:border-primary/30 transition-colors"
                >
                  <span className="text-muted-foreground shrink-0">
                    {getModeIcon(option.mode)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{option.label}</span>
                      {option.recommended && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0">
                          👍 Best
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {option.duration}
                      </span>
                      <span className="font-medium">{option.estimatedCost}</span>
                      {option.costPerPerson && travelers > 1 && (
                        <span className="text-muted-foreground/70">({option.costPerPerson} pp)</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                </div>
              ))}

              {/* Empty state */}
              {!isLoading && hasFetched && options.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  No transport options available for this route.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TransitGapIndicator;
