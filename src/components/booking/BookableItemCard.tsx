/**
 * Bookable Item Card Component
 * 
 * A stateful card for itinerary activities that adapts based on booking state:
 * - not_selected: "Add to Trip" button
 * - selected_pending: Traveler info form + price quote + "Pay" button
 * - booked_confirmed: Voucher view + confirmation + "Cancel/Modify" options
 * - cancelled/refunded: Audit trail + status display
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, MapPin, DollarSign, Check, AlertCircle, ExternalLink,
  ShoppingCart, Users, CreditCard, Ticket, XCircle, RotateCcw,
  ChevronDown, ChevronUp, Timer, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import { formatTime12h } from '@/utils/timeFormat';
import {
  BookableActivity,
  BookingItemState,
  getStateLabel,
  getStateColor,
  getPrimaryAction,
  isQuoteValid,
  getQuoteTimeRemaining,
  useSelectActivity,
  useDeselectActivity,
  useCancelBooking,
} from '@/services/bookingStateMachine';
import { TravelerInfoModal } from './TravelerInfoModal';
import { VoucherModal } from './VoucherModal';
import { formatPrice } from '@/utils/bookingUtils';

interface BookableItemCardProps {
  activity: BookableActivity;
  destination?: string;
  onPaymentRequest?: (activity: BookableActivity) => void;
  onStateChange?: (activity: BookableActivity, newState: BookingItemState) => void;
  compact?: boolean;
}

export function BookableItemCard({
  activity,
  destination = '',
  onPaymentRequest,
  onStateChange,
  compact = false,
}: BookableItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showTravelerModal, setShowTravelerModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  
  const selectMutation = useSelectActivity();
  const deselectMutation = useDeselectActivity();
  const cancelMutation = useCancelBooking();

  const primaryAction = getPrimaryAction(activity);
  const stateColor = getStateColor(activity.bookingState);
  const stateLabel = getStateLabel(activity.bookingState);
  
  const estimatedPrice = activity.quotePriceCents 
    ? activity.quotePriceCents / 100 
    : activity.cost || 0;
  
  const quoteValid = isQuoteValid(activity.quoteExpiresAt);
  const quoteTimeRemaining = getQuoteTimeRemaining(activity.quoteExpiresAt);

  const handlePrimaryAction = async () => {
    switch (primaryAction.action) {
      case 'select':
        const selectResult = await selectMutation.mutateAsync(activity.id);
        if (selectResult.success) {
          onStateChange?.(activity, 'selected_pending');
        }
        break;
      
      case 'add_travelers':
        setShowTravelerModal(true);
        break;
      
      case 'pay':
        onPaymentRequest?.(activity);
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
      onStateChange?.(activity, 'not_selected');
    }
  };

  const handleCancel = async () => {
    const result = await cancelMutation.mutateAsync({ 
      activityId: activity.id, 
      reason: 'User cancelled' 
    });
    if (result.success) {
      onStateChange?.(activity, 'cancelled');
    }
  };

  // Price display component
  const PriceDisplay = () => {
    if (!activity.bookingRequired) {
      return <Badge variant="secondary" className="text-xs">Free</Badge>;
    }

    const isLocked = activity.quoteLocked && quoteValid;
    
    return (
      <div className="flex items-center gap-2">
        <span className={cn(
          "font-semibold",
          isLocked ? "text-green-600" : "text-muted-foreground"
        )}>
          {formatPrice(estimatedPrice, activity.currency)}
        </span>
        {!isLocked && activity.bookingState === 'not_selected' && (
          <span className="text-xs text-muted-foreground">est.</span>
        )}
        {isLocked && (
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
            <Timer className="h-3 w-3 mr-1" />
            {quoteTimeRemaining}
          </Badge>
        )}
      </div>
    );
  };

  // State-specific details
  const StateDetails = () => {
    switch (activity.bookingState) {
      case 'selected_pending':
        return (
          <div className="space-y-2 text-sm">
            {activity.travelerData?.length ? (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-4 w-4" />
                <span>{activity.travelerData.length} traveler(s) added</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span>Traveler information required</span>
              </div>
            )}
            {activity.quoteLocked && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Price locked for {quoteTimeRemaining}</span>
              </div>
            )}
          </div>
        );
      
      case 'booked_confirmed':
        return (
          <div className="space-y-2 text-sm">
            {activity.confirmationNumber && (
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-green-600" />
                <span className="font-mono text-xs">{activity.confirmationNumber}</span>
              </div>
            )}
            {activity.vendorName && (
              <div className="text-muted-foreground">
                Booked via {activity.vendorName}
              </div>
            )}
            {activity.cancellationPolicy && (
              <div className="text-xs text-muted-foreground">
                Free cancellation until {new Date(activity.cancellationPolicy.deadline).toLocaleDateString()}
              </div>
            )}
          </div>
        );
      
      case 'cancelled':
        return (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <XCircle className="h-4 w-4" />
            <span>Cancelled on {activity.cancelledAt ? new Date(activity.cancelledAt).toLocaleDateString() : 'N/A'}</span>
          </div>
        );
      
      case 'refunded':
        return (
          <div className="flex items-center gap-2 text-sm text-purple-600">
            <RotateCcw className="h-4 w-4" />
            <span>
              Refunded {activity.refundAmountCents 
                ? formatPrice(activity.refundAmountCents / 100, activity.currency) 
                : ''}
            </span>
          </div>
        );
      
      default:
        return null;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-card border rounded-lg">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={stateColor}>
            {stateLabel}
          </Badge>
          <span className="font-medium text-sm">{sanitizeActivityName(activity.title, { category: (activity as any).category, startTime: (activity as any).startTime })}</span>
        </div>
        <div className="flex items-center gap-2">
          <PriceDisplay />
          <Button
            size="sm"
            variant={primaryAction.variant}
            onClick={handlePrimaryAction}
            disabled={primaryAction.disabled || selectMutation.isPending}
          >
            {primaryAction.label}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Card className={cn(
        "overflow-hidden transition-all",
        activity.bookingState === 'booked_confirmed' && "ring-2 ring-green-500/20",
        activity.bookingState === 'cancelled' && "opacity-75",
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={stateColor}>
                  {stateLabel}
                </Badge>
                {activity.bookingRequired && (
                  <Badge variant="secondary" className="text-xs">
                    Booking Required
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-foreground">{sanitizeActivityName(activity.title, { category: (activity as any).category, startTime: (activity as any).startTime })}</h3>
              {activity.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {activity.description}
                </p>
              )}
            </div>
            <PriceDisplay />
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Activity meta info */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {activity.startTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatTime12h(activity.startTime)}{activity.endTime && ` - ${formatTime12h(activity.endTime)}`}</span>
              </div>
            )}
            {activity.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate max-w-[180px]">
                  {typeof activity.location === 'string' 
                    ? activity.location 
                    : (activity.location as { name?: string; address?: string }).name || 
                      (activity.location as { name?: string; address?: string }).address}
                </span>
              </div>
            )}
          </div>

          {/* State-specific details */}
          <StateDetails />

          <Separator />

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* Primary action */}
              <Button
                size="sm"
                variant={primaryAction.variant}
                onClick={handlePrimaryAction}
                disabled={primaryAction.disabled || selectMutation.isPending || deselectMutation.isPending}
              >
                {primaryAction.action === 'select' && <ShoppingCart className="h-4 w-4 mr-1" />}
                {primaryAction.action === 'add_travelers' && <Users className="h-4 w-4 mr-1" />}
                {primaryAction.action === 'pay' && <CreditCard className="h-4 w-4 mr-1" />}
                {primaryAction.action === 'view_voucher' && <Ticket className="h-4 w-4 mr-1" />}
                {primaryAction.label}
              </Button>

              {/* Secondary actions based on state */}
              {activity.bookingState === 'selected_pending' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDeselect}
                  disabled={deselectMutation.isPending}
                >
                  Remove
                </Button>
              )}
              
              {activity.bookingState === 'booked_confirmed' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={handleCancel}
                  disabled={cancelMutation.isPending}
                >
                  Cancel
                </Button>
              )}
            </div>

            {/* External booking link for non-native bookings */}
            {activity.externalBookingUrl && activity.bookingState === 'not_selected' && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                asChild
              >
                <a href={activity.externalBookingUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Book externally
                </a>
              </Button>
            )}
          </div>

          {/* Expandable state history */}
          {activity.stateHistory && activity.stateHistory.length > 0 && (
            <Collapsible open={expanded} onOpenChange={setExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <History className="h-3 w-3" />
                    Booking history ({activity.stateHistory.length})
                  </span>
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 space-y-1"
                  >
                    {activity.stateHistory.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-[10px]">
                          {new Date(entry.at).toLocaleDateString()}
                        </span>
                        <span>{entry.from || 'New'} → {entry.to}</span>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <TravelerInfoModal
        isOpen={showTravelerModal}
        onClose={() => setShowTravelerModal(false)}
        activity={activity}
        onSave={() => {
          setShowTravelerModal(false);
        }}
      />

      <VoucherModal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        activity={activity}
      />
    </>
  );
}

export default BookableItemCard;
