/**
 * BudgetCoach — AI-powered cost-cutting suggestions panel.
 *
 * When the user's itinerary exceeds their budget target this component
 * fetches swap suggestions from the budget-coach edge function and
 * renders them with one-tap "Apply" buttons.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Scissors,
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Sparkles,
  Lock,
  X,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────
export interface BudgetSuggestion {
  current_item: string;
  current_cost: number; // cents
  suggested_swap: string;
  new_cost: number; // cents
  savings: number; // cents
  reason: string;
  suggested_description?: string; // experience-focused description of the replacement
  day_number: number;
  activity_id: string;
}

interface ItineraryActivity {
  id: string;
  title?: string;
  name?: string;
  category?: string;
  type?: string;
  cost?: { amount: number; currency: string } | number;
  description?: string;
  isLocked?: boolean;
}

interface ItineraryDay {
  dayNumber: number;
  date?: string;
  activities: ItineraryActivity[];
}

interface BudgetCoachProps {
  tripId: string;
  budgetTargetCents: number;
  currentTotalCents: number;
  currency: string;
  destination?: string;
  itineraryDays: ItineraryDay[];
  /** Number of travelers — used to scale per-person savings to group totals for display */
  travelers?: number;
  /** Called when the user applies a suggestion — parent must update the itinerary. Returns true if swap succeeded. */
  onApplySuggestion?: (suggestion: BudgetSuggestion) => Promise<boolean> | void;
  /**
   * User-protected category labels (one of CATEGORY_GROUP_LABELS). Items in
   * these categories are removed from the coach prompt entirely.
   */
  protectedCategories?: string[];
  /** Persist a change to protectedCategories (writes back to trip settings). */
  onProtectedCategoriesChange?: (next: string[]) => void;
  className?: string;
}

/**
 * User-facing category labels and the keywords each one matches against the
 * raw `category` / `type` strings on activities. Keep in lockstep with the
 * server's CATEGORY_GROUPS map in supabase/functions/budget-coach/index.ts.
 */
export const CATEGORY_GROUPS: Record<string, string[]> = {
  Dining: ['dining', 'breakfast', 'lunch', 'dinner', 'brunch', 'cafe', 'café', 'coffee', 'food', 'restaurant', 'meal', 'nightcap', 'drinks', 'bar'],
  Hotels: ['hotel', 'accommodation', 'lodging', 'stay', 'resort', 'check-in', 'check-out', 'bag-drop'],
  Tours: ['tour', 'guided_tour', 'guided tour', 'experience', 'attraction', 'excursion'],
  Transit: ['transit', 'transport', 'transportation', 'taxi', 'train', 'flight', 'transfer', 'metro', 'subway'],
  Activities: ['activity', 'sightseeing', 'museum', 'gallery', 'culture', 'wellness', 'shopping', 'park', 'landmark'],
};
export const CATEGORY_GROUP_LABELS = Object.keys(CATEGORY_GROUPS);

/**
 * Seed default protections from a trip's DNA / archetype tags. Called by
 * BudgetTab on first render when `coach_protected_categories` is null.
 */
export function seedProtectedCategoriesFromDna(dnaTokens: string[]): string[] {
  const tokens = dnaTokens.map((t) => (t || '').toLowerCase());
  const has = (...needles: string[]) =>
    tokens.some((t) => needles.some((n) => t.includes(n)));
  const out = new Set<string>();
  if (has('gourmand', 'food', 'culinary', 'michelin', 'luminary')) out.add('Dining');
  if (has('luxe', 'luxury', 'palace')) {
    out.add('Hotels');
    out.add('Dining');
  }
  if (has('cultural', 'museums-first', 'museum-first')) out.add('Tours');
  return Array.from(out);
}

// Simple in-memory cache keyed by tripId
const suggestionsCache = new Map<
  string,
  { suggestions: BudgetSuggestion[]; itineraryHash: string; ts: number }
>();

function hashItinerary(days: ItineraryDay[]): string {
  // Content-based hash including costs and titles so we invalidate on edits/swaps
  return days
    .map(
      (d) =>
        `${d.dayNumber}:${d.activities.map((a) => {
          const costVal = typeof a.cost === 'number' ? a.cost : (a.cost as any)?.amount ?? 0;
          return `${a.id}|${a.title || ''}|${costVal}`;
        }).join(',')}`
    )
    .join('|');
}

