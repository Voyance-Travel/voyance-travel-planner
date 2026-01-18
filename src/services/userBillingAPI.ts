/**
 * User Billing API Service
 * 
 * Handles billing-related endpoints using Supabase Edge Functions.
 * Stripe operations go through existing edge functions.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'enterprise';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface PaymentMethod {
  id: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
}

export interface Transaction {
  id: string;
  sessionId?: string;
  paymentIntentId?: string;
  amount: string;
  currency: string;
  status: TransactionStatus;
  metadata?: Record<string, unknown>;
  isRefunded: boolean;
  refundedAt?: string;
  createdAt: string;
  displayAmount: string;
  displayStatus?: string;
}

export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  customerId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  createdAt: string;
  isActive: boolean;
  isCanceled: boolean;
  willRenew: boolean;
  daysRemaining?: number | null;
  stripe?: {
    id: string;
    priceId: string;
    amount: number;
    currency: string;
    interval: string;
    trialEnd?: number;
    nextInvoiceAmount?: number | null;
  } | null;
  actions: {
    canCancel: boolean;
    canReactivate: boolean;
    canUpgrade: boolean;
    canDowngrade: boolean;
  };
}

export interface BillingOverview {
  hasStripeCustomer: boolean;
  stripeCustomerId?: string;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    tier: SubscriptionTier;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd: boolean;
    isActive: boolean;
    daysUntilRenewal?: number | null;
  } | null;
  paymentMethods: PaymentMethod[];
  hasPaymentMethod: boolean;
  recentTransactions: Transaction[];
  stats: {
    totalSpent: number;
    totalRefunded: number;
    netSpent: number;
    transactionCount: number;
    averageTransactionAmount: number;
  };
  actions: {
    canUpgrade: boolean;
    canAddPaymentMethod: boolean;
    canViewInvoices: boolean;
    canManageSubscription: boolean;
  };
}

export interface BillingProfileSummary {
  hasActiveSubscription: boolean;
  subscriptionTier: SubscriptionTier;
  hasPaymentMethod: boolean;
  hasStripeCustomer: boolean;
  subscription: {
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    renewalDate?: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  spending: {
    thisYear: number;
    currency: string;
    lastTransaction?: {
      amount: string;
      date: string;
      displayAmount: string;
    } | null;
  };
  loyalty: {
    points: number;
    tier: LoyaltyTier;
    totalTripsBooked: number;
  };
  actions: {
    showUpgradePrompt: boolean;
    showAddPaymentMethod: boolean;
    showManageBilling: boolean;
  };
}

export interface Invoice {
  id: string;
  number?: string;
  status?: string;
  amount: number;
  currency: string;
  paid: boolean;
  dueDate?: number;
  createdAt: Date;
  pdfUrl?: string;
  hostedUrl?: string;
  displayAmount: string;
  description: string;
}

export interface TransactionsResponse {
  success: boolean;
  transactions: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ============================================================================
// API FUNCTIONS - Using Supabase Edge Functions
// ============================================================================

/**
 * Get billing overview from check-subscription edge function
 */
export async function getBillingOverview(): Promise<{ success: boolean; billing: BillingOverview }> {
  const { data, error } = await supabase.functions.invoke('check-subscription');
  
  if (error) {
    throw new Error(error.message || 'Failed to fetch billing overview');
  }
  
  // Transform check-subscription response to BillingOverview format
  const hasSubscription = data?.hasSubscription || false;
  
  return {
    success: true,
    billing: {
      hasStripeCustomer: hasSubscription,
      subscription: hasSubscription ? {
        id: data.subscription?.id || 'sub_default',
        status: 'active' as SubscriptionStatus,
        tier: (data.planId as SubscriptionTier) || 'free',
        currentPeriodEnd: data.subscription?.currentPeriodEnd,
        cancelAtPeriodEnd: data.subscription?.cancelAtPeriodEnd || false,
        isActive: true,
        daysUntilRenewal: null,
      } : null,
      paymentMethods: [],
      hasPaymentMethod: hasSubscription,
      recentTransactions: [],
      stats: {
        totalSpent: 0,
        totalRefunded: 0,
        netSpent: 0,
        transactionCount: 0,
        averageTransactionAmount: 0,
      },
      actions: {
        canUpgrade: !hasSubscription,
        canAddPaymentMethod: true,
        canViewInvoices: hasSubscription,
        canManageSubscription: hasSubscription,
      },
    },
  };
}

/**
 * Get transaction history - uses local storage for now
 */
export async function getTransactions(params?: {
  limit?: number;
  offset?: number;
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
}): Promise<TransactionsResponse> {
  // For now, return empty transactions - would need dedicated edge function
  return {
    success: true,
    transactions: [],
    pagination: {
      total: 0,
      limit: params?.limit || 10,
      offset: params?.offset || 0,
      hasMore: false,
    },
  };
}

/**
 * Get detailed subscription info
 */
