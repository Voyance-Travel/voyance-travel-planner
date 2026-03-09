/**
 * TransitModePicker — Tappable transport row that expands to show
 * alternative transport modes with AI recommendation.
 * Reuses the airport-transfers edge function for option fetching.
 */

import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Car, Train, Bus, Footprints, Navigation2, Clock, ChevronDown, ChevronUp,
  Sparkles, Check, Loader2, Edit3, MoveUp, MoveDown, Trash2, Calendar,
  MoreHorizontal, MapPin, ThumbsUp, Ship,
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
  recommended?: boolean;
  bookingTip?: string;
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
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  const transitDestination = parseTransitDestination(activityTitle);

  const fetchOptions = useCallback(async () => {
    if (hasFetched || isLoading) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('airport-transfers', {
        body: {
          origin: activity.venue || activity.address || city,
          destination: transitDestination,
          city,
        },
      });

      if (!error && data?.options) {
        setOptions(data.options);
        setAiRecommendation(data.aiRecommendation || '');
      }
    } catch (err) {
      console.error('Failed to fetch transit options:', err);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [city, transitDestination, activity.venue, activity.address, hasFetched, isLoading]);

  const handleExpand = () => {
    if (!isEditable) return;
    const next = !isExpanded;
    setIsExpanded(next);
    if (next && !hasFetched) {
      fetchOptions();
    }
  };

  const handleSelectOption = useCallback(async (option: TransportOptionData) => {
    const newTitle = `Travel to ${transitDestination} via ${option.label}`;
    setSelectedMode(option.id);

    try {
      // Update the activity in the itinerary_data JSON on the trips table
      // We need to update via the parent's refetch mechanism
      // For now, use the edit callback to update in-memory + persist
      const updatedActivity = {
        ...activity,
        title: newTitle,
        duration: option.duration,
        durationMinutes: option.durationMinutes,
        cost: {
          ...(activity.cost || {}),
          amount: parseFloat(option.estimatedCost.replace(/[^0-9.]/g, '')) || 0,
        },
      };

      // Call edit handler which persists the change
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
              {/* AI Recommendation */}
              {aiRecommendation && !isLoading && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-medium text-primary">AI Recommendation</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{aiRecommendation}</p>
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

              {/* Options list */}
              {!isLoading && options.map((option) => {
                const isCurrentMode = activityTitle.toLowerCase().includes(option.mode.toLowerCase()) ||
                  activityTitle.toLowerCase().includes(option.label.toLowerCase());
                const isDetailExpanded = expandedOption === option.id;

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
                      <span className="text-lg shrink-0">{option.icon}</span>
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
                            <span>({option.costPerPerson})</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(option.route || option.pros?.length || option.cons?.length || option.bookingTip) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedOption(isDetailExpanded ? null : option.id); }}
                            className="p-1 rounded hover:bg-secondary transition-colors"
                          >
                            {isDetailExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        )}
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
                      </div>
                    </div>

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isDetailExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="px-2.5 pb-2.5 pt-1 border-t border-border/50 space-y-1.5">
                            {option.route && (
                              <div className="flex items-start gap-1.5">
                                <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0 mt-0.5" />
                                <p className="text-[10px] text-muted-foreground">{option.route}</p>
                              </div>
                            )}
                            {(option.pros?.length || option.cons?.length) ? (
                              <div className="grid grid-cols-2 gap-1.5">
                                {option.pros?.map((pro, i) => (
                                  <p key={`p${i}`} className="text-[10px] text-green-600 flex items-start gap-0.5">
                                    <span className="shrink-0">✓</span><span>{pro}</span>
                                  </p>
                                ))}
                                {option.cons?.map((con, i) => (
                                  <p key={`c${i}`} className="text-[10px] text-orange-500 flex items-start gap-0.5">
                                    <span className="shrink-0">△</span><span>{con}</span>
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            {option.bookingTip && (
                              <p className="text-[10px] text-primary/80 italic">💡 {option.bookingTip}</p>
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
