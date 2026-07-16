/**
 * Editorial Itinerary Component
 * 
 * Unified editorial-style itinerary display with editing capabilities.
 * This component matches the SampleItinerary design while supporting:
 * - Lock/unlock activities
 * - Reorder activities (move up/down)
 * - Regenerate individual days
 * - Add manual activities
 * - Delete activities
 * - Save changes
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { getRenderedStartTime, getRenderedEndTime } from '@/lib/itinerary/displayTime';
import { isWeakAddress } from '@/lib/address-quality';
import { dayChronoKey } from '@/lib/itinerary/dayChronoKey';
import { timeOfDayBand } from '@/lib/itinerary/timeOfDayBand';
import { excludedBreakdownLabel } from '@/lib/itinerary/headerStripValues';
import { composeDisplayedTripTotal } from '@/hooks/useDisplayedTripTotal';
import { coerceDurationString } from '@/utils/plannerUtils';
import { useLedgerCostOverrideMap, getLedgerOverride, warnOnceLedgerOverride } from '@/utils/ledgerCostOverride';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp, ChevronDown, MapPin, Clock, Star, Save,
  Lock, Unlock, MoveUp, MoveDown, Plus, RefreshCw,
  Plane, Hotel, Utensils, Camera, ShoppingBag, Palmtree, Car, Trash2,
  Sun, Cloud, CloudRain, CloudSun, Snowflake, Edit3, Sparkles, AlertCircle, AlertTriangle,
  Calendar, Users, ExternalLink, Route, Search, ArrowRightLeft,
  Globe, Wallet, Languages, Train, ChevronLeft, ChevronRight, Info, Images,
  CreditCard, Library, TrendingUp, Share2, Link2, Copy, Check,
  Shield, FileText, HeartPulse, MoreHorizontal, Eye, Coins, MessageCircle, MessageSquarePlus, Loader2, ClipboardPaste, Compass, Bus, Ship, ArrowRight, Droplets, Wrench,
  Footprints, Navigation2, History as HistoryIcon, Lightbulb, CheckCircle2,
} from 'lucide-react';
import { useSpendCredits, canAffordAction, getActionCost } from '@/hooks/useSpendCredits';
import { refundCredits } from '@/utils/refundCredits';
import { convertFromUSD, convertToUSD, formatCurrency, rateDisclosure } from '@/lib/currency';
import { toFriendlyError } from '@/utils/friendlyErrors';
import { enrichAttraction, lookupActivityUrl } from '@/services/enrichmentService';
import { useCredits } from '@/hooks/useCredits';
import { CREDIT_COSTS, formatCredits } from '@/config/pricing';
import { CreditNudge } from './CreditNudge';
import { UnlockBanner } from './UnlockBanner';
import { LockedDayCard } from './LockedDayCard';
import { IntegrityContractBanner } from './IntegrityContractBanner';
import { OmittedMustDosBanner } from './OmittedMustDosBanner';
// TripTotalDeltaIndicator import removed — see comment near header total.
import { useReconcilingState } from '@/hooks/useReconcilingState';
import { FrostedGateOverlay } from './FrostedGateOverlay';
import { BulkUnlockBanner, getBulkUnlockCost } from './BulkUnlockBanner';
import { useUnlockDay } from '@/hooks/useUnlockDay';
import { useBulkUnlock } from '@/hooks/useBulkUnlock';
import { HotelGalleryModal } from './HotelGalleryModal';
import { DraggableActivityList } from './DraggableActivityList';
import { TransportComparisonCard } from './TransportComparisonCard';
import { InterCityTransportCard } from './InterCityTransportCard';
import { AirportHotelTransfer, SelectedTransfer } from './AirportHotelTransfer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { TimeEditModal } from './editorial/TimeEditModal';
import { timeToMinutes, minutesToTime } from './editorial/time-utils';
import { InterCityTransportStrip } from './editorial/InterCityTransportStrip';
import { FlightSyncWarning } from './editorial/FlightSyncWarning';
import { ReconcilingHint, BoardingPassViewButton } from './editorial/small-components';
import { formatTime, sanitizeAiText, isFuzzyLocationMatch, normalizeDestination } from './editorial/format-utils';
import { NeedToKnowSection } from './editorial/NeedToKnowSection';
import { ArrivalGamePlan } from './editorial/ArrivalGamePlan';
import { ActivityRow } from './editorial/ActivityRow';
import { DayCard } from './editorial/DayCard';
import type { EditorialActivity, TransportOption, EditorialDay, FlightLegDisplay, FlightSelection, HotelSelection, CityHotelInfo } from './editorial/types';
// Re-export the shared display types so existing importers of EditorialItinerary keep working.
export type { EditorialActivity, TransportOption, EditorialDay, FlightLegDisplay, FlightSelection, HotelSelection, CityHotelInfo } from './editorial/types';
import { getActivityType, isNoteBlockedActivity, getActivityRating, getActivityReviewCount, getActivityPhoto, getHotelHeroImage } from './editorial/activity-utils';
import { normalizeCurrencyCode, inferCurrencyFromCountry, inferCurrencyFromDays } from './editorial/currency-utils';
import { estimateCostByCategory, isNeverFreeCategory, inferCostBasis, getActivityCostInfoImpl, __cardPriceDebugEnabled, getActivityCostInfo, basisLabel, getActivityCost, getDayTotalCost, type CostBasis, type CostInfo } from './editorial/cost-utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isToday, addDays, isPast, startOfDay } from 'date-fns';
import { safeFormatDate, parseLocalDate } from '@/utils/dateUtils';
import { parseTimeToMinutes } from '@/utils/timeFormat';
import { enforceMealTimeCoherence } from '@/utils/mealTimeCoherence';
import type { ActivityType, ItineraryActivity, WeatherCondition, DayItinerary } from '@/types/itinerary';
import { convertFrontendDayToBackend, convertFrontendActivityToBackend } from '@/types/itinerary';
import { useActivityImage, getActivityPlaceholder } from '@/hooks/useActivityImage';
import { useActivityImageWriteback } from '@/hooks/useActivityImageWriteback';
import { sanitizeActivityName, sanitizeActivityText } from '@/utils/activityNameSanitizer';
import { sanitizeEditorialDays } from '@/utils/itinerarySanitize';
import { resolveActivityDisplayDescription } from '@/lib/itinerary/diningDescriptionFallback';
import { getDisplayDayTitle } from '@/utils/dayTitleCoherence';
import { getActivityFallbackImage } from '@/utils/activityFallbackImages';
import { parseEditorialDays } from '@/utils/itineraryParser';
import { dispatchTripPersisted } from '@/lib/itinerary/resyncItineraryFromDb';
import { getAppUrl } from '@/utils/getAppUrl';
import { resolveInviteLink, getInviteErrorMessage, type InviteHealth } from '@/services/inviteResolver';

import { BlendRecalcBanner } from './BlendRecalcBanner';
import AirlineLogo from '@/components/planner/shared/AirlineLogo';
import { useRefreshDay, type RefreshResult, type ProposedChange } from '@/hooks/useRefreshDay';
import { RefreshDayDiffView } from './RefreshDayDiffView';
import { RefreshDaySheet } from './RefreshDaySheet';
import ActivityAlternativesDrawer from '@/components/planner/ActivityAlternativesDrawer';
import { RegenerateGuidedAssistDialog } from './RegenerateGuidedAssistDialog';
import { WeatherForecast } from './WeatherForecast';
import { preloadCostIndex, estimateCostSync, isLikelyFreePublicVenue, isWalkingLeg } from '@/lib/cost-estimation';
import { computeHotelCostUsd } from '@/lib/hotel-cost';
import { VendorBookingLink } from '@/components/booking/VendorBookingLink';
import { InlineBookingActions } from '@/components/booking/InlineBookingActions';
import { PaymentsTab } from './PaymentsTab';
import { BudgetTab } from '@/components/planner/budget/BudgetTab';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { getTripPayments, type TripPayment } from '@/services/tripPaymentsAPI';
import { useTripBudget } from '@/hooks/useTripBudget';
import { useTripMembers } from '@/services/tripBudgetAPI';

import { useTripFinancialSnapshot } from '@/hooks/useTripFinancialSnapshot';
import { useTripDayBreakdown, type DayBreakdown } from '@/hooks/useTripDayBreakdown';
import { resolveCountry } from '@/utils/cityCountryMap';
import { useEntitlements, canViewPremiumContentForDay } from '@/hooks/useEntitlements';
import { LockedPhotoPlaceholder } from './LockedPhotoPlaceholder';
import { LockedField } from './LockedField';
import { useAuth } from '@/contexts/AuthContext';
import { useBonusCredits } from '@/hooks/useBonusCredits';
import { UpgradePrompt } from '@/components/checkout/UpgradePrompt';
import { CreditQuickBuy } from '@/components/checkout/CreditQuickBuy';
import { AddFlightInline, AddHotelInline } from './AddBookingInline';
import { TripCollaboratorsPanel } from './TripCollaboratorsPanel';
import { GroupUnlockModal } from '@/components/modals/GroupUnlockModal';
import { GroupBudgetDisplay } from './GroupBudgetDisplay';
import { GuestDNABanner } from './GuestDNABanner';
import { type CollaboratorAttribution, getCollaboratorColor, buildCollaboratorColorMap } from '@/utils/collaboratorAttribution';
import { useTripPermission, useTripCollaborators } from '@/services/tripCollaboratorsAPI';
import { useGuestEditMode } from '@/hooks/useGuestEditMode';
import TripChat from '@/components/chat/TripChat';
import TripSuggestions from '@/components/suggestions/TripSuggestions';
import { ProposeReplacementDialog } from '@/components/suggestions/ProposeReplacementDialog';
import type { BookingItemState, TravelerInfo } from '@/services/bookingStateMachine';
import OptimizePreferencesDialog, { type OptimizePreferences } from './OptimizePreferencesDialog';
import { useRouteOptCost } from '@/hooks/useRouteOptCost';
import ReviewsDrawer from '@/components/reviews/ReviewsDrawer';
import RestaurantSearchDrawer from '@/components/restaurants/RestaurantSearchDrawer';
import { ItineraryOnboardingTour } from './ItineraryOnboardingTour';
import { HelpButton } from './HelpButton';
import { FirstUseHint } from './FirstUseHint';
import ShareGuideSheet from '@/components/sharing/ShareGuideSheet';
import TripShareModal from '@/components/sharing/TripShareModal';
import { preloadAirportCodes, getAirportDisplaySync } from '@/services/locationSearchAPI';
// InlineModifier removed — redundant with TripChat
import type { ItineraryDay } from '@/services/itineraryActionExecutor';
import { TransitModePicker } from './TransitModePicker';

import { cascadeFixOverlaps, previewCascadeOverflow } from '@/utils/injectHotelActivities';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { WhyWeSkippedSection } from './WhyWeSkippedSection';
import { NewMemberSuggestionsCard } from './NewMemberSuggestionsCard';
import { calculateItineraryValueStats } from '@/utils/intelligenceAnalytics';
import { useSkipList } from '@/hooks/useSkipList';
import { validateItinerary, matchesSkipList, type ValidationIssue } from '@/utils/itineraryValidator';
import { VoyanceInsight } from './VoyanceInsight';
import { ContextualTipsPopover, type ContextualTip } from './ContextualTipsPopover';
import { VoyancePickCallout } from './VoyancePickCallout';
import { GuideBookmarkButton } from '@/components/guides/GuideBookmarkButton';
import { TransitBadge } from './TransitBadge';
import { TripDateEditor as TripDateEditorInline } from '@/components/trip/TripDateEditor';
import { MobileTripOverview } from '@/components/trip/MobileTripOverview';
import { TransitGapIndicator, computeGapMinutes, computeDeadGaps, computeOpenWindows, formatDeadGap } from './TransitGapIndicator';
import { FreeTimeMarker } from './FreeTimeMarker';
import { DayRouteMap } from './DayRouteMap';
import { useManualBuilderStore } from '@/stores/manual-builder-store';
import { useActionCap } from '@/hooks/useActionCap';
import { useTripVenueBank } from '@/hooks/useTripVenueBank';
import { AddActivityModal } from './AddActivityModal';
import { DeadGapBanner } from './DeadGapBanner';
import { EditActivityModal } from './EditActivityModal';
import { DiscoverDrawer } from './DiscoverDrawer';
import { ImportActivitiesModal, type ImportMode } from './ImportActivitiesModal';
import { useVersionHistory } from '@/hooks/useVersionHistory';
import { saveDayVersion } from '@/services/itineraryVersionHistory';
import { DayUndoButton } from '@/components/planner/DayUndoButton';
import { VersionHistoryDrawer } from '@/components/planner/VersionHistoryDrawer';
import { SmartFinishBanner } from './SmartFinishBanner';
import { InterCityTransportEditor } from './InterCityTransportEditor';
import { useUpdateCityTransport } from '@/hooks/useTripCities';

import ActivityConciergeSheet, { type AISavedNote } from '@/components/itinerary/ActivityConciergeSheet';
import { AISavedNotes } from '@/components/itinerary/AISavedNotes';

import { ParsedTripNotesSection } from './ParsedTripNotesSection';
import SortableFlightLegCards from './SortableFlightLegCards';
import { resolveDropTarget } from './budgetDropResolver';
import { resolveLiveActivity } from './activityRemoveResolver';
import { mergeNeedToKnowInfo } from './needToKnow';
import { classifyItineraryCompleteness } from '@/utils/itineraryCompleteness';
import { normalizeFlightSelection } from '@/utils/normalizeFlightSelection';
import { pickBannerVariant } from '@/lib/itinerary/integrityBannerCopy';

// =============================================================================
// BOARDING PASS VIEW BUTTON (inline helper)
// =============================================================================


// =============================================================================
// TYPES
// =============================================================================


// Ground-transport modes for multi-city legs. A leg the user set to one of
// these is NOT a flight and must be excluded from the flight form.
const NON_FLIGHT_MODES = new Set(['train', 'bus', 'car', 'ferry', 'drive', 'self']);

/**
 * Build the multi-city route for the flight form, RESPECTING each leg's chosen
 * transport mode. Each city's `transportType` describes how the traveller
 * arrives at it; legs set to train/car/bus/ferry are dropped so the flight form
 * never pre-fills airport legs for ground transport (the user picked a flight,
 * car, or train — we only force a flight when the leg actually is one). The
 * trip-bookending outbound (origin → first city) and return (last city →
 * origin) default to flight only when no other mode was chosen for that city.
 */
export function buildFlightOnlyRoute(
  allHotels: CityHotelInfo[] | undefined,
  originCity: string | undefined,
  startDate: string,
  endDate: string,
): Array<{ from: string; to: string; date?: string; mode?: string }> | undefined {
  if (!allHotels || allHotels.length <= 1) return undefined;
  const route: Array<{ from: string; to: string; date?: string; mode?: string }> = [];
  // Outbound: how the traveller reaches the FIRST city.
  if (originCity) route.push({ from: originCity, to: allHotels[0].cityName, date: startDate, mode: allHotels[0].transportType });
  // Inter-city: each leg's mode is the DESTINATION city's transportType.
  for (let i = 0; i < allHotels.length - 1; i++) {
    route.push({ from: allHotels[i].cityName, to: allHotels[i + 1].cityName, date: allHotels[i].checkOutDate, mode: allHotels[i + 1].transportType });
  }
  // Return home defaults to a flight.
  if (originCity) route.push({ from: allHotels[allHotels.length - 1].cityName, to: originCity, date: endDate, mode: 'flight' });
  const flightLegs = route.filter((r) => !NON_FLIGHT_MODES.has((r.mode || '').toLowerCase()));
  return flightLegs.length > 0 ? flightLegs : undefined;
}

export interface EditorialItineraryProps {
  tripId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budgetTier?: string;
  tripType?: string;
  celebrationDay?: number; // User-specified celebration day for birthday/anniversary trips
  style?: string;
  pace?: string;
  days: EditorialDay[];
  flightSelection?: FlightSelection | null;
  hotelSelection?: HotelSelection | null;
  /** Per-city hotels for multi-city trips */
  allHotels?: CityHotelInfo[];
  destinationInfo?: {
    overview?: string;
    culturalNotes?: string;
    bestTime?: string;
    currency?: string;
    currencySymbol?: string;
    language?: string;
    tips?: string;
    timezone?: string;
    emergency?: string;
    tipping?: string;
    dress?: string;
    transit?: string;
    water?: string;
    voltage?: string;
  };
  heroImageUrl?: string;
  isEditable?: boolean;
  /** Preview mode — shows venue names/times but gates details (address, photos, tips, actions) */
  isPreview?: boolean;
  /** Clean preview mode — hides all builder tools for a reading experience */
  viewMode?: 'edit' | 'preview';
  originCity?: string;
  /** Activity IDs to highlight (e.g., from chatbot suggestions) */
  highlightedActivityIds?: string[];
  /** How this trip was created — controls which features are available */
  creationSource?: string | null;
  onSave?: (days: EditorialDay[]) => Promise<void>;
  onRegenerateDay?: (dayNumber: number) => Promise<EditorialDay | null>;
  onBookingAdded?: () => void;
  /** Called when activities are reordered via drag-and-drop */
  onActivityReorder?: (dayIndex: number, activities: EditorialActivity[]) => void;
  /** Called when user requests payment for an activity */
  onPaymentRequest?: (activityId: string) => void;
  /** Called when preview trip is unlocked with full enrichment */
  onUnlockComplete?: (enrichedItinerary: any) => void;
  /** Metadata from parsed trip input (accommodation notes, practical tips) */
  parsedMetadata?: { accommodationNotes?: string[]; practicalTips?: string[]; unparsed?: string[]; source?: string };
  /** Called whenever the local days state changes (swaps, locks, reorders, etc.) so parent can stay in sync */
  onDaysChange?: (days: EditorialDay[]) => void;
  /** Called when the user switches to a different day (for chat context) */
  onActiveDayChange?: (dayNumber: number) => void;
  /** Called when the active city changes (for multi-city hero images) */
  onActiveCityChange?: (cityName: string | null) => void;
  /** Expose a way for parent to programmatically switch to the details tab and scroll to a section */
  navigateToSection?: string | null;
  /** Raw itinerary_data object so we can restore optionSelections on page load */
  initialItineraryData?: Record<string, unknown> | null;
  /** Current itinerary generation status — hides unlock UI during generation */
  itineraryStatus?: string | null;
  /** Reason from trip metadata when itinerary_status === 'failed' */
  generationFailureReason?: string | null;
  /** Journey fields for linked trips */
  journeyId?: string | null;
  journeyName?: string | null;
  /** Date editing props — renders inline pencil icon next to date display */
  onDateChange?: (result: import('@/components/trip/TripDateEditor').DateChangeResult) => Promise<void>;
  /** Called when user wants to undo a date change (restores dates + itinerary) */
  onUndoDateChange?: () => Promise<void>;
  hasItinerary?: boolean;
  dateEditorFlightSelection?: Record<string, unknown> | null;
  dateEditorCities?: Array<{ id: string; city_name: string; nights?: number }>;
  /** Travel intel cards passed from TripDetail */
  travelIntelCards?: React.ReactNode;
  /** Trip health/completion panel factory. Receives final rendered days, not parent raw days. */
  renderTripHealthPanel?: (days: EditorialDay[]) => React.ReactNode;
  /** Number of trip cities for the mobile overview summary. */
  cityCount?: number;
  /** Parent dispatches a request (with nonce) to refresh a specific day */
  refreshDayRequest?: { dayNumber: number; nonce: number } | null;
  /** Parent dispatches a deterministic timing-fix request for a day */
  fixTimingRequest?: { dayNumber: number; nonce: number } | null;
  /** Parent dispatches a real AI day-regeneration request (e.g. Trip Health "missing meal" quick-fix) */
  regenerateDayRequest?: { dayNumber: number; nonce: number } | null;
  /** Notify parent when a day re-check starts/finishes */
  onRefreshingDayChange?: (dayNumber: number | null) => void;
  /** Notify parent of per-day refresh issue counts */
  onRefreshResultsChange?: (results: Record<number, { errorCount: number; warningCount: number }>) => void;
}

// =============================================================================
// CONSTANTS & STYLES
// =============================================================================

const activityStyles: Record<string, { icon: React.ReactNode; label: string }> = {
  transportation: { icon: <Plane className="h-4 w-4" />, label: 'Transport' },
  transport: { icon: <Car className="h-4 w-4" />, label: 'Transport' },
  transit: { icon: <Train className="h-4 w-4" />, label: 'Travel' },
  inter_city_flight: { icon: <Plane className="h-4 w-4" />, label: 'Flight' },
  inter_city_train: { icon: <Train className="h-4 w-4" />, label: 'Train' },
  inter_city_bus: { icon: <Bus className="h-4 w-4" />, label: 'Bus' },
  inter_city_ferry: { icon: <Ship className="h-4 w-4" />, label: 'Ferry' },
  inter_city_car: { icon: <Car className="h-4 w-4" />, label: 'Drive' },
  accommodation: { icon: <Hotel className="h-4 w-4" />, label: 'Stay' },
  dining: { icon: <Utensils className="h-4 w-4" />, label: 'Dining' },
  cultural: { icon: <Camera className="h-4 w-4" />, label: 'Culture' },
  sightseeing: { icon: <MapPin className="h-4 w-4" />, label: 'Explore' },
  activity: { icon: <Camera className="h-4 w-4" />, label: 'Activity' },
  relaxation: { icon: <Palmtree className="h-4 w-4" />, label: 'Wellness' },
  shopping: { icon: <ShoppingBag className="h-4 w-4" />, label: 'Shopping' },
};

const weatherIcons: Record<string, React.ReactNode> = {
  sunny: <Sun className="h-4 w-4 text-amber-500" />,
  clear: <Sun className="h-4 w-4 text-amber-500" />,
  'partly-cloudy': <Cloud className="h-4 w-4 text-slate-400" />,
  cloudy: <Cloud className="h-4 w-4 text-slate-500" />,
  rainy: <CloudRain className="h-4 w-4 text-blue-500" />,
  rain: <CloudRain className="h-4 w-4 text-blue-500" />,
  snowy: <Snowflake className="h-4 w-4 text-blue-300" />,
  snow: <Snowflake className="h-4 w-4 text-blue-300" />,
};

// =============================================================================
// HELPERS
// =============================================================================


// FX rates, conversion helpers, and `formatCurrency` are imported at the top
// of this file from `@/lib/currency` — the shared module ensures this header
// and the Budget tab always render the same converted value.



// =============================================================================
// INTER-CITY TRANSPORT STRIP (compact single-row card)
// =============================================================================


// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function EditorialItinerary({
  tripId,
  destination,
  destinationCountry,
  startDate,
  endDate,
  travelers,
  budgetTier,
  tripType,
  celebrationDay,
  style,
  pace,
  days: initialDays,
  flightSelection,
  hotelSelection,
  allHotels,
  destinationInfo,
  heroImageUrl,
  isEditable = true,
  isPreview = false,
  originCity,
  creationSource,
  onSave,
  onRegenerateDay,
  onBookingAdded,
  onPaymentRequest,
  onUnlockComplete,
  parsedMetadata,
  onDaysChange,
  onActiveDayChange,
  onActiveCityChange,
  navigateToSection,
  initialItineraryData,
  itineraryStatus,
  generationFailureReason,
  journeyId,
  journeyName,
  onDateChange,
  onUndoDateChange,
  hasItinerary: hasItineraryProp,
  dateEditorFlightSelection,
  dateEditorCities,
  travelIntelCards,
  renderTripHealthPanel,
  cityCount = 1,
  refreshDayRequest,
  fixTimingRequest,
  regenerateDayRequest,
  onRefreshingDayChange,
  onRefreshResultsChange,
  viewMode = 'edit',
}: EditorialItineraryProps) {
  const queryClient = useQueryClient();
  const isCleanPreview = viewMode === 'preview';
  const isActivelyGenerating = itineraryStatus === 'generating' || itineraryStatus === 'queued';

  const [rawDays, setRawDays] = useState<EditorialDay[]>(() =>
    sanitizeEditorialDays<EditorialDay>(initialDays)
  );

  // Sanitize wrapper: coerces every string field the renderer calls string
  // methods on (title/category/startTime/location.name/…) to a guaranteed
  // string and drops null/empty activity objects that slip through from the
  // edge functions during partial generation. This is the single data
  // boundary that makes the "Small Detour" render crash structurally
  // impossible — see utils/itinerarySanitize.ts.
  const setDays: typeof setRawDays = useCallback((update) => {
    setRawDays(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      return sanitizeEditorialDays<EditorialDay>(next);
    });
  }, []);

  // Batch write-back of resolved activity photos into days state
  // This merges photos into React state so they survive ALL save paths
  const mergePhotosIntoDays = useCallback((photos: Map<string, string>) => {
    setDays(prev => {
      let changed = false;
      const updated = prev.map(day => ({
        ...day,
        activities: (day.activities || []).map(act => {
          const newUrl = photos.get(act.id);
          if (!newUrl) return act;
          // Skip if already has the same photo
          const existing = (act as any).image_url || ((act.photos as any)?.[0]?.url ?? (act.photos as any)?.[0]);
          if (existing === newUrl) return act;
          changed = true;
          return { ...act, image_url: newUrl, photos: [newUrl] } as any;
        }),
      }));
      return changed ? updated : prev;
    });
    // Trigger auto-save so merged photos persist to the database
    setHasChanges(true);
  }, [setDays]);
  const { reportPhoto } = useActivityImageWriteback(mergePhotosIntoDays);

  // Re-sync budget ledger from current days state (fire-and-forget)
  const syncBudgetFromDays = useCallback((currentDays: EditorialDay[]) => {
    // Manual mode: user manages their own budget — skip auto-sync
    const manualMode = (tripId ? useManualBuilderStore.getState().isManualBuilder(tripId) : false)
      || creationSource === 'manual_paste'
      || creationSource === 'manual';
    if (manualMode) return;
    const daysForSync = currentDays.map(day => ({
      dayNumber: day.dayNumber,
      date: day.date || '',
      activities: day.activities.map(act => ({
        id: act.id,
        title: act.title || 'Activity',
        category: act.category || act.type || 'activities',
        cost: act.cost ? (typeof act.cost === 'number'
          ? { amount: act.cost, currency: 'USD' }
          : {
              amount: (act.cost as any).amount,
              total: (act.cost as any).total,
              perPerson: (act.cost as any).perPerson,
              basis: (act.cost as any).basis,
              currency: (act.cost as any).currency || 'USD',
            }) : undefined,
      })),
    }));

    // Sync to activity_costs table (single source of truth for all cost totals)
    import('@/services/activityCostService').then(async ({ syncActivitiesToCostTable, cleanupRemovedActivityCosts }) => {
      // Use canonical pricing engine to resolve per-person costs correctly
      const { resolvePerPersonForDb, resolveCategory } = await import('@/lib/trip-pricing');
      const activitiesForCostTable: Array<{
        id: string;
        dayNumber: number;
        category: string;
        costPerPersonUsd: number;
        numTravelers?: number;
        source?: string;
      }> = [];

      // Track EVERY live activity id (including $0 ones) so cleanup preserves
      // free venues / placeholder rows that legitimately exist in the live
      // itinerary while still removing rows from prior generations whose
      // activity_id no longer exists at all.
      const liveActivityIds: string[] = [];
      for (const day of currentDays) {
        for (const act of day.activities) {
          if (act?.id) liveActivityIds.push(act.id);
          // Try act.cost first, then fall back to act.estimatedCost
          const costInput = act.cost || (act as any).estimatedCost || null;
          const costPerPerson = resolvePerPersonForDb(costInput as any, travelers || 1);

          // Only write rows with actual costs (skip $0 to avoid noise)
          if (costPerPerson > 0) {
            // Guard: don't write positive rows for free public venues
            const { isLikelyFreePublicVenue: isFreeVenue, isPlaceholderDepartureTransfer, isWalkingLeg } = await import('@/lib/cost-estimation');
            // Guard: walking legs are always free, regardless of stored category.
            // Mirrors backend pipeline guard so the All Costs / Payments views
            // never see a synthesized "Walk to X — $20" row.
            if (isWalkingLeg({
              title: act.title,
              description: (act as any).description,
              bookingRequired: (act as any).bookingRequired,
            })) {
              console.log(`[syncBudgetFromDays] Skipping walking leg: "${act.title}"`);
              continue;
            }
            const isFree = isFreeVenue({
              title: act.title,
              category: act.category,
              type: act.type,
              locationName: (act as any).location?.name,
              description: (act as any).description,
              venueName: (act as any).venue_name,
              restaurantName: (act as any).restaurant?.name,
              placeName: (act as any).place_name,
            });
            if (isFree) {
              console.log(`[syncBudgetFromDays] Skipping free venue: "${act.title}"`);
              continue;
            }
            // Guard: placeholder departure transfers (no mode chosen) must not commit a price.
            if (isPlaceholderDepartureTransfer({
              title: act.title,
              category: act.category,
              type: act.type,
              description: (act as any).description,
              bookingRequired: (act as any).bookingRequired,
              cost: act.cost,
            })) {
              console.log(`[syncBudgetFromDays] Skipping placeholder departure transfer: "${act.title}"`);
              continue;
            }
            activitiesForCostTable.push({
              id: act.id,
              dayNumber: day.dayNumber,
              category: resolveCategory(act.category, act.type),
              costPerPersonUsd: costPerPerson,
              numTravelers: travelers || 1,
              source: 'itinerary-sync',
            });
          }
        }
      }

      // ALWAYS run cleanup against the FULL live activity id set, even if no
      // positive-cost rows were synced. This drops cost rows from prior
      // generations (e.g. Ob-La-Di / La Méditerranée from an earlier itinerary
      // version) that no longer exist on the live Itinerary tab — which is
      // the root cause of phantom Budget Coach suggestions and Payments rows.
      try {
        if (activitiesForCostTable.length > 0) {
          const synced = await syncActivitiesToCostTable(tripId, activitiesForCostTable, liveActivityIds);
          console.log(`[EditorialItinerary] Synced ${synced}/${activitiesForCostTable.length} activity costs`);
        }

        const cleaned = await cleanupRemovedActivityCosts(tripId, liveActivityIds);
        if (cleaned > 0) {
          console.log(`[EditorialItinerary] Cleaned ${cleaned} orphaned cost rows (live ids: ${liveActivityIds.length})`);
        }

         // Notify subscribers WITHOUT an optimistic total. Sending an
         // optimistic total here briefly replaced the snapshot total, which
         // then "snapped back" to the DB-derived total a beat later — that
         // back-and-forth was being interpreted as a >25% delta and surfaced
         // as the persistent "Reconciling…" / "just now" indicator on
         // Payments. The canonical refetch below is the source of truth.
         window.dispatchEvent(new CustomEvent('booking-changed', {
           detail: { tripId }
         }));
      } catch (err) {
        console.error('[EditorialItinerary] Activity cost sync failed:', err);
      }
    });
  }, [tripId, queryClient, travelers, creationSource]);

  // Auto-sync flight/hotel logistics on initial load. We intentionally do
  // NOT call syncBudgetFromDays here — that would rewrite activity_costs
  // from whatever JSON happens to be in the rendered itinerary on every
  // page load, producing surprise "+$340 just now" trip total swings with
  // no user action. Activity costs are written by the generation pipeline
  // and only re-synced on explicit user edits (swap, add/remove, save,
  // regenerate). Flight/hotel sync is idempotent and safe.
  const budgetSyncedRef = useRef(false);
  useEffect(() => {
    if (!budgetSyncedRef.current && rawDays.length > 0 && tripId) {
      budgetSyncedRef.current = true;

      // Sync flight/hotel costs to activity_costs table
      import('@/services/budgetLedgerSync').then(({ syncFlightToLedger, syncHotelToLedger, syncMultiCityHotelsToLedger }) => {
        if (flightSelection) {
          syncFlightToLedger(tripId, flightSelection as any)
            .catch(err => console.error('[EditorialItinerary] Flight cost sync failed:', err));
        }
        // Multi-city: aggregate all city hotels into one ledger row
        if (allHotels && allHotels.length > 0) {
          const hotelEntries = allHotels
            .filter(ch => ch.hotel)
            .map(ch => {
              const h = ch.hotel!;
              const nights = ch.nights || (ch.checkInDate && ch.checkOutDate
                ? Math.max(1, Math.ceil((new Date(ch.checkOutDate).getTime() - new Date(ch.checkInDate).getTime()) / (1000 * 60 * 60 * 24)))
                : 1);
              const total = h.totalPrice || (h.pricePerNight ? h.pricePerNight * nights : 0);
              return { name: h.name || ch.cityName, totalPrice: total };
            })
            .filter(e => e.totalPrice > 0);
          if (hotelEntries.length > 0) {
            syncMultiCityHotelsToLedger(tripId, hotelEntries)
              .catch(err => console.error('[EditorialItinerary] Multi-city hotel sync failed:', err));
          }
        } else if (hotelSelection) {
          // Single-city path
          syncHotelToLedger(tripId, hotelSelection as any)
            .catch(err => console.error('[EditorialItinerary] Hotel cost sync failed:', err));
        }
      });
    }
  }, [rawDays.length, tripId, syncBudgetFromDays, flightSelection, hotelSelection, allHotels]);

  // Inject synthetic travel activity cards on transition days:
  // Check-out → Head to transport → Transport (seat/ticket) → Arrival → Check-in
  const days = useMemo(() => {
    // When the traveler hasn't added flight details, the generator emits a
    // bare "Arrival"/"Arrive at Airport" placeholder on Day 1. The arrival
    // game-plan banner above already prompts for flight details, so the
    // placeholder is redundant and reads as "unfinished". Strip it whenever
    // no flight data is present — it'll reappear once a real flight is added
    // (the generator then enriches it with airline/airport/time).
    const hasFlight = !!flightSelection && (
      !!(flightSelection as any).legs?.length ||
      !!(flightSelection as any).outbound ||
      !!(flightSelection as any).return
    );
    const isPlaceholderArrival = (a: any): boolean => {
      if (!a || a.locked || a.isLocked) return false;
      const title = String(a.title || a.name || '').toLowerCase().trim();
      const cat = String(a.category || a.type || '').toLowerCase();
      const venue = String(a.location?.name || '').toLowerCase().trim();
      const hasAirline = !!(a.airline || a.flightNumber || a.carrier || a.confirmationNumber);
      const isArrivalTitle = title === 'arrival' || title === 'arrive at airport' ||
        title === 'arrival at airport' || /^arrival at\b/.test(title) ||
        /^arrive at\b.*airport/.test(title) || title === 'arrival flight';
      const isAirportishVenue = !venue || venue === 'airport' || venue === 'the airport' ||
        venue.endsWith(' airport');
      const isTravelCat = cat === 'flight' || cat === 'travel' || cat === 'transport' || cat === 'transit';
      return isArrivalTitle && isTravelCat && isAirportishVenue && !hasAirline;
    };

    // Pre-check-in relabel: if a Day-1 "Check-in at <hotel>" is scheduled
    // before the hotel's stated check-in time, relabel it as "Luggage Drop"
    // so the user doesn't expect a room to be ready. The real check-in
    // typically happens later in the day (added by the generator). This is
    // purely cosmetic — id, cost, location, category are preserved.
    const hotelCheckInRaw = (hotelSelection as any)?.checkInTime || (hotelSelection as any)?.checkIn;
    const parseHHMMOrAmPm = (s?: string): number | null => {
      if (!s || typeof s !== 'string') return null;
      const trimmed = s.trim();
      const m24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
      if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
      const mAmPm = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
      if (mAmPm) {
        let h = parseInt(mAmPm[1], 10) % 12;
        if (mAmPm[3].toUpperCase() === 'PM') h += 12;
        return h * 60 + (mAmPm[2] ? parseInt(mAmPm[2], 10) : 0);
      }
      return null;
    };
    const hotelCheckInMins = parseHHMMOrAmPm(hotelCheckInRaw) ?? 15 * 60; // default 15:00
    const hotelDisplayCheckIn = (() => {
      // Render as "3:00 PM"
      const h24 = Math.floor(hotelCheckInMins / 60);
      const m = hotelCheckInMins % 60;
      const period = h24 >= 12 ? 'PM' : 'AM';
      const h12 = ((h24 + 11) % 12) + 1;
      return `${h12}:${String(m).padStart(2, '0')} ${period}`;
    })();
    const relabelPreCheckIn = (a: any): any => {
      if (!a || a.locked || a.isLocked) return a;
      const title = String(a.title || a.name || '').trim();
      if (!/^check[-\s]?in\b/i.test(title)) return a;
      const startMins = parseHHMMOrAmPm(a.startTime || a.time);
      if (startMins === null || startMins >= hotelCheckInMins) return a;
      const hotelPart = title.replace(/^check[-\s]?in\s*(?:at|to|—|–|-|@)\s*/i, '').trim() || a.location?.name || 'your hotel';
      return {
        ...a,
        title: `Luggage Drop at ${hotelPart}`,
        name: `Luggage Drop at ${hotelPart}`,
        description: `Drop your bags and freshen up. Your room will be ready at ${hotelDisplayCheckIn}.`,
        durationMinutes: Math.min(20, a.durationMinutes ?? 30),
      };
    };

    // Day-1 "Grand Entrance" dinner — purely cosmetic description prefix when
    // the generator/quality-pass tagged this activity. Skips locked items and
    // never modifies anything beyond the description.
    const GRAND_ENTRANCE_PREFIX = 'Your Grand Entrance dinner - ';
    const labelGrandEntrance = (a: any): any => {
      if (!a || a.locked || a.isLocked) return a;
      const tags = Array.isArray(a.tags) ? a.tags : [];
      if (!tags.includes('grand_entrance')) return a;
      const desc = String(a.description || '').trim();
      if (desc.startsWith(GRAND_ENTRANCE_PREFIX)) return a;
      return { ...a, description: `${GRAND_ENTRANCE_PREFIX}${desc}` };
    };

    return rawDays.map((day, dayIndex) => {
    const d = day as any;
    const filtered = (!hasFlight && day.dayNumber === 1)
      ? day.activities.filter(a => !isPlaceholderArrival(a))
      : day.activities;
    const baseActivities = (day.dayNumber === 1
      ? filtered.map(relabelPreCheckIn).map(labelGrandEntrance)
      : filtered) as EditorialActivity[];
    let updatedActivities = [...baseActivities];

    // === Transition day: inject travel summary at top ===
    if (d.isTransitionDay && d.transitionFrom && d.transitionTo) {
      if (!day.activities.some(a => (a as any).__syntheticTravel)) {
        const from = d.transitionFrom as string;
        const to = d.transitionTo as string;
        const dn = day.dayNumber;

        const sel = d.transportComparison?.find((o: any) => o.id === d.selectedTransportId) || d.transportComparison?.[0];
        const tType = sel?.mode || sel?.type || d.transportType || 'transfer';
        const rawTd = d.transportDetails || {};
        const carrier = sel?.carrier || rawTd.carrier || rawTd.operator || '';
        const flightNum = sel?.flightNumber || rawTd.flightNumber || '';
        const depTime = sel?.departureTime || rawTd.departureTime || '';
        const arrTime = sel?.arrivalTime || rawTd.arrivalTime || '';
        const dur = sel?.duration || rawTd.duration || rawTd.inTransitDuration || rawTd.doorToDoorDuration || '';
        const seatInfo = rawTd.seatClass || rawTd.seat || rawTd.seatNumber || '';
        const bookingRef = rawTd.bookingRef || rawTd.confirmationNumber || '';
        const rawPrice = sel?.price ?? rawTd.totalCost ?? rawTd.costPerPerson ?? (d.transportCostCents ? (d.transportCostCents / 100) : undefined);
        const price = rawPrice != null && rawPrice > 0 ? rawPrice : undefined;
        const currency = sel?.currency || rawTd.currency || d.transportCurrency || 'USD';

        const hubLabel = tType === 'flight' ? 'airport' : tType === 'train' ? 'train station' : tType === 'ferry' ? 'ferry terminal' : 'station';
        const transportName = tType.charAt(0).toUpperCase() + tType.slice(1);

        const mkActivity = (id: string, title: string, overrides: Partial<EditorialActivity> & { __syntheticTravel: true }): EditorialActivity =>
          ({
            id,
            title,
            name: title,
            type: 'transit',
            category: 'transit',
            isLocked: false,
            location: undefined,
            ...overrides,
          }) as any;

        // Determine the specific inter-city transport category for proper icon display
        const interCityCategory = tType === 'flight' ? 'inter_city_flight'
          : tType === 'train' ? 'inter_city_train'
          : tType === 'bus' ? 'inter_city_bus'
          : tType === 'ferry' ? 'inter_city_ferry'
          : tType === 'car' ? 'inter_city_car'
          : 'inter_city_train';

        const transportTitle = `${transportName} to ${to}`;

        const travelCards: EditorialActivity[] = [
          mkActivity(`travel-summary-${dn}`, transportTitle, {
            __syntheticTravel: true,
            __interCityTransport: true,
            __travelMeta: {
              from,
              to,
              transportName,
              hubLabel,
              carrier,
              flightNum,
              depTime,
              arrTime,
              dur,
              seatInfo,
              bookingRef,
              price,
              currency,
            },
            description: [
              carrier && flightNum ? `${carrier} ${flightNum}` : carrier || '',
              dur ? dur : '',
            ].filter(Boolean).join(' · '),
            startTime: depTime,
            endTime: arrTime,
            duration: dur,
            cost: price != null ? { amount: price, currency } : undefined,
            category: interCityCategory,
            type: interCityCategory,
          } as any),
        ];

        // Insert travel cards AFTER any checkout activity (same logic as departure day)
        const checkoutKw = ['check out', 'checkout', 'check-out'];
        const checkoutIdx = updatedActivities.findIndex(a =>
          (a as any).__hotelCheckout ||
          a.id?.startsWith('hotel-checkout') ||
          checkoutKw.some(kw => (a.title || '').toLowerCase().includes(kw))
        );

        if (checkoutIdx !== -1) {
          // Ensure checkout time is before transport departure
          const depTimeStr = travelCards[0]?.startTime;
          if (depTimeStr) {
            const depMin = parseTimeToMinutes(depTimeStr);
            const coTime = updatedActivities[checkoutIdx].startTime;
            const coMin = coTime ? parseTimeToMinutes(coTime) : depMin;
            if (coMin >= depMin) {
              // Push checkout 60 min before departure, minimum 07:00
              const newCoMin = Math.max(depMin - 60, 420);
              const hh = String(Math.floor(newCoMin / 60)).padStart(2, '0');
              const mm = String(newCoMin % 60).padStart(2, '0');
              updatedActivities[checkoutIdx] = { ...updatedActivities[checkoutIdx], startTime: `${hh}:${mm}` };
            }
          }
          updatedActivities.splice(checkoutIdx + 1, 0, ...travelCards);
        } else {
          updatedActivities = [...travelCards, ...updatedActivities];
        }
      }
    }

    // === Departure day: inject transport card at end of day ===
    if (d.isDepartureDay && d.departureTo) {
      if (!updatedActivities.some(a => (a as any).__syntheticDeparture)) {
        const to = d.departureTo as string;
        const dn = day.dayNumber;
        const tType = d.departureTransportType || 'transfer';
        const details = d.departureTransportDetails || {};
        const depTime = (details.departureTime as string) || '';
        const arrTime = (details.arrivalTime as string) || '';
        const carrier = (details.carrier as string) || (details.operator as string) || '';
        const flightNum = (details.flightNumber as string) || '';
        const dur = (details.duration as string) || (details.inTransitDuration as string) || (details.doorToDoorDuration as string) || '';
        const depFrom = (details.departureStation as string) || (details.departureAirport as string) || (d.city as string) || '';
        const transportLabel = tType.charAt(0).toUpperCase() + tType.slice(1);
        // Use airport/station name for departure, not city name
        const departureHub = tType === 'flight'
          ? ((details.departureAirport as string) || 'the Airport')
          : tType === 'train'
          ? ((details.departureStation as string) || 'the Station')
          : to;
        const title = `${transportLabel} to ${departureHub}`;
        const cardTime = depTime || '18:00';

        const descParts = [];
        if (carrier || flightNum) {
          descParts.push(`${carrier}${flightNum ? ` ${flightNum}` : ''}`);
        }
        if (depTime) {
          descParts.push(`Departs ${depTime}${arrTime ? ` · Arrives ${arrTime}` : ''}`);
        }
        if (dur) {
          descParts.push(`Duration: ${dur}`);
        }
        if (!depTime && !carrier) {
          descParts.push('Plan your transport details');
        }

        const depInterCityCategory = tType === 'flight' ? 'inter_city_flight'
          : tType === 'train' ? 'inter_city_train'
          : tType === 'bus' ? 'inter_city_bus'
          : tType === 'ferry' ? 'inter_city_ferry'
          : tType === 'car' ? 'inter_city_car'
          : 'inter_city_train';

        const departureCard: EditorialActivity = {
          id: `departure-transport-${dn}`,
          title,
          name: title,
          type: depInterCityCategory,
          category: depInterCityCategory,
          isLocked: false,
          startTime: cardTime,
          endTime: arrTime || undefined,
          duration: dur || '~',
          description: descParts.join('\n'),
          location: undefined,
          __syntheticDeparture: true,
          __interCityTransport: true,
          __travelMeta: {
            from: depFrom || d.city || '',
            to,
            transportName: transportLabel,
            hubLabel: tType === 'flight' ? 'airport' : tType === 'train' ? 'station' : '',
            carrier,
            flightNum,
            depTime,
            arrTime,
            dur,
            seatInfo: (details.seatClass as string) || (details.seatNumber as string) || '',
            bookingRef: (details.bookingRef as string) || (details.confirmationNumber as string) || '',
            price: details.totalCost != null ? (details.totalCost as number) : details.costPerPerson != null ? (details.costPerPerson as number) : undefined,
            currency: (details.currency as string) || 'USD',
          },
          __departureTransportType: tType,
        } as any;

        // Insert chronologically
        const cardMinutes = parseTimeToMinutes(cardTime);
        let insertIndex = updatedActivities.length;
        for (let i = 0; i < updatedActivities.length; i++) {
          const actTime = updatedActivities[i].startTime;
          if (actTime) {
            const actMinutes = parseTimeToMinutes(actTime);
            if (actMinutes > cardMinutes) {
              insertIndex = i;
              break;
            }
          }
        }
        updatedActivities.splice(insertIndex, 0, departureCard);

        // Trim activities that occur at or after departure (traveler has left the city)
        const depMinutes = parseTimeToMinutes(cardTime);
        const bufferMinutes = tType === 'flight' ? 90 : tType === 'train' ? 45 : 30;
        const cutoffMinutes = depMinutes - bufferMinutes;

        updatedActivities = updatedActivities.filter(act => {
          // Drop synthetic read-time hotel-return bookends — see final-departure
          // filter below for rationale.
          const aSource = String((act as any).source || '');
          const aTags: string[] = Array.isArray((act as any).tags) ? (act as any).tags : [];
          const isReadTimeBookend =
            (typeof act.id === 'string' && act.id.startsWith('bookend-readtime-')) ||
            aSource === 'bookend-readtime' || aSource === 'bookend-overnight' ||
            aTags.includes('bookend-readtime') || aTags.includes('bookend-overnight');
          if (isReadTimeBookend) return false;

          // Drop ANY "Return to / head back to / wind down at" hotel row on
          // departure day, regardless of source/tag metadata. The traveler
          // is leaving the city — these never belong here.
          const titleStr = String(act.title || (act as any).name || '');
          const descStr = String((act as any).description || '');
          const isProtectedRow = (act as any).isLocked === true || (act as any).is_locked === true ||
            (act as any).locked === true ||
            ['user', 'manual', 'extracted', 'pinned'].includes(String((act as any).source || '').toLowerCase());
          if (!isProtectedRow) {
            const RETURN_VERB = /\b(?:return\s+to|back\s+(?:to|at)|head\s+back\s+to|wind\s+down\s+at|retire\s+to|end\s+of\s+day\s+at)\b/i;
            const HOTEL_NOUN = /\b(?:hotel|hostel|inn|resort|lodge|ryokan|riad|marriott|hilton|hyatt|ritz|four\s*seasons|st\.?\s*regis|peninsula|aman|belmond|cipriani|gritti|kempinski|rosewood|mandarin|raffles|bvlgari|bulgari|conrad|edition|sofitel|fairmont|shangri|intercontinental|westin|sheraton|nobu|your\s+hotel)\b/i;
            if (RETURN_VERB.test(titleStr) && (HOTEL_NOUN.test(titleStr) || /wind\s+down\s+\(overnight\)/i.test(descStr))) {
              return false;
            }
          }

          // Keep all synthetic cards (transport, hotel, etc.)
          if ((act as any).__syntheticTravel || (act as any).__syntheticDeparture ||
              (act as any).__interCityTransport || (act as any).__hotelCheckout ||
              (act as any).__hotelCheckin ||
              act.id.startsWith('hotel-') || act.id.startsWith('departure-') ||
              act.id.startsWith('travel-')) {
            return true;
          }
          // Preserve AI-generated check-in/checkout cards, but NOT a generic
          // "Return to hotel" row on a day the traveler is leaving the city.
          const tLower = (act.title || '').toLowerCase();
          const catLower = (act.category || '').toLowerCase();
          const isReturnToHotel = /\b(?:return|head\s+back|back)\s+to\b/i.test(act.title || '');
          const isAccommodationCard = !isReturnToHotel && (catLower === 'accommodation' ||
            tLower.includes('check-in') || tLower.includes('checkin') || tLower.includes('check in') ||
            tLower.includes('check-out') || tLower.includes('checkout') || tLower.includes('check out'));
          if (isAccommodationCard) return true;
          // No time = keep (safe fallback)
          if (!act.startTime) return true;
          const actMin = parseTimeToMinutes(act.startTime);
          // Remove activities at or after cutoff (traveler needs to leave)
          return actMin < cutoffMinutes;
        });
      }
    }

    // === Final departure day: inject return flight/train card on last day ===
    // Multi-city guard: only inject on the last day if it belongs to the final city
    const isLastCity = !allHotels || allHotels.length <= 1 ||
      (d.city && allHotels.length > 0 && (d.city || '').toLowerCase() === (allHotels[allHotels.length - 1]?.cityName || '').toLowerCase());
    // Fire if: (a) last day + flight booked, OR (b) last day marked isDepartureDay with __home__ target
    const isAbsoluteLastDay = dayIndex === rawDays.length - 1;
    const isFinalHomeDeparture = d.isDepartureDay && d.departureTo === '__home__';
    const hasFinalDepartureInfo = flightSelection || isFinalHomeDeparture;
    if (isAbsoluteLastDay && !d.isTransitionDay && isLastCity) {
      if (!updatedActivities.some(a => (a as any).__syntheticFinalDeparture)) {
        // Resolve return transport details from flightSelection OR isDepartureDay metadata
        let tType = 'flight';
        let carrier = '';
        let flightNum = '';
        let depTime = '';
        let arrTime = '';
        let depAirport = '';
        let arrAirport = '';
        let dur = '';
        let seatInfo = '';
        let bookingRef = '';
        let price: number | undefined;
        let hasReturnData = false;

        if (flightSelection) {
          const allLegs = flightSelection.legs || [];
          const returnLeg: FlightLegDisplay | undefined =
            allLegs.find(l => l.isDestinationDeparture) ||
            flightSelection.return ||
            (allLegs.length >= 2 ? allLegs[allLegs.length - 1] : undefined);

          if (returnLeg) {
            carrier = returnLeg.airline || '';
            flightNum = returnLeg.flightNumber || '';
            depTime = returnLeg.departure?.time || '';
            arrTime = returnLeg.arrival?.time || '';
            depAirport = returnLeg.departure?.airport || '';
            arrAirport = returnLeg.arrival?.airport || '';
            dur = returnLeg.duration || '';
            seatInfo = returnLeg.cabinClass || returnLeg.seat || '';
            bookingRef = returnLeg.confirmationCode || '';
            price = returnLeg.price;

            const explicitMode = (flightSelection as any).transportMode as string | undefined;
            const carrierLower = (carrier || '').toLowerCase();
            const IATA_RE = /^[A-Z]{3}$/;
            const fromIsAirport = IATA_RE.test((depAirport || '').trim().toUpperCase());
            const toIsAirport = IATA_RE.test((arrAirport || '').trim().toUpperCase());
            tType = explicitMode
              || (flightNum ? 'flight'
                  : /\b(train|rail|sncf|amtrak|eurostar|trenitalia|renfe|db\s|ice)\b/i.test(carrierLower) ? 'train'
                  : (fromIsAirport || toIsAirport) ? 'flight'
                  : 'flight'); // flightSelection.legs implies a flight
            hasReturnData = true;
          }
        }

        // Fallback: build from departure day metadata (non-flight Step 2 selection)
        if (!hasReturnData && isFinalHomeDeparture) {
          const dDetails = d.departureTransportDetails || {};
          tType = d.departureTransportType || 'transfer';
          carrier = (dDetails.carrier as string) || (dDetails.operator as string) || '';
          flightNum = (dDetails.flightNumber as string) || '';
          depTime = (dDetails.departureTime as string) || '';
          arrTime = (dDetails.arrivalTime as string) || '';
          depAirport = (dDetails.departureStation as string) || (dDetails.departureAirport as string) || '';
          arrAirport = (dDetails.arrivalStation as string) || (dDetails.arrivalAirport as string) || '';
          dur = (dDetails.duration as string) || (dDetails.inTransitDuration as string) || (dDetails.doorToDoorDuration as string) || '';
          seatInfo = (dDetails.seatClass as string) || (dDetails.seatNumber as string) || '';
          bookingRef = (dDetails.bookingRef as string) || (dDetails.confirmationNumber as string) || '';
          price = dDetails.totalCost != null ? (dDetails.totalCost as number) : dDetails.costPerPerson != null ? (dDetails.costPerPerson as number) : undefined;
          hasReturnData = true;
        }

        // Generic fallback: if no return data from flight or departure metadata, inject a generic departure card
        if (!hasReturnData) {
          const dn = day.dayNumber;
          const genericDepartureCard: EditorialActivity = {
            id: `final-departure-${dn}`,
            title: 'Transfer to the Airport',
            name: 'Transfer to the Airport',
            type: 'inter_city_flight',
            category: 'inter_city_flight',
            isLocked: false,
            startTime: '15:00',
            endTime: undefined,
            duration: '~',
            description: 'Head to the airport for your departure flight home.',
            location: undefined,
            __syntheticFinalDeparture: true,
            __interCityTransport: true,
            __travelMeta: {
              from: d.city || '',
              to: originCity || 'Home',
              transportName: 'Flight',
              hubLabel: 'airport',
              carrier: '',
              flightNum: '',
              depTime: '',
              arrTime: '',
              dur: '',
              seatInfo: '',
              bookingRef: '',
              price: undefined,
              currency: 'USD',
            },
          } as any;

          // Insert after checkout
          const checkoutKeywordsGeneric = ['check out', 'checkout', 'check-out'];
          let genericInsertIdx = updatedActivities.length;
          for (let i = updatedActivities.length - 1; i >= 0; i--) {
            const actAtI = updatedActivities[i];
            const isCheckoutAct = (actAtI as any).__hotelCheckout ||
              actAtI.id?.startsWith('hotel-checkout') ||
              checkoutKeywordsGeneric.some(kw => (actAtI.title || '').toLowerCase().includes(kw));
            if (isCheckoutAct) {
              genericInsertIdx = i + 1;
              break;
            }
          }
          updatedActivities.splice(genericInsertIdx, 0, genericDepartureCard);
        } else if (hasReturnData) {
          const dn = day.dayNumber;
          const transportLabel = tType === 'rideshare' ? 'Rideshare'
            : tType.charAt(0).toUpperCase() + tType.slice(1);
          const terminalWord = tType === 'flight' ? 'airport'
            : tType === 'ferry' ? 'port'
            : tType === 'train' ? 'station'
            : 'terminal';
          // Build a descriptive title: prefer route, fallback to generic
          const homeCity = arrAirport || originCity || '';
          const departCity = depAirport || '';
          const title = homeCity
            ? `${transportLabel} to ${homeCity}`
            : departCity
              ? `${departCity} → Home`
              : `${transportLabel} home`;
          const cardTime = depTime || '18:00';

          const depInterCityCategory = tType === 'flight' ? 'inter_city_flight'
            : tType === 'train' ? 'inter_city_train'
            : tType === 'bus' ? 'inter_city_bus'
            : tType === 'ferry' ? 'inter_city_ferry'
            : tType === 'car' ? 'inter_city_car'
            : 'inter_city_train';

          const departureCard: EditorialActivity = {
            id: `final-departure-${dn}`,
            title,
            name: title,
            type: depInterCityCategory,
            category: depInterCityCategory,
            isLocked: false,
            startTime: cardTime,
            endTime: arrTime || undefined,
            duration: dur || '~',
            description: [
              carrier && flightNum ? `${carrier} ${flightNum}` : carrier || '',
              dur || '',
            ].filter(Boolean).join(' · '),
            location: undefined,
            __syntheticFinalDeparture: true,
            __interCityTransport: true,
            __travelMeta: {
              from: depAirport || d.city || '',
              to: arrAirport || originCity || '',
              transportName: transportLabel,
              hubLabel: terminalWord,
              carrier,
              flightNum,
              depTime,
              arrTime,
              dur,
              seatInfo,
              bookingRef,
              price,
              currency: 'USD',
            },
          } as any;

          // Insert chronologically
          const cardMinutes = parseTimeToMinutes(cardTime);
          let insertIndex = updatedActivities.length;
          for (let i = 0; i < updatedActivities.length; i++) {
            const actTime = updatedActivities[i].startTime;
            if (actTime) {
              const actMinutes = parseTimeToMinutes(actTime);
              if (actMinutes > cardMinutes) {
                insertIndex = i;
                break;
              }
            }
          }

          // Ensure the card is inserted AFTER any hotel checkout activity
          const checkoutKeywords = ['check out', 'checkout', 'check-out'];
          while (insertIndex < updatedActivities.length) {
            const actAtIdx = updatedActivities[insertIndex];
            const isCheckout = (actAtIdx as any).__hotelCheckout ||
              actAtIdx.id?.startsWith('hotel-checkout') ||
              checkoutKeywords.some(kw => (actAtIdx.title || '').toLowerCase().includes(kw));
            if (isCheckout) {
              insertIndex++;
            } else {
              break;
            }
          }

          updatedActivities.splice(insertIndex, 0, departureCard);

          // Deduplicate AI-generated departure/transfer activities against the synthetic card
          // Use token-based matching to catch "Transfer to Narita Airport (NRT)" etc.
          const HUB_TOKENS = ['airport', 'station', 'port', 'terminal', 'aeropuerto', 'gare', 'bahnhof'];
          updatedActivities = updatedActivities.filter(act => {
            // Drop synthetic read-time hotel-return bookends — the traveler
            // is leaving on this day, so any "Return to {hotel}" card injected
            // by parseItineraryDays is wrong now that a real departure card
            // exists. Identifies via id prefix, source tag, or tags array
            // (set by ensureHotelReturnBookend).
            const aSource = String((act as any).source || '');
            const aTags: string[] = Array.isArray((act as any).tags) ? (act as any).tags : [];
            const isReadTimeBookend =
              (typeof act.id === 'string' && act.id.startsWith('bookend-readtime-')) ||
              aSource === 'bookend-readtime' || aSource === 'bookend-overnight' ||
              aTags.includes('bookend-readtime') || aTags.includes('bookend-overnight');
            if (isReadTimeBookend) return false;

            // Drop ANY persisted "Return to / wind down at" hotel row on
            // departure day, even when bookend metadata is missing.
            const titleStr2 = String(act.title || (act as any).name || '');
            const descStr2 = String((act as any).description || '');
            const isProtectedRow2 = (act as any).isLocked === true || (act as any).is_locked === true ||
              (act as any).locked === true ||
              ['user', 'manual', 'extracted', 'pinned'].includes(String((act as any).source || '').toLowerCase());
            if (!isProtectedRow2) {
              const RETURN_VERB2 = /\b(?:return\s+to|back\s+(?:to|at)|head\s+back\s+to|wind\s+down\s+at|retire\s+to|end\s+of\s+day\s+at)\b/i;
              const HOTEL_NOUN2 = /\b(?:hotel|hostel|inn|resort|lodge|ryokan|riad|marriott|hilton|hyatt|ritz|four\s*seasons|st\.?\s*regis|peninsula|aman|belmond|cipriani|gritti|kempinski|rosewood|mandarin|raffles|bvlgari|bulgari|conrad|edition|sofitel|fairmont|shangri|intercontinental|westin|sheraton|nobu|your\s+hotel)\b/i;
              if (RETURN_VERB2.test(titleStr2) && (HOTEL_NOUN2.test(titleStr2) || /wind\s+down\s+\(overnight\)/i.test(descStr2))) {
                return false;
              }
            }

            if ((act as any).__syntheticFinalDeparture || (act as any).__syntheticTravel ||
                (act as any).__syntheticDeparture || (act as any).__interCityTransport ||
                (act as any).__hotelCheckout || (act as any).__hotelCheckin ||
                act.id.startsWith('hotel-') || act.id.startsWith('departure-') ||
                act.id.startsWith('travel-') || act.id.startsWith('final-departure-')) {
              return true;
            }
            const t = (act.title || '').toLowerCase();
            const desc = (act.description || '').toLowerCase();
            const catLower = (act.category || '').toLowerCase();
            // Preserve AI-generated check-in/checkout cards, but NOT generic
            // "Return to hotel" accommodation rows on the departure day.
            const isReturnToHotel = /\b(?:return|head\s+back|back)\s+to\b/i.test(act.title || '');
            const isAccommodationCard = !isReturnToHotel && (catLower === 'accommodation' ||
              t.includes('check-in') || t.includes('checkin') || t.includes('check in') ||
              t.includes('check-out') || t.includes('checkout') || t.includes('check out'));
            if (isAccommodationCard) return true;
            // Preserve repair-injected local transport to airport/station (distinct from the inter-city flight card)
            const actSource = (act as any).source || '';
            if (actSource === 'repair-departure-transport-guarantee' || (act.id && act.id.includes('-departure-transport-'))) return true;
            // Preserve AI-generated airport procedure cards (security, check-in, boarding)
            const isAirportProcedure = (t.includes('departure') || t.includes('airport')) &&
              (desc.includes('security') || desc.includes('check-in') || desc.includes('boarding') || desc.includes('check in'));
            if (isAirportProcedure) return true;
            // Token-based dedup: "transfer to" + any hub keyword
            const hasHubToken = HUB_TOKENS.some(h => t.includes(h));
            const isTransferActivity = (t.includes('transfer to') || t.includes('transit to')) && hasHubToken;
            const isDepartureActivity = t.includes('departure from') || t.includes('depart from') || t.includes('departing from');
            const isHeadingTo = (t.includes('head to') || t.includes('travel to') || t.includes('go to')) && hasHubToken;
            const isGenericDeparture = t.includes('heading home') || t.includes('airport transfer') || t.includes('station transfer');
            if (isTransferActivity || isDepartureActivity || isHeadingTo || isGenericDeparture) return false;
            // Time-based trim: remove activities past cutoff
            if (!act.startTime) return true;
            const actMin = parseTimeToMinutes(act.startTime);
            const finalDepMinutes = parseTimeToMinutes(cardTime);
            const finalBufferMinutes = tType === 'flight' ? 90 : tType === 'train' ? 45 : 30;
            return actMin < (finalDepMinutes - finalBufferMinutes);
          });
        }
      }
    }

    return {
      ...day,
      activities: updatedActivities,
    };
    });
  }, [rawDays, flightSelection]);

  const activeTripHealthPanel = useMemo(
    () => renderTripHealthPanel?.(days) ?? null,
    [renderTripHealthPanel, days],
  );

  // Compute expected total days from start/end dates so we can show placeholders during generation
  const expectedTotalDays = useMemo(() => {
    if (!startDate || !endDate) return days.length;
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diff, days.length);
  }, [startDate, endDate, days.length]);

  // Day trip = a single calendar day with no overnight stay (0 nights). For
  // these, flights and a hotel are nonsensical, so we suppress the flight +
  // accommodation booking prompts entirely. (Owner: "for a day trip just
  // staying for a day we do not need to force flights and hotels.")
  const isDayTrip = expectedTotalDays <= 1;
  const [expandedDays, setExpandedDays] = useState<number[]>(initialDays.map(d => d.dayNumber));
  // Persisted option group selections (key = optionGroup id, value = selected activity id)
  const [optionSelections, setOptionSelections] = useState<Record<string, string>>(
    () => (initialItineraryData?.optionSelections as Record<string, string>) || {}
  );
  const [activeTab, setActiveTab] = useState<'itinerary' | 'budget' | 'payments' | 'details' | 'needtoknow' | 'collab'>('itinerary');
  const [showTripOverview, setShowTripOverview] = useState(false);

  // Cross-tab "Add expense" trigger — emitted from Misc empty-state hint in BudgetTab.
  // Switch to Payments tab and re-emit so the now-mounted PaymentsTab listener fires.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setActiveTab('payments');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-add-expense:mounted', { detail }));
      }, 50);
    };
    window.addEventListener('open-add-expense', handler);
    return () => window.removeEventListener('open-add-expense', handler);
  }, []);

  // Navigate to a section when parent requests it (e.g., from TripHealthPanel quick-fix buttons)
  useEffect(() => {
    if (!navigateToSection) return;
    // Switch to details tab first
    setActiveTab('details');
    // After tab renders, scroll to the target section
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-section="${navigateToSection}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(timer);
  }, [navigateToSection]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    // Auto-select "Today" if trip is active
    const todayIndex = initialDays.findIndex(d => {
      if (!d.date) return false;
      try { return isToday(parseLocalDate(d.date)); } catch { return false; }
    });
    return todayIndex >= 0 ? todayIndex : 0;
  });

  // Notify parent when active day changes (for chat context)
  useEffect(() => {
    const dayNum = days[selectedDayIndex]?.dayNumber;
    if (dayNum && onActiveDayChange) {
      onActiveDayChange(dayNum);
    }
  }, [selectedDayIndex, days, onActiveDayChange]);

  // Notify parent of active city for multi-city hero image
  useEffect(() => {
    if (!onActiveCityChange) return;
    const day = days[selectedDayIndex];
    if (!day) return;

    let cityName: string | null = (day as any).city || null;
    if (!cityName && allHotels && allHotels.length > 1) {
      const dayDate = day.date ? (() => { try { return parseLocalDate(day.date); } catch { return null; } })() : null;
      if (dayDate) {
        const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
        for (const ch of allHotels) {
          if (ch.checkInDate && ch.checkOutDate && dateStr >= ch.checkInDate && dateStr < ch.checkOutDate) {
            cityName = ch.cityName;
            break;
          }
        }
      }
      if (!cityName && day.title && allHotels.some(h => day.title?.includes(h.cityName))) {
        cityName = allHotels.find(h => day.title?.includes(h.cityName))?.cityName || null;
      }
    }
    onActiveCityChange(cityName);
  }, [selectedDayIndex, days, allHotels, onActiveCityChange]);

  const { user } = useAuth();
  const { claimBonus, hasClaimedBonus } = useBonusCredits();
  const venueBank = useTripVenueBank(days);
  const dayButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dayPickerScrollRef = useRef<HTMLDivElement | null>(null);
  const didMountDayPickerRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null);

  // Sync days from parent when initialDays prop changes (e.g., from ItineraryAssistant apply)
  // Only sync if there are no unsaved local changes to avoid overwriting user edits
  // Use a content-based fingerprint instead of reference equality to avoid
  // false positives when the parent re-creates the array on every render.
  // Fingerprint includes startTime/endTime/durationMinutes so the post-cascade
  // resync from DB (same activity ids, shifted times) actually reaches setDays
  // and the user sees the canonical pre-refresh==post-refresh state.
  // See mem://constraints/itinerary/db-is-source-of-truth.
  // Fingerprint includes meal-relevant fields (category, title, mealSlot) so a
  // parent push that changes only those (e.g. classifier rewrite, AI repair)
  // still resyncs into local state. See mem://constraints/itinerary/db-is-source-of-truth.
  const initialDaysFingerprint = useMemo(() => {
    return JSON.stringify(initialDays.map(d => ({
      n: d.dayNumber,
      d: d.date,
      a: d.activities.map(a => {
        const r = a as any;
        const slot = r.mealSlot ?? r.meal_slot ?? r.metadata?.meal_slot ?? r.metadata?.mealSlot ?? '';
        return `${a.id}@${a.startTime || r.time || ''}-${a.endTime || ''}#${r.durationMinutes ?? ''}|${(r.category || r.type || '').toLowerCase()}|${(a.title || r.name || '').toLowerCase()}|${slot}`;
      }),
    })));
  }, [initialDays]);
  const prevFingerprintRef = useRef(initialDaysFingerprint);
  // Mirror hasChanges into a ref so the resync listener path (which fires after
  // a successful save where setHasChanges(false) may not have flushed) reads
  // the latest truth without waiting for a re-render.
  const hasChangesRef = useRef(hasChanges);
  useEffect(() => { hasChangesRef.current = hasChanges; }, [hasChanges]);
  useEffect(() => {
    if (initialDaysFingerprint !== prevFingerprintRef.current) {
      prevFingerprintRef.current = initialDaysFingerprint;
      if (!hasChangesRef.current) {
        setDays(initialDays);
      }
    }
  }, [initialDaysFingerprint]);

  // Notify parent of local days changes so sibling components (e.g. ItineraryAssistant) stay in sync
  // Notify parent of local days changes so sibling components (e.g. ItineraryAssistant + TripHealthPanel) stay in sync.
  // Fingerprint must include meal/timing/category fields so the health panel
  // never scores a stale pre-render snapshot when activity ids stay stable but
  // their meal-relevant fields change. See plan: trip-health stale-state fix.
  const daysFingerprint = useMemo(() => JSON.stringify(days.map(d => ({
    n: d.dayNumber,
    a: d.activities.map(a => {
      const r = a as any;
      const slot = r.mealSlot ?? r.meal_slot ?? r.metadata?.meal_slot ?? r.metadata?.mealSlot ?? '';
      return `${a.id}@${a.startTime || r.time || ''}-${a.endTime || ''}|${(r.category || r.type || '').toLowerCase()}|${(a.title || r.name || '').toLowerCase()}|${slot}`;
    }),
  }))), [days]);
  const prevDaysFingerprint = useRef(daysFingerprint);
  useEffect(() => {
    if (daysFingerprint !== prevDaysFingerprint.current) {
      prevDaysFingerprint.current = daysFingerprint;
      onDaysChange?.(days);
    }
  }, [daysFingerprint, days, onDaysChange]);

  const [addActivityModal, setAddActivityModal] = useState<{ dayIndex: number; afterIndex?: number } | null>(null);
  const [importModal, setImportModal] = useState<{ dayIndex: number } | null>(null);

  // Version history / undo for selected day
  const selectedDay = days[selectedDayIndex];
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const { canUndoDay, isUndoing, versions, isLoadingVersions, handleUndo, handleRestoreVersion, refreshUndoState, loadVersionHistory } = useVersionHistory({
    tripId,
    dayNumber: selectedDay?.dayNumber ?? 1,
    onRestore: useCallback((restoredActivities, metadata) => {
      setDays(prev => prev.map((d, i) => {
        if (i !== selectedDayIndex) return d;
        return {
          ...d,
          activities: restoredActivities as unknown as EditorialActivity[],
          ...(metadata?.title ? { title: metadata.title } : {}),
          ...(metadata?.theme ? { theme: metadata.theme } : {}),
        };
      }));
      // Auto-save restored version immediately (don't leave as unsaved local state)
      setHasChanges(true);
    }, [selectedDayIndex]),
  });

  // Trip-level date undo
  const [canUndoDate, setCanUndoDate] = useState(false);
  const [isUndoingDate, setIsUndoingDate] = useState(false);
  useEffect(() => {
    if (!tripId || !onUndoDateChange) { setCanUndoDate(false); return; }
    import('@/services/tripDateVersionHistory').then(({ canUndoDateChange }) => {
      canUndoDateChange(tripId).then(setCanUndoDate);
    });
  }, [tripId, onUndoDateChange, days.length, startDate, endDate]);

  const handleUndoDate = useCallback(async () => {
    if (!onUndoDateChange) return;
    setIsUndoingDate(true);
    try {
      await onUndoDateChange();
      setCanUndoDate(false);
    } finally {
      setIsUndoingDate(false);
    }
  }, [onUndoDateChange]);

  const [editActivityModal, setEditActivityModal] = useState<{ dayIndex: number; activityIndex: number; activity: EditorialActivity } | null>(null);
  const [timeEditModal, setTimeEditModal] = useState<{ dayIndex: number; activityIndex: number; activity: EditorialActivity } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{ dayIndex: number; activityId: string; activityTitle: string } | null>(null);
  const [pendingCascade, setPendingCascade] = useState<{
    dayIndex: number;
    activityIndex: number;
    startTime: string;
    endTime: string;
    dropped: EditorialActivity[];
    truncated: EditorialActivity[];
    kept: EditorialActivity[];
    source: 'time_edit' | 'add_activity';
    // C-TOOL-4: for add_activity, the charge committed BEFORE this dialog — carried
    // here so a cancel/dismiss can refund it (server-idempotent, so safe to call
    // from multiple dismiss paths).
    charge?: { idempotencyKey?: string; pendingChargeId?: string | null };
  } | null>(null);
  const [discoverDrawerOpen, setDiscoverDrawerOpen] = useState(false);
  const [hotelGalleryOpen, setHotelGalleryOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [showCreditPrompt, setShowCreditPrompt] = useState(false);
  const [pendingRegenerateDay, setPendingRegenerateDay] = useState<number | null>(null);
  
  // Guided assist state - track regeneration attempts per day
  const [dayRegenCounts, setDayRegenCounts] = useState<Record<number, number>>({});
  const [showGuidedAssist, setShowGuidedAssist] = useState(false);
  const [guidedAssistDayIndex, setGuidedAssistDayIndex] = useState<number | null>(null);
  const [pendingGuidedPreferences, setPendingGuidedPreferences] = useState<string | null>(null);
  
  // Refresh day validation state
  const [refreshResults, setRefreshResults] = useState<Record<number, RefreshResult>>({});
  const { isRefreshing: isRefreshingDay, refreshDay } = useRefreshDay();
  const [refreshingDayNumber, setRefreshingDayNumber] = useState<number | null>(null);
  const [refreshSheetDay, setRefreshSheetDay] = useState<number | null>(null);

  // Notify parent of refresh state changes
  useEffect(() => {
    onRefreshingDayChange?.(refreshingDayNumber);
  }, [refreshingDayNumber, onRefreshingDayChange]);

  useEffect(() => {
    if (!onRefreshResultsChange) return;
    const counts: Record<number, { errorCount: number; warningCount: number }> = {};
    Object.entries(refreshResults).forEach(([dayNum, r]: [string, any]) => {
      counts[Number(dayNum)] = {
        errorCount: r.issues.filter((i: any) => i.severity === 'error').length,
        warningCount: r.issues.filter((i: any) => i.severity === 'warning').length,
      };
    });
    onRefreshResultsChange(counts);
  }, [refreshResults, onRefreshResultsChange]);

  // ── On-load timing-drift telemetry (observation only) ──────────────
  // Previously, two on-mount useEffects (auto-buffer + transit-cascade)
  // mutated `days` and called setHasChanges(true) on every reload. That
  // produced silent divergence between the saved DB document and the
  // rendered state (Bali / Day-1 luggage-drop 09:50 → 11:05 pattern).
  // Per mem://constraints/itinerary/db-is-source-of-truth, the loaded
  // itinerary MUST equal the saved itinerary. The shared
  // `enforceTimingAndBuffers` runs pre-save (action-save-itinerary
  // STEP 2.9 + repair-day §16), so any cascade fixup is already baked
  // into the JSON the DB returns. User-initiated paths (handleRefreshDay,
  // manual edits, drag-reorder) still run the cascade explicitly via
  // safeUpdateItineraryData — those are correct and remain untouched.
  //
  // We keep a fingerprint-guarded dry-run that LOGS any drift the
  // cascade would still produce, so future regressions are visible
  // without re-introducing the silent setState.
  const driftProbeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!days || days.length === 0) return;
    // Skip the drift probe entirely while the backend is actively writing.
    // Realtime row updates during generation cause `days` to churn on every
    // insert, which previously fired a postMessage/dynamic-import loop and
    // spammed `[ITIN_RESYNC_DRIFT] cascade would still mutate on load`.
    // The probe is telemetry-only — its sole purpose is catching post-load
    // cascade drift on a steady-state itinerary. See plan .lovable/plan.md.
    const status = String(itineraryStatus || '').toLowerCase();
    if (status === 'generating' || status === 'partial' || status === 'queued' || status === 'not_started') {
      return;
    }
    const fp = days.map(d => (d.activities || []).map(a => `${a.id}@${a.startTime || (a as any).time || ''}|${a.endTime || ''}`).join('|')).join('||');
    if (driftProbeRef.current === fp) return;
    driftProbeRef.current = fp;

    let cancelled = false;
    (async () => {
      try {
        const mod = await import('@/utils/itinerary/timingCascade');
        if (cancelled) return;
        const drifted: Array<{ day: number; repairs: number }> = [];
        for (const day of days) {
          if (!day || !day.activities || day.activities.length < 2) continue;
          const lockedIds = new Set<string>(
            (day.activities as any[])
              .filter((a) => a?.locked === true || a?.isLocked === true || (a as any)?.lock_state === 'locked')
              .map((a) => String(a.id))
          );
          // Clone so the dry-run never mutates session state.
          const clone = (day.activities as any[]).map((a) => ({ ...a, location: a.location ? { ...a.location } : a.location }));
          const result = mod.enforceTimingAndBuffers(clone, { lockedIds });
          if (result.repairs.length > 0) {
            drifted.push({ day: (day as any).dayNumber ?? 0, repairs: result.repairs.length });
          }
        }
        if (drifted.length > 0) {
          console.warn('[ITIN_RESYNC_DRIFT] cascade would still mutate on load (no setState):', drifted);
        }
      } catch {
        // never break render on telemetry failure
      }
    })();
    return () => { cancelled = true; };
  }, [days, itineraryStatus]);

  
  const handleRefreshDay = useCallback(async (dayIndex: number) => {
    const day = days[dayIndex];
    if (!day) {
      toast.error('Could not find that day to refresh.');
      return;
    }
    setRefreshingDayNumber(day.dayNumber);
    try {
      const activities = day.activities.map(a => {
        const start = a.startTime || (a as any).time || (a as any).start_time;
        const dur = a.durationMinutes || (a as any).duration_minutes || (a as any).duration;
        let end = a.endTime || (a as any).end_time;
        // Derive endTime from start + duration when missing
        if (!end && start && typeof dur === 'number' && dur > 0) {
          const m = /^(\d{1,2}):(\d{2})/.exec(String(start));
          if (m) {
            const tot = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + dur;
            end = `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
          }
        }
        return {
          id: a.id,
          title: a.title || '',
          category: a.category,
          startTime: start,
          endTime: end,
          location: a.location,
          operatingHours: (a as any).operatingHours,
          durationMinutes: typeof dur === 'number' ? dur : a.durationMinutes,
          cost: a.cost,
        };
      });
      const result = await refreshDay(activities, day.date || '', destination, day.dayNumber);
      if (result) {
        if (result.issues.length === 0) {
          // Clear any stale stored result and confirm clean.
          setRefreshResults(prev => {
            if (!(day.dayNumber in prev)) return prev;
            const next = { ...prev };
            delete next[day.dayNumber];
            return next;
          });
          setRefreshSheetDay(prev => (prev === day.dayNumber ? null : prev));
          toast.success('Day timeline checked - looks clean');
        } else {
          setRefreshResults(prev => ({ ...prev, [day.dayNumber]: result }));
          setRefreshSheetDay(day.dayNumber);
          const errorCount = result.issues.filter(i => i.severity === 'error').length;
          const warnCount = result.issues.filter(i => i.severity === 'warning').length;
          toast(`Day ${day.dayNumber}: ${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warnCount} warning${warnCount !== 1 ? 's' : ''}`, {
            icon: '⚠️',
          });
        }
      } else {
        console.error('[handleRefreshDay] refresh-day returned null');
        toast.error('Refresh failed - please try again');
      }
    } catch (err: any) {
      console.error('[handleRefreshDay] failed', err);
      toast.error('Refresh failed - please try again');
    } finally {
      setRefreshingDayNumber(null);
    }
  }, [days, destination, refreshDay]);

  // External refresh-day requests (e.g. from TripHealthPanel quick-fix button)
  useEffect(() => {
    if (!refreshDayRequest?.dayNumber) return;
    const idx = days.findIndex((d: any) => d.dayNumber === refreshDayRequest.dayNumber);
    if (idx < 0) {
      console.warn('[refresh_day] day not found in editor', { dayNumber: refreshDayRequest.dayNumber, available: days.map((d: any) => d.dayNumber) });
      toast.error(`Day ${refreshDayRequest.dayNumber} is not loaded - try reopening the trip.`);
      return;
    }
    setSelectedDayIndex(idx);
    setActiveTab('itinerary');
    handleRefreshDay(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshDayRequest?.nonce]);

  // External fix-timing requests — deterministic auto-spacing of overlapping
  // activities. No AI call. Falls back to Refresh Day on day_overflow.
  useEffect(() => {
    if (!fixTimingRequest?.dayNumber) return;
    const idx = days.findIndex((d: any) => d.dayNumber === fixTimingRequest.dayNumber);
    if (idx < 0) {
      console.warn('[fix_timing] day not found in editor', { dayNumber: fixTimingRequest.dayNumber, available: days.map((d: any) => d.dayNumber) });
      toast.error(`Day ${fixTimingRequest.dayNumber} is not loaded - try reopening the trip.`);
      return;
    }
    (async () => {
      const day = days[idx];
      setSelectedDayIndex(idx);
      setActiveTab('itinerary');

      // Use the server validator as the single source of truth — it knows
      // about transit-aware buffers, operating hours, and sequence rules.
      // We only auto-apply *time-only* patches so the user sees nothing they
      // didn't ask for; closed-venue swaps remain visible in the diff panel.
      setRefreshingDayNumber(day.dayNumber);
      let firstResult: any = null;
      try {
        const activities = day.activities.map((a: any) => {
          const start = a.startTime || a.time || a.start_time;
          const dur = a.durationMinutes || a.duration_minutes || a.duration;
          let end = a.endTime || a.end_time;
          if (!end && start && typeof dur === 'number' && dur > 0) {
            const m = /^(\d{1,2}):(\d{2})/.exec(String(start));
            if (m) {
              const tot = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + dur;
              end = `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
            }
          }
          return {
            id: a.id, title: a.title || '', category: a.category,
            startTime: start, endTime: end, location: a.location,
            operatingHours: a.operatingHours,
            durationMinutes: typeof dur === 'number' ? dur : a.durationMinutes,
            cost: a.cost,
            // Pass lock flags so the server cascade respects them.
            locked: a.locked === true || a.isLocked === true || a.lock_state === 'locked',
            userAdded: a.userAdded === true,
            pinned: a.pinned === true,
            extracted: a.extracted === true,
            userOverride: a.userOverride === true,
          };
        });
        firstResult = await refreshDay(activities, day.date || '', destination, day.dayNumber);
      } catch (err: any) {
        setRefreshingDayNumber(null);
        toast.error(`Could not fix Day ${day.dayNumber}: ${err?.message || 'unknown error'}`);
        return;
      }
      setRefreshingDayNumber(null);

      if (!firstResult) {
        toast.error(`Could not fix Day ${day.dayNumber} timing.`);
        return;
      }

      const timeOnlyChanges = (firstResult.proposedChanges || []).filter(
        (c: any) => (c.type === 'time_shift' || c.type === 'buffer_added') && c.patch
      );
      const nonTimingIssues = (firstResult.issues || []).filter(
        (i: any) => i.type !== 'timing_overlap' && i.type !== 'insufficient_buffer'
      );

      if (timeOnlyChanges.length === 0) {
        setRefreshResults(prev => ({ ...prev, [day.dayNumber]: firstResult }));
        if ((firstResult.issues || []).length === 0) {
          toast.info(`Day ${day.dayNumber} timing already looks clean.`);
        } else {
          setRefreshSheetDay(day.dayNumber);
          toast(`Day ${day.dayNumber} has no auto-fixable timing issues. Review the suggestions.`, { icon: 'ℹ️' });
        }
        return;
      }

      // Apply the time-only patches via the same path the diff panel uses,
      // so cascading + sorting stays consistent.
      handleApplyRefreshChanges(idx, timeOnlyChanges as any);

      const remaining = nonTimingIssues.length;
      if (remaining === 0) {
        toast.success(
          `Day ${day.dayNumber} timing fixed - applied ${timeOnlyChanges.length} adjustment${timeOnlyChanges.length === 1 ? '' : 's'}.`
        );
      } else {
        toast(`Timing fixed. Day ${day.dayNumber} still has ${remaining} ${remaining === 1 ? 'issue' : 'issues'} that need review.`, { icon: 'ℹ️' });
      }
      requestAnimationFrame(() => {
        const el = document.getElementById(`day-${day.dayNumber}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      // Single follow-up re-check ONLY when non-timing issues remain. Skipping
      // the re-check on a clean cascade prevents a second `booking-changed`
      // wave that latches the Payments "Reconciling…" badge.
      if (nonTimingIssues.length > 0) {
        setTimeout(() => { handleRefreshDay(idx); }, 100);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixTimingRequest?.nonce]);

  // Apply accepted refresh changes — patches activity startTime/endTime by ID
  const handleApplyRefreshChanges = useCallback(async (dayIndex: number, changes: ProposedChange[]) => {
    // Lazy-load the shared cascade to run a final consistency pass on the
    // patched day. This guarantees the local commit is internally clean even
    // if the server returned partial patches.
    const { enforceTimingAndBuffers } = await import('@/utils/itinerary/timingCascade');

    setDays(prev => prev.map((day, dIdx) => {
      if (dIdx !== dayIndex) return day;
      const patchedActivities = day.activities.map(activity => {
        const change = changes.find(c => c.activityId === activity.id && c.patch);
        if (!change?.patch) return activity;
        const patched = {
          ...activity,
          ...(change.patch.startTime ? { startTime: change.patch.startTime as string, time: change.patch.startTime as string } : {}),
          ...(change.patch.endTime ? { endTime: change.patch.endTime as string } : {}),
        };
        // Auto-fix: if patch resulted in end <= start, restore original duration
        const pStart = patched.startTime || patched.time || '12:00';
        const pEnd = patched.endTime;
        if (pStart && pEnd) {
          const sMin = timeToMinutes(pStart);
          const eMin = timeToMinutes(pEnd);
          if (eMin <= sMin) {
            const origDuration = activity.durationMinutes || 30;
            patched.endTime = minutesToTime(sMin + origDuration);
          }
        }
        return patched;
      });
      // Sort chronologically (wrap-aware) after applying time patches
      patchedActivities.sort(
        (a, b) => dayChronoKey(a.startTime || a.time) - dayChronoKey(b.startTime || b.time),
      );

      // Final cascade safety net — resolves any residual overlap/buffer drift
      // produced by partial server patches. Locked rows stay put.
      const lockedIds = new Set<string>(
        (patchedActivities as any[])
          .filter((a) => a?.locked === true || a?.isLocked === true || a?.lock_state === 'locked' || a?.userAdded === true || a?.pinned === true || a?.extracted === true)
          .map((a) => String(a.id))
      );
      const cascade = enforceTimingAndBuffers(patchedActivities as any[], { lockedIds });
      return { ...day, activities: cascade.activities as any };
    }));
    setHasChanges(true);
    schedulePersist();
    // Clear refresh results for this day
    const dayNum = days[dayIndex]?.dayNumber;
    if (dayNum) {
      setRefreshResults(prev => { const next = { ...prev }; delete next[dayNum]; return next; });
    }
    // Notify Payments/Budget snapshots so their caches refetch in lockstep with
    // the upcoming autosave + cost reprojection. Tagged with reason+coalesceMs
    // so PaymentsTab coalesces back-to-back Fix-Timing events into a single refetch.
    try {
      window.dispatchEvent(new CustomEvent('booking-changed', {
        detail: { tripId, reason: 'fix_timing', coalesceMs: 1200 },
      }));
    } catch {}
    toast.success(`Applied ${changes.length} change${changes.length !== 1 ? 's' : ''} to Day ${dayNum || dayIndex + 1}`);
  }, [days, tripId]);
  
  // Credit nudge state
  const [creditNudge, setCreditNudge] = useState<{ action: keyof typeof CREDIT_COSTS } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  // Quick public-link share modal (separate from the manage/collaborators dialog)
  const [showQuickShareModal, setShowQuickShareModal] = useState(false);
  const [showShareGuideSheet, setShowShareGuideSheet] = useState(false);
   const [shareLink, setShareLink] = useState<string | null>(null);
   const [inviteHealth, setInviteHealth] = useState<InviteHealth | null>(null);
   const [showGroupUnlockModal, setShowGroupUnlockModal] = useState(false);
   const [newlyAddedMember, setNewlyAddedMember] = useState<string | null>(null);
   const [isCreatingInvite, setIsCreatingInvite] = useState(false);
   const [inviteCopied, setInviteCopied] = useState(false);
   // Currency display preference — every trip ALWAYS opens in USD.
   // Toggling to local is session-only and resets whenever `tripId` changes.
   // No localStorage/sessionStorage persistence — legacy keys purged below.
   // See mem://constraints/finance/currency-units-canonical.
   const [showLocalCurrency, setShowLocalCurrency] = useState<boolean>(false);
   useEffect(() => {
     // Hard reset on every trip mount / id change. This is THE guarantee that
     // navigating to a trip page always renders in USD first.
     setShowLocalCurrency(false);
     if (typeof window === 'undefined') return;
     try {
       const keys: string[] = [];
       for (let i = 0; i < window.localStorage.length; i++) {
         const k = window.localStorage.key(i);
         if (k && (k.startsWith('voyance.currencyToggle.') || k.startsWith('voyance.currency.'))) {
           keys.push(k);
         }
       }
       keys.forEach(k => window.localStorage.removeItem(k));
       // Also purge sessionStorage equivalents defensively.
       const sKeys: string[] = [];
       for (let i = 0; i < window.sessionStorage.length; i++) {
         const k = window.sessionStorage.key(i);
         if (k && (k.startsWith('voyance.currencyToggle.') || k.startsWith('voyance.currency.'))) {
           sKeys.push(k);
         }
       }
       sKeys.forEach(k => window.sessionStorage.removeItem(k));
     } catch { /* ignore */ }
   }, [tripId]);
  
  // Edit Flight/Hotel modal state
  const [editFlightOpen, setEditFlightOpen] = useState(false);
  const [editHotelOpen, setEditHotelOpen] = useState(false);
  // Add Flight dialog (accessible from any tab, e.g. ArrivalGamePlan on Day 1)
  const [addFlightDialogOpen, setAddFlightDialogOpen] = useState(false);
  
  // Inter-city transport editor state
  const [transportEditorOpen, setTransportEditorOpen] = useState(false);
  const [transportEditorCity, setTransportEditorCity] = useState<{
    cityId: string;
    fromCity: string;
    toCity: string;
    transportType?: 'flight' | 'train' | 'bus' | 'car' | 'ferry';
    transportDetails?: Record<string, unknown>;
    transportCostCents?: number;
    transportCurrency?: string;
  } | null>(null);
  const updateCityTransport = useUpdateCityTransport(tripId);

  // Optimize preferences dialog state
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false);
  const [optimizePrefs, setOptimizePrefs] = useState<OptimizePreferences | null>(null);
  // Track whether user has made changes that would benefit from re-optimization
  // Starts false for fresh itineraries (already optimized during generation)
  const [needsOptimization, setNeedsOptimization] = useState(false);
  const [showRouteUpgrade, setShowRouteUpgrade] = useState(false);

  // AI Swap (Activity Alternatives) state
  const [swapDrawerOpen, setSwapDrawerOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{ dayIndex: number; activityId: string } | null>(null);
  const [swapDrawerActivity, setSwapDrawerActivity] = useState<ItineraryActivity | null>(null);

  // Restaurant Search Drawer state
  const [restaurantDrawerOpen, setRestaurantDrawerOpen] = useState(false);
  const [restaurantDrawerMealType, setRestaurantDrawerMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'any'>('any');

  // AI Concierge state
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [conciergeActivity, setConciergeActivity] = useState<EditorialActivity | null>(null);
  const [conciergeDayDate, setConciergeDayDate] = useState('');
  const [conciergeDayTitle, setConciergeDayTitle] = useState('');
  const [conciergePrevActivity, setConciergePrevActivity] = useState<string | undefined>();
  const [conciergeNextActivity, setConciergeNextActivity] = useState<string | undefined>();

  const handleOpenConcierge = useCallback((activity: EditorialActivity, dayIndex: number, _activityIndex: number) => {
    const day = days[dayIndex];
    if (!day) return;
    setConciergeActivity(activity);
    setConciergeDayDate(day.date || '');
    setConciergeDayTitle(getDisplayDayTitle(day as any, destination) || `Day ${day.dayNumber}`);
    // Find previous/next visible activities
    const actIdx = day.activities.findIndex(a => a.id === activity.id);
    const prev = actIdx > 0 ? day.activities[actIdx - 1] : undefined;
    const next = actIdx < day.activities.length - 1 ? day.activities[actIdx + 1] : undefined;
    setConciergePrevActivity(prev?.title);
    setConciergeNextActivity(next?.title);
    setConciergeOpen(true);
  }, [days]);

  // Keep conciergeActivity in sync with `days` while the sheet is open so
  // saved AI notes appear immediately without closing/reopening the sheet.
  useEffect(() => {
    if (!conciergeOpen || !conciergeActivity) return;
    for (const day of days) {
      const live = day.activities?.find(a => a.id === conciergeActivity.id);
      if (live && live !== conciergeActivity) {
        setConciergeActivity(live as EditorialActivity);
        return;
      }
    }
  }, [days, conciergeOpen, conciergeActivity]);

  // AI Note save/delete handlers
  // IMPORTANT: persist immediately (don't rely on the 3 s autosave debounce).
  // Otherwise users who navigate away or close the sheet quickly lose the note,
  // which also wastes AI tokens when they regenerate the same tip later.
  const persistDaysImmediately = useCallback(async (nextDays: EditorialDay[]) => {
    // Note: gating on editability is handled at the UI level (the save button
    // is only rendered when the sheet is interactive); we always persist here.
    try {
      const itineraryData: Record<string, unknown> = {
        days: JSON.parse(JSON.stringify(nextDays)),
        status: 'ready',
        optionSelections,
        savedAt: new Date().toISOString(),
      };
      if (parsedMetadata) {
        itineraryData.metadata = { ...parsedMetadata, lastUpdated: new Date().toISOString() };
      }
      const { data: existingTrip } = await supabase
        .from('trips').select('id').eq('id', tripId).maybeSingle();
      if (existingTrip) {
        const { error } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'save-itinerary',
            tripId,
            itinerary: itineraryData,
            // AI notes are pure metadata writes on user-touched activities — they
            // must never trigger contract row drops or be blocked by the frozen gate.
            // 'user-' prefix is whitelisted in USER_SAVE_REASON_PREFIXES.
            saveReason: 'user-ai-note-save',
            skipContract: true,
          },
        });
        if (!error) {
          setHasChanges(false);
          setLastSaved(new Date());
          // Signal TripDetail (and other listeners) to re-read canonical
          // itinerary_data from the DB. Without this, TripDetail's
          // trip.itinerary_data — the source of `initialDays` — stays at its
          // pre-save value, so a soft (same-URL) remount rebuilds the day from
          // stale data and silently reverts the edit (the AI-note disappear-on-
          // reload bug; it also affected swap/reorder/edit). See the
          // TRIP_PERSISTED_EVENT handler in TripDetail.
          dispatchTripPersisted({ tripId, source: 'EditorialItinerary.persistImmediate' });
        } else {
          console.error('[EditorialItinerary] persistDaysImmediately save failed:', error);
        }
      } else {
        // localStorage demo trips
        const localStorageKey = 'voyance_demo_trips';
        const demoTripsRaw = localStorage.getItem(localStorageKey);
        const demoTrips = demoTripsRaw ? JSON.parse(demoTripsRaw) : {};
        demoTrips[tripId] = {
          ...(demoTrips[tripId] || {}),
          id: tripId,
          itinerary_data: itineraryData,
          itinerary_status: 'ready',
          updated_at: new Date().toISOString(),
        };
        localStorage.setItem(localStorageKey, JSON.stringify(demoTrips));
        setHasChanges(false);
        setLastSaved(new Date());
        dispatchTripPersisted({ tripId, source: 'EditorialItinerary.persistImmediate' });
      }
    } catch (e) {
      // Leave hasChanges=true so the autosave timer retries as a safety net.
      console.warn('[AI note] immediate persist failed; autosave will retry', e);
    }
  }, [tripId, optionSelections, parsedMetadata]);

  // C-TOOL-8 HARDENING: editor mutations historically only called
  // setHasChanges(true) and relied on the 3s autosave debounce, which is flaky
  // (guarded by editability; the timer is reset by background-enrichment setDays).
  // That silently dropped swaps/edits on a fast reload. Reorder + swap were fixed
  // to call persistDaysImmediately directly; the remaining day-mutating handlers
  // call schedulePersist() instead — this effect writes the freshly-committed
  // `days` straight to save-itinerary as soon as a mutation requests it.
  const persistRequestRef = useRef(false);
  const schedulePersist = useCallback(() => { persistRequestRef.current = true; }, []);
  useEffect(() => {
    if (!persistRequestRef.current) return;
    persistRequestRef.current = false;
    void persistDaysImmediately(days);
  }, [days, persistDaysImmediately]);

  const handleSaveAINote = useCallback(async (activityId: string, note: AISavedNote) => {
    let nextDays: EditorialDay[] = [];
    setDays(prev => {
      nextDays = prev.map(day => ({
        ...day,
        activities: day.activities.map(act => {
          if (act.id !== activityId) return act;
          // Defensive: never attach a note to a transit/logistics row.
          if (isNoteBlockedActivity(act)) return act;
          const existing = act.aiNotes || [];
          // Dedup by content
          if (existing.some(n => n.content === note.content)) return act;
          return { ...act, aiNotes: [...existing, note] };
        }),
      }));
      return nextDays;
    });
    setHasChanges(true);
    // persistDaysImmediately fires TRIP_PERSISTED_EVENT on success so the saved
    // note survives a soft (same-URL) reload — see that function.
    await persistDaysImmediately(nextDays);
  }, [persistDaysImmediately]);

  const handleDeleteAINote = useCallback(async (activityId: string, noteId: string) => {
    let nextDays: EditorialDay[] = [];
    setDays(prev => {
      nextDays = prev.map(day => ({
        ...day,
        activities: day.activities.map(act => {
          if (act.id !== activityId) return act;
          return { ...act, aiNotes: (act.aiNotes || []).filter(n => n.id !== noteId) };
        }),
      }));
      return nextDays;
    });
    setHasChanges(true);
    await persistDaysImmediately(nextDays);
  }, [persistDaysImmediately]);

  // Build saved note content set for current concierge activity
  // Derive from `days` state (not the stale `conciergeActivity` snapshot) so the
  // bookmark icon updates immediately after saving a note.
  const conciergeSavedNoteContents = useMemo(() => {
    if (!conciergeActivity) return new Set<string>();
    const actId = conciergeActivity.id;
    for (const day of days) {
      const liveAct = day.activities?.find((a: EditorialActivity) => a.id === actId);
      if (liveAct) {
        const notes = liveAct.aiNotes || [];
        return new Set(notes.map(n => n.content));
      }
    }
    // Fallback to snapshot if not found in days
    const notes = conciergeActivity.aiNotes || [];
    return new Set(notes.map(n => n.content));
  }, [conciergeActivity, days]);

  const [reviewsDrawerOpen, setReviewsDrawerOpen] = useState(false);
  const [reviewsTarget, setReviewsTarget] = useState<{ 
    placeName: string; 
    placeType?: 'restaurant' | 'attraction' | 'hotel' | 'activity';
    activityRating?: number;
    activityReviewCount?: number;
  } | null>(null);

  // Open reviews drawer for an activity
  const openReviewsDrawer = useCallback((activity: EditorialActivity) => {
    const activityType = getActivityType(activity);
    const placeName = activity.location?.name || activity.title || 'Unknown Place';
    
    let placeType: 'restaurant' | 'attraction' | 'hotel' | 'activity' = 'activity';
    if (['dining', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee'].includes(activityType)) {
      placeType = 'restaurant';
    } else if (['cultural', 'sightseeing', 'entertainment'].includes(activityType)) {
      placeType = 'attraction';
    } else if (activityType === 'accommodation') {
      placeType = 'hotel';
    }

    // Extract rating data for consistency between card and drawer
    const activityRating = getActivityRating(activity) ?? undefined;
    const activityReviewCount = getActivityReviewCount(activity) ?? undefined;

    setReviewsTarget({ placeName, placeType, activityRating, activityReviewCount });
    setReviewsDrawerOpen(true);
  }, []);

  const totalActivities = days.reduce((sum, day) => sum + day.activities.length, 0);
  const feedbackCount = payments.filter(p => p.status === 'paid').length;
  const progressPercent = totalActivities > 0 ? Math.min((feedbackCount / totalActivities) * 100, 100) : 0;

  // Day navigation
  const canGoPrev = selectedDayIndex > 0;
  const canGoNext = selectedDayIndex < days.length - 1;

  // Get entitlements for credit checking
  const { data: entitlements, isPaid } = useEntitlements(tripId);
  
  // Fetch trip-level unlocked_day_count as fallback for entitlements loading state.
  // Prevents "unlock days you already paid for" flash when entitlements are slow/failed.
  const { data: tripUnlockedCount } = useQuery({
    queryKey: ['trip-unlocked-count', tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from('trips')
        .select('unlocked_day_count')
        .eq('id', tripId)
        .maybeSingle();
      return (data as any)?.unlocked_day_count ?? 0;
    },
    staleTime: 30_000,
    enabled: !!tripId,
  });

  const { data: tripPlannerMetadata } = useQuery({
    queryKey: ['trip-planner-metadata', tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from('trips')
        .select('metadata')
        .eq('id', tripId)
        .single();
      const metadata = data?.metadata as Record<string, unknown> | null | undefined;
      return {
        integrityContract: metadata?.integrity_contract ?? null,
        omittedMustDos: metadata?.omitted_must_dos ?? null,
      };
    },
    enabled: !!tripId && !isCleanPreview,
    staleTime: 30_000,
  });
  
  // Wrapper: always pass trip-level fallback so paid days never show as locked
  const canViewDay = useCallback((dayNum: number) => {
    return canViewPremiumContentForDay(entitlements, dayNum, tripUnlockedCount ?? undefined);
  }, [entitlements, tripUnlockedCount]);
  
  // Credit system hooks
  const { data: creditData } = useCredits();
  const spendCredits = useSpendCredits();
  const totalCredits = creditData?.totalCredits ?? 0;
  const routeOptCost = useRouteOptCost(tripId);
  
  // Per-day unlock for preview itineraries
  const { unlockDay, isUnlocking: isUnlockingDay, unlockingDayNumber, state: unlockDayState } = useUnlockDay();
  const { bulkUnlock, isUnlocking: isBulkUnlocking } = useBulkUnlock();
  
  // Transport mode change free cap
  const transportCap = useActionCap(tripId, 'transport_mode_change');
  // Swap activity free cap
  const swapCap = useActionCap(tripId, 'swap_activity');
  
  const { isManualBuilder, enableManualBuilder } = useManualBuilderStore();
  // QA-021: Check DB creation_source in addition to localStorage
  const isManualMode = (tripId ? isManualBuilder(tripId) : false)
    || creationSource === 'manual_paste'
    || creationSource === 'manual';
  
  // Refetch itinerary data from DB and update local days state (no page reload needed)
  const refetchItineraryFromDb = useCallback(async () => {
    try {
      const { data: tripData } = await supabase
        .from('trips')
        .select('itinerary_data, start_date')
        .eq('id', tripId)
        .maybeSingle();
      if (tripData?.itinerary_data) {
        const freshDays = parseEditorialDays(tripData.itinerary_data, tripData.start_date) as EditorialDay[];
        if (freshDays.length > 0) {
          setDays(freshDays);
          console.log(`[EditorialItinerary] Refetched ${freshDays.length} days from DB`);
        }
      }
    } catch (err) {
      console.error('[EditorialItinerary] Failed to refetch itinerary:', err);
    }
  }, [tripId, setDays]);

  // Smart Finish state — check URL params for post-purchase return
  const [smartFinishPurchased, setSmartFinishPurchased] = useState(false);
  useEffect(() => {
    // Check if trip has smart_finish_purchased flag
    const checkSmartFinish = async () => {
      const { data } = await supabase
        .from('trips')
        .select('smart_finish_purchased')
        .eq('id', tripId)
        .single();
      if (data?.smart_finish_purchased) setSmartFinishPurchased(true);
    };
    checkSmartFinish();
    
    // Handle return from Stripe checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get('smart_finish') === 'success') {
      // Trigger enrichment (async — kicks off, then poll for completion)
      const enrich = async () => {
        toast.info('Smart Finish purchased! Generating your full itinerary…');
        // Remove query param immediately to prevent re-triggering on refresh
        const url = new URL(window.location.href);
        url.searchParams.delete('smart_finish');
        window.history.replaceState({}, '', url.toString());

        try {
          // Kick off — returns immediately
          const { error } = await supabase.functions.invoke('enrich-manual-trip', {
            body: { tripId },
          });
          if (error) {
            toast.error('Failed to start enrichment. Please refresh and try again.');
            return;
          }

          // Poll for completion
          const MAX_POLLS = 40;
          const POLL_INTERVAL = 5000;
          for (let i = 0; i < MAX_POLLS; i++) {
            await new Promise(r => setTimeout(r, POLL_INTERVAL));
            const { data: tripData } = await supabase
              .from('trips')
              .select('metadata')
              .eq('id', tripId)
              .maybeSingle();
            const meta = (tripData?.metadata ?? {}) as Record<string, unknown>;
            if (meta.smartFinishCompleted === true) {
              setSmartFinishPurchased(true);
              toast.success('Your itinerary has been enriched with DNA-matched activities!');
              await refetchItineraryFromDb();
              return;
            }
            if (meta.smartFinishFailed === true) {
              toast.error('Enrichment failed. Your credits will be refunded. Please try again.');
              return;
            }
          }
          toast.error('Enrichment is taking longer than expected. Please refresh the page.');
        } catch (err) {
          console.error('[EditorialItinerary] Smart Finish enrichment error:', err);
          toast.error('Enrichment failed. Please refresh the page to try again.');
        }
      };
      enrich();
    }
  }, [tripId]);

  // (groupUnlock URL param handled after tripPermission is available — see below)

  // AI features are locked for manual/imported trips until Smart Finish is purchased
  const aiLocked = isManualMode && !smartFinishPurchased;

  const [changingTransportActivityId, setChangingTransportActivityId] = useState<string | null>(null);

  // REMOVED: Auto-unlock useEffect that fired on every day navigation.
  // This caused "dead button" + duplicate credit charges (QA-plan item #1).
  // Unlock is now ONLY triggered by explicit user click on LockedDayCard CTA.

  // Handle per-day unlock from preview mode
  const handleUnlockDay = useCallback((dayNumber: number) => {
    unlockDay({
      tripId,
      dayNumber,
      totalDays: days.length,
      destination,
      destinationCountry,
      travelers,
      startDate,
      budgetTier,
      tripType,
    }, (unlockedDayNumber, enrichedDay) => {
      // Merge the enriched day back into state
      setDays(prev => prev.map(d => {
        if (d.dayNumber === unlockedDayNumber && enrichedDay) {
          const merged = {
            ...d,
            ...enrichedDay,
            dayNumber: unlockedDayNumber,
            _unlocked: true, // Mark as individually unlocked
          };
          return merged;
        }
        return d;
      }));
      setHasChanges(true);
      schedulePersist();
    });
  }, [unlockDay, tripId, days.length, destination, destinationCountry, travelers, startDate, budgetTier, tripType]);

  // Handler to reorder flight legs via drag-and-drop
  const handleReorderFlightLegs = useCallback(async (reorderedLegs: typeof allFlightLegs) => {
    if (!flightSelection) return;

    const updatedSelection: Record<string, unknown> = {
      ...flightSelection,
      legs: reorderedLegs,
    };

    // Update backward-compat departure/return fields
    const destArrivalLeg = reorderedLegs.find(l => l.isDestinationArrival) || reorderedLegs[0];
    if (destArrivalLeg) {
      updatedSelection.departure = {
        airline: destArrivalLeg.airline,
        flightNumber: destArrivalLeg.flightNumber,
        departure: destArrivalLeg.departure,
        arrival: destArrivalLeg.arrival,
        price: destArrivalLeg.price,
        cabinClass: destArrivalLeg.cabinClass,
      };
    }
    if (reorderedLegs.length >= 2) {
      const destDepartureLeg = reorderedLegs.find(l => l.isDestinationDeparture) || reorderedLegs[reorderedLegs.length - 1];
      updatedSelection.return = {
        airline: destDepartureLeg.airline,
        flightNumber: destDepartureLeg.flightNumber,
        departure: destDepartureLeg.departure,
        arrival: destDepartureLeg.arrival,
        price: destDepartureLeg.price,
        cabinClass: destDepartureLeg.cabinClass,
      };
    }

    const { error } = await supabase
      .from('trips')
      .update({ flight_selection: updatedSelection as any })
      .eq('id', tripId);

    if (error) {
      console.error('Failed to reorder flight legs:', error);
      toast.error('Failed to reorder flights');
      return;
    }

    toast.success('Flight order updated');

    // Cascade + dayMode recompute (recomputeDayModes runs inside cascade)
    try {
      const { runCascadeAndPersist } = await import('@/services/cascadeTransportToItinerary');
      const { getTripCities } = await import('@/services/tripCitiesService');
      const cities = await getTripCities(tripId);
      await runCascadeAndPersist(tripId, days, updatedSelection, cities);
    } catch (cascadeErr) {
      console.warn('[reorderFlightLegs] cascade skipped:', cascadeErr);
    }

    await Promise.resolve(onBookingAdded?.());
  }, [flightSelection, tripId, onBookingAdded, days]);


  // Handle transport mode change for a specific activity route segment
  const handleTransportModeChange = useCallback(async (dayIndex: number, activityId: string, newMode: string) => {
    const day = days[dayIndex];
    const activity = day?.activities.find(a => a.id === activityId);
    if (!activity?.transportation) return;

    // Lock guard — locked transport segments must not be mutated by AI/user mode change.
    const isLockedFlag = (a: any) =>
      !!a && (a.isLocked === true || a.locked === true || a.lock_state === 'locked');
    if (isLockedFlag(activity)) {
      toast.error('This transport segment is locked. Unlock it first to change mode.');
      return;
    }

    // Transport mode changes are free — no credit charge

    const MODE_LABELS: Record<string, string> = {
      walking: 'Walk', walk: 'Walk', metro: 'Metro', bus: 'Bus',
      uber: 'Rideshare', taxi: 'Taxi', train: 'Train', subway: 'Metro',
      rideshare: 'Rideshare', car: 'Drive', drive: 'Drive',
    };

    // Apply a mode change locally to a single activity. Used by all branches
    // (optimize-success / no-data / threw). When `optTransportation` is given,
    // we trust the optimize output for cost/duration; otherwise we fall back
    // to `transportModeFallbackCost` and tag basis='fallback_estimate'.
    const applyModeUpdate = async (
      act: EditorialActivity,
      optTransportation?: Record<string, any>,
    ): Promise<EditorialActivity> => {
      if (!act.transportation) return act;
      const destMatch = (act.title || '').match(/^.+?\sto\s(.+)$/i);
      const newTitle = destMatch
        ? `${MODE_LABELS[(newMode || '').toLowerCase()] || newMode} to ${destMatch[1]}`
        : act.title;

      let nextTransport: Record<string, any>;
      if (optTransportation) {
        nextTransport = { ...optTransportation, method: newMode };
      } else {
        const { transportModeFallbackCost, TRANSPORT_FALLBACK_BASIS } = await import(
          '@/lib/itinerary/transportModeFallbackCost'
        );
        nextTransport = {
          ...act.transportation,
          method: newMode,
          estimatedCost: {
            amount: transportModeFallbackCost(newMode),
            currency: act.transportation.estimatedCost?.currency || 'USD',
            basis: TRANSPORT_FALLBACK_BASIS,
          },
        };
      }

      return {
        ...act,
        title: newTitle,
        location: act.location ? { ...act.location, name: newTitle } : act.location,
        transportation: nextTransport as EditorialActivity['transportation'],
      };
    };

    setChangingTransportActivityId(activityId);
    let usedFallback = false;
    try {
      // Call optimize for just this single segment with the specified mode
      const activityIndex = day.activities.findIndex(a => a.id === activityId);
      const nextActivity = day.activities[activityIndex + 1];

      let optimizedDay: any | null = null;
      try {
        const { data, error } = await supabase.functions.invoke('optimize-itinerary', {
          body: {
            tripId,
            destination,
            days: [{
              dayNumber: day.dayNumber,
              date: day.date,
              activities: day.activities.map(a => ({
                id: a.id,
                title: a.title,
                category: a.category || a.type,
                startTime: a.startTime,
                endTime: a.endTime,
                location: a.location,
                cost: a.cost,
                transportation: a.transportation,
              })),
            }],
            enableRouteOptimization: true,
            enableRealTransport: true,
            enableCostLookup: false,
            transportPreferences: {
              allowedModes: [newMode],
              forceModeForSegment: {
                fromActivityId: activityId,
                toActivityId: nextActivity?.id,
                mode: newMode,
              },
            },
          },
        });
        if (error) throw error;
        optimizedDay = data?.days?.[0] ?? null;
      } catch (optErr) {
        console.error('Transport mode change error:', optErr);
        usedFallback = true;
      }

      // Compute new activity (single source of truth for all branches).
      const optAct = optimizedDay?.activities?.find?.((oa: any) => oa.id === activityId);
      if (!optAct?.transportation) usedFallback = true;
      const updatedActivity = await applyModeUpdate(activity, optAct?.transportation);

      // Build next days array.
      const nextDays = days.map((d, idx) => {
        if (idx !== dayIndex) return d;
        return {
          ...d,
          activities: d.activities.map(a => (a.id === activityId ? updatedActivity : a)),
        };
      });

      setDays(nextDays);

      // Reflect new transport cost in the budget ledger immediately.
      try {
        syncBudgetFromDays(nextDays);
      } catch (syncErr) {
        console.warn('[transportModeChange] syncBudgetFromDays failed:', syncErr);
      }

      // Persist immediately via the sanctioned write path so a refresh before
      // global Save doesn't drop the change.
      try {
        const { safeUpdateItineraryData } = await import('@/services/safeUpdateItineraryData');
        const itineraryToPersist: Record<string, unknown> = {
          days: JSON.parse(JSON.stringify(nextDays)),
          status: 'ready',
          optionSelections,
          savedAt: new Date().toISOString(),
        };
        if (parsedMetadata) {
          itineraryToPersist.metadata = { ...parsedMetadata, lastUpdated: new Date().toISOString() };
        }
        const res = await safeUpdateItineraryData(tripId, itineraryToPersist, {}, { allowFrozenWrite: true, reason: 'user-editor-save' });
        if (res?.error) throw res.error;
        setHasChanges(false);
        setLastSaved(new Date());
      } catch (persistErr) {
        console.warn('[transportModeChange] persist failed, falling back to global Save:', persistErr);
        setHasChanges(true);
      }

      const label = MODE_LABELS[newMode.toLowerCase()] || newMode;
      toast.success(usedFallback ? `Updated to ${label} (estimated cost)` : `Updated to ${label}`);
    } finally {
      setChangingTransportActivityId(null);
    }
  }, [days, tripId, destination, optionSelections, parsedMetadata, syncBudgetFromDays]);
  // Get trip permission for current user
  const { data: tripPermission, isLoading: permissionLoading } = useTripPermission(tripId);
  const { data: collaborators = [], refetch: refetchCollaborators } = useTripCollaborators(tripId);
  const { data: tripMembers = [] } = useTripMembers(tripId);
  const { guestEditMode, isPropose, setGuestEditMode, isUpdating: isUpdatingEditMode } = useGuestEditMode(tripId);
  
  // Get budget settings to pass limit to PaymentsTab
  const { settings: budgetSettings, isGenerating: isBudgetGenerating } = useTripBudget({ tripId, totalDays: days.length, enabled: true });
  
  // Manual builder overrides preview mode — user gets full editing without AI enrichment
  const effectiveIsPreview = isPreview && !isManualMode;

  // Determine effective editability based on permission + guest edit mode
  // Owner always can edit. Guests can edit freely only if mode is 'free_edit' AND they have edit permission.
  // In 'propose_approve' mode, guests can only propose changes (not directly edit).
  // IMPORTANT: While permission is loading, default to editable (owner assumption) to avoid blocking UI.
  const permissionResolved = !permissionLoading && !!tripPermission;
  const guestCanDirectEdit = tripPermission?.canEdit && guestEditMode === 'free_edit';
  // Past trips (endDate < today) are always read-only
  const isPastTrip = endDate ? isPast(startOfDay(addDays(parseLocalDate(endDate), 1))) : false;
  const effectiveIsEditable = !isPastTrip && !effectiveIsPreview && isEditable && (
    !permissionResolved || tripPermission?.isOwner || guestCanDirectEdit
  );
  const guestMustPropose = !effectiveIsPreview && isEditable && permissionResolved && !tripPermission?.isOwner && tripPermission?.canEdit && isPropose;

  // Handle ?groupUnlock=true URL param (e.g., from member_joined notification)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('groupUnlock') === 'true' && tripPermission?.isOwner) {
      // Remove param to prevent re-triggering
      const url = new URL(window.location.href);
      url.searchParams.delete('groupUnlock');
      window.history.replaceState({}, '', url.toString());
      
      // Check if budget already exists before prompting
      supabase
        .from('group_budgets')
        .select('id')
        .eq('trip_id', tripId)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) {
            setTimeout(() => setShowGroupUnlockModal(true), 500);
          }
        });
    }
  }, [tripId, tripPermission?.isOwner]);

  const collaboratorColorMap = useMemo(() => {
    // Merge collaborators (trip_collaborators) with tripMembers (trip_members)
    const allParticipantIds = new Set<string>();
    const existingNames = new Set<string>();
    const existingLastNames = new Set<string>();
    const mergedCollaborators: Array<{ user_id: string; profile?: { display_name?: string | null; handle?: string | null } | null }> = [];

    collaborators.forEach(c => {
      allParticipantIds.add(c.user_id);
      mergedCollaborators.push(c);
      if (c.profile?.display_name) {
        const name = c.profile.display_name.toLowerCase();
        existingNames.add(name);
        // Track last name for fuzzy dedup (e.g. "A.L. Lightfoot" vs "Ashton Lightfoot")
        const parts = name.split(/\s+/);
        if (parts.length > 1) existingLastNames.add(parts[parts.length - 1]);
      }
    });

    // Also add the owner's name to dedup sets
    const ownerName = (user?.name || user?.email?.split('@')[0] || '').toLowerCase();
    if (ownerName) {
      existingNames.add(ownerName);
      const ownerParts = ownerName.split(/\s+/);
      if (ownerParts.length > 1) existingLastNames.add(ownerParts[ownerParts.length - 1]);
    }

    tripMembers.forEach(m => {
      const memberId = m.userId || `member_${m.id}`;
      const memberName = m.name || m.email?.split('@')[0] || '';
      const memberNameLower = memberName.toLowerCase();

      // Skip if already present by userId
      if (allParticipantIds.has(memberId)) return;
      // Skip if exact name match
      if (existingNames.has(memberNameLower)) return;
      // Skip unlinked members whose last name matches an existing participant
      // (handles variants like "A.L. Lightfoot" vs "Ashton Lightfoot")
      if (!m.userId && memberNameLower) {
        const parts = memberNameLower.split(/\s+/);
        if (parts.length > 1 && existingLastNames.has(parts[parts.length - 1])) return;
      }

      allParticipantIds.add(memberId);
      existingNames.add(memberNameLower);
      const nameParts = memberNameLower.split(/\s+/);
      if (nameParts.length > 1) existingLastNames.add(nameParts[nameParts.length - 1]);
      mergedCollaborators.push({
        user_id: memberId,
        profile: { display_name: memberName || null, handle: null },
      });
    });

    if (mergedCollaborators.length === 0) return undefined;
    const ownerId = user?.id || '__owner__';
    const ownerDisplayName = user?.name || user?.email?.split('@')[0] || 'You';
    return buildCollaboratorColorMap(ownerId, ownerDisplayName, mergedCollaborators);
  }, [collaborators, tripMembers, user]);

  // Calculate intelligence value stats for the itinerary
  const { skippedItems, isLoading: isLoadingSkipList } = useSkipList(destination);
  const valueStats = useMemo(() => calculateItineraryValueStats(days, skippedItems), [days, skippedItems]);

  // Dynamic itinerary validation - detect skip list violations and other issues.
  // Note: celebration_misplaced / sequence_error / pricing_error currently have
  // no UI affordance (no remediation button or panel). To avoid surfacing
  // warnings users can't act on, those types are demoted to console.debug here.
  // Only `skip_list` reaches the visible "Heads up" panel below.
  const validationIssues = useMemo<ValidationIssue[]>(() => {
    const result = validateItinerary(days, {
      destination,
      tripType,
      celebrationDay,
      totalDays: days.length
    });
    const silent = result.issues.filter(i => i.type !== 'skip_list');
    if (silent.length > 0) {
      console.debug('[itineraryValidator] silent (no-UI) issues:', silent);
    }
    return result.issues.filter(i => i.type === 'skip_list');
  }, [days, destination, tripType, celebrationDay]);
  
  // Get skip list violation IDs for highlighting in the UI
  const skipListViolationIds = useMemo(() => {
    return new Set(
      validationIssues
        .filter(i => i.type === 'skip_list')
        .map(i => i.activityId)
    );
  }, [validationIssues]);

  // Hero image removed — TripDetail page renders its own hero via DynamicDestinationPhotos

  // Scroll selected day button into view — horizontally within the day-picker
  // container only. Skip first mount so opening the itinerary never yanks
  // window scroll down to today's pill.
  useEffect(() => {
    if (!didMountDayPickerRef.current) {
      didMountDayPickerRef.current = true;
      return;
    }
    const container = dayPickerScrollRef.current;
    const btn = dayButtonRefs.current[selectedDayIndex];
    if (container && btn) {
      const target = btn.offsetLeft - (container.clientWidth - btn.clientWidth) / 2;
      container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
  }, [selectedDayIndex]);

  // Preload cost index cache on mount for destination-aware pricing
  useEffect(() => {
    preloadCostIndex();
  }, []);

  // Grant second_itinerary bonus if user has 2+ trips (handles retroactive grants too)
  useEffect(() => {
    if (!user?.id || hasClaimedBonus('second_itinerary')) return;
    const checkSecondTripBonus = async () => {
      const { count } = await supabase
        .from('trips')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (count && count >= 2) {
        claimBonus('second_itinerary', { tripCount: count }).then((result) => {
          if (result.granted) {
            toast.success(`+${result.credits} credits earned for creating your second trip! ✈️`);
          }
        }).catch((e) => console.warn('Failed to claim second_itinerary bonus:', e));
      }
    };
    checkSecondTripBonus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Safety fix for already-saved itineraries: ensure checkout renders before airport transfer on last day
  useEffect(() => {
    setDays(prev => {
      if (!prev || prev.length === 0) return prev;
      const lastIdx = prev.length - 1;
      const lastDay = prev[lastIdx];
      const activities = lastDay?.activities;
      if (!activities || activities.length < 2) return prev;

      const checkoutIdx = activities.findIndex(a => {
        const t = (a.title || '').toLowerCase();
        return t.includes('checkout') || t.includes('check-out') || t.includes('check out');
      });
      const airportIdx = activities.findIndex(a => {
        const t = (a.title || '').toLowerCase();
        const isAirportish = t.includes('airport') || t.includes('departure transfer');
        const isTransportish = (a.category || '').toLowerCase() === 'transport' || t.includes('transfer') || t.includes('departure');
        return isAirportish && isTransportish;
      });

      // Already correct (or not applicable)
      if (checkoutIdx === -1 || airportIdx === -1 || checkoutIdx < airportIdx) return prev;

      const parseMins = (timeStr?: string): number | null => {
        if (!timeStr) return null;
        const parts = timeStr.split(':');
        if (parts.length !== 2) return null;
        const h = Number(parts[0]);
        const m = Number(parts[1]);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return h * 60 + m;
      };
      const fmt = (mins: number): string => {
        const h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };
      const duration = (start?: string, end?: string, fallback = 15): number => {
        const s = parseMins(start);
        const e = parseMins(end);
        if (s === null || e === null) return fallback;
        return Math.max(5, e - s);
      };

      const checkout = { ...activities[checkoutIdx] };
      const airport = { ...activities[airportIdx] };

      const checkoutDur = duration(checkout.startTime || checkout.time, checkout.endTime, 15);
      const transferDur = duration(airport.startTime || airport.time, airport.endTime, 60);

      const airportStart = airport.startTime || airport.time;
      const airportStartMins = parseMins(airportStart);
      if (airportStartMins === null) return prev;

      checkout.startTime = fmt(airportStartMins);
      checkout.endTime = fmt(airportStartMins + checkoutDur);
      airport.startTime = checkout.endTime;
      airport.endTime = fmt(parseMins(airport.startTime) + transferDur);

      const nextActivities = [...activities];
      nextActivities[airportIdx] = checkout;
      nextActivities[checkoutIdx] = airport;
      nextActivities.sort(
        (a, b) => dayChronoKey(a.startTime || a.time) - dayChronoKey(b.startTime || b.time),
      );

      return prev.map((d, idx) => (idx === lastIdx ? { ...d, activities: nextActivities } : d));
    });
  }, [tripId]);

  // Fetch payments on mount
  useEffect(() => {
    async function fetchPayments() {
      const result = await getTripPayments(tripId);
      if (result.success && result.payments) {
        setPayments(result.payments);
      }
    }
    fetchPayments();
  }, [tripId]);

  // Preload airport codes for display (City + Code format)
  const [airportCacheReady, setAirportCacheReady] = useState(false);
  // Derive a flat list of all flight legs (prefer legs[], fall back to outbound/return)
  const allFlightLegs: FlightLegDisplay[] = useMemo(() => {
    if (!flightSelection) return [];
    // Helper to normalize raw leg data field names
    const normalizeLeg = (leg: Record<string, unknown>): FlightLegDisplay => ({
      ...leg as FlightLegDisplay,
      seat: (leg.seat as string) || (leg.seatNumber as string) || undefined,
      cabinClass: (leg.cabinClass as string) || (leg.cabin as string) || undefined,
    });
    // Route through normalizeFlightSelection so estimateReturnArrival fills
    // in missing return-leg arrival time (form doesn't collect it) and
    // autoTagLegs sets destination flags. Without this, the return leg
    // renders as "--:--".
    const _destIata = (() => {
      try {
        const fs: any = flightSelection || {};
        const legsArr = Array.isArray(fs.legs) ? fs.legs : [];
        const marked = legsArr.find((l: any) => l?.isDestinationArrival);
        return (
          (marked?.arrival?.airport as string | undefined) ||
          (marked?.arrivalAirport as string | undefined) ||
          (fs.arrivalAirport as string | undefined) ||
          null
        );
      } catch { return null; }
    })();
    const normalized = normalizeFlightSelection(flightSelection as unknown, { destinationIata: _destIata });
    if (normalized && normalized.legs.length > 0) {
      return normalized.legs.map(l => normalizeLeg(l as unknown as Record<string, unknown>));
    }
    // Fallback for shapes the normalizer doesn't recognize (defensive).
    if (flightSelection.legs && flightSelection.legs.length > 0) {
      return flightSelection.legs.map(l => normalizeLeg(l as unknown as Record<string, unknown>));
    }
    const result: FlightLegDisplay[] = [];
    if (flightSelection.outbound) result.push(normalizeLeg(flightSelection.outbound as unknown as Record<string, unknown>));
    if (flightSelection.return) result.push(normalizeLeg(flightSelection.return as unknown as Record<string, unknown>));
    return result;
  }, [flightSelection]);


  // Find the leg that actually arrives at the destination (user-marked or heuristic)
  const destinationArrivalLeg: FlightLegDisplay | undefined = useMemo(() => {
    if (allFlightLegs.length === 0) return undefined;
    // 1. User-marked
    const marked = allFlightLegs.find(l => (l as any).isDestinationArrival);
    if (marked) return marked;
    // 2. Single leg
    if (allFlightLegs.length === 1) return allFlightLegs[0];
    // 3. For 2 legs (outbound + return), use first
    if (allFlightLegs.length === 2) return allFlightLegs[0];
    // 4. For 3+ legs, second-to-last (assumes last is return)
    return allFlightLegs[allFlightLegs.length - 2];
  }, [allFlightLegs]);

  const hasFlightData = allFlightLegs.length > 0;

  useEffect(() => {
    const codes: string[] = [];
    allFlightLegs.forEach(leg => {
      if (leg.departure?.airport) codes.push(leg.departure.airport);
      if (leg.arrival?.airport) codes.push(leg.arrival.airport);
    });
    
    if (codes.length > 0) {
      preloadAirportCodes(codes).then(() => setAirportCacheReady(true));
    } else {
      setAirportCacheReady(true);
    }
  }, [allFlightLegs]);

  // Handler to mark a flight leg as destination arrival or departure
  const handleMarkFlightLeg = useCallback(async (legIndex: number, field: 'isDestinationArrival' | 'isDestinationDeparture') => {
    if (!flightSelection || allFlightLegs.length < 2) return;
    
    // Build updated legs array: toggle the flag on the selected leg, clear it on others
    const updatedLegs = allFlightLegs.map((leg, i) => {
      const isTarget = i === legIndex;
      const currentValue = !!(leg as any)[field];
      return {
        ...leg,
        [field]: isTarget ? !currentValue : false,
      };
    });

    // Build the updated flight_selection with both legs[] and backward-compat fields
    const updatedSelection: Record<string, unknown> = {
      ...flightSelection,
      legs: updatedLegs,
    };

    // Update backward-compat departure/return fields
    const destArrivalLeg = updatedLegs.find(l => l.isDestinationArrival) || updatedLegs[0];
    if (destArrivalLeg) {
      updatedSelection.departure = {
        airline: destArrivalLeg.airline,
        flightNumber: destArrivalLeg.flightNumber,
        departure: destArrivalLeg.departure,
        arrival: destArrivalLeg.arrival,
        price: destArrivalLeg.price,
        cabinClass: destArrivalLeg.cabinClass,
      };
    }
    if (updatedLegs.length >= 2) {
      // Prefer the starred departure leg; fallback to last leg
      const destDepartureLeg = updatedLegs.find(l => l.isDestinationDeparture) || updatedLegs[updatedLegs.length - 1];
      updatedSelection.return = {
        airline: destDepartureLeg.airline,
        flightNumber: destDepartureLeg.flightNumber,
        departure: destDepartureLeg.departure,
        arrival: destDepartureLeg.arrival,
        price: destDepartureLeg.price,
        cabinClass: destDepartureLeg.cabinClass,
      };
    }

    // Persist to DB
    const { error } = await supabase
      .from('trips')
      .update({ flight_selection: updatedSelection as any })
      .eq('id', tripId);

    if (error) {
      console.error('Failed to update flight leg marker:', error);
      toast.error('Failed to update flight leg marker');
      return;
    }

    toast.success(field === 'isDestinationArrival' 
      ? 'Destination arrival leg updated' 
      : 'Destination departure leg updated');

    let cascadeChanged = false;
    // Run cascade to update Day 1 / last day scheduling based on new arrival/departure
    try {
      const { runCascadeAndPersist } = await import('@/services/cascadeTransportToItinerary');
      const { getTripCities } = await import('@/services/tripCitiesService');
      const cities = await getTripCities(tripId);
      const currentDays = days; // use local days state
      cascadeChanged = await runCascadeAndPersist(tripId, currentDays, updatedSelection, cities);
      
      // Refetch itinerary from DB to pick up cascade changes
      const { data: refreshed } = await supabase
        .from('trips')
        .select('itinerary_data')
        .eq('id', tripId)
        .single();

      if (refreshed?.itinerary_data) {
        const itData = refreshed.itinerary_data as Record<string, unknown>;
        // Correctly parse days from any supported shape
        let refreshedDays: EditorialDay[] = [];
        if (Array.isArray(itData.days) && itData.days.length > 0) {
          refreshedDays = itData.days as EditorialDay[];
        } else if (itData.itinerary && typeof itData.itinerary === 'object') {
          const nested = itData.itinerary as Record<string, unknown>;
          if (Array.isArray(nested.days) && nested.days.length > 0) {
            refreshedDays = nested.days as EditorialDay[];
          }
        }
        // Final fallback: use the full parser
        if (refreshedDays.length === 0) {
          refreshedDays = parseEditorialDays(refreshed.itinerary_data, startDate) as unknown as EditorialDay[];
        }
        if (refreshedDays.length > 0) {
          setDays(refreshedDays);
        }
      }

      toast.info('Flight tags saved.');

    } catch (cascadeErr) {
      console.warn('Cascade after leg marking failed:', cascadeErr);
    } finally {
      // Refresh parent state after cascade/refetch to avoid stale itinerary overwrites
      await Promise.resolve(onBookingAdded?.());
    }
  }, [flightSelection, allFlightLegs, tripId, onBookingAdded, days, setDays]);

  // Helper to find payment for an item
  const getPaymentForItem = useCallback((itemType: 'flight' | 'hotel' | 'activity', itemId: string): TripPayment | undefined => {
    return payments.find(p => p.item_type === itemType && p.item_id === itemId);
  }, [payments]);

  // Refresh payments after booking
  const refreshPayments = useCallback(async () => {
    const result = await getTripPayments(tripId);
    if (result.success && result.payments) {
      setPayments(result.payments);
    }
  }, [tripId]);

  // ─── Canonical trip total from useTripFinancialSnapshot (single source of truth) ───
  const financialSnapshot = useTripFinancialSnapshot(tripId);

  // Populate the ledger-override map so getActivityCostInfo can prefer
  // server-floored prices over stale JSONB on a per-card basis.
  useLedgerCostOverrideMap(tripId);

  // ─── Per-day breakdown from the same activity_costs table — guarantees that
  // the sum of day badges + day-0 logistics + reserve == trip total. ───
  const visibleActivityIdList = useMemo(() => {
    const ids: string[] = [];
    for (const d of days) for (const a of d.activities || []) if (a?.id) ids.push(String(a.id));
    return ids;
  }, [days]);
  const tripDayBreakdown = useTripDayBreakdown(tripId, visibleActivityIdList);

  // Calculate totals with smart estimation using destination-aware pricing
  const totalActivityCost = days.reduce((sum, day) => sum + getDayTotalCost(day.activities, travelers, budgetTier, destination, destinationCountry, isManualMode), 0);
  const flightCost = allFlightLegs.reduce((sum, leg) => sum + (leg.price || 0), 0);
  // Flights & Hotels tab — invariants: this number, the canonical hotel row in
  // `usePayableItems`, and the `activity_costs` row written by
  // `syncHotelToLedger` MUST agree. All three call `computeHotelCostUsd` so a
  // change to the math propagates everywhere at once.
  // Use canonical trip duration (date span) not `days.length` — a JSON write
  // that briefly shrinks `days` (Bangkok pattern) must NOT collapse the hotel
  // total to "1 night". See mem://constraints/itinerary/no-regression-overwrite.
  const hotelCost = computeHotelCostUsd(allHotels as any, hotelSelection as any, expectedTotalDays);

  
  // Use financial snapshot as the SOLE source of truth for trip total.
  // While the snapshot is loading we render 0 (the header shows "Calculating…"
  // beside it), instead of computing a JS-estimator fallback that would
  // flash a wildly different number for ~1s on every refresh and feel like
  // "the price changed". The earlier fallback also double-multiplied
  // travelers and ignored the budget_include_hotel/flight toggles.
  const snapshotTotalUsd = financialSnapshot.tripTotalCents / 100;
  const totalCost = financialSnapshot.loading ? 0 : snapshotTotalUsd;
  // Surface "Calculating…" both while the AI is generating AND while the
  // canonical financial snapshot is still loading. Without the snapshot
  // gate, refresh would briefly render `$0` and then jump to the real
  // total — which read as "the price changed" to users.
  // Spinner only when we have NO total to render yet OR the AI is actively
  // generating. Background refetches (booking-changed, backfill events) must
  // never re-spin once we've already displayed a real number — that was the
  // wedge users saw across Casablanca/Kyoto/Osaka/Amsterdam.
  const isBudgetCalculating = isBudgetGenerating ||
    (financialSnapshot.loading && financialSnapshot.tripTotalCents === 0);

  // ─── Reconciliation between per-day badges and the trip total ───
  // tripLevelCents = trip total − Σ day(d≥1) totals
  // Captures Day-0 logistics (hotel/flight/transfers), unspent misc reserve,
  // and manual-payment override deltas — i.e. anything not attributed to a
  // specific day. Surfaced as its own line so day badges sum to trip total.
  const daysSubtotalCents = useMemo(() => {
    let sum = 0;
    for (const d of days) {
      const b = tripDayBreakdown.byDay[d.dayNumber];
      if (b) sum += b.totalCents;
    }
    return sum;
  }, [days, tripDayBreakdown.byDay]);
  const tripLevelCents = Math.max(
    0,
    financialSnapshot.tripTotalCents - daysSubtotalCents,
  );

  // ─── Single header-strip computation ───
  // Sourced from the shared `composeDisplayedTripTotal` composer so the
  // top-line `Trip Total`, the equation-row `Trip Total`, the Reconciling
  // hint, the PaymentsTab "Trip Total"/"Matches itinerary" badge, and the
  // BudgetTab/BudgetCoach `currentTotalCents` all read from the same
  // function. Composer guarantees `displayed = max(snapshot, days + hotel
  // + flight)` whenever a hotel/flight chip is visible. We reuse the
  // existing `financialSnapshot` + `tripDayBreakdown` instances (which the
  // per-day panels also need) instead of calling `useDisplayedTripTotal`
  // here — that would trigger a duplicate snapshot+breakdown fetch.
  // See mem://constraints/finance/displayed-trip-total-single-source +
  // mem://constraints/finance/header-strip-mirrors-snapshot.
  const dayNumbersForStrip = useMemo(
    // Filter out Day 0 — it's logistics (hotel/flight/transfers) already
    // captured by the hotel/flight chips and excluded by the PaymentsTab
    // default branch in `composeDisplayedTripTotal`. Without this filter the
    // header's `daysGroup` silently double-counts Day-0 logistics, inflating
    // `displayedTripTotal = max(snapshot, chipSum)` above the snapshot the
    // PaymentsTab "Trip Total" shows ($231 vs $219 drift).
    () => days.map(d => d.dayNumber).filter(n => n > 0),
    [days],
  );
  const displayedTotal = useMemo(
    () => composeDisplayedTripTotal(financialSnapshot, tripDayBreakdown, dayNumbersForStrip),
    [
      financialSnapshot.tripTotalCents,
      financialSnapshot.effectiveHotelCents,
      financialSnapshot.effectiveFlightCents,
      financialSnapshot.excludedHotelCents,
      financialSnapshot.excludedFlightCents,
      financialSnapshot.loading,
      tripDayBreakdown.byDay,
      tripDayBreakdown.loading,
      dayNumbersForStrip,
    ],
  );
  const headerStripValues = displayedTotal.headerStripValues;

  // Dev guard: warn when day totals exceed trip total (indicates the snapshot
  // dropped rows the day breakdown still counts — e.g. orphan filter mismatch).
  useEffect(() => {
    if (financialSnapshot.loading || tripDayBreakdown.loading) return;
    if (financialSnapshot.tripTotalCents <= 0) return;
    if (daysSubtotalCents > financialSnapshot.tripTotalCents + 1) {
      // eslint-disable-next-line no-console
      console.warn('[Itinerary reconcile] Day totals exceed trip total', {
        tripTotalCents: financialSnapshot.tripTotalCents,
        daysSubtotalCents,
        diffCents: daysSubtotalCents - financialSnapshot.tripTotalCents,
      });
    }
  }, [financialSnapshot.loading, financialSnapshot.tripTotalCents, daysSubtotalCents, tripDayBreakdown.loading]);

  // Derive local currency robustly (destinationInfo is often undefined on TripDetail)
  // IMPORTANT: If the trip is in the Eurozone, prefer EUR even if some upstream metadata is wrong.
  // SAR/territory override: Hong Kong, Macau, and Taiwan trips often arrive with destinationCountry="China",
  // which would otherwise resolve to CNY. Detect by destination string and pin the correct currency first.
  const destLowerEarly = (destination || '').toLowerCase();
  const sarOverride: string | null =
    /\bhong\s*kong\b|\bhk\b/.test(destLowerEarly) ? 'HKD'
    : /\bmacau\b|\bmacao\b/.test(destLowerEarly) ? 'MOP'
    : /\btaiwan\b|\btaipei\b|\bkaohsiung\b/.test(destLowerEarly) ? 'TWD'
    : /\bpuerto\s*rico\b|\bsan\s*juan\b/.test(destLowerEarly) ? 'USD'
    : null;

  const countryCurrency = sarOverride ?? inferCurrencyFromCountry(destinationCountry);
  const destinationCurrency =
    normalizeCurrencyCode(destinationInfo?.currency) ||
    normalizeCurrencyCode(destinationInfo?.currencySymbol);
  const daysCurrency = inferCurrencyFromDays(days);

  // Also try to infer USD from destination string directly (e.g. "Austin, Texas", "New York, NY")
  const destLower = destLowerEarly;
  const isUSDestination =
    countryCurrency === 'USD' ||
    destLower.includes('texas') || destLower.includes(', tx') ||
    destLower.includes(', ny') || destLower.includes(', ca') ||
    destLower.includes(', fl') || destLower.includes(', il') ||
    destLower.includes('united states') || destLower.includes(', usa') ||
    destLower.includes(', us');

  const localCurrency =
    sarOverride ||
    (countryCurrency && destinationCurrency && countryCurrency !== destinationCurrency
      ? countryCurrency
      : destinationCurrency) ||
    countryCurrency ||
    (isUSDestination ? 'USD' : null) ||
    daysCurrency ||
    'USD'; // Default to USD instead of EUR
  
  // Display currency based on user preference toggle
  const tripCurrency = showLocalCurrency ? localCurrency : 'USD';
  
  // Convert costs from USD to display currency when needed
  // All internal costs are calculated in USD, this converts for display
  const displayCost = useCallback((amountInUSD: number): number => {
    if (!showLocalCurrency || localCurrency === 'USD') {
      return amountInUSD;
    }
    return convertFromUSD(amountInUSD, localCurrency);
  }, [showLocalCurrency, localCurrency]);

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev =>
      prev.includes(dayNumber)
        ? prev.filter(d => d !== dayNumber)
        : [...prev, dayNumber]
    );
  };

  // Check if an activity is a dining type
  const isDiningActivity = useCallback((activity: EditorialActivity): boolean => {
    const activityType = getActivityType(activity);
    return ['dining', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee', 'food'].includes(activityType);
  }, []);

  // Get meal type from activity
  const getMealTypeFromActivity = useCallback((activity: EditorialActivity): 'breakfast' | 'lunch' | 'dinner' | 'any' => {
    const activityType = getActivityType(activity);
    const title = (activity.title || '').toLowerCase();
    
    if (activityType === 'breakfast' || title.includes('breakfast') || title.includes('brunch')) {
      return 'breakfast';
    }
    if (activityType === 'lunch' || title.includes('lunch')) {
      return 'lunch';
    }
    if (activityType === 'dinner' || title.includes('dinner')) {
      return 'dinner';
    }
    return 'any';
  }, []);

  // Check if user can swap (has enough credits — server handles free caps)
  const canSwap = useCallback(() => {
    return true; // Let server-side spend-credits handle free cap + balance check
  }, []);

  // Open the AI swap drawer for an activity
  const openSwapDrawer = useCallback((dayIndex: number, activity: EditorialActivity) => {
    if (activity.isLocked) {
      toast.error('Unlock this activity first to find alternatives');
      return;
    }

    // Check if user can afford swap
    if (!canSwap()) {
      toast.error(`Need ${CREDIT_COSTS.SWAP_ACTIVITY} credits to swap activities`);
      setShowCreditPrompt(true);
      return;
    }

    // Normalize to ItineraryActivity format for the shared drawer component
    const time = activity.time || activity.startTime || '09:00';
    const cost = getActivityCost(activity, travelers, budgetTier);
    const type = (activity.type || (activity.category as ActivityType) || 'activity') as ActivityType;
    const locName = activity.location?.name || activity.location?.address || 'Location';
    const locAddress = activity.location?.address || activity.location?.name || 'Location';
    const ratingVal = typeof activity.rating === 'number' ? activity.rating : (activity.rating as any)?.value;

    setSwapTarget({ dayIndex, activityId: activity.id });
    setSwapDrawerActivity({
      id: activity.id,
      title: activity.title || 'Activity',
      description: activity.description || '',
      time,
      duration: coerceDurationString(activity.duration, (activity as any).durationMinutes) || '2 hours',
      type,
      cost,
      location: { name: locName, address: locAddress },
      rating: ratingVal,
      tags: activity.tags || [],
      isLocked: !!activity.isLocked,
    });

    // For dining activities, open the restaurant-specific drawer
    if (isDiningActivity(activity)) {
      setRestaurantDrawerMealType(getMealTypeFromActivity(activity));
      setRestaurantDrawerOpen(true);
    } else {
      setSwapDrawerOpen(true);
    }
  }, [travelers, budgetTier, isDiningActivity, getMealTypeFromActivity, canSwap]);

  // Handle selecting an alternative from the drawer
  const handleSelectSwapAlternative = useCallback(async (newActivity: ItineraryActivity) => {
    // Capture swapTarget at invocation time to avoid stale closure issues
    const target = swapTarget;
    if (!target) {
      console.warn('[Swap] No swap target available');
      return;
    }

    console.log('[Swap] Spending credits for swap_activity', { tripId, activityId: target.activityId, dayIndex: target.dayIndex });

    // Spend credits for the swap (server handles free caps)
    let swapCreditResult: Awaited<ReturnType<typeof spendCredits.mutateAsync>> | undefined;
    try {
      swapCreditResult = await spendCredits.mutateAsync({
        action: 'SWAP_ACTIVITY',
        tripId,
        activityId: target.activityId,
        dayIndex: target.dayIndex,
        metadata: {
          old_activity: days[target.dayIndex]?.activities?.find(a => a.id === target.activityId)?.title || 'unknown',
          new_activity: newActivity.title || 'unknown',
        },
      });
      console.log('[Swap] Credit spend result:', swapCreditResult);
    } catch (err) {
      console.error('[Swap] Credit spend failed:', err);
      setCreditNudge({ action: 'SWAP_ACTIVITY' });
      setSwapDrawerOpen(false);
      setSwapTarget(null);
      setSwapDrawerActivity(null);
      return;
    }

    // Save version snapshot before swap for undo
    if (tripId) {
      const swapDay = days[target.dayIndex];
      if (swapDay) {
        await saveDayVersion(tripId, {
          dayNumber: swapDay.dayNumber,
          title: swapDay.title,
          theme: swapDay.theme,
          activities: swapDay.activities as unknown as ItineraryActivity[],
        }, 'swap');
        refreshUndoState();
      }
    }

    // Replacing activity with new selection

    // Replace the target activity with the new selection. Compute `updatedDays`
    // from the current `days` (not inside a setDays updater) so we can persist
    // the exact same value immediately below — see C-TOOL-8.
    const updatedDays = days.map((day, dIdx) => {
      if (dIdx !== target.dayIndex) return day;

      const updatedActivities = day.activities.map(a => {
        if (a.id !== target.activityId) return a;

        const preservedTime = a.time || a.startTime || newActivity.time;
        const preservedStartTime = a.startTime || preservedTime;

        return {
          ...a,
          id: newActivity.id, // Use new activity ID
          title: enforceMealTimeCoherence(newActivity.title || '', preservedStartTime),
          description: newActivity.description,
          category: newActivity.type,
          type: newActivity.type,
          time: preservedTime,
          startTime: preservedStartTime,
          duration: coerceDurationString(newActivity.duration, (newActivity as any).durationMinutes),
          cost: { amount: newActivity.cost, currency: tripCurrency },
          location: {
            name: newActivity.location?.name,
            address: newActivity.location?.address,
          },
          rating: newActivity.rating ?? a.rating,
          tags: newActivity.tags,
          isLocked: false,
          // Clear stale Voyance intelligence from old activity
          tips: undefined,
          voyanceInsight: undefined,
          isVoyancePick: false,
          // Clear old enrichment data so it can be re-fetched
          photos: undefined,
          website: undefined,
          viatorProductCode: undefined,
        } satisfies EditorialActivity;
      });

      return { ...day, activities: updatedActivities };
    });

    setDays(updatedDays);
    // Sync budget with updated days
    syncBudgetFromDays(updatedDays);

    setHasChanges(true);
    setSwapDrawerOpen(false);
    setSwapTarget(null);
    setSwapDrawerActivity(null);
    toast.success('Activity swapped!');

    // C-TOOL-8: persist the swap IMMEDIATELY. Previously this handler only set
    // hasChanges and relied on the 3s autosave debounce, which silently dropped
    // the replacement on a fast reload (old venue removed, new venue lost).
    // Mirror the reorder fix — write the new days straight to save-itinerary.
    persistDaysImmediately(updatedDays).catch((e) => {
      console.warn('[Swap] immediate persist failed; autosave will retry', e);
    });

    // Background-enrich the swapped activity to get website/maps link
    const swappedTitle = newActivity.title;
    const swappedId = newActivity.id;
    if (swappedTitle && destination) {
      Promise.all([
        lookupActivityUrl(swappedTitle, destination, newActivity.type),
        enrichAttraction(swappedTitle, destination),
      ]).then(([urlResult, attractionResult]) => {
        const website = urlResult?.url || attractionResult?.data?.website || attractionResult?.data?.bookingUrl;
        if (website) {
          setDays(prev => prev.map(day => ({
            ...day,
            activities: day.activities.map(a =>
              a.id === swappedId ? { ...a, website: website || a.website } : a
            ),
          })));
        }
      }).catch(() => { /* enrichment is best-effort */ });
    }
  }, [swapTarget, tripCurrency, isPaid, spendCredits, tripId, days, syncBudgetFromDays, destination, persistDaysImmediately]);

  // Supports both database trips and localStorage demo trips
  useEffect(() => {
    if (!hasChanges || !effectiveIsEditable) return;
    
    const autoSaveTimer = setTimeout(async () => {
      try {
        const itineraryData: Record<string, unknown> = {
          days: JSON.parse(JSON.stringify(days)),
          status: 'ready',
          optionSelections,
          savedAt: new Date().toISOString(),
        };
        // Preserve parsed metadata (accommodationNotes, practicalTips, source)
        if (parsedMetadata) {
          itineraryData.metadata = {
            ...parsedMetadata,
            lastUpdated: new Date().toISOString(),
          };
        }

        // Try database first
        const { data: existingTrip, error: checkError } = await supabase
          .from('trips')
          .select('id')
          .eq('id', tripId)
          .maybeSingle();

        if (existingTrip && !checkError) {
          // Trip exists in database - save through backend for normalization + meal guard
          try {
            const { error } = await supabase.functions.invoke('generate-itinerary', {
              body: {
                action: 'save-itinerary',
                tripId,
                itinerary: itineraryData,
                // C-PERSIST-1/2: this autosave only fires on genuine user edits
                // (hasChanges). Without a whitelisted saveReason the frozen gate
                // silently blocks the JSON write on ready/generated trips, so the
                // edit (incl. a single-day regenerate) reverts on refresh.
                saveReason: 'user-editor-autosave',
              },
            });

            if (!error) {
              setHasChanges(false);
              setLastSaved(new Date());
            } else {
              console.error('[EditorialItinerary] Backend save failed:', error);
            }
          } catch (saveErr) {
            console.error('[EditorialItinerary] Backend save error:', saveErr);
          }
        } else {
          // Trip is in localStorage - always persist there so refreshes never re-trigger generation
          const localStorageKey = 'voyance_demo_trips';
          const demoTripsRaw = localStorage.getItem(localStorageKey);
          const demoTrips = demoTripsRaw ? JSON.parse(demoTripsRaw) : {};

          demoTrips[tripId] = {
            ...(demoTrips[tripId] || {}),
            id: tripId,
            itinerary_data: itineraryData,
            itinerary_status: 'ready',
            updated_at: new Date().toISOString(),
          };

          localStorage.setItem(localStorageKey, JSON.stringify(demoTrips));
          setHasChanges(false);
          setLastSaved(new Date());
          // Silent auto-save — no toast for background saves
        }
      } catch (err) {
        console.error('[EditorialItinerary] Auto-save failed:', err);
      }
    }, 3000); // Auto-save 3 seconds after last change

    return () => clearTimeout(autoSaveTimer);
  }, [hasChanges, days, tripId, effectiveIsEditable]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const itineraryData: Record<string, unknown> = {
        days: JSON.parse(JSON.stringify(days)),
        status: 'ready',
        optionSelections,
        savedAt: new Date().toISOString(),
      };
      if (parsedMetadata) {
        itineraryData.metadata = {
          ...parsedMetadata,
          lastUpdated: new Date().toISOString(),
        };
      }

      // Check if trip exists in database
      const { data: existingTrip } = await supabase
        .from('trips')
        .select('id')
        .eq('id', tripId)
        .maybeSingle();

      let saved = false;

      if (existingTrip) {
        // Save through backend for normalization + meal guard + table sync
        const { error } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'save-itinerary',
            tripId,
            itinerary: itineraryData,
            // C-PERSIST-2: explicit user Save must bypass the frozen gate.
            saveReason: 'user-editor-save',
          },
        });

        if (error) throw error;
        saved = true;
      } else {
        // Save to localStorage
        const localStorageKey = 'voyance_demo_trips';
        const demoTripsRaw = localStorage.getItem(localStorageKey);
        const demoTrips = demoTripsRaw ? JSON.parse(demoTripsRaw) : {};
        
        if (demoTrips[tripId]) {
          demoTrips[tripId].itinerary_data = itineraryData;
          demoTrips[tripId].itinerary_status = 'ready';
          demoTrips[tripId].updated_at = new Date().toISOString();
          localStorage.setItem(localStorageKey, JSON.stringify(demoTrips));
          saved = true;
        } else {
          // Try legacy format
          const legacyKey = `trip_${tripId}`;
          const legacyRaw = localStorage.getItem(legacyKey);
          if (legacyRaw) {
            const legacyTrip = JSON.parse(legacyRaw);
            legacyTrip.itinerary_data = itineraryData;
            localStorage.setItem(legacyKey, JSON.stringify(legacyTrip));
            saved = true;
          }
        }
      }

      if (saved) {
        if (onSave) await onSave(days);
        setHasChanges(false);
        setLastSaved(new Date());
        toast.success('Itinerary saved!');
        
        // Re-sync budget ledger with updated itinerary
        syncBudgetFromDays(days);
      } else {
        toast.error('Could not find trip to save');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [days, tripId, onSave]);

  // Full itinerary regeneration — now uses day-by-day pattern matching original generation
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isRepairingPricing, setIsRepairingPricing] = useState(false);
  const [regenerationProgress, setRegenerationProgress] = useState(0);

  // Cost = 30 credits/day (half the 60/day generation rate)
  const regenerationCost = useMemo(() => Math.ceil((days.length || 1) * 30), [days.length]);

  const handleRegenerateItinerary = useCallback(async () => {
    setIsRegenerating(true);
    setRegenerationProgress(0);
    const totalDays = days.length;

    try {
      // 1. Charge credits first — OutOfCreditsModal pops automatically on insufficient
      await spendCredits.mutateAsync({
        action: 'REGENERATE_TRIP',
        tripId,
        creditsAmount: regenerationCost,
        metadata: {
          dayCount: totalDays,
          idempotencyKey: `regenerate_trip:${tripId}:${totalDays}:${Date.now()}`,
        },
      });

      // 2. Day-by-day generation (matching original progressive pattern)
      const generatedDays: EditorialDay[] = [];
      const previousActivities: string[] = [];
      const MAX_RETRIES = 4;
      const BACKOFF_DELAYS = [3000, 8000, 15000, 30000];

      for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
        setRegenerationProgress(Math.round(((dayNum - 1) / totalDays) * 100));

        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + dayNum - 1);
        const formattedDate = dayDate.toISOString().split('T')[0];

        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            // Extract locked activities from the CURRENT day before regenerating
            const currentDay = days.find(d => d.dayNumber === dayNum);
            const keepActivities = (currentDay?.activities || [])
              .filter(a => a.isLocked)
              .map(a => a.id)
              .filter(Boolean);

            const backendActivities = (currentDay?.activities || []).map(a => ({
              id: a.id,
              name: a.title,
              title: a.title,
              description: a.description,
              category: a.category,
              startTime: a.startTime || a.time,
              endTime: a.endTime,
              location: a.location,
              cost: a.cost,
              estimatedCost: a.cost,
              isLocked: a.isLocked,
              durationMinutes: a.durationMinutes,
              tags: a.tags,
            }));

            const invokePromise = supabase.functions.invoke('generate-itinerary', {
              body: {
                action: 'generate-day',
                tripId,
                dayNumber: dayNum,
                totalDays,
                destination,
                destinationCountry,
                date: formattedDate,
                travelers,
                tripType,
                budgetTier,
                userId: user?.id,
                previousDayActivities: previousActivities,
                keepActivities,
                currentActivities: backendActivities,
                variationNonce: Date.now(),
              },
            });

            // 120-second timeout per day
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('__TIMEOUT__')), 120_000)
            );

            const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

            if (error) {
              const errMsg = error.message || String(error);
              if (errMsg.includes('Rate limit') || errMsg.includes('credits') || errMsg.includes('Credits')) {
                throw new Error(errMsg);
              }
              throw new Error(errMsg);
            }

            if (data?.error) {
              if (data.error.includes('Rate limit') || data.error.includes('credits')) throw new Error(data.error);
              throw new Error(data.error);
            }

            if (!data?.day) {
              throw new Error(`No itinerary data returned for day ${dayNum}`);
            }

            const generatedDay = data.day as EditorialDay;
            generatedDays.push(generatedDay);

            // Track activities for context
            (generatedDay.activities || []).forEach((act: any) => {
              previousActivities.push(act.title || act.name || '');
            });

            // Update UI progressively
            setDays([...generatedDays]);

            // Auto-save after each day
            try {
              await supabase.functions.invoke('generate-itinerary', {
                body: {
                  action: 'save-itinerary',
                  tripId,
                  itinerary: {
                    days: generatedDays,
                    status: generatedDays.length < totalDays ? 'generating' : 'ready',
                    generatedAt: new Date().toISOString(),
                  },
                  // C-PERSIST-1: per-day regenerate persist must bypass the frozen gate.
                  saveReason: 'regenerate-day-autosave',
                },
              });
            } catch (saveErr) {
              console.warn(`[Regeneration] Partial save after day ${dayNum} failed (non-blocking):`, saveErr);
            }

            lastError = null;
            break; // Success
          } catch (dayErr) {
            lastError = dayErr instanceof Error ? dayErr : new Error(String(dayErr));
            const msg = lastError.message;

            if (msg.includes('Rate limit') || msg.includes('credits') || msg.includes('Credits')) throw lastError;

            if (attempt < MAX_RETRIES) {
              const delay = BACKOFF_DELAYS[attempt] || 10000;
              console.warn(`[Regeneration] Day ${dayNum} attempt ${attempt + 1} failed, retrying in ${delay / 1000}s`);
              if (attempt >= 1) {
                toast.info(`Day ${dayNum} is taking longer than usual, retrying automatically...`, { duration: 3000 });
              }
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }

        if (lastError) {
          const savedMsg = generatedDays.length > 0
            ? ` Days 1-${generatedDays.length} have been saved.`
            : '';
          throw new Error(`Day ${dayNum} couldn't be generated after ${MAX_RETRIES + 1} attempts.${savedMsg}`);
        }

        // Brief pause between days
        if (dayNum < totalDays) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }

      setRegenerationProgress(100);
      await refetchItineraryFromDb();
      // Sync budget from regenerated days and invalidate all budget queries
      syncBudgetFromDays(generatedDays);
      queryClient.invalidateQueries({ queryKey: ['tripBudgetSummary', tripId] });
      queryClient.invalidateQueries({ queryKey: ['tripBudgetLedger', tripId] });
      queryClient.invalidateQueries({ queryKey: ['tripBudgetAllocations', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });

      // ── COMPLETENESS GATE ─────────────────────────────────────────
      // The day-by-day loop can finish "successfully" yet produce a
      // hotel-only / shell-day output (e.g. AI rate-limited mid-day).
      // Mirror the backend gate so the trip is marked failed and the
      // recovery banner replaces the misleading success toast.
      const completeness = classifyItineraryCompleteness(generatedDays as any);
      if (completeness.status !== 'ok') {
        const failureReason =
          completeness.status === 'empty' ? 'empty_itinerary' : 'incomplete_itinerary';
        try {
          const { data: tripRow } = await supabase
            .from('trips')
            .select('metadata')
            .eq('id', tripId)
            .single();
          const existingMeta = (tripRow?.metadata as Record<string, unknown>) || {};
          await supabase
            .from('trips')
            .update({
              itinerary_status: 'failed',
              metadata: {
                ...existingMeta,
                generation_failure_reason: failureReason,
                empty_itinerary_detected_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', tripId);
        } catch (markErr) {
          console.warn('[EditorialItinerary] Failed to persist regen failure status:', markErr);
        }
        queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
        toast.error(
          completeness.status === 'empty'
            ? "Regeneration didn't produce any activities. Tap Regenerate to try again."
            : 'Regeneration finished without a full plan. Tap Regenerate to try again.',
        );
      } else {
        toast.success('Itinerary regenerated! Flights, hotels, and trip settings preserved.');
      }

      // Note: we used to call repairTripCosts here on every regeneration.
      // That silently raised prices (Michelin/ticketed/reference floors) and
      // produced "+$900" total jumps with no attribution. The generation
      // pipeline already writes correct activity_costs via syncBudgetFromDays,
      // and a one-shot legacy backfill runs in TripDetail when needed.
    } catch (err: any) {
      console.error('[EditorialItinerary] Regeneration failed:', err);
      if (!err?.message?.startsWith('Not enough credits')) {
        toast.error(toFriendlyError(err?.message));
      }
    } finally {
      setIsRegenerating(false);
      setRegenerationProgress(0);
    }
  }, [tripId, user?.id, refetchItineraryFromDb, regenerationCost, days.length, spendCredits, startDate, destination, destinationCountry, travelers, tripType, budgetTier, syncBudgetFromDays, queryClient]);

  const handleRepairPricing = useCallback(async () => {
    setIsRepairingPricing(true);
    try {
      const { repairTripCosts, getRecentCostChanges } = await import('@/services/activityCostService');
      const result = await repairTripCosts(tripId);
      if (result.success) {
        const changes = await getRecentCostChanges(tripId, 15_000);
        if (changes.length === 0) {
          toast.success(`Pricing repaired: ${result.repaired} activities updated`);
        } else {
          const top = changes.slice(0, 3).map(c => {
            const delta = (c.new_cents - c.previous_cents) / 100;
            const sign = delta >= 0 ? '+' : '−';
            return `${c.activity_title || 'Activity'} ${sign}$${Math.abs(delta).toFixed(0)}`;
          }).join(', ');
          const more = changes.length > 3 ? ` and ${changes.length - 3} more` : '';
          toast.success(`Pricing repaired: ${changes.length} adjusted`, {
            description: `${top}${more}`,
            duration: 8000,
          });
        }
        await refetchItineraryFromDb();
      } else {
        toast.error(toFriendlyError(result.error));
      }
    } catch {
      toast.error(toFriendlyError(null));
    } finally {
      setIsRepairingPricing(false);
    }
  }, [tripId, refetchItineraryFromDb]);

  // Open the optimize preferences dialog
  const openOptimizeDialog = useCallback(() => {
    setShowOptimizeDialog(true);
  }, []);

  // Optimize itinerary: route optimization, real transport, real costs
  const handleOptimize = useCallback(async (prefs: OptimizePreferences) => {
    setOptimizePrefs(prefs);
    setShowOptimizeDialog(false);
    setIsOptimizing(true);
    // C-TOOL-7: capture the charge so the zero-change AND failure refunds can be
    // keyed to it — the server then dedups, making the refund idempotent (a retry
    // can no longer double-refund free credits).
    let routeCharge: { idempotencyKey?: string; pendingChargeId?: string | null } | null = null;
    try {
      // Spend credits first (skip for first-trip users)
      if (!routeOptCost.isFirstTrip && routeOptCost.cost > 0) {
        const routeSpend = await spendCredits.mutateAsync({
          action: 'ROUTE_OPTIMIZATION',
          tripId,
          creditsAmount: routeOptCost.cost,
          metadata: { optimizeCount: routeOptCost.optimizeCount, idempotencyKey: `route_optimization:${tripId}:${Date.now()}` },
        });
        routeCharge = { idempotencyKey: routeSpend.idempotencyKey, pendingChargeId: routeSpend.pendingChargeId };
      }

      toast.info('Optimizing routes and fetching real costs...', { duration: 3000 });
      
      // Build filtered days for optimization
      const filteredDays = days
        .filter((_d, idx) => {
          const dayNumber = idx + 1;
          return canViewDay(dayNumber);
        })
        .map(d => ({
          dayNumber: d.dayNumber,
          date: d.date,
          activities: d.activities.map(a => ({
            id: a.id,
            title: a.title,
            category: a.category || a.type,
            startTime: a.startTime,
            endTime: a.endTime,
            location: a.location,
            cost: a.cost,
            isLocked: a.isLocked,
            transportation: a.transportation,
          })),
        }));

      if (filteredDays.length === 0) {
        toast.error('No unlocked days to optimize. Unlock days first.');
        setIsOptimizing(false);
        return;
      }

      console.log(`[optimize] Sending ${filteredDays.length} days, destination=${destination}, tripId=${tripId}`);

      const { data, error } = await supabase.functions.invoke('optimize-itinerary', {
        body: {
          tripId,
          destination,
          days: filteredDays,
          enableRouteOptimization: false,  // Don't reorder activities
          enableRealTransport: true,        // DO update transport between activities
          enableCostLookup: true,           // DO update cost estimates
          enableGapFilling: false,          // Don't insert free time blocks
          enableTagGeneration: false,       // Skip tag regeneration
          // Pass user transport preferences
          transportPreferences: {
            allowedModes: prefs.transportModes,
            distanceUnit: prefs.distanceUnit,
          },
        }
      });

      if (error) throw error;

      if (data?.days) {
        const meta = data.metadata?.stats || {};
        const hasChanges = (meta.routesChanged || 0) > 0 || (meta.transportCalculated || 0) > 0 || (meta.costsLookedUp || 0) > 0;

        // If no meaningful changes occurred, refund the credits (idempotent — keyed
        // to the original charge so a retry can't double-refund).
        if (!hasChanges && !routeOptCost.isFirstTrip && routeOptCost.cost > 0) {
          await refundCredits({
            tripId,
            originalAction: 'route_optimization',
            originalIdempotencyKey: routeCharge?.idempotencyKey,
            pendingChargeId: routeCharge?.pendingChargeId,
            creditsAmount: routeOptCost.cost,
            reason: 'zero_optimization_changes',
          });
          setNeedsOptimization(false);
          toast.info('Routes are already optimized!', { duration: 3000 });
        } else {
          // Update days with optimized data — match by dayNumber since we only sent unlocked days
          setDays(prev => prev.map((day) => {
            const optimizedDay = data.days.find((od: any) => od.dayNumber === day.dayNumber);
            if (!optimizedDay) return day;
            return {
              ...day,
              activities: optimizedDay.activities.map((optAct: EditorialActivity, actIdx: number) => ({
                ...day.activities[actIdx],
                ...optAct,
              })),
            };
          }));
          setHasChanges(true);
          schedulePersist();
          setNeedsOptimization(false);

          const parts: string[] = [];
          if ((meta.routesChanged || 0) > 0) parts.push(`${meta.routesChanged} day${meta.routesChanged > 1 ? 's' : ''} reordered for shorter routes`);
          if ((meta.transportCalculated || 0) > 0) parts.push(`${meta.transportCalculated} transit directions updated`);
          if ((meta.costsLookedUp || 0) > 0) parts.push(`${meta.costsLookedUp} costs refreshed`);

          if (parts.length > 0) {
            toast.success(`Routes optimized! ${parts.join(', ')}.`);
          } else {
            toast.success('Routes optimized!');
          }
        }
      }
    } catch (err) {
      console.error('Optimize error:', err);
      toast.error('Failed to optimize itinerary');
      // C-TOOL-7: refund ONLY if the charge actually committed (routeCharge set).
      // If the spend itself threw (insufficient credits), routeCharge is null and
      // refunding would mint credits that were never debited. Keyed → idempotent,
      // so this can't double-refund alongside a retry.
      if (routeCharge) {
        await refundCredits({
          tripId,
          originalAction: 'route_optimization',
          originalIdempotencyKey: routeCharge.idempotencyKey,
          pendingChargeId: routeCharge.pendingChargeId,
          creditsAmount: routeOptCost.cost,
          reason: 'optimize_runtime_failure',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        console.log('[optimize] Refunded route-optimization charge after failure');
      }
    } finally {
      setIsOptimizing(false);
    }
  }, [days, tripId, destination]);

  // Handle activity lock toggle - persists immediately to normalized itinerary_activities table
  const handleActivityLock = useCallback(async (dayIndex: number, activityId: string) => {
    // Find current lock state and activity details
    const currentDay = days[dayIndex];
    const currentActivity = currentDay?.activities.find(a => a.id === activityId);
    if (!currentActivity) return;
    
    const newLockedState = !currentActivity.isLocked;
    
    // Update local state immediately for responsive UI
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      return {
        ...day,
        activities: day.activities.map(act =>
          act.id === activityId ? { ...act, isLocked: newLockedState } : act
        )
      };
    }));
    setHasChanges(true);
    schedulePersist();
    toast.success(newLockedState ? 'Activity locked' : 'Activity unlocked');

    // Persist lock state directly to itinerary_activities table
    if (tripId) {
      try {
        const activityStartTime = (currentActivity as any).startTime ?? (currentActivity as any).time;
        const { error } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'toggle-activity-lock',
            tripId,
            activityId,
            isLocked: newLockedState,
            // Include fallback matching info for non-UUID IDs
            dayNumber: currentDay.dayNumber,
            activityTitle: currentActivity.title,
            startTime: activityStartTime,
          },
        });
        if (error) {
          console.error('[EditorialItinerary] Failed to persist lock state:', error);
          // Revert on error
          setDays(prev => prev.map((day, idx) => {
            if (idx !== dayIndex) return day;
            return {
              ...day,
              activities: day.activities.map(act =>
                act.id === activityId ? { ...act, isLocked: !newLockedState } : act
              )
            };
          }));
          toast.error('Failed to save lock state');
        }
      } catch (err) {
        console.error('[EditorialItinerary] Lock persist error:', err);
      }
    }
  }, [tripId, days]);

  // Detect synthetic/pinned items that should not participate in reorder or time recalculation
  const isSyntheticActivity = useCallback((a: EditorialActivity): boolean => {
    return !!(a as any).__syntheticTravel || !!(a as any).__syntheticDeparture ||
      !!(a as any).__syntheticFinalDeparture || !!(a as any).__interCityTransport ||
      !!(a as any).__hotelCheckout || !!(a as any).__hotelCheckin ||
      a.id.startsWith('hotel-') || a.id.startsWith('departure-') ||
      a.id.startsWith('travel-') || a.id.startsWith('final-departure-');
  }, []);

  // Detect hidden option-group alternatives that aren't currently selected
  const isHiddenOptionAlternative = useCallback((a: EditorialActivity, allActivities: EditorialActivity[]): boolean => {
    if (!a.isOption || !a.optionGroup) return false;
    const selectedId = optionSelections[a.optionGroup];
    if (selectedId) return a.id !== selectedId;
    // Default: first in group is selected
    const firstInGroup = allActivities.find(x => x.optionGroup === a.optionGroup);
    return firstInGroup?.id !== a.id;
  }, [optionSelections]);

  // Check if an activity is a transport/transit row (Metro, Walk, Taxi, etc.)
  const isTransportActivity = useCallback((a: EditorialActivity): boolean => {
    const cat = (a.category || '').toLowerCase();
    const typ = (a.type || '').toLowerCase();
    return cat === 'transportation' || cat === 'transport' || cat === 'transit'
      || typ === 'transportation' || typ === 'transport' || typ === 'transit';
  }, []);

  // Get only the visible, reorderable activities (what the user actually sees as cards)
  // Excludes synthetic, hidden alternatives, AND transport rows
  const getVisibleReorderableActivities = useCallback((activities: EditorialActivity[]): EditorialActivity[] => {
    return activities.filter(a => !isSyntheticActivity(a) && !isHiddenOptionAlternative(a, activities) && !isTransportActivity(a));
  }, [isSyntheticActivity, isHiddenOptionAlternative, isTransportActivity]);

  // Handle drag-and-drop reorder of activities within a day — dynamically reassign times
  const handleActivityReorder = useCallback(async (dayIndex: number, reorderedActivities: EditorialActivity[]) => {
    // Save version snapshot before reorder for undo
    if (tripId) {
      const day = days[dayIndex];
      if (day) {
        await saveDayVersion(tripId, {
          dayNumber: day.dayNumber,
          title: day.title,
          theme: day.theme,
          activities: day.activities as unknown as ItineraryActivity[],
        }, 'reorder');
        refreshUndoState();
      }
    }

    // Helper: parse "HH:mm" or "H:mm AM/PM" to minutes since midnight
    const toMins = (t?: string): number | null => {
      if (!t) return null;
      const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
      if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
      const m12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!m12) return null;
      let h = parseInt(m12[1], 10);
      const mins = parseInt(m12[2], 10);
      const pm = m12[3].toUpperCase() === 'PM';
      if (pm && h !== 12) h += 12;
      if (!pm && h === 12) h = 0;
      return h * 60 + mins;
    };
    const fmtTime = (mins: number) => {
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };


    // === KEY FIX: operate on visible reorderable activities only ===
    const currentActivities = days[dayIndex]?.activities || [];
    const oldVisible = getVisibleReorderableActivities(currentActivities);
    
    // Derive the new visible order from reorderedActivities (filter same way)
    const newVisible = getVisibleReorderableActivities(reorderedActivities);

    // Capture original visible slot start times BEFORE reorder
    const originalSlotStarts = oldVisible.map(a => toMins(a.startTime || a.time) ?? 9 * 60);

    // Compute each activity's own duration
    const withDurations = newVisible.map(a => {
      const s = toMins(a.startTime || a.time);
      const e = toMins(a.endTime);
      const dur = (s !== null && e !== null && e > s) ? e - s : 30;
      return { activity: a, duration: dur };
    });

    // Slot-anchored reorder: assign each reordered activity to the original slot's
    // start time, but push forward if the previous activity overruns the slot.
    let previousEnd = 0;
    const visibleUpdated = withDurations.map(({ activity, duration }, idx) => {
      const slotStart = idx < originalSlotStarts.length ? originalSlotStarts[idx] : previousEnd;
      const actualStart = Math.max(slotStart, previousEnd);
      const actualEnd = actualStart + duration;
      previousEnd = actualEnd;

      return {
        ...activity,
        startTime: fmtTime(actualStart),
        endTime: fmtTime(actualEnd),
        time: fmtTime(actualStart),
      };
    });

    // Clear transportation for activities whose visible neighbor changed
    const oldAdj = new Map<string, string>();
    oldVisible.forEach((a, i) => { if (i < oldVisible.length - 1) oldAdj.set(a.id, oldVisible[i + 1].id); });
    
    const visibleUpdatedMap = new Map(visibleUpdated.map(a => [a.id, a]));
    const finalVisible = visibleUpdated.map((a, i) => {
      const oldNext = oldAdj.get(a.id);
      const newNext = i < visibleUpdated.length - 1 ? visibleUpdated[i + 1].id : undefined;
      if (oldNext !== newNext) {
        return { ...a, transportation: undefined };
      }
      return a;
    });
    const finalVisibleMap = new Map(finalVisible.map(a => [a.id, a]));

    // Rebuild raw array: replace visible reorderable slots with new order, keep everything else in place
    const visibleSlotIndices: number[] = [];
    currentActivities.forEach((a, i) => {
      if (!isSyntheticActivity(a) && !isHiddenOptionAlternative(a, currentActivities) && !isTransportActivity(a)) {
        visibleSlotIndices.push(i);
      }
    });

    const updated = [...currentActivities];
    visibleSlotIndices.forEach((rawIdx, slotIdx) => {
      if (slotIdx < finalVisible.length) {
        updated[rawIdx] = finalVisible[slotIdx];
      }
    });

    // Adjust transport activities to fit between their new non-transport neighbors
    for (let i = 0; i < updated.length; i++) {
      if (!isTransportActivity(updated[i])) continue;
      const prev = updated.slice(0, i).reverse().find(a => !isTransportActivity(a) && !isSyntheticActivity(a));
      if (prev?.endTime) {
        const pEnd = toMins(prev.endTime) ?? 0;
        const tDur = updated[i].durationMinutes || 15;
        updated[i] = {
          ...updated[i],
          startTime: fmtTime(pEnd),
          endTime: fmtTime(pEnd + tDur),
          time: fmtTime(pEnd),
          transportation: undefined, // clear stale route for refetch
        };
      }
    }

    const newDays = days.map((day, idx) => {
      if (idx !== dayIndex) return day;
      return { ...day, activities: updated };
    });
    setDays(newDays);
    syncBudgetFromDays(newDays);
    // Clear stale refresh result for this day
    const dayNum = days[dayIndex]?.dayNumber;
    if (dayNum) {
      setRefreshResults(prev => { const next = { ...prev }; delete next[dayNum]; return next; });
    }
    setHasChanges(true);
    setNeedsOptimization(true);
    // C-PERSIST: persist the reorder immediately rather than relying on the 3s
    // autosave debounce — otherwise a quick navigation/refresh loses the new order
    // (the DB kept the original sort_order/times). Mirrors the AI-note path.
    persistDaysImmediately(newDays).catch((e) => {
      console.warn('[reorder] immediate persist failed; autosave will retry', e);
    });
  }, [syncBudgetFromDays, isSyntheticActivity, isHiddenOptionAlternative, isTransportActivity, getVisibleReorderableActivities, days, persistDaysImmediately]);

  // Move activity up/down — operates on visible card order, not raw array
  const handleActivityMove = useCallback((dayIndex: number, activityId: string, direction: 'up' | 'down') => {
    const day = days[dayIndex];
    if (!day) return;

    const activities = [...day.activities];
    
    // Build the visible reorderable list
    const visible = getVisibleReorderableActivities(activities);
    const visIdx = visible.findIndex(a => a.id === activityId);
    if (visIdx === -1) return;

    // Determine swap target in visible order
    const newVisIdx = direction === 'up' ? visIdx - 1 : visIdx + 1;
    if (newVisIdx < 0 || newVisIdx >= visible.length) return;

    // Swap in the visible list
    const reorderedVisible = [...visible];
    [reorderedVisible[visIdx], reorderedVisible[newVisIdx]] = [reorderedVisible[newVisIdx], reorderedVisible[visIdx]];

    // Clear transport for swapped pair and the one before the swap range
    const minVisIdx = Math.min(visIdx, newVisIdx);
    reorderedVisible[minVisIdx] = { ...reorderedVisible[minVisIdx], transportation: undefined };
    reorderedVisible[Math.max(visIdx, newVisIdx)] = { ...reorderedVisible[Math.max(visIdx, newVisIdx)], transportation: undefined };
    if (minVisIdx > 0) {
      reorderedVisible[minVisIdx - 1] = { ...reorderedVisible[minVisIdx - 1], transportation: undefined };
    }

    // Rebuild the raw array with reordered visible slots
    const visibleSlotIndices: number[] = [];
    activities.forEach((a, i) => {
      if (!isSyntheticActivity(a) && !isHiddenOptionAlternative(a, activities) && !isTransportActivity(a)) {
        visibleSlotIndices.push(i);
      }
    });
    
    const rebuilt = [...activities];
    visibleSlotIndices.forEach((rawIdx, slotIdx) => {
      if (slotIdx < reorderedVisible.length) {
        rebuilt[rawIdx] = reorderedVisible[slotIdx];
      }
    });

    // Delegate to reorder handler which reassigns times and saves version snapshot
    handleActivityReorder(dayIndex, rebuilt);
  }, [days, handleActivityReorder, isSyntheticActivity, isHiddenOptionAlternative, isTransportActivity, getVisibleReorderableActivities]);

  // Move activity to a different day
  const handleMoveToDay = useCallback((fromDayIndex: number, activityId: string, toDayIndex: number) => {
    if (fromDayIndex === toDayIndex) return;
    
    setDays(prev => {
      const activity = prev[fromDayIndex]?.activities.find(a => a.id === activityId);
      if (!activity) return prev;

      // Parse time for chronological insertion
      const parseTimeToMinutes = (time?: string): number => {
        if (!time) return Infinity;
        const match = time.match(/^(\d{1,2}):(\d{2})/);
        if (!match) return Infinity;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const ampm = time.match(/(AM|PM)/i);
        if (ampm) {
          const period = ampm[1].toUpperCase();
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
        }
        return hours * 60 + minutes;
      };
      
      const activityTime = parseTimeToMinutes(activity.startTime || activity.time);
      
      const updated = prev.map((day, idx) => {
        if (idx === fromDayIndex) {
          return { ...day, activities: day.activities.filter(a => a.id !== activityId) };
        }
        if (idx === toDayIndex) {
          const newActivities = [...day.activities];
          let insertIndex = newActivities.length;
          for (let i = 0; i < newActivities.length; i++) {
            const existingTime = parseTimeToMinutes(newActivities[i].startTime || newActivities[i].time);
            if (activityTime < existingTime) {
              insertIndex = i;
              break;
            }
          }
          newActivities.splice(insertIndex, 0, activity);
          return { ...day, activities: newActivities };
        }
        return day;
      });
      syncBudgetFromDays(updated);
      return updated;
    });
    setHasChanges(true);
    schedulePersist();
    setNeedsOptimization(true);
    toast.success(`Moved to Day ${toDayIndex + 1}`);
  }, [syncBudgetFromDays, schedulePersist]);

  // Copy/duplicate activity to a different day
  const handleCopyToDay = useCallback((fromDayIndex: number, activityId: string, toDayIndex: number) => {
    if (fromDayIndex === toDayIndex) return;

    setDays(prev => {
      const activity = prev[fromDayIndex]?.activities.find(a => a.id === activityId);
      if (!activity) return prev;

      const copiedActivity: EditorialActivity = {
        ...activity,
        id: `${activity.id}-copy-${Date.now()}`,
        isLocked: false,
      };

      const parseTimeToMinutes = (time?: string): number => {
        if (!time) return Infinity;
        const match = time.match(/^(\d{1,2}):(\d{2})/);
        if (!match) return Infinity;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const ampm = time.match(/(AM|PM)/i);
        if (ampm) {
          const period = ampm[1].toUpperCase();
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
        }
        return hours * 60 + minutes;
      };

      const activityTime = parseTimeToMinutes(copiedActivity.startTime || copiedActivity.time);

      const updated = prev.map((day, idx) => {
        if (idx !== toDayIndex) return day;
        const newActivities = [...day.activities];
        let insertIndex = newActivities.length;
        for (let i = 0; i < newActivities.length; i++) {
          const existingTime = parseTimeToMinutes(newActivities[i].startTime || newActivities[i].time);
          if (activityTime < existingTime) {
            insertIndex = i;
            break;
          }
        }
        newActivities.splice(insertIndex, 0, copiedActivity);
        return { ...day, activities: newActivities };
      });
      syncBudgetFromDays(updated);
      return updated;
    });
    setHasChanges(true);
    schedulePersist();
    toast.success(`Copied to Day ${toDayIndex + 1}`);
  }, [syncBudgetFromDays, schedulePersist]);

  const handleActivityRemove = useCallback((dayIndex: number, activityId: string) => {
    const activity = days[dayIndex]?.activities.find(a => a.id === activityId);
    setPendingRemove({ dayIndex, activityId, activityTitle: activity?.title || 'this activity' });
  }, [days]);

  const confirmActivityRemove = useCallback(async () => {
    if (!pendingRemove) return;
    const { dayIndex, activityId } = pendingRemove;
    setPendingRemove(null);

    // Save version snapshot before delete for undo
    if (tripId) {
      const day = days[dayIndex];
      if (day) {
        await saveDayVersion(tripId, {
          dayNumber: day.dayNumber,
          title: day.title,
          theme: day.theme,
          activities: day.activities as unknown as ItineraryActivity[],
        }, 'delete_activity');
        refreshUndoState();
      }
    }

    setDays(prev => {
      const updated = prev.map((day, idx) => {
        if (idx !== dayIndex) return day;
        return { ...day, activities: day.activities.filter(act => act.id !== activityId) };
      });
      syncBudgetFromDays(updated);
      return updated;
    });
    const dayNum = days[dayIndex]?.dayNumber;
    if (dayNum) {
      setRefreshResults(prev => { const next = { ...prev }; delete next[dayNum]; return next; });
    }
    setHasChanges(true);
    schedulePersist();
    setNeedsOptimization(true);
    toast.success('Activity removed');
  }, [pendingRemove, syncBudgetFromDays, days, tripId, schedulePersist]);

  // Check if user can regenerate (has enough credits)
  const canRegenerate = useCallback(() => {
    // Let server-side spend-credits handle free cap + balance check
    return true;
  }, []);

  // Request regeneration - checks credits and regeneration count
  const requestDayRegenerate = useCallback(async (dayIndex: number) => {
    // Defense-in-depth: block regeneration when AI features are locked (manual builder pre-Smart Finish)
    if (aiLocked) return;
    if (!canRegenerate()) {
      // Show upgrade prompt
      setPendingRegenerateDay(dayIndex);
      setShowCreditPrompt(true);
      return;
    }
    
    // Check regeneration count for this day - after 3 regenerations, show guided assist
    const currentCount = dayRegenCounts[dayIndex] || 0;
    const REGEN_THRESHOLD = 3;
    
    if (currentCount >= REGEN_THRESHOLD) {
      // Show guided assist dialog
      setGuidedAssistDayIndex(dayIndex);
      setShowGuidedAssist(true);
    } else {
      // Spend credits before regenerating (server handles free caps)
      let spendContext: { idempotencyKey?: string; pendingChargeId?: string | null } | undefined;
      try {
        const spendResult = await spendCredits.mutateAsync({
          action: 'REGENERATE_DAY',
          tripId,
          dayIndex,
        });
        spendContext = {
          idempotencyKey: (spendResult as { idempotencyKey?: string })?.idempotencyKey,
          pendingChargeId: (spendResult as { pendingChargeId?: string | null })?.pendingChargeId ?? null,
        };
      } catch (err) {
        // Credit deduction failed - show nudge
        console.error('[Regenerate] Credit spend failed:', err);
        setCreditNudge({ action: 'REGENERATE_DAY' });
        return;
      }
      
      // Increment count and proceed with regeneration
      setDayRegenCounts(prev => ({ ...prev, [dayIndex]: currentCount + 1 }));
      handleDayRegenerateInternal(dayIndex, undefined, spendContext);
    }
  }, [canRegenerate, dayRegenCounts, isPaid, spendCredits, tripId]);

  // Handle guided assist submission
  const handleGuidedAssistSubmit = useCallback(async (preferences: string) => {
    if (guidedAssistDayIndex === null) return;
    
    // Spend credits before regenerating (server handles free caps)
    let spendContext: { idempotencyKey?: string; pendingChargeId?: string | null } | undefined;
    try {
      const spendResult = await spendCredits.mutateAsync({
        action: 'REGENERATE_DAY',
        tripId,
        dayIndex: guidedAssistDayIndex,
      });
      spendContext = {
        idempotencyKey: (spendResult as { idempotencyKey?: string })?.idempotencyKey,
        pendingChargeId: (spendResult as { pendingChargeId?: string | null })?.pendingChargeId ?? null,
      };
    } catch (err) {
      console.error('[GuidedAssist] Credit spend failed:', err);
      setCreditNudge({ action: 'REGENERATE_DAY' });
      setShowGuidedAssist(false);
      setGuidedAssistDayIndex(null);
      return;
    }
    
    // Reset count for this day after guided assist
    setDayRegenCounts(prev => ({ ...prev, [guidedAssistDayIndex]: 0 }));
    
    // Store preferences and trigger regeneration with them
    if (preferences) {
      setPendingGuidedPreferences(preferences);
    }
    handleDayRegenerateInternal(guidedAssistDayIndex, preferences || undefined, spendContext);
    setShowGuidedAssist(false);
    setGuidedAssistDayIndex(null);
  }, [guidedAssistDayIndex, isPaid, spendCredits, tripId]);

  // Internal regenerate handler (after credit check passed)
  const handleDayRegenerateInternal = useCallback(async (
    dayIndex: number,
    guidedPreferences?: string,
    spendContext?: { idempotencyKey?: string; pendingChargeId?: string | null },
  ) => {
    // Refund REGENERATE_DAY credits when generation hard-fails or returns
    // a placeholder day (action-generate-day.ts buildPlaceholderDay path).
    // Idempotent server-side via pendingChargeId + originalIdempotencyKey.
    const refundRegenCredits = async (reason: string, errorMessage?: string) => {
      if (!spendContext?.idempotencyKey) return;
      try {
        await supabase.functions.invoke('spend-credits', {
          body: {
            action: 'REFUND',
            tripId,
            metadata: {
              originalAction: 'regenerate_day',
              pendingChargeId: spendContext.pendingChargeId ?? undefined,
              reason,
              ...(errorMessage ? { errorMessage } : {}),
            },
            originalIdempotencyKey: spendContext.idempotencyKey,
          },
        });
      } catch (refundErr) {
        console.error('[Regenerate] Refund failed:', refundErr);
      }
    };
    const isFailedDay = (d: unknown): boolean => {
      const day = d as { activities?: unknown[]; metadata?: { quality?: { generation_failed?: boolean } } } | null | undefined;
      if (!day) return true;
      if (!Array.isArray(day.activities) || day.activities.length === 0) return true;
      if (day.metadata?.quality?.generation_failed === true) return true;
      return false;
    };
    const day = days[dayIndex];
    if (!day) return;

    // Save version snapshot before regeneration for undo
    if (tripId) {
      await saveDayVersion(tripId, {
        dayNumber: day.dayNumber,
        title: day.title,
        theme: day.theme,
        activities: day.activities as unknown as ItineraryActivity[],
      }, 'regenerate');
      refreshUndoState();
    }

    setRegeneratingDay(day.dayNumber);
    try {
      // Helper to identify accommodation/hotel activities (shared by both paths)
      const isAccommodationLike = (a: EditorialActivity) => {
        const cat = (a.category || '').toLowerCase();
        const title = (a.title || '').toLowerCase();
        return cat === 'accommodation' || cat === 'hotel' || cat === 'stay'
          || title.includes('hotel check') || title.includes('check-in at')
          || title.includes('check into');
      };

      if (onRegenerateDay) {
        const newDay = await onRegenerateDay(day.dayNumber);
        if (newDay) {
          // Deduplicate accommodation: keep only the original hotel
          const originalHotel = (day.activities || []).find(isAccommodationLike);
          if (originalHotel && newDay.activities) {
            newDay.activities = newDay.activities.filter((a: EditorialActivity) => !isAccommodationLike(a));
            newDay.activities.push(originalHotel);
            newDay.activities.sort((a: EditorialActivity, b: EditorialActivity) =>
              dayChronoKey(a.startTime || a.time) - dayChronoKey(b.startTime || b.time)
            );
          }
          // Preserve original day title/theme
          newDay.title = day.title;
          newDay.theme = day.theme;
          setDays(prev => prev.map((d, idx) => idx === dayIndex ? newDay : d));
          setHasChanges(true);
          schedulePersist();
          toast.success(`Day ${day.dayNumber} regenerated!`);
        }
      } else {
        // Collect current day's activity names to exclude from regeneration
        const currentDayActivities = day.activities
          ?.map(a => a.title || (a as { name?: string }).name)
          .filter(Boolean) || [];

        // CRITICAL: Preserve locked activities by passing both:
        // - keepActivities: IDs of locked activities
        // - currentActivities: full activity objects in BACKEND format so backend can merge them back
        // isAccommodationLike is defined above both branches

        // Filter out accommodation from keepActivities to prevent duplication
        const keepActivities = (day.activities || [])
          .filter(a => a.isLocked && !isAccommodationLike(a))
          .map(a => a.id)
          .filter(Boolean);
        
        // Convert to backend format with proper field names (startTime, isLocked, etc.)
        const backendActivities = day.activities.map(a => ({
          id: a.id,
          name: a.title,
          title: a.title,
          description: a.description,
          category: a.category,
          startTime: a.startTime || a.time,
          endTime: a.endTime,
          location: a.location,
          cost: a.cost,
          estimatedCost: a.cost,
          isLocked: a.isLocked, // CRITICAL: Backend checks this field
          durationMinutes: a.durationMinutes,
          tags: a.tags,
        }));
        
        const { data, error } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'generate-day',
            tripId,
            dayNumber: day.dayNumber,
            totalDays: days.length,
            destination,
            destinationCountry,
            date: day.date,
            travelers,
            budgetTier,
            tripType,
            previousDayActivities: currentDayActivities, // Force different venues
            keepActivities,
            currentActivities: backendActivities, // Backend format with isLocked
            variationNonce: Date.now(), // Force new randomness
            // Pass guided preferences if provided (from guided assist dialog)
            ...(guidedPreferences && { userGuidance: guidedPreferences }),
          }
        });

        if (error) throw error;
        if (isFailedDay(data?.day)) {
          await refundRegenCredits('placeholder_day');
          toast.error("We couldn't regenerate this day - credits refunded");
          return;
        }
        if (data?.day) {
          // Post-regeneration: deduplicate ALL accommodation entries, keep only original
          const originalHotel = (day.activities || []).find(isAccommodationLike);
          if (originalHotel && data.day.activities) {
            data.day.activities = data.day.activities.filter((a: EditorialActivity) => !isAccommodationLike(a));
            data.day.activities.push(originalHotel);
            data.day.activities.sort((a: EditorialActivity, b: EditorialActivity) =>
              dayChronoKey(a.startTime || a.time) - dayChronoKey(b.startTime || b.time)
            );
          }

          // Preserve original day title and theme — backend shouldn't rename without user request
          data.day.title = day.title;
          data.day.theme = day.theme;

          setDays(prev => prev.map((d, idx) => idx === dayIndex ? data.day : d));
          setHasChanges(true);
          schedulePersist();
          if (guidedPreferences) {
            toast.success(`Day ${day.dayNumber} regenerated with your preferences!`);
          } else {
            toast.success(`Day ${day.dayNumber} regenerated!`);
          }
        }
      }
    } catch (err) {
      console.error('Regenerate error:', err);
      await refundRegenCredits('generation_failed', err instanceof Error ? err.message : String(err));
      toast.error('Failed to regenerate day - credits refunded');
    } finally {
      setRegeneratingDay(null);
      setPendingGuidedPreferences(null);
    }
  }, [days, tripId, destination, destinationCountry, travelers, budgetTier, onRegenerateDay]);

  // Alias for backwards compatibility
  const handleDayRegenerate = requestDayRegenerate;

  // External regenerate-day requests (e.g. Trip Health "missing meal" quick-fix).
  // Unlike refreshDayRequest (timing-only validator), this runs the real AI
  // day-regeneration so a flagged missing meal actually gets injected by the
  // meal guard. Placed AFTER requestDayRegenerate's declaration to avoid TDZ.
  useEffect(() => {
    if (!regenerateDayRequest?.dayNumber) return;
    const idx = days.findIndex((d: any) => d.dayNumber === regenerateDayRequest.dayNumber);
    if (idx < 0) {
      console.warn('[regenerate_day] day not found in editor', { dayNumber: regenerateDayRequest.dayNumber, available: days.map((d: any) => d.dayNumber) });
      toast.error(`Day ${regenerateDayRequest.dayNumber} is not loaded - try reopening the trip.`);
      return;
    }
    setSelectedDayIndex(idx);
    setActiveTab('itinerary');
    requestDayRegenerate(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenerateDayRequest?.nonce]);

  // ── Flight Sync: deterministic cascade instead of AI regeneration ──
  const handleSyncFlightToDay = useCallback(async () => {
    if (!destinationArrivalLeg?.arrival?.time || !tripId) return;

    const outboundLeg = destinationArrivalLeg;
    const isCrossDayFlight = outboundLeg?.departure?.date && outboundLeg?.arrival?.date
      && outboundLeg.arrival.date.substring(0, 10) > outboundLeg.departure.date.substring(0, 10);
    const arrivalDayIndex = isCrossDayFlight ? 1 : 0;
    const arrivalDay = days[arrivalDayIndex];
    if (!arrivalDay) return;

    setRegeneratingDay(arrivalDay.dayNumber);

    try {
      // Save version snapshot for undo
      await saveDayVersion(tripId, {
        dayNumber: arrivalDay.dayNumber,
        title: arrivalDay.title,
        theme: arrivalDay.theme,
        activities: arrivalDay.activities as any,
      }, 'before_flight_sync');

      // Run deterministic cascade
      const { cascadeArrivalDay } = await import('@/services/cascadeTransportToItinerary');
      // cascadeArrivalDay operates on an array starting from the target day
      const daySlice = [{ ...arrivalDay, activities: [...arrivalDay.activities] }];
      const result = cascadeArrivalDay(daySlice, outboundLeg.arrival.time, 'flight');

      if (result.changed && result.updatedDays[0]) {
        const updatedDay = result.updatedDays[0];
        setDays(prev => prev.map((d, i) => i === arrivalDayIndex ? { ...d, activities: updatedDay.activities } : d));

        const change = result.changes[0];
        const parts: string[] = [];
        if (change?.shiftedActivities.length) parts.push(`${change.shiftedActivities.length} shifted`);
        if (change?.removedActivities.length) parts.push(`${change.removedActivities.length} removed`);
        if (change?.addedBlocks.length) parts.push(`${change.addedBlocks.length} added`);

        toast.success('Schedule updated!', { id: 'flight-sync', duration: 2000 });
      } else {
        toast.info('Schedule already matches flight times');
      }
    } catch (err) {
      console.error('[FlightSync] Cascade error:', err);
      toast.error('Failed to sync schedule');
    } finally {
      setRegeneratingDay(null);
    }
  }, [destinationArrivalLeg, days, tripId]);

  const handleDayLock = useCallback((dayIndex: number) => {
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      const allLocked = day.activities.every(a => a.isLocked);
      return {
        ...day,
        activities: day.activities.map(a => ({ ...a, isLocked: !allLocked }))
      };
    }));
    setHasChanges(true);
    schedulePersist();
  }, [schedulePersist]);

  const handleAddActivity = useCallback(async (dayIndex: number, activity: Partial<EditorialActivity>) => {
    // C-TOOL-4: captured so an overflow-cascade CANCEL can refund this charge.
    let addCharge: { idempotencyKey?: string; pendingChargeId?: string | null } | null = null;
    // Skip credit charge in manual builder mode (pre-Smart Finish) — user is curating their own research
    if (!aiLocked) {
      // Spend credits for adding an activity (server handles free caps)
      try {
        const addCreditResult = await spendCredits.mutateAsync({
          action: 'ADD_ACTIVITY',
          tripId,
          dayIndex,
          metadata: {
            activity_title: activity.title || 'New Activity',
            day_number: days[dayIndex]?.dayNumber || dayIndex + 1,
          },
        });
        addCharge = { idempotencyKey: addCreditResult.idempotencyKey, pendingChargeId: addCreditResult.pendingChargeId };
        console.log('[AddActivity] Credit spend result:', addCreditResult);
      } catch (err) {
        console.error('[AddActivity] Credit spend failed:', err);
        setCreditNudge({ action: 'ADD_ACTIVITY' });
        setAddActivityModal(null);
        return;
      }
    }

    const newActivity: EditorialActivity = {
      id: `manual-${Date.now()}`,
      title: activity.title || 'New Activity',
      description: activity.description || '',
      category: activity.category || 'activity',
      startTime: activity.startTime || '12:00',
      endTime: activity.endTime || '13:00',
      location: activity.location || { name: '', address: '' },
      cost: activity.cost || { amount: 0, currency: tripCurrency },
      bookingRequired: activity.bookingRequired || false,
      rating: activity.rating,
      tags: activity.tags || [],
      isLocked: true,
    };

    // Compute insertion and preview outside setDays
    const day = days[dayIndex];
    if (!day) return;
    const activities = [...day.activities];
    const newTime = newActivity.startTime || '23:59';
    let insertIndex = activities.length;
    for (let i = 0; i < activities.length; i++) {
      const existingTime = activities[i].startTime || '23:59';
      if (newTime <= existingTime) {
        insertIndex = i;
        break;
      }
    }
    activities.splice(insertIndex, 0, newActivity);

    // Preview overflow
    const { kept, truncated, dropped: droppedActivities } = previewCascadeOverflow(activities);
    if (droppedActivities.length > 0 || truncated.length > 0) {
      setPendingCascade({
        dayIndex,
        activityIndex: insertIndex,
        startTime: newActivity.startTime || '12:00',
        endTime: newActivity.endTime || '13:00',
        dropped: droppedActivities,
        truncated,
        kept: [...kept, ...truncated],
        source: 'add_activity',
        charge: addCharge ?? undefined,
      });
      return; // Wait for user confirmation
    }

    // No overflow — apply directly
    setDays(prev => {
      const updated = prev.map((d, idx) => {
        if (idx !== dayIndex) return d;
        return { ...d, activities: kept };
      });
      syncBudgetFromDays(updated);
      return updated;
    });
    const dayNum = days[dayIndex]?.dayNumber;
    if (dayNum) {
      setRefreshResults(prev => { const next = { ...prev }; delete next[dayNum]; return next; });
    }
    setHasChanges(true);
    schedulePersist();
    setNeedsOptimization(true);
    setAddActivityModal(null);
    toast.success('Activity added!');
  }, [tripCurrency, spendCredits, tripId, days, syncBudgetFromDays, schedulePersist]);

  // Listen for accepted dead-gap suggestions and commit them via handleAddActivity
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { activity: Partial<EditorialActivity> } | undefined;
      if (!detail?.activity) return;
      // Close the modal that onAddActivity opened, then commit the suggestion
      setAddActivityModal(null);
      const dayIndex = selectedDayIndex >= 0 ? selectedDayIndex : 0;
      handleAddActivity(dayIndex, detail.activity);
    };
    window.addEventListener('lovable:fill-dead-gap-accept', handler as EventListener);
    return () => window.removeEventListener('lovable:fill-dead-gap-accept', handler as EventListener);
  }, [handleAddActivity, selectedDayIndex]);

  const handleImportActivities = useCallback(async (imports: Array<{ dayIndex: number; activities: Array<Partial<EditorialActivity>>; mode: ImportMode }>) => {
    // Save version snapshots for all affected days before modifying
    const affectedDayIndices = [...new Set(imports.map(i => i.dayIndex))];
    for (const di of affectedDayIndices) {
      const day = days[di];
      if (day) {
        await saveDayVersion(tripId, {
          dayNumber: day.dayNumber,
          title: day.title,
          theme: day.theme,
          activities: day.activities as any,
        }, 'before_import');
      }
    }

    setDays(prev => {
      const updated = [...prev];
      for (const imp of imports) {
        const { dayIndex, activities, mode } = imp;
        const newActivities = activities.map((activity, i) => ({
          id: `import-${Date.now()}-${i}-${dayIndex}`,
          title: activity.title || 'Imported Activity',
          description: activity.description || '',
          category: activity.category || 'activity',
          startTime: activity.startTime || '',
          endTime: activity.endTime || '',
          location: activity.location || { name: '', address: '' },
          cost: activity.cost || { amount: 0, currency: tripCurrency },
          costSource: 'imported' as const,
          bookingRequired: false,
          tags: [],
          isLocked: false,
        } as EditorialActivity));

        const day = updated[dayIndex];
        if (!day) continue;
        if (mode === 'replace') {
          const lockedActivities = day.activities.filter(a => a.isLocked);
          const merged = [...lockedActivities, ...newActivities];
          merged.sort((a, b) => dayChronoKey(a.startTime) - dayChronoKey(b.startTime));
          updated[dayIndex] = { ...day, activities: merged };
        } else {
          const combined = [...day.activities, ...newActivities];
          combined.sort((a, b) => dayChronoKey(a.startTime) - dayChronoKey(b.startTime));
          updated[dayIndex] = { ...day, activities: combined };
        }
      }
      syncBudgetFromDays(updated);
      return updated;
    });
    setHasChanges(true);
    schedulePersist();
    setImportModal(null);
    refreshUndoState();
    const totalImported = imports.reduce((sum, i) => sum + i.activities.length, 0);
    toast.success(`${totalImported} activities imported across ${affectedDayIndices.length} day${affectedDayIndices.length > 1 ? 's' : ''}!`);
  }, [tripCurrency, syncBudgetFromDays, tripId, days, refreshUndoState]);

  // Update activity time — with optional cascade to shift all following activities
  const handleUpdateActivityTime = useCallback((dayIndex: number, activityIndex: number, startTime: string, endTime: string, cascade = false) => {
    const parseTime = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

    // Guard: reject end time <= start time
    if (parseTime(endTime) <= parseTime(startTime)) {
      toast.error('End time must be after start time');
      return;
    }

    // Compute the shifted activities for the target day
    const day = days[dayIndex];
    if (!day) return;

    const targetActivity = day.activities[activityIndex];
    if (!targetActivity) return;

    // Universal Locking Protocol — never mutate a locked activity directly
    const isLockedFlag = (a: any) =>
      !!a && (a.isLocked === true || a.locked === true || a.lock_state === 'locked');
    if (isLockedFlag(targetActivity)) {
      toast.error('Unlock this activity first to change its time');
      return;
    }

    const oldStartStr = targetActivity.startTime || targetActivity.time || '12:00';
    const formatTime = (mins: number) => {
      const c = Math.max(0, Math.min(mins, 23 * 60 + 59));
      return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
    };
    const deltaMinutes = parseTime(startTime) - parseTime(oldStartStr);

    let cascadeHitLock = false;
    let shifted = day.activities.map((activity, aIdx) => {
      if (aIdx === activityIndex) {
        const newDuration = parseTime(endTime) - parseTime(startTime);
        return { ...activity, startTime, endTime, time: startTime, durationMinutes: Math.max(newDuration, 0) };
      }
      if (cascade && aIdx > activityIndex && deltaMinutes !== 0) {
        // Locked downstream activities act as fixed pegs — do not shift them.
        if (isLockedFlag(activity)) {
          cascadeHitLock = true;
          return activity;
        }
        const aStart = activity.startTime || activity.time;
        const aEnd = activity.endTime;
        const rawNewStart = aStart ? parseTime(aStart) + deltaMinutes : null;
        const rawNewEnd = aEnd ? parseTime(aEnd) + deltaMinutes : null;
        const newStart = rawNewStart !== null ? formatTime(rawNewStart) : aStart;
        const newEnd = rawNewEnd !== null ? formatTime(rawNewEnd) : aEnd;

        // Preserve original duration before any clamping
        const MAX_MINS = 23 * 60 + 59;
        const origDuration = aEnd && aStart
          ? Math.max(parseTime(aEnd) - parseTime(aStart), 15)
          : (activity.durationMinutes || 30);

        const recalcDuration = (s: string, e: string) => {
          const durMins = parseTime(e) - parseTime(s);
          const durStr = durMins >= 60
            ? `${Math.floor(durMins / 60)}h${durMins % 60 ? ` ${durMins % 60}m` : ''}`
            : `${durMins} min`;
          return { durationMinutes: durMins, duration: durStr };
        };

        // Detect if formatTime clamped the end time past midnight
        const endWasClamped = rawNewEnd !== null && rawNewEnd > MAX_MINS;
        const startWasClamped = rawNewStart !== null && rawNewStart > MAX_MINS;

        if (newStart && newEnd && parseTime(newEnd) <= parseTime(newStart)) {
          const fixedEnd = formatTime(parseTime(newStart) + Math.max(origDuration, 15));
          return {
            ...activity, startTime: newStart, endTime: fixedEnd, time: newStart || activity.time,
            ...recalcDuration(newStart, fixedEnd),
            ...(endWasClamped || startWasClamped ? { __truncatedAtMidnight: true, __originalDurationMinutes: origDuration } : {}),
          };
        }
        if (newStart && newEnd) {
          const actualDuration = parseTime(newEnd) - parseTime(newStart);
          return {
            ...activity, startTime: newStart, endTime: newEnd, time: newStart || activity.time,
            ...recalcDuration(newStart, newEnd),
            ...(endWasClamped ? { __truncatedAtMidnight: true, __originalDurationMinutes: origDuration } : {}),
          };
        }
        return { ...activity, startTime: newStart, endTime: newEnd, time: newStart || activity.time };
      }
      return activity;
    });

    // If cascade, check for overflow before applying
    if (cascade) {
      const { kept, truncated, dropped: droppedActivities } = previewCascadeOverflow(shifted);
      if (droppedActivities.length > 0 || truncated.length > 0) {
        setPendingCascade({
          dayIndex,
          activityIndex,
          startTime,
          endTime,
          dropped: droppedActivities,
          truncated,
          kept: [...kept, ...truncated],
          source: 'time_edit',
        });
        return; // Don't apply — wait for user confirmation
      }
      shifted = [...kept, ...truncated];
    }

    // Apply directly (no overflow)
    let nextDays: EditorialDay[] = [];
    setDays(prev => {
      nextDays = prev.map((d, dIdx) => {
        if (dIdx !== dayIndex) return d;
        return { ...d, activities: shifted };
      });
      return nextDays;
    });
    setTimeEditModal(null);
    toast.success(cascade ? 'Schedule shifted' : 'Activity time updated');
    if (cascadeHitLock) {
      toast.info('Some locked activities were kept in place - review the schedule for overlaps.');
    }

    // Persist immediately so a refresh / concurrent backend repair doesn't drop the edit.
    (async () => {
      try {
        const { safeUpdateItineraryData } = await import('@/services/safeUpdateItineraryData');
        const itineraryToPersist: Record<string, unknown> = {
          days: JSON.parse(JSON.stringify(nextDays)),
          status: 'ready',
          optionSelections,
          savedAt: new Date().toISOString(),
        };
        if (parsedMetadata) {
          itineraryToPersist.metadata = { ...parsedMetadata, lastUpdated: new Date().toISOString() };
        }
        const res = await safeUpdateItineraryData(tripId, itineraryToPersist, {}, { allowFrozenWrite: true, reason: 'user-editor-save' });
        if (res?.error) throw res.error;
        setHasChanges(false);
        setLastSaved(new Date());
      } catch (err) {
        console.warn('[time-edit] persist failed, falling back to global Save:', err);
        setHasChanges(true);
      }
    })();
  }, [days, tripId, optionSelections, parsedMetadata]);

  // Update existing activity (full edit)
  const handleUpdateActivity = useCallback((dayIndex: number, activityIndex: number, updates: Partial<EditorialActivity>) => {
    let nextDays: EditorialDay[] = [];
    setDays(prev => {
      nextDays = prev.map((day, dIdx) => {
        if (dIdx !== dayIndex) return day;
        const updatedActivities = day.activities.map((activity, aIdx) => {
          if (aIdx !== activityIndex) return activity;
          return {
            ...activity,
            ...updates,
            // Preserve current lock state unless caller explicitly toggled it.
            isLocked: 'isLocked' in updates ? (updates as any).isLocked : activity.isLocked,
            time: updates.startTime || activity.startTime || activity.time,
          };
        });
        // Auto-sort chronologically when a time changes
        if (updates.startTime || updates.endTime) {
          updatedActivities.sort(
            (a, b) => dayChronoKey(a.startTime || a.time) - dayChronoKey(b.startTime || b.time),
          );
        }
        return { ...day, activities: updatedActivities };
      });
      return nextDays;
    });
    setHasChanges(true);
    // Sync activity_costs + dispatch booking-changed so header total, Budget tab,
    // and Payments tab refresh immediately (mirrors swap / generated-days paths).
    syncBudgetFromDays(nextDays);
    // C-TOOL-8: persist the edit immediately (don't rely on the flaky autosave).
    void persistDaysImmediately(nextDays);
    setEditActivityModal(null);
    toast.success('Activity updated');
  }, [syncBudgetFromDays, persistDaysImmediately]);

   // Reset share state when tripId changes — prevents stale links
   useEffect(() => {
     setShareLink(null);
     setInviteHealth(null);
     setInviteCopied(false);
   }, [tripId]);

   const handleCreateShareLink = useCallback(async (forceRotate = false) => {
     setIsCreatingInvite(true);
     try {
       const result = await resolveInviteLink(tripId, forceRotate);
       setInviteHealth(result);

       if (!result.success || !result.link) {
         toast.error(getInviteErrorMessage(result.reason));
         return;
       }

       setShareLink(result.link);
       
       // Copy to clipboard
       await navigator.clipboard.writeText(result.link);
       setInviteCopied(true);
       setTimeout(() => setInviteCopied(false), 2000);
       toast.success(forceRotate ? 'New invite link generated & copied!' : 'Invite link copied!');

       // Prompt group unlock if no budget exists yet
       const { data: existingBudget } = await supabase
         .from('group_budgets')
         .select('id')
         .eq('trip_id', tripId)
         .maybeSingle();
       
       if (!existingBudget) {
        // Close the share modal first so the group unlock modal isn't hidden behind it
        setShowShareModal(false);
        setTimeout(() => setShowGroupUnlockModal(true), 400);
      }

      // Grant first_share bonus (fire-and-forget)
      if (!hasClaimedBonus('first_share')) {
        claimBonus('first_share', { tripId }).then((result) => {
          if (result.granted) {
            toast.success(`+${result.credits} credits earned for sharing your first trip! 📤`);
          }
        }).catch((e) => console.warn('Failed to claim first_share bonus:', e));
      }
    } catch (err: any) {
      console.error('Failed to create share link:', err?.message || err);
      toast.error(toFriendlyError(err?.message));
    } finally {
      setIsCreatingInvite(false);
    }
  }, [tripId, travelers]);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="space-y-6">
      {/* Onboarding Tour for first-time visitors */}
      <ItineraryOnboardingTour tripId={tripId} />
      {/* Persistent Help Button */}
      <HelpButton />
      {/* (Sticky toolbar removed — controls moved to bottom Trip Summary section) */}

      {/* Past Trip — Create Guide CTA */}
      {isPastTrip && (
        <div className="flex items-center justify-between bg-muted/50 border border-border rounded-lg p-3">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Trip complete! Share it with the community.</p>
              <p className="text-xs text-muted-foreground">
                This trip has ended. The itinerary is in read-only mode.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => window.location.href = `/guide/create/${tripId}`}
          >
            Create Travel Guide
          </Button>
        </div>
      )}

      {/* View-Only Mode Indicator */}
      {isEditable && !effectiveIsEditable && !guestMustPropose && tripPermission && !tripPermission.isOwner && (
        <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 flex items-center gap-3">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">View Only</p>
            <p className="text-xs text-muted-foreground">
              You have viewer access to this trip. The trip owner can grant you edit permissions.
            </p>
          </div>
        </div>
      )}

      {/* Propose & Approve Mode Indicator (guest has edit perms but mode requires proposals) */}
      {guestMustPropose && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3 flex items-center gap-3">
          <MessageSquarePlus className="h-4 w-4 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-medium">Propose Changes</p>
            <p className="text-xs text-muted-foreground">
              This trip requires proposals for changes. Use "Propose Replacement" on any activity. The owner and group will vote.
            </p>
          </div>
        </div>
      )}

      {/* Collaborator Edit Mode Info (free edit) */}
      {effectiveIsEditable && tripPermission && !tripPermission.isOwner && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Editing Freely</p>
            <p className="text-xs text-muted-foreground">
              You can edit this itinerary directly. AI actions will use your credits.
            </p>
          </div>
        </div>
      )}

      {/* Guest DNA Banner - prompt to take quiz or request blend */}
      {tripPermission && !tripPermission.isOwner && (
        <GuestDNABanner tripId={tripId} />
      )}

      {/* Collaborator Color Legend */}
      {collaboratorColorMap && collaboratorColorMap.size > 0 && (
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Trip members:</span>
          {Array.from(collaboratorColorMap.values()).map((attr) => {
            const colors = getCollaboratorColor(attr.colorIndex);
            return (
              <span key={attr.userId} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2.5 w-2.5 rounded-full", colors.dot)} />
                {attr.name}
              </span>
            );
          })}
        </div>
      )}


       {/* Navigation Tabs - Hidden in clean preview mode */}
       {!isCleanPreview && <div className="sticky top-0 z-30 bg-background sm:relative sm:z-auto overflow-x-hidden">
        <div 
          className="border-b border-border overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
          ref={(el) => {
            if (!el) return;
            const updateFade = () => {
              const sibling = el.parentElement?.querySelector('[data-tab-fade]') as HTMLElement | null;
              if (sibling) {
                const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
                sibling.style.opacity = (el.scrollWidth > el.clientWidth && !atEnd) ? '1' : '0';
              }
            };
            el.addEventListener('scroll', updateFade);
            // Run on mount and after a short delay for layout
            updateFade();
            setTimeout(updateFade, 100);
          }}
        >
          <div className="flex gap-1 min-w-max" data-tour="tab-bar">
            {[
              { id: 'itinerary', label: 'Itinerary', fullLabel: 'Itinerary', icon: <Calendar className="h-4 w-4" /> },
              { id: 'budget', label: 'Budget', fullLabel: 'Budget', icon: <Wallet className="h-4 w-4" /> },
              { id: 'payments', label: 'Payments', fullLabel: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
              { id: 'details', label: 'Details', fullLabel: isDayTrip ? 'Trip Details' : 'Flights & Hotels', icon: <Plane className="h-4 w-4" /> },
              { id: 'needtoknow', label: 'Need to Know', fullLabel: 'Need to Know', icon: <Shield className="h-4 w-4" />, mobileOverflow: true },
              ...(collaborators.length > 0 ? [{ id: 'collab', label: 'Group', fullLabel: 'Group Chat & Vote', icon: <MessageCircle className="h-4 w-4" /> }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  "px-3 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-sans tracking-wide transition-colors relative flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0",
                  (tab as any).mobileOverflow && "hidden sm:flex",
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                <span className="sm:hidden">{tab.label}</span>
                <span className="hidden sm:inline">{tab.fullLabel}</span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="editorialItineraryTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  />
                )}
              </button>
            ))}
            {/* Mobile overflow menu for hidden tabs */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="sm:hidden px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuItem onClick={() => setActiveTab('payments' as typeof activeTab)}>
                  <CreditCard className="h-4 w-4 mr-2" /> Payments
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Fade gradient indicating more tabs */}
        <div 
          data-tab-fade
          className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-background to-transparent transition-opacity duration-200 sm:hidden"
          style={{ opacity: 0 }}
        />
       </div>}

       {/* In clean preview, force itinerary tab and skip AnimatePresence wrapper */}
      <AnimatePresence mode="popLayout" initial={false}>
        {activeTab === 'itinerary' && (
          <motion.div
            key="itinerary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
             {/* Itinerary recovery / integrity banner - Itinerary tab is the
                 primary surface so users immediately see something needs
                 attention. Generic red + Regenerate is reserved for the one
                 case it's correct (LLM returned an empty plan). Soft
                 integrity-contract violations render as amber, code-specific
                 advisories with no Regenerate CTA. See
                 src/lib/itinerary/integrityBannerCopy.ts. */}
             {(() => {
               if (isCleanPreview) return null;
               const integrityCodes =
                 (tripPlannerMetadata?.integrityContract as { codes?: string[] } | null)
                   ?.codes ?? [];
               const meaningfulCount = classifyItineraryCompleteness(days as any)
                 .meaningfulCount;
               const variant = pickBannerVariant({
                 itineraryStatus,
                 generationFailureReason,
                 integrityCodes,
                 meaningfulActivityCount: meaningfulCount,
               });
               if (!variant) return null;

               if (variant.kind === 'empty' || variant.kind === 'incomplete') {
                 return (
                   <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                     <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-destructive" />
                     <div className="flex-1 space-y-2">
                       <p className="font-semibold text-foreground">{variant.title}</p>
                       <p className="text-sm text-muted-foreground">{variant.body}</p>
                       <Button
                         size="sm"
                         variant="default"
                         onClick={handleRegenerateItinerary}
                         disabled={isRegenerating}
                         className="mt-1 gap-1.5"
                       >
                         <RefreshCw className={cn('h-4 w-4', isRegenerating && 'animate-spin')} />
                         {isRegenerating ? 'Regenerating…' : 'Regenerate itinerary'}
                       </Button>
                     </div>
                   </div>
                 );
               }

               // variant.kind === 'integrity' — amber, no Regenerate CTA
               return (
                 <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                   <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                   <div className="flex-1 space-y-2">
                     {variant.items.length === 1 ? (
                       <>
                         <p className="font-semibold text-foreground">
                           {variant.items[0].title}
                         </p>
                         <p className="text-sm text-muted-foreground">
                           {variant.items[0].body}
                         </p>
                       </>
                     ) : (
                       <>
                         <p className="font-semibold text-foreground">
                           A few things to review on your itinerary
                         </p>
                         <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                           {variant.items.map((item) => (
                             <li key={item.code}>
                               <span className="font-medium text-foreground">
                                 {item.title}.
                               </span>{' '}
                               {item.body}
                             </li>
                           ))}
                         </ul>
                       </>
                     )}
                   </div>
                 </div>
               );
             })()}

             {/* Smart Finish Banner — DNA gap analysis for manual trips — hidden in clean preview */}
             {!isCleanPreview && isManualMode && !isPastTrip && (
              <SmartFinishBanner
                tripId={tripId}
                isManualMode={isManualMode}
                smartFinishPurchased={smartFinishPurchased}
                onPurchaseComplete={async () => {
                  setSmartFinishPurchased(true);
                  await refetchItineraryFromDb();
                }}
              />
            )}

              {!isCleanPreview && (activeTripHealthPanel || travelIntelCards) && (
                <div className="sm:hidden">
                  <MobileTripOverview
                    tripHealthPanel={activeTripHealthPanel}
                    travelIntelCards={travelIntelCards}
                    daysPlanned={days.filter((d: any) => {
                      const acts = d.activities || [];
                      return acts.some((a: any) => {
                        const cat = (a.category || a.type || '').toLowerCase();
                        return !['check-in', 'check-out', 'hotel', 'accommodation'].includes(cat);
                      });
                    }).length}
                    totalDays={days.length}
                    cityCount={cityCount}
                    tripId={tripId}
                  />
                </div>
              )}

              {/* ── Unified Trip Command Center — hidden in clean preview ── */}
             {!isCleanPreview && <div data-tour="value-header" className="rounded-xl border border-border bg-card overflow-hidden">

              {/* ROW 1: Trip Total + Currency Toggle + Meta */}
              <div className="px-4 sm:px-6 py-4 border-b border-border/50 overflow-hidden">
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0" aria-live="polite" aria-busy={isBudgetCalculating}>
                    <span className="text-sm text-muted-foreground shrink-0">Trip Total</span>
                    <span
                      className={cn(
                        "text-2xl font-bold text-foreground truncate tabular-nums",
                        isBudgetCalculating && "opacity-70 animate-pulse"
                      )}
                    >
                      {formatCurrency(displayCost(financialSnapshot.loading ? 0 : headerStripValues.displayedTripTotalUsd), tripCurrency)}
                    </span>
                    {isBudgetCalculating && (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                        title="Final trip total may differ - itinerary still generating"
                      >
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Calculating…
                      </span>
                    )}
                    {tripCurrency !== 'USD' && rateDisclosure(tripCurrency) && (
                      <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground/70 hover:text-foreground transition-colors"
                            aria-label="Exchange rate info"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <span className="text-xs">{rateDisclosure(tripCurrency)}</span>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {/* TripTotalDeltaIndicator removed 2026-05-15: the inline
                        "−$X just now" badge could latch indefinitely when a
                        background system refetch (orphan archive, backfill,
                        cost-table sync) produced a non-zero delta the user
                        never caused. Pricing changes attributable to a
                        repair pass still surface via the toast.info path in
                        useTripFinancialSnapshot. See plan
                        .lovable/plan.md (2026-05-15).
                        Bali/Barcelona/Monaco repro pattern. */}
                  </div>
                  {localCurrency !== 'USD' && (
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setShowLocalCurrency((prev) => !prev)}
                          className="inline-flex items-center rounded-md bg-secondary/40 border border-border text-xs font-medium overflow-hidden"
                          aria-label="Switch Currency"
                          data-tour="currency-toggle"
                        >
                          <span
                            className={cn(
                              "px-3 py-1.5 transition-colors",
                              !showLocalCurrency
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-secondary"
                            )}
                          >
                            USD
                          </span>
                          <span
                            className={cn(
                              "px-3 py-1.5 transition-colors",
                              showLocalCurrency
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-secondary"
                            )}
                          >
                            {localCurrency}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <span className="text-xs font-medium">Switch Currency</span>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap justify-center">
                  <span>{days.length} Days · {travelers} {travelers === 1 ? 'Guest' : 'Guests'}</span>
                  {creditData && (
                    <span className="flex items-center gap-1 text-primary font-medium">
                      <Coins className="h-3 w-3" />
                      {formatCredits(totalCredits)} credits
                    </span>
                  )}
                </div>
                {/* Unified reconciliation strip - itemised equation so the
                    sum of day-card badges (group cost) plus hotel/flights/reserve
                    visibly equals Trip Total. Renders whenever there's a trip
                    total OR a multi-traveler /pp ↔ group bridge to explain. */}
                {financialSnapshot.tripTotalCents > 0 && (tripLevelCents > 0 || daysSubtotalCents > 0) && (() => {
                  // Strip MUST mirror the canonical snapshot — never local
                  // computeHotelCostUsd / leg sums. The pure helper guarantees
                  // the visible equation `Days + Hotel + Flight + Reserve = Trip Total`
                  // balances by construction even when the snapshot fetch lags
                  // behind useTripDayBreakdown (closes the symmetric drift bug
                  // where Trip Total visually equalled Days while a hotel chip
                  // showed a non-zero value — Casablanca/Kyoto/Osaka pattern).
                  // See mem://constraints/finance/header-strip-mirrors-snapshot.
                  const tripTotalUsd  = financialSnapshot.tripTotalCents / 100;
                  const daysGroupUsd  = daysSubtotalCents / 100;
                  const hotelChipUsd  = financialSnapshot.effectiveHotelCents / 100;
                  const flightChipUsd = financialSnapshot.effectiveFlightCents / 100;
                  // Reuse the SAME precomputed strip values as the headline
                  // above so the equation-row Trip Total can never diverge
                  // from the big top-line Trip Total.
                  const stripValues = headerStripValues;
                  const { chipSumUsd, displayedTripTotalUsd, reserveAdjustUsd, showReserve, snapshotUnderChips, snapshotOverChips } = stripValues;
                  if (
                    typeof import.meta !== 'undefined' &&
                    (import.meta as any).env?.DEV &&
                    !financialSnapshot.loading
                  ) {
                    if (snapshotUnderChips || snapshotOverChips) {
                      // eslint-disable-next-line no-console
                      console.warn('[STRIP_DRIFT]', {
                        tripId,
                        tripCurrency,
                        direction: snapshotUnderChips ? 'snapshot<chips' : 'snapshot>chips',
                        tripTotalCents: financialSnapshot.tripTotalCents,
                        daysSubtotalCents,
                        effectiveHotelCents: financialSnapshot.effectiveHotelCents,
                        effectiveFlightCents: financialSnapshot.effectiveFlightCents,
                        committedHotelCents: financialSnapshot.committedHotelCents,
                        committedFlightCents: financialSnapshot.committedFlightCents,
                        manualHotelDelta: financialSnapshot.manualHotelDelta,
                        manualFlightDelta: financialSnapshot.manualFlightDelta,
                        includeHotel: financialSnapshot.includeHotel,
                        includeFlight: financialSnapshot.includeFlight,
                        chipSumUsd,
                        displayedTripTotalUsd,
                      });
                    }
                  }
                  const Sep = ({ char }: { char: string }) => (
                    <span className="text-muted-foreground/40">{char}</span>
                  );
                  const Chip = ({ label, value }: { label: string; value: number }) => (
                    <span>
                      <span className="text-muted-foreground/70">{label}</span>{' '}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatCurrency(displayCost(Math.abs(value)), tripCurrency)}
                      </span>
                    </span>
                  );
                  // Show a quiet "Reconciling…" hint only when the two
                  // independent fetches disagree by more than $1 AND we're past
                  // the hook's 4 s stabilisation window. The equation already
                  // balances visually — this just acknowledges the late
                  // refetch so the user doesn't think the math is wrong.
                  const reconcilingActive =
                    !financialSnapshot.loading &&
                    (snapshotUnderChips || snapshotOverChips);
                  return (
                    <>
                      <div className={cn("flex items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-muted-foreground flex-wrap justify-center", isBudgetCalculating && "opacity-60")}>
                        <Chip label="Days (group)" value={daysGroupUsd} />
                        {hotelChipUsd > 0 && (<><Sep char="+" /><Chip label="Hotel" value={hotelChipUsd} /></>)}
                        {flightChipUsd > 0 && (<><Sep char="+" /><Chip label="Flights" value={flightChipUsd} /></>)}
                        {showReserve && (<><Sep char="+" /><Chip label="Reserve & adjustments" value={reserveAdjustUsd} /></>)}
                        <Sep char="=" />
                        <span>
                          <span className="text-muted-foreground/70">Trip Total</span>{' '}
                          <span className="font-semibold text-foreground tabular-nums">{formatCurrency(displayCost(displayedTripTotalUsd), tripCurrency)}</span>
                        </span>
                        {typeof import.meta !== 'undefined' &&
                          (import.meta as any).env?.DEV &&
                          (snapshotUnderChips || snapshotOverChips) && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-mono">
                            Δ {formatCurrency(displayCost(Math.abs(displayedTripTotalUsd - (financialSnapshot.tripTotalCents / 100))), tripCurrency)}{' '}
                            ({snapshotUnderChips ? 'snapshot<chips' : 'snapshot>chips'})
                          </span>
                        )}
                      </div>
                      <ReconcilingHint
                        active={reconcilingActive}
                        site="header"
                        tripId={tripId}
                      />
                      {/* Pricing 3A: don't let hotel/flight silently disappear when the
                          Budget Visibility toggle excludes them - surface a muted note
                          so users never see a Trip Total that's missing a known cost. */}
                      {stripValues.hasExcludedLogistics && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-300 text-center mt-1">
                          {excludedBreakdownLabel(stripValues, (usd) =>
                            formatCurrency(displayCost(usd), tripCurrency),
                          )}{' '}
                          excluded from Trip Total - toggle on in Budget Visibility to include
                        </div>
                      )}
                      {travelers > 1 && (
                        <div className="text-[11px] text-muted-foreground/70 text-center mt-1">
                          Day badges show /pp · multiply by {travelers} for group cost
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* ROW 2: Action Buttons */}
              <div className="px-4 sm:px-6 py-3 border-b border-border/50 overflow-hidden" data-tour="trip-actions">
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setShowQuickShareModal(true)} className="gap-2">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>

                  {tripPermission?.isOwner && (
                    <Button variant="ghost" size="sm" onClick={() => setShowShareModal(true)} className="gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Manage
                    </Button>
                  )}

                  {effectiveIsEditable && (entitlements?.can_export_pdf || smartFinishPurchased || isPaid || isManualMode) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={async () => {
                        try {
                          toast.info('Generating PDF...');
                          const { generateConsumerTripPdf } = await import('@/utils/consumerPdfGenerator');
                          const unlockedDayNumbers = new Set(
                            days.filter(d => canViewDay(d.dayNumber)).map(d => d.dayNumber)
                          );
                          await generateConsumerTripPdf({
                            tripName: `Trip to ${destination}`,
                            destination, startDate, endDate, travelers, tripCurrency, days, unlockedDayNumbers,
                            flights: allFlightLegs.length > 0 ? allFlightLegs.map((leg, i) => ({
                              airline: leg.airline || '',
                              departureTime: leg.departure?.time || '',
                              arrivalTime: leg.arrival?.time || '',
                              departureAirport: leg.departure?.airport || '',
                              arrivalAirport: leg.arrival?.airport || '',
                              date: leg.departure?.date || '',
                              label: allFlightLegs.length > 1
                                ? (leg.isDestinationArrival ? 'Outbound' : leg.isDestinationDeparture ? 'Return' : i === 0 ? 'Outbound' : i === allFlightLegs.length - 1 ? 'Return' : `Leg ${i + 1}`)
                                : undefined,
                            })) : undefined,
                            hotel: hotelSelection ? {
                              name: hotelSelection.name || '',
                              neighborhood: hotelSelection.neighborhood || '',
                              checkIn: startDate, checkOut: endDate,
                            } : undefined,
                          });
                          toast.success('PDF downloaded!');
                        } catch (err) {
                          console.error('PDF export failed:', err);
                          toast.error('Failed to generate PDF. Please try again.');
                        }
                      }}
                    >
                      <FileText className="h-4 w-4" />
                      Export PDF
                    </Button>
                  )}

                  {effectiveIsEditable && (
                    <span className={cn(
                      "text-xs flex items-center gap-1",
                      hasChanges ? "text-muted-foreground" : "text-primary"
                    )}>
                      {hasChanges ? (
                        <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-2">
                          {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save
                        </Button>
                      ) : (
                        <><Check className="h-3.5 w-3.5" /> Saved</>
                      )}
                    </span>
                  )}

                  {/* Desktop: Optimize + Regenerate inline */}
                  {effectiveIsEditable && needsOptimization && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs text-muted-foreground hidden sm:inline-flex"
                          onClick={() => {
                            if (entitlements?.can_optimize_routes) {
                              openOptimizeDialog();
                            } else {
                              setShowRouteUpgrade(true);
                            }
                          }}
                          disabled={isOptimizing || days.length === 0}
                        >
                          {isOptimizing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Route className="h-3.5 w-3.5" />}
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                          </span>
                          {isOptimizing ? 'Optimizing...' : 'Optimize'}
                          {!entitlements?.can_optimize_routes && <Lock className="h-3 w-3 ml-0.5 opacity-60" />}
                          {entitlements?.can_optimize_routes && !routeOptCost.isFirstTrip && routeOptCost.cost > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] opacity-60 ml-0.5">
                              <Coins className="h-2.5 w-2.5" />{routeOptCost.cost}
                            </span>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Reorders activities to minimize transit time
                          {!routeOptCost.isFirstTrip && routeOptCost.cost > 0 && ` · ${routeOptCost.cost} credits`}
                          {routeOptCost.isFirstTrip && ' · Free on first trip'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {effectiveIsEditable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs text-muted-foreground hidden sm:inline-flex"
                      onClick={() => setShowRegenerateConfirm(true)}
                      disabled={isRegenerating}
                    >
                      {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      {isRegenerating ? 'Regenerating…' : 'Regenerate'}
                    </Button>
                  )}

                  {/* Mobile: overflow menu for Optimize + Regenerate */}
                  {effectiveIsEditable && (
                    <div className="sm:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                            More
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-48">
                          {needsOptimization && (
                            <DropdownMenuItem
                              onClick={() => {
                                if (entitlements?.can_optimize_routes) {
                                  openOptimizeDialog();
                                } else {
                                  setShowRouteUpgrade(true);
                                }
                              }}
                              disabled={isOptimizing || days.length === 0}
                            >
                              {isOptimizing ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Route className="h-3.5 w-3.5 mr-2" />}
                              {isOptimizing ? 'Optimizing...' : 'Optimize Routes'}
                              {!entitlements?.can_optimize_routes && <Lock className="h-3 w-3 ml-auto opacity-60" />}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setShowRegenerateConfirm(true)}
                            disabled={isRegenerating}
                          >
                            {isRegenerating ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
                            {isRegenerating ? 'Regenerating…' : 'Regenerate All'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </div>

              {/* ROW 3: Voyance Intelligence (collapsible) */}
              {(valueStats.voyanceFinds > 0 || valueStats.timingOptimizations > 0 || valueStats.touristTrapsAvoided > 0 || valueStats.insiderTips > 0) && (
                <Collapsible open={showTripOverview} onOpenChange={setShowTripOverview}>
                  <CollapsibleTrigger className="w-full px-4 sm:px-6 py-3 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors border-b border-border/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">Voyance Intelligence</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!showTripOverview && valueStats.estimatedSavings?.time && (
                        <span className="text-[11px] text-muted-foreground">{valueStats.estimatedSavings.time} saved</span>
                      )}
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200", showTripOverview && "rotate-180")} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-b border-border/50">
                      <p className="text-xs text-muted-foreground text-center pt-3 pb-1 px-4 truncate">
                        Your {destination} trip{style ? ` · ${style} style` : ''}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/50">
                        {valueStats.voyanceFinds > 0 && (
                          <div className="p-4 text-center">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 mx-auto text-primary bg-primary/10">
                              <Sparkles className="h-4 w-4" />
                            </div>
                            <span className="text-3xl font-bold text-primary">{valueStats.voyanceFinds}</span>
                            <p className="text-xs font-medium text-foreground mt-0.5">Voyance Finds</p>
                          </div>
                        )}
                        {valueStats.timingOptimizations > 0 && (
                          <div className="p-4 text-center">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 mx-auto text-accent bg-accent/10">
                              <Clock className="h-4 w-4" />
                            </div>
                            <span className="text-3xl font-bold text-accent">{valueStats.timingOptimizations}</span>
                            <p className="text-xs font-medium text-foreground mt-0.5">Timing Hacks</p>
                          </div>
                        )}
                        {valueStats.touristTrapsAvoided > 0 && (
                          <div className="p-4 text-center">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 mx-auto text-primary bg-primary/10">
                              <Sparkles className="h-4 w-4" />
                            </div>
                            <span className="text-3xl font-bold text-primary">{valueStats.touristTrapsAvoided}</span>
                            <p className="text-xs font-medium text-foreground mt-0.5">Local Picks</p>
                          </div>
                        )}
                        {valueStats.insiderTips > 0 && (
                          <div className="p-4 text-center">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 mx-auto text-gold bg-gold/10">
                              <Lightbulb className="h-4 w-4" />
                            </div>
                            <span className="text-3xl font-bold text-gold">{valueStats.insiderTips}</span>
                            <p className="text-xs font-medium text-foreground mt-0.5">Insider Tips</p>
                          </div>
                        )}
                      </div>
                      {valueStats.estimatedSavings && (valueStats.estimatedSavings.time || valueStats.estimatedSavings.money) && (
                        <div className="p-3 bg-primary/5 border-t border-border/50">
                          <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            {valueStats.estimatedSavings.time && (
                              <span className="font-medium text-foreground">{valueStats.estimatedSavings.time} saved</span>
                            )}
                            {valueStats.estimatedSavings.time && valueStats.estimatedSavings.money && (
                              <span className="text-muted-foreground">+</span>
                            )}
                            {valueStats.estimatedSavings.money && (
                              <span className="font-medium text-foreground">{valueStats.estimatedSavings.money}</span>
                            )}
                            <span className="text-muted-foreground">from local picks</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Essentials, flights, hotel */}
                    <div className="p-3 sm:p-4 space-y-3">
                      {hasFlightData && allFlightLegs.length > 0 && (
                        <div className="space-y-1.5">
                          {allFlightLegs.slice(0, 3).map((leg, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm">
                              <Plane className={cn("h-4 w-4 text-muted-foreground shrink-0", i > 0 && "rotate-180")} />
                              <span className="font-medium">{leg.airline || 'Flight'}</span>
                              <span className="text-muted-foreground">
                                {leg.departure?.airport} → {leg.arrival?.airport}
                                {leg.departure?.time ? ` · ${leg.departure.time}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hotelSelection?.name && (
                        <div className="flex items-center gap-3 text-sm">
                          <Hotel className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{hotelSelection.name}</span>
                          {hotelSelection.address && (
                            <span className="text-muted-foreground truncate">{hotelSelection.address}</span>
                          )}
                        </div>
                      )}
                      {(destinationInfo?.timezone || destinationInfo?.currency || destinationInfo?.language || destinationInfo?.emergency) && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40">
                          {destinationInfo?.timezone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{destinationInfo.timezone}</span>
                            </div>
                          )}
                          {destinationInfo?.currency && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Wallet className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{destinationInfo.currency}{destinationInfo.currencySymbol ? ` (${destinationInfo.currencySymbol})` : ''}</span>
                            </div>
                          )}
                          {destinationInfo?.language && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Languages className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{destinationInfo.language}</span>
                            </div>
                          )}
                          {destinationInfo?.emergency && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{destinationInfo.emergency}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {!hasFlightData && !hotelSelection?.name && !destinationInfo?.timezone &&
                       valueStats.voyanceFinds === 0 && valueStats.timingOptimizations === 0 && (
                        <p className="text-xs text-muted-foreground italic">
                          Add flights and hotels in the <button className="underline" onClick={() => setActiveTab('details')}>Flights &amp; Hotels</button> tab.
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* ROW 4: Trip Completion (collapsible) */}
              {activeTripHealthPanel && (
                <Collapsible>
                  <CollapsibleTrigger className="w-full px-4 sm:px-6 py-3 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Trip Completion</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-3 sm:p-4">
                      {activeTripHealthPanel}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* ROW 5: Travel Intel (collapsible) */}
              {travelIntelCards && (
                <Collapsible>
                  <CollapsibleTrigger className="w-full px-4 sm:px-6 py-3 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-accent shrink-0" />
                      <span className="text-xs font-semibold text-accent uppercase tracking-wider">Travel Intelligence</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-3 sm:p-4 space-y-2">
                      {travelIntelCards}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Need to Know is now a top-level tab — removed from command center to avoid duplication */}
             </div>}




            {/* Regeneration Loading Overlay */}
            <AnimatePresence>
              {isRegenerating && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-lg bg-primary/10 border border-primary/30 p-6 text-center space-y-3"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  <div>
                    <p className="text-lg font-semibold text-foreground">Rebuilding your itinerary…</p>
                    <p className="text-sm text-muted-foreground">This may take up to a minute. Flights, hotels, trip settings, and locked activities are preserved.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

             {/* Below sections hidden in clean preview */}
             {!isCleanPreview && (
               <>
                 {/* What We Skipped - Tourist traps avoided */}
                 <WhyWeSkippedSection
                   skippedItems={skippedItems}
                   destination={destination}
                   isLoading={isLoadingSkipList}
                 />

                 {/* Accommodation Notes & Practical Tips from parsed trip input */}
                 {parsedMetadata && (
                   <ParsedTripNotesSection metadata={parsedMetadata} />
                 )}

                 {/* Skip List Violation Warning */}
                 {validationIssues.filter(i => i.type === 'skip_list').length > 0 && (
                   <div className="px-4 py-3 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                     <div className="flex items-start gap-3">
                       <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                       <div className="space-y-1">
                         <p className="font-medium text-sm">
                           Heads up: {validationIssues.filter(i => i.type === 'skip_list').length} activit{validationIssues.filter(i => i.type === 'skip_list').length === 1 ? 'y matches' : 'ies match'} our skip list
                         </p>
                         <p className="text-xs text-amber-600 dark:text-amber-400/80">
                           These activities appear in "Why We Skipped These" but are still in your itinerary. 
                           Consider swapping them for better alternatives.
                         </p>
                         <div className="flex flex-wrap gap-1.5 mt-2">
                           {validationIssues.filter(i => i.type === 'skip_list').map((issue, idx) => (
                             <Badge key={idx} variant="outline" className="text-xs border-amber-500/50 text-amber-700 dark:text-amber-400">
                               Day {issue.dayNumber}: {issue.activityTitle.length > 30 ? issue.activityTitle.slice(0, 30) + '…' : issue.activityTitle}
                             </Badge>
                           ))}
                         </div>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Flight Sync Warning */}
                 {destinationArrivalLeg?.arrival?.time && (() => {
                   const outboundLeg = destinationArrivalLeg;
                   const isCrossDayFlight = outboundLeg?.departure?.date && outboundLeg?.arrival?.date
                     && outboundLeg.arrival.date.substring(0, 10) > outboundLeg.departure.date.substring(0, 10);
                   const arrivalDayIndex = isCrossDayFlight ? 1 : 0;
                   const arrivalDay = days[arrivalDayIndex];
                   
                   if (arrivalDay?.activities?.[0]) {
                     return (
                       <FlightSyncWarning
                         flightArrivalTime={destinationArrivalLeg.arrival.time}
                         day1FirstActivity={arrivalDay.activities[0]}
                         onSyncDay1={handleSyncFlightToDay}
                         isRegenerating={regeneratingDay === arrivalDay?.dayNumber}
                       />
                     );
                   }
                   return null;
                 })()}
               </>
             )}



            {/* Day Navigation Bar */}
            <div className="space-y-2">
              {/* Trip length header */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
                  <span>
                    {isActivelyGenerating ? expectedTotalDays : days.length} day{(isActivelyGenerating ? expectedTotalDays : days.length) !== 1 ? 's' : ''}
                    {startDate && endDate ? ` · ${safeFormatDate(startDate, 'MMM d')} - ${safeFormatDate(endDate, 'MMM d')}` : ''}
                  </span>
                  {onDateChange && (
                    <TripDateEditorInline
                      startDate={startDate}
                      endDate={endDate}
                      hasItinerary={hasItineraryProp ?? days.length > 0}
                      flightSelection={dateEditorFlightSelection}
                      onDateChange={onDateChange}
                      days={days}
                      cities={dateEditorCities}
                     />
                   )}
                 </span>
                 {!isCleanPreview && (
                 <div className="flex items-center gap-1.5">
                    {canUndoDate && (
                      <DayUndoButton
                        onClick={handleUndoDate}
                        isLoading={isUndoingDate}
                        showLabel
                        label="Undo Date Change"
                      />
                    )}
                    {canUndoDay && (
                      <DayUndoButton
                        onClick={handleUndo}
                        isLoading={isUndoing}
                        showLabel
                      />
                    )}
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => setVersionHistoryOpen(true)}
                     className="gap-1.5 text-xs"
                   >
                     <HistoryIcon className="h-4 w-4" />
                     <span className="hidden sm:inline">History</span>
                   </Button>
                   <span className="text-xs text-muted-foreground">
                     Day {selectedDayIndex + 1} of {isActivelyGenerating ? expectedTotalDays : days.length}
                   </span>
                 </div>
                 )}
              </div>

              {/* GAP 3: Render BlendRecalcBanner when companions changed after generation */}
              <BlendRecalcBanner tripId={tripId} onRegenerate={handleRegenerateItinerary} />

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDayIndex(prev => Math.max(0, prev - 1))}
                  disabled={!canGoPrev}
                  className="shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                <div ref={dayPickerScrollRef} className="flex-1 overflow-x-auto scrollbar-hide">
                  <div className="flex gap-1.5" data-tour="day-picker">
                    {days.map((day, index) => {
                      // Check if day has real (non-structural) activities
                      const dayHasRealActivities = (day.activities || []).some((a: any) => {
                        const cat = (a.category || a.type || '').toLowerCase();
                        return !['check-in', 'check-out', 'hotel', 'accommodation'].includes(cat);
                      });
                      const isDayEmpty = !dayHasRealActivities;
                      // Compute date from startDate + dayNumber for reliable cross-month handling
                      let dayDate: Date | null = null;
                      try {
                        if (day.date) {
                          dayDate = parseLocalDate(day.date);
                        } else if (startDate) {
                          dayDate = addDays(parseLocalDate(startDate), (day.dayNumber || index + 1) - 1);
                        }
                        if (dayDate && isNaN(dayDate.getTime())) dayDate = null;
                      } catch { dayDate = null; }
                      
                      const isSelected = index === selectedDayIndex;
                      const isTodayDay = dayDate ? isToday(dayDate) : false;

                      // Resolve city name for multi-city trips
                      // Prefer day.city from parser (authoritative from backend), fall back to hotel date matching
                      let cityName: string | null = (day as any).city || null;
                      const isDayTransition = !!(day as any).isTransitionDay;
                      if (!cityName && allHotels && allHotels.length > 1 && dayDate) {
                        const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
                        for (const ch of allHotels) {
                          if (ch.checkInDate && ch.checkOutDate && dateStr >= ch.checkInDate && dateStr < ch.checkOutDate) {
                            cityName = ch.cityName;
                            break;
                          }
                        }
                        // Fallback: use day title if it looks like a city
                        if (!cityName && day.title && allHotels.some(h => day.title?.includes(h.cityName))) {
                          cityName = allHotels.find(h => day.title?.includes(h.cityName))?.cityName || null;
                        }
                      }

                      return (
                        <button
                          key={day.dayNumber}
                          ref={el => { dayButtonRefs.current[index] = el; }}
                          onClick={() => {
                            setSelectedDayIndex(index);
                            setExpandedDays([day.dayNumber]);
                          }}
                          className={cn(
                            'flex flex-col items-center px-3 py-2 rounded-xl transition-all min-w-[72px] relative border',
                            isSelected 
                              ? (day.metadata?.isLocked && !isManualMode) 
                                ? 'bg-muted border-border shadow-sm' 
                                : 'bg-primary text-primary-foreground border-primary shadow-md'
                              : (day.metadata?.isLocked && !isManualMode) 
                                ? 'bg-muted/30 border-transparent opacity-60 hover:opacity-80' 
                                : 'bg-card border-border/50 hover:bg-muted hover:border-border',
                            isTodayDay && !isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                          )}
                        >
                          {day.metadata?.isLocked && !isManualMode && (
                            <Lock className="h-3 w-3 absolute top-1 right-1 text-muted-foreground" />
                          )}
                          {/* Day number */}
                          <span className={cn(
                            'text-[10px] font-semibold uppercase tracking-wide',
                            isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                          )}>
                            <span className="sm:hidden">D{day.dayNumber}</span><span className="hidden sm:inline">Day {day.dayNumber}</span>
                          </span>
                          {dayDate ? (
                            <>
                              {/* Date number */}
                              <span className="text-lg font-bold leading-tight">
                                {dayDate.getDate()}
                              </span>
                              {/* Weekday + month */}
                              <span className={cn(
                                'text-[10px]',
                                isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              )}>
                                {format(dayDate, 'EEE')}, {format(dayDate, 'MMM')}
                              </span>
                            </>
                          ) : (
                            <span className="text-lg font-bold leading-tight">-</span>
                          )}
                          {/* City name for multi-city */}
                          {cityName && (
                            <span className={cn(
                              'text-[9px] font-medium truncate max-w-[48px] sm:max-w-[64px] mt-0.5 flex items-center gap-0.5',
                              isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground/70'
                            )}>
                              {isDayTransition && <ArrowRight className="h-2 w-2 shrink-0" />}
                              {cityName}
                            </span>
                          )}
                          {isTodayDay && (
                            <Badge variant={isSelected ? 'secondary' : 'default'} className="text-[9px] mt-1 px-1.5 py-0">
                              Today
                            </Badge>
                          )}
                          {isDayEmpty && !isTodayDay && !(day.metadata?.isLocked && !isManualMode) && (
                            <span className={cn(
                              'text-[9px] mt-0.5 font-medium',
                              isSelected ? 'text-primary-foreground/70' : 'text-amber-500'
                            )}>
                              Unplanned
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {/* Placeholder tabs for days not yet generated */}
                    {isActivelyGenerating && days.length < expectedTotalDays && (
                      Array.from({ length: expectedTotalDays - days.length }, (_, i) => {
                        const pendingDayNumber = days.length + i + 1;
                        let dayDate: Date | null = null;
                        try {
                          if (startDate) {
                            dayDate = addDays(parseLocalDate(startDate), pendingDayNumber - 1);
                            if (isNaN(dayDate.getTime())) dayDate = null;
                          }
                        } catch { dayDate = null; }
                        return (
                          <div
                            key={`pending-${pendingDayNumber}`}
                            className="flex flex-col items-center px-3 py-2 rounded-xl min-w-[72px] border border-dashed border-border/50 bg-muted/20 opacity-60"
                          >
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              <span className="sm:hidden">D{pendingDayNumber}</span><span className="hidden sm:inline">Day {pendingDayNumber}</span>
                            </span>
                            {dayDate ? (
                              <>
                                <span className="text-lg font-bold leading-tight text-muted-foreground">{dayDate.getDate()}</span>
                                <span className="text-[10px] text-muted-foreground">{format(dayDate, 'EEE')}, {format(dayDate, 'MMM')}</span>
                              </>
                            ) : (
                              <span className="text-lg font-bold leading-tight text-muted-foreground">-</span>
                            )}
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mt-0.5" />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDayIndex(prev => Math.min(days.length - 1, prev + 1))}
                  disabled={!canGoNext}
                  className="shrink-0"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
             {/* Integrity contract banner — surfaces commit-gate violations */}
             {!isCleanPreview && (
               <IntegrityContractBanner contract={tripPlannerMetadata?.integrityContract as any} />
             )}

             {/* Phase 3 — Omitted must-dos surfaced by the Trip Planner LLM */}
             {!isCleanPreview && (
               <OmittedMustDosBanner items={tripPlannerMetadata?.omittedMustDos as any} className="mt-3" />
             )}

             {/* Bulk Unlock Banner - hidden in clean preview */}
             {!isCleanPreview && !isActivelyGenerating && (() => {
              const lockedDayCount = days.filter(d => !canViewDay(d.dayNumber)).length;
              const unlockedCount = days.length - lockedDayCount;
              if (lockedDayCount < 2) return null;
              return (
                <BulkUnlockBanner
                  lockedDayCount={lockedDayCount}
                  totalDays={days.length}
                  destination={destination}
                  unlockedCount={unlockedCount}
                  onBulkUnlock={() => {
                    const lockedDayNumbers = days
                      .filter(d => !canViewDay(d.dayNumber))
                      .map(d => d.dayNumber);
                    bulkUnlock({
                      tripId,
                      lockedDayCount,
                      totalDays: days.length,
                      destination,
                      destinationCountry,
                      travelers,
                      startDate,
                      budgetTier,
                      tripType,
                      lockedDayNumbers,
                    }, () => {
                      onUnlockComplete?.(null);
                    });
                  }}
                  isUnlocking={isBulkUnlocking}
                />
              );
            })()}

            {/* Show only selected day */}
            {days[selectedDayIndex] && (
              <div className="space-y-6">
                {/* New Member Suggestions Card */}
                {newlyAddedMember && (
                  <NewMemberSuggestionsCard
                    memberName={newlyAddedMember}
                    days={days}
                    colorIndex={collaborators.length}
                    onAddActivities={() => {
                      toast.success(`Regenerating itinerary to include ${newlyAddedMember}'s preferences...`);
                      // Trigger full regeneration which blends the new member's DNA
                      // and the backend backfill guarantees suggestedFor attribution
                      handleRegenerateItinerary();
                    }}
                    onDismiss={() => setNewlyAddedMember(null)}
                  />
                )}
                {/* Arrival Game Plan - Show on every city arrival day */}
                {(() => {
                  const selectedDay = days[selectedDayIndex];
                  const dayDate = selectedDay?.date;
                  
                  // Detect cross-day (overnight) outbound flight
                  const outboundLeg = destinationArrivalLeg || (allFlightLegs.length > 0 ? allFlightLegs[0] : undefined);
                  const isCrossDayFlight = outboundLeg?.departure?.date && outboundLeg?.arrival?.date
                    && outboundLeg.arrival.date.substring(0, 10) > outboundLeg.departure.date.substring(0, 10);
                  
                  // Day 1: For cross-day flights, show DEPARTURE plan instead of arrival
                  if (selectedDayIndex === 0) {
                    if (isCrossDayFlight && outboundLeg) {
                      // Departure Day plan
                      const depTime = outboundLeg.departure?.time || '';
                      const depAirport = outboundLeg.departure?.airport || '';
                      const arrTime = outboundLeg.arrival?.time || '';
                      const arrAirport = outboundLeg.arrival?.airport || '';
                      const arrDate = outboundLeg.arrival?.date || '';
                      // Recommend arriving 2.5h before for international flights
                      let recommendedAirportTime = '';
                      if (depTime) {
                        const [hh, mm] = depTime.split(':').map(Number);
                        if (!isNaN(hh) && !isNaN(mm)) {
                          const totalMin = hh * 60 + mm - 150; // 2.5h before
                          const rh = Math.floor((totalMin + 1440) % 1440 / 60);
                          const rm = (totalMin + 1440) % 1440 % 60;
                          recommendedAirportTime = `${rh.toString().padStart(2, '0')}:${rm.toString().padStart(2, '0')}`;
                        }
                      }
                      const formattedArrDate = arrDate ? (() => {
                        try { return new Date(arrDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return arrDate; }
                      })() : '';
                      
                      return (
                        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <Plane className="h-5 w-5 text-primary" />
                            <h3 className="text-base font-semibold text-foreground">Departure Day</h3>
                          </div>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            {recommendedAirportTime && (
                              <p>🚗 Head to the airport by <span className="font-semibold text-foreground">{recommendedAirportTime}</span></p>
                            )}
                            <p>✈️ <span className="font-medium text-foreground">{outboundLeg.airline || ''} {outboundLeg.flightNumber || ''}</span> departs at <span className="font-semibold text-foreground">{depTime}</span> from {depAirport}</p>
                            <p>🌙 Overnight flight. You'll arrive {formattedArrDate ? `on ${formattedArrDate} ` : ''}at <span className="font-semibold text-foreground">{arrTime}</span> ({arrAirport})</p>
                          </div>
                        </div>
                      );
                    }
                    // Same-day arrival: show normal ArrivalGamePlan
                    return (
                      <ArrivalGamePlan
                        flightSelection={flightSelection}
                        hotelSelection={hotelSelection}
                        allHotels={allHotels}
                        destination={destination}
                         onNavigateToBookings={() => setActiveTab('details')}
                         onAddFlightInline={() => setAddFlightDialogOpen(true)}
                         onAddHotelInline={() => setEditHotelOpen(true)}
                      />
                    );
                  }
                  
                  // Day 2: For cross-day flights, show the arrival game plan here
                  if (selectedDayIndex === 1 && isCrossDayFlight) {
                    return (
                      <ArrivalGamePlan
                        flightSelection={flightSelection}
                        hotelSelection={hotelSelection}
                        allHotels={allHotels}
                        destination={destination}
                         onNavigateToBookings={() => setActiveTab('details')}
                         onAddFlightInline={() => setAddFlightDialogOpen(true)}
                         onAddHotelInline={() => setEditHotelOpen(true)}
                      />
                    );
                  }
                  
                  // For multi-city: show game plan on each city's check-in day
                  // But NOT for same-city hotel switches (split stays)
                  if (allHotels && allHotels.length > 1 && dayDate) {
                    const arrivingCity = allHotels.find((ch, idx) => {
                      if (idx === 0 || !ch.checkInDate || dayDate !== ch.checkInDate) return false;
                      // Skip same-city hotel switches — only trigger for actual new-city arrivals
                      const prevCity = allHotels[idx - 1]?.cityName?.toLowerCase().trim();
                      const thisCity = ch.cityName?.toLowerCase().trim();
                      if (prevCity && thisCity && prevCity === thisCity) return false;
                      return true;
                    });
                    if (arrivingCity) {
                      const legs = flightSelection?.legs;
                      const arrivalLeg = legs?.find(l => {
                        const arrAirport = (l.arrival?.airport || '').toLowerCase();
                        const cityName = (arrivingCity.cityName || '').toLowerCase();
                        return arrAirport.includes(cityName) || cityName.includes(arrAirport);
                      });
                      
                      return (
                        <ArrivalGamePlan
                          flightSelection={arrivalLeg ? { outbound: arrivalLeg } : undefined}
                          hotelSelection={arrivingCity.hotel}
                          allHotels={allHotels}
                          destination={arrivingCity.cityName}
                           onNavigateToBookings={() => setActiveTab('details')}
                           onAddFlightInline={() => setAddFlightDialogOpen(true)}
                         onAddHotelInline={() => setEditHotelOpen(true)}
                          arrivalCityInfo={arrivingCity}
                          dayNumber={selectedDayIndex + 1}
                        />
                      );
                    }
                  }
                  return null;
                })()}

                {/* Hotel Check-in / Check-out Events for multi-city */}
                {allHotels && allHotels.length > 0 && (() => {
                  const selectedDay = days[selectedDayIndex];
                  const dayDate = selectedDay?.date;
                  if (!dayDate) return null;

                  const events: React.ReactNode[] = [];
                  allHotels.forEach((ch) => {
                    if (!ch.hotel?.name) return;
                    const checkInTime = ch.hotel.checkIn || '3:00 PM';
                    const checkOutTime = ch.hotel.checkOut || '11:00 AM';

                    // Check-out: departure day from a city
                    if (ch.checkOutDate && dayDate === ch.checkOutDate) {
                      events.push(
                        <div key={`checkout-${ch.cityOrder}`} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                          <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                            <ArrowRightLeft className="h-4 w-4 text-destructive" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Check out · {ch.hotel!.name}</p>
                            <p className="text-xs text-muted-foreground">{checkOutTime} · {ch.cityName}</p>
                          </div>
                        </div>
                      );
                    }
                    // Check-in: arrival day in a city
                    if (ch.checkInDate && dayDate === ch.checkInDate) {
                      events.push(
                        <div key={`checkin-${ch.cityOrder}`} className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Hotel className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Check in · {ch.hotel!.name}</p>
                            <p className="text-xs text-muted-foreground">{checkInTime} · {ch.cityName}</p>
                          </div>
                        </div>
                      );
                    }
                  });

                  return events.length > 0 ? <div className="space-y-2">{events}</div> : null;
                })()}
                
                {/* Check if this day is locked (placeholder with no content) */}
                {(() => {
                  const selectedDay = days[selectedDayIndex];
                  const isLockedDay = selectedDay.metadata?.isLocked && !isManualMode && !canViewDay(selectedDay.dayNumber);
                  const hasActivities = selectedDay.activities && selectedDay.activities.length > 0;
                  const canViewThisDay = canViewDay(selectedDay.dayNumber);

                  // During active generation, show a generating placeholder instead of locked card
                  if (isActivelyGenerating && isLockedDay && !hasActivities) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <motion.div
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-muted-foreground"
                        >
                          <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary" />
                          <p className="text-sm font-medium">This day is still being created...</p>
                          <p className="text-xs text-muted-foreground mt-1">Check back in a moment</p>
                        </motion.div>
                      </div>
                    );
                  }

                   // Days with no activities at all: show LockedDayCard fallback
                   // But NOT during active generation — those days are still being built
                   if (isLockedDay && !hasActivities && !isActivelyGenerating) {
                     return (
                       <LockedDayCard
                         dayNumber={selectedDay.dayNumber}
                         title={selectedDay.title || `Day ${selectedDay.dayNumber}`}
                         activityCount={6}
                         teaserLine={`Unlock Day ${selectedDay.dayNumber} to discover curated activities, real venues, and personalized recommendations.`}
                         intelligenceBadges={{ finds: 3, timingHacks: 2, trapsAvoided: 1, tips: 2 }}
                         onUnlock={() => handleUnlockDay(selectedDay.dayNumber)}
                         creditsNeeded={CREDIT_COSTS.UNLOCK_DAY}
                         tripId={tripId}
                         onManualBuild={() => {
                           if (tripId) {
                             enableManualBuilder(tripId);
                             toast.success('Manual builder mode enabled! Edit freely.');
                           }
                         }}
                         isFirstTrip={!!selectedDay.metadata?.isFirstTrip}
                         canAfford={totalCredits >= CREDIT_COSTS.UNLOCK_DAY}
                         currentBalance={totalCredits}
                         isUnlocking={isUnlockingDay && unlockingDayNumber === selectedDay.dayNumber}
                         unlockError={unlockDayState?.step === 'error' && unlockDayState?.dayNumber === selectedDay.dayNumber ? unlockDayState.error : null}
                       />
                     );
                   }

                   // During generation, locked days with no activities show generating placeholder
                   if (isLockedDay && !hasActivities && isActivelyGenerating) {
                     return (
                       <div className="flex flex-col items-center justify-center py-12 text-center">
                         <motion.div
                           animate={{ opacity: [0.4, 1, 0.4] }}
                           transition={{ duration: 1.5, repeat: Infinity }}
                           className="text-muted-foreground"
                         >
                           <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary" />
                           <p className="text-sm font-medium">This day is still being created...</p>
                           <p className="text-xs text-muted-foreground mt-1">Check back in a moment</p>
                         </motion.div>
                       </div>
                     );
                   }

                  // Unlocked days with no activities and not generating: show "Generate this day" CTA
                  if (!isLockedDay && !hasActivities && !isActivelyGenerating) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Sparkles className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Day {selectedDay.dayNumber} hasn't been planned yet</p>
                          <p className="text-xs text-muted-foreground mt-1">Generate activities for this day to fill it with curated recommendations</p>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleDayRegenerate(selectedDayIndex)}
                          disabled={regeneratingDay === selectedDay.dayNumber}
                          className="mt-2"
                        >
                          <RefreshCw className={cn("h-4 w-4 mr-2", regeneratingDay === selectedDay.dayNumber && "animate-spin")} />
                          {regeneratingDay === selectedDay.dayNumber ? 'Generating...' : `Generate Day ${selectedDay.dayNumber}`}
                        </Button>
                      </div>
                    );
                  }

                  // Days with activities but locked: show LockedDayCard (no real content in DOM)
                  // SECURITY: Previously used FrostedGateOverlay+DayCard which leaked activities to DevTools
                  return (
                    <>
                      {!canViewThisDay && !isManualMode && hasActivities && !isActivelyGenerating ? (
                        <LockedDayCard
                          dayNumber={selectedDay.dayNumber}
                          title={selectedDay.title || selectedDay.theme || `Day ${selectedDay.dayNumber}`}
                          activityCount={selectedDay.activities.length}
                          teaserLine={`Unlock Day ${selectedDay.dayNumber} to discover ${selectedDay.activities.length} curated activities with full details.`}
                          intelligenceBadges={{ finds: selectedDay.activities.length, timingHacks: 2, trapsAvoided: 1, tips: 2 }}
                          onUnlock={() => handleUnlockDay(selectedDay.dayNumber)}
                          creditsNeeded={CREDIT_COSTS.UNLOCK_DAY}
                          tripId={tripId}
                          onManualBuild={() => {
                            if (tripId) {
                              enableManualBuilder(tripId);
                              toast.success('Manual builder mode enabled! Edit freely.');
                            }
                          }}
                          isFirstTrip={!!selectedDay.metadata?.isFirstTrip}
                          canAfford={totalCredits >= CREDIT_COSTS.UNLOCK_DAY}
                          currentBalance={totalCredits}
                          isUnlocking={isUnlockingDay && unlockingDayNumber === selectedDay.dayNumber}
                          unlockError={unlockDayState?.step === 'error' && unlockDayState?.dayNumber === selectedDay.dayNumber ? unlockDayState.error : null}
                        />
                      ) : (
                        <DayCard
                          key={selectedDay.dayNumber}
                          day={selectedDay}
                          dayIndex={selectedDayIndex}
                          totalDays={days.length}
                          travelers={travelers}
                          budgetTier={budgetTier}
                          tripCurrency={tripCurrency}
                          displayCost={displayCost}
                          destination={destination}
                          destinationCountry={destinationCountry}
                          isExpanded={expandedDays.includes(selectedDay.dayNumber)}
                          isRegenerating={regeneratingDay === selectedDay.dayNumber}
                          isEditable={effectiveIsEditable}
                          isPreview={effectiveIsPreview}
                          canViewPremium={canViewDay(selectedDay.dayNumber)}
                          tripId={tripId}
                          onUnlockTrip={() => setCreditNudge({ action: 'UNLOCK_DAY' })}
                          onUnlockDay={handleUnlockDay}
                          unlockingDayNumber={unlockingDayNumber}
                          getPaymentForItem={getPaymentForItem}
                          refreshPayments={refreshPayments}
                          onToggle={() => toggleDay(selectedDay.dayNumber)}
                          onActivitySwap={(() => {
                            if (aiLocked) return undefined;
                            if (!canViewDay(selectedDay.dayNumber)) return undefined;
                            return openSwapDrawer;
                          })()}
                          swapCapInfo={swapCap}
                          onActivityLock={handleActivityLock}
                          onActivityMove={handleActivityMove}
                          onActivityReorder={(reordered) => handleActivityReorder(selectedDayIndex, reordered)}
                          onMoveToDay={handleMoveToDay}
                          onCopyToDay={handleCopyToDay}
                          onActivityRemove={handleActivityRemove}
                          onDayLock={handleDayLock}
                          onDayRegenerate={() => handleDayRegenerate(selectedDayIndex)}
                          onAddActivity={(afterIndex?: number) => setAddActivityModal({ dayIndex: selectedDayIndex, afterIndex })}
                          onDiscover={aiLocked ? undefined : () => setDiscoverDrawerOpen(true)}
                          onImportActivities={() => setImportModal({ dayIndex: selectedDayIndex })}
                          onTimeEdit={(dIdx, aIdx, activity) => setTimeEditModal({ dayIndex: dIdx, activityIndex: aIdx, activity })}
                          onActivityEdit={(dIdx, aIdx, activity) => setEditActivityModal({ dayIndex: dIdx, activityIndex: aIdx, activity })}
                          onPaymentRequest={onPaymentRequest}
                          onViewReviews={aiLocked ? undefined : openReviewsDrawer}
                          onTransportModeChange={handleTransportModeChange}
                          changingTransportActivityId={changingTransportActivityId}
                          onSetActivityTransportation={(dIdx, aIdx, transport) => handleUpdateActivity(dIdx, aIdx, { transportation: transport })}
                          collaboratorColorMap={collaboratorColorMap}
                          aiLocked={aiLocked}
                          guestMustPropose={guestMustPropose}
                          optionSelections={optionSelections}
                          onOptionSelect={(groupKey, selectedId) => {
                            setOptionSelections(prev => ({ ...prev, [groupKey]: selectedId }));
                          }}
                           compactCards={isManualMode || creationSource === 'smart_finish'}
                           isPastTrip={isPastTrip}
                            isCleanPreview={isCleanPreview}
                            isModalEditing={!!editActivityModal || !!timeEditModal}
                          onRefreshDay={() => handleRefreshDay(selectedDayIndex)}
                          isRefreshingDay={refreshingDayNumber === selectedDay.dayNumber}
                          refreshResult={refreshResults[selectedDay.dayNumber] || null}
                          onDismissRefresh={() => setRefreshResults(prev => { const next = { ...prev }; delete next[selectedDay.dayNumber]; return next; })}
                          onApplyRefreshChanges={(changes) => handleApplyRefreshChanges(selectedDayIndex, changes)}
                          onPhotoResolved={reportPhoto}
                          isManualMode={isManualMode}
                          onOpenConcierge={handleOpenConcierge}
                          onDeleteAINote={handleDeleteAINote}
                          dayBreakdown={tripDayBreakdown.byDay[selectedDay.dayNumber]}
                        />
                      )}
                    </>
                  );
                })()}

              </div>
            )}
            
             {/* Credit Nudge — hidden in clean preview */}
             {!isCleanPreview && creditNudge && creditNudge.action !== 'UNLOCK_DAY' && (
              <div className="mt-3">
                <CreditNudge
                  action={creditNudge.action}
                  currentBalance={totalCredits}
                  onDismiss={() => setCreditNudge(null)}
                />
              </div>
            )}

             {/* Unlock Banner — hidden in clean preview */}
             {!isCleanPreview && effectiveIsPreview && !isActivelyGenerating && (
              <div className="mt-4">
                <UnlockBanner
                  tripId={tripId}
                  totalDays={days.length}
                  freeDays={entitlements?.is_first_trip ? 2 : 0}
                  destination={destination}
                  destinationCountry={destinationCountry}
                  travelers={travelers}
                  startDate={startDate}
                  budgetTier={budgetTier}
                  tripType={tripType}
                  onUnlockComplete={onUnlockComplete}
                />
              </div>
            )}

          </motion.div>
        )}

        {activeTab === 'budget' && (
          <>
          <FirstUseHint
            hintKey="budget_hint_shown"
            message="Set a trip budget and Voyance will track your spending across all activities automatically."
          />
          <ErrorBoundary
            fallback={
              <div className="max-w-md mx-auto text-center py-12">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Budget didn't load</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Something went wrong loading your budget. Your itinerary is safe - try switching tabs or refreshing.
                </p>
                <Button onClick={() => window.location.reload()} size="sm">
                  Refresh
                </Button>
              </div>
            }
          >
          <BudgetTab
            displayCurrency={tripCurrency}
            tripId={tripId}
            travelers={travelers}
            totalDays={days.length}
            isManualMode={isManualMode}
            tripStatus={itineraryStatus ?? null}
            generationFailureReason={generationFailureReason ?? null}
            onRegenerate={handleRegenerateItinerary}
            itineraryDays={days}
            hasHotel={
              !!(hotelSelection?.pricePerNight || hotelSelection?.name) ||
              !!(parsedMetadata?.accommodationNotes?.length) ||
              days.some(d => d.activities.some(a =>
                a.category === 'hotel' || a.category === 'accommodation' ||
                /check.?in/i.test(a.title || '')
              ))
            }
            hasFlight={hasFlightData}
            destination={destination}
            destinationCountry={destinationCountry}
            budgetTier={budgetTier}
            flightSelection={flightSelection}
            hotelSelection={hotelSelection}
            journeyId={journeyId}
            journeyName={journeyName}
            onActivityRemove={(activityId, displayName) => {
              // Validate the id against the live itinerary BEFORE mutating.
              // A stale id (post-regen) used to silently no-op while still
              // firing a success toast — see activityRemoveResolver.ts.
              const resolved = resolveLiveActivity(days as any, activityId);
              if (!resolved.found) {
                toast.error(
                  "Couldn't drop - that item is no longer in your itinerary. The list may have been regenerated."
                );
                return;
              }
              const title = resolved.title || displayName || 'activity';
              if (typeof window !== 'undefined') {
                const ok = window.confirm(
                  `Remove "${title}" from your itinerary?\n\nThis can't be undone from this screen.`
                );
                if (!ok) return;
              }
              setDays((prev) => {
                const updated = prev.map((day, idx) => {
                  if (idx !== resolved.dayIdx) return day;
                  return { ...day, activities: day.activities.filter((a) => a.id !== activityId) };
                });
                syncBudgetFromDays(updated);
                return updated;
              });
              setHasChanges(true);
              toast.success(`Removed "${title}" from itinerary`);
            }}
            onApplyBudgetSwap={async (suggestion) => {
              // Pure logic lives in budgetSwapApply.ts so it can be unit-tested.
              const { applyBudgetSuggestion } = await import('./budgetSwapApply');
              // Capture the title BEFORE the drop so the toast can name it.
              const droppedTitle = suggestion.swap_type === 'drop'
                ? (days.flatMap((d) => d.activities).find((a) => a.id === suggestion.activity_id)?.title || 'activity')
                : null;

              const result = applyBudgetSuggestion(days as any, suggestion as any);
              if (!result.ok) {
                if (suggestion.swap_type === 'drop') {
                  if (result.reason === 'not-found') {
                    toast.error("Couldn't drop - item is no longer in your itinerary.");
                  } else {
                    toast.error("Couldn't drop - that suggestion no longer matches your itinerary. Refresh suggestions.");
                  }
                }
                if (result.reason === 'cost-not-lower') {
                  console.warn('Budget swap blocked: new cost not lower than current');
                }
                return false;
              }

              const updatedDays = result.updatedDays as typeof days;
              setDays(updatedDays);
              syncBudgetFromDays(updatedDays);
              setHasChanges(true);
              queryClient.invalidateQueries({ queryKey: ['tripBudgetSummary', tripId] });
              queryClient.invalidateQueries({ queryKey: ['tripBudgetLedger', tripId] });
              queryClient.invalidateQueries({ queryKey: ['tripBudgetAllocations', tripId] });

              if (suggestion.swap_type === 'drop' && droppedTitle) {
                const savedAmount = (suggestion.savings || 0) * (travelers || 1);
                toast.success(`Dropped "${droppedTitle}" - saved ${formatCurrency(savedAmount)}`);
              }
              return true;
            }}
          />
          </ErrorBoundary>
          </>
        )}

        {activeTab === 'payments' && (
          <PaymentsTab
            tripId={tripId}
            days={days}
            flightSelection={flightSelection}
            hotelSelection={hotelSelection}
            travelers={travelers}
            budgetLimitCents={budgetSettings?.budget_total_cents || undefined}
            budgetCurrency={budgetSettings?.budget_currency || undefined}
            ownerId={user?.id}
            ownerName={user?.name || user?.email?.split('@')[0]}
            budgetTier={budgetTier}
            destination={destination}
            destinationCountry={destinationCountry}
            journeyId={journeyId}
            journeyName={journeyName}
            tripCurrency={tripCurrency}
          />
        )}

        {activeTab === 'details' && (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* Weather Forecast */}
            <WeatherForecast
              destination={destination}
              startDate={startDate}
              endDate={endDate}
              tripDays={days.length}
            />


            {/* Flights + Accommodation are hidden for a 0-night day trip:
                there is no overnight stay and (typically) no flight to log. */}
            {!isDayTrip && (
            <>
            {/* FLIGHT SECTION - Editorial Style */}
            <section className="space-y-3 sm:space-y-5" data-section="flights">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                    <Plane className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-foreground">Flights</h3>
                    <p className="text-xs text-muted-foreground">
                      {hasFlightData ? `${allFlightLegs.length} flight${allFlightLegs.length > 1 ? 's' : ''} added` : 'Add your flight details'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {hasFlightData && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setEditFlightOpen(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  {flightCost > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-serif text-base sm:text-xl font-semibold text-foreground">{formatCurrency(displayCost(flightCost), tripCurrency)}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {hasFlightData ? (
                <div className="space-y-3">
                  {/* Route chain for multi-city */}
                  {allFlightLegs.length > 2 && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/5 rounded-lg px-3 py-2 overflow-x-auto">
                      <Plane className="h-3.5 w-3.5 shrink-0" />
                      <span className="whitespace-nowrap">
                        {[allFlightLegs[0]?.departure?.airport || '?', ...allFlightLegs.map(l => l.arrival?.airport || '?')].join(' → ')}
                      </span>
                    </div>
                  )}

                  <SortableFlightLegCards
                    legs={allFlightLegs as any}
                    startDate={startDate}
                    endDate={endDate}
                    isEditable={effectiveIsEditable}
                    onReorder={handleReorderFlightLegs as any}
                    onMarkLeg={handleMarkFlightLeg}
                    getAirportDisplay={getAirportDisplaySync}
                    renderBoardingPass={(path) => <BoardingPassViewButton storagePath={path} />}
                  />
                </div>
              ) : (
                /* Empty State - Add Flight CTA */
                <div className="rounded-xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                    <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Plane className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h4 className="font-medium text-foreground mb-1">No flights added yet</h4>
                      <p className="text-sm text-muted-foreground">Book your flight anywhere, then add the details here to sync your itinerary.</p>
                    </div>
                    <Button 
                      onClick={() => {
                        // Trigger the AddFlightInline dialog
                        const btn = document.querySelector('[data-add-flight-trigger]') as HTMLButtonElement;
                        btn?.click();
                      }}
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Flight
                    </Button>
                  </div>
                  {/* Hidden AddFlightInline for the dialog */}
                  <div className="hidden">
                    <AddFlightInline
                      key={tripId}
                      tripId={tripId}
                      destination={destination}
                      startDate={startDate}
                      endDate={endDate}
                      travelers={travelers}
                      origin={originCity}
                      onFlightAdded={onBookingAdded}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* HOTEL SECTION - Editorial Style (Multi-hotel aware) */}
            <section className="space-y-5" data-section="hotels">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                    <Hotel className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base sm:text-lg font-semibold text-foreground">Accommodation</h3>
                    <p className="text-xs text-muted-foreground">
                      {allHotels && allHotels.length > 0
                        ? `${allHotels.length} ${allHotels.length === 1 ? 'city' : 'cities'}`
                        : hotelSelection?.name ? `${hotelSelection.nights || Math.max(1, expectedTotalDays - 1)} nights` : 'Where you\'ll stay'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!allHotels?.length && hotelSelection?.name && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setEditHotelOpen(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  {hotelCost > 0 && !allHotels?.length && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-serif text-base sm:text-xl font-semibold text-foreground">{formatCurrency(displayCost(hotelCost), tripCurrency)}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Multi-city hotels */}
              {allHotels && allHotels.length > 0 ? (
                <div className="space-y-3">
                  {allHotels.map((cityHotel, idx) => {
                    // Transport icon helper
                    const getTransportIcon = (type?: string) => {
                      switch (type) {
                        case 'flight': return <Plane className="h-3.5 w-3.5" />;
                        case 'train': return <Train className="h-3.5 w-3.5" />;
                        case 'bus': return <Bus className="h-3.5 w-3.5" />;
                        case 'car': return <Car className="h-3.5 w-3.5" />;
                        case 'ferry': return <Ship className="h-3.5 w-3.5" />;
                        default: return <ArrowRight className="h-3.5 w-3.5" />;
                      }
                    };
                    const getTransportLabel = (type?: string) => {
                      switch (type) {
                        case 'flight': return 'Flight';
                        case 'train': return 'Train';
                        case 'bus': return 'Bus';
                        case 'car': return 'Drive';
                        case 'ferry': return 'Ferry';
                        default: return 'Transfer';
                      }
                    };

                    return (
                      <div key={idx}>
                        {/* Inter-city transport card (shown before city 2+) */}
                        {idx > 0 && (cityHotel.transportType || allHotels[idx - 1]) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (cityHotel.cityId) {
                                setTransportEditorCity({
                                  cityId: cityHotel.cityId,
                                  fromCity: allHotels[idx - 1].cityName,
                                  toCity: cityHotel.cityName,
                                  transportType: cityHotel.transportType,
                                  transportDetails: cityHotel.transportDetails,
                                  transportCostCents: cityHotel.transportCostCents,
                                  transportCurrency: cityHotel.transportCurrency,
                                });
                                setTransportEditorOpen(true);
                              }
                            }}
                          className="w-full flex items-center gap-3 py-3 px-4 my-2 rounded-xl border border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-colors text-left group"
                          >
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              {getTransportIcon(cityHotel.transportType)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                <span>{allHotels[idx - 1].cityName}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span>{cityHotel.cityName}</span>
                                <span className="text-[10px] font-normal text-muted-foreground ml-1">
                                  ({getTransportLabel(cityHotel.transportType)})
                                </span>
                              </div>
                              {(cityHotel.transportDetails?.carrier || cityHotel.transportDetails?.flightNumber || cityHotel.transportDetails?.departureTime) ? (
                                <div className="space-y-0.5 mt-1">
                                  {/* Line 1: Carrier + number */}
                                  {(cityHotel.transportDetails?.carrier || cityHotel.transportDetails?.flightNumber) && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-foreground/80">
                                      {cityHotel.transportDetails?.carrier && (
                                        <span className="font-medium">{cityHotel.transportDetails.carrier as string}</span>
                                      )}
                                      {cityHotel.transportDetails?.flightNumber && (
                                        <span className="text-muted-foreground">{cityHotel.transportDetails.flightNumber as string}</span>
                                      )}
                                    </div>
                                  )}
                                  {/* Line 2: Times + duration */}
                                  {(cityHotel.transportDetails?.departureTime || cityHotel.transportDetails?.arrivalTime) && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      {cityHotel.transportDetails?.departureTime && (
                                        <span>{cityHotel.transportDetails.departureTime as string}</span>
                                      )}
                                      {cityHotel.transportDetails?.departureTime && cityHotel.transportDetails?.arrivalTime && (
                                        <ArrowRight className="h-2.5 w-2.5" />
                                      )}
                                      {cityHotel.transportDetails?.arrivalTime && (
                                        <span>{cityHotel.transportDetails.arrivalTime as string}</span>
                                      )}
                                      {cityHotel.transportDetails?.duration && (
                                        <span className="ml-1 text-muted-foreground/70">({cityHotel.transportDetails.duration as string})</span>
                                      )}
                                    </div>
                                  )}
                                  {/* Line 3: Station/airport info */}
                                  {((cityHotel.transportDetails as any)?.departureStation || (cityHotel.transportDetails as any)?.departureAirport) && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                                      <span>{((cityHotel.transportDetails as any)?.departureStation || (cityHotel.transportDetails as any)?.departureAirport) as string}</span>
                                      <ArrowRight className="h-2 w-2" />
                                      <span>{((cityHotel.transportDetails as any)?.arrivalStation || (cityHotel.transportDetails as any)?.arrivalAirport) as string}</span>
                                    </div>
                                  )}
                                  {/* Line 4: Booking ref + seat */}
                                  {(cityHotel.transportDetails?.bookingRef || (cityHotel.transportDetails as any)?.seatNumber) && (
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                                      {cityHotel.transportDetails?.bookingRef && (
                                        <span>Ref: {cityHotel.transportDetails.bookingRef as string}</span>
                                      )}
                                      {(cityHotel.transportDetails as any)?.seatNumber && (
                                        <span>Seat: {(cityHotel.transportDetails as any).seatNumber as string}</span>
                                      )}
                                      {cityHotel.transportDetails?.seatClass && (
                                        <span>({cityHotel.transportDetails.seatClass as string})</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-[11px] text-primary/70 mt-0.5 group-hover:text-primary transition-colors">
                                  Tap to add {getTransportLabel(cityHotel.transportType)?.toLowerCase() || 'transport'} details
                                </div>
                              )}
                            </div>
                            {cityHotel.transportCostCents && cityHotel.transportCostCents > 0 ? (
                              <div className="text-right shrink-0">
                                <span className="text-xs font-medium text-primary">
                                  {formatCurrency(cityHotel.transportCostCents / 100, cityHotel.transportCurrency || 'USD')}
                                </span>
                              </div>
                            ) : (
                              <Edit3 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                            )}
                          </button>
                        )}

                        {/* City hotel card */}
                        <div className="rounded-xl border border-border bg-card overflow-hidden">
                          {/* City header */}
                          <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-b border-border">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm text-foreground">{cityHotel.cityName}</span>
                              {cityHotel.checkInDate && cityHotel.checkOutDate && (
                                <span className="text-xs text-muted-foreground">
                                  {safeFormatDate(cityHotel.checkInDate, 'MMM d')} → {safeFormatDate(cityHotel.checkOutDate, 'MMM d')}
                                  {cityHotel.nights ? ` · ${cityHotel.nights} nights` : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          {cityHotel.hotel?.name ? (
                            <div className="p-4 space-y-3">
                              <div className="flex items-start gap-3">
                                {/* Hotel image thumbnail */}
                                <div className="h-16 w-16 rounded-lg bg-muted/30 overflow-hidden shrink-0">
                                  {(() => {
                                    const thumbSrc = getHotelHeroImage(cityHotel.hotel);
                                    return thumbSrc ? (
                                      <img
                                        src={thumbSrc}
                                        alt={cityHotel.hotel.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Hotel className="h-6 w-6 text-muted-foreground/30" />
                                      </div>
                                    );
                                  })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-foreground truncate">{cityHotel.hotel.name}</h4>
                                  {cityHotel.hotel.rating && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star key={star} className={cn("h-3 w-3", star <= Math.floor(cityHotel.hotel!.rating || 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")} />
                                      ))}
                                    </div>
                                  )}
                                  {cityHotel.hotel.address && (
                                    <p className="text-xs text-muted-foreground mt-1 truncate">{cityHotel.hotel.address}</p>
                                  )}
                                </div>
                                {cityHotel.hotel.pricePerNight && (
                                  <div className="text-right shrink-0">
                                    <p className="text-xs text-muted-foreground">per night</p>
                                    <p className="font-medium text-primary text-sm">${cityHotel.hotel.pricePerNight}</p>
                                  </div>
                                )}
                              </div>

                              {/* Check-in/out times */}
                              <div className="flex gap-2">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 text-xs">
                                  <span className="text-muted-foreground">In:</span>
                                  <span className="font-medium">{cityHotel.hotel.checkIn || '3:00 PM'}</span>
                                </div>
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 text-xs">
                                  <span className="text-muted-foreground">Out:</span>
                                  <span className="font-medium">{cityHotel.hotel.checkOut || '11:00 AM'}</span>
                                </div>
                              </div>

                              {/* Airport-to-Hotel Transfer */}
                              {cityHotel.hotel?.name && (
                                <AirportHotelTransfer
                                  tripId={tripId}
                                  cityId={cityHotel.cityId}
                                  origin={idx === 0 ? (flightSelection?.outbound?.arrival?.airport || '') : ''}
                                  destination={cityHotel.hotel.address || `${cityHotel.hotel.name}, ${cityHotel.cityName}`}
                                  city={cityHotel.cityName}
                                  airportCode={idx === 0 ? (flightSelection?.outbound?.arrival?.airport || undefined) : undefined}
                                  hotelName={cityHotel.hotel.name}
                                  travelers={travelers}
                                  existingSelection={cityHotel.arrivalTransfer || null}
                                  onTransferSelected={() => onBookingAdded?.()}
                                />
                              )}
                            </div>
                          ) : (
                            /* No hotel for this city */
                            <div className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <Search className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-muted-foreground">No hotel selected for {cityHotel.cityName}</p>
                                </div>
                                <AddHotelInline
                                  tripId={tripId}
                                  destination={cityHotel.cityName}
                                  startDate={cityHotel.checkInDate || startDate}
                                  endDate={cityHotel.checkOutDate || endDate}
                                  travelers={travelers}
                                  onHotelAdded={onBookingAdded}
                                  cityId={cityHotel.cityId}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : hotelSelection?.name ? (
                <div className="rounded-xl border border-border bg-card overflow-hidden group">
                  {/* Hotel Image Header */}
                  <div 
                    className="relative h-36 sm:h-48 bg-muted/30 cursor-pointer overflow-hidden" 
                    onClick={() => {
                      if (hotelSelection?.images && hotelSelection.images.length > 0) {
                        setHotelGalleryOpen(true);
                      }
                    }}
                  >
                    {(() => {
                      const heroSrc = getHotelHeroImage(hotelSelection);
                      return (
                        <>
                          <div className="absolute inset-0 flex items-center justify-center bg-secondary/50">
                            <Hotel className="h-12 w-12 text-muted-foreground/30" />
                          </div>
                          {heroSrc && (
                            <img
                              src={heroSrc}
                              alt={hotelSelection.name || 'Hotel'}
                              className="relative w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                        </>
                      );
                    })()}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    
                    {hotelSelection?.images && hotelSelection.images.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setHotelGalleryOpen(true);
                        }}
                        className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Images className="h-3 w-3" />
                        {hotelSelection.images.length}
                      </button>
                    )}
                    
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h4 className="font-serif text-base sm:text-xl font-semibold text-white mb-1">{hotelSelection.name}</h4>
                      {hotelSelection.rating && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} className={cn("h-3.5 w-3.5", star <= Math.floor(hotelSelection.rating || 0) ? "text-amber-400 fill-amber-400" : "text-white/30")} />
                            ))}
                          </div>
                          <span className="text-white/80 text-xs">{hotelSelection.rating}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 text-sm">
                        <span className="text-muted-foreground">Check-in:</span>
                        <span className="font-medium">{hotelSelection.checkIn || '3:00 PM'}</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 text-sm">
                        <span className="text-muted-foreground">Check-out:</span>
                        <span className="font-medium">{hotelSelection.checkOut || '11:00 AM'}</span>
                      </div>
                      {startDate && endDate && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{safeFormatDate(startDate, 'MMM d', startDate)} – {safeFormatDate(endDate, 'MMM d', endDate)}</span>
                        </div>
                      )}
                      {hotelSelection.pricePerNight && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-sm border border-primary/10">
                          <span className="font-medium text-primary">${hotelSelection.pricePerNight}/night</span>
                        </div>
                      )}
                      {(hotelSelection as any).roomType && (
                        <Badge variant="secondary" className="text-xs">
                          {(hotelSelection as any).roomType}
                        </Badge>
                      )}
                    </div>
                    {hotelSelection.pricePerNight && days.length > 1 && (
                      <div className="text-sm text-muted-foreground">
                        ${hotelSelection.pricePerNight}/night × {Math.max(1, expectedTotalDays - 1)} nights = <strong className="text-foreground">${(hotelSelection.pricePerNight * Math.max(1, expectedTotalDays - 1)).toLocaleString()}</strong>
                      </div>
                    )}
                    
                    {hotelSelection.address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{hotelSelection.address}</span>
                      </div>
                    )}
                    
                    {hotelSelection.amenities && hotelSelection.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {hotelSelection.amenities.slice(0, 6).map((amenity, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs font-normal">
                            {amenity}
                          </Badge>
                        ))}
                        {hotelSelection.amenities.length > 6 && (
                          <Badge variant="outline" className="text-xs font-normal">
                            +{hotelSelection.amenities.length - 6}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {(hotelSelection.website || hotelSelection.googleMapsUrl) && (
                      <div className="flex items-center gap-2 pt-3 border-t border-border">
                        <a
                          href={hotelSelection.website || hotelSelection.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-secondary/50 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {hotelSelection.website ? (() => { try { return new URL(hotelSelection.website!).hostname.replace('www.', ''); } catch { return 'Website'; } })() : 'Maps'}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Empty State - Add Hotel CTA */
                <div className="rounded-xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                    <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Hotel className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h4 className="font-medium text-foreground mb-1">No accommodation added</h4>
                      <p className="text-sm text-muted-foreground">Find AI-matched hotels or add your existing reservation details.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <AddHotelInline
                        tripId={tripId}
                        destination={destination}
                        startDate={startDate}
                        endDate={endDate}
                        travelers={travelers}
                        onHotelAdded={onBookingAdded}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>
            </>
            )}
          </motion.div>
        )}

        {activeTab === 'needtoknow' && (
          <motion.div
            key="needtoknow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <NeedToKnowSection
              destination={destination}
              destinationCountry={destinationCountry}
              destinationInfo={destinationInfo}
            />
          </motion.div>
        )}

        {activeTab === 'collab' && collaborators.length > 0 && (
          <motion.div
            key="collab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Suggestions & Voting */}
            <div className="space-y-3">
              <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Suggestions & Voting
              </h3>
              <TripSuggestions tripId={tripId} tripType="consumer" />
            </div>

            {/* Group Chat */}
            <div className="space-y-3">
              <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Group Chat
              </h3>
              <div className="border rounded-xl bg-card h-[400px]">
                <TripChat tripId={tripId} tripType="consumer" />
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Guided Assist Dialog - shows after 3 regenerations */}
      <RegenerateGuidedAssistDialog
        isOpen={showGuidedAssist}
        onClose={() => {
          setShowGuidedAssist(false);
          setGuidedAssistDayIndex(null);
        }}
        onSubmit={handleGuidedAssistSubmit}
        dayNumber={guidedAssistDayIndex !== null ? days[guidedAssistDayIndex]?.dayNumber || guidedAssistDayIndex + 1 : 1}
        destination={destination}
      />

      {/* Add Activity Modal */}
      <AddActivityModal
        isOpen={!!addActivityModal}
        onClose={() => setAddActivityModal(null)}
        onAdd={(activity) => {
          if (addActivityModal) {
            handleAddActivity(addActivityModal.dayIndex, activity);
            setAddActivityModal(null);
          }
        }}
        currency={tripCurrency}
        destination={destination}
        prevActivity={(() => {
          if (!addActivityModal) return null;
          const dayActivities = days[addActivityModal.dayIndex]?.activities;
          if (!dayActivities) return null;
          const insertIdx = addActivityModal.afterIndex ?? dayActivities.length - 1;
          const prev = dayActivities[insertIdx];
          if (!prev) return null;
          return { title: prev.title || '', startTime: prev.startTime || prev.time, endTime: prev.endTime, duration: prev.duration, location: prev.location };
        })()}
        nextActivity={(() => {
          if (!addActivityModal) return null;
          const dayActivities = days[addActivityModal.dayIndex]?.activities;
          if (!dayActivities) return null;
          const insertIdx = addActivityModal.afterIndex ?? dayActivities.length - 1;
          const next = dayActivities[insertIdx + 1];
          if (!next) return null;
          return { title: next.title || '', startTime: next.startTime || next.time, endTime: next.endTime, duration: next.duration, location: next.location };
        })()}
      />

      {/* Edit Activity Modal */}
      <EditActivityModal
        isOpen={!!editActivityModal}
        activity={editActivityModal?.activity || null}
        onClose={() => setEditActivityModal(null)}
        onSave={(updates) => {
          if (editActivityModal) {
            handleUpdateActivity(editActivityModal.dayIndex, editActivityModal.activityIndex, updates);
          }
        }}
        currency={tripCurrency}
        venueBank={venueBank}
        tripId={tripId}
      />

      {/* Discover Nearby Drawer */}
      <DiscoverDrawer
        isOpen={discoverDrawerOpen}
        onClose={() => setDiscoverDrawerOpen(false)}
        destination={destination}
        destinationCountry={destinationCountry}
        archetype={style}
        tripCurrency={tripCurrency}
        currentDay={selectedDayIndex >= 0 && days[selectedDayIndex] ? {
          dayNumber: days[selectedDayIndex].dayNumber,
          activities: (days[selectedDayIndex].activities || []).map(a => ({
            title: a.title || '',
            category: a.category || '',
            time: a.startTime || a.time || '',
            location: typeof a.location === 'string' ? a.location : a.location?.name || '',
          })),
        } : undefined}
        onAddActivity={(activity) => {
          if (selectedDayIndex >= 0) {
            handleAddActivity(selectedDayIndex, activity);
          }
        }}
      />

      {/* Import Activities Modal */}
      <ImportActivitiesModal
        isOpen={!!importModal}
        onClose={() => setImportModal(null)}
        onImport={handleImportActivities}
        currency={tripCurrency}
        days={days.map(d => ({
          dayNumber: d.dayNumber,
          city: d.city,
          activities: d.activities.map(a => ({ title: a.title, startTime: a.startTime })),
        }))}
        initialDayIndex={importModal?.dayIndex ?? 0}
      />

      {/* Time Edit Modal */}
      <TimeEditModal
        isOpen={!!timeEditModal}
        activity={timeEditModal?.activity || null}
        onClose={() => { setTimeEditModal(null); setPendingCascade(null); }}
        onSave={(startTime, endTime, cascade) => {
          if (timeEditModal) {
            handleUpdateActivityTime(timeEditModal.dayIndex, timeEditModal.activityIndex, startTime, endTime, cascade);
          }
        }}
      />

      {/* Cascade Overflow Confirmation Dialog */}
      <AlertDialog open={!!pendingCascade} onOpenChange={(open) => {
        if (!open) {
          // C-TOOL-4: dismissing the dialog (Esc / click-away) also cancels the add —
          // refund the charge. Idempotent server-side, safe alongside the Cancel button.
          const c = pendingCascade;
          if (c?.source === 'add_activity' && c.charge) {
            refundCredits({
              tripId,
              originalAction: 'add_activity',
              originalIdempotencyKey: c.charge.idempotencyKey,
              pendingChargeId: c.charge.pendingChargeId,
              reason: 'cascade_dismissed',
            }).catch(() => { /* best-effort */ });
          }
          setPendingCascade(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule overflow</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {(pendingCascade?.dropped.length ?? 0) > 0 && (
                  <>
                    <p className="mb-2">
                      Shifting the schedule would remove <strong>{pendingCascade?.dropped.length}</strong> activit{pendingCascade?.dropped.length === 1 ? 'y' : 'ies'} that no longer fit before midnight:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {pendingCascade?.dropped.map((act) => (
                        <li key={act.id}>{act.title || 'Untitled activity'}</li>
                      ))}
                    </ul>
                  </>
                )}
                {(pendingCascade?.truncated?.length ?? 0) > 0 && (
                  <div className={pendingCascade?.dropped.length ? 'mt-3' : ''}>
                    <p className="mb-2 text-amber-600 dark:text-amber-400">
                      {pendingCascade!.truncated.length === 1 ? 'This activity' : 'These activities'} will be shortened to fit before midnight:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-amber-600 dark:text-amber-400">
                      {pendingCascade!.truncated.map((act: any) => (
                        <li key={act.id}>
                          {act.title || 'Untitled'}: {act.durationMinutes} min (was {act.__originalDurationMinutes} min)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              // C-TOOL-4: refund the add-activity charge on cancel — the activity is NOT
              // added, so the user must not be billed. Server dedups by pendingChargeId,
              // so the parallel onOpenChange dismiss can't double-refund.
              const c = pendingCascade;
              if (c?.source === 'add_activity' && c.charge) {
                refundCredits({
                  tripId,
                  originalAction: 'add_activity',
                  originalIdempotencyKey: c.charge.idempotencyKey,
                  pendingChargeId: c.charge.pendingChargeId,
                  reason: 'cascade_cancelled',
                }).catch(() => { /* best-effort */ });
              }
              setPendingCascade(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!pendingCascade) return;
                const { dayIndex, kept, source } = pendingCascade;
                // Save version snapshot for undo
                const day = days[dayIndex];
                if (tripId && day) {
                  await saveDayVersion(tripId, {
                    dayNumber: day.dayNumber,
                    title: day.title,
                    theme: day.theme,
                    activities: day.activities as any,
                  }, 'before_cascade');
                  await refreshUndoState();
                }
                // Apply the cascade
                let nextDays: EditorialDay[] = [];
                setDays(prev => {
                  nextDays = prev.map((d, idx) => {
                    if (idx !== dayIndex) return d;
                    return { ...d, activities: kept };
                  });
                  return nextDays;
                });
                setHasChanges(true);
                if (source === 'time_edit') {
                  setTimeEditModal(null);
                  toast.success('Schedule shifted');
                } else {
                  setAddActivityModal(null);
                  setNeedsOptimization(true);
                  toast.success('Activity added!');
                }
                if (pendingCascade.dropped.length > 0) {
                  toast.info(`${pendingCascade.dropped.length} activit${pendingCascade.dropped.length === 1 ? 'y was' : 'ies were'} removed. Use Undo to restore.`);
                }
                // Warn about truncated activities
                (pendingCascade.truncated || []).forEach((a: any) => {
                  toast.warning(`"${a.title}" shortened to ${a.durationMinutes} min (was ${a.__originalDurationMinutes} min) to fit before midnight`);
                });
                setPendingCascade(null);

                // Persist immediately for time_edit cascades so the change survives refresh.
                if (source === 'time_edit' && tripId) {
                  try {
                    const { safeUpdateItineraryData } = await import('@/services/safeUpdateItineraryData');
                    const itineraryToPersist: Record<string, unknown> = {
                      days: JSON.parse(JSON.stringify(nextDays)),
                      status: 'ready',
                      optionSelections,
                      savedAt: new Date().toISOString(),
                    };
                    if (parsedMetadata) {
                      itineraryToPersist.metadata = { ...parsedMetadata, lastUpdated: new Date().toISOString() };
                    }
                    const res = await safeUpdateItineraryData(tripId, itineraryToPersist, {}, { allowFrozenWrite: true, reason: 'user-editor-save' });
                    if (res?.error) throw res.error;
                    setHasChanges(false);
                    setLastSaved(new Date());
                  } catch (err) {
                    console.warn('[time-edit cascade] persist failed:', err);
                  }
                }
              }}
            >
              Shift anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Activity Confirmation Dialog */}
      <AlertDialog open={!!pendingRemove} onOpenChange={(open) => { if (!open) setPendingRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove activity?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{pendingRemove?.activityTitle}</strong> from Day {pendingRemove ? pendingRemove.dayIndex + 1 : ''}? You can undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmActivityRemove}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      
      <HotelGalleryModal
        isOpen={hotelGalleryOpen}
        onClose={() => setHotelGalleryOpen(false)}
        images={hotelSelection?.images || []}
        hotelName={hotelSelection?.name}
      />

      {/* Edit Flight Dialog */}
      {editFlightOpen && (
        <Dialog open={editFlightOpen} onOpenChange={setEditFlightOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                Edit Flight Details
              </DialogTitle>
            </DialogHeader>
            <AddFlightInline
              key={`edit-${tripId}`}
              tripId={tripId}
              destination={destination}
              startDate={startDate}
              endDate={endDate}
              travelers={travelers}
              origin={originCity}
              onFlightAdded={() => {
                setEditFlightOpen(false);
                onBookingAdded?.();
              }}
              editMode={true}
              existingLegs={allFlightLegs.length > 0 ? allFlightLegs.map((leg, i) => ({
                airline: leg.airline || '',
                flightNumber: leg.flightNumber || '',
                departureAirport: leg.departure?.airport || '',
                arrivalAirport: leg.arrival?.airport || '',
                departureTime: leg.departure?.time || '',
                arrivalTime: leg.arrival?.time || '',
                departureDate: leg.departure?.date || (i === 0 ? startDate : i === allFlightLegs.length - 1 ? endDate : ''),
                price: leg.price,
                seatNumber: leg.seat || '',
                confirmationCode: leg.confirmationCode || '',
                cabinClass: leg.cabinClass || '',
                terminal: leg.terminal || '',
                gate: leg.gate || '',
                baggageInfo: leg.baggageInfo || '',
                isDestinationArrival: leg.isDestinationArrival || undefined,
                isDestinationDeparture: leg.isDestinationDeparture || undefined,
              })) : undefined}
              multiCityRoute={buildFlightOnlyRoute(allHotels, originCity, startDate, endDate)}
              existingOutbound={!allFlightLegs.length && flightSelection?.outbound ? {
                airline: flightSelection.outbound.airline || '',
                flightNumber: flightSelection.outbound.flightNumber || '',
                departureAirport: flightSelection.outbound.departure?.airport || '',
                arrivalAirport: flightSelection.outbound.arrival?.airport || '',
                departureTime: flightSelection.outbound.departure?.time || '',
                arrivalTime: flightSelection.outbound.arrival?.time || '',
                departureDate: flightSelection.outbound.departure?.date || startDate,
              } : undefined}
              existingReturn={!allFlightLegs.length && flightSelection?.return ? {
                airline: flightSelection.return.airline || '',
                flightNumber: flightSelection.return.flightNumber || '',
                departureAirport: flightSelection.return.departure?.airport || '',
                arrivalAirport: flightSelection.return.arrival?.airport || '',
                departureTime: flightSelection.return.departure?.time || '',
                arrivalTime: flightSelection.return.arrival?.time || '',
                departureDate: flightSelection.return.departure?.date || endDate,
              } : undefined}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Add Flight Dialog (accessible from any tab) */}
      {addFlightDialogOpen && (
        <Dialog open={addFlightDialogOpen} onOpenChange={setAddFlightDialogOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                Add Flight Details
              </DialogTitle>
            </DialogHeader>
            <AddFlightInline
              key={`add-inline-${tripId}`}
              tripId={tripId}
              destination={destination}
              startDate={startDate}
              endDate={endDate}
              travelers={travelers}
              origin={originCity}
              onFlightAdded={() => {
                setAddFlightDialogOpen(false);
                onBookingAdded?.();
              }}
              multiCityRoute={buildFlightOnlyRoute(allHotels, originCity, startDate, endDate)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Hotel Dialog */}
      {editHotelOpen && (
        <Dialog open={editHotelOpen} onOpenChange={setEditHotelOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Hotel className="h-5 w-5 text-primary" />
                Edit Hotel Details
              </DialogTitle>
            </DialogHeader>
            <AddHotelInline
              tripId={tripId}
              destination={destination}
              startDate={startDate}
              endDate={endDate}
              travelers={travelers}
              onHotelAdded={() => {
                setEditHotelOpen(false);
                onBookingAdded?.();
              }}
              editMode={true}
              existingHotel={hotelSelection?.name ? {
                name: hotelSelection.name,
                address: hotelSelection.address || '',
                neighborhood: '',
                checkInTime: hotelSelection.checkInTime || '15:00',
                checkOutTime: hotelSelection.checkOutTime || '11:00',
                totalPrice: hotelSelection.totalPrice,
              } : undefined}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Inter-city Transport Editor */}
      {transportEditorCity && (
        <InterCityTransportEditor
          open={transportEditorOpen}
          onOpenChange={(open) => {
            setTransportEditorOpen(open);
            if (!open) setTransportEditorCity(null);
          }}
          fromCity={transportEditorCity.fromCity}
          toCity={transportEditorCity.toCity}
          transportType={transportEditorCity.transportType}
          transportDetails={transportEditorCity.transportDetails as any}
          transportCostCents={transportEditorCity.transportCostCents}
          transportCurrency={transportEditorCity.transportCurrency}
          saving={updateCityTransport.isPending}
          onSave={(data) => {
            updateCityTransport.mutate({
              cityId: transportEditorCity.cityId,
              transportType: data.transportType,
              transportDetails: data.transportDetails as any,
              transportCostCents: data.transportCostCents,
              currency: data.currency,
            }, {
              onSuccess: async () => {
                setTransportEditorOpen(false);
                setTransportEditorCity(null);
                toast.success('Transport details saved');
                onBookingAdded?.();

                // Cascade transport changes to itinerary
                try {
                  const { runCascadeAndPersist } = await import('@/services/cascadeTransportToItinerary');
                  const { data: tripData } = await supabase
                    .from('trips')
                    .select('itinerary_data, flight_selection')
                    .eq('id', tripId)
                    .single();
                  const itDays = (tripData?.itinerary_data as any)?.days;
                  if (itDays?.length) {
                    const { getTripCities } = await import('@/services/tripCitiesService');
                    const cities = await getTripCities(tripId);
                    await runCascadeAndPersist(tripId, itDays, tripData?.flight_selection, cities);
                  }
                } catch (cascadeErr) {
                  console.warn('[cascade] Inter-city transport cascade skipped:', cascadeErr);
                }
              },
              onError: (err) => {
                toast.error('Failed to save transport details');
              },
            });
          }}
        />
      )}

      {/* Version History Drawer */}
      <VersionHistoryDrawer
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        versions={versions}
        isLoading={isLoadingVersions}
        isRestoring={isUndoing}
        onLoadVersions={loadVersionHistory}
        onRestore={handleRestoreVersion}
        dayNumber={selectedDay?.dayNumber ?? 1}
      />

      <ActivityAlternativesDrawer
        open={swapDrawerOpen}
        onClose={() => {
          setSwapDrawerOpen(false);
          setSwapTarget(null);
          setSwapDrawerActivity(null);
        }}
        activity={swapDrawerActivity}
        destination={destination}
        existingActivities={days.flatMap(day => day.activities.map(a => a.title).filter(Boolean))}
        onSelectAlternative={handleSelectSwapAlternative}
      />

      {/* AI Concierge Sheet */}
      {conciergeActivity && (
        <ActivityConciergeSheet
          open={conciergeOpen}
          onClose={() => {
            setConciergeOpen(false);
            setConciergeActivity(null);
          }}
          activity={{
            id: conciergeActivity.id,
            title: conciergeActivity.title,
            description: conciergeActivity.description,
            category: conciergeActivity.category || conciergeActivity.type,
            startTime: conciergeActivity.startTime || conciergeActivity.time,
            endTime: conciergeActivity.endTime,
            cost: conciergeActivity.cost,
            location: conciergeActivity.location,
            imageUrl: (() => {
              const p = conciergeActivity.photos;
              if (!p || p.length === 0) return undefined;
              const first = p[0];
              return typeof first === 'string' ? first : first?.url;
            })(),
            bookingRequired: conciergeActivity.bookingRequired,
            bookingUrl: conciergeActivity.bookingUrl || conciergeActivity.website,
            // Source aiNotes from live `days` so the sheet reflects post-save state
            aiNotes: (() => {
              for (const day of days) {
                const live = day.activities?.find(a => a.id === conciergeActivity.id);
                if (live) return live.aiNotes || [];
              }
              return conciergeActivity.aiNotes || [];
            })(),
          }}
          dayDate={conciergeDayDate}
          dayTitle={conciergeDayTitle}
          previousActivity={conciergePrevActivity}
          nextActivity={conciergeNextActivity}
          destination={destination}
          tripType={tripType}
          totalDays={days.length}
          travelers={travelers}
          currency={destinationInfo?.currency || 'USD'}
          hotelName={hotelSelection?.name}
          onSaveNote={handleSaveAINote}
          savedNoteContents={conciergeSavedNoteContents}
        />
      )}

      <ReviewsDrawer
        open={reviewsDrawerOpen}
        onClose={() => {
          setReviewsDrawerOpen(false);
          setReviewsTarget(null);
        }}
        placeName={reviewsTarget?.placeName || ''}
        destination={destination}
        placeType={reviewsTarget?.placeType}
        activityRating={reviewsTarget?.activityRating}
        activityReviewCount={reviewsTarget?.activityReviewCount}
      />

      {/* Restaurant Search Drawer */}
      <RestaurantSearchDrawer
        open={restaurantDrawerOpen}
        onClose={() => {
          setRestaurantDrawerOpen(false);
          setSwapTarget(null);
          setSwapDrawerActivity(null);
        }}
        activity={swapDrawerActivity}
        destination={destination}
        mealType={restaurantDrawerMealType}
        onSelectRestaurant={handleSelectSwapAlternative}
      />

      {/* Share Trip Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Share & Manage Trip
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Collaborators Panel */}
            <TripCollaboratorsPanel
              tripId={tripId}
              ownerName={tripPermission?.isOwner ? 'You' : undefined}
              ownerEmail={tripPermission?.isOwner ? user?.email : undefined}
              ownerAvatarUrl={tripPermission?.isOwner ? user?.avatar : undefined}
              onInviteClick={handleCreateShareLink}
              onMemberAdded={(memberName) => {
                toast.success(`${memberName} added to the trip!`, {
                  description: `We've highlighted activities that match ${memberName}'s interests.`,
                  action: {
                    label: `Add activities for ${memberName}`,
                    onClick: () => {
                      setNewlyAddedMember(memberName);
                    },
                  },
                  duration: 10000,
                });
                // Refresh collaborator color map
                refetchCollaborators?.();
              }}
            />

            {/* Group Budget Pool Display */}
            <GroupBudgetDisplay
              tripId={tripId}
              onTopUp={() => {
                setShowShareModal(false);
                setTimeout(() => setShowGroupUnlockModal(true), 600);
              }}
            />

            {/* Guest Edit Mode Toggle - only for owner */}
            {tripPermission?.isOwner && (
              <div className="pt-4 border-t border-border space-y-3">
                <label className="text-sm font-medium">Guest Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setGuestEditMode('free_edit')}
                    disabled={isUpdatingEditMode}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors",
                      guestEditMode === 'free_edit'
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    <Edit3 className="h-4 w-4" />
                    <span className="text-xs font-medium">Edit Freely</span>
                    <span className="text-[10px] text-muted-foreground">Guests can change the itinerary directly</span>
                  </button>
                  <button
                    onClick={() => setGuestEditMode('propose_approve')}
                    disabled={isUpdatingEditMode}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors",
                      guestEditMode === 'propose_approve'
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    <span className="text-xs font-medium">Propose & Vote</span>
                    <span className="text-[10px] text-muted-foreground">Guests propose, you approve with group voting</span>
                  </button>
                </div>
              </div>
            )}

             {/* Invite Link Section - only for owner */}
             {tripPermission?.isOwner && (
               <>
                 <div className="pt-4 border-t border-border space-y-2">
                   <label className="text-sm font-medium">Invite to Collaborate</label>
                   <p className="text-xs text-muted-foreground">Friends who accept will join as trip collaborators</p>
                   <div className="flex gap-2">
                     <Input
                       value={shareLink || 'Click to generate invite link...'}
                       readOnly
                       className="flex-1 text-sm"
                       onClick={!shareLink ? () => handleCreateShareLink() : undefined}
                     />
                     <Button 
                       onClick={async () => {
                         if (shareLink) {
                           await handleCreateShareLink();
                         } else {
                           handleCreateShareLink();
                         }
                       }}
                       disabled={isCreatingInvite}
                       className="gap-1.5"
                     >
                       {isCreatingInvite ? (
                         <RefreshCw className="h-4 w-4 animate-spin" />
                       ) : inviteCopied ? (
                         <Check className="h-4 w-4" />
                       ) : (
                         <Copy className="h-4 w-4" />
                       )}
                       {inviteCopied ? 'Copied!' : shareLink ? 'Copy' : 'Generate'}
                     </Button>
                   </div>
                   {inviteHealth?.success && (
                     <div className="flex items-center gap-2 text-xs text-muted-foreground">
                       <Check className="h-3 w-3 text-green-500" />
                       <span>Invite active</span>
                       <span>·</span>
                       <span>Expires in 30 days</span>
                     </div>
                   )}
                   {!inviteHealth && (
                     <p className="text-xs text-muted-foreground">
                       Invite link expires in 30 days.
                     </p>
                   )}
                   {/* Reset link button */}
                   {shareLink && (
                     <Button
                       variant="ghost"
                       size="sm"
                       className="text-xs h-7 text-muted-foreground hover:text-foreground"
                       onClick={() => handleCreateShareLink(true)}
                       disabled={isCreatingInvite}
                     >
                       <RefreshCw className="h-3 w-3 mr-1" />
                       Reset link (invalidates old link)
                     </Button>
                   )}
                 </div>

                {/* Share Guide to Social */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-3">Share your travel guide:</p>
                  <Button 
                    variant="default"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
                      setShowShareModal(false);
                      setShowShareGuideSheet(true);
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                    Share to Email, Text & Social Media
                  </Button>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick share modal — public read-only link first, collaborator invite secondary */}
      <TripShareModal
        isOpen={showQuickShareModal}
        onClose={() => setShowQuickShareModal(false)}
        tripId={tripId}
        tripName={`Trip to ${destination}`}
        destination={destination}
      />
      <Dialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Regenerate Itinerary
            </DialogTitle>
            <DialogDescription>
              This will rebuild your day-by-day schedule and pricing from scratch using your original trip settings.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">What's preserved:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Flights & hotels</li>
                <li>✓ Multi-city routing</li>
                <li>✓ Trip dates, travelers & preferences</li>
              </ul>
            </div>
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">What's replaced:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✗ Daily schedule & activities</li>
                <li>✗ Activity pricing</li>
              </ul>
            </div>
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm text-foreground">
                <span className="font-semibold">{regenerationCost} credits</span>
                <span className="text-muted-foreground"> ({days.length} days × 30 credits/day)</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateConfirm(false)}>Cancel</Button>
            <Button
              variant="default"
              onClick={() => {
                setShowRegenerateConfirm(false);
                handleRegenerateItinerary();
              }}
            >
              Regenerate ({regenerationCost} credits)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GroupUnlockModal
        isOpen={showGroupUnlockModal}
        onClose={() => setShowGroupUnlockModal(false)}
        tripId={tripId}
        collaboratorCount={collaborators.length}
        creditsAvailable={totalCredits}
      />

      {/* Share Guide Sheet - Email, SMS, Social */}
      <ShareGuideSheet
        open={showShareGuideSheet}
        onClose={() => setShowShareGuideSheet(false)}
        shareLink={shareLink || ''}
        destination={destination}
        onGenerateLink={handleCreateShareLink}
      />

      {/* Optimize Preferences Dialog */}
      <OptimizePreferencesDialog
        open={showOptimizeDialog}
        onOpenChange={setShowOptimizeDialog}
        onConfirm={handleOptimize}
        isOptimizing={isOptimizing}
        creditCost={routeOptCost.cost}
        isFirstTrip={routeOptCost.isFirstTrip}
        userBalance={totalCredits}
        isSpending={spendCredits.isPending}
      />

      {/* Route Optimization Upgrade Prompt */}
      <UpgradePrompt
        isOpen={showRouteUpgrade}
        onClose={() => setShowRouteUpgrade(false)}
        featureName="route optimization"
        context="route"
         tripId={tripId}
      />

      {/* Refresh Day results sheet — surfaces refresh-day diagnostics + accept/reject */}
      <RefreshDaySheet
        open={refreshSheetDay !== null && !!refreshResults[refreshSheetDay]}
        onOpenChange={(open) => {
          if (!open) setRefreshSheetDay(null);
        }}
        result={refreshSheetDay !== null ? refreshResults[refreshSheetDay] || null : null}
        onAcceptAll={(changes) => {
          if (refreshSheetDay === null) return;
          const idx = days.findIndex((d: any) => d.dayNumber === refreshSheetDay);
          if (idx >= 0) handleApplyRefreshChanges(idx, changes);
        }}
        onAcceptSelected={(changes) => {
          if (refreshSheetDay === null) return;
          const idx = days.findIndex((d: any) => d.dayNumber === refreshSheetDay);
          if (idx >= 0) handleApplyRefreshChanges(idx, changes);
        }}
      />
      
    </div>
  );
}

// =============================================================================
// DESTINATION IMAGE COMPONENTS (Static images - no carousel)
// =============================================================================
// Helper to normalize destination strings (remove IATA codes like "(FCO)")


// =============================================================================
// AIRPORT GAME PLAN COMPONENT
// =============================================================================


// =============================================================================
// DAY CARD COMPONENT
// =============================================================================


// Old inline AddActivityModal removed — now imported from ./AddActivityModal

// =============================================================================
// TIME EDIT MODAL
// =============================================================================


// Credit top-up prompt wrapper for the component
function EditorialItineraryWithCreditPrompt(props: EditorialItineraryProps) {
  return <EditorialItinerary {...props} />;
}

export default EditorialItinerary;
