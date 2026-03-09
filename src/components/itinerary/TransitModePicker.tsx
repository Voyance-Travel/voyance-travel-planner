/**
 * TransitModePicker — Tappable transport row that expands to show
 * alternative transport modes with real Google Maps routing data.
 * Uses the transfer-pricing edge function for option fetching.
 */

import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Car, Train, Bus, Footprints, Navigation2, Clock, ChevronDown, ChevronUp,
  Sparkles, Check, Loader2, Edit3, MoveUp, MoveDown, Trash2, Calendar,
  MoreHorizontal, MapPin, ThumbsUp, Ship, Route,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TransportOptionData {
  id: string;
  mode: string;
  title: string;
  duration: string;
  durationMinutes: number;
  priceTotal: number;
  priceFormatted: string;
  distance?: number;
  notes?: string;
  trainLine?: string;
  isBookable: boolean;
  bookingUrl?: string;
  recommended?: boolean;
  source: string;
  confidence: number;
}

interface GoogleMapsData {
  drivingDuration: string;
  drivingDistance: string;
  transitDuration?: string;
  walkingDuration?: string;
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
  travelers: number;
  transitOrigin: string;
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
  const [googleMapsData, setGoogleMapsData] = useState<GoogleMapsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  const transitDestination = parseTransitDestination(activityTitle);

  const fetchOptions = useCallback(async () => {
    if (hasFetched || isLoading) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('transfer-pricing', {
        body: {
          origin: transitOrigin,
          destination: activity.location?.name || activity.location?.address || activity.venue || transitDestination,
          city,
          travelers: travelers || 2,
          transferType: 'point_to_point',
        },
      });

      if (!error && data?.options) {
        // Filter out airport-specific options for non-airport in-city routes
        const filtered = (data.options as TransportOptionData[]).filter(opt => {
          const t = opt.title.toLowerCase();
          if (t.includes('airport bus') || t.includes('airport shuttle')) return false;
          if (t.includes('hotel car')) return false;
          return true;
        });

        // Mark recommended
        const recommendedId = data.recommendedOption?.id;
        const mapped = filtered.map(opt => ({
          ...opt,
          recommended: opt.id === recommendedId || opt.recommended,
        }));

        setOptions(mapped);
        setGoogleMapsData(data.googleMapsData || null);
      }
    } catch (err) {
      console.error('Failed to fetch transit options:', err);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [city, transitDestination, transitOrigin, activity, travelers, hasFetched, isLoading]);

  const handleExpand = () => {
    if (!isEditable) return;
    const next = !isExpanded;
    setIsExpanded(next);
    if (next && !hasFetched) {
      fetchOptions();
    }
  };

  const handleSelectOption = useCallback(async (option: TransportOptionData) => {
    const shortMode = option.mode === 'walk' ? 'Walk'
      : option.mode === 'taxi' ? 'Taxi'
      : option.mode === 'uber' ? 'Rideshare'
      : option.mode === 'train' || option.mode === 'metro' ? 'Train'
      : option.mode === 'transit' ? 'Transit'
      : option.mode === 'bus' ? 'Bus'
      : option.mode === 'ferry' ? 'Ferry'
      : option.title;

    const newTitle = option.mode === 'walk'
      ? `Walk to ${transitDestination}`
      : `Travel to ${transitDestination} via ${shortMode}`;

    setSelectedMode(option.id);

    try {
      const updatedActivity = {
        ...activity,
        title: newTitle,
        duration: option.duration,
        durationMinutes: option.durationMinutes,
        cost: {
          ...(activity.cost || {}),
          amount: option.priceTotal || 0,
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

  return (
    <div>
      {/* Tappable transit row */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 group/activity",
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
        <span className="text-xs text-muted-foreground truncate min-w-0">
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

        {/* Context menu */}
        {isEditable && !activity.isLocked && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-muted rounded-full transition-colors sm:opacity-0 sm:group-hover/activity:opacity-100 shrink-0 touch-manipulation"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onEdit(dayIndex, activityIndex, activity)} className="cursor-pointer gap-2 text-xs">
                <Edit3 className="h-3 w-3" /> Edit Details
              </DropdownMenuItem>
              {activityIndex > 0 && (
                <DropdownMenuItem onClick={() => onMove(dayIndex, activity.id, 'up')} className="cursor-pointer gap-2 text-xs">
                  <MoveUp className="h-3 w-3" /> Move Up
                </DropdownMenuItem>
              )}
              {activityIndex < totalActivities - 1 && (
                <DropdownMenuItem onClick={() => onMove(dayIndex, activity.id, 'down')} className="cursor-pointer gap-2 text-xs">
                  <MoveDown className="h-3 w-3" /> Move Down
                </DropdownMenuItem>
              )}
              {onMoveToDay && totalDays > 1 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer gap-2 text-xs">
                    <Calendar className="h-3 w-3" /> Move to Day
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {Array.from({ length: totalDays }, (_, d) => d).filter(d => d !== dayIndex).map(d => (
                      <DropdownMenuItem key={d} onClick={() => onMoveToDay!(dayIndex, activity.id, d)} className="text-xs">
                        Day {d + 1}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {onRemove && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onRemove(dayIndex, activity.id)} className="text-destructive text-xs cursor-pointer gap-2">
                    <Trash2 className="h-3 w-3" /> Remove
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
              {/* Google Maps route summary */}
              {googleMapsData && !isLoading && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border/50">
                  <Route className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
                    <span className="font-medium text-foreground">{transitOrigin}</span>
                    <span>→</span>
                    <span className="font-medium text-foreground">{transitDestination}</span>
                    {googleMapsData.drivingDistance && googleMapsData.drivingDistance !== 'N/A' && (
                      <span className="text-muted-foreground">· {googleMapsData.drivingDistance}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Loading */}
              {isLoading && (
                <div className="flex items-center justify-center py-6 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Finding real routes...</span>
                </div>
              )}

              {/* Options list */}
              {!isLoading && options.map((option) => {
                const isCurrentMode = activityTitle.toLowerCase().includes(option.mode.toLowerCase()) ||
                  activityTitle.toLowerCase().includes(option.title.toLowerCase().split(' ')[0]);
                const isWalking = option.mode === 'walk' || option.mode === 'walking';

                return (
                  <div
                    key={option.id}
                    className={cn(
                      "rounded-lg border transition-all",
                      isCurrentMode
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-card hover:border-primary/30",
                      option.recommended && !isCurrentMode && "border-primary/20 bg-primary/[0.02]"
                    )}
                  >
                    <div className="flex items-center gap-2.5 p-2.5">
                      <span className="text-muted-foreground shrink-0">{getModeIcon(option.mode)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground">{option.title}</span>
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
                          <span className="font-medium text-foreground">{option.priceFormatted}</span>
                          {option.distance && (
                            <span>{option.distance} km</span>
                          )}
                        </div>
                        {/* Notes / train line */}
                        {option.trainLine && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">Line: {option.trainLine}</p>
                        )}
                        {option.notes && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{option.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isCurrentMode && isEditable && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); handleSelectOption(option); }}
                            className="text-[11px] h-6 px-2"
                          >
                            Select
                          </Button>
                        )}
                        {option.isBookable && option.bookingUrl && (
                          <a
                            href={option.bookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-primary hover:underline px-1"
                          >
                            Book
                          </a>
                        )}
                      </div>
                    </div>
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
