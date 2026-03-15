/**
 * Voucher Modal
 * 
 * Displays booking confirmation, voucher, and management options.
 */

import { 
  Download, ExternalLink, Copy, Check, Calendar, Clock, 
  MapPin, Users, AlertTriangle, QrCode, Ticket
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { BookableActivity, getStateLabel, getStateColor } from '@/services/bookingStateMachine';
import { formatPrice } from '@/utils/bookingUtils';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import { formatTime12h } from '@/utils/timeFormat';
import { useState } from 'react';

interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: BookableActivity;
}

export function VoucherModal({
  isOpen,
  onClose,
  activity,
}: VoucherModalProps) {
  const [copied, setCopied] = useState(false);
  
  const stateColor = getStateColor(activity.bookingState);
  const stateLabel = getStateLabel(activity.bookingState);

  const handleCopyConfirmation = () => {
    if (activity.confirmationNumber) {
      navigator.clipboard.writeText(activity.confirmationNumber);
      setCopied(true);
      toast.success('Confirmation number copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadVoucher = () => {
    if (activity.voucherUrl) {
      window.open(activity.voucherUrl, '_blank');
    } else {
      toast.info('Voucher download not available');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            <DialogTitle>Booking Confirmation</DialogTitle>
          </div>
          <DialogDescription>
            Your booking details for "{sanitizeActivityName(activity.title)}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={stateColor}>
              {stateLabel}
            </Badge>
            {activity.bookedAt && (
              <span className="text-xs text-muted-foreground">
                Booked on {new Date(activity.bookedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Confirmation Number */}
          {activity.confirmationNumber && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Confirmation Number</div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-bold tracking-wider">
                    {activity.confirmationNumber}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyConfirmation}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity Details */}
          <div className="space-y-3">
            <h4 className="font-medium">{sanitizeActivityName(activity.title)}</h4>
            
            {activity.description && (
              <p className="text-sm text-muted-foreground">{activity.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {activity.startTime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{formatTime12h(activity.startTime)}</span>
                </div>
              )}
              
              {activity.location && (
                <div className="flex items-center gap-2 col-span-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {typeof activity.location === 'string' 
                      ? activity.location 
                      : (activity.location as { name?: string; address?: string }).name || 
                        (activity.location as { name?: string; address?: string }).address}
                  </span>
                </div>
              )}
              
              {activity.travelerData && activity.travelerData.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{activity.travelerData.length} traveler(s)</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Price Paid */}
          {activity.quotePriceCents && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="font-semibold text-lg">
                {formatPrice(activity.quotePriceCents / 100, activity.currency)}
              </span>
            </div>
          )}

          {/* Vendor Info */}
          {activity.vendorName && (
            <div className="text-sm text-muted-foreground">
              Booked via <span className="font-medium">{activity.vendorName}</span>
              {activity.vendorBookingId && (
                <span className="ml-1">(Ref: {activity.vendorBookingId})</span>
              )}
            </div>
          )}

          {/* Voucher Data */}
          {activity.voucherData && (
            <div className="space-y-2">
              {activity.voucherData.qrCode && (
                <div className="flex justify-center p-4 bg-white rounded-lg border">
                  <div className="text-center">
                    <QrCode className="h-24 w-24 mx-auto text-foreground" />
                    <p className="text-xs text-muted-foreground mt-2">
                      Present this QR code at venue
                    </p>
                  </div>
                </div>
              )}
              
              {activity.voucherData.redemptionInstructions && (
                <div className="text-sm bg-muted/50 p-3 rounded-lg">
                  <p className="font-medium text-xs text-muted-foreground mb-1">
                    Redemption Instructions
                  </p>
                  <p>{activity.voucherData.redemptionInstructions}</p>
                </div>
              )}
            </div>
          )}

          {/* Cancellation Policy */}
          {activity.cancellationPolicy && (
            <div className="text-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-400">
                    Cancellation Policy
                  </p>
                  <p className="text-amber-700 dark:text-amber-500">
                    {activity.cancellationPolicy.description}
                  </p>
                  {activity.cancellationPolicy.deadline && (
                    <p className="text-xs text-amber-600 mt-1">
                      Free cancellation until {new Date(activity.cancellationPolicy.deadline).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Refund info for cancelled/refunded bookings */}
          {(activity.bookingState === 'cancelled' || activity.bookingState === 'refunded') && (
            <div className="text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-3 rounded-lg">
              <p className="font-medium text-red-800 dark:text-red-400">
                {activity.bookingState === 'refunded' ? 'Refund Processed' : 'Booking Cancelled'}
              </p>
              {activity.refundAmountCents && (
                <p className="text-red-700 dark:text-red-500">
                  Refunded: {formatPrice(activity.refundAmountCents / 100, activity.currency)}
                </p>
              )}
              {activity.cancelledAt && (
                <p className="text-xs text-red-600 mt-1">
                  Cancelled on {new Date(activity.cancelledAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {activity.voucherUrl && (
            <Button 
              variant="outline" 
              onClick={handleDownloadVoucher}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Voucher
            </Button>
          )}
          
          {activity.externalBookingUrl && (
            <Button 
              variant="outline"
              asChild
              className="w-full sm:w-auto"
            >
              <a href={activity.externalBookingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View on {activity.vendorName || 'Vendor'}
              </a>
            </Button>
          )}

          <Button onClick={onClose} className="w-full sm:w-auto">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default VoucherModal;
