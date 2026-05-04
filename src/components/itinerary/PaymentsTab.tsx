/**
 * Payments Tab Component - Editorial Redesign
 * Tracks all trip payments with group splitting and member assignment support
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { getAppUrl } from '@/utils/getAppUrl';

import { usePayableItems, type PayableItem } from '@/hooks/usePayableItems';
import { useTripFinancialSnapshot } from '@/hooks/useTripFinancialSnapshot';
import { motion, AnimatePresence } from 'framer-motion';
import { JourneySpendingSummary } from './JourneySpendingSummary';
import { FirstUseHint } from './FirstUseHint';
import { 
  Plane, Hotel, Camera, Check, CreditCard, ExternalLink, 
  CheckCircle2, Users, ChevronDown, Receipt,
  Wallet, X, User, Plus, UserPlus, AlertCircle, Split,
  Utensils, Car, ShoppingBag
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
import { markActivityPaid } from '@/services/activityCostService';
import { useTripMembers, addTripMember, type TripMember } from '@/services/tripBudgetAPI';
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
  /** Trip owner info for Split Bill */
  ownerId?: string;
  ownerName?: string;
  /** For consistent cost estimation matching itinerary header */
  budgetTier?: string;
  destination?: string;
  destinationCountry?: string;
  /** Journey fields for linked trips */
  journeyId?: string | null;
  journeyName?: string | null;
}

// PayableItem type is now imported from usePayableItems

