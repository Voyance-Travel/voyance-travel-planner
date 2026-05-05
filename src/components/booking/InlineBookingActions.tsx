/**
 * Inline Booking Actions Component
 * 
 * A compact, inline version of booking controls for use within ActivityRow.
 * Shows appropriate actions based on booking state.
 * 
 * BOOKING MODES:
 * 1. Viator API Bookable: Has viatorProductCode - we process full transaction
 * 2. External Link Only: No productCode - redirect to vendor search (no tracking)
 * 3. Non-Bookable: Dining, logistics, free time - no booking UI shown
 */

import { useState } from 'react';
import { 
  ShoppingCart, Users, CreditCard, Ticket, XCircle, 
  Timer, Check, AlertCircle, ExternalLink, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  BookingItemState,
  getStateLabel,
  getStateColor,
  getPrimaryAction,
  isQuoteValid,
  getQuoteTimeRemaining,
  useSelectActivity,
  useDeselectActivity,
  TravelerInfo,
} from '@/services/bookingStateMachine';
import { TravelerInfoModal } from './TravelerInfoModal';
import { VoucherModal } from './VoucherModal';
import { formatPrice } from '@/utils/bookingUtils';
import { VendorBookingLink } from './VendorBookingLink';
import { isViatorBookable } from '@/services/viatorAPI';
import { RestaurantLink } from './RestaurantLink';

export interface InlineBookingActivity {
  id: string;
  title: string;
  category?: string;
  /** Location/venue information - used for restaurant name lookup */
  location?: { name?: string; address?: string };
  bookingState?: BookingItemState;
  bookingRequired?: boolean;
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
  /** Direct external booking URL (affiliate/vendor link) - use this over generated search URL */
  externalBookingUrl?: string;
  currency?: string;
  cost?: number;
  /** Website for the activity venue/location - for "View Details" link */
  website?: string;
  // Viator API integration fields
  viatorProductCode?: string;
  /** Booking URL from activity data - prioritize over generated search */
  bookingUrl?: string;
}

interface InlineBookingActionsProps {
  activity: InlineBookingActivity;
  destination: string;
  travelDate?: string; // For availability checks
  travelers?: { adults: number; children?: number };
  estimatedCost?: number;
  onPaymentRequest?: (activityId: string) => void;
  onStateChange?: (activityId: string, newState: BookingItemState) => void;
  /** Open AI Concierge sheet for this activity (used as concierge-led booking fallback) */
  onAskConcierge?: () => void;
  showVendorLink?: boolean;
  compact?: boolean;
}

/** Hostnames that indicate an OTA, not the venue's own site. */
const OTA_HOST_RE = /viator\.com|getyourguide\.com|tripadvisor\.com|tiqets\.com|klook\.com|booking\.com|expedia\./i;

function prettyHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'official site';
  }
}
// Activity types that cannot be booked on Viator (dining, restaurants, etc.)
const DINING_KEYWORDS = ['dinner', 'lunch', 'breakfast', 'brunch', 'dining', 'restaurant', 'cafe', 'coffee', 'meal', 'eat at', 'food tour'];

// Activities that should NEVER show booking UI (logistics, free time, hotel operations)
const NON_BOOKABLE_KEYWORDS = [
  'check-out', 'checkout', 'check out',
  'check-in', 'checkin', 'check in',
  'free time', 'downtime', 'leisure time', 'at leisure',
  'airport transfer', 'transfer to airport', 'transfer to hotel',
  'arrival at', 'departure from',
  'hotel checkout', 'hotel check-out',
  'rest', 'relax at hotel', 'hotel rest',
];

// Activities that are part of a hotel/accommodation and shouldn't show external booking
// These are hotel amenities, not separate bookable experiences
const HOTEL_AMENITY_KEYWORDS = [
  'spa', 'lounge', 'pool', 'gym', 'fitness', 'sauna', 'steam room',
  'relaxation', 'wellness', 'massage', 'treatment',
  'rooftop', 'terrace', 'bar at', 'hotel bar', 'lobby',
  'st regis', 'ritz', 'four seasons', 'w hotel', 'marriott', 'hilton',
  'hyatt', 'waldorf', 'peninsula', 'mandarin oriental', 'shangri-la',
];

