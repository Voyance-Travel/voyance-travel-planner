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
import { useTripMembers } from '@/services/tripBudgetAPI';
import { useTripCollaborators } from '@/services/tripCollaboratorsAPI';
import type { BudgetCategory } from '@/services/tripBudgetService';
import { getCityBudgetBreakdown } from '@/services/tripBudgetService';
import { getTripPayments, type TripPayment } from '@/services/tripPaymentsAPI';
import { useTripFinancialSnapshot } from '@/hooks/useTripFinancialSnapshot';

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
  onActivityRemove?: (activityId: string) => void;
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
  misc: 'Miscellaneous',
};

const categoryColors: Record<BudgetCategory, string> = {
  hotel: 'bg-blue-500',
  flight: 'bg-sky-500',
  food: 'bg-amber-500',
  activities: 'bg-emerald-500',
  transit: 'bg-violet-500',
  misc: 'bg-slate-500',
};

function CostsList({ ledger, formatCurrency, categoryColors, categoryIcons, onActivityRemove, removeEntry }: {
  ledger: any[];
  formatCurrency: (cents: number) => string;
  categoryColors: Record<string, string>;
  categoryIcons: Record<string, React.ReactNode>;
  onActivityRemove?: (activityId: string) => void;
  removeEntry: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? ledger : ledger.slice(0, 10);
  const hasMore = ledger.length > 10;

  return (
    <div className="space-y-2">
      {displayed.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between py-2 border-b border-border last:border-0"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded flex items-center justify-center",
              categoryColors[entry.category as BudgetCategory] || 'bg-muted'
            )}>
              <span className="text-white text-sm">
                {categoryIcons[entry.category as BudgetCategory] || <DollarSign className="h-4 w-4" />}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium">{entry.description}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {entry.category} • {entry.entry_type === 'committed' ? 'Committed' : 'Planned'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{formatCurrency(entry.amount_cents)}</span>
            {!entry.external_booking_id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  if (entry.entry_type === 'planned' && entry.activity_id && onActivityRemove) {
                    onActivityRemove(entry.activity_id);
                  }
                  removeEntry(entry.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      ))}
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
            <><ChevronDown className="h-4 w-4 mr-1" /> Show all {ledger.length} items</>
          )}
        </Button>
      )}
    </div>
  );
}

export function BudgetTab({ tripId, travelers, totalDays, itineraryDays, onActivityRemove, onApplyBudgetSwap, hasHotel, hasFlight, destination, destinationCountry, budgetTier, flightSelection, hotelSelection, journeyId, journeyName, isManualMode = false }: BudgetTabProps) {
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  
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

  // Per-city budget breakdown for multi-city trips
  const { data: cityBudgets } = useQuery({
    queryKey: ['cityBudgetBreakdown', tripId],
    queryFn: () => getCityBudgetBreakdown(tripId),
    enabled: !!tripId && hasBudget,
  });

  // Budget ledger is now derived from activity_costs (single source of truth).
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 py-6"
    >
      {/* Over-budget Warning Banner — snapshot is the only source (hidden in manual mode) */}
      {!isManualMode && (() => {
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

      {/* Over-budget explainer — actionable guidance when expenses far exceed budget (hidden in manual mode) */}
      {!isManualMode && (() => {
        const budgetCents = settings?.budget_total_cents || 0;
        if (budgetCents <= 0 || snapshot.tripTotalCents <= budgetCents) return null;
        const overageCents = snapshot.tripTotalCents - budgetCents;
        const overagePct = Math.round((overageCents / budgetCents) * 100);
        // Only show when significantly over (>15%)
        if (overagePct < 15) return null;
        return (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">
                Trip expenses exceed your budget by {formatCurrency(overageCents)} ({overagePct}%)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your budget is {formattedBudget} but the estimated cost for {travelers} traveler{travelers !== 1 ? 's' : ''} is {formatCurrency(snapshot.tripTotalCents)}. 
                Use the Budget Coach below to find savings, or adjust your budget to match your plans.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Budget Coach — AI suggestions when over budget (hidden in manual mode) */}
      {!isManualMode && hasBudget && itineraryDays && itineraryDays.length > 0 && summary && snapshotStatus !== 'yellow' && (
        <BudgetCoach
          tripId={tripId}
          budgetTargetCents={summary.budgetTotalCents}
          currentTotalCents={snapshot.tripTotalCents}
          currency={settings?.budget_currency || 'USD'}
          destination={destination}
          itineraryDays={itineraryDays}
          travelers={travelers}
          onApplySuggestion={onApplyBudgetSwap}
        />
      )}

      {/* Missing items warning */}
      {(() => {
        const missingItems: string[] = [];
        if ((settings?.budget_include_hotel ?? true) && !hasHotel) missingItems.push('Hotel');
        if ((settings?.budget_include_flight ?? false) && !hasFlight) missingItems.push('Flights');
        if (missingItems.length === 0) return null;
        return (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-sm">
              Some budgeted categories have no items yet: <span className="font-medium">{missingItems.join(', ')}</span>. Your actual spend may be higher than shown.
            </p>
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
            {allocations.map((alloc) => {
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
                      <Badge variant="outline" className="text-xs">
                        {alloc.percent}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className={cn(
                        "font-medium",
                        isOver && "text-destructive"
                      )}>
                        {formatCurrency(used)}
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(allocated)}
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={percent} 
                    className={cn("h-2", isOver && "[&>div]:bg-destructive")}
                  />
                </div>
              );
            })}
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

      {/* Recent Expenses (hidden in manual mode — auto-synced costs don't apply) */}
      {!isManualMode && ledger.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              All Costs ({ledger.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CostsList
              ledger={ledger}
              formatCurrency={formatCurrency}
              categoryColors={categoryColors}
              categoryIcons={categoryIcons}
              onActivityRemove={onActivityRemove}
              removeEntry={removeEntry}
            />
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
        onSave={async (newSettings) => {
          await updateSettings(newSettings);
          refetch();
          setShowSetupDialog(false);
        }}
      />
    </motion.div>
  );
}
