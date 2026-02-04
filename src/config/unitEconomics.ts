// ============================================================
// Unit Economics Configuration - Admin Dashboard
// Based on current stack pricing and cost structure
// ============================================================

// Fixed Monthly Costs
export const FIXED_COSTS = [
  { name: 'Lovable Cloud', cost: 0, note: 'Included in plan' },
  { name: 'Domain / DNS', cost: 1.50, note: 'Annual amortized' },
  { name: 'Sentry (Monitoring)', cost: 0, note: 'Free tier' },
  { name: 'GitHub', cost: 0, note: 'Free tier' },
] as const;

// Lovable AI costs (per million tokens)
export const LOVABLE_AI_CONFIG = {
  // Using Google Gemini 2.5 Flash for itinerary generation
  model: 'google/gemini-2.5-flash',
  inputTokens: 4000,    // Average input per request
  outputTokens: 8000,   // Average output per request
  inputPrice: 0.10,     // $/MTok (estimated Lovable AI pass-through)
  outputPrice: 0.40,    // $/MTok (estimated Lovable AI pass-through)
  cacheHitRatio: 0.6,   // Caching for repeated destination queries
  cacheDiscount: 0.8,   // 80% discount for cached inputs
} as const;

// Credit pack revenue mapping
export const REVENUE_PER_CREDIT = {
  topup: 5 / 50,        // $0.10/credit
  single: 12 / 200,     // $0.06/credit
  starter: 29 / 500,    // $0.058/credit
  explorer: 55 / 1200,  // $0.046/credit
  adventurer: 89 / 2500, // $0.036/credit
  average: 0.05,        // Blended average
} as const;

// Credit costs for actions
export const CREDIT_ACTION_COSTS = {
  unlock_day: 150,
  swap_activity: 5,
  regenerate_day: 15,
  restaurant_rec: 10,
  ai_message: 2,
} as const;

// Estimated AI cost per action (based on token usage)
export const AI_COST_PER_ACTION = {
  unlock_day: 0.08,       // Full day generation
  swap_activity: 0.02,    // Single activity swap
  regenerate_day: 0.05,   // Day regeneration
  restaurant_rec: 0.03,   // Restaurant recommendation
  ai_message: 0.01,       // AI companion message
} as const;

// Calculate metrics for a given volume
export function calculateUnitEconomics(
  creditsSpent: number,
  creditsPurchased: number,
  revenueFromCredits: number,
  activeUsers: number,
  activityBreakdown: Record<string, number>
) {
  const totalFixed = FIXED_COSTS.reduce((s, c) => s + c.cost, 0);
  
  // Calculate variable costs based on action breakdown
  let totalAICost = 0;
  for (const [action, count] of Object.entries(activityBreakdown)) {
    const costPerAction = AI_COST_PER_ACTION[action as keyof typeof AI_COST_PER_ACTION] || 0;
    totalAICost += costPerAction * count;
  }
  
  // Fallback if no breakdown - estimate from total credits
  if (totalAICost === 0 && creditsSpent > 0) {
    // Assume average mix: 60% unlock_day, 20% swaps, 10% regenerate, 10% other
    const estimatedDays = creditsSpent / 150; // Most credits go to unlocking
    totalAICost = estimatedDays * 0.08 + (creditsSpent - estimatedDays * 150) / 10 * 0.02;
  }
  
  const totalCost = totalFixed + totalAICost;
  const grossProfit = revenueFromCredits - totalCost;
  const grossMargin = revenueFromCredits > 0 
    ? ((revenueFromCredits - totalCost) / revenueFromCredits) * 100 
    : 0;
  
  // Cost per credit
  const costPerCredit = creditsSpent > 0 ? totalAICost / creditsSpent : 0;
  const revenuePerCredit = creditsPurchased > 0 ? revenueFromCredits / creditsPurchased : 0;
  const marginPerCredit = revenuePerCredit - costPerCredit;
  
  // Breakeven calculation
  const avgRevenuePerUser = activeUsers > 0 ? revenueFromCredits / activeUsers : 0;
  const breakevenUsers = avgRevenuePerUser > 0 ? Math.ceil(totalFixed / avgRevenuePerUser) : Infinity;
  
  return {
    totalFixed,
    totalAICost,
    totalCost,
    grossProfit,
    grossMargin,
    costPerCredit,
    revenuePerCredit,
    marginPerCredit,
    breakevenUsers,
    aiShare: totalCost > 0 ? (totalAICost / totalCost) * 100 : 0,
  };
}

// Format helpers
export function formatUSD(n: number, decimals = 2): string {
  if (!isFinite(n)) return '∞';
  const prefix = n < 0 ? '-$' : '$';
  return prefix + Math.abs(n).toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

export function formatNumber(n: number, decimals = 0): string {
  if (!isFinite(n)) return '∞';
  return n.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

export function formatPercent(n: number, decimals = 1): string {
  if (!isFinite(n)) return '∞';
  return n.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  }) + '%';
}