// Categories that indicate accommodation-based activities
const ACCOMMODATION_CATEGORIES = ['accommodation', 'hotel', 'lodging', 'resort', 'spa', 'wellness'];

function isDiningActivity(title: string): boolean {
  const lowerTitle = (title || '').toLowerCase();
  return DINING_KEYWORDS.some(keyword => lowerTitle.includes(keyword));
}

function isHotelAmenityActivity(title: string, category?: string): boolean {
  const lowerTitle = (title || '').toLowerCase();
  const lowerCategory = (category || '').toLowerCase();
  
  // Check if category indicates accommodation/spa
  if (ACCOMMODATION_CATEGORIES.some(cat => lowerCategory.includes(cat))) {
    return true;
  }
  
  // Check for hotel brand names or amenity keywords in title
  if (HOTEL_AMENITY_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
    return true;
  }
  
  return false;
}

function isNonBookableActivity(title: string, category?: string): boolean {
  const lowerTitle = (title || '').toLowerCase();
  const lowerCategory = (category || '').toLowerCase();
  
  // Check keywords
  if (NON_BOOKABLE_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
    return true;
  }
  
  // Check categories that should never show booking
  if (['transport', 'transportation', 'downtime', 'free_time'].includes(lowerCategory)) {
    return true;
  }
  
  return false;
}

/**
 * Determine the appropriate link action for an activity
 * Returns: 'none' | 'view_details' | 'view_menu' | 'find_restaurant' | 'vendor_booking'
 */
function getActivityLinkType(
  title: string, 
  category?: string,
  hasViatorProduct?: boolean,
  hasDirectUrl?: boolean
): 'none' | 'view_details' | 'view_menu' | 'find_restaurant' | 'vendor_booking' {
  // Non-bookable activities (free time, transfers, etc.) - no link
  if (isNonBookableActivity(title, category)) {
    return 'none';
  }
  
  // Hotel amenities (spa, lounge, pool) - view details only if we have a URL
  if (isHotelAmenityActivity(title, category)) {
    return hasDirectUrl ? 'view_details' : 'none';
  }
  
  // Dining activities - menu link
  if (isDiningActivity(title)) {
    return hasDirectUrl ? 'view_menu' : 'find_restaurant';
  }
  
  // Regular bookable activities
  if (hasViatorProduct) {
    return 'vendor_booking';
  }
  
  // External link available - show vendor booking
  if (hasDirectUrl) {
    return 'vendor_booking';
  }
  
  // Fallback - generate a search
  return 'vendor_booking';
}


