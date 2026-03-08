/**
 * Unit Economics Data Hook
 * 
 * Consolidates ALL real data sources for the admin Unit Economics dashboard:
 * 1. trip_cost_tracking → actual API costs, call counts, category breakdown
 * 2. credit_ledger → actual revenue from purchases, credit consumption patterns
 * 3. credit_balances → outstanding liability, user segmentation
 * 4. trips → trip volume, user engagement
 * 5. profiles → total user base
 * 
 * Falls back gracefully when data is missing or sparse.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface DailyMetric {
  date: string;
  apiCost: number;
  revenue: number;
  trips: number;
  users: number;
  costEntries: number;
}

export interface TierRevenue {
  tier: string;
  count: number;
  totalRevenue: number;
  totalCredits: number;
}

export interface UserPurchase {
  userId: string;
  displayName?: string;
  email?: string;
  purchases: Array<{
    tier: string;
    credits: number;
    revenue: number;
    date: string;
  }>;
  totalRevenue: number;
  totalCredits: number;
  purchaseCount: number;
}

export interface CostCategory {
  category: string;
  label: string;
  count: number;
  cost: number;
  googlePlaces: number;
  googlePhotos: number;
  perplexity: number;
  amadeus: number;
}

export interface UnitEconomicsData {
  // === COST DATA (from trip_cost_tracking) ===
  costs: {
    totalCost: number;
    totalEntries: number;
    periodStart: string;
    periodEnd: string;
    
    // Per-service totals
    google: { calls: number; cost: number };
    ai: { calls: number; inputTokens: number; outputTokens: number; cost: number };
    perplexity: { calls: number; cost: number };
    amadeus: { calls: number; cost: number };
    
    // By user-facing category
    categories: CostCategory[];
    
    // By action type
    actions: Record<string, { count: number; cost: number }>;
    
    // By AI model
    models: Record<string, { count: number; inputTokens: number; outputTokens: number }>;
  };
  
  // === REVENUE DATA (from credit_ledger) ===
  revenue: {
    totalRevenue: number;          // Sum of amount_cents / 100 from purchases
    totalCreditsPurchased: number; // Total credits from purchases
    totalCreditsGranted: number;   // Total free credits granted
    totalCreditsSpent: number;     // Total credits consumed
    purchaseCount: number;         // Number of purchase transactions
    
    // Per-tier breakdown
    tiers: TierRevenue[];
    
    // Per-user purchase drilldown
    userPurchases: UserPurchase[];
    
    // Spending patterns
    spendByAction: Record<string, { count: number; credits: number }>;
  };
  
  // === USER METRICS ===
  users: {
    totalUsers: number;           // From profiles
    usersWithBalance: number;     // From credit_balances  
    paidUsers: number;            // Users with purchased_credits > 0
    activeApiUsers: number;       // Users who triggered API calls
    
    // Outstanding liability
    outstandingPurchased: number; // Purchased credits not yet spent
    outstandingFree: number;     // Free credits not yet spent
  };
  
  // === TRIP METRICS ===
  trips: {
    totalTrips: number;
    uniqueTripUsers: number;
    trackedTrips: number;        // Trips with cost tracking data
  };
  
  // === TIME SERIES ===
  dailyMetrics: DailyMetric[];
  
  // === DATA QUALITY ===
  dataQuality: {
    hasCostData: boolean;
    hasRevenueData: boolean;
    hasTripLinkage: boolean;     // Whether cost entries have trip_ids
    costDataDays: number;
    warnings: string[];
  };

  // === TIER DISTRIBUTION ===
  tierDistribution: Array<{ tier: string; count: number; upgradedThisMonth: number }>;

  // === GROUP BUDGETS ===
  groupBudgets: {
    pools: Array<{ tier: string; count: number; allocated: number; remaining: number; depleted: number }>;
    totalPools: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const GOOGLE_PRICING = {
  places: 0.017,
  geocoding: 0.005,
  photos: 0.007,
  routes: 0.005,
};

const CATEGORY_LABELS: Record<string, string> = {
  home_browse: 'Home / Browse',
  quiz: 'Travel DNA Quiz',
  explore: 'Explore',
  itinerary_gen: 'Itinerary Generation',
  itinerary_edit: 'Itinerary Editing',
  booking_search: 'Booking Search',
  recommendations: 'Recommendations',
  enrichment: 'Photo Enrichment',
  other: 'Other',
};

// Credit action to tier mapping (from Stripe metadata or known action_types)
const PURCHASE_TIER_MAP: Record<string, string> = {
  // Flexible packs
  purchase_flex_100: 'flex_100',
  purchase_flex_300: 'flex_300',
  purchase_flex_500: 'flex_500',
  // Voyance Club packs
  purchase_voyager: 'voyager',
  purchase_explorer: 'explorer',
  purchase_adventurer: 'adventurer',
  // Group unlocks
  purchase_group_small: 'group_small',
  purchase_group_medium: 'group_medium',
  purchase_group_large: 'group_large',
  group_unlock_purchase: 'group_unlock',
  group_unlock: 'group_unlock',
  // Smart Finish
  purchase_smart_finish: 'smart_finish',
  smart_finish: 'smart_finish',
  // Admin / manual
  manual_grant: 'manual_grant',
  admin_manual_grant: 'admin_grant',
  admin_corrective_grant: 'corrective_grant',
  // Legacy
  purchase_boost: 'boost',
  purchase_single: 'single',
  purchase_starter: 'starter',
  purchase_weekend: 'weekend',
  stripe_purchase: 'stripe',
  purchase: 'purchase',
};

// Infer revenue from credits_delta when amount_cents is not available.
// Uses known credit pack pricing. Falls back to $0.05/credit average.
function inferRevenueFromCredits(creditsDelta: number, actionType: string, notes?: string | null): number {
  // Try to extract dollar amount from notes (e.g. "2x Quick Top-Up $9 purchases")
  if (notes) {
    const dollarMatch = notes.match(/\$(\d+(?:\.\d{2})?)/);
    const countMatch = notes.match(/(\d+)x\s/i);
    if (dollarMatch) {
      const amount = parseFloat(dollarMatch[1]);
      const count = countMatch ? parseInt(countMatch[1]) : 1;
      return amount * count;
    }
  }
  
  // Known pack sizes → prices
  const abs = Math.abs(creditsDelta);
  if (abs >= 1000) return 17.99;
  if (abs >= 500) return 9.99;
  if (abs >= 200) return 4.99;
  if (abs >= 100) return 4.50;
  
  // Admin/corrective grants are not real revenue
  if (actionType.startsWith('admin_') || actionType === 'corrective_grant') return 0;
  
  return 0;
}

// Determine tier label from credits_delta when action_type mapping fails
function inferTierFromCredits(creditsDelta: number): string {
  const abs = Math.abs(creditsDelta);
  if (abs >= 1000) return 'creator';
  if (abs >= 500) return 'explorer';
  if (abs >= 200) return 'starter';
  if (abs >= 100) return 'quick_topup';
  return 'micro';
}

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchUnitEconomicsData(): Promise<UnitEconomicsData | null> {
  // Auth + admin check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin');

  if (!roles || roles.length === 0) return null;

  // Parallel fetch all data sources — cost data uses server-side RPC aggregation
  const thirtyDaysAgoISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [costSummaryResult, ledgerResult, balanceResult, tripResult, profileNamesResult, tierResult, groupBudgetResult, purchasesResult] = await Promise.all([
    supabase.rpc('get_unit_economics_summary', {
      p_start_date: thirtyDaysAgoISO,
      p_end_date: new Date().toISOString(),
    }),
    supabase.from('credit_ledger').select('user_id, credits_delta, action_type, transaction_type, is_free_credit, amount_cents, created_at, notes'),
    supabase.from('credit_balances').select('user_id, purchased_credits, free_credits'),
    supabase.from('trips').select('id, user_id, created_at', { count: 'exact' }),
    supabase.from('profiles').select('id, display_name'),
    supabase.from('user_tiers').select('tier, updated_at'),
    supabase.from('group_budgets').select('tier, initial_credits, remaining_credits'),
    // NEW: query credit_purchases as the source of truth for revenue
    supabase.from('credit_purchases').select('user_id, credit_type, amount, remaining, source, stripe_session_id, club_tier, created_at'),
  ]);

  const warnings: string[] = [];
  const ledgerEntries = ledgerResult.data || [];
  const balances = balanceResult.data || [];
  const trips = tripResult.data || [];

  // ---- COSTS (from server-side RPC aggregation) ----
  const cs = costSummaryResult.data as any || {};
  
  const googlePlacesCalls = Number(cs.google_places_calls) || 0;
  const googleGeocodingCalls = Number(cs.google_geocoding_calls) || 0;
  const googlePhotosCalls = Number(cs.google_photos_calls) || 0;
  const googleRoutesCalls = Number(cs.google_routes_calls) || 0;
  const perplexityCalls = Number(cs.perplexity_calls) || 0;
  const amadeusCalls = Number(cs.amadeus_calls) || 0;
  const totalInputTokens = Number(cs.total_input_tokens) || 0;
  const totalOutputTokens = Number(cs.total_output_tokens) || 0;
  const aiCallCount = Number(cs.ai_call_count) || 0;
  const totalEstimatedCost = Number(cs.total_cost_usd) || 0;
  const totalCostEntries = Number(cs.total_records) || 0;
  const uniqueApiUserCount = Number(cs.unique_users) || 0;
  const uniqueCostTripCount = Number(cs.unique_trips) || 0;

  // Action breakdown from RPC
  const actions: Record<string, { count: number; cost: number }> = {};
  for (const a of (cs.cost_by_action || [])) {
    actions[a.action_type || 'unknown'] = { count: Number(a.count) || 0, cost: Number(a.cost) || 0 };
  }

  // Model breakdown from RPC
  const models: Record<string, { count: number; inputTokens: number; outputTokens: number }> = {};
  for (const m of (cs.cost_by_model || [])) {
    models[m.model || 'unknown'] = {
      count: Number(m.count) || 0,
      inputTokens: Number(m.input_tokens) || 0,
      outputTokens: Number(m.output_tokens) || 0,
    };
  }

  // Category breakdown from RPC
  const categoryMap: Record<string, CostCategory> = {};
  for (const c of (cs.cost_by_category || [])) {
    const cat = c.category || 'other';
    categoryMap[cat] = {
      category: cat,
      label: CATEGORY_LABELS[cat] || cat,
      count: Number(c.count) || 0,
      cost: Number(c.cost) || 0,
      googlePlaces: Number(c.google_places) || 0,
      googlePhotos: Number(c.google_photos) || 0,
      perplexity: Number(c.perplexity) || 0,
      amadeus: Number(c.amadeus) || 0,
    };
  }

  const googleTotalCost =
    googlePlacesCalls * GOOGLE_PRICING.places +
    googleGeocodingCalls * GOOGLE_PRICING.geocoding +
    googlePhotosCalls * GOOGLE_PRICING.photos +
    googleRoutesCalls * GOOGLE_PRICING.routes;
  
  const perplexityCost = perplexityCalls * 0.005;
  const amadeusCost = amadeusCalls * 0.024;
  const aiCost = Math.max(0, totalEstimatedCost - googleTotalCost - perplexityCost - amadeusCost);

  // Date range from RPC
  const costPeriodStart = cs.date_range?.start ? String(cs.date_range.start).split('T')[0] : '';
  const costPeriodEnd = cs.date_range?.end_date ? String(cs.date_range.end_date).split('T')[0] : '';

  if (totalCostEntries > 0 && uniqueCostTripCount === 0) {
    warnings.push('Cost tracking entries have no trip_id linkage. Per-trip costs are estimated');
  }

  // ---- REVENUE (from credit_ledger) ----
  // A "purchase" is transaction_type='purchase' (real Stripe purchase).
  // Admin grants (transaction_type='credit', is_free_credit=false) are NOT revenue.
  // Revenue is inferred from credits_delta/notes since amount_cents is often NULL.
  let totalRevenue = 0, totalCreditsPurchased = 0, totalCreditsGranted = 0, totalCreditsSpent = 0;
  let purchaseCount = 0;
  const tierRevMap: Record<string, TierRevenue> = {};
  const spendByAction: Record<string, { count: number; credits: number }> = {};

  const isPurchaseEntry = (entry: any): boolean => {
    return entry.transaction_type === 'purchase';
  };

  const isFreeGrantEntry = (entry: any): boolean => {
    return entry.transaction_type === 'credit' && entry.is_free_credit === true;
  };

  for (const entry of ledgerEntries) {
    if (isPurchaseEntry(entry)) {
      // Real purchase — calculate revenue
      const revenue = (entry.amount_cents && entry.amount_cents > 0)
        ? entry.amount_cents / 100
        : inferRevenueFromCredits(entry.credits_delta || 0, entry.action_type || '', entry.notes);
      totalRevenue += revenue;
      totalCreditsPurchased += entry.credits_delta || 0;
      purchaseCount++;

      // Map to tier
      let tierKey = PURCHASE_TIER_MAP[entry.action_type || ''] || '';
      if (!tierKey || tierKey === 'purchase') {
        tierKey = inferTierFromCredits(entry.credits_delta || 0);
      }
      if (!tierRevMap[tierKey]) tierRevMap[tierKey] = { tier: tierKey, count: 0, totalRevenue: 0, totalCredits: 0 };
      tierRevMap[tierKey].count++;
      tierRevMap[tierKey].totalRevenue += revenue;
      tierRevMap[tierKey].totalCredits += entry.credits_delta || 0;
    } else if (isFreeGrantEntry(entry)) {
      totalCreditsGranted += entry.credits_delta || 0;
    } else if (entry.transaction_type === 'spend') {
      totalCreditsSpent += Math.abs(entry.credits_delta || 0);
      const action = entry.action_type || 'unknown';
      if (!spendByAction[action]) spendByAction[action] = { count: 0, credits: 0 };
      spendByAction[action].count++;
      spendByAction[action].credits += Math.abs(entry.credits_delta || 0);
    }
  }

  if (purchaseCount === 0) {
    warnings.push('No purchase transactions in credit ledger. Revenue data is not yet available');
  }

  // Build per-user purchase drilldown
  const profileNameMap = new Map<string, string>();
  for (const p of profileNamesResult.data || []) {
    profileNameMap.set(p.id, p.display_name || 'Unknown');
  }
  
  const userPurchaseMap: Record<string, UserPurchase> = {};
  for (const entry of ledgerEntries) {
    if (isPurchaseEntry(entry) && entry.user_id) {
      if (!userPurchaseMap[entry.user_id]) {
        userPurchaseMap[entry.user_id] = {
          userId: entry.user_id,
          displayName: profileNameMap.get(entry.user_id) || 'Unknown',
          purchases: [],
          totalRevenue: 0,
          totalCredits: 0,
          purchaseCount: 0,
        };
      }
      const up = userPurchaseMap[entry.user_id];
      let tierKey = PURCHASE_TIER_MAP[entry.action_type || ''] || '';
      if (!tierKey || tierKey === 'purchase') {
        tierKey = inferTierFromCredits(entry.credits_delta || 0);
      }
      const revenue = (entry.amount_cents && entry.amount_cents > 0)
        ? entry.amount_cents / 100
        : inferRevenueFromCredits(entry.credits_delta || 0, entry.action_type || '', entry.notes);
      up.purchases.push({
        tier: tierKey,
        credits: entry.credits_delta || 0,
        revenue,
        date: entry.created_at,
      });
      up.totalRevenue += revenue;
      up.totalCredits += entry.credits_delta || 0;
      up.purchaseCount++;
    }
  }
  const userPurchases = Object.values(userPurchaseMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

  // ---- USER METRICS ----
  // Count paid users from both sources, use whichever is higher
  const purchaseEntries = purchasesResult.data || [];
  const paidUsersFromPurchases = new Set(
    purchaseEntries
      .filter(e => e.source === 'stripe' && !['free', 'free_monthly', 'signup_bonus', 'referral_bonus', 'migration'].includes(e.credit_type))
      .map(e => e.user_id)
      .filter(Boolean)
  ).size;

  const paidUsersFromLedger = new Set(
    ledgerEntries
      .filter(e => isPurchaseEntry(e))
      .map(e => (e as any).user_id)
      .filter(Boolean)
  ).size;

  const paidUsers = Math.max(paidUsersFromPurchases, paidUsersFromLedger);

  // Cross-reference revenue with credit_purchases
  const KNOWN_PRICES: Record<string, Record<number, number>> = {
    flex: { 100: 9.00, 300: 25.00, 500: 39.00 },
    club_base: { 300: 49.99, 800: 89.99, 1600: 149.99 },
  };

  let purchasesRevenue = 0;
  let purchasesCount = 0;
  for (const p of purchaseEntries) {
    if (p.source !== 'stripe') continue;
    if (['free', 'free_monthly', 'signup_bonus', 'referral_bonus', 'migration'].includes(p.credit_type)) continue;
    const prices = KNOWN_PRICES[p.credit_type] || {};
    const inferredPrice = prices[p.amount] || (p.amount * 0.05);
    purchasesRevenue += inferredPrice;
    purchasesCount++;
  }

  if (totalRevenue === 0 && purchasesRevenue > 0) {
    totalRevenue = purchasesRevenue;
    purchaseCount = purchasesCount;
    warnings.push('Revenue estimated from credit_purchases (ledger entries missing amount data)');
  }

  // Data integrity warnings
  if (paidUsersFromPurchases > 0 && paidUsersFromLedger === 0) {
    warnings.push('credit_ledger has no purchase entries but credit_purchases does — ledger may not be syncing');
  }
  
  // Outstanding credits from credit_balances (source of truth for display)
  let outstandingPurchased = 0;
  let outstandingFree = 0;
  for (const b of balances) {
    outstandingPurchased += b.purchased_credits || 0;
    outstandingFree += b.free_credits || 0;
  }

  // ---- DAILY TIME SERIES ----
  // Merge cost data from RPC + ledger data by day
  const dailyMap: Record<string, DailyMetric> = {};
  
  for (const d of (cs.cost_by_date || [])) {
    const day = String(d.date);
    if (!dailyMap[day]) dailyMap[day] = { date: day, apiCost: 0, revenue: 0, trips: 0, users: 0, costEntries: 0 };
    dailyMap[day].apiCost += Number(d.cost) || 0;
    dailyMap[day].costEntries += Number(d.records) || 0;
  }

  // Merge trip creation dates
  const dailyTripUsers: Record<string, Set<string>> = {};
  for (const trip of trips) {
    const day = trip.created_at.split('T')[0];
    if (!dailyMap[day]) dailyMap[day] = { date: day, apiCost: 0, revenue: 0, trips: 0, users: 0, costEntries: 0 };
    dailyMap[day].trips++;
    if (!dailyTripUsers[day]) dailyTripUsers[day] = new Set();
    if (trip.user_id) dailyTripUsers[day].add(trip.user_id);
  }

  for (const [day, users] of Object.entries(dailyTripUsers)) {
    if (dailyMap[day]) dailyMap[day].users = users.size;
  }

  // Merge revenue from ledger (purchase entries)
  for (const entry of ledgerEntries) {
    if (isPurchaseEntry(entry)) {
      const day = entry.created_at.split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { date: day, apiCost: 0, revenue: 0, trips: 0, users: 0, costEntries: 0 };
      const revenue = (entry.amount_cents && entry.amount_cents > 0)
        ? entry.amount_cents / 100
        : inferRevenueFromCredits(entry.credits_delta || 0, entry.action_type || '', entry.notes);
      dailyMap[day].revenue += revenue;
    }
  }

  // ---- TIER DISTRIBUTION ----
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const tierRows = tierResult.data || [];
  const tierCountMap: Record<string, { count: number; upgradedThisMonth: number }> = {};
  for (const row of tierRows) {
    const t = (row as any).tier || 'free';
    if (!tierCountMap[t]) tierCountMap[t] = { count: 0, upgradedThisMonth: 0 };
    tierCountMap[t].count++;
    if ((row as any).updated_at && (row as any).updated_at > thirtyDaysAgo) {
      tierCountMap[t].upgradedThisMonth++;
    }
  }
  const tierDistribution = Object.entries(tierCountMap).map(([tier, data]) => ({
    tier,
    count: data.count,
    upgradedThisMonth: data.upgradedThisMonth,
  }));

  // ---- GROUP BUDGETS ----
  const groupRows = groupBudgetResult.data || [];
  const groupPoolMap: Record<string, { count: number; allocated: number; remaining: number; depleted: number }> = {};
  for (const row of groupRows) {
    const t = (row as any).tier || 'unknown';
    if (!groupPoolMap[t]) groupPoolMap[t] = { count: 0, allocated: 0, remaining: 0, depleted: 0 };
    groupPoolMap[t].count++;
    groupPoolMap[t].allocated += (row as any).initial_credits || 0;
    groupPoolMap[t].remaining += (row as any).remaining_credits || 0;
    if (((row as any).remaining_credits || 0) === 0) groupPoolMap[t].depleted++;
  }
  const groupBudgets = {
    pools: Object.entries(groupPoolMap).map(([tier, data]) => ({ tier, ...data })),
    totalPools: groupRows.length,
  };

  const dailyMetrics = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // ---- DATA QUALITY ----
  const costDataDays = (cs.cost_by_date || []).length;

  return {
    costs: {
      totalCost: totalEstimatedCost,
      totalEntries: totalCostEntries,
      periodStart: costPeriodStart,
      periodEnd: costPeriodEnd,
      google: { calls: googlePlacesCalls + googleGeocodingCalls + googlePhotosCalls + googleRoutesCalls, cost: googleTotalCost },
      ai: { calls: aiCallCount, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, cost: aiCost },
      perplexity: { calls: perplexityCalls, cost: perplexityCost },
      amadeus: { calls: amadeusCalls, cost: amadeusCost },
      categories: Object.values(categoryMap).sort((a, b) => b.cost - a.cost),
      actions,
      models,
    },
    revenue: {
      totalRevenue,
      totalCreditsPurchased,
      totalCreditsGranted,
      totalCreditsSpent,
      purchaseCount,
      tiers: Object.values(tierRevMap),
      userPurchases,
      spendByAction,
    },
    users: {
      totalUsers: profileNamesResult.data?.length || 0,
      usersWithBalance: balances.length,
      paidUsers,
      activeApiUsers: uniqueApiUserCount,
      outstandingPurchased,
      outstandingFree,
    },
    trips: {
      totalTrips: tripResult.count || trips.length,
      uniqueTripUsers: new Set(trips.map(t => t.user_id)).size,
      trackedTrips: uniqueCostTripCount,
    },
    dailyMetrics,
    dataQuality: {
      hasCostData: totalCostEntries > 0,
      hasRevenueData: purchaseCount > 0,
      hasTripLinkage: uniqueCostTripCount > 0,
      costDataDays,
      warnings,
    },
    tierDistribution,
    groupBudgets,
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useUnitEconomicsData() {
  const query = useQuery({
    queryKey: ['unit-economics-data'],
    queryFn: fetchUnitEconomicsData,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (query.isError && query.error) {
      const message = query.error instanceof Error ? query.error.message : 'Failed to load unit economics data';
      toast.error(message, { id: 'unit-econ-error' });
    }
  }, [query.isError, query.error]);

  return query;
}
