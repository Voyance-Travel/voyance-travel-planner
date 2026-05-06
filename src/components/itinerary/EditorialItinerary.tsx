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
import { convertFromUSD, convertToUSD, formatCurrency, rateDisclosure } from '@/lib/currency';
import { toFriendlyError } from '@/utils/friendlyErrors';
import { enrichAttraction, lookupActivityUrl } from '@/services/enrichmentService';
import { useCredits } from '@/hooks/useCredits';
import { CREDIT_COSTS, formatCredits } from '@/config/pricing';
import { CreditNudge } from './CreditNudge';
import { UnlockBanner } from './UnlockBanner';
import { LockedDayCard } from './LockedDayCard';
import { TripTotalDeltaIndicator } from './TripTotalDeltaIndicator';
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
import { getActivityFallbackImage } from '@/utils/activityFallbackImages';
import { parseEditorialDays } from '@/utils/itineraryParser';
import { getAppUrl } from '@/utils/getAppUrl';
import { resolveInviteLink, getInviteErrorMessage, type InviteHealth } from '@/services/inviteResolver';

import { BlendRecalcBanner } from './BlendRecalcBanner';
import AirlineLogo from '@/components/planner/shared/AirlineLogo';
import { useRefreshDay, type RefreshResult, type ProposedChange } from '@/hooks/useRefreshDay';
import { RefreshDayDiffView } from './RefreshDayDiffView';
import ActivityAlternativesDrawer from '@/components/planner/ActivityAlternativesDrawer';
import { RegenerateGuidedAssistDialog } from './RegenerateGuidedAssistDialog';
import { WeatherForecast } from './WeatherForecast';
import { preloadCostIndex, estimateCostSync, isLikelyFreePublicVenue } from '@/lib/cost-estimation';
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
import { TransitGapIndicator, computeGapMinutes } from './TransitGapIndicator';
import { DayRouteMap } from './DayRouteMap';
import { useManualBuilderStore } from '@/stores/manual-builder-store';
import { useActionCap } from '@/hooks/useActionCap';
import { useTripVenueBank } from '@/hooks/useTripVenueBank';
import { AddActivityModal } from './AddActivityModal';
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

// =============================================================================
// BOARDING PASS VIEW BUTTON (inline helper)
// =============================================================================

function BoardingPassViewButton({ storagePath }: { storagePath: string }) {
  const handleView = async () => {
    try {
      const { data } = await supabase.storage
        .from('boarding-passes')
        .createSignedUrl(storagePath, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch {
      console.error('Failed to open boarding pass');
    }
  };
  return (
    <button
      onClick={handleView}
      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
    >
      <FileText className="h-3 w-3" />
      Boarding Pass
    </button>
  );
}

// =============================================================================
// TYPES
// =============================================================================

export interface EditorialActivity {
  id: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  time?: string; // For backward compatibility
  duration?: string;
  durationMinutes?: number;
  category?: string;
  type?: ActivityType;
  cost?: { amount: number; currency: string };
  estimatedCost?: { amount: number; currency: string }; // Fallback from AI generation
  location?: { name?: string; address?: string; lat?: number; lng?: number };
  rating?: { value: number; totalReviews: number } | number;
  tags?: string[];
  bookingRequired?: boolean;
  tips?: string;
  photos?: Array<{ url: string } | string>;
  transportation?: {
    method: string;
    duration: string;
    distance?: string;
    estimatedCost?: { amount: number; currency: string };
    instructions?: string;
  };
  timeBlockType?: string;
  isLocked?: boolean;
  website?: string;
  bookingUrl?: string; // External booking URL for affiliate links
  viatorProductCode?: string; // Viator product code for API bookings
  // Booking state fields
  bookingState?: BookingItemState;
  quotePriceCents?: number;
  quoteExpiresAt?: string;
  quoteLocked?: boolean;
  confirmationNumber?: string;
  voucherUrl?: string;
  voucherData?: {
    voucherCode?: string;
    voucherUrl?: string;
    qrCode?: string;
    redemptionInstructions?: string;
  };
  cancellationPolicy?: {
    deadline: string;
    refundPercentage: number;
    description: string;
  };
  travelerData?: TravelerInfo[];
  vendorName?: string;
  bookedAt?: string;
  cancelledAt?: string;
  /** User ID of the collaborator this activity was suggested for (group trips) */
  suggestedFor?: string;
  /** Founder-curated Voyance Pick */
  isVoyancePick?: boolean;
  /** Option group fields for parsed either/or activities */
  isOption?: boolean;
  optionGroup?: string;
  // Intelligence fields from AI generation
  isHiddenGem?: boolean;
  hasTimingHack?: boolean;
  bestTime?: string;
  crowdLevel?: string;
  voyanceInsight?: string;
  contextualTips?: ContextualTip[];
  personalization?: {
    whyThisFits?: string;
    tags?: string[];
    confidence?: number;
  };
  /** Placeholder activity that needs a real recommendation */
  needsRefinement?: boolean;
  /** Saved AI concierge notes */
  aiNotes?: import('./ActivityConciergeSheet').AISavedNote[];
}

export interface TransportOption {
  id: string;
  mode: 'train' | 'flight' | 'bus' | 'car' | 'ferry';
  operator: string;
  emoji?: string;
  inTransitDuration: string;
  doorToDoorDuration: string;
  cost: {
    perPerson: number;
    total: number;
    currency: string;
    includesTransfers?: boolean;
  };
  departure: { point: string; neighborhood?: string };
  arrival: { point: string; neighborhood?: string };
  pros: string[];
  cons: string[];
  bookingTip?: string;
  bookingUrl?: string;
  bookingWebsite?: string;
  scenicOpportunities?: string[];
  isRecommended: boolean;
  recommendationReason?: string;
}

export interface EditorialDay {
  dayNumber: number;
  date?: string;
  title?: string;
  theme?: string;
  description?: string;
  activities: EditorialActivity[];
  weather?: {
    condition?: string;
    high?: number;
    low?: number;
  };
  estimatedWalkingTime?: string;
  estimatedDistance?: string;
  metadata?: {
    isPreview?: boolean;
    isLocked?: boolean;
    [key: string]: unknown;
  };
  // Multi-city / transition day fields
  city?: string;
  country?: string;
  isTransitionDay?: boolean;
  transitionFrom?: string;
  transitionTo?: string;
  transportComparison?: TransportOption[];
  selectedTransportId?: string;
  // Departure day fields
  isDepartureDay?: boolean;
  departureTo?: string;
  departureTransportType?: string;
  departureTransportDetails?: Record<string, unknown>;
}

export interface FlightLegDisplay {
  airline?: string;
  airlineCode?: string;
  flightNumber?: string;
  departure?: { time?: string; airport?: string; date?: string };
  arrival?: { time?: string; airport?: string; date?: string };
  price?: number;
  cabinClass?: string;
  seat?: string;
  duration?: string;
  confirmationCode?: string;
  terminal?: string;
  gate?: string;
  baggageInfo?: string;
  boardingPassUrl?: string;
  frequentFlyerNumber?: string;
  isDestinationArrival?: boolean;
  isDestinationDeparture?: boolean;
}

export interface FlightSelection {
  outbound?: FlightLegDisplay;
  return?: FlightLegDisplay;
  /** All legs for multi-city trips — preferred over outbound/return when present */
  legs?: FlightLegDisplay[];
}

export interface HotelSelection {
  id?: string;
  name?: string;
  address?: string;
  rating?: number;
  pricePerNight?: number;
  nights?: number;
  checkIn?: string;
  checkOut?: string;
  checkInDate?: string;
  checkOutDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  imageUrl?: string;
  images?: string[];
  amenities?: string[];
  type?: string;
  reviewCount?: number;
  neighborhood?: string;
  description?: string;
  website?: string;
  googleMapsUrl?: string;
  totalPrice?: number;
}

/** Per-city hotel info for multi-city trips */
export interface CityHotelInfo {
  cityName: string;
  cityOrder: number;
  checkInDate?: string;
  checkOutDate?: string;
  nights?: number;
  hotel?: HotelSelection | null;
  cityId?: string; // trip_cities row id for hotel search targeting
  // Inter-city transport info
  transportType?: 'flight' | 'train' | 'bus' | 'car' | 'ferry';
  transportDetails?: {
    carrier?: string;
    flightNumber?: string;
    departureTime?: string;
    arrivalTime?: string;
    bookingRef?: string;
    seatClass?: string;
    duration?: string;
    notes?: string;
  };
  transportCostCents?: number;
  transportCurrency?: string;
  // Airport-hotel transfer selections
  arrivalTransfer?: SelectedTransfer | null;
  departureTransfer?: SelectedTransfer | null;
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
  /** Trip health/completion panel passed from TripDetail */
  tripHealthPanel?: React.ReactNode;
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

function formatTime(time: string | undefined): string {
  if (!time || typeof time !== 'string') return '';
  
  // Strip any non-ASCII characters (e.g. stray Chinese/Unicode from AI output)
  const cleanTime = time.replace(/[^\x00-\x7F]/g, '').trim();
  if (!cleanTime) return '';
  
  if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(cleanTime)) {
    return cleanTime;
  }
  
  const match = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return cleanTime;
  
  const hours = parseInt(match[1], 10);
  const minutes = match[2];
  
  if (isNaN(hours)) return cleanTime;
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

/** Strip stray non-ASCII characters from AI-generated text fields */
function sanitizeAiText(text: string | undefined): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g, '').trim();
}

/** Fuzzy location match — handles "Mandarin Oriental, Marrakech" vs "Mandarin Oriental" vs "Mandarin" */
function isFuzzyLocationMatch(
  a?: { name?: string; address?: string } | null,
  b?: { name?: string; address?: string } | null,
): boolean {
  if (!a || !b) return false;
  if (a.name && b.name && a.name === b.name) return true;
  if (a.address && b.address && a.address === b.address) return true;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (a.name && b.name) {
    const an = normalize(a.name);
    const bn = normalize(b.name);
    if (an.length >= 4 && bn.length >= 4 && (an.includes(bn) || bn.includes(an))) return true;
  }
  return false;
}

// FX rates, conversion helpers, and `formatCurrency` are imported at the top
// of this file from `@/lib/currency` — the shared module ensures this header
// and the Budget tab always render the same converted value.

function normalizeCurrencyCode(input: unknown): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();

  // Common symbols / names → ISO 4217 codes
  const map: Record<string, string> = {
    '$': 'USD',
    'USD': 'USD',
    'US DOLLAR': 'USD',
    'DOLLAR': 'USD',

    '€': 'EUR',
    'EUR': 'EUR',
    'EURO': 'EUR',

    '£': 'GBP',
    'GBP': 'GBP',
    'POUND': 'GBP',
    'POUNDS': 'GBP',

    '¥': 'JPY',
    'JPY': 'JPY',
    'YEN': 'JPY',
  };

  return map[upper] ?? (upper.length === 3 ? upper : null);
}

function inferCurrencyFromCountry(country?: string): string | null {
  if (!country) return null;
  const c = country.trim().toLowerCase();

  const eurozone = new Set([
    'austria', 'belgium', 'croatia', 'cyprus', 'estonia', 'finland', 'france',
    'germany', 'greece', 'ireland', 'italy', 'latvia', 'lithuania', 'luxembourg',
    'malta', 'netherlands', 'portugal', 'slovakia', 'slovenia', 'spain', 'andorra',
    'monaco', 'san marino', 'vatican', 'vatican city', 'kosovo', 'montenegro',
  ]);

  if (eurozone.has(c)) return 'EUR';

  // Broad country → currency map
  const countryMap: Record<string, string> = {
    'united kingdom': 'GBP', 'uk': 'GBP', 'england': 'GBP', 'scotland': 'GBP', 'wales': 'GBP', 'northern ireland': 'GBP',
    'united states': 'USD', 'usa': 'USD', 'us': 'USD',
    'japan': 'JPY',
    'canada': 'CAD',
    'australia': 'AUD',
    'new zealand': 'NZD',
    'switzerland': 'CHF',
    'china': 'CNY',
    'south korea': 'KRW', 'korea': 'KRW',
    'india': 'INR',
    'mexico': 'MXN',
    'brazil': 'BRL',
    'argentina': 'ARS',
    'colombia': 'COP',
    'chile': 'CLP',
    'peru': 'PEN',
    'thailand': 'THB',
    'vietnam': 'VND',
    'indonesia': 'IDR', 'bali': 'IDR',
    'malaysia': 'MYR',
    'philippines': 'PHP',
    'singapore': 'SGD',
    'taiwan': 'TWD',
    'hong kong': 'HKD',
    'turkey': 'TRY', 'türkiye': 'TRY',
    'south africa': 'ZAR',
    'egypt': 'EGP',
    'morocco': 'MAD',
    'kenya': 'KES',
    'tanzania': 'TZS',
    'nigeria': 'NGN',
    'ghana': 'GHS',
    'israel': 'ILS',
    'jordan': 'JOD',
    'united arab emirates': 'AED', 'uae': 'AED',
    'saudi arabia': 'SAR',
    'qatar': 'QAR',
    'oman': 'OMR',
    'bahrain': 'BHD',
    'kuwait': 'KWD',
    'iceland': 'ISK',
    'norway': 'NOK',
    'sweden': 'SEK',
    'denmark': 'DKK',
    'poland': 'PLN',
    'czech republic': 'CZK', 'czechia': 'CZK',
    'hungary': 'HUF',
    'romania': 'RON',
    'bulgaria': 'BGN',
    'russia': 'RUB',
    'ukraine': 'UAH',
    'sri lanka': 'LKR',
    'nepal': 'NPR',
    'cambodia': 'KHR',
    'myanmar': 'MMK', 'burma': 'MMK',
    'laos': 'LAK',
    'pakistan': 'PKR',
    'bangladesh': 'BDT',
    'costa rica': 'CRC',
    'panama': 'PAB',
    'cuba': 'CUP',
    'jamaica': 'JMD',
    'dominican republic': 'DOP',
    'guatemala': 'GTQ',
    'uruguay': 'UYU',
    'paraguay': 'PYG',
    'bolivia': 'BOB',
    'ecuador': 'USD',
    'fiji': 'FJD',
    'maldives': 'MVR',
    'mauritius': 'MUR',
    'seychelles': 'SCR',
  };

  return countryMap[c] ?? null;
}

function inferCurrencyFromDays(days: EditorialDay[]): string | null {
  const counts = new Map<string, number>();

  for (const day of days) {
    for (const act of day.activities ?? []) {
      const cur = normalizeCurrencyCode((act as any)?.cost?.currency);
      // Skip USD since backend normalizes all costs to USD — it doesn't reflect actual local currency
      if (cur && cur !== 'USD') counts.set(cur, (counts.get(cur) ?? 0) + 1);
    }
  }

  let best: { cur: string; n: number } | null = null;
  for (const [cur, n] of counts.entries()) {
    if (!best || n > best.n) best = { cur, n };
  }
  return best?.cur ?? null;
}

