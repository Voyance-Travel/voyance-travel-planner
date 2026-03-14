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
import { useQuery } from '@tanstack/react-query';
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
import { syncHotelToLedger, syncFlightToLedger } from '@/services/budgetLedgerSync';
import { supabase } from '@/integrations/supabase/client';
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
  /** Journey fields for linked trip budget summary */
  journeyId?: string | null;
  journeyName?: string | null;
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

export function BudgetTab({ tripId, travelers, totalDays, itineraryDays, onActivityRemove, onApplyBudgetSwap, hasHotel, hasFlight, destination, journeyId, journeyName }: BudgetTabProps) {
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const syncAttempted = useRef(false);
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
    syncFromItinerary,
    refetch,
  } = useTripBudget({ tripId, totalDays, enabled: true });

  // ─── Financial snapshot: single source of truth for expected spend ───
  const snapshot = useTripFinancialSnapshot(tripId);

  // Per-city budget breakdown for multi-city trips
  const { data: cityBudgets } = useQuery({
    queryKey: ['cityBudgetBreakdown', tripId],
    queryFn: () => getCityBudgetBreakdown(tripId),
    enabled: !!tripId && hasBudget,
  });

  // Auto-sync itinerary costs to budget ledger when days are provided
  useEffect(() => {
    if (!itineraryDays || itineraryDays.length === 0 || syncAttempted.current) return;
    if (!hasBudget) return; // Don't sync if no budget is set
    
    // Transform itinerary days to the format expected by syncFromItinerary
    const daysForSync = itineraryDays.map(day => ({
      dayNumber: day.dayNumber,
      date: day.date || '',
      activities: day.activities.map(act => {
        // Normalize cost to { amount, currency } format
        let costObj: { amount: number; currency: string } | undefined;
        if (typeof act.cost === 'number') {
          costObj = { amount: act.cost, currency: 'USD' };
        } else if (act.cost && typeof act.cost === 'object') {
          costObj = act.cost;
        }
        
        return {
          id: act.id,
          title: act.title || act.name || 'Activity',
          category: act.category || act.type || 'activities',
          cost: costObj,
        };
      }),
    }));
    
    syncAttempted.current = true;
    syncFromItinerary(daysForSync).catch(err => {
      console.error('[BudgetTab] Failed to sync itinerary costs:', err);
    });
  }, [itineraryDays, hasBudget, syncFromItinerary]);

  // Sync hotel/flight committed costs to budget ledger on mount
  useEffect(() => {
    if (!hasBudget || !tripId) return;
    (async () => {
      try {
        const { data: trip } = await supabase
          .from('trips')
          .select('hotel_selection, flight_selection')
          .eq('id', tripId)
          .single();
        if (!trip) return;
        const hotel = trip.hotel_selection as any;
        const flight = trip.flight_selection as any;
        if (hotel) await syncHotelToLedger(tripId, hotel);
        if (flight) await syncFlightToLedger(tripId, flight);
      } catch (err) {
        console.error('[BudgetTab] Failed to sync hotel/flight to ledger:', err);
      }
    })();
  }, [tripId, hasBudget]);

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
          onSave={async (newSettings) => {
            await updateSettings(newSettings);
            refetch();
            setShowSetupDialog(false);
          }}
        />
      </motion.div>
    );
  }

  const remainingPercent = summary ? Math.max(0, 100 - summary.usedPercent) : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 py-6"
    >
      {/* Over-budget Warning Banner */}
      {warningLevel !== 'none' && summary && (
        <BudgetWarning summary={summary} />
      )}

      {/* Budget Coach — AI suggestions when over budget */}
      {hasBudget && itineraryDays && itineraryDays.length > 0 && summary && (
        <BudgetCoach
          tripId={tripId}
          budgetTargetCents={summary.budgetTotalCents}
          currentTotalCents={summary.totalCommittedCents + summary.plannedTotalCents}
          currency={settings?.budget_currency || 'USD'}
          destination={destination}
          itineraryDays={itineraryDays}
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

        {/* Expected Spend Card — total expected cost from all sources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Expected Spend
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
            <Progress 
              value={Math.min((settings?.budget_total_cents || 0) > 0 ? (snapshot.tripTotalCents / (settings!.budget_total_cents || 1)) * 100 : 0, 100)} 
              className="h-2 mt-3"
            />
            {snapshot.paidCents > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Paid: {formatCurrency(snapshot.paidCents)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Budget Remaining Card — budget minus paid only */}
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
                  ({Math.round(Math.max(0, 100 - (snapshot.paidCents / (settings?.budget_total_cents || 1)) * 100))}%)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ≈ {formatCurrency(Math.round(Math.max(0, snapshot.budgetRemainingCents) / Math.max(totalDays, 1)))}/day
            </p>
          </CardContent>
        </Card>
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
              onCheckedChange={(checked) => updateSettings({ budget_include_hotel: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Include Flights in Budget</Label>
              <p className="text-xs text-muted-foreground">Track flight costs (usually purchased elsewhere)</p>
            </div>
            <Switch
              checked={settings?.budget_include_flight ?? false}
              onCheckedChange={(checked) => updateSettings({ budget_include_flight: checked })}
            />
          </div>

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
                    {city.nights} night{city.nights !== 1 ? 's' : ''} — {formatCurrency(city.allocatedBudgetCents)} allocated
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

      {/* Recent Expenses */}
      {ledger.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              All Costs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ledger.slice(0, 10).map((entry) => (
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
                          // If this is a planned entry linked to an itinerary activity, notify parent
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
            </div>
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
        onSave={async (newSettings) => {
          await updateSettings(newSettings);
          refetch();
          setShowSetupDialog(false);
        }}
      />
    </motion.div>
  );
}
