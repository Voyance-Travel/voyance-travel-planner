/**
 * User Billing API Service
 * 
 * Handles billing-related endpoints including subscriptions,
 * payment methods, transactions, and invoices.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

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
// API FUNCTIONS
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  const token = localStorage.getItem('voyance_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Get billing overview
 */
export async function getBillingOverview(): Promise<{ success: boolean; billing: BillingOverview }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/user/billing/overview`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch billing overview');
  }

  return response.json();
}

/**
 * Get transaction history with pagination
 */
export async function getTransactions(params?: {
  limit?: number;
  offset?: number;
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
}): Promise<TransactionsResponse> {
  const headers = await getAuthHeader();
  const queryParams = new URLSearchParams();

  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.offset) queryParams.set('offset', params.offset.toString());
  if (params?.status) queryParams.set('status', params.status);
  if (params?.startDate) queryParams.set('startDate', params.startDate);
  if (params?.endDate) queryParams.set('endDate', params.endDate);

  const url = `${API_BASE_URL}/api/v1/user/billing/transactions${queryParams.toString() ? `?${queryParams}` : ''}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch transactions');
  }

  return response.json();
}

/**
 * Get detailed subscription info
 */
export async function getSubscription(): Promise<{ success: boolean; subscription: Subscription | null; message?: string }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/user/billing/subscription`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch subscription');
  }

  return response.json();
}

/**
 * Create Stripe customer portal session
 */
export async function createCustomerPortalSession(): Promise<{ success: boolean; url: string }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/user/billing/customer-portal`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Creation failed' }));
    throw new Error(error.error || 'Failed to create portal session');
  }

  return response.json();
}

/**
 * Get billing profile summary (simplified for profile page)
 */
export async function getBillingProfileSummary(): Promise<{ success: boolean; billing: BillingProfileSummary }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/user/billing/profile-summary`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch billing summary');
  }

  return response.json();
}

/**
 * Get user invoices
 */
export async function getInvoices(limit = 10): Promise<{ success: boolean; invoices: Invoice[] }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/user/billing/invoices?limit=${limit}`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch invoices');
  }

  return response.json();
}

/**
 * Create setup intent for adding payment method
 */
export async function createSetupIntent(): Promise<{ success: boolean; clientSecret: string; customerId: string }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/user/billing/create-setup-intent`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Creation failed' }));
    throw new Error(error.error || 'Failed to create setup intent');
  }

  return response.json();
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
      // Redirect to Stripe customer portal
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
