// Extracted from EditorialItinerary.tsx during the file-size decomposition.
import type { EditorialDay, EditorialActivity, CityHotelInfo } from '../EditorialItinerary';
import { DayRouteMap } from '../DayRouteMap';
import { DeadGapBanner } from '../DeadGapBanner';
import { DraggableActivityList } from '../DraggableActivityList';
import { FreeTimeMarker } from '../FreeTimeMarker';
import { InterCityTransportCard } from '../InterCityTransportCard';
import { RefreshDaySheet } from '../RefreshDaySheet';
import { TransitGapIndicator, computeDeadGaps, computeGapMinutes, computeOpenWindows } from '../TransitGapIndicator';
import { TransportComparisonCard } from '../TransportComparisonCard';
import { ActivityRow } from './ActivityRow';
import { getActivityCostInfo, getDayTotalCost } from './cost-utils';
import { isFuzzyLocationMatch, normalizeDestination } from './format-utils';
import { weatherIcons } from '../EditorialItinerary';
import { isWalkingLeg } from '@/lib/cost-estimation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { resolveCountry } from '@/utils/cityCountryMap';
import { getDisplayDayTitle } from '@/utils/dayTitleCoherence';
import { timeOfDayBand } from '@/lib/itinerary/timeOfDayBand';
import type { CollaboratorAttribution } from '@/utils/collaboratorAttribution';
import type { TripPayment } from '@/services/tripPaymentsAPI';
import type { BookingItemState } from '@/services/bookingStateMachine';
import type { RefreshResult, ProposedChange } from '@/hooks/useRefreshDay';
import type { DayBreakdown } from '@/hooks/useTripDayBreakdown';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, ChevronUp, ClipboardPaste, Clock, Compass, Loader2, Lock, MapPin, MoreHorizontal, Plus, RefreshCw, Route, Sparkles, Train, Unlock } from 'lucide-react';
import { useState } from 'react';


export interface DayCardProps {
  day: EditorialDay;
  dayIndex: number;
  totalDays: number; // Total number of days in itinerary
  travelers: number;
  budgetTier?: string;
  tripCurrency: string; // Currency for cost formatting
  displayCost: (amountInUSD: number) => number; // Convert USD to display currency
  destination: string; // For real photo lookup
  destinationCountry?: string; // For cost estimation
  isExpanded: boolean;
  isRegenerating: boolean;
  isEditable: boolean;
  isPreview?: boolean; // Preview mode - gates details
  canViewPremium?: boolean; // Entitlement-based premium content gate
  tripId: string;
  highlightedActivityIds?: string[]; // Activities to highlight (from chatbot)
  getPaymentForItem: (itemType: 'flight' | 'hotel' | 'activity', itemId: string) => TripPayment | undefined;
  refreshPayments: () => void;
  onToggle: () => void;
  onActivitySwap?: (dayIndex: number, activity: EditorialActivity) => void;
  swapCapInfo?: { isFree: boolean; usedCount: number; freeRemaining: number; cap: number; creditCost: number; isLoading: boolean };
  onActivityLock: (dayIndex: number, activityId: string) => void;
  onActivityMove: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onMoveToDay?: (fromDayIndex: number, activityId: string, toDayIndex: number) => void;
  onCopyToDay?: (fromDayIndex: number, activityId: string, toDayIndex: number) => void;
  onActivityRemove: (dayIndex: number, activityId: string) => void;
  onActivityReorder?: (activities: EditorialActivity[]) => void; // Drag-and-drop reorder
  onDayLock: (dayIndex: number) => void;
  onDayRegenerate: () => void;
  onAddActivity: (afterIndex?: number) => void;
  onDiscover?: () => void;
  onImportActivities?: () => void;
  onTimeEdit: (dayIndex: number, activityIndex: number, activity: EditorialActivity) => void;
  onActivityEdit: (dayIndex: number, activityIndex: number, activity: EditorialActivity) => void;
  onPaymentRequest?: (activityId: string) => void;
  onBookingStateChange?: (activityId: string, newState: BookingItemState) => void;
  onViewReviews?: (activity: EditorialActivity) => void;
  onUnlockTrip?: () => void;
  onUnlockDay?: (dayNumber: number) => void;
  unlockingDayNumber?: number | null;
   onTransportModeChange?: (dayIndex: number, activityId: string, newMode: string) => Promise<void>;
   changingTransportActivityId?: string | null;
   /** Callback to set transportation data on an activity (e.g. from TransitGapIndicator) */
   onSetActivityTransportation?: (dayIndex: number, activityIndex: number, transportation: EditorialActivity['transportation']) => void;
  collaboratorColorMap?: Map<string, CollaboratorAttribution>;
  aiLocked?: boolean;
  onRefreshDay?: () => void;
  isRefreshingDay?: boolean;
  refreshResult?: RefreshResult | null;
  onDismissRefresh?: () => void;
  onApplyRefreshChanges?: (changes: ProposedChange[]) => void;
  /** Guest in propose & vote mode — show reduced menu with only Propose Replacement */
  guestMustPropose?: boolean;
  /** Persisted option group selections: map of optionGroup key → selected activity id */
  optionSelections?: Record<string, string>;
  /** Called when user picks an option in an option group */
  onOptionSelect?: (groupKey: string, selectedId: string) => void;
  /** Compact card mode for Smart Finish / manual trips — matches regular itinerary layout */
  compactCards?: boolean;
   /** Whether this is a past trip — shows guide bookmark button */
   isPastTrip?: boolean;
   /** Clean preview mode — hides all builder tools */
   isCleanPreview?: boolean;
   /** Whether an edit modal is currently open — disables drag */
   isModalEditing?: boolean;
   /** Callback to report resolved photo for batch write-back */
   onPhotoResolved?: (activityId: string, photoUrl: string) => void;
   /** Manual builder mode — skip real photo fetching to avoid API costs */
   isManualMode?: boolean;
   /** Handler to open AI concierge for an activity */
   onOpenConcierge?: (activity: EditorialActivity, dayIndex: number, activityIndex: number) => void;
   /** Handler to delete an AI saved note */
   onDeleteAINote?: (activityId: string, noteId: string) => void;
   /** Canonical per-day breakdown from activity_costs (single source of truth) */
   dayBreakdown?: DayBreakdown;
}

