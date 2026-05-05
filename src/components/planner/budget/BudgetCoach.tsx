/**
 * BudgetCoach — AI-powered cost-cutting suggestions panel.
 *
 * When the user's itinerary exceeds their budget target this component
 * fetches swap suggestions from the budget-coach edge function and
 * renders them with one-tap "Apply" buttons.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  AlertTriangle,
  Trash2,
  CalendarMinus,
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
  /** "swap" (default cheaper replacement), "drop" (remove activity, deep-cuts only), "consolidate" (merge with same-day item). */
  swap_type?: 'swap' | 'drop' | 'consolidate';
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
  /** Persist a bumped budget total (cents). When provided, Coach may surface a one-click "Bump to $Y" CTA. */
  onBumpBudget?: (newTotalCents: number) => Promise<void> | void;
  /** Per-category overruns in cents (planned - allocated). Drives priority + chips. */
  categoryOverruns?: Partial<Record<string, number>>;
  /** Optional: callback to drop the last day from the trip. If absent, the restructuring panel hides this option. */
  onShortenTrip?: () => void | Promise<void>;
  /** Misc reserve allocated cents — when >0 and unused, Coach surfaces an info nudge. */
  miscReserveCents?: number;
  /** Misc cents already logged. When >0, the misc nudge is suppressed. */
  miscUsedCents?: number;
  /** Called when the misc nudge "Add expense" is clicked. */
  onAddMiscExpense?: () => void;
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
  onBumpBudget,
  categoryOverruns,
  onShortenTrip,
  className,
}: BudgetCoachProps) {
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProtected, setAllProtected] = useState(false);
  const [deepCutsMode, setDeepCutsMode] = useState(false);
  const fetchedRef = useRef(false);

  // ⚠️ Hook-order safety: these two hooks must be declared BEFORE any
  // conditional `return` below (e.g. the on-target early return). Otherwise
  // toggling between under/over budget changes the hook count and triggers
  // React error #310, which crashes the entire Budget tab.
  const bumpDismissKey = `budget-coach:bump-dismissed:${tripId}`;
  const [bumpDismissedAtTotal, setBumpDismissedAtTotal] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(bumpDismissKey);
      return raw ? Number(raw) : null;
    } catch { return null; }
  });
  const [isBumping, setIsBumping] = useState(false);

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

  // Anchor activity IDs — drops are forbidden on these. Detection mirrors the
  // luxury-anchor pattern used by the Bump-tier CTA below + Day-1 dinner rule
  // (see mem://features/itinerary/grand-entrance-dinner).
  const ANCHOR_LUXURY_RE = /michelin|plaza athénée|plaza athenee|ritz|le bristol|four seasons|wine tasting|tasting menu|caviar|george v|le meurice|cheval blanc|mandarin oriental|chef.s table/i;
  const anchorActivityIds = useMemo(() => {
    const ids: string[] = [];
    for (const day of itineraryDays) {
      const isDay1 = day.dayNumber === 1;
      for (const a of day.activities) {
        const haystack = `${a.title || a.name || ''} ${a.description || ''}`;
        const cat = `${a.category || ''} ${a.type || ''}`.toLowerCase();
        const isDinner = /dinner/.test(haystack) || cat.includes('dinner');
        if (ANCHOR_LUXURY_RE.test(haystack)) ids.push(a.id);
        else if (isDay1 && isDinner) ids.push(a.id);
      }
    }
    return ids;
  }, [itineraryDays]);

  // Build the payload activities in the format the edge function expects
  // Exclude locked activities — they should not be suggested for swaps
  const buildPayloadDays = useCallback(() => {
    // Reject placeholder/generic titles that the coach cannot meaningfully swap
    // (e.g. "Dinner (Day 2)", "transport (Day 2)", "Activity"). Targeting these
    // produces phantom suggestions because the AI has nothing concrete to anchor to.
    const GENERIC_TITLE_RE = /^(breakfast|lunch|dinner|brunch|meal|activity|activities|transport|transit|hotel|accommodation|untitled)\s*(\(|-|–|—|$)/i;
    const isGenericTitle = (t?: string) => {
      const s = (t || '').trim();
      if (!s) return true;
      if (/^(activity|untitled|tbd|n\/a)$/i.test(s)) return true;
      return GENERIC_TITLE_RE.test(s);
    };
    return itineraryDays.map((day) => ({
      dayNumber: day.dayNumber,
      date: day.date,
      activities: day.activities
        .filter((a) => !a.isLocked)
        .filter((a) => !isGenericTitle(a.title || a.name))
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

  // Tracks the itinerary hash of the LATEST in-flight request. If the
  // itinerary changes again before this request resolves, the response is
  // discarded — preventing a stale list from briefly overwriting fresh state.
  const inFlightHashRef = useRef<string | null>(null);

  const fetchSuggestions = useCallback(
    async (force = false) => {
      if (!isOverBudget) return;

      // Cache key includes protections + dismissals so toggling either
      // invalidates stale results.
      const protectionsKey = [...protectedCategories].sort().join(',');
      const dismissedKey = [...dismissedIds].sort().join(',');
      const liveHash = hashItinerary(itineraryDays);
      const currentHash = `${liveHash}::p=${protectionsKey}::d=${dismissedKey}`;
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
      inFlightHashRef.current = currentHash;

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
              category_overruns: categoryOverruns || {},
              anchor_activity_ids: anchorActivityIds,
              deep_cuts_requested:
                gapCents > currentTotalCents * 0.25 || gapCents > 1500_00,
            },
          }
        );

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        // RACE GUARD: if the live itinerary changed while this request was in
        // flight, drop the response — a newer fetch is or will be running.
        const liveNowHash = hashItinerary(itineraryDays);
        if (liveNowHash !== liveHash || inFlightHashRef.current !== currentHash) {
          console.log('[BudgetCoach] Discarding stale response — itinerary changed mid-flight');
          return;
        }

        const fetched: BudgetSuggestion[] = data?.suggestions || [];
        setSuggestions(fetched);
        setAllProtected(Boolean(data?.all_protected));
        setDeepCutsMode(Boolean(data?.deep_cuts_mode));
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
      categoryOverruns,
      anchorActivityIds,
      gapCents,
    ]
  );

  // Auto-fetch on mount if over budget
  useEffect(() => {
    if (isOverBudget && !fetchedRef.current && itineraryDays.length > 0) {
      fetchedRef.current = true;
      fetchSuggestions();
    }
  }, [isOverBudget, itineraryDays.length, fetchSuggestions]);

  // Re-fetch when protections, dismissals, OR live itinerary content change.
  // The itinerary hash captures id+title+cost so any edit/swap/regen invalidates
  // the cached suggestions and forces a fresh fetch — preventing phantom
  // suggestions that point at activities no longer in the live itinerary.
  const protectionsKey = protectedCategories.join('|');
  const dismissedKey = dismissedIds.join('|');
  const itineraryContentHash = useMemo(() => hashItinerary(itineraryDays), [itineraryDays]);
  useEffect(() => {
    if (fetchedRef.current && isOverBudget) {
      // Drop the module-level cache entry so a stale list can't be re-served.
      suggestionsCache.delete(tripId);
      fetchSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protectionsKey, dismissedKey, itineraryContentHash]);

  // Client-side phantom filter: even if the cache has a suggestion whose
  // activity_id was removed or renamed in the live itinerary, never render it.
  const liveActivityTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const day of itineraryDays) {
      for (const a of day.activities) {
        m.set(a.id, (a.title || a.name || '').trim());
      }
    }
    return m;
  }, [itineraryDays]);

  const SUGG_TITLE_STOPWORDS = new Set([
    'dinner','lunch','breakfast','brunch','meal','snack','drinks',
    'activity','activities','transport','transit','taxi','metro',
    'hotel','accommodation','stay','checkin','checkout',
    'day','evening','morning','afternoon','night',
    'restaurant','cafe','café','bar','tour','visit','at','the','a','an','of',
  ]);
  const normalizeTitle = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tokensOf = (s: string) =>
    new Set(normalizeTitle(s).split(' ').filter(t => t.length >= 4 && !SUGG_TITLE_STOPWORDS.has(t)));
  const titlesMatch = (claimed: string, real: string): boolean => {
    const c = normalizeTitle(claimed);
    const r = normalizeTitle(real);
    if (!c || !r) return false;
    const shorter = c.length <= r.length ? c : r;
    const longer = shorter === c ? r : c;
    if (shorter.length >= 8 && longer.includes(shorter)) return true;
    const ct = tokensOf(claimed);
    const rt = tokensOf(real);
    if (ct.size === 0 || rt.size === 0) return false;
    let overlap = 0;
    for (const t of ct) if (rt.has(t)) overlap++;
    return overlap >= 1;
  };

  const visibleSuggestions = useMemo(() => {
    return suggestions.filter(s => {
      const realTitle = liveActivityTitleById.get(s.activity_id);
      if (!realTitle) return false; // activity no longer in itinerary
      // If the suggestion's current_item doesn't match the live title, it's
      // pointing at an old version of that slot — drop it.
      if (s.current_item && !titlesMatch(s.current_item, realTitle)) return false;
      return true;
    });
  }, [suggestions, liveActivityTitleById]);

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

  // ─── Applied savings calc (use phantom-filtered list) ─────────
  const appliedSavings = visibleSuggestions
    .filter((s) => appliedIds.has(s.activity_id))
    .reduce((sum, s) => sum + s.savings, 0);

  const remainingGap = gapCents - appliedSavings;
  const totalPotentialSavings = visibleSuggestions.reduce((sum, s) => sum + s.savings, 0);
  const isNowOnTarget = remainingGap <= 0;

  // ─── "Bump tier" CTA — when the user's plan has clearly outgrown the preset ──
  // Three signals must all fire so we don't nag on minor overruns:
  //   1) Total is >10% over budget (real overrun, not noise).
  //   2) Food share of total ≥ 45% (the "Splurge-Forward picked, Michelin booked" pattern).
  //   3) At least one luxury anchor is present (Michelin, palace hotel, tasting menu, etc.).
  const LUXURY_ANCHOR_RE = /michelin|plaza athénée|plaza athenee|ritz|le bristol|four seasons|wine tasting|tasting menu|caviar|george v|le meurice|cheval blanc|mandarin oriental/i;
  const DINING_KEYWORDS = CATEGORY_GROUPS.Dining;
  const isDining = (a: ItineraryActivity) => {
    const haystack = `${a.category || ''} ${a.type || ''}`.toLowerCase();
    return DINING_KEYWORDS.some((k) => haystack.includes(k));
  };
  const activityCostCents = (a: ItineraryActivity): number => {
    const v = typeof a.cost === 'number' ? a.cost : (a.cost as any)?.amount ?? 0;
    return Math.round((v || 0) * 100);
  };
  const allActivities = itineraryDays.flatMap((d) => d.activities);
  const foodCents = allActivities.filter(isDining).reduce((s, a) => s + activityCostCents(a), 0);
  const foodSharePct = currentTotalCents > 0 ? (foodCents / currentTotalCents) * 100 : 0;
  const hasLuxuryAnchor = allActivities.some((a) => LUXURY_ANCHOR_RE.test(`${a.title || a.name || ''} ${a.description || ''}`));
  const isMaterialOverrun = budgetTargetCents > 0 && currentTotalCents > budgetTargetCents * 1.10;
  const bumpTargetCents = Math.ceil((currentTotalCents * 1.05) / 50000) * 50000; // round up to nearest $500

  // Dismissal — local to device, keyed by tripId. Re-shows if overrun deepens by ≥10%.
  // (hooks declared above the early return; see top of component)
  const dismissedRecently = bumpDismissedAtTotal !== null && currentTotalCents <= bumpDismissedAtTotal * 1.10;
  const showBumpCta = !!onBumpBudget && isMaterialOverrun && foodSharePct >= 45 && hasLuxuryAnchor && !dismissedRecently && !isNowOnTarget;

  // ─── Honest restructuring panel ───────────────────────────────
  // When suggested swaps fundamentally can't bridge the gap, surface
  // structural options instead of leaving the user with a passive amber line.
  const coveragePct = gapCents > 0 && totalPotentialSavings > 0
    ? totalPotentialSavings / gapCents
    : 0;
  const restructureBumpTargetCents = Math.ceil((currentTotalCents * 1.02) / 50000) * 50000;
  const showRestructurePanel =
    !isLoading &&
    !isNowOnTarget &&
    !showBumpCta &&
    visibleSuggestions.length > 0 &&
    gapCents > currentTotalCents * 0.10 &&
    coveragePct < 0.5;

  const dismissBump = () => {
    setBumpDismissedAtTotal(currentTotalCents);
    try { window.localStorage.setItem(bumpDismissKey, String(currentTotalCents)); } catch { /* ignore */ }
  };


  const handleBump = async () => {
    if (!onBumpBudget) return;
    setIsBumping(true);
    try {
      await onBumpBudget(bumpTargetCents);
      toast.success(`Budget bumped to ${formatCurrency(bumpTargetCents)}`);
      setBumpDismissedAtTotal(currentTotalCents);
      try { window.localStorage.setItem(bumpDismissKey, String(currentTotalCents)); } catch { /* ignore */ }
    } catch {
      toast.error('Could not update budget. Try again.');
    } finally {
      setIsBumping(false);
    }
  };


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
            {!isLoading && visibleSuggestions.length > 0 && (
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
              {/* "Bump tier" CTA — turn a complaint into an action when the
                  plan has clearly outgrown the preset (food-heavy + luxury anchors). */}
              {showBumpCta && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Your plan is bigger than your preset.</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Food is {Math.round(foodSharePct)}% of total and your trip includes premium anchors.
                        Bump budget to {formatCurrency(bumpTargetCents)} to match your actual plan, or apply the swaps below to fit.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button size="sm" onClick={handleBump} disabled={isBumping}>
                          {isBumping ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                          Bump to {formatCurrency(bumpTargetCents)}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={dismissBump} disabled={isBumping}>
                          Keep budget, swap items
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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

              {/* Overrun chips — surface category-level breaches the model must address */}
              {categoryOverruns && Object.entries(categoryOverruns).filter(([, c]) => (c || 0) > 0).length > 0 && (
                <div className="flex items-start gap-2 flex-wrap pb-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 pt-1.5 shrink-0">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    Over budget:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Object.entries(categoryOverruns)
                      .filter(([, cents]) => (cents || 0) > 0)
                      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                      .map(([label, cents]) => (
                        <span
                          key={label}
                          className="px-2.5 py-1 rounded-full text-xs font-medium border bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        >
                          {label} +{formatCurrency(cents || 0)}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Restructuring panel — when swaps cannot bridge the gap */}
              {showRestructurePanel && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        Swaps alone won't bridge this gap.
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        The swaps below cover only {Math.round(coveragePct * 100)}% of your{' '}
                        {formatCurrency(gapCents)} overrun. To get on target, you'll likely need to:
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-6">
                    {onBumpBudget && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={async () => {
                          try {
                            await onBumpBudget(restructureBumpTargetCents);
                            toast.success(`Budget raised to ${formatCurrency(restructureBumpTargetCents)}`);
                          } catch {
                            toast.error('Could not update budget.');
                          }
                        }}
                      >
                        Raise budget to {formatCurrency(restructureBumpTargetCents)}
                      </Button>
                    )}
                    {deepCutsMode && visibleSuggestions.some((s) => s.swap_type === 'drop') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const el = document.getElementById('budget-coach-suggestions');
                          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Drop optional activities
                      </Button>
                    )}
                    {onShortenTrip && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (window.confirm('Shorten the trip by removing the last day? This is reversible.')) {
                            void onShortenTrip();
                          }
                        }}
                        className="gap-1.5"
                      >
                        <CalendarMinus className="h-3.5 w-3.5" />
                        Shorten trip by 1 day
                      </Button>
                    )}
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
              {!isLoading && !error && visibleSuggestions.length > 0 && (
                <div id="budget-coach-suggestions" className="space-y-2">
                  {visibleSuggestions.map((s, i) => {
                    const isApplied = appliedIds.has(s.activity_id);
                    const isLocked = lockedActivityIds.has(s.activity_id);
                    const isDrop = s.swap_type === 'drop';
                    // When on target, de-emphasize remaining unapplied instead of hiding
                    const isDeemphasized = isNowOnTarget && !isApplied;

                    const handleClick = async () => {
                      if (isDrop) {
                        const ok = window.confirm(
                          `Drop "${s.current_item}" from your itinerary?\n\nThis frees the slot and saves ${formatCurrency(s.savings * travelers)}.`
                        );
                        if (!ok) return;
                      }
                      handleApply(s);
                    };

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
                              : isDrop
                                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 hover:border-amber-400'
                                : 'bg-card border-border hover:border-primary/30'
                        )}
                      >
                        {/* Number */}
                        <div
                          className={cn(
                            'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                            isApplied
                              ? 'bg-emerald-500 text-white'
                              : isDrop
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                : 'bg-primary/10 text-primary'
                          )}
                        >
                          {isApplied ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap text-sm">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              {isDrop ? <Trash2 className="h-3 w-3 text-amber-600 dark:text-amber-400" /> : <Scissors className="h-3 w-3" />}
                              {s.current_item}
                              <span className="font-medium text-foreground">
                                ({formatCurrency(s.current_cost)}{travelers > 1 ? '/pp' : ''})
                              </span>
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className={cn('font-medium', isDrop ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}>
                              {isDrop ? 'Drop activity' : s.suggested_swap}
                              {!isDrop && (
                                <span className="text-primary ml-1">
                                  ({formatCurrency(s.new_cost)}{travelers > 1 ? '/pp' : ''})
                                </span>
                              )}
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
                              variant={isApplied ? 'ghost' : isDeemphasized ? 'outline' : isDrop ? 'outline' : 'default'}
                              size="sm"
                              disabled={isApplied}
                              onClick={handleClick}
                              className={cn(
                                isApplied && 'text-emerald-600 dark:text-emerald-400',
                                !isApplied && isDrop && 'border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950/40'
                              )}
                            >
                              {isApplied ? (
                                <>
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  Applied
                                </>
                              ) : isDrop ? (
                                'Drop'
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
                                aria-label="Don't suggest this again"
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
                </div>

              )}

              {/* Empty state */}
              {!isLoading && !error && visibleSuggestions.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  {allProtected || (protectedCategories.length > 0 && dismissedIds.length === 0) ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        All suggestable items are protected. Loosen a category above to see savings, or adjust your budget target.
                      </p>
                      {(protectedCategories.length > 0 || dismissedIds.length > 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={clearProtections}
                        >
                          Clear protections
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        No suggestions available yet.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => fetchSuggestions(true)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Get Suggestions
                      </Button>
                    </>
                  )}
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
