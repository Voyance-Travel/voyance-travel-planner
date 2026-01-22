/**
 * Payments Tab Component - Editorial Redesign
 * Tracks all trip payments with group splitting support
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plane, Hotel, Camera, Check, CreditCard, ExternalLink, 
  AlertCircle, CheckCircle2, Users, ChevronDown, Receipt,
  Wallet, X, UserPlus, Split
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { 
  getTripPayments, 
  formatCurrency, 
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

interface GroupMember {
  id: string;
  name: string;
  email?: string;
  amountOwed: number;
  amountPaid: number;
  isOrganizer?: boolean;
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
  const [expandedCategory, setExpandedCategory] = useState<string | null>('essentials');
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Mock group members - would come from trip_members table
  const [groupMembers] = useState<GroupMember[]>([
    { id: '1', name: 'You', isOrganizer: true, amountOwed: 0, amountPaid: 0 },
  ]);

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

  // Calculate totals
  const estimatedTotal = payableItems.reduce((sum, item) => sum + item.amountCents, 0);
  const paidAmount = payableItems
    .filter(item => item.payment?.status === 'paid')
    .reduce((sum, item) => sum + item.amountCents, 0);
  const unpaidAmount = estimatedTotal - paidAmount;
  const progressPercent = estimatedTotal > 0 ? (paidAmount / estimatedTotal) * 100 : 0;

  // Group items by category
  const essentialItems = payableItems.filter(i => i.type === 'flight' || i.type === 'hotel');
  const activityItems = payableItems.filter(i => i.type === 'activity');

  const handleMarkAsPaid = async () => {
    if (!markPaidModal) return;
    setMarkingPaid(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('trip_payments').insert({
        trip_id: tripId,
        user_id: user.id,
        item_type: markPaidModal.type,
        item_id: markPaidModal.id,
        item_name: markPaidModal.name,
        amount_cents: markPaidModal.amountCents,
        currency: 'USD',
        quantity: 1,
        status: 'paid',
        external_provider: 'external',
        external_booking_id: externalRef || undefined,
        paid_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success('Marked as paid');
      setMarkPaidModal(null);
      setExternalRef('');
      fetchPayments();
    } catch (err) {
      console.error('Error marking paid:', err);
      toast.error('Failed to update');
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleUnmarkPaid = async (item: PayableItem) => {
    if (!item.payment) return;

    try {
      const { error } = await supabase
        .from('trip_payments')
        .delete()
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const renderPayableItem = (item: PayableItem) => {
    const isPaid = item.payment?.status === 'paid';
    
    return (
      <motion.div
        key={`${item.type}-${item.id}`}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "flex items-center justify-between py-3 border-b border-border/50 last:border-0",
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            isPaid ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
          )}>
            {isPaid ? <Check className="h-4 w-4" /> : getItemIcon(item.type)}
          </div>
          <div className="min-w-0">
            <p className={cn("font-medium text-sm truncate", isPaid && "text-muted-foreground line-through")}>
              {item.name}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {item.dayNumber && <span>Day {item.dayNumber}</span>}
              {item.payment?.external_provider === 'external' && (
                <span className="flex items-center gap-0.5">
                  <ExternalLink className="h-3 w-3" />
                  External
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn("font-medium text-sm", isPaid && "text-green-600")}>
            {formatCurrency(item.amountCents)}
          </span>
          
          {isPaid ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => handleUnmarkPaid(item)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setMarkPaidModal(item)}
              >
                <Check className="h-3 w-3 mr-1" />
                Paid
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
                className="h-7 text-xs"
              />
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Progress Header */}
      <div className="bg-gradient-to-r from-primary/5 via-background to-accent/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Trip Budget</h3>
            <p className="text-sm text-muted-foreground">
              {Math.round(progressPercent)}% of trip paid
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-primary">{formatCurrency(estimatedTotal)}</p>
            <p className="text-xs text-muted-foreground">Total estimated</p>
          </div>
        </div>
        
        <Progress value={progressPercent} className="h-2 mb-4" />
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">{formatCurrency(paidAmount)}</p>
              <p className="text-xs text-muted-foreground">Paid</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium">{formatCurrency(unpaidAmount)}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs for Individual vs Group */}
      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-9">
          <TabsTrigger value="expenses" className="text-sm gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="group" className="text-sm gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Split Bill
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-4 space-y-4">
          {/* Essentials Category */}
          {essentialItems.length > 0 && (
            <Card className="overflow-hidden">
              <button
                onClick={() => setExpandedCategory(expandedCategory === 'essentials' ? null : 'essentials')}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium">Travel Essentials</h4>
                    <p className="text-xs text-muted-foreground">Flights & Accommodation</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(essentialItems.reduce((sum, i) => sum + i.amountCents, 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {essentialItems.filter(i => i.payment?.status === 'paid').length}/{essentialItems.length} paid
                    </p>
                  </div>
                  <ChevronDown className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform",
                    expandedCategory === 'essentials' && "rotate-180"
                  )} />
                </div>
              </button>
              <AnimatePresence>
                {expandedCategory === 'essentials' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <CardContent className="pt-0 pb-4">
                      {essentialItems.map(renderPayableItem)}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          )}

          {/* Activities Category */}
          {activityItems.length > 0 && (
            <Card className="overflow-hidden">
              <button
                onClick={() => setExpandedCategory(expandedCategory === 'activities' ? null : 'activities')}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Camera className="h-5 w-5 text-accent" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium">Activities & Experiences</h4>
                    <p className="text-xs text-muted-foreground">{activityItems.length} bookable items</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(activityItems.reduce((sum, i) => sum + i.amountCents, 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activityItems.filter(i => i.payment?.status === 'paid').length}/{activityItems.length} paid
                    </p>
                  </div>
                  <ChevronDown className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform",
                    expandedCategory === 'activities' && "rotate-180"
                  )} />
                </div>
              </button>
              <AnimatePresence>
                {expandedCategory === 'activities' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <CardContent className="pt-0 pb-4">
                      {activityItems.map(renderPayableItem)}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          )}

          {payableItems.length === 0 && (
            <Card className="p-8 text-center">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No bookable items in this itinerary yet.</p>
              <p className="text-sm text-muted-foreground/75 mt-1">Add activities that require booking to see them here.</p>
            </Card>
          )}

          {/* Payment History */}
          {payments.filter(p => p.status === 'paid').length > 0 && (
            <div className="pt-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Recent Payments
              </h4>
              <div className="space-y-2">
                {payments
                  .filter(p => p.status === 'paid')
                  .sort((a, b) => new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime())
                  .slice(0, 5)
                  .map(payment => (
                    <div key={payment.id} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{payment.item_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-xs">
                          {payment.paid_at 
                            ? new Date(payment.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : 'Paid'
                          }
                        </span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(payment.amount_cents * (payment.quantity || 1))}
                        </span>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="group" className="mt-4">
          <Card className="p-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Split className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Split the Bill</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Invite your travel companions and split costs evenly or assign specific expenses to each person.
              </p>

              {/* Current Members */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {groupMembers.map((member, idx) => (
                  <div 
                    key={member.id}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium",
                      member.isOrganizer ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                    title={member.name}
                  >
                    {member.name.charAt(0)}
                  </div>
                ))}
                <button 
                  onClick={() => setShowGroupModal(true)}
                  className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setShowGroupModal(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Members
                </Button>
                <Button onClick={() => setShowGroupModal(true)}>
                  <Split className="h-4 w-4 mr-2" />
                  Configure Split
                </Button>
              </div>

              {travelers > 1 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">
                    If split equally among {travelers} travelers:
                  </p>
                  <p className="text-xl font-semibold text-primary">
                    {formatCurrency(Math.round(estimatedTotal / travelers))} per person
                  </p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mark as Paid Modal */}
      <Dialog open={!!markPaidModal} onOpenChange={() => setMarkPaidModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Record this as paid through an external site or in person.
            </DialogDescription>
          </DialogHeader>
          
          {markPaidModal && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  {getItemIcon(markPaidModal.type)}
                  <span className="font-medium text-sm">{markPaidModal.name}</span>
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

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMarkPaidModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleMarkAsPaid} disabled={markingPaid}>
              {markingPaid ? 'Saving...' : 'Mark as Paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Setup Modal */}
      <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Group Payment Setup</DialogTitle>
            <DialogDescription>
              Invite travel companions and configure how to split costs.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Invite by Email</Label>
              <div className="flex gap-2 mt-2">
                <Input placeholder="friend@email.com" className="flex-1" />
                <Button>Send Invite</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                They'll be able to view the itinerary and track their share of expenses.
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <Label className="mb-3 block">Split Method</Label>
              <div className="grid grid-cols-2 gap-3">
                <button className="p-4 rounded-lg border-2 border-primary bg-primary/5 text-left">
                  <div className="font-medium mb-1">Equal Split</div>
                  <p className="text-xs text-muted-foreground">Divide all costs evenly</p>
                </button>
                <button className="p-4 rounded-lg border border-border hover:border-primary/50 text-left transition-colors">
                  <div className="font-medium mb-1">Custom Split</div>
                  <p className="text-xs text-muted-foreground">Assign specific items to members</p>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success('Group payment feature coming soon!');
              setShowGroupModal(false);
            }}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
