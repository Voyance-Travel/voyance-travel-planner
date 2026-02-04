/**
 * Admin Metrics Hook
 * Fetches aggregated data for the admin dashboard
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminMetrics {
  // Credit metrics
  totalCreditsSpent: number;
  totalCreditsPurchased: number;
  totalFreeCreditsUsed: number;
  totalRevenueFromCredits: number;
  
  // User metrics
  totalUsers: number;
  activeUsers: number; // Users with activity in last 30 days
  paidUsers: number;   // Users who have purchased credits
  
  // Activity breakdown
  activityBreakdown: Record<string, number>;
  
  // Balance metrics
  outstandingPurchasedCredits: number;
  outstandingFreeCredits: number;
  
  // Time series (last 30 days)
  dailyMetrics: Array<{
    date: string;
    creditsSpent: number;
    creditsPurchased: number;
    revenue: number;
    newUsers: number;
  }>;
}

async function fetchAdminMetrics(): Promise<AdminMetrics> {
  // Check admin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin');

  if (!roles || roles.length === 0) {
    throw new Error('Admin access required');
  }

  // Fetch credit ledger aggregates
  const { data: spendData } = await supabase
    .from('credit_ledger')
    .select('credits_delta, action_type, is_free_credit, amount_cents')
    .eq('transaction_type', 'spend');

  const { data: purchaseData } = await supabase
    .from('credit_ledger')
    .select('credits_delta, amount_cents')
    .eq('transaction_type', 'purchase');

  // Fetch current balances
  const { data: balances } = await supabase
    .from('credit_balances')
    .select('purchased_credits, free_credits, user_id');

  // Fetch user counts
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  // Calculate metrics
  let totalCreditsSpent = 0;
  let totalFreeCreditsUsed = 0;
  const activityBreakdown: Record<string, number> = {};

  for (const entry of spendData || []) {
    const delta = Math.abs(entry.credits_delta || 0);
    totalCreditsSpent += delta;
    
    if (entry.is_free_credit) {
      totalFreeCreditsUsed += delta;
    }
    
    const action = entry.action_type || 'unknown';
    activityBreakdown[action] = (activityBreakdown[action] || 0) + 1;
  }

  let totalCreditsPurchased = 0;
  let totalRevenueFromCredits = 0;

  for (const entry of purchaseData || []) {
    totalCreditsPurchased += entry.credits_delta || 0;
    totalRevenueFromCredits += (entry.amount_cents || 0) / 100;
  }

  let outstandingPurchasedCredits = 0;
  let outstandingFreeCredits = 0;
  const usersWithPurchases = new Set<string>();

  for (const balance of balances || []) {
    outstandingPurchasedCredits += balance.purchased_credits || 0;
    outstandingFreeCredits += balance.free_credits || 0;
    
    if ((balance.purchased_credits || 0) > 0) {
      usersWithPurchases.add(balance.user_id);
    }
  }

  // For now, consider active users as those with any balance
  const activeUsers = balances?.length || 0;
  const paidUsers = usersWithPurchases.size;

  return {
    totalCreditsSpent,
    totalCreditsPurchased,
    totalFreeCreditsUsed,
    totalRevenueFromCredits,
    totalUsers: totalUsers || 0,
    activeUsers,
    paidUsers,
    activityBreakdown,
    outstandingPurchasedCredits,
    outstandingFreeCredits,
    dailyMetrics: [], // TODO: Implement daily aggregation
  };
}

export function useAdminMetrics() {
  return useQuery({
    queryKey: ['admin-metrics'],
    queryFn: fetchAdminMetrics,
    staleTime: 60_000, // 1 minute
    retry: 1,
  });
}
