/**
 * Payments Tab Component - Editorial Redesign
 * Tracks all trip payments with group splitting and member assignment support
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plane, Hotel, Camera, Check, CreditCard, ExternalLink, 
  CheckCircle2, Users, ChevronDown, Receipt,
  Wallet, X, User, Plus, UserPlus, AlertCircle, Split
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { 
  getTripPayments, 
  formatCurrency, 
  type TripPayment,
  type PaymentTotals
} from '@/services/tripPaymentsAPI';
import { useTripMembers, type TripMember } from '@/services/tripBudgetAPI';
import { useTripCollaborators } from '@/services/tripCollaboratorsAPI';
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
  /** Budget limit in cents from BudgetTab - shows spending limit */
  budgetLimitCents?: number;
}

interface PayableItem {
  id: string;
  type: 'flight' | 'hotel' | 'activity';
  name: string;
  amountCents: number;
  dayNumber?: number;
  payment?: TripPayment;
  assignedMemberId?: string;
}

export function PaymentsTab({ 
  tripId, 
  days, 
  flightSelection, 
  hotelSelection,
  travelers,
  budgetLimitCents 
}: PaymentsTabProps) {
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [totals, setTotals] = useState<PaymentTotals>({ paid: 0, pending: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [markPaidModal, setMarkPaidModal] = useState<PayableItem | null>(null);
  const [externalRef, setExternalRef] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [markingPaid, setMarkingPaid] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('essentials');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [assigningItem, setAssigningItem] = useState<PayableItem | null>(null);
  const [assignMemberId, setAssignMemberId] = useState<string>('');
  
  // Manual entry states
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseType, setNewExpenseType] = useState<'flight' | 'hotel' | 'activity'>('flight');
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  // Fetch real trip members and collaborators
  const { data: rawTripMembers = [], isLoading: membersLoading } = useTripMembers(tripId);
  const { data: collaborators = [] } = useTripCollaborators(tripId);

  // Merge collaborators into trip members so they appear in Split Bill automatically
  const tripMembers: TripMember[] = useMemo(() => {
    const memberUserIds = new Set(rawTripMembers.map(m => m.userId).filter(Boolean));
    const memberEmails = new Set(rawTripMembers.map(m => m.email?.toLowerCase()).filter(Boolean));
    
    // Start with existing trip_members
    const merged = [...rawTripMembers];
    
    // Add collaborators that aren't already in trip_members
    for (const collab of collaborators) {
      const profileName = collab.profile?.display_name || collab.profile?.handle;
      if (collab.user_id && !memberUserIds.has(collab.user_id)) {
        merged.push({
          id: `collab-${collab.id}`,
          tripId: collab.trip_id,
          userId: collab.user_id,
          email: profileName || collab.user_id,
          name: profileName || null,
          role: 'attendee' as const,
          invitedAt: collab.created_at,
          acceptedAt: collab.accepted_at,
        });
      }
    }
    
    return merged;
  }, [rawTripMembers, collaborators]);

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
  const payableItems: PayableItem[] = useMemo(() => {
    const items: PayableItem[] = [];

    // Flight from selection
    if (flightSelection?.totalPrice) {
      const flightId = 'flight-selection';
      const flightPayment = payments.find(p => p.item_type === 'flight' && p.item_id === flightId);
      items.push({
        id: flightId,
        type: 'flight',
        name: `Round-trip Flight${flightSelection.outbound?.airline ? ` (${flightSelection.outbound.airline})` : ''}`,
        amountCents: Math.round((flightSelection.totalPrice || 0) * 100),
        payment: flightPayment,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assignedMemberId: (flightPayment as any)?.assigned_member_id,
      });
    }

    // Hotel from selection
    if (hotelSelection?.totalPrice || hotelSelection?.pricePerNight) {
      const hotelId = 'hotel-selection';
      const hotelPayment = payments.find(p => p.item_type === 'hotel' && p.item_id === hotelId);
      const hotelPrice = hotelSelection.totalPrice || (hotelSelection.pricePerNight || 0) * days.length;
      items.push({
        id: hotelId,
        type: 'hotel',
        name: hotelSelection.name || 'Hotel Accommodation',
        amountCents: Math.round(hotelPrice * 100),
        payment: hotelPayment,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assignedMemberId: (hotelPayment as any)?.assigned_member_id,
      });
    }

    // Manually added expenses from payments (not tied to flight/hotel selection or itinerary)
    const manualFlights = payments.filter(p => 
      p.item_type === 'flight' && p.item_id.startsWith('manual-')
    );
    manualFlights.forEach(p => {
      items.push({
        id: p.item_id,
        type: 'flight',
        name: p.item_name,
        amountCents: p.amount_cents,
        payment: p,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assignedMemberId: (p as any)?.assigned_member_id,
      });
    });

    const manualHotels = payments.filter(p => 
      p.item_type === 'hotel' && p.item_id.startsWith('manual-')
    );
    manualHotels.forEach(p => {
      items.push({
        id: p.item_id,
        type: 'hotel',
        name: p.item_name,
        amountCents: p.amount_cents,
        payment: p,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assignedMemberId: (p as any)?.assigned_member_id,
      });
    });

    // Activities from itinerary - include ALL activities with costs (not just bookingRequired)
    // Filter out non-payable activities like free time, downtime, check-in/out
    // NOTE: Transport activities WITH costs (taxis, metro, transfers) ARE included
    const NON_PAYABLE_KEYWORDS = [
      'free time', 'downtime', 'leisure time', 'at leisure', 'rest', 'sleep',
      'check-in', 'check-out', 'checkin', 'checkout', 'check in', 'check out',
      'arrival at', 'departure from', 'packing',
    ];
    const NON_PAYABLE_CATEGORIES = ['downtime', 'free_time'];

    days.forEach(day => {
      day.activities.forEach(activity => {
        const cost = activity.cost?.amount || activity.estimatedCost?.amount || 0;
        if (cost > 0) {
          // Skip non-payable activities
          const titleLower = (activity.title || '').toLowerCase();
          const catLower = (activity.type || activity.category || '').toLowerCase();
          const isNonPayable = NON_PAYABLE_KEYWORDS.some(kw => titleLower.includes(kw)) ||
            NON_PAYABLE_CATEGORIES.includes(catLower) ||
            activity.timeBlockType === 'downtime';
          if (isNonPayable) return;

          const activityPayment = payments.find(p => p.item_type === 'activity' && p.item_id === activity.id);
          items.push({
            id: activity.id,
            type: 'activity',
            name: activity.title,
            amountCents: Math.round(cost * 100),
            dayNumber: day.dayNumber,
            payment: activityPayment,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            assignedMemberId: (activityPayment as any)?.assigned_member_id,
          });
        }
      });
    });

    // Manual activities
    const manualActivities = payments.filter(p => 
      p.item_type === 'activity' && p.item_id.startsWith('manual-')
    );
    manualActivities.forEach(p => {
      items.push({
        id: p.item_id,
        type: 'activity',
        name: p.item_name,
        amountCents: p.amount_cents,
        payment: p,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assignedMemberId: (p as any)?.assigned_member_id,
      });
    });

    return items;
  }, [flightSelection, hotelSelection, days, payments]);

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

  // Calculate per-member breakdown
  const memberBreakdown = useMemo(() => {
    const breakdown = new Map<string, { assigned: number; paid: number; items: PayableItem[] }>();
    
    // Initialize with all members
    tripMembers.forEach(m => {
      breakdown.set(m.id, { assigned: 0, paid: 0, items: [] });
    });
    
    // Add "unassigned" category
    breakdown.set('unassigned', { assigned: 0, paid: 0, items: [] });

    payableItems.forEach(item => {
      const memberId = item.assignedMemberId || 'unassigned';
      const current = breakdown.get(memberId) || { assigned: 0, paid: 0, items: [] };
      
      current.assigned += item.amountCents;
      if (item.payment?.status === 'paid') {
        current.paid += item.amountCents;
      }
      current.items.push(item);
      
      breakdown.set(memberId, current);
    });

    return breakdown;
  }, [tripMembers, payableItems]);

  const handleMarkAsPaid = async () => {
    if (!markPaidModal) return;
    setMarkingPaid(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('trip_payments').insert({
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
        assigned_member_id: selectedMemberId || null,
        paid_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success('Marked as paid');
      setMarkPaidModal(null);
      setExternalRef('');
      setSelectedMemberId('');
      fetchPayments();
    } catch (err) {
      console.error('Error marking paid:', err);
      toast.error('Failed to update');
    } finally {
      setMarkingPaid(false);
    }
  };

  // Handle adding manual expense
  const handleAddExpense = async () => {
    if (!newExpenseName.trim() || !newExpenseAmount) return;
    setSavingExpense(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const amountCents = Math.round(parseFloat(newExpenseAmount) * 100);
      if (isNaN(amountCents) || amountCents <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('trip_payments').insert({
        trip_id: tripId,
        user_id: user.id,
        item_type: newExpenseType,
        item_id: `manual-${Date.now()}`,
        item_name: newExpenseName.trim(),
        amount_cents: amountCents,
        currency: 'USD',
        quantity: 1,
        status: 'paid',
        external_provider: 'manual',
        paid_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success('Expense added');
      setShowAddExpenseModal(false);
      setNewExpenseName('');
      setNewExpenseAmount('');
      setNewExpenseType('flight');
      fetchPayments();
    } catch (err) {
      console.error('Error adding expense:', err);
      toast.error('Failed to add expense');
    } finally {
      setSavingExpense(false);
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

  const handleAssignMember = async () => {
    if (!assigningItem) return;
    
    try {
      if (assigningItem.payment) {
        // Update existing payment
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('trip_payments')
          .update({ assigned_member_id: assignMemberId || null })
          .eq('id', assigningItem.payment.id);
        
        if (error) throw error;
      } else {
        // Create a pending payment record with assignment
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('trip_payments').insert({
          trip_id: tripId,
          user_id: user.id,
          item_type: assigningItem.type,
          item_id: assigningItem.id,
          item_name: assigningItem.name,
          amount_cents: assigningItem.amountCents,
          currency: 'USD',
          quantity: 1,
          status: 'pending',
          assigned_member_id: assignMemberId || null,
        });

        if (error) throw error;
      }

      toast.success('Assignment updated');
      setAssigningItem(null);
      setAssignMemberId('');
      fetchPayments();
    } catch (err) {
      console.error('Error assigning member:', err);
      toast.error('Failed to assign');
    }
  };

  const getItemIcon = (type: 'flight' | 'hotel' | 'activity') => {
    switch (type) {
      case 'flight': return <Plane className="h-4 w-4" />;
      case 'hotel': return <Hotel className="h-4 w-4" />;
      case 'activity': return <Camera className="h-4 w-4" />;
    }
  };

  const getMemberName = (memberId: string) => {
    const member = tripMembers.find(m => m.id === memberId);
    return member?.name || member?.email?.split('@')[0] || 'Unknown';
  };

  const getMemberInitials = (member: TripMember) => {
    if (member.name) {
      return member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return member.email?.charAt(0).toUpperCase() || '?';
  };

  if (loading || membersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const renderPayableItem = (item: PayableItem) => {
    const isPaid = item.payment?.status === 'paid';
    const assignedMember = item.assignedMemberId ? tripMembers.find(m => m.id === item.assignedMemberId) : null;
    
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
              {assignedMember && (
                <span className="flex items-center gap-1 text-primary">
                  <User className="h-3 w-3" />
                  {getMemberName(assignedMember.id)}
                </span>
              )}
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
          
          {/* Assign button */}
          {tripMembers.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => {
                setAssigningItem(item);
                setAssignMemberId(item.assignedMemberId || '');
              }}
              title="Assign to member"
            >
              <User className="h-3.5 w-3.5" />
            </Button>
          )}
          
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
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setMarkPaidModal(item);
                setSelectedMemberId(item.assignedMemberId || '');
              }}
            >
              <Check className="h-3 w-3 mr-1" />
              Mark Paid
            </Button>
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
            <h3 className="text-lg font-semibold">Trip Expenses</h3>
            <p className="text-sm text-muted-foreground">
              {budgetLimitCents && budgetLimitCents > 0 
                ? `${Math.round((estimatedTotal / budgetLimitCents) * 100)}% of budget`
                : `${Math.round(progressPercent)}% paid`
              }
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-primary">{formatCurrency(estimatedTotal)}</p>
            <p className="text-xs text-muted-foreground">
              {budgetLimitCents && budgetLimitCents > 0 
                ? `of ${formatCurrency(budgetLimitCents)} budget`
                : 'Total estimated'
              }
            </p>
          </div>
        </div>
        
        {/* Show budget progress if budget is set */}
        {budgetLimitCents && budgetLimitCents > 0 ? (
          <>
            <Progress 
              value={Math.min((estimatedTotal / budgetLimitCents) * 100, 100)} 
              className={cn(
                "h-2 mb-4",
                estimatedTotal > budgetLimitCents && "[&>div]:bg-destructive"
              )}
            />
            {estimatedTotal > budgetLimitCents && (
              <div className="flex items-center gap-2 mb-4 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                Over budget by {formatCurrency(estimatedTotal - budgetLimitCents)}
              </div>
            )}
          </>
        ) : (
          <Progress value={progressPercent} className="h-2 mb-4" />
        )}
        
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

          {/* Add Expense Button */}
          <Button
            variant="outline"
            className="w-full border-dashed gap-2"
            onClick={() => setShowAddExpenseModal(true)}
          >
            <Plus className="h-4 w-4" />
            Add Expense Manually
          </Button>

          {payableItems.length === 0 && (
            <Card className="p-8 text-center">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No expenses tracked yet.</p>
              <p className="text-sm text-muted-foreground/75 mt-1">Add your flight, hotel, and activity costs to track your trip budget.</p>
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

        <TabsContent value="group" className="mt-4 space-y-4">
          {/* Member Breakdown */}
          {tripMembers.length > 0 ? (
            <>
              {/* Member Avatars */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {tripMembers.map(member => (
                  <Avatar key={member.id} className="h-10 w-10 border-2 border-background shadow-sm">
                    <AvatarFallback className={cn(
                      "text-sm font-medium",
                      member.role === 'primary' ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      {getMemberInitials(member)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                <button 
                  onClick={() => setShowGroupModal(true)}
                  className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>

              {/* Per-Member Breakdown */}
              <div className="space-y-3">
                {tripMembers.map(member => {
                  const breakdown = memberBreakdown.get(member.id);
                  if (!breakdown || breakdown.items.length === 0) return null;
                  
                  const memberProgress = breakdown.assigned > 0 ? (breakdown.paid / breakdown.assigned) * 100 : 0;
                  
                  return (
                    <Card key={member.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={cn(
                              "text-xs font-medium",
                              member.role === 'primary' ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}>
                              {getMemberInitials(member)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{member.name || member.email?.split('@')[0]}</p>
                            <p className="text-xs text-muted-foreground">
                              {breakdown.items.length} item{breakdown.items.length !== 1 ? 's' : ''} assigned
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(breakdown.assigned)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(breakdown.paid)} paid
                          </p>
                        </div>
                      </div>
                      <Progress value={memberProgress} className="h-1.5" />
                    </Card>
                  );
                })}
                
                {/* Unassigned Items */}
                {(() => {
                  const unassigned = memberBreakdown.get('unassigned');
                  if (!unassigned || unassigned.items.length === 0) return null;
                  
                  return (
                    <Card className="p-4 border-dashed">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-muted-foreground">Unassigned</p>
                            <p className="text-xs text-muted-foreground">
                              {unassigned.items.length} item{unassigned.items.length !== 1 ? 's' : ''} need assignment
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-muted-foreground">{formatCurrency(unassigned.assigned)}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })()}
              </div>

              {/* Equal Split Info */}
              {travelers > 1 && (
                <div className="mt-4 pt-4 border-t border-border text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    If split equally among {travelers} travelers:
                  </p>
                  <p className="text-xl font-semibold text-primary">
                    {formatCurrency(Math.round(estimatedTotal / travelers))} per person
                  </p>
                </div>
              )}
            </>
          ) : (
            <Card className="p-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Split className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Split the Bill</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Invite your travel companions and split costs evenly or assign specific expenses to each person.
                </p>

                <div className="flex items-center justify-center gap-2 mb-6">
                  <button 
                    onClick={() => setShowGroupModal(true)}
                    className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                </div>

                <Button onClick={() => setShowGroupModal(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Members
                </Button>

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
          )}
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

              {tripMembers.length > 0 && (
                <div className="space-y-2">
                  <Label>Paid by</Label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select who paid" />
                    </SelectTrigger>
                    <SelectContent>
                      {tripMembers.map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name || member.email?.split('@')[0]}
                          {member.role === 'primary' && ' (Organizer)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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

      {/* Assign Member Modal */}
      <Dialog open={!!assigningItem} onOpenChange={() => setAssigningItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to Member</DialogTitle>
            <DialogDescription>
              Choose who is responsible for paying this item.
            </DialogDescription>
          </DialogHeader>
          
          {assigningItem && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  {getItemIcon(assigningItem.type)}
                  <span className="font-medium text-sm">{assigningItem.name}</span>
                </div>
                <span className="font-semibold">{formatCurrency(assigningItem.amountCents)}</span>
              </div>

              <div className="space-y-2">
                <Label>Assign to</Label>
                <Select value={assignMemberId} onValueChange={setAssignMemberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {tripMembers.map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name || member.email?.split('@')[0]}
                        {member.role === 'primary' && ' (Organizer)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAssigningItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleAssignMember}>
              Save Assignment
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
            {/* Current Members */}
            {tripMembers.length > 0 && (
              <div>
                <Label className="mb-3 block">Current Members</Label>
                <div className="space-y-2">
                  {tripMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn(
                            "text-xs font-medium",
                            member.role === 'primary' ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}>
                            {getMemberInitials(member)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.name || member.email?.split('@')[0]}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      {member.role === 'primary' && (
                        <Badge variant="secondary" className="text-xs">Organizer</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Invite by Email</Label>
              <div className="flex gap-2 mt-2">
                <Input 
                  placeholder="friend@email.com" 
                  className="flex-1"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Button 
                  disabled={isSendingInvite || !inviteEmail.includes('@')}
                  onClick={async () => {
                    setIsSendingInvite(true);
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) {
                        toast.error('Please sign in to invite members');
                        return;
                      }
                      
                      // Create invite with email
                      const { data: invite, error } = await supabase
                        .from('trip_invites')
                        .insert({
                          trip_id: tripId,
                          invited_by: user.id,
                          email: inviteEmail,
                          max_uses: 1,
                          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        })
                        .select('token')
                        .single();
                      
                      if (error) throw error;
                      
                      const inviteLink = `${window.location.origin}/invite/${invite.token}`;
                      
                      // Open email client with invite
                      window.open(`mailto:${inviteEmail}?subject=Join my trip!&body=You're invited to join my trip! Click here: ${encodeURIComponent(inviteLink)}`, '_blank');
                      
                      toast.success(`Invite created for ${inviteEmail}`);
                      setInviteEmail('');
                    } catch (err) {
                      console.error('Failed to create invite:', err);
                      toast.error('Failed to send invite');
                    } finally {
                      setIsSendingInvite(false);
                    }
                  }}
                >
                  {isSendingInvite ? 'Sending...' : 'Send Invite'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                They'll receive a link to join this trip and track their share of expenses.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Modal */}
      <Dialog open={showAddExpenseModal} onOpenChange={setShowAddExpenseModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>
              Manually track a flight, hotel, or activity cost.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Expense Type</Label>
              <Select value={newExpenseType} onValueChange={(v) => setNewExpenseType(v as 'flight' | 'hotel' | 'activity')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flight">
                    <div className="flex items-center gap-2">
                      <Plane className="h-4 w-4" />
                      Flight
                    </div>
                  </SelectItem>
                  <SelectItem value="hotel">
                    <div className="flex items-center gap-2">
                      <Hotel className="h-4 w-4" />
                      Hotel / Accommodation
                    </div>
                  </SelectItem>
                  <SelectItem value="activity">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Activity / Tour
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expenseName">Description</Label>
              <Input
                id="expenseName"
                placeholder={
                  newExpenseType === 'flight' ? 'e.g., Round-trip to Rome (Delta)' :
                  newExpenseType === 'hotel' ? 'e.g., The St. Regis Rome (3 nights)' :
                  'e.g., Colosseum Tour'
                }
                value={newExpenseName}
                onChange={(e) => setNewExpenseName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expenseAmount">Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="expenseAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7"
                  placeholder="0.00"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddExpenseModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddExpense} 
              disabled={savingExpense || !newExpenseName.trim() || !newExpenseAmount}
            >
              {savingExpense ? 'Saving...' : 'Add Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
