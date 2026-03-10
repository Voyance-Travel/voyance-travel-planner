/**
 * Booking Button Component
 * Initiates payment flow for a trip item
 */

import { useState } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Loader2, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toFriendlyError } from '@/utils/friendlyErrors';
import { 
  initiateBooking, 
  TripPayment,
  formatCurrency,
  getStatusLabel,
  getStatusColor,
  isPaid
} from '@/services/tripPaymentsAPI';

interface BookingButtonProps extends Omit<ButtonProps, 'onClick'> {
  tripId: string;
  itemType: 'flight' | 'hotel' | 'activity';
  itemId: string;
  itemName: string;
  amountCents: number;
  currency?: string;
  quantity?: number;
  externalProvider?: string;
  externalBookingUrl?: string;
  existingPayment?: TripPayment | null;
  onSuccess?: () => void;
}

export function BookingButton({
  tripId,
  itemType,
  itemId,
  itemName,
  amountCents,
  currency = 'USD',
  quantity = 1,
  externalProvider,
  externalBookingUrl,
  existingPayment,
  onSuccess,
  className,
  children,
  ...props
}: BookingButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    // If already paid, do nothing
    if (isPaid(existingPayment)) {
      toast.info('This item is already paid');
      return;
    }

    setLoading(true);

    try {
      const result = await initiateBooking({
        tripId,
        itemType,
        itemId,
        itemName,
        amountCents,
        currency,
        quantity,
        externalProvider,
        externalBookingUrl,
      });

      if (result.success && result.checkoutUrl) {
        // Open Stripe checkout in new tab
        window.open(result.checkoutUrl, '_blank');
        toast.success('Payment page opened in new tab');
        onSuccess?.();
      } else {
        toast.error(toFriendlyError(result.error));
      }
    } catch (err) {
      console.error('Booking error:', err);
      toast.error('Failed to start payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // If already paid, show paid status
  if (isPaid(existingPayment)) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
          <Check className="h-3 w-3 mr-1" />
          Paid
        </Badge>
        <span className="text-sm text-green-600 font-medium">
          {formatCurrency(existingPayment!.amount_cents * existingPayment!.quantity, existingPayment!.currency)}
        </span>
      </div>
    );
  }

  // If processing, show processing state
  if (existingPayment?.status === 'processing') {
    return (
      <Button disabled className={cn(className)} {...props}>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Processing...
      </Button>
    );
  }

  // Default: show book/pay button
  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      className={cn(className)}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Starting checkout...
        </>
      ) : (
        <>
          <CreditCard className="h-4 w-4 mr-2" />
          {children || `Pay ${formatCurrency(amountCents * quantity, currency)}`}
        </>
      )}
    </Button>
  );
}

/**
 * Compact booking badge for inline use
 */
export function BookingBadge({ 
  payment, 
  showAmount = true 
}: { 
  payment: TripPayment | null | undefined;
  showAmount?: boolean;
}) {
  if (!payment) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Not Booked
      </Badge>
    );
  }

  const statusColor = getStatusColor(payment.status);
  const statusLabel = getStatusLabel(payment.status);

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={cn(
          statusColor,
          payment.status === 'paid' && "bg-green-500/10 border-green-500/20"
        )}
      >
        {statusLabel}
      </Badge>
      {showAmount && payment.status === 'paid' && (
        <span className="text-sm text-green-600 font-medium">
          {formatCurrency(payment.amount_cents * payment.quantity, payment.currency)}
        </span>
      )}
    </div>
  );
}