// Smart cost estimation by category when no explicit cost is provided
// Base costs are per-person, will be multiplied by travelers
const CATEGORY_COST_ESTIMATES: Record<string, { base: number; budgetMod: Record<string, number> }> = {
  // Dining
  breakfast: { base: 18, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  brunch: { base: 28, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  lunch: { base: 22, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  dinner: { base: 45, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  dining: { base: 35, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.6, splurge: 2.2 } },
  coffee: { base: 8, budgetMod: { budget: 0.7, moderate: 1, luxury: 1.3, splurge: 1.5 } },
  cafe: { base: 12, budgetMod: { budget: 0.7, moderate: 1, luxury: 1.4, splurge: 1.8 } },
  // Activities
  museum: { base: 20, budgetMod: { budget: 0.8, moderate: 1, luxury: 1.2, splurge: 1.5 } },
  cultural: { base: 25, budgetMod: { budget: 0.7, moderate: 1, luxury: 1.3, splurge: 1.6 } },
  sightseeing: { base: 15, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.4, splurge: 1.8 } },
  tour: { base: 50, budgetMod: { budget: 0.5, moderate: 1, luxury: 1.6, splurge: 2.2 } },
  activity: { base: 30, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  adventure: { base: 75, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.4, splurge: 1.8 } },
  // Relaxation
  spa: { base: 100, budgetMod: { budget: 0.5, moderate: 1, luxury: 1.8, splurge: 3.0 } },
  relaxation: { base: 40, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.6, splurge: 2.5 } },
  beach: { base: 10, budgetMod: { budget: 0.8, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  // Shopping/Entertainment
  shopping: { base: 50, budgetMod: { budget: 0.4, moderate: 1, luxury: 2.0, splurge: 3.5 } },
  entertainment: { base: 40, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  nightlife: { base: 60, budgetMod: { budget: 0.5, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  // Transport/Other
  transportation: { base: 25, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  transport: { base: 20, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  accommodation: { base: 0, budgetMod: { budget: 1, moderate: 1, luxury: 1, splurge: 1 } }, // Usually bundled
};

function estimateCostByCategory(
  category: string | undefined,
  travelers: number = 1,
  budgetTier: string = 'moderate'
): number {
  const cat = (category || 'activity').toLowerCase();
  
  // Find matching category (check for partial matches too)
  let estimate = CATEGORY_COST_ESTIMATES[cat];
  if (!estimate) {
    // Check for partial matches in title keywords
    for (const [key, val] of Object.entries(CATEGORY_COST_ESTIMATES)) {
      if (cat.includes(key) || key.includes(cat)) {
        estimate = val;
        break;
      }
    }
  }
  
  // Default fallback
  if (!estimate) {
    estimate = { base: 25, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } };
  }
  
  const budgetMultiplier = estimate.budgetMod[(budgetTier || 'moderate').toLowerCase()] || 1;
  const baseCost = estimate.base * budgetMultiplier;
  
  // Add 20% for tip/tax on dining categories
  const isDining = ['breakfast', 'brunch', 'lunch', 'dinner', 'dining', 'coffee', 'cafe'].includes(cat);
  const withTax = isDining ? baseCost * 1.2 : baseCost;
  
  // Multiply by travelers and round
  const total = withTax * travelers;
  const isTransportCategory = ['transportation', 'transport', 'transfer'].includes(cat);
  return isTransportCategory
    ? Math.round(total)        // Transport: round to nearest $1
    : Math.round(total / 5) * 5; // Everything else: round to nearest $5
}

type CostBasis = 'per_person' | 'flat';

interface CostInfo {
  amount: number;
  isEstimated: boolean;
  estimateReason?: string;
  confidence?: 'high' | 'medium' | 'low';
  basis: CostBasis;
}

/**
 * Get activity cost with defensible estimation using destination_cost_index
 * Uses synchronous version for immediate rendering - cache preloaded on component mount
 */
// Categories that should NEVER show as "Free" - always estimate if cost is 0
const NEVER_FREE_CATEGORIES = [
  'dining', 'restaurant', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee',
  'cruise', 'boat', 'tour', 'activity', 'experience', 'spa', 'massage', 'show',
  'performance', 'concert', 'theater', 'theatre', 'nightlife', 'bar', 'club',
  // Transport categories - airport transfers, taxis, etc. are never free
  'transfer', 'transport', 'transportation', 'airport', 'taxi', 'uber', 'rideshare',
  // Additional categories that should always have a cost
  'shopping', 'entertainment', 'cultural', 'attraction', 'museum', 'gallery',
  'market', 'cooking_class', 'workshop', 'adventure', 'excursion',
  'wine', 'tasting', 'snorkeling', 'diving', 'surfing', 'hiking_tour',
];

function isNeverFreeCategory(category: string, title: string): boolean {
  const cat = (category || '').toLowerCase();
  const titleLower = (title || '').toLowerCase();
  
  // Check category
  if (NEVER_FREE_CATEGORIES.some(nfc => cat.includes(nfc))) return true;
  
  // Check title for dining/meal keywords
  const neverFreeKeywords = [
    'breakfast', 'brunch', 'lunch', 'dinner', 'cruise', 'tour',
    'restaurant', 'café', 'cafe', 'transfer', 'airport', 'taxi',
    'uber', 'private car', 'shuttle',
    // Removed: 'train to', 'bus to' — public transit CAN be free (day pass, included transfer)
  ];
  if (neverFreeKeywords.some(kw => titleLower.includes(kw))) {
    return true;
  }
  
  return false;
}

/** Flat-rate categories: cost covers the whole group, not per-person */
const FLAT_RATE_KEYWORDS = [
  'transfer', 'taxi', 'uber', 'rideshare', 'private car', 'shuttle',
  'car rental', 'rental car', 'private tour', 'private guide',
  'accommodation', 'hotel', 'check-in', 'check-out', 'checkout',
];

function inferCostBasis(category: string, title: string): CostBasis {
  const cat = (category || '').toLowerCase();
  const t = (title || '').toLowerCase();
  // Explicit basis from backend
  if (FLAT_RATE_KEYWORDS.some(kw => cat.includes(kw) || t.includes(kw))) return 'flat';
  return 'per_person';
}

function getActivityCostInfo(
  activity: EditorialActivity,
  travelers: number = 1,
  budgetTier: string = 'moderate',
  destinationCity?: string,
  destinationCountry?: string,
  isManualMode: boolean = false
): CostInfo {
  const category = activity.category || activity.type || 'activity';
  const title = activity.title || '';
  
  // Walk connectors are always free — skip estimation entirely
  const catLower = (category || '').toLowerCase();
  const titleLower = (title || '').toLowerCase();
  const isWalk = ['walk', 'walking', 'stroll'].includes(catLower) ||
    /\bwalk\b|\bstroll\b|\bwalking\b/i.test(titleLower);
  if (isWalk) {
    // Walking is always free — override any AI-hallucinated cost
    return { amount: 0, isEstimated: false, confidence: 'high' as const, basis: 'flat' as CostBasis };
  }
  
  // Accommodation cards (check-in, checkout, freshen-up, return to hotel) are always Free
  // Hotel costs live in the Budget/Payments tabs — not on activity cards
  const isAccommodation = ['accommodation', 'hotel', 'stay'].includes(catLower) ||
    /check.?in|check.?out|checkout|freshen\s*up|return to .*(hotel|four|aman|ritz|hyatt|hilton|marriott|peninsula|mandarin|park|palace|st\.\s*regis|waldorf|conrad|w\s+hotel|shangri|intercontinental|westin|sheraton|fairmont|rosewood|banyan|six\s*senses|oberoi|taj\s|belmond)/i.test(titleLower);
  if (isAccommodation) {
    return { amount: 0, isEstimated: false, confidence: 'high' as const, basis: 'flat' as CostBasis };
  }
  
  // Free attractions — temples, shrines, gardens, crossings, parks, plazas, etc.
  // These should show "Free" instead of ~$50 estimation fallback
  const FREE_ATTRACTION_KEYWORDS = [
    'crossing', 'gardens', 'park', 'shrine', 'temple', 'plaza',
    'square', 'bridge', 'waterfront', 'promenade', 'boulevard',
    'viewpoint', 'lookout', 'market stroll', 'neighborhood walk',
    'imperial palace', 'east gardens', 'meiji jingu', 'senso-ji',
    'sensoji', 'fushimi inari', 'central park', 'hyde park',
  ];
  const looksLikelyFree = FREE_ATTRACTION_KEYWORDS.some(kw => titleLower.includes(kw)) &&
    ['sightseeing', 'explore', 'cultural', 'activity', 'attraction'].includes(catLower);
  
  // Also check the shared free-public-venue detector (catches praça, miradouro, jardim, etc.)
  const isFreePublicVenue = isLikelyFreePublicVenue({
    title,
    category,
    type: activity.type,
    locationName: activity.location?.name,
    address: activity.location?.address,
    description: (activity as any).description,
    venueName: (activity as any).venue_name,
    restaurantName: (activity as any).restaurant?.name,
    placeName: (activity as any).place_name,
  });

  if (isFreePublicVenue || (looksLikelyFree && !isNeverFreeCategory(category, title))) {
    return { amount: 0, isEstimated: false, confidence: 'medium' as const, basis: 'flat' as CostBasis };
  }
  
  const shouldNeverBeFree = isNeverFreeCategory(category, title);
  // Use explicit basis from backend if available, otherwise infer
  const basis: CostBasis = (activity as any).costBasis || (activity as any).cost?.basis || inferCostBasis(category, title);
  
  // Safely parse cost amount - handle null, NaN, undefined
  const rawCostAmount = activity.cost?.amount;
  const costAmount = (rawCostAmount !== null && rawCostAmount !== undefined && !isNaN(rawCostAmount))
    ? rawCostAmount : undefined;

  // Also check normalized root-level price fields preserved by the parser spread
  // These survive even when parseCost couldn't build a cost object
  const actAny = activity as any;
  const normalizedPrice = (() => {
    for (const field of ['price_per_person', 'estimated_price_per_person', 'price']) {
      const v = actAny[field];
      if (typeof v === 'number' && !isNaN(v)) return v;
    }
    return undefined;
  })();
  // If backend explicitly marked is_free, trust it
  if (actAny.is_free === true) {
    return { amount: 0, isEstimated: false, confidence: 'high' as const, basis: 'flat' as CostBasis };
  }
  
  // Check cost.amount first - this is explicit pricing from venue data
  // BUT if it's 0 and the category should never be free, fall through to estimation
  if (costAmount !== undefined && costAmount > 0) {
    return { amount: costAmount, isEstimated: false, confidence: 'high', basis };
  }
  
  // If cost is explicitly 0 and source is imported/user-override, respect it as-is
  if (costAmount === 0 && ((activity as any).costSource === 'imported' || (activity as any).costSource === 'user_override')) {
    return { amount: 0, isEstimated: false, confidence: 'high', basis };
  }
  // In manual (Build It Myself) mode, trust user's data — never auto-estimate
  if (isManualMode && costAmount === 0) {
    return { amount: 0, isEstimated: false, confidence: 'high' as const, basis };
  }
  // If cost is explicitly 0 but category should never be free, skip to estimation
  if (costAmount === 0 && shouldNeverBeFree) {
    // Fall through to estimation engine below
  } else if (costAmount === 0) {
    // Truly free activity (parks, viewpoints, walking tours, etc.)
    return { amount: 0, isEstimated: false, confidence: 'high', basis };
  }

  // Check normalized root-level price fields (e.g. price_per_person: 0 from backend)
  if (normalizedPrice !== undefined && normalizedPrice === 0 && !shouldNeverBeFree) {
    return { amount: 0, isEstimated: false, confidence: 'high', basis };
  }
  if (normalizedPrice !== undefined && normalizedPrice > 0 && costAmount === undefined) {
    return { amount: normalizedPrice, isEstimated: false, confidence: 'medium', basis };
  }
  
  // Check estimatedCost - AI-provided estimate during generation
  const rawEstAmount = activity.estimatedCost?.amount;
  const estAmount = (rawEstAmount !== null && rawEstAmount !== undefined && !isNaN(rawEstAmount))
    ? rawEstAmount : undefined;
    
  if (estAmount !== undefined && estAmount > 0) {
    return { 
      amount: estAmount, 
      isEstimated: true,
      estimateReason: 'AI-estimated based on venue type',
      confidence: 'medium',
      basis,
    };
  }
  
  // If estimatedCost is 0 but should never be free, fall through
  if (estAmount === 0 && shouldNeverBeFree) {
    // Fall through to estimation engine below
  } else if (estAmount === 0) {
    return { amount: 0, isEstimated: true, estimateReason: 'No cost expected', confidence: 'medium', basis };
  }
  
  // Use defensible cost estimation engine
  const priceLevel = (activity as any).priceLevel || (activity as any).price_level;
  
  const result = estimateCostSync({
    category,
    title, // Pass title for meal type inference (breakfast vs dinner)
    city: destinationCity,
    country: destinationCountry,
    travelers,
    budgetTier: budgetTier as 'budget' | 'moderate' | 'luxury',
    priceLevel: priceLevel ? Number(priceLevel) : undefined,
  });
  
  // Safety net: if estimation returned 0 for a never-free category, use minimum fallback
  const amount = (result.amount === 0 && shouldNeverBeFree) ? Math.max(10, travelers * 5) : result.amount;

  // estimateCostSync already multiplies per-person dining categories by travelers
  // (see src/lib/cost-estimation.ts line 285). Returning that group total with
  // basis 'per_person' would cause the card to (a) append a misleading "/pp"
  // suffix and (b) show a phantom "Group total: amount × travelers" tooltip.
  // Tag these as 'flat' so the UI treats the number as the final group total.
  const PER_PERSON_ENGINE_CATS = new Set([
    'dining', 'restaurant', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee'
  ]);
  const engineBasis: CostBasis = PER_PERSON_ENGINE_CATS.has((category || '').toLowerCase())
    ? 'flat'
    : basis;

  return { 
    amount, 
    isEstimated: result.isEstimated,
    estimateReason: result.reason || `Estimated for ${category} in ${destinationCity || 'this area'}`,
    confidence: result.confidence,
    basis: engineBasis,
  };
}

/** Short label for cost basis — always "/pp" for multi-guest trips for consistency */
function basisLabel(basis: CostBasis, travelers: number): string {
  if (travelers <= 1) return '';
  return '/pp';
}

function getActivityCost(
  activity: EditorialActivity,
  travelers: number = 1,
  budgetTier: string = 'moderate',
  destinationCity?: string,
  destinationCountry?: string,
  isManualMode: boolean = false
): number {
  return getActivityCostInfo(activity, travelers, budgetTier, destinationCity, destinationCountry, isManualMode).amount;
}

function getActivityType(activity: EditorialActivity): string {
  const raw = activity.category || activity.type || 'activity';
  return typeof raw === 'string' ? raw : String(raw);
}

function getActivityRating(activity: EditorialActivity): number | null {
  if (typeof activity.rating === 'number') return activity.rating;
  if (typeof activity.rating === 'object' && activity.rating?.value) return activity.rating.value;
  return null;
}

function getActivityReviewCount(activity: EditorialActivity): number | null {
  if (typeof activity.rating === 'object' && activity.rating?.totalReviews) {
    return activity.rating.totalReviews;
  }
  return null;
}

function getActivityPhoto(activity: EditorialActivity): string | null {
  // Prefer explicit image_url (set by writeback) over photos array
  const directUrl = (activity as any).image_url;
  if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('http')) return directUrl;
  if (!activity.photos || activity.photos.length === 0) return null;
  const photo = activity.photos[0];
  if (typeof photo === 'string') return photo;
  if (typeof photo === 'object' && photo.url) return photo.url;
  return null;
}

function getDayTotalCost(
  activities: EditorialActivity[], 
  travelers: number = 1, 
  budgetTier: string = 'moderate',
  destinationCity?: string,
  destinationCountry?: string,
  isManualMode: boolean = false
): number {
  // Only sum confirmed costs (not estimates) so day badges match the canonical Trip Total
  return activities.reduce((sum, act) => {
    const info = getActivityCostInfo(act, travelers, budgetTier, destinationCity, destinationCountry, isManualMode);
    return sum + (isManualMode ? info.amount : (info.isEstimated ? 0 : info.amount));
  }, 0);
}

// =============================================================================
// INTER-CITY TRANSPORT STRIP (compact single-row card)
// =============================================================================

function InterCityTransportStrip({
  activity,
  travelMeta,
  TransportIcon,
}: {
  activity: EditorialActivity;
  travelMeta: any;
  TransportIcon: React.ComponentType<{ className?: string }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasExpandableDetails = travelMeta.arrTime || travelMeta.seatInfo || travelMeta.bookingRef;

  return (
    <div className="px-2 sm:px-0 py-1">
      <div
        className={cn(
          "rounded-lg border border-primary/15 bg-primary/[0.03] px-3 py-2.5 group/transport",
          hasExpandableDetails && "cursor-pointer"
        )}
        onClick={hasExpandableDetails ? () => setExpanded(prev => !prev) : undefined}
      >
        {/* Single compact row */}
        <div className="flex items-center gap-2.5">
          {/* Transport icon in a tinted circle */}
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <TransportIcon className="h-3.5 w-3.5 text-primary" />
          </div>

          {/* Title + subtitle */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {activity.title}
            </p>
            {travelMeta.carrier && (
              <p className="text-[11px] text-muted-foreground truncate">
                {travelMeta.carrier}{travelMeta.flightNum ? ` ${travelMeta.flightNum}` : ''}
                {travelMeta.dur ? ` · ${travelMeta.dur}` : ''}
              </p>
            )}
            {!travelMeta.carrier && !travelMeta.depTime && (
              <p className="text-[11px] text-muted-foreground/60 italic truncate">
                Plan your transport details
              </p>
            )}
          </div>

          {/* Time pill */}
          {travelMeta.depTime && (
            <span className="text-xs font-semibold text-primary tabular-nums shrink-0">
              {travelMeta.depTime}
            </span>
          )}

          {/* Cost */}
          {travelMeta.price != null && travelMeta.price > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: travelMeta.currency || 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(travelMeta.price)}
            </span>
          )}

          {/* Collapse/expand chevron */}
          {hasExpandableDetails && (
            <ChevronDown className={cn(
              "h-3.5 w-3.5 text-muted-foreground/50 shrink-0 transition-transform duration-200",
              expanded && "rotate-180"
            )} />
          )}
        </div>

        {/* Expandable details */}
        {expanded && hasExpandableDetails && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-primary/10 text-[11px] text-muted-foreground">
            {travelMeta.depTime && travelMeta.arrTime && (
              <span>{travelMeta.depTime} → {travelMeta.arrTime}</span>
            )}
            {travelMeta.seatInfo && <span>Class: {travelMeta.seatInfo}</span>}
            {travelMeta.bookingRef && <span>Ref: {travelMeta.bookingRef}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

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
  tripHealthPanel,
  viewMode = 'edit',
}: EditorialItineraryProps) {
  const queryClient = useQueryClient();
  const isCleanPreview = viewMode === 'preview';
  const isActivelyGenerating = itineraryStatus === 'generating' || itineraryStatus === 'queued';

  const [rawDays, setRawDays] = useState<EditorialDay[]>(() =>
    initialDays.map(day => ({
      ...day,
      activities: (day.activities || [])
        .filter(a => a != null)
        .map(a => {
          const raw = a as any;
          const safeTitle = a.title || raw.name || raw.venue || 'Untitled Activity';
          return { ...a, title: safeTitle };
        }),
    }))
  );

  // Sanitize wrapper: ensures every activity has a valid title and filters out
  // completely empty/null activity objects that slip through from edge functions.
  const setDays: typeof setRawDays = useCallback((update) => {
    setRawDays(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      return next.map(day => ({
        ...day,
        activities: (day.activities || [])
          .filter(a => a != null)
          .map(a => {
            const raw = a as any;
            const safeTitle = a.title || raw.name || raw.venue || 'Untitled Activity';
            return { ...a, title: safeTitle };
          }),
      }));
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
            const { isLikelyFreePublicVenue: isFreeVenue, isPlaceholderDepartureTransfer } = await import('@/lib/cost-estimation');
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
          const synced = await syncActivitiesToCostTable(tripId, activitiesForCostTable);
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
    const GRAND_ENTRANCE_PREFIX = 'Your Grand Entrance dinner — ';
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
          // Keep all synthetic cards (transport, hotel, etc.)
          if ((act as any).__syntheticTravel || (act as any).__syntheticDeparture ||
              (act as any).__interCityTransport || (act as any).__hotelCheckout ||
              (act as any).__hotelCheckin ||
              act.id.startsWith('hotel-') || act.id.startsWith('departure-') ||
              act.id.startsWith('travel-')) {
            return true;
          }
          // Preserve AI-generated check-in/checkout/accommodation cards
          const tLower = (act.title || '').toLowerCase();
          const catLower = (act.category || '').toLowerCase();
          const isAccommodationCard = catLower === 'accommodation' ||
            tLower.includes('check-in') || tLower.includes('checkin') || tLower.includes('check in') ||
            tLower.includes('check-out') || tLower.includes('checkout') || tLower.includes('check out');
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
            tType = explicitMode
              || (flightNum ? 'flight' : (carrier && !(carrier || '').toLowerCase().includes('train') ? 'flight' : 'train'));
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
            // Preserve AI-generated check-in/checkout/accommodation cards
            const isAccommodationCard = catLower === 'accommodation' ||
              t.includes('check-in') || t.includes('checkin') || t.includes('check in') ||
              t.includes('check-out') || t.includes('checkout') || t.includes('check out');
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

  // Compute expected total days from start/end dates so we can show placeholders during generation
  const expectedTotalDays = useMemo(() => {
    if (!startDate || !endDate) return days.length;
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diff, days.length);
  }, [startDate, endDate, days.length]);
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
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null);

  // Sync days from parent when initialDays prop changes (e.g., from ItineraryAssistant apply)
  // Only sync if there are no unsaved local changes to avoid overwriting user edits
  // Use a content-based fingerprint instead of reference equality to avoid
  // false positives when the parent re-creates the array on every render.
  const initialDaysFingerprint = useMemo(() => {
    return JSON.stringify(initialDays.map(d => ({
      n: d.dayNumber,
      d: d.date,
      a: d.activities.map(a => a.id),
    })));
  }, [initialDays]);
  const prevFingerprintRef = useRef(initialDaysFingerprint);
  useEffect(() => {
    if (initialDaysFingerprint !== prevFingerprintRef.current) {
      prevFingerprintRef.current = initialDaysFingerprint;
      if (!hasChanges) {
        setDays(initialDays);
      }
    }
  }, [initialDaysFingerprint, hasChanges]);

  // Notify parent of local days changes so sibling components (e.g. ItineraryAssistant) stay in sync
  const daysFingerprint = useMemo(() => JSON.stringify(days.map(d => ({ n: d.dayNumber, a: d.activities.map(a => a.id) }))), [days]);
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

  // ── Day 1 auto-buffer ──────────────────────────────────────────────
  // Arrival day is the worst place to surface a "no travel buffer — Refresh
  // Day to fix timing" banner. When we detect zero/negative gaps between
  // non-locked, non-transport, non-same-venue activities on Day 1, silently
  // cascade a 15-min buffer forward so the banner never appears. Locked
  // (manual / extracted / pinned) activities anchor the cascade.
  const day1AutoBufferAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    const day = days[0];
    if (!day || !day.activities || day.activities.length < 2) return;
    const fp = day.activities.map(a => `${a.id}@${a.startTime || (a as any).time || ''}`).join('|');
    if (day1AutoBufferAppliedRef.current === fp) return;

    const REQ_BUFFER = 15;
    const isHHMM = (s?: string) => !!s && /^\d{1,2}:\d{2}$/.test(s);
    const acts = day.activities;
    let needsFix = false;
    for (let i = 0; i < acts.length - 1; i++) {
      const a = acts[i] as any;
      const b = acts[i + 1] as any;
      const catA = (a.category || '').toLowerCase();
      const catB = (b.category || '').toLowerCase();
      if (catA === 'transport' || catB === 'transport') continue;
      if (a.location?.name && b.location?.name && a.location.name === b.location.name) continue;
      const gap = computeGapMinutes(a.endTime, a.startTime || a.time, a.duration, b.startTime || b.time);
      if (gap !== null && gap < REQ_BUFFER) { needsFix = true; break; }
    }
    if (!needsFix) {
      day1AutoBufferAppliedRef.current = fp;
      return;
    }

    setDays(prev => {
      if (!prev[0]) return prev;
      const dayActs = [...prev[0].activities];
      let mutated = false;
      for (let i = 0; i < dayActs.length - 1; i++) {
        const a = dayActs[i] as any;
        const b = dayActs[i + 1] as any;
        if (b.locked || b.isLocked) continue;
        const aEnd = a.endTime;
        const bStart = b.startTime || b.time;
        const bEnd = b.endTime;
        if (!isHHMM(aEnd) || !isHHMM(bStart)) continue;
        const catA = (a.category || '').toLowerCase();
        const catB = (b.category || '').toLowerCase();
        if (catA === 'transport' || catB === 'transport') continue;
        if (a.location?.name && b.location?.name && a.location.name === b.location.name) continue;

        const aEndMin = timeToMinutes(aEnd);
        const bStartMin = timeToMinutes(bStart);
        const minStart = aEndMin + REQ_BUFFER;
        if (bStartMin >= minStart) continue;

        const shift = minStart - bStartMin;
        const newStartMin = bStartMin + shift;
        let newEndMin: number | null = null;
        if (isHHMM(bEnd)) {
          newEndMin = timeToMinutes(bEnd) + shift;
          if (newEndMin > 23 * 60 + 30) continue;
        }
        dayActs[i + 1] = {
          ...b,
          startTime: minutesToTime(newStartMin),
          time: minutesToTime(newStartMin),
          ...(newEndMin !== null ? { endTime: minutesToTime(newEndMin) } : {}),
        };
        mutated = true;
      }
      if (!mutated) return prev;
      const next = [...prev];
      next[0] = { ...prev[0], activities: dayActs };
      return next;
    });
    day1AutoBufferAppliedRef.current = fp;
    setHasChanges(true);
  }, [days, setDays]);

  
  const handleRefreshDay = useCallback(async (dayIndex: number) => {
    const day = days[dayIndex];
    if (!day) return;
    setRefreshingDayNumber(day.dayNumber);
    const activities = day.activities.map(a => ({
      id: a.id,
      title: a.title || '',
      category: a.category,
      startTime: a.startTime || (a as any).time,
      endTime: a.endTime,
      location: a.location,
      operatingHours: (a as any).operatingHours,
      durationMinutes: a.durationMinutes,
      cost: a.cost,
    }));
    const result = await refreshDay(activities, day.date || '', destination, day.dayNumber);
    if (result) {
      setRefreshResults(prev => ({ ...prev, [day.dayNumber]: result }));
      const errorCount = result.issues.filter(i => i.severity === 'error').length;
      const warnCount = result.issues.filter(i => i.severity === 'warning').length;
      if (result.issues.length === 0) {
        toast.success(`Day ${day.dayNumber} validated, no issues found!`);
      } else {
        toast(`Day ${day.dayNumber}: ${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warnCount} warning${warnCount !== 1 ? 's' : ''}`, {
          icon: '⚠️',
        });
      }
    }
    setRefreshingDayNumber(null);
  }, [days, destination, refreshDay]);

  // Apply accepted refresh changes — patches activity startTime/endTime by ID
  const handleApplyRefreshChanges = useCallback((dayIndex: number, changes: ProposedChange[]) => {
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
      // Sort chronologically after applying time patches
      patchedActivities.sort((a, b) => {
        const parseMin = (t?: string) => {
          if (!t) return 9999;
          const parts = t.match(/(\d{1,2}):(\d{2})/);
          if (!parts) return 9999;
          return parseInt(parts[1]) * 60 + parseInt(parts[2]);
        };
        return parseMin(a.startTime || a.time) - parseMin(b.startTime || b.time);
      });
      return { ...day, activities: patchedActivities };
    }));
    setHasChanges(true);
    // Clear refresh results for this day
    const dayNum = days[dayIndex]?.dayNumber;
    if (dayNum) {
      setRefreshResults(prev => { const next = { ...prev }; delete next[dayNum]; return next; });
    }
    toast.success(`Applied ${changes.length} change${changes.length !== 1 ? 's' : ''} to Day ${dayNum || dayIndex + 1}`);
  }, [days]);
  
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
  const [showLocalCurrency, setShowLocalCurrency] = useState(true); // Currency display preference
  
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
    setConciergeDayTitle(day.title || day.theme || `Day ${day.dayNumber}`);
    // Find previous/next visible activities
    const actIdx = day.activities.findIndex(a => a.id === activity.id);
    const prev = actIdx > 0 ? day.activities[actIdx - 1] : undefined;
    const next = actIdx < day.activities.length - 1 ? day.activities[actIdx + 1] : undefined;
    setConciergePrevActivity(prev?.title);
    setConciergeNextActivity(next?.title);
    setConciergeOpen(true);
  }, [days]);

  // AI Note save/delete handlers
  const handleSaveAINote = useCallback((activityId: string, note: AISavedNote) => {
    setDays(prev => prev.map(day => ({
      ...day,
      activities: day.activities.map(act => {
        if (act.id !== activityId) return act;
        const existing = act.aiNotes || [];
        // Dedup by content
        if (existing.some(n => n.content === note.content)) return act;
        return { ...act, aiNotes: [...existing, note] };
      }),
    })));
    setHasChanges(true);
  }, []);

  const handleDeleteAINote = useCallback((activityId: string, noteId: string) => {
    setDays(prev => prev.map(day => ({
      ...day,
      activities: day.activities.map(act => {
        if (act.id !== activityId) return act;
        return { ...act, aiNotes: (act.aiNotes || []).filter(n => n.id !== noteId) };
      }),
    })));
    setHasChanges(true);
  }, []);

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
    await Promise.resolve(onBookingAdded?.());
  }, [flightSelection, tripId, onBookingAdded]);


  // Handle transport mode change for a specific activity route segment
  const handleTransportModeChange = useCallback(async (dayIndex: number, activityId: string, newMode: string) => {
    const day = days[dayIndex];
    const activity = day?.activities.find(a => a.id === activityId);
    if (!activity?.transportation) return;

    // Transport mode changes are free — no credit charge

    setChangingTransportActivityId(activityId);
    try {
      // Call optimize for just this single segment with the specified mode
      const activityIndex = day.activities.findIndex(a => a.id === activityId);
      const nextActivity = day.activities[activityIndex + 1];
      
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

      if (data?.days?.[0]) {
        // Update only the transport data for the changed activity
        const optimizedDay = data.days[0];
        setDays(prev => prev.map((d, idx) => {
          if (idx !== dayIndex) return d;
          return {
            ...d,
            activities: d.activities.map(act => {
              const optAct = optimizedDay.activities?.find((oa: any) => oa.id === act.id);
              if (optAct?.transportation && act.id === activityId) {
                const updatedAct = { ...act, transportation: { ...optAct.transportation, method: newMode } };
                const destMatch = (act.title || '').match(/^.+?\sto\s(.+)$/i);
                if (destMatch) {
                  const mLabels: Record<string, string> = { walking: 'Walk', walk: 'Walk', metro: 'Metro', bus: 'Bus', uber: 'Rideshare', taxi: 'Taxi', train: 'Train', subway: 'Metro', rideshare: 'Rideshare', car: 'Drive' };
                  const newTitle = `${mLabels[(newMode || '').toLowerCase()] || newMode} to ${destMatch[1]}`;
                  updatedAct.title = newTitle;
                  if (updatedAct.location) updatedAct.location = { ...updatedAct.location, name: newTitle };
                }
                return updatedAct;
              }
              // Fallback: optimize API returned data but no matching activity ID — apply local update
              if (act.id === activityId && act.transportation) {
                const mLabels: Record<string, string> = { walking: 'Walk', walk: 'Walk', metro: 'Metro', bus: 'Bus', uber: 'Rideshare', taxi: 'Taxi', train: 'Train', subway: 'Metro', rideshare: 'Rideshare', car: 'Drive' };
                const destMatch = (act.title || '').match(/^.+?\sto\s(.+)$/i);
                const newTitle = destMatch ? `${mLabels[(newMode || '').toLowerCase()] || newMode} to ${destMatch[1]}` : act.title;
                return {
                  ...act,
                  title: newTitle,
                  location: act.location ? { ...act.location, name: newTitle } : act.location,
                  transportation: { ...act.transportation, method: newMode },
                };
              }
              return act;
            }),
          };
        }));
        setHasChanges(true);
      } else {
        // Optimize call returned no data — apply mode change locally with default costs
        const modeCosts: Record<string, number> = {
          walk: 0, walking: 0, metro: 3, subway: 3, bus: 2,
          uber: 15, taxi: 20, rideshare: 12, car: 5,
        };
        setDays(prev => prev.map((d, idx) => {
          if (idx !== dayIndex) return d;
          return {
            ...d,
            activities: d.activities.map(act => {
              if (act.id !== activityId || !act.transportation) return act;
              const mLabels: Record<string, string> = { walking: 'Walk', walk: 'Walk', metro: 'Metro', bus: 'Bus', uber: 'Rideshare', taxi: 'Taxi', train: 'Train', subway: 'Metro', rideshare: 'Rideshare', car: 'Drive' };
              const destMatch = (act.title || '').match(/^.+?\sto\s(.+)$/i);
              const newTitle = destMatch ? `${mLabels[(newMode || '').toLowerCase()] || newMode} to ${destMatch[1]}` : act.title;
              return {
                ...act,
                title: newTitle,
                location: act.location ? { ...act.location, name: newTitle } : act.location,
                transportation: {
                  ...act.transportation,
                  method: newMode,
                  estimatedCost: {
                    amount: modeCosts[(newMode || '').toLowerCase()] ?? 0,
                    currency: act.transportation.estimatedCost?.currency || 'USD',
                  },
                },
              };
            }),
          };
        }));
        setHasChanges(true);
      }
      const modeLabels: Record<string, string> = {
        walking: 'Walk', walk: 'Walk', metro: 'Metro', bus: 'Bus',
        uber: 'Rideshare', taxi: 'Taxi', train: 'Train',
      };
      toast.success(`Updated to ${modeLabels[newMode] || newMode}`);
    } catch (err) {
      console.error('Transport mode change error:', err);
      // Optimize failed — apply mode change locally with default costs
      const modeCosts: Record<string, number> = {
        walk: 0, walking: 0, metro: 3, subway: 3, bus: 2,
        uber: 15, taxi: 20, rideshare: 12, car: 5,
      };
      setDays(prev => prev.map((d, idx) => {
        if (idx !== dayIndex) return d;
        return {
          ...d,
          activities: d.activities.map(act => {
            if (act.id !== activityId || !act.transportation) return act;
            const mLabels: Record<string, string> = { walking: 'Walk', walk: 'Walk', metro: 'Metro', bus: 'Bus', uber: 'Rideshare', taxi: 'Taxi', train: 'Train', subway: 'Metro', rideshare: 'Rideshare', car: 'Drive' };
            const destMatch = (act.title || '').match(/^.+?\sto\s(.+)$/i);
            const newTitle = destMatch ? `${mLabels[(newMode || '').toLowerCase()] || newMode} to ${destMatch[1]}` : act.title;
            return {
              ...act,
              title: newTitle,
              location: act.location ? { ...act.location, name: newTitle } : act.location,
              transportation: {
                ...act.transportation,
                method: newMode,
                estimatedCost: {
                  amount: modeCosts[(newMode || '').toLowerCase()] ?? 0,
                  currency: act.transportation.estimatedCost?.currency || 'USD',
                },
              },
            };
          }),
        };
      }));
      setHasChanges(true);
      const modeLabels: Record<string, string> = {
        walking: 'Walk', walk: 'Walk', metro: 'Metro', bus: 'Bus',
        uber: 'Rideshare', taxi: 'Taxi', train: 'Train',
      };
      toast.success(`Updated to ${modeLabels[newMode] || newMode} (estimated cost)`);
    } finally {
      setChangingTransportActivityId(null);
    }
  }, [days, isPaid, totalCredits, spendCredits, tripId, destination, transportCap]);
  // Get trip permission for current user
  const { data: tripPermission, isLoading: permissionLoading } = useTripPermission(tripId);
  const { data: collaborators = [], refetch: refetchCollaborators } = useTripCollaborators(tripId);
  const { data: tripMembers = [] } = useTripMembers(tripId);
  const { guestEditMode, isPropose, setGuestEditMode, isUpdating: isUpdatingEditMode } = useGuestEditMode(tripId);
  
  // Get budget settings to pass limit to PaymentsTab
  const { settings: budgetSettings } = useTripBudget({ tripId, totalDays: days.length, enabled: true });
  
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
  const { skippedItems } = useSkipList(destination);
  const valueStats = useMemo(() => calculateItineraryValueStats(days, skippedItems), [days, skippedItems]);

  // Dynamic itinerary validation - detect skip list violations and other issues
  const validationIssues = useMemo<ValidationIssue[]>(() => {
    const result = validateItinerary(days, {
      destination,
      tripType,
      celebrationDay,
      totalDays: days.length
    });
    return result.issues;
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

  // Scroll selected day button into view
  useEffect(() => {
    const btn = dayButtonRefs.current[selectedDayIndex];
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
      nextActivities.sort((a, b) => {
        const ta = parseMins(a.startTime || a.time) ?? 99999;
        const tb = parseMins(b.startTime || b.time) ?? 99999;
        return ta - tb;
      });

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
  const hotelCost = computeHotelCostUsd(allHotels as any, hotelSelection as any, days.length);
  
  // Use financial snapshot as the SOLE source of truth for trip total
  // This eliminates divergence between Trip Summary, Budget tab, and Payments tab
  const snapshotTotalUsd = financialSnapshot.tripTotalCents / 100;
  // Only fall back to JS calculation while snapshot is still loading (value = 0)
  // Once snapshot loads, it becomes the canonical total
  const totalCost = snapshotTotalUsd > 0
    ? snapshotTotalUsd
    : (totalActivityCost * (travelers || 1) + flightCost + hotelCost);

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

  // Dev guard: warn when day totals exceed trip total (indicates the snapshot
  // dropped rows the day breakdown still counts — e.g. orphan filter mismatch).
  useEffect(() => {
    if (financialSnapshot.loading || tripDayBreakdown.loading) return;
    if (financialSnapshot.tripTotalCents <= 0) return;
    if (daysSubtotalCents > financialSnapshot.tripTotalCents + 1) {
      // eslint-disable-next-line no-console
      console.warn('[EditorialItinerary] Day totals exceed trip total', {
        tripTotalCents: financialSnapshot.tripTotalCents,
        daysSubtotalCents,
        diffCents: daysSubtotalCents - financialSnapshot.tripTotalCents,
      });
    }
  }, [financialSnapshot.loading, financialSnapshot.tripTotalCents, daysSubtotalCents, tripDayBreakdown.loading]);

  // Derive local currency robustly (destinationInfo is often undefined on TripDetail)
  // IMPORTANT: If the trip is in the Eurozone, prefer EUR even if some upstream metadata is wrong.
  const countryCurrency = inferCurrencyFromCountry(destinationCountry);
  const destinationCurrency =
    normalizeCurrencyCode(destinationInfo?.currency) ||
    normalizeCurrencyCode(destinationInfo?.currencySymbol);
  const daysCurrency = inferCurrencyFromDays(days);

  // Also try to infer USD from destination string directly (e.g. "Austin, Texas", "New York, NY")
  const destLower = (destination || '').toLowerCase();
  const isUSDestination =
    countryCurrency === 'USD' ||
    destLower.includes('texas') || destLower.includes(', tx') ||
    destLower.includes(', ny') || destLower.includes(', ca') ||
    destLower.includes(', fl') || destLower.includes(', il') ||
    destLower.includes('united states') || destLower.includes(', usa') ||
    destLower.includes(', us');

  const localCurrency =
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
      duration: activity.duration || '2 hours',
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

    setDays(prev => {
      const updatedDays = prev.map((day, dIdx) => {
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
            duration: newActivity.duration,
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
      
      // Sync budget with updated days
      syncBudgetFromDays(updatedDays);
      return updatedDays;
    });

    setHasChanges(true);
    setSwapDrawerOpen(false);
    setSwapTarget(null);
    setSwapDrawerActivity(null);
    toast.success('Activity swapped!');

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
  }, [swapTarget, tripCurrency, isPaid, spendCredits, tripId, days, syncBudgetFromDays, destination]);

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
        metadata: { dayCount: totalDays },
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
      toast.success('Itinerary regenerated! Flights, hotels, and trip settings preserved.');

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
    try {
      // Spend credits first (skip for first-trip users)
      if (!routeOptCost.isFirstTrip && routeOptCost.cost > 0) {
        await spendCredits.mutateAsync({
          action: 'ROUTE_OPTIMIZATION',
          tripId,
          creditsAmount: routeOptCost.cost,
          metadata: { optimizeCount: routeOptCost.optimizeCount },
        });
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

        // If no meaningful changes occurred, refund the credits
        if (!hasChanges && !routeOptCost.isFirstTrip && routeOptCost.cost > 0) {
          try {
            await supabase.functions.invoke('spend-credits', {
              body: {
                action: 'REFUND',
                tripId,
                creditsAmount: routeOptCost.cost,
                metadata: { reason: 'zero_optimization_changes' },
              },
            });
            // Invalidate credit caches
            setNeedsOptimization(false);
            toast.info('Routes are already optimized!', { duration: 3000 });
          } catch (refundErr) {
            console.error('Failed to refund optimization credits:', refundErr);
          }
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
      // Refund credits if paid optimization failed
      if (!routeOptCost.isFirstTrip && routeOptCost.cost > 0) {
        try {
          await supabase.functions.invoke('spend-credits', {
            body: {
              action: 'REFUND',
              tripId,
              creditsAmount: routeOptCost.cost,
              metadata: { reason: 'optimize_runtime_failure' },
            },
          });
          console.log('[optimize] Refunded credits after optimization failure');
        } catch (refundErr) {
          console.error('[optimize] Failed to refund credits after failure:', refundErr);
        }
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

    setDays(prev => {
      const newDays = prev.map((day, idx) => {
        if (idx !== dayIndex) return day;
        return { ...day, activities: updated };
      });
      syncBudgetFromDays(newDays);
      return newDays;
    });
    // Clear stale refresh result for this day
    const dayNum = days[dayIndex]?.dayNumber;
    if (dayNum) {
      setRefreshResults(prev => { const next = { ...prev }; delete next[dayNum]; return next; });
    }
    setHasChanges(true);
    setNeedsOptimization(true);
  }, [syncBudgetFromDays, isSyntheticActivity, isHiddenOptionAlternative, isTransportActivity, getVisibleReorderableActivities, days]);

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
    setNeedsOptimization(true);
    toast.success(`Moved to Day ${toDayIndex + 1}`);
  }, [syncBudgetFromDays]);

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

      return prev.map((day, idx) => {
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
    });
    setHasChanges(true);
    toast.success(`Copied to Day ${toDayIndex + 1}`);
  }, []);

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
    setNeedsOptimization(true);
    toast.success('Activity removed');
  }, [pendingRemove, syncBudgetFromDays, days, tripId]);

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
      {
        try {
          await spendCredits.mutateAsync({
            action: 'REGENERATE_DAY',
            tripId,
            dayIndex,
          });
        } catch (err) {
          // Credit deduction failed - show nudge
          console.error('[Regenerate] Credit spend failed:', err);
          setCreditNudge({ action: 'REGENERATE_DAY' });
          return;
        }
      }
      
      // Increment count and proceed with regeneration
      setDayRegenCounts(prev => ({ ...prev, [dayIndex]: currentCount + 1 }));
      handleDayRegenerateInternal(dayIndex);
    }
  }, [canRegenerate, dayRegenCounts, isPaid, spendCredits, tripId]);

  // Handle guided assist submission
  const handleGuidedAssistSubmit = useCallback(async (preferences: string) => {
    if (guidedAssistDayIndex === null) return;
    
    // Spend credits before regenerating (server handles free caps)
    {
      try {
        await spendCredits.mutateAsync({
          action: 'REGENERATE_DAY',
          tripId,
          dayIndex: guidedAssistDayIndex,
        });
      } catch (err) {
        console.error('[GuidedAssist] Credit spend failed:', err);
        setCreditNudge({ action: 'REGENERATE_DAY' });
        setShowGuidedAssist(false);
        setGuidedAssistDayIndex(null);
        return;
      }
    }
    
    // Reset count for this day after guided assist
    setDayRegenCounts(prev => ({ ...prev, [guidedAssistDayIndex]: 0 }));
    
    // Store preferences and trigger regeneration with them
    if (preferences) {
      setPendingGuidedPreferences(preferences);
    }
    handleDayRegenerateInternal(guidedAssistDayIndex, preferences || undefined);
    setShowGuidedAssist(false);
    setGuidedAssistDayIndex(null);
  }, [guidedAssistDayIndex, isPaid, spendCredits, tripId]);

  // Internal regenerate handler (after credit check passed)
  const handleDayRegenerateInternal = useCallback(async (dayIndex: number, guidedPreferences?: string) => {
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
              (a.startTime || a.time || '').localeCompare(b.startTime || b.time || '')
            );
          }
          // Preserve original day title/theme
          newDay.title = day.title;
          newDay.theme = day.theme;
          setDays(prev => prev.map((d, idx) => idx === dayIndex ? newDay : d));
          setHasChanges(true);
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
        if (data?.day) {
          // Post-regeneration: deduplicate ALL accommodation entries, keep only original
          const originalHotel = (day.activities || []).find(isAccommodationLike);
          if (originalHotel && data.day.activities) {
            data.day.activities = data.day.activities.filter((a: EditorialActivity) => !isAccommodationLike(a));
            data.day.activities.push(originalHotel);
            data.day.activities.sort((a: EditorialActivity, b: EditorialActivity) =>
              (a.startTime || a.time || '').localeCompare(b.startTime || b.time || '')
            );
          }

          // Preserve original day title and theme — backend shouldn't rename without user request
          data.day.title = day.title;
          data.day.theme = day.theme;

          setDays(prev => prev.map((d, idx) => idx === dayIndex ? data.day : d));
          setHasChanges(true);
          if (guidedPreferences) {
            toast.success(`Day ${day.dayNumber} regenerated with your preferences!`);
          } else {
            toast.success(`Day ${day.dayNumber} regenerated!`);
          }
        }
      }
    } catch (err) {
      console.error('Regenerate error:', err);
      toast.error('Failed to regenerate day');
    } finally {
      setRegeneratingDay(null);
      setPendingGuidedPreferences(null);
    }
  }, [days, tripId, destination, destinationCountry, travelers, budgetTier, onRegenerateDay]);

  // Alias for backwards compatibility
  const handleDayRegenerate = requestDayRegenerate;

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
  }, []);

  const handleAddActivity = useCallback(async (dayIndex: number, activity: Partial<EditorialActivity>) => {
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
    setNeedsOptimization(true);
    setAddActivityModal(null);
    toast.success('Activity added!');
  }, [tripCurrency, spendCredits, tripId, days, syncBudgetFromDays]);

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
          merged.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
          updated[dayIndex] = { ...day, activities: merged };
        } else {
          const combined = [...day.activities, ...newActivities];
          combined.sort((a, b) => {
            const timeA = a.startTime || '';
            const timeB = b.startTime || '';
            if (!timeA && !timeB) return 0;
            if (!timeA) return 1;
            if (!timeB) return -1;
            return timeA.localeCompare(timeB);
          });
          updated[dayIndex] = { ...day, activities: combined };
        }
      }
      syncBudgetFromDays(updated);
      return updated;
    });
    setHasChanges(true);
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

    const oldStartStr = targetActivity.startTime || targetActivity.time || '12:00';
    const formatTime = (mins: number) => {
      const c = Math.max(0, Math.min(mins, 23 * 60 + 59));
      return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
    };
    const deltaMinutes = parseTime(startTime) - parseTime(oldStartStr);

    let shifted = day.activities.map((activity, aIdx) => {
      if (aIdx === activityIndex) {
        const newDuration = parseTime(endTime) - parseTime(startTime);
        return { ...activity, startTime, endTime, time: startTime, durationMinutes: Math.max(newDuration, 0) };
      }
      if (cascade && aIdx > activityIndex && deltaMinutes !== 0) {
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
    setDays(prev => prev.map((d, dIdx) => {
      if (dIdx !== dayIndex) return d;
      return { ...d, activities: shifted };
    }));
    setHasChanges(true);
    setTimeEditModal(null);
    toast.success(cascade ? 'Schedule shifted' : 'Activity time updated');
  }, [days]);

  // Update existing activity (full edit)
  const handleUpdateActivity = useCallback((dayIndex: number, activityIndex: number, updates: Partial<EditorialActivity>) => {
    setDays(prev => prev.map((day, dIdx) => {
      if (dIdx !== dayIndex) return day;
      const updatedActivities = day.activities.map((activity, aIdx) => {
        if (aIdx !== activityIndex) return activity;
        return {
          ...activity,
          ...updates,
          isLocked: true,
          time: updates.startTime || activity.startTime || activity.time,
        };
      });
      // Auto-sort chronologically when a time changes
      if (updates.startTime || updates.endTime) {
        updatedActivities.sort((a, b) => {
          const parseMin = (t?: string) => {
            if (!t) return 9999;
            const parts = t.match(/(\d{1,2}):(\d{2})/);
            if (!parts) return 9999;
            return parseInt(parts[1]) * 60 + parseInt(parts[2]);
          };
          return parseMin(a.startTime || a.time) - parseMin(b.startTime || b.time);
        });
      }
      return { ...day, activities: updatedActivities };
    }));
    setHasChanges(true);
    setEditActivityModal(null);
    toast.success('Activity updated');
  }, []);

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
              { id: 'details', label: 'Details', fullLabel: 'Flights & Hotels', icon: <Plane className="h-4 w-4" /> },
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
      <AnimatePresence mode="wait">
        {activeTab === 'itinerary' && (
          <motion.div
            key="itinerary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
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

             {/* ── Unified Trip Command Center — hidden in clean preview ── */}
             {!isCleanPreview && <div data-tour="value-header" className="rounded-xl border border-border bg-card overflow-hidden">

              {/* ROW 1: Trip Total + Currency Toggle + Meta */}
              <div className="px-4 sm:px-6 py-4 border-b border-border/50 overflow-hidden">
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm text-muted-foreground shrink-0">Trip Total</span>
                    <span className="text-2xl font-bold text-foreground truncate">{formatCurrency(displayCost(totalCost), tripCurrency)}</span>
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
                    <TripTotalDeltaIndicator
                      delta={financialSnapshot.lastDelta}
                      onDismiss={financialSnapshot.acknowledgeDelta}
                    />
                  </div>
                  {localCurrency !== 'USD' && (
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setShowLocalCurrency((v) => !v)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/50 border border-border text-xs font-medium hover:bg-secondary transition-colors"
                          aria-label="Switch Currency"
                          data-tour="currency-toggle"
                        >
                          <span className={showLocalCurrency ? 'text-primary' : 'text-muted-foreground'}>{localCurrency}</span>
                          <span className="text-muted-foreground/50">↔</span>
                          <span className={!showLocalCurrency ? 'text-primary' : 'text-muted-foreground'}>USD</span>
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
                {(hotelCost > 0 || flightCost > 0) && (() => {
                  const daysSubtotal = totalActivityCost * (travelers || 1);
                  const nightsCount = (allHotels && allHotels.length > 0)
                    ? allHotels.reduce((sum, h) => {
                        if (h.checkInDate && h.checkOutDate) {
                          return sum + Math.max(1, Math.ceil(
                            (parseLocalDate(h.checkOutDate).getTime() - parseLocalDate(h.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
                          ));
                        }
                        return sum;
                      }, 0)
                    : (hotelSelection?.nights ?? Math.max(1, days.length - 1));
                  return (
                    <div className="flex items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground flex-wrap justify-center">
                      <span><span className="text-muted-foreground/70">Days</span> <span className="font-medium text-foreground tabular-nums">{formatCurrency(displayCost(daysSubtotal), tripCurrency)}</span></span>
                      {hotelCost > 0 && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span><span className="text-muted-foreground/70">Hotel</span> <span className="font-medium text-foreground tabular-nums">{formatCurrency(displayCost(hotelCost), tripCurrency)}</span> <span className="text-muted-foreground/70">({nightsCount} {nightsCount === 1 ? 'night' : 'nights'})</span></span>
                        </>
                      )}
                      {flightCost > 0 && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span><span className="text-muted-foreground/70">Flights</span> <span className="font-medium text-foreground tabular-nums">{formatCurrency(displayCost(flightCost), tripCurrency)}</span></span>
                        </>
                      )}
                    </div>
                  );
                })()}
                {/* Reconciliation strip — exposes the unallocated bucket
                    (Day-0 logistics + reserve + manual override delta) so the
                    sum of day-card badges plus this line equals Trip Total. */}
                {tripLevelCents > 0 && daysSubtotalCents > 0 && (() => {
                  const daysSubUsd = daysSubtotalCents / 100;
                  const tripLevelUsd = tripLevelCents / 100;
                  const includeHotel = (financialSnapshot as any).budget_include_hotel; // not exposed, fallback by toggles below
                  const label = (hotelCost > 0 || flightCost > 0)
                    ? 'Hotel, flight & reserve'
                    : 'Reserve & adjustments';
                  return (
                    <div className="flex items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground flex-wrap justify-center">
                      <span><span className="text-muted-foreground/70">Days subtotal</span> <span className="font-medium text-foreground tabular-nums">{formatCurrency(displayCost(daysSubUsd), tripCurrency)}</span></span>
                      <span className="text-muted-foreground/40">+</span>
                      <span><span className="text-muted-foreground/70">{label}</span> <span className="font-medium text-foreground tabular-nums">{formatCurrency(displayCost(tripLevelUsd), tripCurrency)}</span></span>
                    </div>
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
                            destination, startDate, endDate, travelers, days, unlockedDayNumbers,
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
                      {!showTripOverview && valueStats.estimatedSavings && (
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
                      {valueStats.estimatedSavings && (
                        <div className="p-3 bg-primary/5 border-t border-border/50">
                          <div className="flex items-center justify-center gap-2 text-sm">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">{valueStats.estimatedSavings.time} saved</span>
                            {valueStats.estimatedSavings.money && (
                              <>
                                <span className="text-muted-foreground">+</span>
                                <span className="font-medium text-foreground">{valueStats.estimatedSavings.money}</span>
                              </>
                            )}
                            <span className="text-muted-foreground">vs. typical itinerary</span>
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
              {tripHealthPanel && (
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
                      {tripHealthPanel}
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
                    {startDate && endDate ? ` · ${safeFormatDate(startDate, 'MMM d')} – ${safeFormatDate(endDate, 'MMM d')}` : ''}
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

                <div className="flex-1 overflow-x-auto scrollbar-hide">
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
                            <span className="text-lg font-bold leading-tight">–</span>
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
                              <span className="text-lg font-bold leading-tight text-muted-foreground">–</span>
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
                  Something went wrong loading your budget. Your itinerary is safe — try switching tabs or refreshing.
                </p>
                <Button onClick={() => window.location.reload()} size="sm">
                  Refresh
                </Button>
              </div>
            }
          >
          <BudgetTab
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
                  "Couldn't drop — that item is no longer in your itinerary. The list may have been regenerated."
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
                    toast.error("Couldn't drop — item is no longer in your itinerary.");
                  } else {
                    toast.error("Couldn't drop — that suggestion no longer matches your itinerary. Refresh suggestions.");
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
                toast.success(`Dropped "${droppedTitle}" — saved ${formatCurrency(savedAmount)}`);
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
            ownerId={user?.id}
            ownerName={user?.name || user?.email?.split('@')[0]}
            budgetTier={budgetTier}
            destination={destination}
            destinationCountry={destinationCountry}
            journeyId={journeyId}
            journeyName={journeyName}
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
                        : hotelSelection?.name ? `${hotelSelection.nights || Math.max(1, days.length - 1)} nights` : 'Where you\'ll stay'}
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
                                  {cityHotel.hotel.imageUrl ? (
                                    <img
                                      src={cityHotel.hotel.imageUrl}
                                      alt={cityHotel.hotel.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Hotel className="h-6 w-6 text-muted-foreground/30" />
                                    </div>
                                  )}
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
                    {hotelSelection?.imageUrl ? (
                      <img
                        src={hotelSelection.imageUrl}
                        alt={hotelSelection.name || 'Hotel'}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { 
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                        <Hotel className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    
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
                        ${hotelSelection.pricePerNight}/night × {Math.max(1, days.length - 1)} nights = <strong className="text-foreground">${(hotelSelection.pricePerNight * Math.max(1, days.length - 1)).toLocaleString()}</strong>
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
      <AlertDialog open={!!pendingCascade} onOpenChange={(open) => { if (!open) setPendingCascade(null); }}>
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
            <AlertDialogCancel onClick={() => setPendingCascade(null)}>Cancel</AlertDialogCancel>
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
                setDays(prev => prev.map((d, idx) => {
                  if (idx !== dayIndex) return d;
                  return { ...d, activities: kept };
                }));
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
              multiCityRoute={allHotels && allHotels.length > 1 ? (() => {
                const route: Array<{ from: string; to: string; date?: string }> = [];
                // Outbound: origin → first city
                if (originCity) route.push({ from: originCity, to: allHotels[0].cityName, date: startDate });
                // Inter-city: each city → next city
                for (let i = 0; i < allHotels.length - 1; i++) {
                  route.push({ from: allHotels[i].cityName, to: allHotels[i + 1].cityName, date: allHotels[i].checkOutDate });
                }
                // Return: last city → origin
                if (originCity) route.push({ from: allHotels[allHotels.length - 1].cityName, to: originCity, date: endDate });
                return route;
              })() : undefined}
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
              multiCityRoute={allHotels && allHotels.length > 1 ? (() => {
                const route: Array<{ from: string; to: string; date?: string }> = [];
                if (originCity) route.push({ from: originCity, to: allHotels[0].cityName, date: startDate });
                for (let i = 0; i < allHotels.length - 1; i++) {
                  route.push({ from: allHotels[i].cityName, to: allHotels[i + 1].cityName, date: allHotels[i].checkOutDate });
                }
                if (originCity) route.push({ from: allHotels[allHotels.length - 1].cityName, to: originCity, date: endDate });
                return route;
              })() : undefined}
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

      
    </div>
  );
}

// =============================================================================
// DESTINATION IMAGE COMPONENTS (Static images - no carousel)
// =============================================================================
// Helper to normalize destination strings (remove IATA codes like "(FCO)")
function normalizeDestination(dest: string): string {
  return (dest || '')
    .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
    .replace(/\b(international\s+)?airport\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}


// =============================================================================
// NEED TO KNOW SECTION COMPONENT
// =============================================================================

interface NeedToKnowSectionProps {
  destination: string;
  destinationCountry?: string;
  destinationInfo?: EditorialItineraryProps['destinationInfo'];
}

function NeedToKnowSection({ destination, destinationCountry, destinationInfo }: NeedToKnowSectionProps) {
  const [expandedCards, setExpandedCards] = useState<string[]>([]);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Fetch real destination insights from Perplexity
  useEffect(() => {
    if (fetchedRef.current || !destination) return;
    
    const fetchInsights = async () => {
      setIsLoadingInsights(true);
      setInsightsError(null);
      
      try {
        const { data, error } = await supabase.functions.invoke('lookup-destination-insights', {
          body: { destination, country: destinationCountry }
        });
        
        if (error) throw error;
        
        if (data?.success && data?.data) {
          setAiInsights(data.data);
          fetchedRef.current = true;
        }
      } catch (err) {
        console.error('Failed to fetch destination insights:', err);
        setInsightsError(err instanceof Error ? err.message : 'Failed to load insights');
      } finally {
        setIsLoadingInsights(false);
      }
    };
    
    fetchInsights();
  }, [destination, destinationCountry]);

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  // Static essentials only — currency, tipping, transit live in Travel Intel
  // NOTE: AI/static merge is delegated to mergeNeedToKnowInfo so partial
  // Perplexity responses fall back per-field instead of leaking generic
  // placeholders like "Local language" / "Local time".
  const getDefaultInfo = () => {
    const country = destinationCountry?.toLowerCase() || '';
    const dest = (destination || '').toLowerCase();
    
    // UK / London
    if (country.includes('uk') || country.includes('united kingdom') || country.includes('england') || dest.includes('london')) {
      return {
        language: 'English',
        languageTips: [
          'British English differs from American English',
          '"Cheers" means thanks, goodbye, or a toast',
          '"Queue" means line - respect the queue!',
          'Politeness is highly valued'
        ],
        timezone: 'GMT (UTC+0) / BST (UTC+1 summer)',
        timezoneTips: [
          'Shops typically close 6-7 PM, later in central London',
          'Pubs traditionally close around 11 PM',
          'Sunday trading hours are limited'
        ],
        water: 'Tap water is safe and excellent quality',
        waterTips: [
          'Free tap water available at restaurants',
          'Refill stations at many tube stations',
          'No need to buy bottled water'
        ],
        voltage: '230V, Type G plugs (3-pin)',
        voltageTips: [
          'US/EU devices need UK adapters',
          'Hotels often have shaver sockets',
          'USB charging works without adapters'
        ],
        emergency: '999 (Emergency) / 111 (Non-urgent NHS)',
        emergencyTips: [
          '999 for police, fire, ambulance',
          '111 for non-emergency medical advice',
          'A&E (Emergency Room) at major hospitals',
          'Pharmacies can advise on minor issues'
        ],
      };
    }
    
    // France / Paris
    if (country.includes('france') || dest.includes('paris')) {
      return {
        language: 'French',
        languageTips: [
          '"Bonjour" (Hello) - always greet first',
          '"Merci" (Thank you) - essential',
          '"Pardon" (Excuse me) - polite interruption',
          'English widely spoken in tourist areas'
        ],
        timezone: 'CET (UTC+1) / CEST (UTC+2 summer)',
        timezoneTips: [
          'Many shops close Sundays',
          'Lunch is typically 12-2 PM',
          'Dinner starts around 8 PM'
        ],
        water: 'Tap water is safe to drink',
        waterTips: [
          '"Carafe d\'eau" for free tap water at restaurants',
          'Wallace fountains provide free drinking water',
          'Bottled water available everywhere'
        ],
        voltage: '230V, Type C/E plugs',
        voltageTips: [
          'US/UK devices need adapters',
          'Most hotels have adapters available',
          'USB charging works without adapters'
        ],
        emergency: '112 (EU Emergency) / 15 (Medical) / 17 (Police)',
        emergencyTips: [
          '112 works EU-wide from any phone',
          'Pharmacies (green cross) can advise on minor issues',
          'SOS Médecins for doctor house calls',
          'Keep embassy contact handy'
        ],
      };
    }
    
    // Spain / Barcelona / Madrid
    if (country.includes('spain') || dest.includes('barcelona') || dest.includes('madrid')) {
      return {
        language: 'Spanish (Catalan in Barcelona)',
        languageTips: [
          '"Hola" (Hello) - friendly greeting',
          '"Gracias" (Thank you)',
          '"Por favor" (Please)',
          'Catalan spoken in Barcelona alongside Spanish'
        ],
        timezone: 'CET (UTC+1) / CEST (UTC+2 summer)',
        timezoneTips: [
          'Siesta: many shops close 2-5 PM',
          'Dinner typically starts 9-10 PM',
          'Nightlife runs very late'
        ],
        water: 'Tap water is safe but tastes mineral',
        waterTips: [
          'Bottled water commonly preferred',
          'Restaurants may charge for water',
          '"Agua del grifo" for tap water'
        ],
        voltage: '230V, Type C/F plugs',
        voltageTips: [
          'Same as rest of Europe',
          'US/UK devices need adapters',
          'USB charging works without adapters'
        ],
        emergency: '112 (All emergencies)',
        emergencyTips: [
          '112 for police, fire, ambulance',
          'Tourist police in major cities',
          'Pharmacies have green cross',
          'Hospitals have 24h emergency'
        ],
      };
    }
    
    // Italy / Rome
    if (country.includes('italy') || dest.includes('rome') || dest.includes('milan') || dest.includes('florence') || dest.includes('venice')) {
      return {
        language: 'Italian',
        languageTips: [
          '"Buongiorno" (Good morning) - formal greeting',
          '"Grazie" (Thank you) - essential phrase',
          '"Scusi" (Excuse me) - polite way to get attention',
          'English spoken at tourist spots, less in small towns'
        ],
        timezone: 'CET (UTC+1)',
        timezoneTips: [
          'Shops often close 1-4 PM for "riposo"',
          'Dinner typically starts 8-9 PM',
          'Museums may close early on Mondays'
        ],
        water: 'Tap water is safe to drink',
        waterTips: [
          'Public drinking fountains ("nasoni") everywhere',
          'Free water at restaurants upon request',
          'Bottled water widely available'
        ],
        voltage: '230V, Type C/F plugs',
        voltageTips: [
          'US/UK devices need adapters',
          'Most hotels have adapters available',
          'USB charging works without adapters'
        ],
        emergency: '112 (EU Emergency), 118 (Ambulance)',
        emergencyTips: [
          '112 works from any phone, even without SIM',
          'Pharmacies display green cross, rotate night shifts',
          'Keep copies of passport separate from originals'
        ],
      };
    }
    
    // Germany / Berlin / Munich
    if (country.includes('germany') || dest.includes('berlin') || dest.includes('munich')) {
      return {
        language: 'German',
        languageTips: [
          '"Guten Tag" (Hello) - formal greeting',
          '"Danke" (Thank you)',
          '"Bitte" (Please/You\'re welcome)',
          'English widely spoken, especially by young people'
        ],
        timezone: 'CET (UTC+1) / CEST (UTC+2 summer)',
        timezoneTips: [
          'Shops closed on Sundays (except tourist areas)',
          'Punctuality is highly valued',
          'Dinner typically 6-8 PM'
        ],
        water: 'Tap water is excellent quality',
        waterTips: [
          'Restaurant water is usually bottled (paid)',
          'Ask for "Leitungswasser" for tap water',
          'Sparkling water (Sprudel) very popular'
        ],
        voltage: '230V, Type C/F plugs',
        voltageTips: [
          'Same as rest of Europe',
          'US/UK devices need adapters',
          'USB charging works without adapters'
        ],
        emergency: '112 (Emergency) / 110 (Police)',
        emergencyTips: [
          '112 for fire and ambulance',
          '110 for police',
          'Apotheke (pharmacy) for minor issues',
          'Most pharmacists speak English'
        ],
      };
    }

    // Default fallback
    return {
      language: destinationInfo?.language || 'Local language',
      languageTips: ['Learn basic greetings', 'Translation apps work offline', 'Locals appreciate any effort'],
      timezone: destinationInfo?.timezone || 'Local time',
      timezoneTips: ['Adjust sleep schedule a few days before', 'Stay hydrated during flights'],
      water: destinationInfo?.water || 'Check local advisories',
      waterTips: ['When in doubt, use bottled water', 'Ice in drinks may use tap water'],
      voltage: destinationInfo?.voltage || 'Check adapter requirements',
      voltageTips: ['Universal adapters are convenient', 'Check voltage compatibility for hair dryers'],
      emergency: destinationInfo?.emergency || 'Contact local authorities',
      emergencyTips: ['Save emergency numbers in your phone', 'Know your hotel address in local language'],
    };
  };

  // Get entry requirements based on destination
  const getEntryRequirements = () => {
    const country = destinationCountry?.toLowerCase() || '';
    const dest = (destination || '').toLowerCase();
    
    // UK
    if (country.includes('uk') || country.includes('united kingdom') || country.includes('england') || dest.includes('london')) {
      return {
        visa: 'US citizens: Visa-free for up to 6 months',
        visaTips: [
          'No visa required for tourism (US/EU citizens)',
          'Must show proof of return/onward travel',
          'May need to show proof of accommodation',
          'Electronic Travel Authorisation (ETA) required from 2024 for some nationalities'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Passport must be valid for entire stay',
          'No minimum validity requirement beyond trip',
          'Blank pages not strictly required',
          'Keep a photo of passport on your phone'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'COVID restrictions may apply - check before travel',
          'NHS available for emergencies (may incur charges)',
          'European Health Insurance Card (EHIC) no longer valid for UK',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // France
    if (country.includes('france') || dest.includes('paris')) {
      return {
        visa: 'US citizens: Visa-free for up to 90 days (Schengen)',
        visaTips: [
          'Part of Schengen Area - 90 days in any 180-day period',
          'ETIAS authorization required from 2025 for US citizens',
          'No visa required for tourism (US/EU citizens)',
          'Count all Schengen countries toward 90-day limit'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Must be valid 3+ months beyond planned departure from Schengen',
          'Issued within past 10 years',
          'At least 2 blank pages recommended',
          'Keep color copies separate from original'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'Routine vaccinations should be up to date',
          'European Health Insurance Card (EHIC) valid for EU citizens',
          'Pharmacies can provide basic medical advice',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // Italy / Rome
    if (country.includes('italy') || dest.includes('rome') || dest.includes('florence') || dest.includes('venice') || dest.includes('milan')) {
      return {
        visa: 'US citizens: Visa-free for up to 90 days (Schengen)',
        visaTips: [
          'Part of Schengen Area - 90 days in any 180-day period',
          'ETIAS authorization required from 2025 for US citizens',
          'No visa required for tourism (US/EU citizens)',
          'Register at local police station if staying 8+ days (handled by hotels)'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Must be valid 3+ months beyond planned departure from Schengen',
          'Issued within past 10 years',
          'At least 2 blank pages recommended',
          'Carry passport when visiting major sites (security checks)'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'Routine vaccinations should be up to date',
          'European Health Insurance Card (EHIC) valid for EU citizens',
          'Tap water is safe to drink',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // Spain
    if (country.includes('spain') || dest.includes('barcelona') || dest.includes('madrid')) {
      return {
        visa: 'US citizens: Visa-free for up to 90 days (Schengen)',
        visaTips: [
          'Part of Schengen Area - 90 days in any 180-day period',
          'ETIAS authorization required from 2025 for US citizens',
          'No visa required for tourism (US/EU citizens)',
          'Count all Schengen countries toward 90-day limit'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Must be valid 3+ months beyond planned departure from Schengen',
          'Issued within past 10 years',
          'At least 2 blank pages recommended',
          'National ID card accepted for EU citizens'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'Routine vaccinations should be up to date',
          'European Health Insurance Card (EHIC) valid for EU citizens',
          'Pharmacies well-stocked and helpful',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // Germany
    if (country.includes('germany') || dest.includes('berlin') || dest.includes('munich')) {
      return {
        visa: 'US citizens: Visa-free for up to 90 days (Schengen)',
        visaTips: [
          'Part of Schengen Area - 90 days in any 180-day period',
          'ETIAS authorization required from 2025 for US citizens',
          'No visa required for tourism (US/EU citizens)',
          'Count all Schengen countries toward 90-day limit'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Must be valid 3+ months beyond planned departure from Schengen',
          'Issued within past 10 years',
          'At least 2 blank pages recommended',
          'National ID card accepted for EU citizens'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'Routine vaccinations should be up to date',
          'European Health Insurance Card (EHIC) valid for EU citizens',
          'High-quality healthcare system',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // Default fallback
    return {
      visa: 'Check visa requirements for your nationality',
      visaTips: [
        'Requirements vary by passport/nationality',
        'Apply for visa well in advance if required',
        'Some visas can take weeks to process',
        'Check embassy website for latest requirements'
      ],
      passport: 'Valid passport required',
      passportTips: [
        'Typically must be valid 6+ months beyond travel dates',
        'Check blank page requirements',
        'Keep digital and physical copies separate',
        'Note passport expiration date'
      ],
      health: 'Check health advisories',
      healthTips: [
        'Consult CDC travel health notices',
        'Some destinations require vaccinations',
        'Bring sufficient prescription medications',
        'Travel insurance strongly recommended'
      ],
    };
  };

  const entryInfo = getEntryRequirements();

  const info = mergeNeedToKnowInfo(aiInsights, getDefaultInfo() as any) as any;

  const infoCategories = [
    // Entry Requirements - Most important first
    {
      id: 'visa',
      icon: <Shield className="h-5 w-5" />,
      label: 'Visa Requirements',
      value: entryInfo.visa,
      tips: entryInfo.visaTips,
    },
    {
      id: 'passport',
      icon: <FileText className="h-5 w-5" />,
      label: 'Passport',
      value: entryInfo.passport,
      tips: entryInfo.passportTips,
    },
    {
      id: 'health',
      icon: <HeartPulse className="h-5 w-5" />,
      label: 'Health & Vaccinations',
      value: entryInfo.health,
      tips: entryInfo.healthTips,
    },
    // Static basics — currency, tipping, transit live in Travel Intel
    {
      id: 'language',
      icon: <Globe className="h-5 w-5" />,
      label: 'Language',
      value: info.language + (info.languageEnglishFriendly ? ` (${info.languageEnglishFriendly})` : ''),
      tips: info.languageTips,
    },
    {
      id: 'timezone',
      icon: <Clock className="h-5 w-5" />,
      label: 'Timezone',
      value: info.timezone,
      tips: info.timezoneTips,
    },
    {
      id: 'water',
      icon: <Droplets className="h-5 w-5" />,
      label: 'Water Safety',
      value: info.water,
      tips: info.waterTips,
    },
    {
      id: 'voltage',
      icon: <Sparkles className="h-5 w-5" />,
      label: 'Electricity',
      value: info.voltage,
      tips: info.voltageTips,
    },
    {
      id: 'emergency',
      icon: <AlertCircle className="h-5 w-5" />,
      label: 'Emergency',
      value: info.emergency,
      tips: info.emergencyTips,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-serif">Need to Know</h2>
            <p className="text-sm text-muted-foreground">Essential info for {destination}</p>
          </div>
        </div>
        {isLoadingInsights && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading local insights...</span>
          </div>
        )}
        {aiInsights && !isLoadingInsights && (
          <Badge variant="outline" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-powered insights
          </Badge>
        )}
      </div>

      {/* Interactive Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {infoCategories.map((category) => {
          const isExpanded = expandedCards.includes(category.id);
          return (
            <motion.div key={category.id}>
              <Card
                className={cn(
                  "cursor-pointer transition-all duration-200 overflow-hidden",
                  isExpanded
                    ? "border-primary/30 shadow-md"
                    : "border-border hover:border-primary/15 hover:shadow-sm"
                )}
                onClick={() => toggleCard(category.id)}
              >
                <CardContent className="p-0">
                  {/* Header - Always visible */}
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {category.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase tracking-wider font-semibold mb-1 text-muted-foreground">
                          {category.label}
                        </p>
                        <p className="text-sm text-foreground font-medium leading-relaxed">
                          {category.value}
                        </p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn("shrink-0 ml-2", isExpanded ? "text-primary" : "text-muted-foreground")}
                    >
                      <ChevronDown className="h-5 w-5" />
                    </motion.div>
                  </div>

                  {/* Expandable Tips Section */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-4 pb-4 pt-0">
                          <div className="border-t border-border/60 pt-3 mt-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">
                              Quick Tips
                            </p>
                            <ul className="space-y-2">
                              {category.tips.map((tip, idx) => (
                                <motion.li
                                  key={idx}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                  className="flex items-start gap-2 text-sm text-muted-foreground"
                                >
                                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-primary/40" />
                                  <span>{tip}</span>
                                </motion.li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Cultural Notes - Full Width */}
      {destinationInfo?.culturalNotes && (
        <Card className="bg-gradient-to-br from-primary/5 via-background to-accent/5 border-primary/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-primary">Cultural Notes</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{destinationInfo.culturalNotes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expand All / Collapse All */}
      <div className="flex justify-center">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => {
            if (expandedCards.length === infoCategories.length) {
              setExpandedCards([]);
            } else {
              setExpandedCards(infoCategories.map(c => c.id));
            }
          }}
          className="text-muted-foreground hover:text-foreground gap-2"
        >
          {expandedCards.length === infoCategories.length ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Collapse All
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Expand All Tips
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// FLIGHT SYNC WARNING COMPONENT
// =============================================================================

interface FlightSyncWarningProps {
  flightArrivalTime: string;
  day1FirstActivity?: EditorialActivity;
  onSyncDay1: () => void;
  isRegenerating: boolean;
}

function FlightSyncWarning({ flightArrivalTime, day1FirstActivity, onSyncDay1, isRegenerating }: FlightSyncWarningProps) {
  // Parse flight arrival time
  const parseTimeToMinutes = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return null;
    
    let hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + mins;
  };
  
  const flightMins = parseTimeToMinutes(flightArrivalTime);
  const activityMins = parseTimeToMinutes(day1FirstActivity?.startTime || '');
  
  // If no flight time or first activity, don't show warning
  if (flightMins === null || activityMins === null) return null;
  
  // Check if Day 1's first activity is "Arrival" type - if so, compare times
  const isArrivalActivity = day1FirstActivity?.title?.toLowerCase().includes('arrival') ||
    day1FirstActivity?.category === 'transport';
  
  if (!isArrivalActivity) return null;
  
  // Calculate the EXPECTED earliest activity time (arrival + customs/transit buffer)
  const FLIGHT_BUFFER_MINS = 105; // 1h customs + 45m transit — same as cascadeTransportToItinerary
  const expectedEarliest = flightMins + FLIGHT_BUFFER_MINS;

  // If the arrival activity starts within 5 minutes of flight arrival, times are aligned — no warning
  const timesAreAligned = Math.abs(activityMins - flightMins) <= 5;
  if (timesAreAligned) return null;

  // The warning should only fire if:
  // 1. First activity starts BEFORE the expected earliest (schedule is too early), OR
  // 2. First activity starts more than 3 hours AFTER the expected earliest (unreasonable gap)
  const activityIsBeforeExpected = activityMins < (flightMins + 30); // Activity before arrival + 30m = definitely wrong
  const gapFromExpected = activityMins - expectedEarliest;
  const unreasonableGap = gapFromExpected > 180; // More than 3 hours after expected = suspicious

  if (!activityIsBeforeExpected && !unreasonableGap) return null;
  
  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
  };
  
  return (
    <div className="border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-500/20 rounded-full shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-amber-900 dark:text-amber-100">
            Flight times don't match your itinerary
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Your flight arrives at <span className="font-semibold">{formatTime(flightMins)}</span>, 
            but Day 1 shows arrival at <span className="font-semibold">{formatTime(activityMins)}</span>.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            This can happen if you added or changed your flight after generating the itinerary.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onSyncDay1}
            disabled={isRegenerating}
            className="mt-3 border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
          >
            {isRegenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing schedule...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync schedule to flight times
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// AIRPORT GAME PLAN COMPONENT
// =============================================================================

interface TransferOption {
  mode: string;
  duration: string;
  durationMinutes: number;
  estimatedCost?: string;
  notes?: string;
}

interface TransferData {
  taxi: { duration: string; cost: string };
  train: { duration: string; cost: string };
}

interface ArrivalGamePlanProps {
  flightSelection?: FlightSelection | null;
  hotelSelection?: HotelSelection | null;
  allHotels?: CityHotelInfo[];
  destination: string;
  onNavigateToBookings?: () => void;
  onAddFlightInline?: () => void;
  /** For multi-city arrivals: the city being arrived at */
  arrivalCityInfo?: CityHotelInfo;
  /** Day number (1-indexed), defaults to 1 */
  dayNumber?: number;
}

function ArrivalGamePlan({ flightSelection, hotelSelection, allHotels, destination, onNavigateToBookings, onAddFlightInline, arrivalCityInfo, dayNumber = 1 }: ArrivalGamePlanProps) {
  const outbound = flightSelection?.outbound;
  const fallbackCityHotel = allHotels?.find(h => !!h.hotel?.name)?.hotel || null;
  const effectiveHotelSelection = hotelSelection?.name ? hotelSelection : fallbackCityHotel;
  const hasHotel = !!effectiveHotelSelection?.name;
  const [transferData, setTransferData] = useState<TransferData | null>(null);
  const [isLoadingTransfer, setIsLoadingTransfer] = useState(false);
  
  // Multi-city: check if arriving by train/bus (not flight)
  const isTrainBusArrival = arrivalCityInfo?.transportType && ['train', 'bus', 'ferry', 'car'].includes(arrivalCityInfo.transportType);
  const transportDetails = arrivalCityInfo?.transportDetails;
  
  // Determine flight completeness: need arrival time for game plan to be useful
  const hasAnyFlightData = !!outbound;
  const hasCompleteFlightData = !!(outbound?.arrival?.time || outbound?.departure?.time);
  // For train/bus arrivals, we have arrival data from transportDetails
  const hasTransportArrival = isTrainBusArrival && !!(transportDetails?.arrivalTime as string);
  const hasFlight = hasCompleteFlightData; // Only show game plan if we have times
  const hasAnyArrivalData = hasFlight || hasTransportArrival;
  
  // Fetch dynamic transfer data from Google Maps Distance Matrix API
  // Runs when hotel exists (flight optional - uses destination airport as fallback)
  useEffect(() => {
    if (!effectiveHotelSelection?.name) return;
    
    const fetchTransferData = async () => {
      setIsLoadingTransfer(true);
      try {
        const arrivalAirport = outbound?.arrival?.airport || '';
        const arrivalTime = outbound?.arrival?.time || '';
        
        // Build origin string (airport) - use flight data or fallback to destination airport
        const origin = arrivalAirport 
          ? `${arrivalAirport} Airport, ${destination}`
          : `${destination} Airport`;
        
        // Build destination string (hotel or city center)
        const hotelDest = effectiveHotelSelection?.address 
          || `${effectiveHotelSelection.name}, ${destination}`;
        
        const response = await supabase.functions.invoke('airport-transfers', {
          body: { 
            origin, 
            destination: hotelDest,
            city: destination, // City name for database fare lookup
            airportCode: arrivalAirport || undefined,
            arrivalTime: arrivalTime ? new Date().toISOString() : undefined
          }
        });
        
        if (response.error) {
          console.error('Transfer API error:', response.error);
          return;
        }
        
        const data = response.data;
        if (data?.options) {
          // Map API response to our format
          const taxiOption = data.options.find((o: TransferOption) => 
            (o.mode || '').toLowerCase().includes('taxi') || (o.mode || '').toLowerCase().includes('ride')
          );
          const transitOption = data.options.find((o: TransferOption) => 
            (o.mode || '').toLowerCase().includes('train') || (o.mode || '').toLowerCase().includes('bus')
          );
          
          setTransferData({
            taxi: {
              duration: taxiOption?.duration || '30-50 min',
              cost: taxiOption?.estimatedCost || 'Varies',
            },
            train: {
              duration: transitOption?.duration || 'N/A',
              cost: transitOption?.estimatedCost || 'N/A',
            },
          });
        }
      } catch (error) {
        console.error('Failed to fetch transfer data:', error);
      } finally {
        setIsLoadingTransfer(false);
      }
    };
    
    fetchTransferData();
  }, [outbound?.arrival?.airport, effectiveHotelSelection?.name, effectiveHotelSelection?.address, destination]);
  
  // Parse arrival time and calculate recommendations (move up to use in all states)
  const arrivalTime = outbound?.arrival?.time || '';
  const arrivalAirport = outbound?.arrival?.airport || '';
  const departureTime = outbound?.departure?.time || '';
  
  // Calculate recommended airport arrival (2.5 hours before for international, 2 for domestic)
  const getRecommendedAirportArrival = () => {
    if (!departureTime) return null;
    const match = departureTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return departureTime;
    
    let hours = parseInt(match[1], 10);
    const mins = match[2];
    const period = match[3]?.toUpperCase();
    
    // Convert to 24h if needed
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    // Subtract 2.5 hours for international
    hours -= 2;
    let finalMins = parseInt(mins, 10) - 30;
    if (finalMins < 0) {
      finalMins += 60;
      hours -= 1;
    }
    if (hours < 0) hours += 24;
    
    // Format back to 12h
    const finalPeriod = hours >= 12 ? 'PM' : 'AM';
    const finalHours = hours % 12 || 12;
    return `${finalHours}:${String(finalMins).padStart(2, '0')} ${finalPeriod}`;
  };

  // Post-landing advice based on arrival time - aware of hotel availability
  const getPostLandingAdvice = (): { action: string; reason: string; isMissing?: boolean } => {
    // For train/bus arrivals, use transport arrival time
    if (isTrainBusArrival && hasTransportArrival) {
      if (!hasHotel) {
        return { action: 'Add hotel for personalized tips', reason: 'We\'ll calculate transfer times from the station', isMissing: true };
      }
      return { action: 'Head to your hotel', reason: 'No customs or security, so you can go straight to check-in' };
    }
    if (!hasFlight && !hasTransportArrival) {
      return { action: 'Add travel details for arrival tips', reason: 'We\'ll plan your arrival day activities', isMissing: true };
    }
    
    if (!arrivalTime) {
      return hasHotel 
        ? { action: 'Head to your hotel', reason: 'Check in and settle before exploring' }
        : { action: 'Add hotel for personalized tips', reason: 'We\'ll help plan your arrival day perfectly', isMissing: true };
    }
    
    const match = arrivalTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return hasHotel 
      ? { action: 'Head to your hotel', reason: 'Check in and settle before exploring' }
      : { action: 'Add hotel for personalized tips', reason: 'We\'ll help plan your arrival day perfectly', isMissing: true };
    
    let hours = parseInt(match[1], 10);
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    if (!hasHotel) {
      return { action: 'Add hotel for personalized tips', reason: 'We\'ll calculate transfer times and plan your arrival', isMissing: true };
    }
    
    if (hours >= 21 || hours < 6) {
      return { action: 'Head to hotel & rest', reason: 'Late arrival - get a good night\'s sleep for tomorrow\'s adventures' };
    } else if (hours >= 18) {
      return { action: 'Check in, then dinner nearby', reason: 'Evening arrival - perfect for a local dinner experience' };
    } else if (hours >= 12) {
      return { action: 'Check in, then lunch & explore', reason: 'Afternoon arrival - grab lunch and explore the neighborhood' };
    } else {
      return { action: 'Head to hotel, drop bags & start exploring', reason: 'Early arrival - make the most of your first day!' };
    }
  };

  // Fallback transfer estimate when API hasn't loaded yet
  const getStaticTransferEstimate = (): TransferData => {
    const transferFallback: Record<string, TransferData> = {
      'rome': { taxi: { duration: '45-60 min', cost: '€48 fixed' }, train: { duration: '32 min', cost: '€14' } },
      'paris': { taxi: { duration: '35-60 min', cost: '€55 fixed' }, train: { duration: '35 min', cost: '€11' } },
      'london': { taxi: { duration: '45-75 min', cost: '£60-90' }, train: { duration: '15 min', cost: '£25' } },
      'tokyo': { taxi: { duration: '60-90 min', cost: '¥25,000+' }, train: { duration: '35 min', cost: '¥3,000' } },
      'new york': { taxi: { duration: '45-75 min', cost: '$55-75' }, train: { duration: '45 min', cost: '$11' } },
      'default': { taxi: { duration: '30-50 min', cost: 'Varies' }, train: { duration: '30-45 min', cost: 'Varies' } },
    };
    
    const destKey = (destination || '').toLowerCase().trim();
    return transferFallback[destKey] || 
      Object.entries(transferFallback).find(([key]) => destKey.includes(key) || key.includes(destKey))?.[1] ||
      transferFallback['default'];
  };

  const recommendedArrival = getRecommendedAirportArrival();
  const postLanding = getPostLandingAdvice();
  const transfer = transferData || getStaticTransferEstimate();

  // Build context strings for train/bus arrivals
  const transportArrivalTime = isTrainBusArrival ? (transportDetails?.arrivalTime as string) || '' : '';
  const transportArrivalStation = isTrainBusArrival && transportDetails
    ? ((transportDetails as Record<string, unknown>).arrivalStation as string || (transportDetails as Record<string, unknown>).arrivalPoint as string || '')
    : '';
  const transportCarrier = isTrainBusArrival && transportDetails 
    ? ((transportDetails as Record<string, unknown>).carrier as string || '') 
    : '';

  // Subtitle: adapt per context
  const headerIcon = isTrainBusArrival ? <Train className="h-5 w-5 text-primary" /> : <Plane className="h-5 w-5 text-primary" />;
  const headerTitle = dayNumber === 1 
    ? 'Your Arrival Game Plan'
    : `Arriving in ${destination}`;
  const headerSubtitle = isTrainBusArrival
    ? `${arrivalCityInfo?.transportType === 'train' ? 'Train' : arrivalCityInfo?.transportType === 'bus' ? 'Bus' : arrivalCityInfo?.transportType === 'ferry' ? 'Ferry' : 'Drive'} arrival, Day ${dayNumber}`
    : dayNumber === 1 
      ? 'Everything you need for Day 1'
      : `Flight arrival, Day ${dayNumber}`;

  return (
    <div className="border border-border bg-card rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            {headerIcon}
          </div>
          <div>
            <h3 className="font-serif text-base sm:text-lg font-medium">{headerTitle}</h3>
            <p className="text-sm text-muted-foreground">{headerSubtitle}</p>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Train/Bus Arrival Section */}
        {isTrainBusArrival && hasTransportArrival ? (
          <>
            {/* Arrival info */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">
                  Arriving at {transportArrivalTime}
                  {transportArrivalStation ? ` (${transportArrivalStation})` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {transportCarrier ? `${transportCarrier} · ` : ''}
                  No airport security. Head straight to your hotel after arrival
                </p>
              </div>
            </div>
          </>
        ) : hasFlight ? (
          <>
            {/* Recommended Airport Arrival */}
            {recommendedArrival && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Leave for the airport by {recommendedArrival}</p>
                  <p className="text-xs text-muted-foreground">
                    We recommend 2.5 hours before your {departureTime} departure for international flights
                  </p>
                </div>
              </div>
            )}

            {/* Landing Info */}
            {arrivalTime && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    Landing at {arrivalTime}{arrivalAirport ? ` (${arrivalAirport})` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasHotel ? postLanding.reason : 'Add your hotel to see transfer options and personalized arrival tips'}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : hasAnyFlightData ? (
          // Partial flight data - show what we have and prompt to finish
          <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Plane className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Finish Flight Details</p>
                <p className="text-xs text-muted-foreground">
                  {outbound?.airline ? `${outbound.airline} ` : ''}
                  {outbound?.flightNumber ? `${outbound.flightNumber} • ` : ''}
                  Add times for your personalized game plan
                </p>
              </div>
            </div>
            {onNavigateToBookings && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onNavigateToBookings}
                className="shrink-0"
              >
                Finish Details
              </Button>
            )}
          </div>
        ) : (
          // No flight data at all
          <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Plane className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Add Your Flight</p>
                <p className="text-xs text-muted-foreground">We'll plan your arrival day around your landing time</p>
              </div>
            </div>
            {(onAddFlightInline || onNavigateToBookings) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onAddFlightInline || onNavigateToBookings}
                className="shrink-0"
              >
                Add Flight
              </Button>
            )}
          </div>
        )}

        {/* Hotel Section - Show hotel details */}
        {hasHotel ? (
          <>
            {/* Hotel Info Block */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Hotel className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{effectiveHotelSelection?.name}</p>
                {effectiveHotelSelection?.address && (
                  <p className="text-xs text-muted-foreground mt-0.5">{effectiveHotelSelection.address}</p>
                )}
                {(effectiveHotelSelection?.checkInDate || allHotels?.[0]?.checkInDate) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Check-in from {safeFormatDate(effectiveHotelSelection?.checkInDate || allHotels?.[0]?.checkInDate, 'MMM d', 'Date TBD')}
                    {` at ${effectiveHotelSelection?.checkInTime || effectiveHotelSelection?.checkIn || allHotels?.[0]?.hotel?.checkIn || '3:00 PM'}`} (early luggage storage usually available)
                  </p>
                )}
              </div>
            </div>

            {/* Transfer Options - Rich comparison */}
            <AirportHotelTransfer
              tripId=""
              origin={isTrainBusArrival && transportArrivalStation 
                ? `${transportArrivalStation}, ${destination}` 
                : (arrivalAirport || `${destination} Airport`)}
              destination={effectiveHotelSelection?.address || `${effectiveHotelSelection?.name}, ${destination}`}
              city={destination}
              airportCode={isTrainBusArrival ? undefined : (arrivalAirport || undefined)}
              hotelName={effectiveHotelSelection?.name || undefined}
              arrivalTime={isTrainBusArrival ? transportArrivalTime : (arrivalTime || undefined)}
              travelers={1}
              compact={true}
              onTransferSelected={() => {}}
            />
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Hotel className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Add Your Hotel</p>
                <p className="text-xs text-muted-foreground">Get transfer times and check-in recommendations</p>
              </div>
            </div>
            {(onAddFlightInline || onNavigateToBookings) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onAddFlightInline || onNavigateToBookings}
                className="shrink-0"
              >
                Add Hotel
              </Button>
            )}
          </div>
        )}

        {/* Post-Landing Action - only show when both flight and hotel exist */}
        {hasFlight && hasHotel && (
          <div className="flex items-start gap-3 pt-3 border-t border-border">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Recommended: {postLanding.action}</p>
              <p className="text-xs text-muted-foreground">{postLanding.reason}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// DAY CARD COMPONENT
// =============================================================================

interface DayCardProps {
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

function DayCard({
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
  // Airport-transfer subtotal — broken out of transit so users see why Day 1
  // transit looks high. Detected by "airport" in title/name/description on a
  // transit-category row.
  const airportTransferSubtotal = dayIsPreview ? 0 : day.activities.reduce((sum, act) => {
    const cat = (act.category || '').toLowerCase();
    const typ = ((act as any).type || '').toLowerCase();
    const isTransit = cat === 'transportation' || cat === 'transport' || cat === 'transit'
      || typ === 'transportation' || typ === 'transport' || typ === 'transit';
    if (!isTransit) return sum;
    const haystack = `${act.title || ''} ${(act as any).name || ''} ${act.description || ''}`.toLowerCase();
    if (!/\bairport\b/.test(haystack)) return sum;
    const info = getActivityCostInfo(act, travelers, budgetTier, destination, destinationCountry, isManualMode);
    return sum + (isManualMode ? info.amount : (info.isEstimated ? 0 : info.amount));
  }, 0);
  const otherTransitSubtotal = Math.max(0, transitSubtotal - airportTransferSubtotal);
  const visibleActivitiesSubtotal = Math.max(0, totalCost - transitSubtotal);
  
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
    <div className={cn(
      "overflow-hidden rounded-xl transition-shadow",
      isCleanPreview
        ? "border-0 shadow-none bg-transparent"
        : "border border-border bg-card shadow-none sm:shadow-sm sm:hover:shadow-md"
    )} data-tour="day-header">
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
                {day.title || day.theme || `Day ${day.dayNumber}`}
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
                for (let i = 0; i < acts.length - 1; i++) {
                  // Transport entries ARE the travel buffer — skip pairs involving them
                  const catA = ((acts[i] as any).category || '').toLowerCase();
                  const catB = ((acts[i + 1] as any).category || '').toLowerCase();
                  if (catA === 'transport' || catB === 'transport') continue;

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
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/30">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">{zeroGapCount} {zeroGapCount === 1 ? 'activity' : 'activities'}</span> {zeroGapCount === 1 ? 'has' : 'have'} no travel buffer.{' '}
                      {onRefreshDay ? (
                        <button
                          type="button"
                          onClick={onRefreshDay}
                          disabled={isRefreshingDay}
                          className="font-medium text-primary hover:underline cursor-pointer disabled:opacity-50 bg-transparent border-none p-0 inline"
                        >
                          Refresh Day
                        </button>
                      ) : (
                        <span className="font-medium text-primary">Refresh Day</span>
                      )}
                      {' '}to fix timing.
                    </p>
                  </div>
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

                  // Compute time-of-day label for section headers
                  const activityTime = activityToRender.startTime || activityToRender.time || '';
                  const hour = Math.floor(parseTimeToMinutes(activityTime) / 60);
                  const timeOfDay = isNaN(hour) || !activityTime ? '' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
                  
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
                  const prevHour = Math.floor(parseTimeToMinutes(prevTime) / 60);
                  const prevTimeOfDay = isNaN(prevHour) || !prevTime ? '' : prevHour < 12 ? 'Morning' : prevHour < 17 ? 'Afternoon' : 'Evening';
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

              {/* Refresh Day Diff View */}
              {refreshResult && refreshResult.dayNumber === day.dayNumber && (
                <RefreshDayDiffView
                  dayNumber={day.dayNumber}
                  proposedChanges={refreshResult.proposedChanges || []}
                  issues={refreshResult.issues}
                  transitEstimates={refreshResult.transitEstimates}
                  buffers={refreshResult.buffers || []}
                  onAcceptAll={(changes) => onApplyRefreshChanges?.(changes)}
                  onAcceptSelected={(changes) => onApplyRefreshChanges?.(changes)}
                  onDismiss={() => onDismissRefresh?.()}
                  onFindAlternative={(activityId, _activityTitle) => {
                    if (!onActivitySwap) return;
                    const matchedActivity = day.activities.find(a => a.id === activityId);
                    if (matchedActivity) {
                      onActivitySwap(dayIndex, matchedActivity);
                    }
                  }}
                  className="mt-3"
                />
              )}
            </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Library modal removed - agent features disabled */}
    </div>
  );
}

// =============================================================================
// ACTIVITY ROW COMPONENT - Editorial Style
// =============================================================================

interface ActivityRowProps {
  activity: EditorialActivity;
  destination: string;
  destinationCountry?: string;
  dayIndex: number;
  activityIndex: number;
  totalActivities: number;
  totalDays: number;
  isLast: boolean;
  isEditable: boolean;
  isPreview?: boolean;
  canViewPremium?: boolean;
  travelers: number;
  budgetTier?: string;
  tripCurrency: string;
  displayCost: (amountInUSD: number) => number;
  tripId: string;
  showTransportDetails: boolean;
  existingPayment?: TripPayment;
  onPaymentSuccess: () => void;
  onLock: (dayIndex: number, activityId: string) => void;
  onSwap?: (dayIndex: number, activity: EditorialActivity) => void;
  swapCapInfo?: { isFree: boolean; usedCount: number; freeRemaining: number; cap: number; creditCost: number; isLoading: boolean };
  onMove: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onMoveToDay?: (fromDayIndex: number, activityId: string, toDayIndex: number) => void;
  onCopyToDay?: (fromDayIndex: number, activityId: string, toDayIndex: number) => void;
  onRemove: (dayIndex: number, activityId: string) => void;
  onTimeEdit: (dayIndex: number, activityIndex: number, activity: EditorialActivity) => void;
  onEdit: (dayIndex: number, activityIndex: number, activity: EditorialActivity) => void;
  onPaymentRequest?: (activityId: string) => void;
  onBookingStateChange?: (activityId: string, newState: BookingItemState) => void;
  onViewReviews?: (activity: EditorialActivity) => void;
  /** Handler for changing transport mode on a route segment */
  onTransportModeChange?: (dayIndex: number, activityId: string, newMode: string) => Promise<void>;
  changingTransportActivityId?: string | null;
  /** Origin location for transit routing (previous activity's location) */
  transitOrigin?: string;
  /** Color map for collaborator attribution badges */
  collaboratorColorMap?: Map<string, CollaboratorAttribution>;
  aiLocked?: boolean;
  /** Guest in propose & vote mode — show reduced menu with only Propose Replacement */
  guestMustPropose?: boolean;
  /** Compact card mode — hides description, full address, inline ratings, booking badges */
  compact?: boolean;
  /** Whether this is a past trip — shows guide bookmark button */
  isPastTrip?: boolean;
   /** Clean preview mode — magazine-style reading card */
   isCleanPreview?: boolean;
   /** Callback to report a resolved photo URL for batch write-back */
   onPhotoResolved?: (activityId: string, photoUrl: string) => void;
   /** Manual builder mode — skip real photo fetching to avoid API costs */
    isManualMode?: boolean;
    /** Handler to open AI concierge sheet */
    onOpenConcierge?: (activity: EditorialActivity, dayIndex: number, activityIndex: number) => void;
    /** Handler to delete an AI saved note from an activity */
    onDeleteAINote?: (activityId: string, noteId: string) => void;
}

function ActivityRow({
  activity,
  destination,
  destinationCountry,
  dayIndex,
  activityIndex,
  totalActivities,
  totalDays,
  isLast,
  isEditable,
  isPreview = false,
  canViewPremium = true,
  travelers,
  budgetTier,
  tripCurrency,
  displayCost,
  tripId,
  showTransportDetails,
  existingPayment,
  onPaymentSuccess,
  onLock,
  onSwap,
  swapCapInfo,
  onMove,
  onMoveToDay,
  onCopyToDay,
  onRemove,
  onTimeEdit,
  onEdit,
  onPaymentRequest,
  onBookingStateChange,
  onViewReviews,
  onTransportModeChange,
  changingTransportActivityId,
  transitOrigin: transitOriginProp,
  collaboratorColorMap,
  aiLocked,
  guestMustPropose,
  compact = false,
  isPastTrip = false,
  isCleanPreview = false,
  onPhotoResolved,
  isManualMode = false,
  onOpenConcierge,
  onDeleteAINote,
}: ActivityRowProps) {
  const [showProposeReplacement, setShowProposeReplacement] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  if (!activity) return null;
  const activityType = getActivityType(activity);
  const style = activityStyles[activityType] || activityStyles.activity;
  const rawRating = getActivityRating(activity);
  const reviewCount = getActivityReviewCount(activity);
  const costInfo = getActivityCostInfo(activity, travelers, budgetTier, destination, destinationCountry, isManualMode);
  const cost = costInfo.amount;
  // Use tripCurrency (user's preferred display currency) instead of activity's native currency
  const existingPhoto = getActivityPhoto(activity);
  const time = activity.startTime || activity.time;
  
  // Normalize title: use title, fallback to name (backend may return either), and strip system prefixes
  const activityTitle = sanitizeActivityName(activity.title || (activity as { name?: string }).name);
  
  // Use placeholder for thumbnail when no photo exists (skip for downtime/transport)
  const titleLower = (activityTitle || '').toLowerCase();
  const isDowntime = activity.timeBlockType === 'downtime' || titleLower.includes('free time');
  const isTransport = activityType === 'transportation' || activityType === 'transport';
  const isCheckIn = titleLower.includes('check-in') || titleLower.includes('check in');
  const isAirport = titleLower.includes('airport') || titleLower.includes('transfer');
  const isAccommodation = activityType === 'accommodation';
  const showThumbnail = !isTransport && !isDowntime;
  
  // Only show ratings for venues that make sense: restaurants, activities, sightseeing, cultural
  // NOT for: transfers, check-in, free time, airport, accommodation
  const ratingEligibleTypes = ['dining', 'cultural', 'sightseeing', 'activity', 'shopping', 'entertainment', 'relaxation'];
  const isRatingEligible = ratingEligibleTypes.includes(activityType) && !isDowntime && !isTransport && !isCheckIn && !isAirport && !isAccommodation;
  const rating = isRatingEligible ? rawRating : null;
  
  // Concierge eligibility — show for venue-based activities only
  const CONCIERGE_HIDDEN_TYPES = ['transportation', 'transport', 'transit', 'travel', 'logistics'];
  const CONCIERGE_HIDDEN_TITLES = ['return to your hotel', 'freshen up', 'arrival flight', 'departure', 'check-in', 'check in', 'free time'];
  const showConcierge = onOpenConcierge && !CONCIERGE_HIDDEN_TYPES.includes(activityType) && !isDowntime
    && !CONCIERGE_HIDDEN_TITLES.some(t => titleLower.includes(t));

  // Determine if this is a dining activity that should show venue name prominently
  const isDiningActivity = ['dining', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee'].includes(activityType);

  const extractVenueFromText = (text?: string | null): string | null => {
    if (!text) return null;

    const raw = String(text).trim();

    // Prefer explicit patterns
    const patterns: RegExp[] = [
      /\b(?:at|@)\s+([^\n,.;]{3,80})/i,
      /\b(?:restaurant|restaurante|ristorante|trattoria|osteria|cafe|café)\s*[:\-–]\s*([^\n,.;]{3,80})/i,
      /\b(?:we\s+eat\s+at|lunch\s+at|dinner\s+at|breakfast\s+at)\s+([^\n,.;]{3,80})/i,
    ];

    for (const p of patterns) {
      const m = raw.match(p);
      const candidate = m?.[1]?.trim();
      if (!candidate) continue;

      // Guardrails against generic matches
      const lower = candidate.toLowerCase();
      if (
        lower.includes('hotel') ||
        lower.includes('airport') ||
        lower.includes('your hotel') ||
        lower === 'the hotel'
      ) {
        continue;
      }

      // Strip trailing quotes/parens
      return candidate.replace(/["')\]]+$/g, '').trim();
    }

    return null;
  };

  const venueNameForDining = isDiningActivity
    ? (activity.location?.name?.trim() || extractVenueFromText(activityTitle) || extractVenueFromText(activity.description) || null)
    : null;

  // For link lookups we want the best venue name even if the activity type was misclassified.
  // This prevents generic titles like "Traditional Fado Dinner Experience" being sent to the URL lookup.
  const venueNameForLink =
    activity.location?.name?.trim() ||
    extractVenueFromText(activityTitle) ||
    extractVenueFromText(activity.description) ||
    null;

  // Determine the best search term for images:
  // 1. Dining venue (from location/title/description) if available
  // 2. location.name (actual venue) if available
  // 3. Fall back to activity title
  const imageSearchTerm = (venueNameForDining && venueNameForDining.length > 3)
    ? venueNameForDining
    : (activity.location?.name && activity.location.name.length > 3 ? activity.location.name : activityTitle);

  // Use useActivityImage hook for real place photos with deduplication
  // This fetches from Google Places / TripAdvisor with caching
  // For hotels: Extract hotel name from title/location and fetch real photo
  const isHotelActivity = isCheckIn || isAccommodation;
  const hotelName = isHotelActivity 
    ? (activity.location?.name || activityTitle.replace(/check[\-\s]?(in|out)/gi, '').replace(/at\s+/gi, '').trim())
    : null;
  
  // Detect if this is a dining activity AT a hotel (breakfast at hotel, etc.)
  // These should use the hotel image instead of searching for a "restaurant"
  const locationName = activity.location?.name?.toLowerCase() || '';
  const isHotelDiningActivity = isDiningActivity && (
    locationName.includes('hotel') ||
    locationName.includes('hyatt') ||
    locationName.includes('hilton') ||
    locationName.includes('marriott') ||
    locationName.includes('sheraton') ||
    locationName.includes('ritz') ||
    locationName.includes('intercontinental') ||
    locationName.includes('resort') ||
    locationName.includes('inn') ||
    (activityTitle || '').toLowerCase().includes('breakfast at hotel') ||
    (activityTitle || '').toLowerCase().includes('breakfast at the hotel') ||
    (activityTitle || '').toLowerCase().includes('lunch at hotel') ||
    (activityTitle || '').toLowerCase().includes('dinner at hotel')
  );
  
  // For hotel dining activities, use accommodation category and hotel search term
  const effectiveSearchTerm = isHotelDiningActivity
    ? `${activity.location?.name || 'hotel'} hotel`
    : imageSearchTerm;
  
  const effectiveCategory = isHotelDiningActivity
    ? 'accommodation'
    : (isHotelActivity ? 'accommodation' : activityType);
  
  // Fetch real photos for most activities, including hotels (but not generic check-ins without hotel name)
  const hasHotelName = hotelName && hotelName.length > 3 && !hotelName.toLowerCase().includes('hotel check');
  const shouldFetchRealPhoto = canViewPremium && !isManualMode && showThumbnail && !isAirport && (hasHotelName || (!isCheckIn && !isAccommodation));
  
  const { imageUrl: fetchedImageUrl, loading: imageLoading } = useActivityImage(
    isHotelActivity && hasHotelName ? `${hotelName} hotel` : effectiveSearchTerm,
    effectiveCategory,
    existingPhoto,
    shouldFetchRealPhoto ? destination : undefined,
    activity.id,
    activity.id  // activityId - for DB write-back of fetched photo URLs
  );

  const thumbnailUrl = isManualMode ? null : fetchedImageUrl;
  const [thumbnailError, setThumbnailError] = useState(false);

  // Report resolved photo for batch write-back to itinerary_data
  useEffect(() => {
    if (fetchedImageUrl && !imageLoading && onPhotoResolved && activity.id) {
      onPhotoResolved(activity.id, fetchedImageUrl);
    }
  }, [fetchedImageUrl, imageLoading, onPhotoResolved, activity.id]);
  // Library modal state removed - agent features disabled

  // ── Clean Preview Mode — magazine-style reading card ────────────────
  if (isCleanPreview) {
    // Transport activities are completely hidden in preview
    if (isTransport) return null;
    // Downtime items hidden too
    if (isDowntime) return null;

    const timeDisplay = (() => {
      const start = formatTime(time);
      const end = activity.endTime ? formatTime(activity.endTime) : null;
      if (start && end) return `${start} – ${end}`;
      if (start) return start;
      return null;
    })();

    const isPlaceholderLocation = (text?: string) => {
      if (!text) return true;
      const t = text.toLowerCase().trim();
      return t.length < 4 || t === 'the destination' || t.startsWith('@ the destination') || t.startsWith('at the destination') || t === '@ the' || /^@?\s*the\s+(destination|city|area|location|neighborhood)$/i.test(t);
    };
    const rawLocationName = sanitizeActivityText(activity.location?.name?.trim());
    const dedupedLocationName = (rawLocationName && rawLocationName !== activityTitle && !isPlaceholderLocation(rawLocationName)) ? rawLocationName : '';
    const locationText = dedupedLocationName || (activity.location?.address && !isPlaceholderLocation(activity.location.address) ? sanitizeActivityText(activity.location.address) : '');

    return (
      <div className="py-2">
        {/* Time */}
        {timeDisplay && (
          <p className="text-sm font-medium text-primary mb-3">{timeDisplay}</p>
        )}

        {/* Image — full width, large */}
        {showThumbnail && thumbnailUrl && !thumbnailError && (
          <div className="w-full h-[200px] rounded-xl overflow-hidden bg-muted/30 mb-4">
            <img
              src={thumbnailUrl}
              alt={activityTitle}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                const fallback = getActivityFallbackImage(activityType, activityTitle);
                if (e.currentTarget.src !== fallback) {
                  e.currentTarget.src = fallback;
                } else {
                  setThumbnailError(true);
                }
              }}
            />
          </div>
        )}

        {/* Title */}
        <h4 className="font-serif text-xl font-semibold text-foreground leading-snug">
          {activityTitle}
        </h4>
        {venueNameForDining && venueNameForDining !== activityTitle && !isPlaceholderLocation(venueNameForDining) && (
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-primary/60 shrink-0" />
            {venueNameForDining}
          </p>
        )}

        {/* Description */}
        {(() => { const d = sanitizeActivityText(activity.description); return d ? (
          <p className="text-base text-muted-foreground leading-relaxed mt-2">
            {d}
          </p>
        ) : null; })()}

        {/* Location */}
        {locationText && (
          <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground/70">
            <MapPin className="h-3.5 w-3.5 text-primary/40 shrink-0" />
            <span>{locationText}</span>
          </div>
        )}

        {/* Voyance Tip — always expanded */}
        {sanitizeActivityText(activity.tips) && !isCheckIn && (
          <div className="mt-4 pt-3 border-t border-border/30">
            <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1.5">
              Voyance Tip
            </p>
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              {sanitizeActivityText(activity.tips)}
            </p>
          </div>
        )}

        {/* AI Concierge button */}
        {showConcierge && (
          <div className="mt-3 flex items-center">
            <button
              onClick={() => onOpenConcierge!(activity, dayIndex, activityIndex)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
              aria-label="AI Concierge"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Concierge
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Compact transport row ─────────────────────────────────────────
  // Transport activities (walk, taxi, metro, etc.) are rendered as a
  // slim inline indicator instead of a full-size activity card.
  if (isTransport) {
    const durationText = activity.duration
      || (activity.durationMinutes ? `${activity.durationMinutes} min` : null);

    const transportIcon = (() => {
      const t = (activityTitle || '').toLowerCase();
      if (t.includes('walk') || t.includes('stroll')) return <Footprints className="h-3.5 w-3.5" aria-hidden="true" />;
      if (t.includes('taxi') || t.includes('uber') || t.includes('lyft') || t.includes('cab') || t.includes('rideshare') || t.includes('drive'))
        return <Car className="h-3.5 w-3.5" />;
      if (t.includes('metro') || t.includes('subway') || t.includes('train') || t.includes('tram'))
        return <Train className="h-3.5 w-3.5" />;
      if (t.includes('bus') || t.includes('shuttle'))
        return <Bus className="h-3.5 w-3.5" />;
      return <Navigation2 className="h-3.5 w-3.5" />;
    })();

    // Walking is always free — override any AI-hallucinated cost
    const isWalkingTransport = (activityTitle || '').toLowerCase().includes('walk') || (activityTitle || '').toLowerCase().includes('stroll');
    // Use transport-specific cost from route data, NOT the general estimation engine
    const transportEstCost = activity.transportation?.estimatedCost?.amount;
    const transportCost = isWalkingTransport ? null
      : (transportEstCost && transportEstCost > 0 ? transportEstCost : null);

    const transitOrigin = transitOriginProp || destination;

    return (
      <TransitModePicker
        activity={activity}
        activityIndex={activityIndex}
        dayIndex={dayIndex}
        activityTitle={activityTitle}
        transportIcon={transportIcon}
        durationText={durationText}
        transportCost={transportCost}
        isLast={isLast}
        isEditable={isEditable}
        city={destination}
        tripId={tripId}
        tripCurrency={tripCurrency}
        travelers={travelers}
        transitOrigin={transitOrigin}
        onEdit={onEdit}
        onMove={onMove}
        onMoveToDay={onMoveToDay}
        onRemove={onRemove}
        totalActivities={totalActivities}
        totalDays={totalDays}
        formatCurrency={(c: number) => formatCurrency(displayCost(c), tripCurrency)}
        onActivityUpdated={() => {/* parent handles via onEdit */}}
      />
    );
  }

  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-stretch group/activity hover:bg-secondary/10 transition-colors",
      // Desktop: border separator between activities
      !isLast && "sm:border-b sm:border-border",
      activity.isLocked && "bg-primary/5"
    )} data-tour="activity-card">
      {/* Mobile: Compact tappable header — time + icon + title + cost */}
      <button
        type="button"
        className="sm:hidden flex items-center gap-2.5 w-full px-3 py-3 text-left active:bg-secondary/30 transition-colors"
        onClick={() => setMobileExpanded(prev => !prev)}
      >
        <span className="text-xs font-semibold text-primary tabular-nums w-12 shrink-0">{formatTime(time)}</span>
        <span className="p-1 rounded-md bg-primary/10 text-primary shrink-0">{style.icon}</span>
        <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{activityTitle}</span>
        {cost > 0 && (
          <span className="text-xs font-medium text-muted-foreground shrink-0">
            {formatCurrency(displayCost(cost), tripCurrency)}
          </span>
        )}
        {activity.isLocked && <Lock className="h-3 w-3 text-primary shrink-0" />}
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
          mobileExpanded && "rotate-180"
        )} />
      </button>

      {/* Mobile: Expandable detail section */}
      {mobileExpanded && (
        <div className="sm:hidden px-3 pb-3 pt-2 space-y-2 border-t border-border/30 animate-in slide-in-from-top-1 duration-200">
          {/* Mobile activity photo */}
          {showThumbnail && thumbnailUrl && !thumbnailError && (
            <div className={cn(
              "w-full h-36 rounded-lg overflow-hidden bg-muted/30",
              !canViewPremium && "blur-md pointer-events-none"
            )}>
              <img
                src={thumbnailUrl}
                alt={activityTitle}
                className="w-full h-full object-cover"
                loading="eager"
                onError={(e) => {
                  const fallback = getActivityFallbackImage(activityType, activityTitle);
                  if (e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  } else {
                    setThumbnailError(true);
                  }
                }}
              />
            </div>
          )}
          {activity.duration && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{activity.duration}</span>
            </div>
          )}
          {(() => { const d = sanitizeActivityText(activity.description); return d && !compact ? (
            <p className={cn(
              "text-xs text-muted-foreground leading-relaxed",
              !canViewPremium && "blur-sm pointer-events-none select-none"
            )}>{d}</p>
          ) : null; })()}
          {(() => {
            const locN = activity.location?.name?.trim();
            const dedupLocName = (locN && locN !== activityTitle) ? locN : '';
            return (dedupLocName || activity.location?.address) ? (
            <div className={cn(
              "flex items-center gap-1.5 text-xs text-muted-foreground",
              !canViewPremium && "blur-sm pointer-events-none select-none"
            )}>
              <MapPin className="h-3 w-3 text-primary/60 shrink-0" />
              <span className="truncate">{dedupLocName || activity.location?.address}</span>
            </div>
            ) : null;
          })()}
          {activity.isVoyancePick && !isDowntime && !isTransport && !isCheckIn && (
            <div className={cn(!canViewPremium && "blur-sm pointer-events-none select-none")}>
              <VoyancePickCallout tip={sanitizeActivityText(activity.tips)} />
            </div>
          )}
          {sanitizeActivityText(activity.tips) && !activity.isVoyancePick && !isDowntime && !isTransport && !isCheckIn && (
            <div className={cn(!canViewPremium && "blur-sm pointer-events-none select-none")}>
              {(activity.needsRefinement || activity.tags?.includes('needs-refinement')) && onSwap ? (
                <button
                  type="button"
                  onClick={() => onSwap(dayIndex, activity)}
                  className="w-full mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] p-2.5 text-left cursor-pointer hover:bg-primary/10 transition-colors group"
                >
                  <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs text-primary font-medium">Get a restaurant recommendation</span>
                  <ChevronRight className="h-3 w-3 text-primary/50 ml-auto group-hover:translate-x-0.5 transition-transform" />
                </button>
              ) : (
                <VoyanceInsight tip={sanitizeActivityText(activity.tips)} />
              )}
            </div>
          )}
          {/* AI Saved Notes */}
          {activity.aiNotes && activity.aiNotes.length > 0 && !isDowntime && !isTransport && (
            <AISavedNotes
              notes={activity.aiNotes}
              onDeleteNote={isEditable && onDeleteAINote ? (noteId) => onDeleteAINote(activity.id, noteId) : undefined}
            />
          )}
          {/* Mobile action buttons */}
          {!isPreview && (
            <div className="flex items-center gap-1 pt-1">
              {showConcierge && (
                <button
                  onClick={() => onOpenConcierge!(activity, dayIndex, activityIndex)}
                  className="p-1.5 rounded transition-colors hover:bg-primary/10 text-primary"
                  aria-label="AI Concierge"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
              )}
              {isEditable && (
                <>
                  <button
                    onClick={() => onLock(dayIndex, activity.id)}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      activity.isLocked ? "bg-primary/10 text-primary" : "hover:bg-secondary text-muted-foreground"
                    )}
                  >
                    {activity.isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  </button>
                  {!activity.isLocked && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors hover:bg-secondary text-foreground/60 hover:text-foreground touch-manipulation">
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="bg-background border shadow-lg z-50 min-w-[160px]">
                        {onSwap && canViewPremium && (
                          <DropdownMenuItem onClick={() => onSwap(dayIndex, activity)} className="cursor-pointer gap-2">
                            <ArrowRightLeft className="h-4 w-4" /> Find Alternative
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onEdit(dayIndex, activityIndex, activity)} className="cursor-pointer gap-2">
                          <Edit3 className="h-4 w-4" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRemove(dayIndex, activity.id)} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Time Column - Hidden on mobile, visible on desktop */}
      <div 
        className={cn(
          "hidden sm:block w-24 shrink-0 p-4 border-r border-border bg-gradient-to-b from-secondary/20 to-secondary/5",
          isEditable && "cursor-pointer hover:from-primary/10 hover:to-primary/5 transition-colors group"
        )}
        onClick={() => isEditable && onTimeEdit(dayIndex, activityIndex, activity)}
        title={isEditable ? "Click to edit time" : undefined}
      >
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-foreground">{formatTime(time)}</span>
          {isEditable && <Edit3 className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />}
        </div>
        {activity.endTime && (
          <p className="text-xs text-muted-foreground mt-0.5">→ {formatTime(activity.endTime)}</p>
        )}
        {activity.duration && (
          <p className="text-xs text-primary/70 mt-0.5 font-medium">
            {(activityType === 'accommodation' || titleLower.includes('return to') || titleLower.includes('freshen up'))
              ? (activity.durationMinutes && activity.durationMinutes > 180
                ? (titleLower.includes('check-in') || titleLower.includes('checkout') || titleLower.includes('check-out')
                   ? activity.duration 
                   : null)
                : activity.duration)
              : activity.duration}
          </p>
        )}
      </div>

      {/* Thumbnail Column - Hidden on mobile, consistent width on desktop */}
      <div className="hidden sm:block w-24 h-24 shrink-0 border-r border-border bg-muted/30 overflow-hidden relative group/thumb">
        {showThumbnail && thumbnailUrl && !thumbnailError ? (
          <>
            <img
              src={thumbnailUrl}
              alt={activityTitle}
              className={cn(
                "w-full h-full object-cover transition-transform group-hover/activity:scale-105",
                !canViewPremium && "blur-md pointer-events-none"
              )}
              loading="lazy"
              onError={(e) => {
                // Fall back to static type-based image instead of going blank
                const fallback = getActivityFallbackImage(activityType, activityTitle);
                if (e.currentTarget.src !== fallback) {
                  e.currentTarget.src = fallback;
                } else {
                  setThumbnailError(true);
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/activity:opacity-100 transition-opacity" />
          </>
        ) : (
          <img
            src={getActivityFallbackImage(activityType, activityTitle)}
            alt={activityTitle}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
        {/* Photo swap overlay — opens Edit Details modal */}
        {isEditable && !isPreview && (
          <button
            onClick={() => onEdit(dayIndex, activityIndex, activity)}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity cursor-pointer"
            title="Change photo"
          >
            <Camera className="h-5 w-5 text-white" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-3 sm:p-4 overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="hidden sm:flex items-center gap-2 mb-1.5">
              <span className="p-1 rounded bg-primary/10 text-primary">{style.icon}</span>
              <span className="text-xs text-primary/80 uppercase tracking-wider font-medium">{style.label}</span>
              {/* Collaborator attribution dot (desktop) — skip for logistical activities */}
              {activity.suggestedFor && collaboratorColorMap && !isCheckIn && !isAirport && !isAccommodation && !isTransport && !isDowntime && (() => {
                const ids = activity.suggestedFor!.split(',').map(s => s.trim()).filter(id => collaboratorColorMap.has(id));
                if (ids.length === 0) return null;
                if (ids.length === 1) {
                  const attr = collaboratorColorMap.get(ids[0])!;
                  const colors = getCollaboratorColor(attr.colorIndex);
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn("inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full", colors.bg, colors.text)}>
                          <span className={cn("h-2 w-2 rounded-full", colors.dot)} />
                          {attr.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Suggested for {attr.name}'s travel style
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                // Multiple travelers — show combined badge
                const attrs = ids.map(id => collaboratorColorMap.get(id)!);
                const names = attrs.map(a => a.name);
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        <span className="inline-flex -space-x-0.5">
                          {attrs.map(attr => {
                            const colors = getCollaboratorColor(attr.colorIndex);
                            return <span key={attr.userId} className={cn("h-2 w-2 rounded-full ring-1 ring-background", colors.dot)} />;
                          })}
                        </span>
                        {names.join(' & ')}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Inspired by both travelers' profiles
                    </TooltipContent>
                  </Tooltip>
                );
              })()}
              {/* Rating badge - clickable to view reviews (only for reviewable activity types) */}
              {(() => {
                // Types that should NOT show reviews
                const nonReviewableTypes = [
                  'downtime', 'transport', 'accommodation', 'flight', 'hotel', 
                  'check-in', 'check-out', 'checkin', 'checkout', 'transfer', 
                  'airport', 'arrival', 'departure', 'travel', 'transit',
                  'packing', 'rest', 'sleep', 'free time', 'leisure'
                ];
                const activityTypeLower = (activityType || '').toLowerCase();
                const titleLower = (activity.title || '').toLowerCase();
                
                // Check if this is a non-reviewable activity
                const isNonReviewable = nonReviewableTypes.some(t => 
                  activityTypeLower.includes(t) || titleLower.includes(t)
                ) || titleLower.includes('check in') || titleLower.includes('check out');
                
                if (isNonReviewable) return null;
                
                // Show existing numeric rating even when aiLocked (Discover-sourced ratings are real data)
                if (rating) {
                  return (
                    <Badge 
                      variant="secondary" 
                      className="text-xs gap-1 bg-amber-500/10 text-amber-600 border-none cursor-pointer hover:bg-amber-500/20 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewReviews?.(activity);
                      }}
                      title="View reviews"
                    >
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {rating.toFixed(1)}
                      {reviewCount && reviewCount > 0 && (
                        <span className="text-amber-600/70">({reviewCount > 999 ? `${(reviewCount / 1000).toFixed(1)}k` : reviewCount})</span>
                      )}
                    </Badge>
                  );
                }
                
                // "See Reviews" button — still gated behind aiLocked and premium
                if (aiLocked || !canViewPremium) return null;
                
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewReviews?.(activity);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-0"
                    title="View reviews and details"
                  >
                    <Star className="h-3 w-3" />
                    See Reviews
                  </button>
                );
              })()}
              {activity.bookingRequired && !compact && !isDowntime && !isTransport && !isCheckIn && !isAccommodation && (
                <Badge variant="outline" className="text-xs border-accent/50 text-accent">
                  Booking Required
                </Badge>
              )}
              {(isAccommodation || isCheckIn) && (
                <Badge variant="secondary" className="text-[10px] bg-secondary/60 text-muted-foreground border-0">
                  Included in your stay
                </Badge>
              )}
              {/* Contextual Tips Popover — non-intrusive, behind a tap */}
              {activity.contextualTips && activity.contextualTips.length > 0 && !isDowntime && !isTransport && !isCheckIn && canViewPremium && !compact && (
                <ContextualTipsPopover tips={activity.contextualTips} />
              )}
            </div>
            {(() => {
              const venue = venueNameForDining;
              const address = activity.location?.address?.trim();
              const hasAddress = !!address && address.length > 3;

              // For dining: Restaurant name should replace the generic meal label in the most prominent spot
              if (venue) {
                return (
                  <>
                    <h4 className="font-serif text-base sm:text-lg font-medium text-foreground leading-snug">{activityTitle}</h4>
                    {/* Mobile-only attribution dot — skip for logistical activities */}
                    {activity.suggestedFor && collaboratorColorMap && !isCheckIn && !isAirport && !isAccommodation && !isTransport && !isDowntime && (() => {
                      const ids = activity.suggestedFor!.split(',').map(s => s.trim()).filter(id => collaboratorColorMap.has(id));
                      if (ids.length === 0) return null;
                      const attrs = ids.map(id => collaboratorColorMap.get(id)!);
                      return (
                        <span className="sm:hidden inline-flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                          <span className="inline-flex -space-x-0.5">
                            {attrs.map(attr => {
                              const colors = getCollaboratorColor(attr.colorIndex);
                              return <span key={attr.userId} className={cn("h-2 w-2 rounded-full", colors.dot)} />;
                            })}
                          </span>
                          {attrs.length === 1 ? `For ${attrs[0].name}` : `For ${attrs.map(a => a.name).join(' & ')}`}
                        </span>
                      );
                    })()}
                    {venue !== activityTitle && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-1 line-clamp-1">
                        <MapPin className="h-3 w-3 text-primary/60 shrink-0" />
                        {venue}
                      </p>
                    )}
                    {/* Address gated by premium access — hidden in compact mode */}
                    {hasAddress && address !== venue && !compact && (
                      <div className={cn(
                        "flex items-start gap-1.5 mt-1.5 text-xs text-muted-foreground",
                        !canViewPremium && "blur-sm pointer-events-none select-none"
                      )}>
                        <MapPin className="h-3 w-3 text-primary/60 mt-0.5 shrink-0" />
                        <span className="leading-snug line-clamp-2 sm:line-clamp-none">{address}</span>
                      </div>
                    )}
                  </>
                );
              }

              return (
                <>
                   <h4 className="font-serif text-base sm:text-lg font-medium text-foreground leading-snug">{activityTitle}</h4>
                   {/* Mobile-only attribution dot — skip for logistical activities */}
                   {activity.suggestedFor && collaboratorColorMap && !isCheckIn && !isAirport && !isAccommodation && !isTransport && !isDowntime && (() => {
                     const ids = activity.suggestedFor!.split(',').map(s => s.trim()).filter(id => collaboratorColorMap.has(id));
                     if (ids.length === 0) return null;
                     const attrs = ids.map(id => collaboratorColorMap.get(id)!);
                     return (
                       <span className="sm:hidden inline-flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                         <span className="inline-flex -space-x-0.5">
                           {attrs.map(attr => {
                             const colors = getCollaboratorColor(attr.colorIndex);
                             return <span key={attr.userId} className={cn("h-2 w-2 rounded-full", colors.dot)} />;
                           })}
                         </span>
                         {attrs.length === 1 ? `For ${attrs[0].name}` : `For ${attrs.map(a => a.name).join(' & ')}`}
                       </span>
                     );
                   })()}
                  {/* Hours uncertainty warning — only shown for unverified/uncertain cases, not confirmed closures (those are removed by backend) */}
                  {(activity as any).closedRisk && !compact && (
                    <div className="flex items-center gap-1.5 mt-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
                      <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                        Hours may vary - {(activity as any).closedRiskReason || 'Verify hours before visiting'}
                      </span>
                    </div>
                  )}
                  {/* Description — hidden in compact mode */}
                  {(() => { const d = sanitizeActivityText(activity.description); return d && !compact ? (
                    <p className={cn(
                      "text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2 leading-relaxed",
                      !canViewPremium && "blur-sm pointer-events-none select-none"
                    )}>{d}</p>
                  ) : null; })()}
                  {/* High-cost booking guidance helper */}
                  {!compact && (activity as any)?.metadata?.booking_guidance_required && (
                    <p className="text-xs italic text-amber-700 dark:text-amber-300 mt-1">
                      High-value experience — confirm booking before you go.
                    </p>
                  )}

                  {/* Location — in compact mode show only location name, no full address */}
                  {(() => {
                    const locName = activity.location?.name?.trim();
                    const effectiveLocName = (locName && locName !== activityTitle) ? locName : '';
                    // Fallback: use distance or walkTime from activity metadata if no address
                    const locationFallback = !effectiveLocName && !hasAddress
                      ? ((activity as any).distance || (activity as any).walkTime || '')
                      : '';
                    const showLocation = effectiveLocName || hasAddress || (locationFallback && locationFallback.trim().length > 0);
                    return showLocation ? (
                    <div className={cn(
                      "mt-1.5",
                      !canViewPremium && "blur-sm pointer-events-none select-none"
                    )}>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 text-primary/60 shrink-0" />
                        <span className="truncate">{effectiveLocName || address || locationFallback}</span>
                      </div>
                      {!compact && effectiveLocName && hasAddress && address !== effectiveLocName && (
                        <div className="hidden sm:block pl-5 mt-0.5 text-xs text-muted-foreground/70 leading-snug">
                          {address}
                        </div>
                      )}
                    </div>
                    ) : null;
                  })()}
                </>
              );
            })()}
            {/* Voyance Pick — founder-curated endorsement */}
            {activity.isVoyancePick && !isDowntime && !isTransport && !isCheckIn && (
              <div className={cn(!canViewPremium && "blur-sm pointer-events-none select-none")}>
                <VoyancePickCallout tip={sanitizeActivityText(activity.tips)} />
              </div>
            )}
            {/* Voyance Insight - Local knowledge — blurred when gated */}
            {sanitizeActivityText(activity.tips) && !activity.isVoyancePick && !isDowntime && !isTransport && !isCheckIn && (
              <div className={cn(!canViewPremium && "blur-sm pointer-events-none select-none")}>
                {(activity.needsRefinement || activity.tags?.includes('needs-refinement')) && onSwap ? (
                  <button
                    type="button"
                    onClick={() => onSwap(dayIndex, activity)}
                    className="w-full mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] p-2.5 text-left cursor-pointer hover:bg-primary/10 transition-colors group"
                  >
                    <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-xs text-primary font-medium">Get a restaurant recommendation</span>
                    <ChevronRight className="h-3 w-3 text-primary/50 ml-auto group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ) : (
                  <VoyanceInsight tip={sanitizeActivityText(activity.tips)} />
                )}
              </div>
            )}
            {/* Transportation to next (gated by premium) */}
            {activity.timeBlockType !== 'downtime' && activity.transportation?.method && !isLast && (
              <div data-tour="transit-badge">
                <TransitBadge 
                  transportation={activity.transportation}
                  tripCurrency={tripCurrency}
                  displayCost={displayCost}
                  showDetails={showTransportDetails}
                  onTransportModeChange={
                    isEditable && onTransportModeChange
                      ? (newMode) => onTransportModeChange(dayIndex, activity.id, newMode)
                      : undefined
                  }
                  isChangingMode={changingTransportActivityId === activity.id}
                />
              </div>
            )}
          </div>

          {/* Actions & Cost */}
          <div className="flex flex-col items-end gap-1.5 sm:gap-2 ml-2 sm:ml-4 shrink-0">
            {!canViewPremium ? (
              /* Preview: show blurred cost */
              <div className="blur-sm pointer-events-none select-none">
                {cost === 0 ? (
                  <span className="font-medium text-muted-foreground text-xs">Free</span>
                ) : costInfo.isEstimated ? (
                  <span className="font-medium">~{formatCurrency(displayCost(cost), tripCurrency)}{basisLabel(costInfo.basis, travelers)}</span>
                ) : (
                  <span className="font-medium">{formatCurrency(displayCost(cost), tripCurrency)}{basisLabel(costInfo.basis, travelers)}</span>
                )}
              </div>
            ) : (
              <>
                {cost === 0 ? (
                  <span className="font-medium text-muted-foreground text-xs">Free</span>
                ) : costInfo.isEstimated ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-medium cursor-help border-b border-dashed border-muted-foreground/40">
                        ~{formatCurrency(displayCost(cost), tripCurrency)}<span className="text-xs text-muted-foreground">{basisLabel(costInfo.basis, travelers)}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[200px] text-xs">
                      <p>{costInfo.estimateReason}</p>
                      {costInfo.basis === 'per_person' && travelers > 1 && (
                        <p className="mt-1 font-medium">Group total: {formatCurrency(displayCost(cost * travelers), tripCurrency)}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="font-medium">
                    {formatCurrency(displayCost(cost), tripCurrency)}<span className="text-xs text-muted-foreground">{basisLabel(costInfo.basis, travelers)}</span>
                  </span>
                )}
                {/* Booking state actions - replaces static vendor links */}
                <InlineBookingActions
                  activity={{
                    id: activity.id,
                    title: activity.title,
                    // Ensure restaurant lookup gets the best venue name (not the generic meal title)
                    location: venueNameForLink
                      ? { ...(activity.location || {}), name: venueNameForLink }
                      : activity.location,
                    bookingState: activity.bookingState,
                    bookingRequired: activity.bookingRequired,
                    quotePriceCents: activity.quotePriceCents,
                    quoteExpiresAt: activity.quoteExpiresAt,
                    quoteLocked: activity.quoteLocked,
                    confirmationNumber: activity.confirmationNumber,
                    voucherUrl: activity.voucherUrl,
                    voucherData: activity.voucherData,
                    cancellationPolicy: activity.cancellationPolicy,
                    travelerData: activity.travelerData,
                    vendorName: activity.vendorName,
                    bookedAt: activity.bookedAt,
                    cancelledAt: activity.cancelledAt,
                    website: activity.website,
                    bookingUrl: activity.bookingUrl,
                    viatorProductCode: activity.viatorProductCode,
                    externalBookingUrl: activity.bookingUrl, // Pass actual URL for vendor links
                    cost,
                    currency: activity.cost?.currency || 'USD',
                  }}
                  destination={destination}
                  estimatedCost={cost}
                  onPaymentRequest={onPaymentRequest}
                  onStateChange={onBookingStateChange}
                  onAskConcierge={
                    onOpenConcierge
                      ? () => onOpenConcierge!(activity, dayIndex, activityIndex)
                      : undefined
                  }
                  compact
                />
              </>
            )}
            {/* AI Concierge button - always visible for eligible activities */}
            {showConcierge && !isPreview && (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onOpenConcierge!(activity, dayIndex, activityIndex)}
                    className="p-1.5 rounded transition-colors hover:bg-primary/10 text-primary"
                    aria-label="AI Concierge"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <span className="text-xs font-medium">AI Concierge</span>
                </TooltipContent>
              </Tooltip>
            )}
            {isEditable && !isPreview && (
              <div className="flex items-center gap-0.5">
                {/* Lock button */}
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onLock(dayIndex, activity.id)}
                      className={cn(
                        "p-1.5 rounded transition-colors",
                        activity.isLocked
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-secondary text-muted-foreground"
                      )}
                      aria-label={activity.isLocked ? "Unlock Activity" : "Lock Activity"}
                      data-tour="lock-button"
                    >
                      {activity.isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <span className="text-xs font-medium">{activity.isLocked ? 'Unlock Activity' : 'Lock Activity'}</span>
                  </TooltipContent>
                </Tooltip>
                
                {/* Overflow menu - all edit actions consolidated here */}
                {!activity.isLocked && (
                  <DropdownMenu>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors hover:bg-secondary text-foreground/60 hover:text-foreground touch-manipulation"
                            aria-label="More Options"
                            data-tour="more-actions"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <span className="text-xs font-medium">More Options</span>
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="center" sideOffset={4} className="bg-background border shadow-lg z-50 min-w-[160px]">
                      {onSwap && canViewPremium && (
                        <>
                          <DropdownMenuItem
                            onClick={() => onSwap(dayIndex, activity)}
                            className="cursor-pointer gap-2 flex-col items-start"
                            data-tour="find-alternative"
                          >
                            <span className="flex items-center gap-2">
                              <ArrowRightLeft className="h-4 w-4" />
                              Find Alternative
                            </span>
                            {swapCapInfo && !swapCapInfo.isLoading && (
                              <span className="text-[10px] text-muted-foreground ml-6">
                                {swapCapInfo.isFree
                                  ? `${swapCapInfo.freeRemaining} of ${swapCapInfo.cap} free swaps left`
                                  : `${swapCapInfo.creditCost} credits per swap`}
                              </span>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() => onMove(dayIndex, activity.id, 'up')}
                        disabled={activityIndex === 0}
                        className={cn("cursor-pointer gap-2", activityIndex === 0 && "opacity-50")}
                      >
                        <MoveUp className="h-4 w-4" />
                        Move up
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onMove(dayIndex, activity.id, 'down')}
                        disabled={activityIndex === totalActivities - 1}
                        className={cn("cursor-pointer gap-2", activityIndex === totalActivities - 1 && "opacity-50")}
                      >
                        <MoveDown className="h-4 w-4" />
                        Move down
                      </DropdownMenuItem>
                      {totalDays > 1 && onMoveToDay && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="gap-2">
                              <Calendar className="h-4 w-4" />
                              Move to day
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="bg-background border shadow-lg">
                              {Array.from({ length: totalDays }, (_, i) => i).filter(i => i !== dayIndex).map(targetDay => (
                                <DropdownMenuItem
                                  key={targetDay}
                                  onClick={() => onMoveToDay(dayIndex, activity.id, targetDay)}
                                  className="cursor-pointer"
                                >
                                  Day {targetDay + 1}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </>
                      )}
                      {totalDays > 1 && onCopyToDay && (
                        <>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="gap-2">
                              <Copy className="h-4 w-4" />
                              Copy to day
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="bg-background border shadow-lg">
                              {Array.from({ length: totalDays }, (_, i) => i).filter(i => i !== dayIndex).map(targetDay => (
                                <DropdownMenuItem
                                  key={targetDay}
                                  onClick={() => onCopyToDay(dayIndex, activity.id, targetDay)}
                                  className="cursor-pointer"
                                >
                                  Day {targetDay + 1}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </>
                      )}
                      {!aiLocked && collaboratorColorMap && collaboratorColorMap.size > 0 && (
                      <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowProposeReplacement(true)}
                        className="cursor-pointer gap-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Propose Replacement
                      </DropdownMenuItem>
                      </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onEdit(dayIndex, activityIndex, activity)}
                        className="cursor-pointer gap-2"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onRemove(dayIndex, activity.id)}
                        className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                
                {/* Propose Replacement Dialog */}
                <ProposeReplacementDialog
                  isOpen={showProposeReplacement}
                  onClose={() => setShowProposeReplacement(false)}
                  tripId={tripId}
                  activityId={activity.id}
                  activityTitle={sanitizeActivityName(activity.title || '')}
                  destination={destination}
                  activityForDrawer={{
                    id: activity.id,
                    title: activity.title || 'Activity',
                    type: (activity.type || activity.category || 'activity') as any,
                    description: activity.description || '',
                    time: activity.startTime || '',
                    duration: activity.duration || '60 min',
                    cost: activity.cost?.amount || 0,
                    location: { name: activity.location?.name || '', address: activity.location?.address || '' },
                    isLocked: false,
                    bookingRequired: false,
                    tags: activity.tags || [],
                  }}
                />
              </div>
            )}
            {/* Guest propose-only menu (Propose & Vote mode) */}
            {!isEditable && guestMustPropose && !isPreview && (
              <div className="flex items-center gap-0.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors hover:bg-secondary text-foreground/60 hover:text-foreground touch-manipulation"
                      aria-label="Propose changes"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" sideOffset={4} className="bg-background border shadow-lg z-50 min-w-[160px]">
                    <DropdownMenuItem
                      onClick={() => setShowProposeReplacement(true)}
                      className="cursor-pointer gap-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Propose Replacement
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ProposeReplacementDialog
                  isOpen={showProposeReplacement}
                  onClose={() => setShowProposeReplacement(false)}
                  tripId={tripId}
                  activityId={activity.id}
                  activityTitle={sanitizeActivityName(activity.title || '')}
                  destination={destination}
                  activityForDrawer={{
                    id: activity.id,
                    title: activity.title || 'Activity',
                    type: (activity.type || activity.category || 'activity') as any,
                    description: activity.description || '',
                    time: activity.startTime || '',
                    duration: activity.duration || '60 min',
                    cost: activity.cost?.amount || 0,
                    location: { name: activity.location?.name || '', address: activity.location?.address || '' },
                    isLocked: false,
                    bookingRequired: false,
                    tags: activity.tags || [],
                  }}
                />
              </div>
            )}
            {/* Guide bookmark button — shown on past trips for bookmarkable activities */}
            {isPastTrip && !isTransport && !isDowntime && (
              <GuideBookmarkButton
                activityId={activity.id}
                activityName={activityTitle}
                tripId={tripId}
                compact
              />
            )}
          </div>
        </div>

        {/* Library modal removed - agent features disabled */}
      </div>
    </div>
  );
}

// Old inline AddActivityModal removed — now imported from ./AddActivityModal

// =============================================================================
// TIME EDIT MODAL
// =============================================================================

interface TimeEditModalProps {
  isOpen: boolean;
  activity: EditorialActivity | null;
  onClose: () => void;
  onSave: (startTime: string, endTime: string, cascade: boolean) => void;
}

/** Parse "HH:MM" to minutes since midnight */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Convert minutes since midnight to "HH:MM" */
function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(mins, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function TimeEditModal({ isOpen, activity, onClose, onSave }: TimeEditModalProps) {
  const [startTime, setStartTime] = useState(activity?.startTime || activity?.time || '12:00');
  const [endTime, setEndTime] = useState(activity?.endTime || '13:00');
  const [cascade, setCascade] = useState(true);

  useEffect(() => {
    if (activity) {
      setStartTime(activity.startTime || activity.time || '12:00');
      setEndTime(activity.endTime || '13:00');
      setCascade(true);
    }
  }, [activity]);

  // Calculate the time delta for preview
  const originalStart = activity?.startTime || activity?.time || '12:00';
  const deltaMinutes = timeToMinutes(startTime) - timeToMinutes(originalStart);
  const deltaLabel = deltaMinutes === 0 ? '' : deltaMinutes > 0 ? `+${deltaMinutes} min` : `${deltaMinutes} min`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md pointer-events-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Edit Time
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">{activity?.title}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-time-input" className="text-sm font-medium mb-2 block">Start Time</label>
              <input 
                id="start-time-input"
                type="time" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-events-auto touch-manipulation"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <label htmlFor="end-time-input" className="text-sm font-medium mb-2 block">End Time</label>
              <input 
                id="end-time-input"
                type="time" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-events-auto touch-manipulation"
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>

          {/* Cascade toggle */}
          {deltaMinutes !== 0 && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cascade}
                  onChange={(e) => setCascade(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Shift all following activities ({deltaLabel})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cascade 
                      ? 'Everything after this will move by the same amount' 
                      : 'Only this activity will change'}
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

          {/* Validation: end time must be after start time */}
          {timeToMinutes(endTime) <= timeToMinutes(startTime) && (
            <p className="text-sm text-destructive font-medium">End time must be after start time</p>
          )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={timeToMinutes(endTime) <= timeToMinutes(startTime)}
            onClick={() => onSave(startTime, endTime, cascade && deltaMinutes !== 0)}
          >
            {cascade && deltaMinutes !== 0 ? 'Shift Schedule' : 'Save Time'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Credit top-up prompt wrapper for the component
function EditorialItineraryWithCreditPrompt(props: EditorialItineraryProps) {
  return <EditorialItinerary {...props} />;
}

export default EditorialItinerary;
