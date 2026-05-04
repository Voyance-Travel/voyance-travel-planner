/**
 * Trip Budget Hook
 * 
 * React hook for managing trip budgets with real-time updates.
 * All cost data now reads from activity_costs (single source of truth).
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoneyFromUsdCents } from '@/lib/currency';
import {
  getTripBudgetSettings,
  updateTripBudgetSettings,
  getBudgetSummary,
  getBudgetLedger,
  deleteLedgerEntry,
  recordCommittedExpense,
  getCategoryAllocations,
  getDefaultAllocations,
  type TripBudgetSettings,
  type BudgetSummary,
  type BudgetLedgerEntry,
  type CategoryAllocation,
  type BudgetCategory,
  type BudgetAllocations,
} from '@/services/tripBudgetService';

interface UseTripBudgetOptions {
  tripId: string;
  totalDays?: number;
  enabled?: boolean;
}

interface UseTripBudgetReturn {
  // Data
  settings: TripBudgetSettings | null;
  summary: BudgetSummary | null;
  ledger: BudgetLedgerEntry[];
  allocations: CategoryAllocation[];
  
  // Loading states
  isLoading: boolean;
  isUpdating: boolean;
  
  // Computed
  hasBudget: boolean;
  isOverBudget: boolean;
  warningLevel: 'none' | 'yellow' | 'red';
  formattedBudget: string;
  formattedRemaining: string;
  
  // Actions
  updateSettings: (settings: Partial<TripBudgetSettings>) => Promise<void>;
  setBudget: (amountCents: number, mode: 'total' | 'per_person') => Promise<void>;
  setAllocations: (allocations: BudgetAllocations) => Promise<void>;
  addExpense: (category: BudgetCategory, amountCents: number, description: string, bookingId?: string) => Promise<void>;
  removeEntry: (entryId: string) => Promise<void>;
  refetch: () => void;
}

export function useTripBudget({ tripId, totalDays = 7, enabled = true }: UseTripBudgetOptions): UseTripBudgetReturn {
  const queryClient = useQueryClient();
  
  // Fetch settings
  const {
    data: settings,
    isLoading: settingsLoading,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ['tripBudgetSettings', tripId],
    queryFn: () => getTripBudgetSettings(tripId),
    enabled: enabled && !!tripId,
  });
  
  // Fetch summary (now derived from activity_costs)
  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['tripBudgetSummary', tripId, totalDays],
    queryFn: () => getBudgetSummary(tripId, totalDays),
    enabled: enabled && !!tripId,
  });
  
  // Fetch ledger (now derived from activity_costs)
  const {
    data: ledger = [],
    isLoading: ledgerLoading,
    refetch: refetchLedger,
  } = useQuery({
    queryKey: ['tripBudgetLedger', tripId],
    queryFn: () => getBudgetLedger(tripId),
    enabled: enabled && !!tripId,
  });
  
  // Fetch allocations
  const {
    data: allocations = [],
    refetch: refetchAllocations,
  } = useQuery({
    queryKey: ['tripBudgetAllocations', tripId],
    queryFn: () => getCategoryAllocations(tripId),
    enabled: enabled && !!tripId && !!settings?.budget_total_cents,
  });
  
  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: (newSettings: Partial<TripBudgetSettings>) => 
      updateTripBudgetSettings(tripId, newSettings),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tripBudgetSettings', tripId] }),
        queryClient.invalidateQueries({ queryKey: ['tripBudgetSummary', tripId] }),
        queryClient.invalidateQueries({ queryKey: ['tripBudgetAllocations', tripId] }),
      ]);
      window.dispatchEvent(new CustomEvent('booking-changed'));
    },
    onError: () => {
      toast.error('Failed to update budget settings');
    },
  });
  
  // Add expense mutation
  const addExpenseMutation = useMutation({
    mutationFn: ({ category, amountCents, description, bookingId }: {
      category: BudgetCategory;
      amountCents: number;
      description: string;
      bookingId?: string;
    }) => recordCommittedExpense(tripId, category, amountCents, description, bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripBudgetLedger', tripId] });
      queryClient.invalidateQueries({ queryKey: ['tripBudgetSummary', tripId] });
      toast.success('Expense recorded');
    },
    onError: () => {
      toast.error('Failed to record expense');
    },
  });
  
  // Delete entry mutation (now deletes from activity_costs)
  const deleteEntryMutation = useMutation({
    mutationFn: deleteLedgerEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripBudgetLedger', tripId] });
      queryClient.invalidateQueries({ queryKey: ['tripBudgetSummary', tripId] });
      window.dispatchEvent(new CustomEvent('booking-changed'));
    },
    onError: () => {
      toast.error('Failed to remove entry');
    },
  });
  
  // Computed values
  const hasBudget = !!(settings?.budget_total_cents && settings.budget_total_cents > 0);
  const isOverBudget = summary ? summary.usedPercent >= 100 : false;
  
  const warningLevel: 'none' | 'yellow' | 'red' = (() => {
    if (!summary || !settings?.budget_warnings_enabled) return 'none';
    if (settings.budget_warning_threshold === 'off') return 'none';
    if (summary.status === 'red') return 'red';
    if (summary.status === 'yellow' && settings.budget_warning_threshold !== 'red_only') return 'yellow';
    return 'none';
  })();
  
  const formatCurrency = useCallback((cents: number) => {
    // Canonical storage is USD cents. Convert to the user's chosen budget
    // currency before formatting so the Budget tab matches the itinerary
    // header (which converts via the same shared FX module).
    const currency = settings?.budget_currency || 'USD';
    return formatMoneyFromUsdCents(cents, currency);
  }, [settings?.budget_currency]);

  // Action handlers
  const updateSettings = async (newSettings: Partial<TripBudgetSettings>) => {
    await updateMutation.mutateAsync(newSettings);
  };
  
  const setBudget = async (amountCents: number, mode: 'total' | 'per_person') => {
    const travelers = settings?.travelers || 1;
    const totalCents = mode === 'per_person' ? amountCents * travelers : amountCents;
    
    await updateMutation.mutateAsync({
      budget_total_cents: totalCents,
      budget_input_mode: mode,
    });
    
    toast.success(`Budget set to ${formatCurrency(totalCents)}`);
  };
  
  const setAllocations = async (newAllocations: BudgetAllocations) => {
    await updateMutation.mutateAsync({
      budget_allocations: newAllocations,
    });
    toast.success('Budget allocations updated');
  };
  
  const addExpense = async (
    category: BudgetCategory,
    amountCents: number,
    description: string,
    bookingId?: string
  ) => {
    await addExpenseMutation.mutateAsync({ category, amountCents, description, bookingId });
  };
  
  const removeEntry = async (entryId: string) => {
    await deleteEntryMutation.mutateAsync(entryId);
  };
  
  const refetch = () => {
    refetchSettings();
    refetchSummary();
    refetchLedger();
    refetchAllocations();
  };
  
  return {
    settings: settings || null,
    summary: summary || null,
    ledger,
    allocations,
    
    isLoading: settingsLoading || summaryLoading || ledgerLoading,
    isUpdating: updateMutation.isPending || addExpenseMutation.isPending,
    
    hasBudget,
    isOverBudget,
    warningLevel,
    formattedBudget: hasBudget ? formatCurrency(settings!.budget_total_cents!) : '$0',
    formattedRemaining: summary ? formatCurrency(summary.remainingCents) : '$0',
    
    updateSettings,
    setBudget,
    setAllocations,
    addExpense,
    removeEntry,
    refetch,
  };
}

export default useTripBudget;
