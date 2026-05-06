/**
 * Budget Tab - Dedicated budget management view
 * 
 * Features:
 * - Total budget setup with per-person/total toggle
 * - Category allocation sliders
 * - Expense ledger with committed vs planned
 * - Day-by-day budget breakdown
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  Settings,
  TrendingUp,
  TrendingDown,
  PieChart,
  Calendar,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Wallet,
  Utensils,
  Camera,
  Car,
  Sparkles,
  Plane,
  Hotel,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTripBudget } from '@/hooks/useTripBudget';
import { JourneyBudgetSummary } from './JourneyBudgetSummary';
import { BudgetSetupDialog } from './BudgetSetupDialog';
import { BudgetWarning } from './BudgetWarning';
import { BudgetCoach, type BudgetSuggestion } from './BudgetCoach';
import { hasSuggestableContent } from './coachUtils';
import { useTripMembers } from '@/services/tripBudgetAPI';
import { useTripCollaborators } from '@/services/tripCollaboratorsAPI';
import type { BudgetCategory } from '@/services/tripBudgetService';
import { getCityBudgetBreakdown } from '@/services/tripBudgetService';
import { getTripPayments, type TripPayment } from '@/services/tripPaymentsAPI';
import { useTripFinancialSnapshot } from '@/hooks/useTripFinancialSnapshot';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { rateDisclosure } from '@/lib/currency';
import { assessBudgetFit, formatMultiplier } from '@/lib/budget-realism';
import { supabase } from '@/integrations/supabase/client';
import { usePayableItems, type PayableItem } from '@/hooks/usePayableItems';
import { toast } from 'sonner';
import { applyRaiseBudget } from './raiseBudgetApply';

interface ItineraryActivity {
  id: string;
  title?: string;
  name?: string;
  category?: string;
  type?: string;
  cost?: { amount: number; currency: string } | number;
}

interface ItineraryDay {
  dayNumber: number;
  date?: string;
  activities: ItineraryActivity[];
}

interface BudgetTabProps {
  tripId: string;
  travelers: number;
  totalDays: number;
  /** Pass itinerary days to auto-sync planned costs to budget ledger */
  itineraryDays?: ItineraryDay[];
  /** Called when a planned budget entry is removed so the linked activity can be removed from the itinerary */
  onActivityRemove?: (activityId: string, displayName?: string) => void;
  /** Called when the Budget Coach applies a swap suggestion */
  onApplyBudgetSwap?: (suggestion: BudgetSuggestion) => void;
  /** Whether hotel selection exists */
  hasHotel?: boolean;
  /** Whether flight selection exists */
  hasFlight?: boolean;
  /** Trip destination for AI context */
  destination?: string;
  /** Destination country for cost estimation */
  destinationCountry?: string;
  /** Budget tier for cost estimation */
  budgetTier?: string;
  /** Flight selection data for payable items calculation */
  flightSelection?: {
    outbound?: { price?: number; airline?: string };
    return?: { price?: number; airline?: string };
    totalPrice?: number;
  } | null;
  /** Hotel selection data for payable items calculation */
  hotelSelection?: {
    name?: string;
    totalPrice?: number;
    pricePerNight?: number;
  } | null;
  /** Journey fields for linked trip budget summary */
  journeyId?: string | null;
  journeyName?: string | null;
  /** Manual builder mode — skip auto-calculated expenses */
  isManualMode?: boolean;
  /** Trip generation status — used to surface failed/empty states */
  tripStatus?: string | null;
  /** Reason from trip metadata when generation failed */
  generationFailureReason?: string | null;
  /** Trigger a fresh itinerary regeneration (used in failed/empty banner CTA) */
  onRegenerate?: () => void;
}

const categoryIcons: Record<BudgetCategory, React.ReactNode> = {
  hotel: <Hotel className="h-4 w-4" />,
  flight: <Plane className="h-4 w-4" />,
  food: <Utensils className="h-4 w-4" />,
  activities: <Camera className="h-4 w-4" />,
  transit: <Car className="h-4 w-4" />,
  misc: <Sparkles className="h-4 w-4" />,
};

const categoryLabels: Record<BudgetCategory, string> = {
  hotel: 'Accommodation',
  flight: 'Flights',
  food: 'Food & Dining',
  activities: 'Activities',
  transit: 'Local Transit',
  misc: 'Spending Money & Tips',
};

const categoryColors: Record<BudgetCategory, string> = {
  hotel: 'bg-blue-500',
  flight: 'bg-sky-500',
  food: 'bg-amber-500',
  activities: 'bg-emerald-500',
  transit: 'bg-violet-500',
  misc: 'bg-slate-500',
};

