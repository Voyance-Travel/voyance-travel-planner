/**
 * Inline Booking Actions Component
 * 
 * A compact, inline version of booking controls for use within ActivityRow.
 * Shows appropriate actions based on booking state.
 */

import { useState } from 'react';
import { 
  ShoppingCart, Users, CreditCard, Ticket, XCircle, 
  Timer, Check, AlertCircle, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export interface InlineBookingActivity {
  id: string;
  title: string;
  category?: string;
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
  externalBookingUrl?: string;
  currency?: string;
  cost?: number;
  website?: string;
}

interface InlineBookingActionsProps {
  activity: InlineBookingActivity;
  destination: string;
  estimatedCost?: number;
  onPaymentRequest?: (activityId: string) => void;
  onStateChange?: (activityId: string, newState: BookingItemState) => void;
  showVendorLink?: boolean;
  compact?: boolean;
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
];

function isDiningActivity(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  return DINING_KEYWORDS.some(keyword => lowerTitle.includes(keyword));
}

function isNonBookableActivity(title: string, category?: string): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerCategory = (category || '').toLowerCase();
  
  // Check keywords
  if (NON_BOOKABLE_KEYWORDS.some(keyword => lowerTitle.includes(keyword))) {
    return true;
  }
  
  // Check categories that should never show booking
  if (['transport', 'transportation', 'accommodation', 'downtime', 'free_time'].includes(lowerCategory)) {
    return true;
  }
  
  return false;
}

export function InlineBookingActions({
  activity,
  destination,
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
  
  // Hide Viator booking link for dining and non-bookable activities
  const canShowViatorLink = showVendorLink && !isDiningActivity(activity.title) && !isNonBookableActivity(activity.title, activity.category);

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

  // If booking is not required, show external link or nothing
  if (!activity.bookingRequired) {
    if (activity.website) {
      return (
        <a
          href={activity.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View Details
        </a>
      );
    }
    return null;
  }

  // Dining activities cannot be booked - no booking actions shown
  if (isDiningActivity(activity.title)) {
    return null;
  }

  // Non-bookable activities (hotel checkout, free time, transport, etc.) - no booking UI
  if (isNonBookableActivity(activity.title, activity.category)) {
    return null;
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
      // Show "Add to Trip" or vendor link (but not for dining activities)
      if (canShowViatorLink && !activity.externalBookingUrl) {
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrimaryAction}
              disabled={selectMutation.isPending}
              className="gap-1.5 text-xs"
            >
              <ShoppingCart className="h-3 w-3" />
              {compact ? 'Add' : 'Add to Trip'}
            </Button>
            <VendorBookingLink
              activityName={activity.title}
              destination={destination}
              estimatedPrice={price}
              preferredVendor="viator"
              size="sm"
            />
          </div>
        );
      }
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={handlePrimaryAction}
          disabled={selectMutation.isPending}
          className="gap-1.5 text-xs"
        >
          <ShoppingCart className="h-3 w-3" />
          {compact ? 'Add' : 'Add to Trip'}
        </Button>
      );

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