export function DayCard({
  day,
  dayIndex,
  totalDays,
  travelers,
  budgetTier,
  tripCurrency,
  displayCost,
  destination,
  destinationCountry,
  isExpanded,
  isRegenerating,
  isEditable,
  isPreview = false,
  canViewPremium: canViewPremiumProp,
  tripId,
  highlightedActivityIds = [],
  getPaymentForItem,
  refreshPayments,
  onToggle,
  onActivitySwap,
  swapCapInfo,
  onActivityLock,
  onActivityMove,
  onMoveToDay,
  onCopyToDay,
  onActivityRemove,
  onActivityReorder,
  onDayLock,
  onDayRegenerate,
  onAddActivity,
  onDiscover,
  onImportActivities,
  onTimeEdit,
  onActivityEdit,
  onPaymentRequest,
  onBookingStateChange,
  onViewReviews,
  onUnlockTrip,
  onUnlockDay,
  unlockingDayNumber,
  onTransportModeChange,
  changingTransportActivityId,
  onSetActivityTransportation,
  collaboratorColorMap,
  aiLocked,
  guestMustPropose,
  optionSelections = {},
  onOptionSelect,
  onRefreshDay,
  isRefreshingDay = false,
  refreshResult,
  onDismissRefresh,
  onApplyRefreshChanges,
  compactCards = false,
  isPastTrip = false,
  isCleanPreview = false,
  isModalEditing = false,
  onPhotoResolved,
  isManualMode = false,
  onOpenConcierge,
  onDeleteAINote,
  dayBreakdown,
}: DayCardProps) {
  // Per-day preview: a day is preview only if the global flag is set AND the day itself is a preview
  // Fully generated days (e.g., first 2 free days) should NOT be gated even if other days are locked
  const dayIsPreview = isPreview && !!(day.metadata?.isPreview);
  // Premium content visibility: use entitlement prop, fallback to !dayIsPreview for backward compat
  const canViewPremium = canViewPremiumProp !== undefined ? canViewPremiumProp : !dayIsPreview;
  const allLocked = day.activities.every(a => a.isLocked);
  // Day badge cost: prefer the canonical activity_costs breakdown (group cost,
  // matches trip-total source). Falls back to the JS estimator while the
  // breakdown is loading or unavailable. We render per-person to match the
  // existing /pp UI when travelers > 1.
  const breakdownGroupUsd = dayBreakdown ? dayBreakdown.totalCents / 100 : null;
  const breakdownPerPersonUsd = breakdownGroupUsd != null
    ? breakdownGroupUsd / Math.max(1, travelers || 1)
    : null;
  const fallbackPerPersonUsd = getDayTotalCost(day.activities, travelers, budgetTier, destination, destinationCountry, isManualMode);
  const totalCost = dayIsPreview
    ? 0
    : (breakdownPerPersonUsd != null ? breakdownPerPersonUsd : fallbackPerPersonUsd);

  // Transit subtotal — sum costs of transport/transit activities so the day
  // badge can break down "visible activities + transit = day total". Without
  // this, transport rows (filtered out of the visible card list) silently
  // inflate the day total and create an unaccounted-for gap for users.
  const transitSubtotal = dayIsPreview ? 0 : day.activities.reduce((sum, act) => {
    const cat = (act.category || '').toLowerCase();
    const typ = ((act as any).type || '').toLowerCase();
    const isTransit = cat === 'transportation' || cat === 'transport' || cat === 'transit'
      || typ === 'transportation' || typ === 'transport' || typ === 'transit';
    if (!isTransit) return sum;
    const info = getActivityCostInfo(act, travelers, budgetTier, destination, destinationCountry, isManualMode);
    return sum + (isManualMode ? info.amount : (info.isEstimated ? 0 : info.amount));
  }, 0);
  // Airport-transfer subtotal — only labels a row as "airport taxi" when it's
  // a real paid transfer (vehicle keyword in TITLE alongside "airport"), not
  // when the title/description merely mentions the airport in passing. Walking
  // legs and zero-cost rows never count. This prevents Day 1 from showing
  // "(incl. €130 airport taxi)" for a trip whose paid transfer is on Day 3.
  const AIRPORT_TAXI_TITLE_RE = /(airport).{0,40}(taxi|transfer|shuttle|car service|private car|water taxi|alilaguna|limo|sedan|minivan|ride)|(taxi|transfer|shuttle|car service|private car|water taxi|alilaguna|limo|sedan|minivan|ride).{0,40}(airport)/i;
  const airportTransferSubtotal = dayIsPreview ? 0 : day.activities.reduce((sum, act) => {
    const cat = (act.category || '').toLowerCase();
    const typ = ((act as any).type || '').toLowerCase();
    const isTransit = cat === 'transportation' || cat === 'transport' || cat === 'transit'
      || typ === 'transportation' || typ === 'transport' || typ === 'transit';
    if (!isTransit) return sum;
    if (isWalkingLeg({ title: act.title, description: act.description })) return sum;
    const title = `${act.title || ''} ${(act as any).name || ''}`;
    if (!AIRPORT_TAXI_TITLE_RE.test(title)) return sum;
    const info = getActivityCostInfo(act, travelers, budgetTier, destination, destinationCountry, isManualMode);
    const amt = isManualMode ? info.amount : (info.isEstimated ? 0 : info.amount);
    if (amt <= 0) return sum;
    return sum + amt;
  }, 0);
  const otherTransitSubtotal = Math.max(0, transitSubtotal - airportTransferSubtotal);
  const visibleActivitiesSubtotal = Math.max(0, totalCost - transitSubtotal);

  // Dev-only sanity check: warn loudly if cards sum diverges from badge >5%.
  if (process.env.NODE_ENV !== 'production' && !dayIsPreview && totalCost > 0) {
    const cardSum = day.activities.reduce((s, a) => {
      const i = getActivityCostInfo(a, travelers, budgetTier, destination, destinationCountry, isManualMode);
      if (i.isEstimated && !isManualMode) return s;
      const perPp = i.basis === 'per_person' ? i.amount : i.amount / Math.max(travelers, 1);
      return s + perPp;
    }, 0);
    if (cardSum > 0 && Math.abs(cardSum - totalCost) / totalCost > 0.05) {
      // eslint-disable-next-line no-console
      console.warn(`[DayCard] Day ${day.dayNumber} badge $${totalCost.toFixed(2)} vs cards sum $${cardSum.toFixed(2)} (>5% drift)`);
    }
  }
  
  // Transport details toggle - collapsed by default to reduce visual noise
  const [showTransportDetails, setShowTransportDetails] = useState(false);
  
  // Normalize destination for image lookups
  const cleanDestination = normalizeDestination(destination);

  const getSelectedOptionForGroup = (groupKey: string): EditorialActivity | null => {
    const groupOptions = day.activities.filter(a => a.optionGroup === groupKey);
    const selectedId = optionSelections[groupKey] || groupOptions[0]?.id;
    return groupOptions.find(a => a.id === selectedId) || groupOptions[0] || null;
  };

  const findNextVisibleActivity = (startIndex: number): EditorialActivity | null => {
    for (let i = startIndex + 1; i < day.activities.length; i += 1) {
      const candidate = day.activities[i];
      if (!(candidate.isOption && candidate.optionGroup)) return candidate;
      const selectedInGroup = getSelectedOptionForGroup(candidate.optionGroup);
      if (selectedInGroup?.id === candidate.id) return candidate;
    }
    return null;
  };

  const visibleActivitiesCount = day.activities.reduce((count, candidate) => {
    if (!(candidate.isOption && candidate.optionGroup)) return count + 1;
    const selectedInGroup = getSelectedOptionForGroup(candidate.optionGroup);
    return selectedInGroup?.id === candidate.id ? count + 1 : count;
  }, 0);

  // Library modal state removed - agent features disabled

  // In clean preview: always expanded, simplified card style
  const effectiveExpanded = isCleanPreview ? true : isExpanded;

  return (
    <div
      id={`day-${day.dayNumber}`}
      className={cn(
        "overflow-hidden rounded-xl transition-shadow scroll-mt-24",
        isCleanPreview
          ? "border-0 shadow-none bg-transparent"
          : "border border-border bg-card shadow-none sm:shadow-sm sm:hover:shadow-md"
      )}
      data-tour="day-header"
    >
      {/* Day Header - Editorial Style with Color Accent */}
      <div className={cn(
        "relative p-4 sm:p-6 transition-colors duration-500",
        allLocked 
          ? "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-accent/5" 
          : "bg-gradient-to-r from-primary/5 via-transparent to-accent/5"
      )}>
        {/* Decorative accent bar */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1 transition-colors duration-500",
          allLocked
            ? "bg-gradient-to-b from-emerald-500 via-emerald-400 to-emerald-500/50"
            : "bg-gradient-to-b from-primary via-accent to-primary/50"
        )} />
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative shrink-0">
              <span className={cn(
                "font-serif font-light transition-colors duration-500",
                "text-sm sm:text-5xl",
                allLocked ? "text-emerald-500/50" : "text-primary/40"
              )}>
                <span className="sm:hidden font-sans font-semibold text-xs uppercase tracking-wider">Day {day.dayNumber}</span>
                <span className="hidden sm:inline">{String(day.dayNumber).padStart(2, '0')}</span>
              </span>
              <div className="hidden sm:block absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 sm:w-8 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            </div>
            <div className="min-w-0 flex-1">
              {/* City badge for multi-city trips */}
              {day.city && (
                <div className="flex items-center gap-1.5 mb-0.5 sm:mb-1 flex-wrap">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 bg-primary/10 text-foreground font-medium">
                    <MapPin className="h-2.5 w-2.5 mr-0.5" />
                    {day.city}{(() => { const rc = resolveCountry(day.city!, day.country); return rc ? `, ${rc}` : ''; })()}
                  </Badge>
                  {day.isTransitionDay && day.transitionFrom && day.transitionTo && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border bg-card text-foreground font-medium">
                      <ArrowRight className="h-2.5 w-2.5 mr-0.5" />
                      {day.transitionFrom} → {day.transitionTo}
                    </Badge>
                  )}
                </div>
              )}
              <h3 className="font-serif text-base sm:text-xl font-medium text-foreground mb-0 sm:mb-1 truncate">
                {getDisplayDayTitle(day as any, destination) || `Day ${day.dayNumber}`}
              </h3>
              {day.description && (
                <p className="hidden sm:block text-sm text-muted-foreground italic line-clamp-1 sm:line-clamp-none">{day.description}</p>
              )}
            </div>
          </div>

          {/* Day Actions */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide pl-8 sm:pl-0">
              {allLocked && (
                <Badge variant="outline" className="text-xs font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 gap-1">
                  <Check className="h-3 w-3" />
                  Planned
                </Badge>
              )}
             {!isCleanPreview && (
             <Tooltip delayDuration={200}>
               <TooltipTrigger asChild>
                 <Badge variant="outline" className="text-xs sm:text-sm font-semibold border-primary/30 bg-primary/5 text-primary shrink-0 cursor-default">
                   {totalCost > 0 ? `${formatCurrency(Math.floor(displayCost(totalCost)), tripCurrency)}${travelers > 1 ? '/pp' : ''}` : 'Free'}
                 </Badge>
              </TooltipTrigger>
               <TooltipContent side="bottom">
                  {totalCost > 0 && transitSubtotal > 0 ? (
                    <div className="text-xs space-y-0.5 min-w-[140px]">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Activities</span>
                        <span className="font-medium tabular-nums">{formatCurrency(Math.floor(displayCost(visibleActivitiesSubtotal)), tripCurrency)}</span>
                      </div>
                      {airportTransferSubtotal > 0 && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Airport transfer</span>
                          <span className="font-medium tabular-nums">{formatCurrency(Math.floor(displayCost(airportTransferSubtotal)), tripCurrency)}</span>
                        </div>
                      )}
                      {otherTransitSubtotal > 0 && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">{airportTransferSubtotal > 0 ? 'Local transit' : 'Transit & transfers'}</span>
                          <span className="font-medium tabular-nums">{formatCurrency(Math.floor(displayCost(otherTransitSubtotal)), tripCurrency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3 pt-0.5 mt-0.5 border-t border-border">
                        <span className="font-semibold">Day total{travelers > 1 ? ' /pp' : ''}</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(Math.floor(displayCost(totalCost)), tripCurrency)}</span>
                      </div>
                    </div>
                  ) : (
                   <span className="text-xs font-medium">Confirmed costs only</span>
                 )}
               </TooltipContent>
             </Tooltip>
             )}
             {day.weather && (
              <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-secondary/50 text-xs sm:text-sm shrink-0">
                {weatherIcons[day.weather.condition?.toLowerCase() || 'sunny']}
                {day.weather.high && <span className="font-medium">{day.weather.high}°</span>}
              </div>
            )}
            {/* Desktop: show all action buttons inline */}
            {!dayIsPreview && (
            <div className="hidden sm:flex items-center gap-1.5">
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button
                  variant={showTransportDetails ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowTransportDetails(prev => !prev)}
                  className={cn(
                    "h-8 gap-1.5 text-xs font-medium transition-all shrink-0 px-3",
                    showTransportDetails 
                      ? "bg-primary text-primary-foreground" 
                      : "border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                  )}
                  aria-label={showTransportDetails ? 'Hide Routes' : 'Show Routes'}
                >
                  <Route className="h-3.5 w-3.5" />
                  <span>{showTransportDetails ? 'Hide Routes' : 'Show Routes'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span className="text-xs font-medium">{showTransportDetails ? 'Hide Routes' : 'Show Routes'}</span>
              </TooltipContent>
            </Tooltip>
            </div>
            )}
             {isEditable && !isCleanPreview && (
              <div className="hidden sm:flex items-center gap-1">
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDayLock(dayIndex)}
                      className="h-8 w-8 hover:bg-primary/10 shrink-0"
                      aria-label={allLocked ? 'Unlock Day' : 'Lock Day'}
                    >
                      {allLocked ? <Lock className="h-4 w-4 text-primary" /> : <Unlock className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <span className="text-xs font-medium">{allLocked ? 'Unlock Day' : 'Lock Day'}</span>
                  </TooltipContent>
                </Tooltip>
                {!aiLocked && (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onDayRegenerate}
                      disabled={isRegenerating}
                      className="h-8 w-8 hover:bg-accent/10 shrink-0"
                      aria-label="Regenerate Day"
                      data-tour="regenerate-button"
                    >
                      <RefreshCw className={cn("h-4 w-4", isRegenerating && "animate-spin text-accent")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <span className="text-xs font-medium">Regenerate Day</span>
                  </TooltipContent>
                </Tooltip>
                )}
              </div>
            )}
            {/* Mobile: overflow menu for Routes/Lock/Regenerate */}
            <div className="sm:hidden flex items-center gap-1">
              {(isEditable || !dayIsPreview) && !isCleanPreview && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-7 sm:w-7 shrink-0">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4} className="w-44">
                    {!dayIsPreview && (
                      <DropdownMenuItem onClick={() => setShowTransportDetails(prev => !prev)}>
                        <Route className="h-3.5 w-3.5 mr-2" />
                        {showTransportDetails ? 'Hide Routes' : 'Show Routes'}
                      </DropdownMenuItem>
                    )}
                    {isEditable && (
                      <>
                        <DropdownMenuItem onClick={() => onDayLock(dayIndex)}>
                          {allLocked ? <Lock className="h-3.5 w-3.5 mr-2" /> : <Unlock className="h-3.5 w-3.5 mr-2" />}
                          {allLocked ? 'Unlock Day' : 'Lock Day'}
                        </DropdownMenuItem>
                        {!aiLocked && (
                          <DropdownMenuItem onClick={onDayRegenerate} disabled={isRegenerating}>
                            <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isRegenerating && "animate-spin")} />
                            Regenerate Day
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
             {!isCleanPreview && (
             <Tooltip delayDuration={200}>
               <TooltipTrigger asChild>
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={onToggle}
                   className="h-7 w-7 sm:h-8 sm:w-8 shrink-0"
                   aria-label={effectiveExpanded ? 'Collapse Day' : 'Expand Day'}
                 >
                   {effectiveExpanded ? <ChevronUp className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> : <ChevronDown className="h-3.5 sm:h-4 w-3.5 sm:w-4" />}
                 </Button>
               </TooltipTrigger>
               <TooltipContent side="bottom">
                 <span className="text-xs font-medium">{effectiveExpanded ? 'Collapse Day' : 'Expand Day'}</span>
               </TooltipContent>
             </Tooltip>
             )}
          </div>
        </div>
      </div>

      {/* Activities */}
      <AnimatePresence initial={false}>
         {effectiveExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="border-t border-border">
              {/* Transition Day: Transport Comparison Card */}
              {day.isTransitionDay && day.transitionFrom && day.transitionTo && day.transportComparison && (day.transportComparison as any[]).length > 0 && (
                <div className="p-4 border-b border-border bg-muted/30">
                  <TransportComparisonCard
                    transitionFrom={day.transitionFrom}
                    transitionTo={day.transitionTo}
                    options={day.transportComparison as any}
                    selectedId={day.selectedTransportId}
                  />
                </div>
              )}
              {/* Transition Day: Fallback banner when no transport comparison data */}
              {day.isTransitionDay && day.transitionFrom && day.transitionTo && (!day.transportComparison || (day.transportComparison as any[]).length === 0) && (
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-accent/5">
                  <Train className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Travel day:</span>{' '}
                    {day.transitionFrom} → {day.transitionTo}
                  </p>
                </div>
              )}
              {/* Route Map — shown when Show Routes is active */}
              <AnimatePresence>
                {showTransportDetails && (
                  <DayRouteMap activities={day.activities} />
                )}
              </AnimatePresence>
              {/* Day-level buffer warning — consolidates per-activity zero-gap noise */}
              {(() => {
                if (dayIsPreview || isCleanPreview) return null;
                // Hide heuristic banner when authoritative refresh result is active
                if (refreshResult && refreshResult.dayNumber === day.dayNumber) return null;
                const acts = day.activities || [];
                let zeroGapCount = 0;
                // Transit/logistics entries ARE the travel buffer — a pair touching
                // one is fine. Route rows may be typed transportation/transit/travel/
                // logistics/flight, or only recognisable by a "Travel to…" title, so
                // match broadly. The old check only caught the exact category
                // 'transport', which is why visible route rows still triggered a
                // false "no travel buffer" warning.
                const isTransit = (a: any) => {
                  const cat = (a?.category || a?.type || '').toLowerCase();
                  if (['transport', 'transportation', 'transit', 'travel', 'logistics', 'flight', 'accommodation'].includes(cat)) return true;
                  return /\b(travel (?:to|through|past)|walk to|drive|driving|transfer|taxi|uber|lyft|train to|bus to|ferry|en route|head (?:to|toward))\b/i.test(String(a?.title || a?.name || ''));
                };
                for (let i = 0; i < acts.length - 1; i++) {
                  if (isTransit(acts[i]) || isTransit(acts[i + 1])) continue;

                  const gap = computeGapMinutes(
                    acts[i].endTime,
                    acts[i].startTime || (acts[i] as any).time,
                    acts[i].duration,
                    acts[i + 1].startTime || (acts[i + 1] as any).time,
                  );
                  if (gap !== null && gap <= 0) {
                    const sameLocation = !!(acts[i].location?.name && acts[i + 1].location?.name && acts[i].location.name === acts[i + 1].location.name);
                    if (!sameLocation) zeroGapCount++;
                  }
                }
                // Store on day element for child suppression via data attribute
                (day as any).__zeroGapCount = zeroGapCount;
                if (zeroGapCount < 1) return null;
                return (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/30">
                    <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">{zeroGapCount} {zeroGapCount === 1 ? 'stop' : 'stops'}</span> may need a travel buffer. Smart Finish can verify route timing.
                      </p>
                    </div>
                    {onRefreshDay && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onRefreshDay}
                        disabled={isRefreshingDay}
                        className="h-8 px-3 text-xs shrink-0 self-end sm:self-auto"
                        aria-label="Refresh day to fix timing"
                      >
                        <RefreshCw className={cn("h-3 w-3 mr-1", isRefreshingDay && "animate-spin")} aria-hidden="true" />
                        {isRefreshingDay ? 'Refreshing…' : 'Refresh Day'}
                      </Button>
                    )}
                  </div>
                );
              })()}
              {/* Dead-gap nudge — surfaces unplanned 3h+ windows during the active day */}
              {(() => {
                if (dayIsPreview || isCleanPreview) return null;
                if (!isEditable) return null;
                if (!onAddActivity) return null;
                const gaps = computeDeadGaps(day.activities || [], { minMinutes: 240 });
                if (gaps.length === 0) return null;
                const gap = gaps.sort((a, b) => b.minutes - a.minutes)[0];
                const beforeAct = day.activities[gap.beforeIndex];
                const afterAct = day.activities[gap.beforeIndex + 1];
                return (
                  <DeadGapBanner
                    gap={gap}
                    context={{
                      destination,
                      dayNumber: day.dayNumber,
                      date: day.date,
                      activities: day.activities.map(a => ({
                        id: a.id, title: a.title, startTime: a.startTime, endTime: a.endTime, category: a.category,
                      })),
                      beforeId: beforeAct?.id,
                      afterId: afterAct?.id,
                      budgetTier,
                      tripCurrency,
                    }}
                    onAddManually={() => onAddActivity?.(gap.beforeIndex)}
                    onAcceptSuggestion={(afterIndex, activity) => {
                      onAddActivity?.(afterIndex);
                      // Defer to next tick so AddActivityModal can be pre-filled by parent if wired.
                      // Parent's existing handleAddActivity will run via the modal flow as fallback.
                      setTimeout(() => {
                        const evt = new CustomEvent('lovable:fill-dead-gap-accept', { detail: { afterIndex, activity } });
                        window.dispatchEvent(evt);
                      }, 0);
                    }}
                  />
                );
              })()}
              <DraggableActivityList
                items={day.activities}
                onReorder={(reordered) => onActivityReorder?.(reordered)}
                highlightedIds={highlightedActivityIds}
                disabled={!isEditable || isPreview || isCleanPreview || isModalEditing}
                renderItem={(activity, activityIndex, isDragging, isHighlighted) => {
                  // Collapse option groups to one curated activity in default view (no radio choices)
                  let activityToRender = activity;
                  let activityRenderIndex = activityIndex;
                  let nextLookupStartIndex = activityIndex;

                  if (activity.isOption && activity.optionGroup) {
                    const groupKey = activity.optionGroup;
                    const firstInGroup = day.activities.findIndex(a => a.optionGroup === groupKey);
                    if (firstInGroup !== activityIndex) {
                      return null;
                    }

                    const selectedInGroup = getSelectedOptionForGroup(groupKey);
                    if (!selectedInGroup) return null;

                    activityToRender = selectedInGroup;
                    activityRenderIndex = day.activities.findIndex(a => a.id === selectedInGroup.id);
                    nextLookupStartIndex = activityRenderIndex;
                  }

                  const nextActivity = findNextVisibleActivity(nextLookupStartIndex);
                  const isLastActivity = !nextActivity;
                  const hasTransitBadgeVisible = showTransportDetails && !!activityToRender.transportation && !isLastActivity;
                  
                  // Compute gap to next activity
                  const gapMinutes = nextActivity 
                    ? computeGapMinutes(
                        activityToRender.endTime,
                        activityToRender.startTime || activityToRender.time,
                        activityToRender.duration,
                        nextActivity.startTime || nextActivity.time,
                      )
                    : null;

                  // Compute time-of-day label for section headers.
                  // Uses shared `timeOfDayBand` so a 00:16 late-nightlife
                  // bookend reads as "Late Night" (not "Morning") — see
                  // mem://constraints/itinerary/late-nightlife-no-next-day-bleed.
                  const activityTime = activityToRender.startTime || activityToRender.time || '';
                  const timeOfDay = timeOfDayBand(activityTime);

                  // Determine previous activity's time-of-day for section header logic
                  const prevVisibleActivity = activityIndex > 0 ? (() => {
                    for (let i = activityIndex - 1; i >= 0; i--) {
                      const a = day.activities[i];
                      if (a.isOption && a.optionGroup) {
                        const firstInGroup = day.activities.findIndex(x => x.optionGroup === a.optionGroup);
                        if (firstInGroup !== i) continue;
                      }
                      return a;
                    }
                    return null;
                  })() : null;
                  const prevTime = prevVisibleActivity ? (prevVisibleActivity.startTime || (prevVisibleActivity as any).time || '') : '';
                  const prevTimeOfDay = timeOfDayBand(prevTime);
                  const showTimeOfDayHeader = timeOfDay && timeOfDay !== prevTimeOfDay;

                  // Compact inter-city transport card (unified for transition + departure)
                  const isInterCityTransport = !!(activityToRender as any).__interCityTransport;
                  const travelMeta = (activityToRender as any).__travelMeta;

                  if (isInterCityTransport && travelMeta) {
                    if (isCleanPreview) return null;

                    const isFinalDeparture = !!(activityToRender as any).__syntheticFinalDeparture;
                    return (
                      <div key={activityToRender.id} className="transition-all duration-300">
                        {/* Mobile: Card wrapper with timeline */}
                        <div className="sm:hidden relative py-2 pl-7 pr-2">
                          {/* Timeline line */}
                          <div className={cn(
                            "absolute left-3 top-0 bottom-0 w-0.5 bg-primary/15",
                            activityIndex === 0 && "top-5",
                            isLastActivity && "bottom-5"
                          )} />
                          {/* Timeline dot */}
                          <div className="absolute left-[7px] top-5 w-3 h-3 rounded-full border-2 border-primary bg-background z-10 shadow-sm" />
                          <InterCityTransportCard
                            title={activityToRender.title || ''}
                            travelMeta={travelMeta}
                            variant={isFinalDeparture ? 'final' : 'default'}
                          />
                        </div>
                        {/* Desktop: flat layout matching activity rows */}
                        <div className="hidden sm:block">
                          <InterCityTransportCard
                            title={activityToRender.title || ''}
                            travelMeta={travelMeta}
                            variant={isFinalDeparture ? 'final' : 'default'}
                          />
                        </div>
                      </div>
                    );
                  }

                  return (
                  <div className={cn(
                    "transition-all duration-300",
                    isHighlighted && "bg-primary/5"
                  )}>
                    {/* Mobile: Time-of-day section header */}
                    {showTimeOfDayHeader && (
                      <div className="sm:hidden flex items-center gap-2 px-4 pt-4 pb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
                          {timeOfDay}
                        </span>
                        <div className="flex-1 h-px bg-primary/10" />
                      </div>
                    )}
                    {/* Mobile: Card wrapper with timeline */}
                    <div className={cn(
                      "sm:hidden relative py-2",
                      isCleanPreview ? "pl-4 pr-4" : "pl-7 pr-2"
                    )}>
                      {/* Timeline line — hidden in clean preview */}
                      {!isCleanPreview && (
                        <div className={cn(
                          "absolute left-3 top-0 bottom-0 w-0.5 bg-primary/15",
                          activityIndex === 0 && "top-5",
                          isLastActivity && "bottom-5"
                        )} />
                      )}
                      {/* Timeline dot — hidden in clean preview */}
                      {!isCleanPreview && (
                        <div className="absolute left-[7px] top-5 w-3 h-3 rounded-full border-2 border-primary bg-background z-10 shadow-sm" />
                      )}
                      {/* Card */}
                      <div className={cn(
                        "overflow-hidden",
                        isCleanPreview
                          ? "bg-transparent border-0 shadow-none mb-6"
                          : "bg-card rounded-xl border border-border shadow-sm mb-1"
                      )}>
                        <ActivityRow
                          activity={activityToRender}
                          destination={cleanDestination}
                          destinationCountry={destinationCountry}
                          dayIndex={dayIndex}
                          activityIndex={activityRenderIndex}
                          totalActivities={visibleActivitiesCount}
                          totalDays={totalDays}
                          isLast={isLastActivity}
                          isEditable={isEditable}
                          guestMustPropose={guestMustPropose}
                          isPreview={dayIsPreview}
                          canViewPremium={canViewPremium}
                          travelers={travelers}
                          budgetTier={budgetTier}
                          tripCurrency={tripCurrency}
                          displayCost={displayCost}
                          tripId={tripId}
                          showTransportDetails={showTransportDetails}
                          existingPayment={getPaymentForItem('activity', activityToRender.id)}
                          onPaymentSuccess={refreshPayments}
                          onLock={onActivityLock}
                          onSwap={onActivitySwap}
                          swapCapInfo={swapCapInfo}
                          onMove={onActivityMove}
                          onMoveToDay={onMoveToDay}
                          onCopyToDay={onCopyToDay}
                          onRemove={onActivityRemove}
                          onTimeEdit={onTimeEdit}
                          onEdit={onActivityEdit}
                          onPaymentRequest={onPaymentRequest}
                          onBookingStateChange={onBookingStateChange}
                          onViewReviews={aiLocked ? undefined : onViewReviews}
                          onTransportModeChange={onTransportModeChange}
                          changingTransportActivityId={changingTransportActivityId}
                          transitOrigin={prevVisibleActivity?.location?.name || prevVisibleActivity?.location?.address || prevVisibleActivity?.title}
                          collaboratorColorMap={collaboratorColorMap}
                          aiLocked={aiLocked}
                          compact={compactCards}
                          isPastTrip={isPastTrip}
                          isCleanPreview={isCleanPreview}
                          onPhotoResolved={onPhotoResolved}
                          isManualMode={isManualMode}
                          onOpenConcierge={onOpenConcierge}
                          onDeleteAINote={onDeleteAINote}
                        />
                      </div>
                    </div>
                    {/* Desktop: original flat layout */}
                    <div className="hidden sm:block">
                      <ActivityRow
                        activity={activityToRender}
                        destination={cleanDestination}
                        destinationCountry={destinationCountry}
                        dayIndex={dayIndex}
                        activityIndex={activityRenderIndex}
                        totalActivities={visibleActivitiesCount}
                        totalDays={totalDays}
                        isLast={isLastActivity}
                        isEditable={isEditable}
                        guestMustPropose={guestMustPropose}
                        isPreview={dayIsPreview}
                        canViewPremium={canViewPremium}
                        travelers={travelers}
                        budgetTier={budgetTier}
                        tripCurrency={tripCurrency}
                        displayCost={displayCost}
                        tripId={tripId}
                        showTransportDetails={showTransportDetails}
                        existingPayment={getPaymentForItem('activity', activityToRender.id)}
                        onPaymentSuccess={refreshPayments}
                        onLock={onActivityLock}
                        onSwap={onActivitySwap}
                        swapCapInfo={swapCapInfo}
                        onMove={onActivityMove}
                        onMoveToDay={onMoveToDay}
                        onCopyToDay={onCopyToDay}
                        onRemove={onActivityRemove}
                        onTimeEdit={onTimeEdit}
                        onEdit={onActivityEdit}
                        onPaymentRequest={onPaymentRequest}
                        onBookingStateChange={onBookingStateChange}
                        onViewReviews={aiLocked ? undefined : onViewReviews}
                        onTransportModeChange={onTransportModeChange}
                        changingTransportActivityId={changingTransportActivityId}
                        transitOrigin={prevVisibleActivity?.location?.name || prevVisibleActivity?.location?.address || prevVisibleActivity?.title}
                        collaboratorColorMap={collaboratorColorMap}
                        aiLocked={aiLocked}
                        compact={compactCards}
                        isPastTrip={isPastTrip}
                          isCleanPreview={isCleanPreview}
                          onPhotoResolved={onPhotoResolved}
                          isManualMode={isManualMode}
                          onOpenConcierge={onOpenConcierge}
                          onDeleteAINote={onDeleteAINote}
                        />
                    </div>
                    {/* Compact transit gap indicator between activities */}
                    {!isLastActivity && gapMinutes !== null && !dayIsPreview && !isCleanPreview && (
                      <TransitGapIndicator
                        gapMinutes={gapMinutes}
                        transportation={activityToRender.transportation}
                        hasTransitBadge={hasTransitBadgeVisible}
                        currentCategory={activityToRender.category || activityToRender.type}
                        nextCategory={nextActivity?.category || nextActivity?.type}
                        sameLocation={isFuzzyLocationMatch(activityToRender.location, nextActivity?.location)}
                        city={cleanDestination}
                        originName={activityToRender.location?.name || activityToRender.title}
                        destinationName={nextActivity?.location?.name || nextActivity?.title}
                        isEditable={isEditable}
                        tripCurrency={tripCurrency}
                        travelers={travelers}
                        suppressZeroGap={((day as any).__zeroGapCount ?? 0) >= 1}
                        onSelectMode={isEditable && onSetActivityTransportation ? (mode, duration, cost, instructions) => {
                          onSetActivityTransportation(dayIndex, activityIndex, {
                            method: mode,
                            duration,
                            ...(cost ? { estimatedCost: cost } : {}),
                            ...(instructions ? { instructions } : {}),
                          });
                        } : undefined}
                      />
                    )}
                    {/* Free time marker — calm acknowledgment of unscheduled stretches */}
                    {!isLastActivity && !dayIsPreview && !isCleanPreview && (() => {
                      const ow = computeOpenWindows(
                        [activityToRender, nextActivity].filter(Boolean) as any[],
                      );
                      if (ow.length === 0) return null;
                      return (
                        <FreeTimeMarker
                          window={ow[0]}
                          tripId={tripId}
                          dayNumber={day.dayNumber}
                          beforeActivityId={activityToRender.id}
                          isEditable={isEditable}
                          onAdd={isEditable && onAddActivity ? () => onAddActivity(activityIndex) : undefined}
                        />
                      );
                    })()}
                    {/* Inline Add Activity button between activities */}
                    {isEditable && !isLastActivity && !isCleanPreview && (
                      <div className="flex justify-center sm:justify-start sm:pl-[12.5rem] py-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={() => onAddActivity(activityIndex)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-3 py-1 rounded-full border border-dashed border-border hover:border-primary/40 bg-background"
                        >
                          <Plus className="h-3 w-3" />
                          Add activity
                        </button>
                      </div>
                    )}
                  </div>
                  );
                }}
              />
            </div>

            {/* Day Footer — hidden in clean preview */}
            {!isCleanPreview && (
            <div className="px-6 py-4 bg-gradient-to-r from-secondary/30 via-secondary/20 to-secondary/30 border-t border-border">
              {dayIsPreview ? (
                /* Preview Per-Day Unlock CTA */
                <div className="flex flex-col items-center gap-3 py-2">
                  {unlockingDayNumber === day.dayNumber ? (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Enriching Day {day.dayNumber}...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Lock className="h-4 w-4" />
                        <span>Addresses, photos, tips & booking links are locked</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          className="gap-2"
                          onClick={() => onUnlockDay?.(day.dayNumber)}
                        >
                          <Sparkles className="h-4 w-4" />
                          Unlock Day {day.dayNumber}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 sm:gap-6 text-muted-foreground">
                    {day.estimatedWalkingTime && (
                      <span className="flex items-center gap-1.5">
                        <Route className="h-4 w-4" />
                        Walking: {day.estimatedWalkingTime}
                      </span>
                    )}
                    {day.estimatedDistance && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        Distance: {day.estimatedDistance}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
                    {isEditable && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAddActivity()}
                          className="h-8 gap-1.5 px-2.5 sm:px-3"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span className="hidden md:inline">Add</span>
                        </Button>

                        {onDiscover && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={onDiscover}
                            className="h-8 gap-1.5 px-2.5 sm:px-3"
                          >
                            <Compass className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Discover</span>
                          </Button>
                        )}

                        {onImportActivities && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={onImportActivities}
                            className="h-8 gap-1.5 px-2.5 sm:px-3"
                          >
                            <ClipboardPaste className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Import</span>
                          </Button>
                        )}

                        {onRefreshDay && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRefreshDay}
                            disabled={isRefreshingDay}
                            className="h-8 gap-1.5 px-2.5 sm:px-3"
                          >
                            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshingDay && "animate-spin")} />
                            <span className="hidden md:inline">{isRefreshingDay ? 'Refreshing…' : 'Refresh'}</span>
                          </Button>
                        )}
                      </>
                    )}

                    {transitSubtotal > 0 ? (
                      <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                          <span className="font-medium text-foreground px-3 py-1 rounded-full bg-primary/10 text-primary cursor-default">
                            Day Total: {formatCurrency(Math.floor(displayCost(totalCost)), tripCurrency)}{travelers > 1 ? '/pp' : ''}
                            <span className="ml-1.5 text-[11px] font-normal text-primary/70">
                              {airportTransferSubtotal > 0
                                ? (otherTransitSubtotal > 0
                                    ? `(incl. ${formatCurrency(Math.floor(displayCost(airportTransferSubtotal)), tripCurrency)} airport taxi + ${formatCurrency(Math.floor(displayCost(otherTransitSubtotal)), tripCurrency)} transit)`
                                    : `(incl. ${formatCurrency(Math.floor(displayCost(airportTransferSubtotal)), tripCurrency)} airport taxi)`)
                                : `(incl. ${formatCurrency(Math.floor(displayCost(transitSubtotal)), tripCurrency)} transit)`}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <div className="text-xs space-y-0.5 min-w-[140px]">
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">Activities</span>
                              <span className="font-medium tabular-nums">{formatCurrency(Math.floor(displayCost(visibleActivitiesSubtotal)), tripCurrency)}</span>
                            </div>
                            {airportTransferSubtotal > 0 && (
                              <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">Airport transfer</span>
                                <span className="font-medium tabular-nums">{formatCurrency(Math.floor(displayCost(airportTransferSubtotal)), tripCurrency)}</span>
                              </div>
                            )}
                            {otherTransitSubtotal > 0 && (
                              <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">{airportTransferSubtotal > 0 ? 'Local transit' : 'Transit & transfers'}</span>
                                <span className="font-medium tabular-nums">{formatCurrency(Math.floor(displayCost(otherTransitSubtotal)), tripCurrency)}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-3 pt-0.5 mt-0.5 border-t border-border">
                              <span className="font-semibold">Day total{travelers > 1 ? ' /pp' : ''}</span>
                              <span className="font-semibold tabular-nums">{formatCurrency(Math.floor(displayCost(totalCost)), tripCurrency)}</span>
                            </div>
                            {travelers > 1 && (
                              <>
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">× {travelers} travelers</span>
                                  <span className="font-medium tabular-nums">{formatCurrency(Math.floor(displayCost(totalCost * travelers)), tripCurrency)}</span>
                                </div>
                                <div className="flex justify-between gap-3 pt-0.5 mt-0.5 border-t border-border">
                                  <span className="font-semibold">Day total (group)</span>
                                  <span className="font-semibold tabular-nums">{formatCurrency(Math.floor(displayCost(totalCost * travelers)), tripCurrency)}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="font-medium text-foreground px-3 py-1 rounded-full bg-primary/10 text-primary">
                        Day Total: {formatCurrency(Math.floor(displayCost(totalCost)), tripCurrency)}{travelers > 1 ? '/pp' : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Refresh Day diff is rendered in <RefreshDaySheet /> at the editor root */}
            </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Library modal removed - agent features disabled */}
    </div>
  );
}
