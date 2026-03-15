/**
 * Trip Budget & Expense Tracking API
 * 
 * Handles group budget tracking, expense assignments, and settlements
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Use 'any' for new tables until Supabase types regenerate
type SupabaseAny = ReturnType<typeof supabase.from>;

// ============================================================================
// TYPES
// ============================================================================

export type TripMemberRole = 'primary' | 'attendee';
export type ExpenseSplitType = 'equal' | 'manual' | 'percentage';
export type PaymentStatus = 'pending' | 'paid' | 'partial';

export interface TripMember {
  id: string;
  tripId: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: TripMemberRole;
  invitedAt: string;
  acceptedAt: string | null;
}

export interface TripExpense {
  id: string;
  tripId: string;
  category: string;
  description: string;
  plannedAmount: number;
  actualAmount: number | null;
  currency: string;
  splitType: ExpenseSplitType;
  paidByMemberId: string | null;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  externalItemId: string | null;
  externalItemType: string | null;
  notes: string | null;
}

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  memberId: string;
  amount: number;
  percentage: number | null;
  isPaid: boolean;
  paidAt: string | null;
}

export interface TripSettlement {
  id: string;
  tripId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  currency: string;
  isSettled: boolean;
  settledAt: string | null;
  notes: string | null;
}

export interface BudgetSummary {
  totalPlanned: number;
  totalActual: number;
  totalPaid: number;
  totalPending: number;
  memberBalances: { memberId: string; name: string; owes: number; owed: number }[];
  settlements: TripSettlement[];
}

// ============================================================================
// TRIP MEMBERS
// ============================================================================

export async function getTripMembers(tripId: string): Promise<TripMember[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('*')
    .eq('trip_id', tripId)
    .order('role', { ascending: false })
    .order('created_at');

  if (error) throw new Error(error.message);
  
  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    tripId: row.trip_id as string,
    userId: row.user_id as string | null,
    email: row.email as string,
    name: row.name as string | null,
    role: row.role as TripMemberRole,
    invitedAt: row.invited_at as string,
    acceptedAt: row.accepted_at as string | null,
  }));
}

export async function addTripMember(input: {
  tripId: string;
  email: string;
  name?: string;
  role?: TripMemberRole;
}): Promise<TripMember> {
  // Use upsert to prevent duplicate key errors on (trip_id, email)
  const { data, error } = await supabase
    .from('trip_members')
    .upsert(
      {
        trip_id: input.tripId,
        email: input.email,
        name: input.name || null,
        role: input.role || 'attendee',
      },
      { onConflict: 'trip_id,email' }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);

  const result: TripMember = {
    id: data.id,
    tripId: data.trip_id,
    userId: data.user_id,
    email: data.email,
    name: data.name,
    role: data.role as TripMemberRole,
    invitedAt: data.invited_at,
    acceptedAt: data.accepted_at,
  };

  // GAP 4: Propagate new member to journey legs
  try {
    const { data: tripData } = await supabase
      .from('trips')
      .select('journey_id')
      .eq('id', input.tripId)
      .maybeSingle();

    if (tripData?.journey_id) {
      const { data: siblingLegs } = await supabase
        .from('trips')
        .select('id')
        .eq('journey_id', tripData.journey_id)
        .neq('id', input.tripId);

      if (siblingLegs?.length) {
        const memberInserts = siblingLegs.map(leg => ({
          trip_id: leg.id,
          email: input.email,
          name: input.name || null,
          role: input.role || 'attendee',
          user_id: data.user_id,
        }));

        await supabase
          .from('trip_members')
          .upsert(memberInserts, { onConflict: 'trip_id,email' });
      }
    }
  } catch (legErr) {
    console.error('[TripBudget] Failed to propagate member to journey legs:', legErr);
  }

  return result;
}

export async function updateTripMember(
  memberId: string,
  updates: { name?: string; role?: TripMemberRole }
): Promise<void> {
  const { error } = await supabase
    .from('trip_members')
    .update({
      name: updates.name,
      role: updates.role,
    })
    .eq('id', memberId);

  if (error) throw new Error(error.message);
}

export async function removeTripMember(memberId: string): Promise<void> {
  // First get the member to know trip_id, user_id, email for leg cascading
  const { data: member } = await supabase
    .from('trip_members')
    .select('trip_id, user_id, email')
    .eq('id', memberId)
    .maybeSingle();

  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('id', memberId);

  if (error) throw new Error(error.message);

  // GAP 5b: Cascade removal to journey legs
  if (member) {
    try {
      const { data: tripData } = await supabase
        .from('trips')
        .select('journey_id')
        .eq('id', member.trip_id)
        .maybeSingle();

      if (tripData?.journey_id) {
        const { data: siblingLegs } = await supabase
          .from('trips')
          .select('id')
          .eq('journey_id', tripData.journey_id)
          .neq('id', member.trip_id);

        if (siblingLegs?.length) {
          const legIds = siblingLegs.map(l => l.id);

          await supabase
            .from('trip_members')
            .delete()
            .in('trip_id', legIds)
            .eq('email', member.email);
        }
      }
    } catch (legErr) {
      console.error('[TripBudget] Failed to cascade member removal to journey legs:', legErr);
    }
  }
}

// ============================================================================
// TRIP EXPENSES
// ============================================================================

export async function getTripExpenses(tripId: string): Promise<TripExpense[]> {
  const { data, error } = await supabase
    .from('trip_expenses')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at');

  if (error) throw new Error(error.message);
  
  return (data || []).map(row => ({
    id: row.id,
    tripId: row.trip_id,
    category: row.category,
    description: row.description,
    plannedAmount: Number(row.planned_amount),
    actualAmount: row.actual_amount ? Number(row.actual_amount) : null,
    currency: row.currency,
    splitType: row.split_type as ExpenseSplitType,
    paidByMemberId: row.paid_by_member_id,
    paymentStatus: row.payment_status as PaymentStatus,
    paidAt: row.paid_at,
    externalItemId: row.external_item_id,
    externalItemType: row.external_item_type,
    notes: row.notes,
  }));
}

export async function addTripExpense(input: {
  tripId: string;
  category: string;
  description: string;
  plannedAmount: number;
  actualAmount?: number;
  splitType?: ExpenseSplitType;
  paidByMemberId?: string;
  notes?: string;
}): Promise<TripExpense> {
  const { data, error } = await supabase
    .from('trip_expenses')
    .insert({
      trip_id: input.tripId,
      category: input.category,
      description: input.description,
      planned_amount: input.plannedAmount,
      actual_amount: input.actualAmount || null,
      split_type: input.splitType || 'equal',
      paid_by_member_id: input.paidByMemberId || null,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  return {
    id: data.id,
    tripId: data.trip_id,
    category: data.category,
    description: data.description,
    plannedAmount: Number(data.planned_amount),
    actualAmount: data.actual_amount ? Number(data.actual_amount) : null,
    currency: data.currency,
    splitType: data.split_type as ExpenseSplitType,
    paidByMemberId: data.paid_by_member_id,
    paymentStatus: data.payment_status as PaymentStatus,
    paidAt: data.paid_at,
    externalItemId: data.external_item_id,
    externalItemType: data.external_item_type,
    notes: data.notes,
  };
}

export async function updateTripExpense(
  expenseId: string,
  updates: Partial<{
    description: string;
    plannedAmount: number;
    actualAmount: number;
    splitType: ExpenseSplitType;
    paidByMemberId: string;
    paymentStatus: PaymentStatus;
    notes: string;
  }>
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.plannedAmount !== undefined) updateData.planned_amount = updates.plannedAmount;
  if (updates.actualAmount !== undefined) updateData.actual_amount = updates.actualAmount;
  if (updates.splitType !== undefined) updateData.split_type = updates.splitType;
  if (updates.paidByMemberId !== undefined) updateData.paid_by_member_id = updates.paidByMemberId;
  if (updates.paymentStatus !== undefined) {
    updateData.payment_status = updates.paymentStatus;
    if (updates.paymentStatus === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }
  }
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const { error } = await supabase
    .from('trip_expenses')
    .update(updateData)
    .eq('id', expenseId);

  if (error) throw new Error(error.message);
}

export async function deleteTripExpense(expenseId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_expenses')
    .delete()
    .eq('id', expenseId);

  if (error) throw new Error(error.message);
}

// ============================================================================
// EXPENSE SPLITS
// ============================================================================

export async function getExpenseSplits(expenseId: string): Promise<ExpenseSplit[]> {
  const { data, error } = await supabase
    .from('expense_splits')
    .select('*')
    .eq('expense_id', expenseId);

  if (error) throw new Error(error.message);
  
  return (data || []).map(row => ({
    id: row.id,
    expenseId: row.expense_id,
    memberId: row.member_id,
    amount: Number(row.amount),
    percentage: row.percentage ? Number(row.percentage) : null,
    isPaid: row.is_paid,
    paidAt: row.paid_at,
  }));
}

export async function setExpenseSplits(
  expenseId: string,
  splits: { memberId: string; amount: number; percentage?: number }[]
): Promise<void> {
  // Delete existing splits
  await supabase.from('expense_splits').delete().eq('expense_id', expenseId);

  // Insert new splits
  if (splits.length > 0) {
    const { error } = await supabase.from('expense_splits').insert(
      splits.map(s => ({
        expense_id: expenseId,
        member_id: s.memberId,
        amount: s.amount,
        percentage: s.percentage || null,
      }))
    );
    if (error) throw new Error(error.message);
  }
}

export async function markSplitPaid(splitId: string, isPaid: boolean): Promise<void> {
  const { error } = await supabase
    .from('expense_splits')
    .update({
      is_paid: isPaid,
      paid_at: isPaid ? new Date().toISOString() : null,
    })
    .eq('id', splitId);

  if (error) throw new Error(error.message);
}

// ============================================================================
// SETTLEMENTS
// ============================================================================

export async function getTripSettlements(tripId: string): Promise<TripSettlement[]> {
  const { data, error } = await supabase
    .from('trip_settlements')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at');

  if (error) throw new Error(error.message);
  
  return (data || []).map(row => ({
    id: row.id,
    tripId: row.trip_id,
    fromMemberId: row.from_member_id,
    toMemberId: row.to_member_id,
    amount: Number(row.amount),
    currency: row.currency,
    isSettled: row.is_settled,
    settledAt: row.settled_at,
    notes: row.notes,
  }));
}

export async function createSettlement(input: {
  tripId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  notes?: string;
}): Promise<TripSettlement> {
  const { data, error } = await supabase
    .from('trip_settlements')
    .insert({
      trip_id: input.tripId,
      from_member_id: input.fromMemberId,
      to_member_id: input.toMemberId,
      amount: input.amount,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  return {
    id: data.id,
    tripId: data.trip_id,
    fromMemberId: data.from_member_id,
    toMemberId: data.to_member_id,
    amount: Number(data.amount),
    currency: data.currency,
    isSettled: data.is_settled,
    settledAt: data.settled_at,
    notes: data.notes,
  };
}

export async function markSettlementComplete(settlementId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_settlements')
    .update({
      is_settled: true,
      settled_at: new Date().toISOString(),
    })
    .eq('id', settlementId);

  if (error) throw new Error(error.message);
}

// ============================================================================
// BUDGET SUMMARY CALCULATION
// ============================================================================

export async function calculateBudgetSummary(tripId: string): Promise<BudgetSummary> {
  const [members, expenses, settlements] = await Promise.all([
    getTripMembers(tripId),
    getTripExpenses(tripId),
    getTripSettlements(tripId),
  ]);

  // Get all splits for all expenses
  const allSplits: ExpenseSplit[] = [];
  for (const expense of expenses) {
    const splits = await getExpenseSplits(expense.id);
    allSplits.push(...splits);
  }

  const totalPlanned = expenses.reduce((sum, e) => sum + e.plannedAmount, 0);
  const totalActual = expenses.reduce((sum, e) => sum + (e.actualAmount || e.plannedAmount), 0);
  const totalPaid = expenses
    .filter(e => e.paymentStatus === 'paid')
    .reduce((sum, e) => sum + (e.actualAmount || e.plannedAmount), 0);
  const totalPending = totalActual - totalPaid;

  // Calculate member balances
  const memberBalances = members.map(member => {
    // What this member owes (their splits that aren't paid)
    const owes = allSplits
      .filter(s => s.memberId === member.id && !s.isPaid)
      .reduce((sum, s) => sum + s.amount, 0);

    // What this member is owed (expenses they paid for others)
    const paidExpenses = expenses.filter(e => e.paidByMemberId === member.id);
    const owed = paidExpenses.reduce((sum, expense) => {
      const expenseSplits = allSplits.filter(s => s.expenseId === expense.id && s.memberId !== member.id && !s.isPaid);
      return sum + expenseSplits.reduce((s, split) => s + split.amount, 0);
    }, 0);

    return {
      memberId: member.id,
      name: member.name || member.email,
      owes,
      owed,
    };
  });

  return {
    totalPlanned,
    totalActual,
    totalPaid,
    totalPending,
    memberBalances,
    settlements,
  };
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useTripMembers(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-members', tripId],
    queryFn: () => getTripMembers(tripId!),
    enabled: !!tripId,
  });
}

export function useTripExpenses(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-expenses', tripId],
    queryFn: () => getTripExpenses(tripId!),
    enabled: !!tripId,
  });
}

export function useBudgetSummary(tripId: string | null) {
  return useQuery({
    queryKey: ['budget-summary', tripId],
    queryFn: () => calculateBudgetSummary(tripId!),
    enabled: !!tripId,
  });
}

export function useAddTripMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addTripMember,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip-members', variables.tripId] });
    },
  });
}

export function useRemoveTripMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, tripId }: { memberId: string; tripId: string }) => removeTripMember(memberId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip-members', variables.tripId] });
    },
  });
}

export function useAddTripExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addTripExpense,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip-expenses', variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary', variables.tripId] });
    },
  });
}

export function useUpdateTripExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, tripId, updates }: { expenseId: string; tripId: string; updates: Parameters<typeof updateTripExpense>[1] }) => 
      updateTripExpense(expenseId, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip-expenses', variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary', variables.tripId] });
    },
  });
}

export function useDeleteTripExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, tripId }: { expenseId: string; tripId: string }) => deleteTripExpense(expenseId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip-expenses', variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary', variables.tripId] });
    },
  });
}

export function useMarkSettlementComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ settlementId, tripId }: { settlementId: string; tripId: string }) => markSettlementComplete(settlementId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budget-summary', variables.tripId] });
    },
  });
}
