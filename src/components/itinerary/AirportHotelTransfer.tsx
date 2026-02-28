import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Car, Check, ChevronDown, ChevronUp, Clock, Loader2, 
  MapPin, Sparkles, ThumbsUp, ArrowRight, Plane
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// Types
// ============================================================================

export interface TransferOptionData {
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
  recommended?: boolean;
  recommendedFor?: string;
  bookingTip?: string;
}

export interface SelectedTransfer {
  optionId: string;
  mode: string;
  label: string;
  durationMinutes: number;
  estimatedCost: string;
  selectedAt: string;
}

interface AirportHotelTransferProps {
  tripId: string;
  cityId?: string; // For multi-city
  origin: string; // Airport name/code
  destination: string; // Hotel name/address
  city: string;
  airportCode?: string;
  hotelName?: string;
  arrivalTime?: string;
  archetype?: string;
  travelers?: number;
  isReturn?: boolean;
  existingSelection?: SelectedTransfer | null;
  onTransferSelected?: (transfer: SelectedTransfer) => void;
  compact?: boolean; // For ArrivalGamePlan inline view
}

// ============================================================================
// Component
// ============================================================================

export function AirportHotelTransfer({
  tripId,
  cityId,
  origin,
  destination,
  city,
  airportCode,
  hotelName,
  arrivalTime,
  archetype,
  travelers = 2,
  isReturn = false,
  existingSelection,
  onTransferSelected,
  compact = false,
}: AirportHotelTransferProps) {
  const [options, setOptions] = useState<TransferOptionData[]>([]);
  const [aiRecommendation, setAiRecommendation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [selectedId, setSelectedId] = useState<string | null>(existingSelection?.optionId || null);
  const [source, setSource] = useState<string>('');
  const [expandedOption, setExpandedOption] = useState<string | null>(null);

  const fetchTransferOptions = useCallback(async () => {
    if (!city) return;
    setIsLoading(true);
    try {
      const originStr = origin || (airportCode ? `${airportCode} Airport, ${city}` : `${city} Airport`);
      const destStr = destination || (hotelName ? `${hotelName}, ${city}` : city);

      const { data, error } = await supabase.functions.invoke('airport-transfers', {
        body: {
          origin: originStr,
          destination: destStr,
          city,
          airportCode,
          arrivalTime,
          hotelName,
          archetype,
          travelers,
          isReturn,
        },
      });

      if (error) {
        console.error('Transfer options error:', error);
        return;
      }

      if (data?.options) {
        setOptions(data.options);
        setAiRecommendation(data.aiRecommendation || '');
        setSource(data.source || 'estimated');
      }
    } catch (err) {
      console.error('Failed to fetch transfer options:', err);
    } finally {
      setIsLoading(false);
    }
  }, [origin, destination, city, airportCode, arrivalTime, hotelName, archetype, travelers, isReturn]);

  useEffect(() => {
    fetchTransferOptions();
  }, [fetchTransferOptions]);

  const handleSelect = async (option: TransferOptionData) => {
    const transfer: SelectedTransfer = {
      optionId: option.id,
      mode: option.mode,
      label: option.label,
      durationMinutes: option.durationMinutes,
      estimatedCost: option.estimatedCost,
      selectedAt: new Date().toISOString(),
    };

    setSelectedId(option.id);

    // Persist to DB
    const transferField = isReturn ? 'departure_transfer' : 'arrival_transfer';
    let error: any = null;
    if (cityId) {
      const result = await supabase.from('trip_cities').update({ [transferField]: transfer }).eq('id', cityId);
      error = result.error;
    } else if (tripId) {
      const result = await supabase.from('trips').update({ [transferField]: transfer as unknown as Record<string, unknown> }).eq('id', tripId);
      error = result.error;
    }

    if (error) {
      console.error('[AirportHotelTransfer] Failed to save selection:', error);
      setSelectedId(existingSelection?.optionId || null); // rollback
      return;
    }

    onTransferSelected?.(transfer);
  };

  // Compact view for ArrivalGamePlan - just show selected or summary
  if (compact && !isExpanded) {
    const selected = options.find(o => o.id === selectedId);
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full text-left"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <Car className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">
                {isReturn ? 'Getting to the Airport' : 'Getting to Your Hotel'}
              </p>
              {source && source !== 'estimated' && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/20">
                  Live
                </Badge>
              )}
            </div>
            {selected ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs">{selected.icon}</span>
                <span className="text-xs font-medium text-foreground">{selected.label}</span>
                <span className="text-xs text-muted-foreground">· {selected.duration} · {selected.estimatedCost}</span>
                <Check className="h-3 w-3 text-green-500" />
              </div>
            ) : isLoading ? (
              <div className="flex items-center gap-2 mt-1">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading transfer options...</span>
              </div>
            ) : options.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {options.slice(0, 2).map(opt => (
                  <div key={opt.id} className="text-xs p-2 bg-secondary/50 rounded border border-border">
                    <span className="font-medium">{opt.icon} {opt.label.split('/')[0]}</span>
                    <p className="text-muted-foreground">{opt.duration} · {opt.estimatedCost}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="text-[11px] text-primary mt-1">
              {selected ? 'Tap to change' : 'Tap to see all options & select'}
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className={cn(
      "border border-border bg-card rounded-lg overflow-hidden",
      compact && "border-0 bg-transparent rounded-none"
    )}>
      {/* Header */}
      {!compact && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 bg-secondary/30 border-b border-border hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              {isReturn ? <Plane className="h-5 w-5 text-primary" /> : <Car className="h-5 w-5 text-primary" />}
            </div>
            <div className="text-left">
              <h4 className="font-serif text-base font-medium">
                {isReturn ? 'Getting to the Airport' : 'Getting to Your Hotel'}
              </h4>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span>{isReturn ? (hotelName || 'Hotel') : (airportCode || 'Airport')}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{isReturn ? (airportCode || 'Airport') : (hotelName || 'Hotel')}</span>
                {source && source !== 'estimated' && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/20 ml-1">
                    Live
                  </Badge>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedId && (
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                <Check className="h-3 w-3 mr-1" />
                Selected
              </Badge>
            )}
            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>
      )}

      <AnimatePresence>
        {(isExpanded || compact) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn("space-y-3", compact ? "pt-2" : "p-4")}>
              {isLoading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Finding transfer options...</span>
                </div>
              ) : (
                <>
                  {/* AI Recommendation */}
                  {aiRecommendation && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-primary mb-0.5">AI Recommendation</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{aiRecommendation}</p>
                      </div>
                    </div>
                  )}

                  {/* Transfer Options */}
                  <div className="space-y-2">
                    {options.map((option) => {
                      const isSelected = selectedId === option.id;
                      const isDetailExpanded = expandedOption === option.id;

                      return (
                        <div
                          key={option.id}
                          className={cn(
                            "rounded-lg border transition-all",
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border bg-card hover:border-primary/30",
                            option.recommended && !isSelected && "border-primary/20 bg-primary/[0.02]"
                          )}
                        >
                          {/* Main row */}
                          <div className="flex items-center gap-3 p-3">
                            <span className="text-xl shrink-0">{option.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">{option.label}</span>
                                {option.recommended && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                                    <ThumbsUp className="h-2.5 w-2.5 mr-0.5" />
                                    Recommended
                                  </Badge>
                                )}
                                {isSelected && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {option.duration}
                                </span>
                                <span className="font-medium text-foreground">{option.estimatedCost}</span>
                                {option.costPerPerson && (
                                  <span>({option.costPerPerson})</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => setExpandedOption(isDetailExpanded ? null : option.id)}
                                className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                              >
                                {isDetailExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>
                              <Button
                                size="sm"
                                variant={isSelected ? "default" : "outline"}
                                onClick={() => handleSelect(option)}
                                className="text-xs h-7 px-3"
                              >
                                {isSelected ? 'Selected' : 'Select'}
                              </Button>
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
                                <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2">
                                  {/* Route */}
                                  {option.route && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                      <p className="text-xs text-muted-foreground">{option.route}</p>
                                    </div>
                                  )}
                                  {/* Pros/Cons */}
                                  {(option.pros?.length || option.cons?.length) ? (
                                    <div className="grid grid-cols-2 gap-2">
                                      {option.pros && option.pros.length > 0 && (
                                        <div className="space-y-1">
                                          {option.pros.map((pro, i) => (
                                            <p key={i} className="text-[11px] text-green-600 flex items-start gap-1">
                                              <span className="shrink-0">✓</span>
                                              <span>{pro}</span>
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                      {option.cons && option.cons.length > 0 && (
                                        <div className="space-y-1">
                                          {option.cons.map((con, i) => (
                                            <p key={i} className="text-[11px] text-orange-500 flex items-start gap-1">
                                              <span className="shrink-0">△</span>
                                              <span>{con}</span>
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                  {/* Booking tip */}
                                  {option.bookingTip && (
                                    <p className="text-[11px] text-primary/80 italic">
                                      💡 {option.bookingTip}
                                    </p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>

                  {compact && (
                    <button
                      onClick={() => setIsExpanded(false)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center pt-1"
                    >
                      Collapse
                    </button>
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
