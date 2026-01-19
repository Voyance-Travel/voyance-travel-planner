/**
 * Payments Tab Component
 * Tracks all trip payments - flights, hotels, activities
 * Allows marking items as paid externally
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Plane, Hotel, Camera, Check, CreditCard, ExternalLink, 
  DollarSign, AlertCircle, CheckCircle2, Clock, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { 
  getTripPayments, 
  formatCurrency, 
  getStatusLabel, 
  getStatusColor,
  type TripPayment,
  type PaymentTotals
} from '@/services/tripPaymentsAPI';
import { BookingButton } from '@/components/booking/BookingButton';
import { toast } from 'sonner';
import type { EditorialDay } from './EditorialItinerary';

interface PaymentsTabProps {
  tripId: string;
  days: EditorialDay[];
  flightSelection?: {
    outbound?: { price?: number; airline?: string };
    return?: { price?: number; airline?: string };
    totalPrice?: number;
  } | null;
  hotelSelection?: {
    name?: string;
    totalPrice?: number;
    pricePerNight?: number;
  } | null;
  travelers: number;
}

interface PayableItem {
  id: string;
  type: 'flight' | 'hotel' | 'activity';
  name: string;
  amountCents: number;
  dayNumber?: number;
  payment?: TripPayment;
}

export function PaymentsTab({ 
  tripId, 
  days, 
  flightSelection, 
  hotelSelection,
  travelers 
}: PaymentsTabProps) {
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [totals, setTotals] = useState<PaymentTotals>({ paid: 0, pending: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [markPaidModal, setMarkPaidModal] = useState<PayableItem | null>(null);
  const [externalRef, setExternalRef] = useState('');
  const [markingPaid, setMarkingPaid] = useState(false);

  // Fetch payments
  const fetchPayments = useCallback(async () => {
    const result = await getTripPayments(tripId);
    if (result.success) {
      setPayments(result.payments || []);
      setTotals(result.totals || { paid: 0, pending: 0, total: 0 });
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Build list of all payable items
  const payableItems: PayableItem[] = [];

  // Flight
  if (flightSelection?.totalPrice) {
    const flightId = 'flight-selection';
    const flightPayment = payments.find(p => p.item_type === 'flight' && p.item_id === flightId);
    payableItems.push({
      id: flightId,
      type: 'flight',
      name: `Round-trip Flight${flightSelection.outbound?.airline ? ` (${flightSelection.outbound.airline})` : ''}`,
      amountCents: Math.round((flightSelection.totalPrice || 0) * 100),
      payment: flightPayment,
    });
  }

  // Hotel
  if (hotelSelection?.totalPrice || hotelSelection?.pricePerNight) {
    const hotelId = 'hotel-selection';
    const hotelPayment = payments.find(p => p.item_type === 'hotel' && p.item_id === hotelId);
    const hotelPrice = hotelSelection.totalPrice || (hotelSelection.pricePerNight || 0) * days.length;
    payableItems.push({
      id: hotelId,
      type: 'hotel',
      name: hotelSelection.name || 'Hotel Accommodation',
      amountCents: Math.round(hotelPrice * 100),
      payment: hotelPayment,
    });
  }

  // Activities
  days.forEach(day => {
    day.activities.forEach(activity => {
      if (activity.bookingRequired) {
        const cost = activity.cost?.amount || activity.estimatedCost?.amount || 0;
        if (cost > 0) {
          const activityPayment = payments.find(p => p.item_type === 'activity' && p.item_id === activity.id);
          payableItems.push({
            id: activity.id,
            type: 'activity',
            name: activity.title,
            amountCents: Math.round(cost * 100),
            dayNumber: day.dayNumber,
            payment: activityPayment,
          });
        }
      }
    });
  });

  // Calculate estimated total
  const estimatedTotal = payableItems.reduce((sum, item) => sum + item.amountCents, 0);
  const paidAmount = payableItems
    .filter(item => item.payment?.status === 'paid')
    .reduce((sum, item) => sum + (item.payment?.amount_cents || item.amountCents), 0);
  const unpaidAmount = estimatedTotal - paidAmount;

  // Mark item as paid externally
  const handleMarkAsPaid = async () => {
    if (!markPaidModal) return;
    
    setMarkingPaid(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upsert payment record
      const { error } = await supabase
        .from('trip_payments')
        .upsert({
          trip_id: tripId,
          user_id: user.id,
          item_type: markPaidModal.type,
          item_id: markPaidModal.id,
          item_name: markPaidModal.name,
          amount_cents: markPaidModal.amountCents,
          currency: 'USD',
          quantity: markPaidModal.type === 'flight' ? travelers : 1,
          status: 'paid',
          paid_at: new Date().toISOString(),
          external_provider: 'external',
          external_booking_id: externalRef || undefined,
        }, {
          onConflict: 'trip_id,item_type,item_id',
        });

      if (error) throw error;

      toast.success('Marked as paid');
      setMarkPaidModal(null);
      setExternalRef('');
      fetchPayments();
    } catch (err) {
      console.error('Error marking as paid:', err);
      toast.error('Failed to mark as paid');
    } finally {
      setMarkingPaid(false);
    }
  };

  // Unmark payment (remove paid status)
  const handleUnmarkPaid = async (item: PayableItem) => {
    if (!item.payment) return;
    
    try {
      const { error } = await supabase
        .from('trip_payments')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.payment.id);

      if (error) throw error;

      toast.success('Payment unmarked');
      fetchPayments();
    } catch (err) {
      console.error('Error unmarking payment:', err);
      toast.error('Failed to update');
    }
  };

  const getItemIcon = (type: 'flight' | 'hotel' | 'activity') => {
    switch (type) {
      case 'flight': return <Plane className="h-4 w-4" />;
      case 'hotel': return <Hotel className="h-4 w-4" />;
      case 'activity': return <Camera className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'paid': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'processing': return <Clock className="h-4 w-4 text-amber-600" />;
      case 'pending': return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      default: return <DollarSign className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Paid</span>
            </div>
            <p className="text-2xl font-semibold text-green-800 dark:text-green-300">
              {formatCurrency(paidAmount)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Remaining</span>
            </div>
            <p className="text-2xl font-semibold text-amber-800 dark:text-amber-300">
              {formatCurrency(unpaidAmount)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CreditCard className="h-4 w-4" />
              <span className="text-sm font-medium">Trip Total</span>
            </div>
            <p className="text-2xl font-semibold">
              {formatCurrency(estimatedTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Items List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Bookings & Payments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {payableItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No bookable items in this itinerary yet.
            </p>
          ) : (
            payableItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border",
                  item.payment?.status === 'paid' 
                    ? "bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900"
                    : "bg-card border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-full",
                    item.payment?.status === 'paid' 
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {getItemIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      {item.dayNumber && (
                        <Badge variant="outline" className="text-xs">
                          Day {item.dayNumber}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="capitalize">{item.type}</span>
                      {item.payment?.external_provider === 'external' && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            Paid externally
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.amountCents)}</p>
                    <div className="flex items-center gap-1 justify-end">
                      {getStatusIcon(item.payment?.status)}
                      <span className={cn("text-xs", getStatusColor(item.payment?.status || 'pending'))}>
                        {item.payment?.status === 'paid' ? 'Paid ✓' : 'Not paid'}
                      </span>
                    </div>
                  </div>

                  {item.payment?.status === 'paid' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnmarkPaid(item)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMarkPaidModal(item)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Mark Paid
                      </Button>
                      <BookingButton
                        tripId={tripId}
                        itemType={item.type}
                        itemId={item.id}
                        itemName={item.name}
                        amountCents={item.amountCents}
                        quantity={item.type === 'flight' ? travelers : 1}
                        existingPayment={item.payment}
                        onSuccess={fetchPayments}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payments
                .filter(p => p.status === 'paid')
                .sort((a, b) => new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime())
                .map(payment => (
                  <div key={payment.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      {getItemIcon(payment.item_type as 'flight' | 'hotel' | 'activity')}
                      <div>
                        <p className="font-medium">{payment.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {payment.paid_at 
                            ? new Date(payment.paid_at).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })
                            : 'Paid'
                          }
                          {payment.external_provider === 'external' && ' • Paid externally'}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(payment.amount_cents * (payment.quantity || 1))}
                    </span>
                  </div>
                ))
              }
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mark as Paid Modal */}
      <Dialog open={!!markPaidModal} onOpenChange={() => setMarkPaidModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Record this as paid through an external site or in person.
            </DialogDescription>
          </DialogHeader>
          
          {markPaidModal && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  {getItemIcon(markPaidModal.type)}
                  <span className="font-medium">{markPaidModal.name}</span>
                </div>
                <span className="font-semibold">{formatCurrency(markPaidModal.amountCents)}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="externalRef">Confirmation Number (optional)</Label>
                <Input
                  id="externalRef"
                  placeholder="e.g., Viator booking #, hotel confirmation"
                  value={externalRef}
                  onChange={(e) => setExternalRef(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Add a reference number to help you track this booking
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleMarkAsPaid} disabled={markingPaid}>
              {markingPaid ? 'Saving...' : 'Mark as Paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