export function PaymentsTab({ 
  tripId, 
  days, 
  flightSelection, 
  hotelSelection,
  travelers,
  budgetLimitCents,
  ownerId,
  ownerName,
  budgetTier = 'moderate',
  destination,
  destinationCountry,
  journeyId,
  journeyName,
}: PaymentsTabProps) {
  const queryClient = useQueryClient();
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
  const [assignMemberIds, setAssignMemberIds] = useState<string[]>([]);
  
  // Manual entry states
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseType, setNewExpenseType] = useState<PayableItem['type']>('flight');
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  // Fetch real trip members and collaborators
  const { data: rawTripMembers = [], isLoading: membersLoading } = useTripMembers(tripId);
  const { data: collaborators = [] } = useTripCollaborators(tripId);

  // Merge owner + collaborators into trip members so they appear in Split Bill automatically
  const tripMembers: TripMember[] = useMemo(() => {
    const memberUserIds = new Set(rawTripMembers.map(m => m.userId).filter(Boolean));
    const memberEmails = new Set(rawTripMembers.map(m => m.email?.toLowerCase()).filter(Boolean));
    
    // Start with existing trip_members
    const merged = [...rawTripMembers];

    // Always include the trip owner if not already present (check userId AND name)
    const ownerAlreadyInMembers = ownerId && (
      memberUserIds.has(ownerId) ||
      merged.some(m => 
        (ownerName && m.name?.toLowerCase() === ownerName.toLowerCase()) ||
        (ownerName && m.email?.toLowerCase() === ownerName.toLowerCase())
      )
    );
    if (ownerId && !ownerAlreadyInMembers) {
      merged.unshift({
        id: `owner-${ownerId}`,
        tripId,
        userId: ownerId,
        email: ownerName || 'Owner',
        name: ownerName || 'Trip Owner',
        role: 'primary' as const,
        invitedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
      });
      memberUserIds.add(ownerId);
    }
    
    // Add collaborators that aren't already in trip_members (check both userId AND email/name)
    for (const collab of collaborators) {
      const profileName = collab.profile?.display_name || collab.profile?.handle;
      const collabNameLower = profileName?.toLowerCase();
      
      // Skip if userId already present
      if (collab.user_id && memberUserIds.has(collab.user_id)) continue;
      
      // Skip if this person's name/email already exists in merged members
      const alreadyExists = merged.some(m => {
        if (collab.user_id && m.userId === collab.user_id) return true;
        if (collabNameLower && m.name?.toLowerCase() === collabNameLower) return true;
        if (collabNameLower && m.email?.toLowerCase() === collabNameLower) return true;
        return false;
      });
      if (alreadyExists) continue;
      
      if (collab.user_id) {
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
        memberUserIds.add(collab.user_id);
      }
    }
    
    // Pre-populate placeholder guests up to the trip's traveler count so a
    // 2-guest trip already has both seats visible without an email invite.
    // Synthetic IDs (`guest-N`) are deterministic so split assignments stay
    // stable across renders. They materialize into a real trip_members row
    // on first assignment via resolveRealMemberId().
    const desiredCount = Math.max(1, travelers || 1);
    let guestIndex = 1;
    while (merged.length < desiredCount) {
      guestIndex += 1;
      merged.push({
        id: `guest-${guestIndex}`,
        tripId,
        userId: null,
        email: `guest-${guestIndex}@placeholder.local`,
        name: `Guest ${guestIndex}`,
        role: 'attendee' as const,
        invitedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
      });
    }
    
    return merged;
  }, [rawTripMembers, collaborators, ownerId, ownerName, tripId, travelers]);

  // Fetch payments — with optional delay for DB write consistency
  const fetchPayments = useCallback(async (delayMs = 0) => {
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
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

  // Fetch activity_costs from DB for category reconciliation
  const { data: activityCosts } = useQuery({
    queryKey: ['activity-costs-payable', tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from('activity_costs')
        .select('cost_per_person_usd, num_travelers, category, day_number, activity_id')
        .eq('trip_id', tripId);
      return data || [];
    },
    enabled: !!tripId,
  });

  // Use the shared payable items hook — single source of truth for cost totals
  const { items: payableItems, totalCents: payableTotalCents, essentialItems, activityItems } = usePayableItems({
    days,
    flightSelection,
    hotelSelection,
    travelers,
    payments,
    budgetTier,
    destination,
    destinationCountry,
    activityCosts,
    paymentsLoaded: !loading,
  });

  // ─── Canonical total from DB ledger (single source of truth, matches header + budget) ───
  const financialSnapshot = useTripFinancialSnapshot(tripId);
  // Manually-added expenses live only in trip_payments (not in activity_costs),
  // so the DB snapshot misses them. Sum them so we can fold them on top — BUT
  // when a manual hotel/flight exists, treat it as an OVERRIDE of the canonical
  // day-0 ledger row instead of an addition (otherwise we double-count the stay).
  const hasCanonicalHotel = !!(activityCosts || []).find(
    r => (r.category || '').toLowerCase() === 'hotel' && r.day_number === 0 && (r.cost_per_person_usd || 0) > 0
  );
  const hasCanonicalFlight = !!(activityCosts || []).find(
    r => (r.category || '').toLowerCase() === 'flight' && r.day_number === 0 && (r.cost_per_person_usd || 0) > 0
  );
  const canonicalHotelCents = (activityCosts || [])
    .filter(r => (r.category || '').toLowerCase() === 'hotel' && r.day_number === 0)
    .reduce((s, r) => s + Math.round((r.cost_per_person_usd || 0) * (r.num_travelers || 1) * 100), 0);
  const canonicalFlightCents = (activityCosts || [])
    .filter(r => (r.category || '').toLowerCase() === 'flight' && r.day_number === 0)
    .reduce((s, r) => s + Math.round((r.cost_per_person_usd || 0) * (r.num_travelers || 1) * 100), 0);

  const manualExtraCents = useMemo(() => {
    let manualHotelCents = 0;
    let manualFlightCents = 0;
    let otherManualCents = 0;
    for (const p of payments) {
      if (typeof p.item_id !== 'string' || !p.item_id.startsWith('manual-')) continue;
      const cents = p.amount_cents * (p.quantity || 1);
      if (p.item_type === 'hotel') manualHotelCents += cents;
      else if (p.item_type === 'flight') manualFlightCents += cents;
      else otherManualCents += cents;
    }
    // Manual hotel/flight REPLACES the canonical day-0 row (delta, not addition).
    // If no canonical row exists, the manual amount is purely additive.
    const hotelDelta = hasCanonicalHotel ? (manualHotelCents - canonicalHotelCents) : manualHotelCents;
    const flightDelta = hasCanonicalFlight ? (manualFlightCents - canonicalFlightCents) : manualFlightCents;
    return otherManualCents + hotelDelta + flightDelta;
  }, [payments, hasCanonicalHotel, hasCanonicalFlight, canonicalHotelCents, canonicalFlightCents]);

  const baseTotal = financialSnapshot.loading
    ? payableTotalCents
    : (financialSnapshot.tripTotalCents > 0 ? financialSnapshot.tripTotalCents : payableTotalCents);
  // Single canonical ledger total + override-aware manual delta. No Math.max
  // floor against payableTotalCents — that floor magnified the double-count.
  const estimatedTotal = Math.max(0, baseTotal + manualExtraCents);
  // "Paid so far" reflects actual recorded payments from trip_payments
  const paidAmount = totals.paid;
  const unpaidAmount = Math.max(0, estimatedTotal - paidAmount);
  const progressPercent = estimatedTotal > 0 ? (paidAmount / estimatedTotal) * 100 : 0;

  /**
   * Map a real trip_members UUID back to the synthetic member.id used in the UI.
   * This is needed so pre-population of the assign modal and breakdown work correctly.
   */
  const realIdToSyntheticId = useMemo(() => {
    const map = new Map<string, string>();
    tripMembers.forEach(m => {
      map.set(m.id, m.id);
      if (m.userId) {
        rawTripMembers.forEach(rm => {
          if (rm.userId === m.userId) {
            map.set(rm.id, m.id);
          }
        });
      }
    });
    return map;
  }, [tripMembers, rawTripMembers]);

  // Calculate per-member breakdown
  const memberBreakdown = useMemo(() => {
    const breakdown = new Map<string, { assigned: number; paid: number; items: { item: PayableItem; splitAmount: number }[] }>();
    
    tripMembers.forEach(m => {
      breakdown.set(m.id, { assigned: 0, paid: 0, items: [] });
    });
    breakdown.set('unassigned', { assigned: 0, paid: 0, items: [] });

    payableItems.forEach(item => {
      if (item.allPayments.length > 0) {
        const handledMembers = new Set<string>();
        item.allPayments.forEach(payment => {
          const rawId = (payment as any)?.assigned_member_id;
          const memberId = rawId ? (realIdToSyntheticId.get(rawId) || 'unassigned') : 'unassigned';
          const current = breakdown.get(memberId) || { assigned: 0, paid: 0, items: [] };
          
          current.assigned += payment.amount_cents * (payment.quantity || 1);
          if (payment.status === 'paid') {
            current.paid += payment.amount_cents * (payment.quantity || 1);
          }
          if (!handledMembers.has(memberId)) {
            current.items.push({ item, splitAmount: payment.amount_cents * (payment.quantity || 1) });
            handledMembers.add(memberId);
          }
          
          breakdown.set(memberId, current);
        });
      } else {
        const current = breakdown.get('unassigned') || { assigned: 0, paid: 0, items: [] };
        current.assigned += item.amountCents;
        current.items.push({ item, splitAmount: item.amountCents });
        breakdown.set('unassigned', current);
      }
    });

    return breakdown;
  }, [tripMembers, payableItems, realIdToSyntheticId]);

  const handleMarkAsPaid = async () => {
    if (!markPaidModal) return;
    setMarkingPaid(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Resolve synthetic collab IDs to real trip_members IDs
      const realMemberId = selectedMemberId ? await resolveRealMemberId(selectedMemberId) : null;

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
        assigned_member_id: realMemberId,
        paid_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Sync activity_costs.is_paid so v_payments_summary reflects the payment
      // Strip composite suffix (_dN) to get the real activity_id stored in activity_costs
      const realActivityId = markPaidModal.id.replace(/_d\d+$/, '');
      await markActivityPaid(tripId, realActivityId, markPaidModal.amountCents / 100);

      // Optimistic update — immediately reflect in the UI
      const optimisticPayment: TripPayment = {
        id: `optimistic-${Date.now()}`,
        trip_id: tripId,
        user_id: user.id,
        item_type: markPaidModal.type as TripPayment['item_type'],
        item_id: markPaidModal.id,
        item_name: markPaidModal.name,
        amount_cents: markPaidModal.amountCents,
        currency: 'USD',
        quantity: 1,
        status: 'paid',
        external_provider: 'external',
        external_booking_id: externalRef || undefined,
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as TripPayment;
      setPayments(prev => [...prev, optimisticPayment]);
      setTotals(prev => ({
        ...prev,
        paid: prev.paid + markPaidModal.amountCents,
      }));

      toast.success('Marked as paid');
      setMarkPaidModal(null);
      setExternalRef('');
      setSelectedMemberId('');
      // Background refetch to sync real IDs and summary
      fetchPayments(300);
      window.dispatchEvent(new CustomEvent('booking-changed'));
    } catch (err) {
      console.error('Error marking paid:', err);
      toast.error('Failed to update');
    } finally {
      setMarkingPaid(false);
    }
  };

  // Handle adding manual expense
  const handleAddExpense = async () => {
    if (!newExpenseName.trim() || !newExpenseAmount || parseFloat(newExpenseAmount) <= 0) {
      toast.error('Please enter a name and an amount greater than $0');
      return;
    }
    setSavingExpense(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const amountCents = Math.round(parseFloat(newExpenseAmount) * 100);
      if (isNaN(amountCents) || amountCents <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      const { error } = await supabase.from('trip_payments').insert({
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
      await fetchPayments(150);
    } catch (err) {
      console.error('Error adding expense:', err);
      toast.error('Failed to add expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleUnmarkPaid = async (item: PayableItem) => {
    if (item.allPayments.length === 0 && !item.payment) return;

    try {
      const idsToDelete = item.allPayments.length > 0 
        ? item.allPayments.map(p => p.id)
        : item.payment ? [item.payment.id] : [];
      
      if (idsToDelete.length === 0) return;

      const removedPaidCents = (item.allPayments.length > 0
        ? item.allPayments
        : item.payment
          ? [item.payment]
          : []
      )
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + (p.amount_cents * (p.quantity || 1)), 0);

      const { error } = await supabase
        .from('trip_payments')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      // Strip composite suffix (_dN) to get the real activity_id stored in activity_costs
      const realItemId = item.id.replace(/_d\d+$/, '');
      await supabase
        .from('activity_costs')
        .update({ is_paid: false, paid_amount_usd: 0, paid_at: null })
        .eq('trip_id', tripId)
        .eq('activity_id', realItemId);

      setTotals(prev => ({
        ...prev,
        paid: Math.max(0, prev.paid - removedPaidCents),
      }));

      toast.success('Payment unmarked');
      await fetchPayments(150);
      window.dispatchEvent(new CustomEvent('booking-changed'));
      
    } catch (err) {
      console.error('Error unmarking payment:', err);
      toast.error('Failed to update');
    }
  };

  /**
   * Resolve a member ID that might be a synthetic "collab-xxx" ID
   * to a real trip_members row ID. Creates a trip_members row if needed.
   */
  const resolveRealMemberId = async (memberId: string): Promise<string | null> => {
    if (!memberId) return null;
    
    // If it's a synthetic owner ID, resolve to a real trip_members row
    if (memberId.startsWith('owner-')) {
      const member = tripMembers.find(m => m.id === memberId);
      if (!member) return null;
      
      // Check if a trip_members row already exists for this user
      const existingReal = rawTripMembers.find(
        m => member.userId && m.userId === member.userId
      );
      if (existingReal) return existingReal.id;
      
      // Create a real trip_members row for the owner
      try {
        const newMember = await addTripMember({
          tripId,
          email: member.email || member.userId || 'unknown',
          name: member.name || undefined,
          role: 'primary',
        });
        return newMember.id;
      } catch (err) {
        console.error('Failed to create trip member for owner:', err);
        return null;
      }
    }
    
    // If it's a synthetic placeholder guest, materialize a real trip_members row
    if (memberId.startsWith('guest-')) {
      const member = tripMembers.find(m => m.id === memberId);
      if (!member) return null;
      const placeholderEmail = member.email || `${memberId}@placeholder.local`;
      const existingReal = rawTripMembers.find(
        m => m.email?.toLowerCase() === placeholderEmail.toLowerCase()
      );
      if (existingReal) return existingReal.id;
      try {
        const newMember = await addTripMember({
          tripId,
          email: placeholderEmail,
          name: member.name || undefined,
          role: 'attendee',
        });
        return newMember.id;
      } catch (err) {
        console.error('Failed to create trip member for placeholder guest:', err);
        return null;
      }
    }
    
    // If it's not a synthetic collab ID, it's already a real trip_members ID
    if (!memberId.startsWith('collab-')) return memberId;
    
    // Find the collaborator info from our merged list
    const member = tripMembers.find(m => m.id === memberId);
    if (!member) return null;
    
    // Check if a trip_members row already exists for this user
    const existingReal = rawTripMembers.find(
      m => (member.userId && m.userId === member.userId) || 
           (member.email && m.email?.toLowerCase() === member.email?.toLowerCase())
    );
    if (existingReal) return existingReal.id;
    
    // Create a real trip_members row for this collaborator
    try {
      const newMember = await addTripMember({
        tripId,
        email: member.email || member.userId || 'unknown',
        name: member.name || undefined,
        role: 'attendee',
      });
      return newMember.id;
    } catch (err) {
      console.error('Failed to create trip member for collaborator:', err);
      return null;
    }
  };

  // realIdToSyntheticId is defined above with memberBreakdown

  const handleAssignMember = async () => {
    if (!assigningItem) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const selectedIds = assignMemberIds.length > 0 ? assignMemberIds : (assignMemberId ? [assignMemberId] : []);
      
      if (selectedIds.length === 0) {
        toast.error('Please select at least one member');
        return;
      }

      // Resolve all synthetic IDs to real member IDs
      const resolvedIds: (string | null)[] = [];
      for (const id of selectedIds) {
        const realId = await resolveRealMemberId(id);
        resolvedIds.push(realId);
      }
      const validResolvedIds = resolvedIds.filter(Boolean) as string[];

      // Refresh trip-members cache so realIdToSyntheticId picks up any newly created rows
      await queryClient.refetchQueries({ queryKey: ['trip-members', tripId] });

      if (validResolvedIds.length === 0) {
        toast.error('Could not resolve member IDs. Please try again.');
        return;
      }

      // Delete all existing payments for this item to replace with new split
      if (assigningItem.allPayments.length > 0) {
        const deleteIds = assigningItem.allPayments.map(p => p.id);
        const { error } = await supabase
          .from('trip_payments')
          .delete()
          .in('id', deleteIds);
        if (error) throw error;
      }

      // Create new payment rows - one per assigned member with split amount
      const splitAmount = Math.round(assigningItem.amountCents / validResolvedIds.length);
      const remainder = assigningItem.amountCents - (splitAmount * validResolvedIds.length);
      
      const rows = validResolvedIds.map((realMemberId, i) => ({
        trip_id: tripId,
        user_id: user.id,
        item_type: assigningItem.type,
        item_id: assigningItem.id,
        item_name: assigningItem.name,
        amount_cents: splitAmount + (i === 0 ? remainder : 0),
        currency: 'USD',
        quantity: 1,
        status: assigningItem.payment?.status || 'pending',
        assigned_member_id: realMemberId,
      }));

      const { error } = await supabase.from('trip_payments').upsert(rows, { onConflict: 'trip_id,item_type,item_id,assigned_member_id' });
      if (error) throw error;

      toast.success(validResolvedIds.length > 1 
        ? `Split between ${validResolvedIds.length} members` 
        : 'Assignment updated'
      );

      // Optimistic local state update for instant UI feedback
      const optimisticRows: TripPayment[] = rows.map((r, i) => ({
        ...r,
        id: `optimistic-${Date.now()}-${i}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as TripPayment));
      setPayments(prev => [
        ...prev.filter(p => !(p.item_type === assigningItem.type && p.item_id === assigningItem.id)),
        ...optimisticRows,
      ]);

      setAssigningItem(null);
      setAssignMemberId('');
      setAssignMemberIds([]);
      // Background sync (no await, no artificial delay)
      await fetchPayments(0);
      
    } catch (err) {
      console.error('Error assigning member:', err);
      toast.error(`Failed to assign: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getItemIcon = (type: PayableItem['type']) => {
    switch (type) {
      case 'flight': return <Plane className="h-4 w-4" />;
      case 'hotel': return <Hotel className="h-4 w-4" />;
      case 'activity': return <Camera className="h-4 w-4" />;
      case 'dining': return <Utensils className="h-4 w-4" />;
      case 'transport': return <Car className="h-4 w-4" />;
      case 'shopping': return <ShoppingBag className="h-4 w-4" />;
      case 'other':
      default: return <Receipt className="h-4 w-4" />;
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
    const assignedMembers = item.assignedMemberIds
      .map(rawId => {
        // Use the realIdToSyntheticId map first (covers owner-*, collab-* synthetic IDs)
        const syntheticId = realIdToSyntheticId.get(rawId);
        if (syntheticId) {
          const member = tripMembers.find(m => m.id === syntheticId);
          if (member) return member;
        }
        // Direct match on synthetic ID
        const directMatch = tripMembers.find(m => m.id === rawId);
        if (directMatch) return directMatch;
        // Match by userId (raw assigned_member_id might be a user_id or trip_members.id)
        const byUserId = tripMembers.find(m => m.userId === rawId);
        if (byUserId) return byUserId;
        // Check raw trip_members for userId lookup
        const raw = rawTripMembers.find(rm => rm.id === rawId);
        if (raw?.userId) {
          return tripMembers.find(m => m.userId === raw.userId) || null;
        }
        return null;
      })
      .filter(Boolean) as TripMember[];
    
    return (
      <div key={`${item.type}-${item.id}`}>
      <motion.div
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
          
          {/* Assigned member avatars */}
          {assignedMembers.length > 0 && (
            <div className="flex items-center -space-x-1.5 ml-1">
              {assignedMembers.map(member => (
                <Avatar key={member.id} className="h-6 w-6 border-2 border-background" title={member.name || member.email?.split('@')[0]}>
                  <AvatarFallback className={cn(
                    "text-[9px] font-medium",
                    member.role === 'primary' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {getMemberInitials(member)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {assignedMembers.length > 1 && (
                <span className="text-[10px] text-muted-foreground ml-2 whitespace-nowrap">
                  Split {assignedMembers.length} ways
                </span>
              )}
            </div>
          )}
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
                setAssignMemberId(String(item.assignedMemberId ?? ''));
                // Convert real DB IDs back to synthetic member IDs for the UI checkboxes
                const syntheticIds = item.assignedMemberIds
                  .map(id => realIdToSyntheticId.get(id) || id)
                  .filter((id, i, arr) => arr.indexOf(id) === i); // dedupe
                setAssignMemberIds(syntheticIds);
              }}
              title="Assign to member"
            >
              {assignedMembers.length > 0 ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
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
      {item.subItems && item.subItems.length > 0 && (
        <div className="pl-11 pr-2 pb-2 -mt-1 space-y-0.5">
          {item.subItems.map(sub => (
            <div key={sub.id} className="flex items-center justify-between text-xs text-muted-foreground py-1 border-b border-border/30 last:border-0">
              <span className="truncate pr-2">{sub.name}</span>
              <span className="tabular-nums">{formatCurrency(sub.amountCents)}</span>
            </div>
          ))}
        </div>
      )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <FirstUseHint
        hintKey="payments_hint_shown"
        message="Track what you've paid vs. what's remaining. Use Split Bill to divide costs between travelers."
      />
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
            <p className="text-xs text-muted-foreground">Trip Total</p>
            {!financialSnapshot.loading && financialSnapshot.tripTotalCents > 0 && (() => {
              // payableTotalCents already includes manual-* rows via addManualGroups
              // in usePayableItems. Do NOT re-add them here or manual entries get
              // double-counted and the badge sticks on "Reconciling…" forever.
              // Tolerance widened to $2 to absorb per-row Math.round cent drift.
              const matches = Math.abs(payableTotalCents - estimatedTotal) <= 200;
              return (
                <p className="text-[10px] text-muted-foreground/80 mt-0.5 flex items-center gap-1 justify-end">
                  {matches ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      Matches itinerary
                    </>
                  ) : (
                    <span className="text-amber-600">Reconciling…</span>
                  )}
                </p>
              );
            })()}
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
              <p className="text-xs text-muted-foreground">Paid so far</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium">{formatCurrency(unpaidAmount)}</p>
              <p className="text-xs text-muted-foreground">Remaining to pay</p>
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
                        <Progress value={memberProgress} className="h-1.5 mb-3" />
                        {/* Assigned items list */}
                        <div className="space-y-1.5 mt-2">
                          {breakdown.items.map(({ item, splitAmount }) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setAssigningItem(item);
                                const syntheticIds = item.assignedMemberIds
                                  .map(id => realIdToSyntheticId.get(id) || id)
                                  .filter((id, i, arr) => arr.indexOf(id) === i);
                                setAssignMemberIds(syntheticIds);
                              }}
                              className="w-full flex items-center justify-between text-xs px-1 py-1.5 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                                {getItemIcon(item.type)}
                                <span className="truncate">{item.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className="font-medium text-foreground">
                                  {formatCurrency(splitAmount)}
                                </span>
                                <Users className="h-3 w-3 text-primary opacity-60" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </Card>
                  );
                })}
                
                {/* Unassigned Items */}
                {(() => {
                  const unassigned = memberBreakdown.get('unassigned');
                  if (!unassigned || unassigned.items.length === 0) return null;
                  
                    return (
                      <Card className="p-4 border-dashed">
                        <div className="flex items-center justify-between mb-2">
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

                        {/* Split All Evenly button */}
                        {tripMembers.length >= 2 && unassigned.items.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2 mb-2 gap-2 text-xs"
                            onClick={async () => {
                              try {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) { toast.error('Please sign in'); return; }

                                // Resolve all member IDs
                                const allMemberIds = tripMembers.map(m => m.id);
                                const resolvedIds: string[] = [];
                                for (const id of allMemberIds) {
                                  const realId = await resolveRealMemberId(id);
                                  if (realId) resolvedIds.push(realId);
                                }
                                if (resolvedIds.length < 2) { toast.error('Need at least 2 members'); return; }
                                // Refresh trip-members cache after resolving IDs
                                await queryClient.refetchQueries({ queryKey: ['trip-members', tripId] });

                                // Filter out paid items — never touch them in bulk split
                                const splittableItems = unassigned.items.filter(({ item }) =>
                                  !item.allPayments.some(p => p.status === 'paid')
                                );
                                const skippedCount = unassigned.items.length - splittableItems.length;

                                // Batch assign only unpaid unassigned items
                                for (const { item } of splittableItems) {
                                  // Delete existing pending/failed payments
                                  if (item.allPayments.length > 0) {
                                    const deleteIds = item.allPayments.map(p => p.id);
                                    await supabase.from('trip_payments').delete().in('id', deleteIds);
                                  }
                                  const splitAmount = Math.round(item.amountCents / resolvedIds.length);
                                  const remainder = item.amountCents - (splitAmount * resolvedIds.length);
                                  const rows = resolvedIds.map((realMemberId, i) => ({
                                    trip_id: tripId,
                                    user_id: user.id,
                                    item_type: item.type,
                                    item_id: item.id,
                                    item_name: item.name,
                                    amount_cents: splitAmount + (i === 0 ? remainder : 0),
                                    currency: 'USD',
                                    quantity: 1,
                                    status: 'pending' as const,
                                    assigned_member_id: realMemberId,
                                  }));
                                  const { error } = await supabase.from('trip_payments').upsert(rows, { onConflict: 'trip_id,item_type,item_id,assigned_member_id' });
                                  if (error) console.error('Failed to assign item:', item.name, error);
                                }
                                if (skippedCount > 0) {
                                  toast.success(`Split ${splittableItems.length} items evenly — skipped ${skippedCount} already-paid item${skippedCount > 1 ? 's' : ''}`);
                                } else {
                                  toast.success(`Split ${splittableItems.length} items evenly among ${resolvedIds.length} members`);
                                }
                                await fetchPayments(0);
                              } catch (err) {
                                console.error('Error splitting all:', err);
                                toast.error('Failed to split items');
                              }
                            }}
                          >
                            <Split className="h-3.5 w-3.5" />
                            Split All Evenly ({tripMembers.length} ways)
                          </Button>
                        )}

                        <div className="space-y-1.5 mt-2">
                          {unassigned.items.map(({ item, splitAmount }) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setAssigningItem(item);
                                setAssignMemberIds(item.assignedMemberIds || []);
                              }}
                              className="w-full flex items-center justify-between text-xs px-1 py-1.5 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                                {getItemIcon(item.type)}
                                <span className="truncate">{item.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className="font-medium text-muted-foreground">
                                  {formatCurrency(splitAmount)}
                                </span>
                                <UserPlus className="h-3 w-3 text-primary opacity-60" />
                              </div>
                            </button>
                          ))}
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
                    {formatCurrency(Math.floor(estimatedTotal / travelers / 100) * 100)} per person
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
                      {formatCurrency(Math.floor(estimatedTotal / travelers / 100) * 100)} per person
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
                  <Select value={selectedMemberId || undefined} onValueChange={setSelectedMemberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select who paid" />
                    </SelectTrigger>
                    <SelectContent>
                      {tripMembers.filter(m => m.id).map(member => (
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

      {/* Assign Member Modal - Multi-select with split */}
      <Dialog open={!!assigningItem} onOpenChange={() => { setAssigningItem(null); setAssignMemberIds([]); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to Members</DialogTitle>
            <DialogDescription>
              Select one or more members. Selecting multiple splits the cost equally.
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
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {tripMembers.filter(m => m.id).map(member => {
                    const isSelected = assignMemberIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setAssignMemberIds(prev => 
                            isSelected 
                              ? prev.filter(id => id !== member.id)
                              : [...prev, member.id]
                          );
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left",
                          isSelected 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-muted-foreground/30"
                        )}
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className={cn(
                            "text-[10px] font-medium",
                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}>
                            {getMemberInitials(member)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {member.name || member.email?.split('@')[0]}
                            {member.role === 'primary' && <span className="text-muted-foreground font-normal"> (Organizer)</span>}
                          </p>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                        )}>
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Split preview */}
              {assignMemberIds.length > 1 && (
                <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                  <Split className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{formatCurrency(Math.round(assigningItem.amountCents / assignMemberIds.length))}</span>
                    {' '}per person ({assignMemberIds.length}-way split)
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setAssigningItem(null); setAssignMemberIds([]); }}>
              Cancel
            </Button>
            <Button onClick={handleAssignMember}>
              {assignMemberIds.length > 1 ? `Split ${assignMemberIds.length} Ways` : 'Save Assignment'}
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
                      
                      // Use centralized invite resolver
                      const { resolveInviteLink } = await import('@/services/inviteResolver');
                      const result = await resolveInviteLink(tripId);
                      
                      if (!result.success || !result.link) {
                        const { getInviteErrorMessage } = await import('@/services/inviteResolver');
                        throw new Error(getInviteErrorMessage(result.reason));
                      }
                      
                      const inviteLink = result.link;
                      
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
              <Select value={newExpenseType} onValueChange={(v) => setNewExpenseType(v as PayableItem['type'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flight">
                    <div className="flex items-center gap-2"><Plane className="h-4 w-4" />Flight</div>
                  </SelectItem>
                  <SelectItem value="hotel">
                    <div className="flex items-center gap-2"><Hotel className="h-4 w-4" />Hotel / Accommodation</div>
                  </SelectItem>
                  <SelectItem value="activity">
                    <div className="flex items-center gap-2"><Camera className="h-4 w-4" />Activity / Tour</div>
                  </SelectItem>
                  <SelectItem value="dining">
                    <div className="flex items-center gap-2"><Utensils className="h-4 w-4" />Dining</div>
                  </SelectItem>
                  <SelectItem value="transport">
                    <div className="flex items-center gap-2"><Car className="h-4 w-4" />Transport</div>
                  </SelectItem>
                  <SelectItem value="shopping">
                    <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />Shopping</div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2"><Receipt className="h-4 w-4" />Other</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expenseName">Description</Label>
              <Input
                id="expenseName"
                placeholder={
                  newExpenseType === 'flight' ? 'e.g., Round-trip to Paris (Delta)' :
                  newExpenseType === 'hotel' ? 'e.g., Le Bristol Paris (3 nights)' :
                  newExpenseType === 'activity' ? 'e.g., Louvre private tour' :
                  newExpenseType === 'dining' ? "e.g., Dinner at L'Arpège" :
                  newExpenseType === 'transport' ? 'e.g., Taxi to CDG airport' :
                  newExpenseType === 'shopping' ? 'e.g., Hermès scarf' :
                  'e.g., Travel insurance'
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
              disabled={savingExpense || !newExpenseName.trim() || !newExpenseAmount || parseFloat(newExpenseAmount) <= 0}
            >
              {savingExpense ? 'Saving...' : 'Add Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Journey Spending Summary — cross-leg overview for linked trips */}
      {journeyId && (
        <JourneySpendingSummary
          journeyId={journeyId}
          journeyName={journeyName || null}
          currentTripId={tripId}
        />
      )}
    </motion.div>
  );
}
