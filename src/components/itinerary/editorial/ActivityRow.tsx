// Extracted from EditorialItinerary.tsx during the file-size decomposition.
import type { EditorialActivity } from '../EditorialItinerary';
import { ContextualTipsPopover } from '../ContextualTipsPopover';
import { TransitBadge } from '../TransitBadge';
import { TransitModePicker } from '../TransitModePicker';
import { VoyanceInsight } from '../VoyanceInsight';
import { VoyancePickCallout } from '../VoyancePickCallout';
import { getActivityPhoto, getActivityRating, getActivityReviewCount, getActivityType } from './activity-utils';
import { getActivityCostInfo } from './cost-utils';
import { formatTime } from './format-utils';
import { InlineBookingActions } from '@/components/booking/InlineBookingActions';
import { GuideBookmarkButton } from '@/components/guides/GuideBookmarkButton';
import { AISavedNotes } from '@/components/itinerary/AISavedNotes';
import { ProposeReplacementDialog } from '@/components/suggestions/ProposeReplacementDialog';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useActivityImage } from '@/hooks/useActivityImage';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowRightLeft, Bus, Calendar, Camera, Car, ChevronDown, ChevronRight, Clock, Copy, Edit3, FileText, Footprints, Lightbulb, Lock, MapPin, MessageCircle, MoreHorizontal, MoveDown, MoveUp, Navigation2, Sparkles, Star, Train, Trash2, Unlock } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface ActivityRowProps {
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

export function ActivityRow({
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
  // Scroll the saved-notes log into view from the ⋯ menu. The mobile log lives
  // in the collapsed detail panel, so expand it first; two log instances share
  // this activity's id (mobile + desktop), so scroll whichever is visible.
  const scrollToNotes = () => {
    setMobileExpanded(true);
    window.setTimeout(() => {
      const nodes = document.querySelectorAll(`[data-ai-notes="${activity.id}"]`);
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i] as HTMLElement;
        if (el.offsetParent !== null) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    }, 80);
  };
  const rawRating = getActivityRating(activity);
  const reviewCount = getActivityReviewCount(activity);
  const costInfo = getActivityCostInfo(activity, travelers, budgetTier, destination, destinationCountry, isManualMode);
  const cost = costInfo.amount;
  // Use tripCurrency (user's preferred display currency) instead of activity's native currency
  const existingPhoto = getActivityPhoto(activity);
  const time = getRenderedStartTime(activity);
  
  // Normalize title: use title, fallback to name (backend may return either), and strip system prefixes.
  // CRITICAL: pass the full activity so sanitizer can see location.name / venue_name / placeId /
  // metadata.unverified_venue and rewrite "Spa Time — find a venue" to "Spa Session at <real venue>".
  const activityTitle = sanitizeActivityName(activity.title || (activity as { name?: string }).name, {
    category: (activity as { category?: string }).category,
    startTime: activity.startTime,
    activity: activity as any,
  });
  
  // Use placeholder for thumbnail when no photo exists (skip for downtime/transport)
  const titleLower = (activityTitle || '').toLowerCase();
  const isDowntime = activity.timeBlockType === 'downtime' || titleLower.includes('free time');
  const isTransport = activityType === 'transportation' || activityType === 'transport';
  const isCheckIn = titleLower.includes('check-in') || titleLower.includes('check in');
  const isAirport = titleLower.includes('airport') || titleLower.includes('transfer');
  const isAccommodation = activityType === 'accommodation';
  // Flight cards default to a real plane photo (not just an icon). Hotels/activities
  // get fetched photos; flights are generic, so a clean plane image reads better.
  const isFlightCard = activityType === 'flight' || activityType === 'inter_city_flight'
    || activityType === 'arrival' || activityType === 'departure'
    || titleLower.includes('flight');
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
  const shouldFetchRealPhoto = canViewPremium && !isManualMode && showThumbnail && !isAirport && !isFlightCard && (hasHotelName || (!isCheckIn && !isAccommodation));
  
  const { imageUrl: fetchedImageUrl, loading: imageLoading } = useActivityImage(
    isHotelActivity && hasHotelName ? `${hotelName} hotel` : effectiveSearchTerm,
    effectiveCategory,
    existingPhoto,
    shouldFetchRealPhoto ? destination : undefined,
    activity.id,
    activity.id  // activityId - for DB write-back of fetched photo URLs
  );

  const thumbnailUrl = isManualMode
    ? null
    : (fetchedImageUrl || (isFlightCard ? getActivityFallbackImage('flight', activityTitle) : null));
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
      const renderedEnd = getRenderedEndTime(activity);
      const end = renderedEnd ? formatTime(renderedEnd) : null;
      if (start && end) return `${start} - ${end}`;
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
    const locationText = dedupedLocationName || (activity.location?.address && !isPlaceholderLocation(activity.location.address) && !isWeakAddress(activity.location.address) ? sanitizeActivityText(activity.location.address) : '');

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

        {/* Description — fall back to personalization.whyThisFits when blank */}
        {(() => {
          const d = resolveActivityDisplayDescription(
            activity,
            sanitizeActivityText(activity.description),
            destination,
          );
          return d ? (
            <p className="text-base text-muted-foreground leading-relaxed mt-2">
              {d}
            </p>
          ) : null;
        })()}

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
          {(() => {
            const d = resolveActivityDisplayDescription(
              activity,
              sanitizeActivityText(activity.description),
              destination,
            );
            return d ? (
              <p className={cn(
                "text-xs text-muted-foreground leading-relaxed line-clamp-2",
                !canViewPremium && "blur-sm pointer-events-none select-none"
              )}>{d}</p>
            ) : null;
          })()}
          {(() => {
            const locN = activity.location?.name?.trim();
            const dedupLocName = (locN && locN !== activityTitle) ? locN : '';
            const rawAddr = activity.location?.address;
            const addrSafe = (rawAddr && !isWeakAddress(rawAddr)) ? rawAddr : '';
            const display = dedupLocName || addrSafe;
            return display ? (
            <div className={cn(
              "flex items-center gap-1.5 text-xs text-muted-foreground",
              !canViewPremium && "blur-sm pointer-events-none select-none"
            )}>
              <MapPin className="h-3 w-3 text-primary/60 shrink-0" />
              <span className="truncate">{display}</span>
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
                  <span className="text-xs text-primary font-medium">Pick a {((activity.title || '').match(/^(breakfast|brunch|lunch|dinner|drinks)/i)?.[1] || 'dining').toLowerCase()} spot →</span>
                  <ChevronRight className="h-3 w-3 text-primary/50 ml-auto group-hover:translate-x-0.5 transition-transform" />
                </button>
              ) : (
                <VoyanceInsight tip={sanitizeActivityText(activity.tips)} />
              )}
            </div>
          )}
          {/* AI Saved Notes */}
          {activity.aiNotes && activity.aiNotes.length > 0 && !isDowntime && !isTransport && (
            <div data-ai-notes={activity.id} className="scroll-mt-24">
              <AISavedNotes
                notes={activity.aiNotes}
                onDeleteNote={isEditable && onDeleteAINote ? (noteId) => onDeleteAINote(activity.id, noteId) : undefined}
              />
            </div>
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
                        {activity.aiNotes && activity.aiNotes.length > 0 && (
                          <DropdownMenuItem onClick={scrollToNotes} className="cursor-pointer gap-2">
                            <FileText className="h-4 w-4" /> Notes ({activity.aiNotes.length})
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
          isEditable && time && "cursor-pointer hover:from-primary/10 hover:to-primary/5 transition-colors group"
        )}
        onClick={() => isEditable && time && onTimeEdit(dayIndex, activityIndex, activity)}
        title={isEditable && time ? "Click to edit time" : undefined}
      >
        {time ? (
          <>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-foreground">{formatTime(time)}</span>
              {isEditable && <Edit3 className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            {getRenderedEndTime(activity) && (
              <p className="text-xs text-muted-foreground mt-0.5">→ {formatTime(getRenderedEndTime(activity))}</p>
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
          </>
        ) : (
          // No anchor start time — render duration-only (or em-dash) instead of an orphan "→ end" line.
          <div className="flex items-center gap-1">
            {activity.duration ? (
              <span className="text-xs text-primary/70 font-medium">{activity.duration}</span>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
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
                    {/* Description - also rendered in the venue branch so dining cards
                        with a known restaurant still show their blurb. Mirrors the
                        no-venue branch (resolveActivityDisplayDescription handles
                        existing description, whyThisFits, and dining fallback).
                        Dining cards bypass the `compact` gate - for restaurants the
                        blurb (signature dish, what to order) is the whole point of
                        the card and was the user-visible "no descriptions" symptom
                        in compact / smart-finish / manual layouts. */}
                    {(!compact || isDiningActivity) && (() => {
                      const d = resolveActivityDisplayDescription(
                        activity,
                        sanitizeActivityText(activity.description),
                        destination,
                      );
                      return d ? (
                        <p className={cn(
                          "text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed",
                          !canViewPremium && "blur-sm pointer-events-none select-none"
                        )}>{d}</p>
                      ) : null;
                    })()}
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
                  {/* Description — hidden in compact mode; falls back to whyThisFits */}
                  {(() => {
                    const d = resolveActivityDisplayDescription(
                      activity,
                      sanitizeActivityText(activity.description),
                      destination,
                    );
                    return d ? (
                      <p className={cn(
                        "text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2 leading-relaxed",
                        !canViewPremium && "blur-sm pointer-events-none select-none"
                      )}>{d}</p>
                    ) : null;
                  })()}
                  {/* High-cost booking guidance helper */}
                  {!compact && (activity as any)?.metadata?.booking_guidance_required && (
                    <p className="text-xs italic text-amber-700 dark:text-amber-300 mt-1">
                      High-value experience - confirm booking before you go.
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
                    <span className="text-xs text-primary font-medium">Pick a {((activity.title || '').match(/^(breakfast|brunch|lunch|dinner|drinks)/i)?.[1] || 'dining').toLowerCase()} spot →</span>
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
            {/* AI Saved Notes (desktop): the inline log of concierge "save to
                card" notes. Mirrors the mobile render above so desktop owners
                can actually see/manage saved notes. */}
            {activity.aiNotes && activity.aiNotes.length > 0 && !isDowntime && !isTransport && (
              <div data-ai-notes={activity.id} className="scroll-mt-24">
                <AISavedNotes
                  notes={activity.aiNotes}
                  onDeleteNote={isEditable && onDeleteAINote ? (noteId) => onDeleteAINote(activity.id, noteId) : undefined}
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
                    currency: tripCurrency,
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
                      {activity.aiNotes && activity.aiNotes.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={scrollToNotes} className="cursor-pointer gap-2">
                            <FileText className="h-4 w-4" />
                            Notes ({activity.aiNotes.length})
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
                  activityTitle={sanitizeActivityName(activity.title || '', { category: (activity as any).category, startTime: activity.startTime, activity: activity as any })}
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
                  activityTitle={sanitizeActivityName(activity.title || '', { category: (activity as any).category, startTime: activity.startTime, activity: activity as any })}
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