// Map a PayableItem.type to BudgetTab's category color/icon keys
function payableTypeToCategoryKey(item: PayableItem): BudgetCategory {
  switch (item.type) {
    case 'flight': return 'flight';
    case 'hotel': return 'hotel';
    case 'dining': return 'food';
    case 'transport': return 'transit';
    case 'shopping': return 'misc';
    case 'other': return 'misc';
    case 'activity':
    default:
      // Grouped transit row uses transport-style id
      if (item.id.startsWith('transit-d')) return 'transit';
      return 'activities';
  }
}

function PayableCostsList({ items, formatCurrency, categoryColors, categoryIcons, onActivityRemove }: {
  items: PayableItem[];
  formatCurrency: (cents: number) => string;
  categoryColors: Record<string, string>;
  categoryIcons: Record<string, React.ReactNode>;
  onActivityRemove?: (activityId: string, displayName?: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedTransit, setExpandedTransit] = useState<Set<string>>(new Set());
  const displayed = showAll ? items : items.slice(0, 10);
  const hasMore = items.length > 10;

  const toggleTransit = (id: string) => {
    setExpandedTransit((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {displayed.map((item) => {
        const catKey = payableTypeToCategoryKey(item);
        const isTransitGroup = item.id.startsWith('transit-d') && (item.subItems?.length || 0) > 0;
        // Only activity-typed line items support inline removal — flight/hotel/manual/grouped-transit do not.
        const canRemove =
          item.type === 'activity' &&
          !isTransitGroup &&
          item.id.includes('_d') &&
          !!onActivityRemove;
        const subLabel = item.dayNumber ? `Day ${item.dayNumber}` : (item.type === 'flight' ? 'Flight' : item.type === 'hotel' ? 'Hotel' : '');
        return (
          <div key={item.id} className="border-b border-border last:border-0">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "w-8 h-8 rounded flex items-center justify-center shrink-0",
                  categoryColors[catKey] || 'bg-muted'
                )}>
                  <span className="text-white text-sm">
                    {categoryIcons[catKey] || <DollarSign className="h-4 w-4" />}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {item.type}{subLabel ? ` • ${subLabel}` : ''}
                    {isTransitGroup ? ` • ${item.subItems!.length} legs` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatCurrency(item.amountCents)}</span>
                {isTransitGroup && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => toggleTransit(item.id)}
                    aria-label="Toggle transit legs"
                  >
                    {expandedTransit.has(item.id)
                      ? <ChevronUp className="h-3 w-3" />
                      : <ChevronDown className="h-3 w-3" />}
                  </Button>
                )}
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      const activityId = item.id.replace(/_d\d+$/, '');
                      onActivityRemove?.(activityId, item.name);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            {isTransitGroup && expandedTransit.has(item.id) && (
              <div className="pl-11 pb-2 space-y-1">
                {item.subItems!.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate pr-2">{sub.name}</span>
                    <span>{formatCurrency(sub.amountCents)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-muted-foreground"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <><ChevronUp className="h-4 w-4 mr-1" /> Show less</>
          ) : (
            <><ChevronDown className="h-4 w-4 mr-1" /> Show all {items.length} items</>
          )}
        </Button>
      )}
    </div>
  );
}

export function BudgetTab({ tripId, travelers, totalDays, itineraryDays, onActivityRemove, onApplyBudgetSwap, hasHotel, hasFlight, destination, destinationCountry, budgetTier, flightSelection, hotelSelection, journeyId, journeyName, isManualMode = false, tripStatus, generationFailureReason, onRegenerate }: BudgetTabProps) {
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  // Tracks the user's most recent in-session "Raise budget" so the Coach can
  // render a celebratory card with Undo instead of silently disappearing.
  const [lastRaise, setLastRaise] = useState<{ fromCents: number; toCents: number } | null>(null);
  
  const { data: rawTripMembers = [] } = useTripMembers(tripId);
  const { data: collaborators = [] } = useTripCollaborators(tripId);
  
  // Build member names for per-person budget (deduplicated)
  const memberNames = useMemo(() => {
    const names: { id: string; name: string }[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const seenLastNames = new Set<string>();

    // Add collaborators first (they have richer profile data)
    collaborators.forEach(c => {
      if (c.user_id) {
        const profileName = c.profile?.display_name || c.profile?.handle || 'Guest';
        const syntheticId = `collab-${c.id}`;
        names.push({ id: syntheticId, name: profileName });
        seenIds.add(c.user_id);
        seenIds.add(syntheticId);
        const nameLower = profileName.toLowerCase();
        seenNames.add(nameLower);
        const parts = nameLower.split(/\s+/);
        if (parts.length > 1) seenLastNames.add(parts[parts.length - 1]);
      }
    });

    // Add trip members not already represented
    rawTripMembers.forEach(m => {
      if (!m.id) return;
      const memberName = m.name || m.email?.split('@')[0] || 'Unknown';
      const nameLower = memberName.toLowerCase();
      
      // Skip if user_id already seen
      if (m.userId && seenIds.has(m.userId)) return;
      if (seenIds.has(m.id)) return;
      // Skip exact name match
      if (seenNames.has(nameLower)) return;
      // Skip unlinked members with matching last name (fuzzy dedup)
      if (!m.userId) {
        const parts = nameLower.split(/\s+/);
        if (parts.length > 1 && seenLastNames.has(parts[parts.length - 1])) return;
      }

      names.push({ id: m.id, name: memberName });
      seenIds.add(m.id);
      seenNames.add(nameLower);
      const parts = nameLower.split(/\s+/);
      if (parts.length > 1) seenLastNames.add(parts[parts.length - 1]);
    });
    
    return names;
  }, [rawTripMembers, collaborators]);
  
  const {
    settings,
    summary,
    allocations,
    ledger,
    hasBudget,
    isOverBudget,
    warningLevel,
    isLoading,
    formattedBudget,
    formattedRemaining,
    updateSettings,
    removeEntry,
    refetch,
  } = useTripBudget({ tripId, totalDays, enabled: true });

  // ─── Fetch payments for payable items calculation ───
  const fetchPaymentsForBudget = useCallback(async () => {
    const result = await getTripPayments(tripId);
    if (result.success) {
      setPayments(result.payments || []);
    }
  }, [tripId]);

  useEffect(() => {
    fetchPaymentsForBudget();
  }, [fetchPaymentsForBudget]);

  // Listen for payment changes
  useEffect(() => {
    const handler = () => fetchPaymentsForBudget();
    window.addEventListener('booking-changed', handler);
    return () => window.removeEventListener('booking-changed', handler);
  }, [fetchPaymentsForBudget]);

  // ─── Canonical financial snapshot from DB ledger (single source of truth) ───
  const snapshot = useTripFinancialSnapshot(tripId);

  // NOTE: We deliberately do NOT invalidate summary/ledger/allocations queries
  // when the snapshot total changes. The snapshot, summary, and allocations all
  // ultimately read from `activity_costs`; the `booking-changed` event already
  // refetches every consumer in lockstep. Invalidating here on every total
  // change created the "numbers shift on their own" effect: every background
  // sync write triggered a snapshot delta → a query refetch → a re-render with
  // a slightly different rounding, ad infinitum.
  const queryClient = useQueryClient();

  // Per-city budget breakdown for multi-city trips
  const { data: cityBudgets } = useQuery({
    queryKey: ['cityBudgetBreakdown', tripId],
    queryFn: () => getCityBudgetBreakdown(tripId),
    enabled: !!tripId && hasBudget,
  });

  // ─── Unified payable items (mirror PaymentsTab so the All Costs list and
  //     the Payments list always agree on count, naming, and groupings) ───
  const { data: activityCostsForList } = useQuery({
    queryKey: ['activity-costs-payable', tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from('activity_costs')
        .select('cost_per_person_usd, num_travelers, category, day_number, activity_id')
        .eq('trip_id', tripId);
      return data || [];
    },
    enabled: !!tripId,
  });

  const { data: tripInclusion } = useQuery({
    queryKey: ['trip-inclusion-toggles', tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from('trips')
        .select('budget_include_hotel, budget_include_flight')
        .eq('id', tripId)
        .single();
      return {
        includeHotel: data?.budget_include_hotel ?? true,
        includeFlight: data?.budget_include_flight ?? false,
      };
    },
    enabled: !!tripId,
  });

  const { items: payableItems, essentialItems, activityItems } = usePayableItems({
    days: itineraryDays || [],
    flightSelection,
    hotelSelection,
    travelers,
    payments,
    activityCosts: activityCostsForList,
    budgetTier,
    destination,
    destinationCountry,
    paymentsLoaded: true,
    includeHotel: tripInclusion?.includeHotel ?? true,
    includeFlight: tripInclusion?.includeFlight ?? false,
  });

  const unifiedCostList = useMemo<PayableItem[]>(
    () => [...essentialItems, ...activityItems],
    [essentialItems, activityItems]
  );
  const hiddenFreeCount = Math.max(0, ledger.length - unifiedCostList.length);

  // No separate sync needed — activity_costs are written by EditorialItinerary's syncBudgetFromDays.

  // Hotel/flight costs are now synced to activity_costs via budgetLedgerSync
  // when they are saved — no separate ledger sync needed here.

  const formatCurrency = useCallback((cents: number) => {
    if (!isFinite(cents)) return '$0';
    const currency = settings?.budget_currency || 'USD';
    const amount = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, [settings?.budget_currency]);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center py-16"
      >
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading budget...</p>
        </div>
      </motion.div>
    );
  }

  if (!hasBudget) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-12"
      >
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="pt-8 pb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Set Your Trip Budget</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Track spending, get smart recommendations, and stay on budget throughout your trip.
            </p>
            <Button onClick={() => setShowSetupDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Set Up Budget
            </Button>
          </CardContent>
        </Card>

        <BudgetSetupDialog
          travelers={travelers}
          settings={null}
          open={showSetupDialog}
          onOpenChange={setShowSetupDialog}
          memberNames={memberNames}
          tripTotalCents={snapshot.tripTotalCents}
          onSave={async (newSettings) => {
            await updateSettings(newSettings);
            refetch();
            setShowSetupDialog(false);
          }}
        />
      </motion.div>
    );
  }

  // ─── SINGLE SOURCE OF TRUTH: snapshot drives every headline number ───
  // The over-budget banner percent AND dollar overage MUST come from the
  // same aggregation, otherwise they drift between renders ($690 (38%) →
  // $1,125 (38%) → $1,125 (63%) bug).
  const budgetCents = settings?.budget_total_cents || 0;
  const snapshotUsedPct = budgetCents > 0 ? (snapshot.tripTotalCents / budgetCents) * 100 : 0;
  const snapshotOverageCents = Math.max(0, snapshot.tripTotalCents - budgetCents);
  const snapshotRemainingCents = Math.max(0, budgetCents - snapshot.tripTotalCents);
  const snapshotStatus: 'green' | 'yellow' | 'red' =
    snapshotUsedPct >= 100 ? 'red' : snapshotUsedPct >= 85 ? 'yellow' : 'green';
  const remainingPercent = Math.max(0, 100 - snapshotUsedPct);

  // Dev-only: log if the cached summary disagrees with the snapshot. Catches
  // future regressions where a code path bypasses the shared inclusion rule.
  if (import.meta.env.DEV && summary && Math.abs(summary.usedPercent - snapshotUsedPct) > 0.5) {
    // eslint-disable-next-line no-console
    console.error('[budget] source mismatch — snapshot vs summary', {
      snapshotUsedPct,
      summaryUsedPercent: summary.usedPercent,
      snapshotTotalCents: snapshot.tripTotalCents,
      summaryTotalUsed: summary.totalCommittedCents + summary.plannedTotalCents,
    });
  }

  // Failed/empty itinerary state — replaces over-budget UI with a recovery banner.
  // Covers both 'empty_itinerary' (zero meaningful activities) and the new
  // 'incomplete_itinerary' (degenerate: hotel-only or hotel + single filler).
  const isEmptyItineraryFailure =
    tripStatus === 'failed' &&
    (generationFailureReason === 'empty_itinerary' ||
      generationFailureReason === 'incomplete_itinerary');
  const isIncompleteItineraryFailure =
    tripStatus === 'failed' && generationFailureReason === 'incomplete_itinerary';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 py-6"
    >
      {/* Failed/empty itinerary banner — replaces over-budget messaging */}
      {isEmptyItineraryFailure && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-destructive" />
          <div className="flex-1 space-y-2">
            <p className="font-semibold text-foreground">
              {isIncompleteItineraryFailure
                ? 'Your itinerary is missing activities'
                : "Your itinerary didn't generate properly"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isIncompleteItineraryFailure
                ? 'Generation finished without a full plan of restaurants and activities. The Budget Coach is paused until your itinerary is complete. Tap Regenerate to try again.'
                : 'Generation finished without any restaurants, activities, or transit. Tap Regenerate to try again.'}
            </p>
            {onRegenerate && (
              <Button size="sm" variant="default" onClick={onRegenerate} className="mt-1">
                Regenerate itinerary
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Over-budget Warning Banner — snapshot is the only source (hidden in manual mode and on empty-itinerary failure) */}
      {!isManualMode && !isEmptyItineraryFailure && (() => {
        const showWarning = settings?.budget_warnings_enabled !== false
          && settings?.budget_warning_threshold !== 'off'
          && (snapshotStatus === 'red' || (snapshotStatus === 'yellow' && settings?.budget_warning_threshold !== 'red_only'));

        if (!showWarning) return null;
        if (snapshotStatus !== 'red' && snapshotStatus !== 'yellow') return null;

        return (
          <BudgetWarning
            status={snapshotStatus}
            usedPercent={snapshotUsedPct}
            overageCents={snapshotOverageCents}
            remainingCents={snapshotRemainingCents}
            currency={settings?.budget_currency || 'USD'}
          />
        );
      })()}

      {/* Over-budget diagnostic banner — decomposes the overage and offers one-click fixes (hidden in manual mode) */}
      {!isManualMode && (() => {
        const budgetCents = settings?.budget_total_cents || 0;
        if (budgetCents <= 0 || !summary || snapshot.tripTotalCents <= budgetCents) return null;

        const includeHotel = settings?.budget_include_hotel ?? true;
        const includeFlight = settings?.budget_include_flight ?? false;
        const hotelCents = summary.committedHotelCents || 0;
        const flightCents = summary.committedFlightCents || 0;
        const fixedIncluded = (includeHotel ? hotelCents : 0) + (includeFlight ? flightCents : 0);
        const discretionaryCents = Math.max(0, snapshot.tripTotalCents - fixedIncluded);

        const fit = assessBudgetFit({
          hotelCents,
          flightCents,
          discretionaryCents,
          budgetCents,
          includeHotel,
          includeFlight,
        });

        const overagePct = Math.round((fit.overageCents / budgetCents) * 100);
        if (overagePct < 15) return null;

        const isHotelDriven = fit.severity === 'hotel_dominated';
        const hotelMultiplier = formatMultiplier(hotelCents, budgetCents);
        const suggested = fit.suggestedBudgetCents;
        const canRaise = suggested > budgetCents;

        return (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-sm font-medium text-destructive">
                  Trip expenses exceed your budget by {formatCurrency(fit.overageCents)} ({overagePct}%)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isHotelDriven ? (
                    <>
                      Your hotel ({formatCurrency(hotelCents)}) is <span className="font-medium text-foreground">{hotelMultiplier} your trip budget</span> of {formattedBudget}. The rest of the plan ({formatCurrency(discretionaryCents)} for food, activities &amp; transit{includeFlight && flightCents > 0 ? ' + flights' : ''}) sits on top.
                    </>
                  ) : (
                    <>
                      Your budget is {formattedBudget} but the estimated cost for {travelers} traveler{travelers !== 1 ? 's' : ''} is {formatCurrency(snapshot.tripTotalCents)}.
                      {fit.drivers[0] && (
                        <> Largest driver: <span className="font-medium text-foreground">{fit.drivers[0].kind === 'discretionary' ? 'food, activities & transit' : fit.drivers[0].kind} ({formatCurrency(fit.drivers[0].cents)})</span>.</>
                      )}
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canRaise && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={async () => {
                      const res = await applyRaiseBudget(budgetCents, suggested, {
                        updateSettings: (s) => updateSettings(s),
                        dispatchBookingChanged: () =>
                          window.dispatchEvent(new CustomEvent('booking-changed')),
                        toast,
                        formatCurrency,
                      });
                      if (res.ok && typeof res.previousBudgetCents === 'number') {
                        setLastRaise({ fromCents: res.previousBudgetCents, toCents: suggested });
                      }
                    }}
                  >
                    Raise budget to {formatCurrency(suggested)}
                  </Button>
                )}
                {isHotelDriven && includeHotel && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={async () => {
                      await updateSettings({ budget_include_hotel: false });
                      window.dispatchEvent(new CustomEvent('booking-changed'));
                    }}
                  >
                    Hide hotel from budget
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => setShowSetupDialog(true)}
                >
                  Edit budget…
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bare-itinerary warning — itinerary has hotel/flight but no real activities */}
      {!isManualMode && !isEmptyItineraryFailure && itineraryDays && itineraryDays.length > 0 && (() => {
        const NON_ACTIVITY_CATS = new Set([
          'hotel', 'accommodation', 'lodging', 'stay', 'flight', 'flights',
          'check-in', 'check-out', 'checkin', 'checkout', 'bag-drop', 'departure', 'arrival',
        ]);
        const NON_ACTIVITY_TITLE_RE = /\b(check\s*-?\s*in|check\s*-?\s*out|bag\s*-?\s*drop|return\s+to\s+(?:your\s+)?hotel|hotel\s+checkout|hotel\s+check-?in|airport\s+transfer|departure)\b/i;
        let meaningfulCount = 0;
        for (const day of itineraryDays) {
          for (const a of (day.activities || [])) {
            const cat = `${(a as any).category || ''} ${(a as any).type || ''}`.toLowerCase();
            const title = ((a as any).title || (a as any).name || '').trim();
            if ([...NON_ACTIVITY_CATS].some((c) => cat.includes(c))) continue;
            if (NON_ACTIVITY_TITLE_RE.test(title)) continue;
            meaningfulCount++;
          }
        }
        if (meaningfulCount > 0) return null;
        return (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-medium">This itinerary has no activities yet</p>
              <p>
                Food, Activities, and Local Transit will stay at $0 until restaurants, experiences, or transit are added. Open the Itinerary tab to add or regenerate.
              </p>
            </div>
          </div>
        );
      })()}


      {!isManualMode && !isEmptyItineraryFailure && tripStatus !== 'failed' && hasBudget && itineraryDays && itineraryDays.length > 0 && hasSuggestableContent(itineraryDays as any) && summary && (() => {
        // Compute per-category overruns (planned - allocated, in cents) and
        // translate BudgetCategory → Coach's user-facing labels.
        const CATEGORY_LABEL_MAP: Record<BudgetCategory, string> = {
          food: 'Dining',
          activities: 'Activities',
          transit: 'Transit',
          misc: 'Activities',
          hotel: 'Hotels',
          flight: 'Hotels',
        };
        const overruns: Record<string, number> = {};
        for (const a of allocations) {
          if (a.kind !== 'discretionary') continue;
          const over = (a.usedCents || 0) - (a.allocatedCents || 0);
          if (over > 0) {
            const label = CATEGORY_LABEL_MAP[a.category];
            if (label) overruns[label] = (overruns[label] || 0) + over;
          }
        }
        return (
          <BudgetCoach
            tripId={tripId}
            budgetTargetCents={summary.budgetTotalCents}
            currentTotalCents={snapshot.tripTotalCents}
            currency={settings?.budget_currency || 'USD'}
            destination={destination}
            itineraryDays={itineraryDays}
            travelers={travelers}
            onApplySuggestion={onApplyBudgetSwap}
            protectedCategories={settings?.coach_protected_categories ?? []}
            onProtectedCategoriesChange={(next) => {
              updateSettings({ coach_protected_categories: next });
            }}
            onBumpBudget={async (newTotalCents) => {
              await updateSettings({ budget_total_cents: newTotalCents });
            }}
            categoryOverruns={overruns}
            miscReserveCents={allocations.find((a) => a.category === 'misc')?.allocatedCents || 0}
            miscUsedCents={allocations.find((a) => a.category === 'misc')?.usedCents || 0}
            onAddMiscExpense={() => {
              window.dispatchEvent(new CustomEvent('open-add-expense', { detail: { type: 'other' } }));
            }}
            onEditBudget={() => setShowSetupDialog(true)}
            hotelCents={summary.committedHotelCents || 0}
            flightCents={summary.committedFlightCents || 0}
            onEditAccommodation={() => {
              const el = document.querySelector('[data-section="hotels"]');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                window.dispatchEvent(new CustomEvent('navigate-to-section', { detail: 'hotels' }));
              }
            }}
          />
        );
      })()}

      {/* Missing items warning */}
      {(() => {
        const missingItems: string[] = [];
        const hasManualHotelPayment = payments.some(
          p => p.item_type === 'hotel' && typeof p.item_id === 'string' && p.item_id.startsWith('manual-')
        );
        const hotelHasPrice = !!(hotelSelection?.totalPrice || hotelSelection?.pricePerNight) || hasManualHotelPayment;
        const hotelMissingPrice = (settings?.budget_include_hotel ?? true) && hasHotel && !hotelHasPrice;

        if ((settings?.budget_include_hotel ?? true) && !hasHotel) missingItems.push('Hotel');
        if ((settings?.budget_include_flight ?? false) && !hasFlight) missingItems.push('Flights');

        if (missingItems.length === 0 && !hotelMissingPrice) return null;

        return (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              {missingItems.length > 0 && (
                <p>
                  Some budgeted categories have no items yet: <span className="font-medium">{missingItems.join(', ')}</span>. Your actual spend may be higher than shown.
                </p>
              )}
              {hotelMissingPrice && (
                <p>
                  We&rsquo;ve used an estimated nightly rate for{' '}
                  <span className="font-medium">{hotelSelection?.name || 'your hotel'}</span>
                  {summary && summary.committedHotelCents > 0 ? <> (~{formatCurrency(summary.committedHotelCents)} total)</> : null}
                  {' '}based on typical {destination || 'destination'} {(budgetTier || 'mid')}-tier hotels. Add the actual rate in Flights &amp; Hotels to lock in a precise budget.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Budget Overview */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Total Budget Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Total Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {formattedBudget}
              </span>
              {settings?.budget_input_mode === 'per_person' && (
                <span className="text-xs text-muted-foreground">
                  ({formatCurrency((settings?.budget_total_cents || 0) / travelers)}/person)
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSetupDialog(true)}
              className="mt-2 h-7 text-xs gap-1"
            >
              <Settings className="h-3 w-3" />
              Edit Budget
            </Button>
          </CardContent>
        </Card>

        {/* Trip Expenses Card — total estimated cost from live itinerary (hidden in manual mode) */}
        {!isManualMode && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trip Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={cn(
                "text-2xl font-bold",
                snapshot.tripTotalCents > (settings?.budget_total_cents || Infinity) ? "text-destructive" : "text-foreground"
              )}>
                {formatCurrency(snapshot.tripTotalCents)}
              </span>
              {(settings?.budget_currency || 'USD') !== 'USD' && rateDisclosure(settings?.budget_currency || 'USD') && (
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground/70 hover:text-foreground transition-colors self-center"
                        aria-label="Exchange rate info"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <span className="text-xs">{rateDisclosure(settings?.budget_currency || 'USD')}</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {(settings?.budget_total_cents || 0) > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({Math.round((snapshot.tripTotalCents / (settings?.budget_total_cents || 1)) * 100)}%)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Estimated total for {travelers} traveler{travelers !== 1 ? 's' : ''}
              {travelers > 1 && snapshot.tripTotalCents > 0 && (
                <> · {formatCurrency(Math.floor(snapshot.tripTotalCents / travelers / 100) * 100)}/person</>
              )}
            </p>
            <Progress 
              value={Math.min((settings?.budget_total_cents || 0) > 0 ? (snapshot.tripTotalCents / (settings!.budget_total_cents || 1)) * 100 : 0, 100)} 
              className="h-2 mt-3"
            />
            {snapshot.paidCents > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Paid so far: {formatCurrency(snapshot.paidCents)} · To be paid: {formatCurrency(snapshot.toBePaidCents)}
              </p>
            )}
          </CardContent>
        </Card>
        )}

        {/* Budget Remaining Card — budget minus trip expenses (hidden in manual mode) */}
        {!isManualMode && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Budget Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={cn(
                "text-2xl font-bold",
                snapshot.budgetRemainingCents < 0 ? "text-destructive" : "text-emerald-600"
              )}>
                {formatCurrency(snapshot.budgetRemainingCents)}
              </span>
              {(settings?.budget_total_cents || 0) > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({Math.round(Math.max(0, 100 - (snapshot.tripTotalCents / (settings?.budget_total_cents || 1)) * 100))}%)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Budget minus trip expenses
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ≈ {formatCurrency(Math.round(Math.max(0, snapshot.budgetRemainingCents) / Math.max(totalDays, 1)))}/day remaining
            </p>
          </CardContent>
        </Card>
        )}
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Budget by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Category sync warning removed — totals now come from payable items */}
            {(() => {
              const fixedRows = allocations.filter((a) => a.kind === 'fixed');
              const discretionaryRows = allocations.filter((a) => a.kind !== 'fixed');
              return (
                <>
                  {fixedRows.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fixed Costs</span>
                        <span className="text-xs text-muted-foreground">Tracked against your trip total</span>
                      </div>
                      {fixedRows.map((alloc) => (
                        <div key={alloc.category} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-6 h-6 rounded flex items-center justify-center", categoryColors[alloc.category])}>
                                <span className="text-white">{categoryIcons[alloc.category]}</span>
                              </div>
                              <span className="font-medium">{categoryLabels[alloc.category]}</span>
                            </div>
                            <div className="flex items-center gap-2 text-right">
                              <span className={cn("font-medium", alloc.exceedsBudget && "text-destructive")}>
                                {formatCurrency(alloc.usedCents)}
                              </span>
                              {alloc.exceedsBudget ? (
                                <span className="text-xs font-medium text-destructive">Over budget</span>
                              ) : typeof alloc.shareOfBudgetPercent === 'number' && (
                                <span className="text-xs text-muted-foreground">
                                  ({alloc.shareOfBudgetPercent}% of total)
                                </span>
                              )}
                            </div>
                          </div>
                          {alloc.exceedsBudget && (
                            <p className="text-xs text-destructive pl-8">
                              {categoryLabels[alloc.category]} exceeds your trip budget. Raise your total or toggle "Include {alloc.category === 'hotel' ? 'Hotel' : 'Flight'} in Budget" off below.
                            </p>
                          )}
                        </div>
                      ))}
                      {discretionaryRows.length > 0 && (
                        <div className="pt-2 border-t border-border">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Discretionary</span>
                          {discretionaryRows.some((r) => r.discretionaryUnderwater) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Fixed costs have absorbed your full trip budget. Targets below are calculated against your original total — raise it or toggle a fixed cost off to free up the discretionary pool.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {discretionaryRows.map((alloc) => {
                    const allocated = alloc.allocatedCents;
                    const used = alloc.usedCents;
                    const percent = allocated > 0 ? Math.min((used / allocated) * 100, 100) : 0;
                    const isOver = used > allocated;
                    return (
                      <div key={alloc.category} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-6 h-6 rounded flex items-center justify-center", categoryColors[alloc.category])}>
                              <span className="text-white">{categoryIcons[alloc.category]}</span>
                            </div>
                            <span className="font-medium">{categoryLabels[alloc.category]}</span>
                            <Badge
                              variant="outline"
                              className="text-xs"
                              title="Target share of discretionary budget"
                            >
                              {alloc.percent}%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-right">
                            {alloc.category === 'misc' && used === 0 && allocated > 0 ? (
                              <span className="text-muted-foreground text-xs">
                                {formatCurrency(allocated)} reserved
                              </span>
                            ) : (
                              <>
                                <span className={cn("font-medium", isOver && !(alloc.category === 'misc' && used === 0) && "text-destructive")}>
                                  {formatCurrency(used)}
                                </span>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-muted-foreground">
                                  {formatCurrency(allocated)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {alloc.category === 'misc' && used === 0 && allocated > 0 ? (
                          // Reserve treatment — the misc allocation is a
                          // committed cash reserve folded into the trip
                          // total. Show it as fully reserved (not 0%) so
                          // users understand it's already counted against
                          // their budget headroom, with a clear CTA to log
                          // real cash spend.
                          <div className="space-y-2">
                            <div
                              className="h-2 rounded-full bg-muted overflow-hidden"
                              title="Cash reserved for tips, SIMs, pharmacy, market finds. Counts against your trip total — log expenses to track what's left."
                            >
                              <div
                                className="h-full w-full bg-slate-400/70 dark:bg-slate-500/60"
                                style={{
                                  backgroundImage:
                                    'repeating-linear-gradient(45deg, transparent 0 4px, rgba(255,255,255,0.25) 4px 8px)',
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 pl-8">
                              <div className="text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/60 text-foreground/80">
                                  <Wallet className="h-3 w-3" />
                                  {formatCurrency(allocated)} reserved · 0 logged
                                </span>
                                <span className="ml-2">Counted in your trip total. Log cash expenses as you go.</span>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs shrink-0"
                                onClick={() => {
                                  window.dispatchEvent(
                                    new CustomEvent('open-add-expense', { detail: { type: 'other' } })
                                  );
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />Add expense
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Progress
                            value={percent}
                            className={cn("h-2", isOver && "[&>div]:bg-destructive")}
                          />
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
            {/* Authoritative total from itinerary */}
            {snapshot.tripTotalCents > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-border text-sm">
                <span className="font-medium text-muted-foreground">Total from itinerary</span>
                <span className="font-semibold">{formatCurrency(snapshot.tripTotalCents)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Budget Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Budget Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Include Hotel in Budget</Label>
              <p className="text-xs text-muted-foreground">Track hotel costs against your budget</p>
            </div>
            <Switch
              checked={settings?.budget_include_hotel ?? true}
              onCheckedChange={async (checked) => { await updateSettings({ budget_include_hotel: checked }); window.dispatchEvent(new CustomEvent('booking-changed')); }}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Include Flights in Budget</Label>
              <p className="text-xs text-muted-foreground">Track flight costs (usually purchased elsewhere)</p>
            </div>
            <Switch
              checked={settings?.budget_include_flight ?? false}
              onCheckedChange={async (checked) => { await updateSettings({ budget_include_flight: checked }); window.dispatchEvent(new CustomEvent('booking-changed')); }}
            />
          </div>
          {(settings?.budget_include_flight ?? false) && !hasFlight && (
            <p className="text-xs text-amber-600 -mt-1 ml-1">No flight cost added yet. Add one in the Flights &amp; Hotels tab.</p>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Budget Warnings</Label>
              <p className="text-xs text-muted-foreground">Get notified when approaching budget limits</p>
            </div>
            <Switch
              checked={settings?.budget_warnings_enabled ?? true}
              onCheckedChange={(checked) => updateSettings({ budget_warnings_enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Multi-City Budget Breakdown */}
      {cityBudgets && cityBudgets.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Budget by City
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cityBudgets.map(city => {
              const usedPercent = city.allocatedBudgetCents > 0
                ? Math.min((city.spentCents / city.allocatedBudgetCents) * 100, 100)
                : 0;
              const isOver = city.remainingCents < 0;
              return (
                <div key={city.cityId} className="p-3 rounded-lg border bg-card">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{city.cityName}</span>
                    <span className={cn("text-xs", isOver ? "text-destructive" : "text-muted-foreground")}>
                      {isOver ? 'Over by ' : ''}{formatCurrency(Math.abs(city.remainingCents))} {isOver ? '' : 'remaining'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {city.nights} night{city.nights !== 1 ? 's' : ''}, {formatCurrency(city.allocatedBudgetCents)} allocated
                  </div>
                  <Progress
                    value={usedPercent}
                    className="h-1.5"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* All Costs — derived from the same payable-items source as the Payments tab,
          so item count, names, and totals match exactly. */}
      {!isManualMode && unifiedCostList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              All Costs ({unifiedCostList.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PayableCostsList
              items={unifiedCostList}
              formatCurrency={formatCurrency}
              categoryColors={categoryColors}
              categoryIcons={categoryIcons}
              onActivityRemove={onActivityRemove}
            />
            {hiddenFreeCount > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                + {hiddenFreeCount} free venue{hiddenFreeCount === 1 ? '' : 's'} not shown
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Journey Budget Summary — cross-leg overview for linked trips */}
      {journeyId && (
        <JourneyBudgetSummary
          journeyId={journeyId}
          journeyName={journeyName || null}
          currentTripId={tripId}
          currency={settings?.budget_currency || 'USD'}
        />
      )}

      <BudgetSetupDialog
        travelers={travelers}
        settings={settings}
        open={showSetupDialog}
        onOpenChange={setShowSetupDialog}
        memberNames={memberNames}
        tripTotalCents={snapshot.tripTotalCents}
        hotelCents={summary?.committedHotelCents || 0}
        totalNights={Math.max(0, totalDays - 1)}
        onSave={async (newSettings) => {
          await updateSettings(newSettings);
          refetch();
          setShowSetupDialog(false);
        }}
      />
    </motion.div>
  );
}