// ─── Component ──────────────────────────────────────────────────
export function BudgetCoach({
  tripId,
  budgetTargetCents,
  currentTotalCents,
  currency,
  destination,
  itineraryDays,
  travelers = 1,
  onApplySuggestion,
  protectedCategories = [],
  onProtectedCategoriesChange,
  className,
}: BudgetCoachProps) {
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProtected, setAllProtected] = useState(false);
  const fetchedRef = useRef(false);

  // Dismissed activity IDs — persisted in localStorage so they survive
  // page reloads but are device-local (no DB round-trip needed).
  const dismissedStorageKey = `budget-coach:dismissed:${tripId}`;
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(dismissedStorageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const persistDismissed = useCallback(
    (next: string[]) => {
      setDismissedIds(next);
      try {
        window.localStorage.setItem(dismissedStorageKey, JSON.stringify(next));
      } catch {
        /* quota or private mode — ignore */
      }
    },
    [dismissedStorageKey]
  );

  const gapCents = currentTotalCents - budgetTargetCents;
  const isOverBudget = gapCents > 0;

  const formatCurrency = useCallback(
    (cents: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(cents / 100);
    },
    [currency]
  );

  // Collect locked activity IDs so we can filter suggestions targeting them
  const lockedActivityIds = new Set(
    itineraryDays.flatMap(d => d.activities.filter(a => a.isLocked).map(a => a.id))
  );

  // Build the payload activities in the format the edge function expects
  // Exclude locked activities — they should not be suggested for swaps
  const buildPayloadDays = useCallback(() => {
    return itineraryDays.map((day) => ({
      dayNumber: day.dayNumber,
      date: day.date,
      activities: day.activities
        .filter((a) => !a.isLocked)
        .map((a) => {
          let costCents = 0;
          if (typeof a.cost === 'number' && Number.isFinite(a.cost)) {
            costCents = Math.max(0, Math.round(a.cost * 100));
          } else if (a.cost && typeof a.cost === 'object' && Number.isFinite(a.cost.amount)) {
            costCents = Math.max(0, Math.round(a.cost.amount * 100));
          }
          return {
            id: a.id,
            title: a.title || a.name || 'Activity',
            category: a.category || a.type || 'activity',
            cost: costCents,
            currency,
            day_number: day.dayNumber,
            description: a.description,
          };
        }),
    }));
  }, [itineraryDays, currency]);

  const fetchSuggestions = useCallback(
    async (force = false) => {
      if (!isOverBudget) return;

      // Cache key includes protections + dismissals so toggling either
      // invalidates stale results.
      const protectionsKey = [...protectedCategories].sort().join(',');
      const dismissedKey = [...dismissedIds].sort().join(',');
      const currentHash = `${hashItinerary(itineraryDays)}::p=${protectionsKey}::d=${dismissedKey}`;
      const cached = suggestionsCache.get(tripId);
      if (
        !force &&
        cached &&
        cached.itineraryHash === currentHash &&
        Date.now() - cached.ts < 5 * 60 * 1000 // 5min TTL
      ) {
        setSuggestions(cached.suggestions);
        setAllProtected(cached.suggestions.length === 0 && protectedCategories.length > 0);
        return;
      }

      setIsLoading(true);
      setError(null);
      setAllProtected(false);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          'budget-coach',
          {
            body: {
              itinerary_days: buildPayloadDays(),
              budget_target_cents: budgetTargetCents,
              current_total_cents: currentTotalCents,
              currency,
              destination,
              protected_categories: protectedCategories,
              dismissed_activity_ids: dismissedIds,
            },
          }
        );

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        const fetched: BudgetSuggestion[] = data?.suggestions || [];
        setSuggestions(fetched);
        setAllProtected(Boolean(data?.all_protected));
        suggestionsCache.set(tripId, {
          suggestions: fetched,
          itineraryHash: currentHash,
          ts: Date.now(),
        });
      } catch (e: any) {
        console.error('[BudgetCoach] fetch error:', e);
        setError(e?.message || 'Failed to load suggestions');
        toast.error('Failed to load budget suggestions');
      } finally {
        setIsLoading(false);
      }
    },
    [
      isOverBudget,
      tripId,
      itineraryDays,
      buildPayloadDays,
      budgetTargetCents,
      currentTotalCents,
      currency,
      destination,
      protectedCategories,
      dismissedIds,
    ]
  );

  // Auto-fetch on mount if over budget
  useEffect(() => {
    if (isOverBudget && !fetchedRef.current && itineraryDays.length > 0) {
      fetchedRef.current = true;
      fetchSuggestions();
    }
  }, [isOverBudget, itineraryDays.length, fetchSuggestions]);

  // Re-fetch when protections or dismissals change (after the initial fetch).
  const protectionsKey = protectedCategories.join('|');
  const dismissedKey = dismissedIds.join('|');
  useEffect(() => {
    if (fetchedRef.current && isOverBudget) {
      fetchSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protectionsKey, dismissedKey]);

  const toggleProtected = useCallback(
    (label: string) => {
      const next = protectedCategories.includes(label)
        ? protectedCategories.filter((l) => l !== label)
        : [...protectedCategories, label];
      onProtectedCategoriesChange?.(next);
    },
    [protectedCategories, onProtectedCategoriesChange]
  );

  const dismissSuggestion = useCallback(
    (activityId: string) => {
      // Remove from view immediately
      setSuggestions((prev) => prev.filter((s) => s.activity_id !== activityId));
      const cached = suggestionsCache.get(tripId);
      if (cached) {
        suggestionsCache.set(tripId, {
          ...cached,
          suggestions: cached.suggestions.filter((s) => s.activity_id !== activityId),
        });
      }
      // Persist for future fetches
      if (!dismissedIds.includes(activityId)) {
        persistDismissed([...dismissedIds, activityId]);
      }
    },
    [tripId, dismissedIds, persistDismissed]
  );

  const clearProtections = useCallback(() => {
    onProtectedCategoriesChange?.([]);
    persistDismissed([]);
  }, [onProtectedCategoriesChange, persistDismissed]);

  // ─── On-target state ──────────────────────────────────────────
  if (!isOverBudget) {
    return (
      <Card className={cn('border-emerald-200 dark:border-emerald-800', className)}>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">On target</span>
            <span className="text-muted-foreground text-sm">
              You're within your {formatCurrency(budgetTargetCents)} budget
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Applied savings calc ─────────────────────────────────────
  const appliedSavings = suggestions
    .filter((s) => appliedIds.has(s.activity_id))
    .reduce((sum, s) => sum + s.savings, 0);

  const remainingGap = gapCents - appliedSavings;
  const totalPotentialSavings = suggestions.reduce((sum, s) => sum + s.savings, 0);
  const isNowOnTarget = remainingGap <= 0;

  const handleApply = async (suggestion: BudgetSuggestion) => {
    // Call parent handler and wait for success/failure
    try {
      const result = await onApplySuggestion?.(suggestion);
      // If the handler explicitly returned false, the swap was blocked
      if (result === false) {
        toast.error('Swap was blocked — the suggested cost was not lower.');
        return;
      }
    } catch (e) {
      toast.error('Swap failed. Please try again.');
      return;
    }

    // Only mark as applied AFTER parent confirmed success
    setAppliedIds((prev) => new Set(prev).add(suggestion.activity_id));

    // Remove applied suggestion from list and cache so it doesn't reappear
    setSuggestions((prev) => prev.filter((s) => s.activity_id !== suggestion.activity_id));
    const cached = suggestionsCache.get(tripId);
    if (cached) {
      suggestionsCache.set(tripId, {
        ...cached,
        suggestions: cached.suggestions.filter((s) => s.activity_id !== suggestion.activity_id),
      });
    }

    if (remainingGap - suggestion.savings <= 0) {
      toast.success("You're on target! Budget balanced.");
    } else {
      toast.success(`Saved ${formatCurrency(suggestion.savings)}`);
    }
  };

  return (
    <Card className={cn('border-primary/30', className)}>
      <CardHeader className="pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            Budget Coach
            {isNowOnTarget && (
              <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400 ml-2">
                ✅ On target
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {!isLoading && suggestions.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  fetchSuggestions(true);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
        {!isNowOnTarget && (
          <p className="text-sm text-muted-foreground mt-1">
            You're {formatCurrency(gapCents)} over budget. Here's how to get on target:
          </p>
        )}
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="space-y-3 pt-0">
              {/* Protected categories chip row */}
              {onProtectedCategoriesChange && (
                <div className="flex items-start gap-2 flex-wrap pb-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 pt-1.5 shrink-0">
                    <Shield className="h-3 w-3" />
                    Don't suggest swaps for:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {CATEGORY_GROUP_LABELS.map((label) => {
                      const active = protectedCategories.includes(label);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleProtected(label)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                            active
                              ? 'bg-primary/10 text-primary border-primary/40'
                              : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                          )}
                          aria-pressed={active}
                        >
                          {active && <Check className="h-3 w-3 inline mr-1" />}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Loading state */}
              {isLoading && (
                <div className="flex items-center justify-center py-8 gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Analyzing your itinerary for savings...
                  </span>
                </div>
              )}

              {/* Error state */}
              {error && !isLoading && (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchSuggestions(true)}
                    className="gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                </div>
              )}

              {/* Suggestions */}
              {!isLoading && !error && suggestions.length > 0 && (
                <>
                  {suggestions.map((s, i) => {
                    const isApplied = appliedIds.has(s.activity_id);
                    const isLocked = lockedActivityIds.has(s.activity_id);
                    // When on target, de-emphasize remaining unapplied instead of hiding
                    const isDeemphasized = isNowOnTarget && !isApplied;

                    return (
                      <motion.div
                        key={`${s.activity_id}-${i}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: isDeemphasized ? 0.5 : 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                          isApplied
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                            : isDeemphasized
                              ? 'bg-muted/50 border-border'
                              : 'bg-card border-border hover:border-primary/30'
                        )}
                      >
                        {/* Number */}
                        <div
                          className={cn(
                            'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                            isApplied
                              ? 'bg-emerald-500 text-white'
                              : 'bg-primary/10 text-primary'
                          )}
                        >
                          {isApplied ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap text-sm">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Scissors className="h-3 w-3" />
                              {s.current_item}
                              <span className="font-medium text-foreground">
                                ({formatCurrency(s.current_cost)}{travelers > 1 ? '/pp' : ''})
                              </span>
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium text-foreground">
                              {s.suggested_swap}
                              <span className="text-primary ml-1">
                                ({formatCurrency(s.new_cost)}{travelers > 1 ? '/pp' : ''})
                              </span>
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{s.reason}</p>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="text-xs text-emerald-600 dark:text-emerald-400"
                            >
                              Save {formatCurrency(s.savings * travelers)}{travelers > 1 ? ` total (${formatCurrency(s.savings)}/pp)` : ''}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              Day {s.day_number}
                            </span>
                          </div>
                        </div>

                        {/* Apply button + dismiss, or locked notice */}
                        {isLocked ? (
                          <span className="flex-shrink-0 flex items-center gap-1 text-xs text-muted-foreground italic">
                            <Lock className="h-3 w-3" />
                            Locked
                          </span>
                        ) : (
                          <div className="flex-shrink-0 flex items-center gap-1">
                            <Button
                              variant={isApplied ? 'ghost' : isDeemphasized ? 'outline' : 'default'}
                              size="sm"
                              disabled={isApplied}
                              onClick={() => handleApply(s)}
                              className={cn(
                                isApplied && 'text-emerald-600 dark:text-emerald-400'
                              )}
                            >
                              {isApplied ? (
                                <>
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  Applied
                                </>
                              ) : (
                                'Apply'
                              )}
                            </Button>
                            {!isApplied && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => dismissSuggestion(s.activity_id)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                aria-label="Don't suggest this swap again"
                                title="Don't suggest this again"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}

                  {/* Running total */}
                  <div
                    className={cn(
                      'p-3 rounded-lg text-sm font-medium flex items-center justify-between',
                      isNowOnTarget
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <span>
                        Total potential savings: {formatCurrency(totalPotentialSavings)}
                      </span>
                    </div>
                    {isNowOnTarget ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        You're on target!
                      </span>
                    ) : appliedSavings > 0 ? (
                      <span>
                        Applied: {formatCurrency(appliedSavings)}, still{' '}
                        {formatCurrency(remainingGap)} over
                      </span>
                    ) : totalPotentialSavings >= gapCents ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ✅ Enough to hit your budget!
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">
                        Still {formatCurrency(gapCents - totalPotentialSavings)} over.
                        {' '}Consider removing activities or adjusting budget to {formatCurrency(currentTotalCents - totalPotentialSavings)}.
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* Empty state */}
              {!isLoading && !error && suggestions.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">
                    No suggestions available yet.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={() => fetchSuggestions(true)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Get Suggestions
                  </Button>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default BudgetCoach;