export async function getSubscription(): Promise<{ success: boolean; subscription: Subscription | null; message?: string }> {
  const { data, error } = await supabase.functions.invoke('check-subscription');
  
  if (error) {
    throw new Error(error.message || 'Failed to fetch subscription');
  }
  
  if (!data?.hasSubscription) {
    return { success: true, subscription: null, message: 'No active subscription' };
  }
  
  return {
    success: true,
    subscription: {
      id: data.subscription?.id || 'sub_default',
      status: 'active',
      tier: (data.planId as SubscriptionTier) || 'free',
      currentPeriodStart: data.subscription?.currentPeriodStart,
      currentPeriodEnd: data.subscription?.currentPeriodEnd,
      cancelAtPeriodEnd: data.subscription?.cancelAtPeriodEnd || false,
      createdAt: new Date().toISOString(),
      isActive: true,
      isCanceled: false,
      willRenew: !data.subscription?.cancelAtPeriodEnd,
      daysRemaining: null,
      stripe: null,
      actions: {
        canCancel: true,
        canReactivate: false,
        canUpgrade: true,
        canDowngrade: false,
      },
    },
  };
}

/**
 * Create Stripe customer portal session
 */
export async function createCustomerPortalSession(): Promise<{ success: boolean; url: string }> {
  const { data, error } = await supabase.functions.invoke('customer-portal');
  
  if (error) {
    throw new Error(error.message || 'Failed to create portal session');
  }
  
  return { success: true, url: data.url };
}

/**
 * Get billing profile summary
 */
export async function getBillingProfileSummary(): Promise<{ success: boolean; billing: BillingProfileSummary }> {
  const { data, error } = await supabase.functions.invoke('check-subscription');
  
  if (error) {
    throw new Error(error.message || 'Failed to fetch billing summary');
  }
  
  const hasSubscription = data?.hasSubscription || false;
  
  return {
    success: true,
    billing: {
      hasActiveSubscription: hasSubscription,
      subscriptionTier: (data?.planId as SubscriptionTier) || 'free',
      hasPaymentMethod: hasSubscription,
      hasStripeCustomer: hasSubscription,
      subscription: hasSubscription ? {
        tier: (data.planId as SubscriptionTier) || 'free',
        status: 'active',
        renewalDate: data.subscription?.currentPeriodEnd,
        cancelAtPeriodEnd: data.subscription?.cancelAtPeriodEnd || false,
      } : null,
      spending: {
        thisYear: 0,
        currency: 'USD',
        lastTransaction: null,
      },
      loyalty: {
        points: 0,
        tier: 'bronze',
        totalTripsBooked: 0,
      },
      actions: {
        showUpgradePrompt: !hasSubscription,
        showAddPaymentMethod: !hasSubscription,
        showManageBilling: hasSubscription,
      },
    },
  };
}

/**
 * Get user invoices - placeholder for future implementation
 */
export async function getInvoices(limit = 10): Promise<{ success: boolean; invoices: Invoice[] }> {
  // Would need dedicated edge function to fetch from Stripe
  return { success: true, invoices: [] };
}

/**
 * Create setup intent for adding payment method
 */
export async function createSetupIntent(): Promise<{ success: boolean; clientSecret: string; customerId: string }> {
  // Would need dedicated edge function
  throw new Error('Setup intent creation requires Stripe integration - use customer portal instead');
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useBillingOverview() {
  return useQuery({
    queryKey: ['billing-overview'],
    queryFn: getBillingOverview,
    staleTime: 60000,
  });
}

export function useTransactions(params?: {
  limit?: number;
  offset?: number;
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ['billing-transactions', params],
    queryFn: () => getTransactions(params),
    staleTime: 60000,
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: getSubscription,
    staleTime: 60000,
  });
}

export function useCreateCustomerPortalSession() {
  return useMutation({
    mutationFn: createCustomerPortalSession,
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}

export function useBillingProfileSummary() {
  return useQuery({
    queryKey: ['billing-profile-summary'],
    queryFn: getBillingProfileSummary,
    staleTime: 60000,
  });
}

export function useInvoices(limit = 10) {
  return useQuery({
    queryKey: ['invoices', limit],
    queryFn: () => getInvoices(limit),
    staleTime: 60000,
  });
}

export function useCreateSetupIntent() {
  return useMutation({
    mutationFn: createSetupIntent,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatSubscriptionTier(tier: SubscriptionTier): string {
  const labels: Record<SubscriptionTier, string> = {
    free: 'Free',
    basic: 'Basic',
    premium: 'Premium',
    enterprise: 'Enterprise',
  };
  return labels[tier] || tier;
}

export function formatSubscriptionStatus(status: SubscriptionStatus): string {
  const labels: Record<SubscriptionStatus, string> = {
    active: 'Active',
    canceled: 'Canceled',
    past_due: 'Past Due',
    trialing: 'Trial',
    incomplete: 'Incomplete',
  };
  return labels[status] || status;
}

export function getSubscriptionStatusColor(status: SubscriptionStatus): string {
  const colors: Record<SubscriptionStatus, string> = {
    active: 'text-green-600',
    canceled: 'text-gray-500',
    past_due: 'text-red-600',
    trialing: 'text-blue-600',
    incomplete: 'text-yellow-600',
  };
  return colors[status] || 'text-gray-500';
}

export function formatLoyaltyTier(tier: LoyaltyTier): string {
  const labels: Record<LoyaltyTier, string> = {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
  };
  return labels[tier] || tier;
}