export function InlineBookingActions({
  activity,
  destination,
  travelDate,
  travelers,
  estimatedCost = 0,
  onPaymentRequest,
  onStateChange,
  showVendorLink = true,
  compact = false,
}: InlineBookingActionsProps) {
  const [showTravelerModal, setShowTravelerModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  
  const selectMutation = useSelectActivity();
  const deselectMutation = useDeselectActivity();
  
  const bookingState = activity.bookingState || 'not_selected';
  const price = activity.quotePriceCents 
    ? activity.quotePriceCents / 100 
    : activity.cost || estimatedCost || 0;
  
  const quoteValid = isQuoteValid(activity.quoteExpiresAt);
  const quoteTimeRemaining = getQuoteTimeRemaining(activity.quoteExpiresAt);
  
  // Determine booking mode using the new link type system
  const hasViatorProduct = isViatorBookable(activity);
  const hasDirectUrl = !!(activity.externalBookingUrl || activity.bookingUrl || activity.website);
  const linkType = getActivityLinkType(activity.title, activity.category, hasViatorProduct, hasDirectUrl);
  const canShowViatorLink = showVendorLink && linkType === 'vendor_booking';

  // Convert to BookableActivity format for the state machine
  const bookableActivity = {
    id: activity.id,
    tripId: '',
    title: activity.title,
    type: 'activity' as const,
    bookingState,
    bookingRequired: activity.bookingRequired || false,
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
    currency: activity.currency || 'USD',
    cost: price,
    stateHistory: [],
  };
  
  const primaryAction = getPrimaryAction(bookableActivity);

  // Use the linkType to determine what to show
  if (linkType === 'none') {
    return null;
  }

  // If booking is not required, show appropriate link based on type
  if (!activity.bookingRequired) {
    const directUrl = activity.website || activity.externalBookingUrl || activity.bookingUrl;
    
    if (linkType === 'view_details' && directUrl) {
      return (
        <a
          href={directUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 sm:gap-1.5 text-xs text-primary hover:underline min-h-[44px] sm:min-h-0 py-2 sm:py-0"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          <span className="sm:hidden">Details</span>
          <span className="hidden sm:inline">View Details</span>
        </a>
      );
    }
    if (linkType === 'view_menu' && directUrl) {
      return (
        <a
          href={directUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 sm:gap-1.5 text-xs text-primary hover:underline min-h-[44px] sm:min-h-0 py-2 sm:py-0"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          <span className="sm:hidden">Reserve</span>
          <span className="hidden sm:inline">View Menu & Reserve</span>
        </a>
      );
    }
    
    if (linkType === 'find_restaurant') {
      return (
        <RestaurantLink 
          restaurantName={activity.title} 
          destination={destination} 
        />
      );
    }
    
    // For hotel amenities without URL, show nothing
    if (isHotelAmenityActivity(activity.title, activity.category)) {
      return null;
    }
    
    // Otherwise show view details if we have a URL
    if (directUrl) {
      return (
        <a
          href={directUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 sm:gap-1.5 text-xs text-primary hover:underline min-h-[44px] sm:min-h-0 py-2 sm:py-0"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          <span className="sm:hidden">Details</span>
          <span className="hidden sm:inline">View Details</span>
        </a>
      );
    }
    
    return null;
  }

  // Dining activities - show restaurant link if available instead of booking UI
  if (linkType === 'view_menu') {
    const restaurantUrl = activity.website || activity.externalBookingUrl || activity.bookingUrl;
    return (
      <a
        href={restaurantUrl!}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 sm:gap-1.5 text-xs text-primary hover:underline"
      >
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
        <span className="sm:hidden">Reserve</span>
        <span className="hidden sm:inline">View Menu & Reserve</span>
      </a>
    );
  }
  
  if (linkType === 'find_restaurant') {
    // Prefer venue name from location over generic activity title
    const restaurantName = activity.location?.name || activity.title;
    // Restaurant lookup using venue name from location or activity title
    return (
      <RestaurantLink 
        restaurantName={restaurantName} 
        destination={destination} 
      />
    );
  }

  // Handle primary action based on state
  const handlePrimaryAction = async () => {
    switch (primaryAction.action) {
      case 'select':
        const selectResult = await selectMutation.mutateAsync(activity.id);
        if (selectResult.success) {
          onStateChange?.(activity.id, 'selected_pending');
        }
        break;
      
      case 'add_travelers':
        setShowTravelerModal(true);
        break;
      
      case 'pay':
        onPaymentRequest?.(activity.id);
        break;
      
      case 'view_voucher':
        setShowVoucherModal(true);
        break;
      
      default:
        break;
    }
  };

  const handleDeselect = async () => {
    const result = await deselectMutation.mutateAsync(activity.id);
    if (result.success) {
      onStateChange?.(activity.id, 'not_selected');
    }
  };

  // Render based on booking state
  switch (bookingState) {
    case 'not_selected':
      // MODE 1: Viator API Bookable - we process the full transaction
      if (hasViatorProduct) {
        return (
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handlePrimaryAction}
                    disabled={selectMutation.isPending}
                    className="gap-1 sm:gap-1.5 text-xs bg-primary px-2 sm:px-3 h-7 sm:h-8"
                  >
                    <Sparkles className="h-3 w-3 flex-shrink-0" />
                    <span className="sm:hidden">Book</span>
                    <span className="hidden sm:inline">{compact ? 'Book' : 'Book Now'}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Book instantly through Voyance • Confirmation in minutes</p>
                </TooltipContent>
              </Tooltip>
              {price > 0 && (
                <span className="hidden sm:inline text-xs text-muted-foreground">
                  ~{formatPrice(price)}
                </span>
              )}
            </div>
          </TooltipProvider>
        );
      }
      
      // MODE 2: External link only - use actual URL if available, otherwise vendor search
      if (canShowViatorLink) {
        // Prioritize actual booking URL from activity data over generated search
        const actualBookingUrl = activity.externalBookingUrl || activity.bookingUrl || activity.website;
        
        return (
          <div className="flex items-center gap-1 sm:gap-2">
            <VendorBookingLink
              activityName={activity.title}
              destination={destination}
              externalBookingUrl={actualBookingUrl} // Pass actual URL to avoid wrong search results
              estimatedPrice={price}
              preferredVendor="viator"
              size="sm"
            />
            {!actualBookingUrl && (
              <span className="hidden sm:inline text-[10px] text-muted-foreground">
                Search
              </span>
            )}
          </div>
        );
      }
      
      // No booking integration available - show nothing rather than broken UI
      return null;

    case 'selected_pending':
      const hasTravelers = activity.travelerData && activity.travelerData.length > 0;
      return (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
            <ShoppingCart className="h-3 w-3 mr-1" />
            In Cart
          </Badge>
          
          {!hasTravelers ? (
            <Button
              size="sm"
              variant="default"
              onClick={() => setShowTravelerModal(true)}
              className="gap-1.5 text-xs"
            >
              <Users className="h-3 w-3" />
              {compact ? 'Add Info' : 'Add Traveler Info'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              onClick={() => onPaymentRequest?.(activity.id)}
              className="gap-1.5 text-xs bg-green-600 hover:bg-green-700"
            >
              <CreditCard className="h-3 w-3" />
              Pay {formatPrice(price)}
            </Button>
          )}
          
          {activity.quoteLocked && quoteValid && (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
              <Timer className="h-3 w-3 mr-1" />
              {quoteTimeRemaining}
            </Badge>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDeselect}
            disabled={deselectMutation.isPending}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Remove
          </Button>
          
          <TravelerInfoModal
            isOpen={showTravelerModal}
            onClose={() => setShowTravelerModal(false)}
            activity={bookableActivity}
            onSave={() => {
              setShowTravelerModal(false);
              onStateChange?.(activity.id, 'selected_pending');
            }}
          />
        </div>
      );

    case 'booked_confirmed':
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-green-600 text-white text-xs">
            <Check className="h-3 w-3 mr-1" />
            Booked
          </Badge>
          
          {activity.confirmationNumber && (
            <span className="font-mono text-xs text-muted-foreground">
              #{activity.confirmationNumber}
            </span>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowVoucherModal(true)}
            className="gap-1.5 text-xs"
          >
            <Ticket className="h-3 w-3" />
            {compact ? 'Voucher' : 'View Voucher'}
          </Button>
          
          <VoucherModal
            isOpen={showVoucherModal}
            onClose={() => setShowVoucherModal(false)}
            activity={bookableActivity}
          />
        </div>
      );

    case 'cancelled':
      return (
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-xs">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
          {activity.cancelledAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(activity.cancelledAt).toLocaleDateString()}
            </span>
          )}
        </div>
      );

    case 'refunded':
      return (
        <Badge variant="secondary" className="text-xs">
          Refunded
        </Badge>
      );

    default:
      return null;
  }
}
