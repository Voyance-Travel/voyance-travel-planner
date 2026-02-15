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
  group_unlock: 'group_unlock',
  // Smart Finish
  purchase_smart_finish: 'smart_finish',
  smart_finish: 'smart_finish',
  // Legacy
  purchase_boost: 'boost',
  purchase_single: 'single',
  purchase_starter: 'starter',
  purchase_weekend: 'weekend',
  stripe_purchase: 'unknown',
  purchase: 'unknown',
};

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

  // Parallel fetch all data sources
  const [costResult, ledgerResult, balanceResult, tripResult, profileResult, profileNamesResult, tierResult, groupBudgetResult] = await Promise.all([
    supabase.from('trip_cost_tracking').select('*')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true }),
    supabase.from('credit_ledger').select('user_id, credits_delta, action_type, transaction_type, is_free_credit, amount_cents, created_at, notes'),
    supabase.from('credit_balances').select('user_id, purchased_credits, free_credits'),
    supabase.from('trips').select('id, user_id, created_at', { count: 'exact' }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id, display_name'),
    supabase.from('user_tiers').select('tier, updated_at'),
    supabase.from('group_budgets').select('tier, initial_credits, remaining_credits'),
  ]);

  const warnings: string[] = [];
  const costEntries = costResult.data || [];
  const ledgerEntries = ledgerResult.data || [];
  const balances = balanceResult.data || [];
  const trips = tripResult.data || [];

  // ---- COSTS ----
  let googlePlacesCalls = 0, googleGeocodingCalls = 0, googlePhotosCalls = 0, googleRoutesCalls = 0;
  let perplexityCalls = 0, amadeusCalls = 0;
  let totalInputTokens = 0, totalOutputTokens = 0, aiCallCount = 0;
  let totalEstimatedCost = 0;
  
  const actions: Record<string, { count: number; cost: number }> = {};
  const models: Record<string, { count: number; inputTokens: number; outputTokens: number }> = {};
  const categoryMap: Record<string, CostCategory> = {};

  for (const entry of costEntries) {
    const cost = entry.estimated_cost_usd || 0;
    totalEstimatedCost += cost;

    googlePlacesCalls += entry.google_places_calls || 0;
    googleGeocodingCalls += entry.google_geocoding_calls || 0;
    googlePhotosCalls += entry.google_photos_calls || 0;
    googleRoutesCalls += entry.google_routes_calls || 0;
    perplexityCalls += entry.perplexity_calls || 0;
    amadeusCalls += entry.amadeus_calls || 0;
    totalInputTokens += entry.input_tokens || 0;
    totalOutputTokens += entry.output_tokens || 0;
    if (entry.input_tokens || entry.output_tokens) aiCallCount++;

    // Action breakdown
    const action = entry.action_type || 'unknown';
    if (!actions[action]) actions[action] = { count: 0, cost: 0 };
    actions[action].count++;
    actions[action].cost += cost;

    // Model breakdown
    const model = entry.model || 'unknown';
    if (!models[model]) models[model] = { count: 0, inputTokens: 0, outputTokens: 0 };
    models[model].count++;
    models[model].inputTokens += entry.input_tokens || 0;
    models[model].outputTokens += entry.output_tokens || 0;

    // Category breakdown
    const cat = entry.cost_category || 'other';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { category: cat, label: CATEGORY_LABELS[cat] || cat, count: 0, cost: 0, googlePlaces: 0, googlePhotos: 0, perplexity: 0, amadeus: 0 };
    }
    categoryMap[cat].count++;
    categoryMap[cat].cost += cost;
    categoryMap[cat].googlePlaces += entry.google_places_calls || 0;
    categoryMap[cat].googlePhotos += entry.google_photos_calls || 0;
    categoryMap[cat].perplexity += entry.perplexity_calls || 0;
    categoryMap[cat].amadeus += entry.amadeus_calls || 0;
  }

  const googleTotalCost =
    googlePlacesCalls * GOOGLE_PRICING.places +
    googleGeocodingCalls * GOOGLE_PRICING.geocoding +
    googlePhotosCalls * GOOGLE_PRICING.photos +
    googleRoutesCalls * GOOGLE_PRICING.routes;
  
  const perplexityCost = perplexityCalls * 0.005;
  const amadeusCost = amadeusCalls * 0.024;
  const aiCost = Math.max(0, totalEstimatedCost - googleTotalCost - perplexityCost - amadeusCost);

  const costDates = costEntries.map(e => e.created_at);
  const uniqueCostTripIds = new Set(costEntries.filter(e => e.trip_id).map(e => e.trip_id));

  if (costEntries.length > 0 && uniqueCostTripIds.size === 0) {
    warnings.push('Cost tracking entries have no trip_id linkage — per-trip costs are estimated');
  }

  // ---- REVENUE (from credit_ledger) ----
  let totalRevenue = 0, totalCreditsPurchased = 0, totalCreditsGranted = 0, totalCreditsSpent = 0;
  let purchaseCount = 0;
  const tierRevMap: Record<string, TierRevenue> = {};
  const spendByAction: Record<string, { count: number; credits: number }> = {};

  for (const entry of ledgerEntries) {
    if (entry.transaction_type === 'purchase' || (entry.transaction_type === 'credit' && entry.amount_cents && entry.amount_cents > 0)) {
      // Revenue-generating transaction
      totalRevenue += (entry.amount_cents || 0) / 100;
      totalCreditsPurchased += entry.credits_delta || 0;
      purchaseCount++;

      // Try to map to tier
      const tierKey = PURCHASE_TIER_MAP[entry.action_type || ''] || 'unknown';
      if (!tierRevMap[tierKey]) tierRevMap[tierKey] = { tier: tierKey, count: 0, totalRevenue: 0, totalCredits: 0 };
      tierRevMap[tierKey].count++;
      tierRevMap[tierKey].totalRevenue += (entry.amount_cents || 0) / 100;
      tierRevMap[tierKey].totalCredits += entry.credits_delta || 0;
    } else if (entry.transaction_type === 'credit' && entry.is_free_credit) {
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
    warnings.push('No purchase transactions in credit ledger — revenue data is not yet available');
  }

  // Build per-user purchase drilldown
  const profileNameMap = new Map<string, string>();
  for (const p of profileNamesResult.data || []) {
    profileNameMap.set(p.id, p.display_name || 'Unknown');
  }
  
  const userPurchaseMap: Record<string, UserPurchase> = {};
  for (const entry of ledgerEntries) {
    if ((entry.transaction_type === 'purchase' || (entry.transaction_type === 'credit' && entry.amount_cents && entry.amount_cents > 0)) && entry.user_id) {
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
      const tierKey = PURCHASE_TIER_MAP[entry.action_type || ''] || 'unknown';
      up.purchases.push({
        tier: tierKey,
        credits: entry.credits_delta || 0,
        revenue: (entry.amount_cents || 0) / 100,
        date: entry.created_at,
      });
      up.totalRevenue += (entry.amount_cents || 0) / 100;
      up.totalCredits += entry.credits_delta || 0;
      up.purchaseCount++;
    }
  }
  const userPurchases = Object.values(userPurchaseMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

  // ---- USER METRICS ----
  const uniqueApiUsers = new Set(costEntries.filter(e => e.user_id).map(e => e.user_id));
  
  
  // Count paid users from actual purchase transactions in ledger (not system-granted credits)
  const paidUsers = new Set(
    ledgerEntries
      .filter(e => e.transaction_type === 'purchase' && (e.amount_cents || 0) > 0)
      .map(e => (e as any).user_id)
      .filter(Boolean)
  ).size;
  
  // Outstanding credits: only count purchased_credits that are backed by real Stripe purchases
  // System-generated test credits in credit_balances.purchased_credits don't count
  const realPurchasedCreditsFromLedger = ledgerEntries
    .filter(e => e.transaction_type === 'purchase' && (e.amount_cents || 0) > 0)
    .reduce((sum, e) => sum + (e.credits_delta || 0), 0);
  const realSpentPurchasedCredits = ledgerEntries
    .filter(e => e.transaction_type === 'spend' && !e.is_free_credit)
    .reduce((sum, e) => sum + Math.abs(e.credits_delta || 0), 0);
  const outstandingPurchased = Math.max(0, realPurchasedCreditsFromLedger - realSpentPurchasedCredits);
  
  let outstandingFree = 0;
  for (const b of balances) {
    outstandingFree += b.free_credits || 0;
  }

  // ---- DAILY TIME SERIES ----
  // Merge cost data + ledger data by day
  const dailyMap: Record<string, DailyMetric> = {};
  
  for (const entry of costEntries) {
    const day = entry.created_at.split('T')[0];
    if (!dailyMap[day]) dailyMap[day] = { date: day, apiCost: 0, revenue: 0, trips: 0, users: 0, costEntries: 0 };
    dailyMap[day].apiCost += entry.estimated_cost_usd || 0;
    dailyMap[day].costEntries++;
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

  // Merge revenue from ledger
  for (const entry of ledgerEntries) {
    if (entry.amount_cents && entry.amount_cents > 0) {
      const day = entry.created_at.split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { date: day, apiCost: 0, revenue: 0, trips: 0, users: 0, costEntries: 0 };
      dailyMap[day].revenue += entry.amount_cents / 100;
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
  const costDataDays = new Set(costEntries.map(e => e.created_at.split('T')[0])).size;

  return {
    costs: {
      totalCost: totalEstimatedCost,
      totalEntries: costEntries.length,
      periodStart: costDates[0]?.split('T')[0] || '',
      periodEnd: costDates[costDates.length - 1]?.split('T')[0] || '',
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
      totalUsers: profileResult.count || 0,
      usersWithBalance: balances.length,
      paidUsers,
      activeApiUsers: uniqueApiUsers.size,
      outstandingPurchased,
      outstandingFree,
    },
    trips: {
      totalTrips: tripResult.count || trips.length,
      uniqueTripUsers: new Set(trips.map(t => t.user_id)).size,
      trackedTrips: uniqueCostTripIds.size,
    },
    dailyMetrics,
    dataQuality: {
      hasCostData: costEntries.length > 0,
      hasRevenueData: purchaseCount > 0,
      hasTripLinkage: uniqueCostTripIds.size > 0,
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
