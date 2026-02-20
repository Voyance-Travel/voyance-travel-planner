/**
 * Admin Unit Economics Dashboard - Dynamic Production Data
 * Fetches real costs from trip_cost_tracking table
 * Falls back to static estimates when no tracking data available
 * Last Updated: February 4, 2026
 */

import { useState, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Link } from "react-router-dom";
import { useRealCostMetrics } from "@/hooks/useRealCostMetrics";
import { useUnitEconomicsData } from "@/hooks/useUnitEconomicsData";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// =============================================================================
// FALLBACK STATIC DATA (used when no tracking data available)
// Source: Google Cloud Console, Lovable Cloud, Perplexity API
// Note: Amadeus removed (Feb 2026) — hotels now AI-suggested via credits
// =============================================================================

// =============================================================================
// COST MODEL: Per-Trip Base + Per-Day Scaling (from verified production data)
// 
// Decomposition of variable costs across trips:
//   Per-trip base: $0.043 (Perplexity + AI setup)
//   Per-day increment: $0.085 (Google Places + AI content, reduced after second image removal)
//
// Validation: 5-day average = $0.043 + (5 × $0.085) = $0.468
// Note: Amadeus costs eliminated Feb 2026 — hotels now credit-gated AI feature
// =============================================================================

const COST_MODEL = {
  // Per-trip (once) costs
  tripBase: {
    perplexity: 0.018,      // Destination intelligence
    aiSetup: 0.025,         // DNA calculation, trip structure
    total: 0.043,           // Amadeus removed — hotel search is now a credit-gated AI feature
  },
  // Per-day costs (reduced: second itinerary image removed → fewer Google Photos calls)
  perDay: {
    googleRestaurants: 0.045,
    googleActivities: 0.030,
    googlePhotos: 0.005,    // Reduced from 0.015 — second image slot removed, only hero remains
    aiContent: 0.010,       // Day content generation
    total: 0.090,           // Was 0.100, saved $0.010/day from photo reduction
  },
};

// Period is set dynamically inside the component via liveQueryPeriod
const FALLBACK_DATA = {
  trips: 61,
  period: "", // Overridden at render time by liveQueryPeriod
  services: {
    google: { total: 30.82, perTrip: 0.5052, calls: null, callsPerTrip: 55, label: "Google Places", color: "#4285F4" },
    lovableAI: { total: 3.93, perTrip: 0.0644, perCall: 0.013, calls: 303, callsPerTrip: 4.97, label: "Lovable AI (Gemini)", color: "#A855F7" },
    perplexity: { total: 1.10, perTrip: 0.0180, perCall: 0.005, calls: 208, callsPerTrip: 3.41, label: "Perplexity (Sonar)", color: "#06B6D4" },
  },
  fixed: {
    lovableCloud: 25.00,
    domain: 4.08,
    email: 0.00, // Zoho free tier
    // Hidden fixed: your own testing, API testing, dev overhead
    devOps: 20.00, // Rough estimate for internal usage/testing that doesn't generate revenue
  },
  revenue: { flex_100: 9, flex_300: 25, flex_500: 39, voyager: 49.99, explorer: 89.99, adventurer: 149.99 } as Record<string, number>,
};

// Revenue mix presets - what % of paying users buy each tier
// Now includes per-tier COSTS to calculate true blended margin
// NOTE: Boost ($8.99) replaces Top-Up ($5) - less cannibalization risk
const REVENUE_MIX_PRESETS = {
  pessimistic: { flex_100: 30, flex_300: 35, flex_500: 22, voyager: 8, explorer: 4, adventurer: 1, label: "Pessimistic", description: "Heavy flex buying, low club adoption" },
  conservative: { flex_100: 18, flex_300: 24, flex_500: 20, voyager: 22, explorer: 11, adventurer: 5, label: "Conservative", description: "Moderate flex, growing club" },
  balanced: { flex_100: 10, flex_300: 14, flex_500: 14, voyager: 28, explorer: 22, adventurer: 12, label: "Balanced", description: "Most revenue from Club (Voyager/Explorer)" },
  optimistic: { flex_100: 4, flex_300: 8, flex_500: 10, voyager: 20, explorer: 30, adventurer: 28, label: "Optimistic", description: "Heavy Explorer/Adventurer adoption" },
};

// Amadeus integration removed Feb 2026 — replaced by credit-gated AI hotel suggestions (40 credits/search)

const PHOTO_CACHE_SAVINGS_RATIO = 0.33; // Estimated, not yet verified post-deployment

// =============================================================================
// FREE USER ECONOMICS — CONVERSION FUNNEL MODEL
//
// FUNNEL FLOW:
//   1. FIRST TRIP (one-time, bypasses credits entirely):
//      Full 2-day enriched itinerary + up to 5 edits. No credits deducted.
//      Purpose: Hook the user with real quality.
//        - Trip base (Perplexity + AI setup):      $0.043
//        - 2 days × $0.100/day (Google + AI):      $0.200
//        - 5 edits (avg $0.012/edit):              $0.060
//        - DNA lookup:                             $0.010
//        - Total worst case:                       ~$0.31
//        - Blended (avg ~2.1 edits):               ~$0.28
//
//   2. SUBSEQUENT TRIPS — DAY 1 PREVIEW (always free, no credits):
//      Lightweight preview: AI-generated venue names + timing. No enrichment.
//      No Google Places, no photos, no addresses. Just a "mold" to taste.
//      Cost: ~$0.01 (AI only)
//
//   3. MONTHLY GRANT (150 credits, 2-month expiry — ALL users):
//      Every user (free + paid) gets 150cr/mo. Free credits expire in 2 months.
//      Purchased credits never expire.
//      Typical free user: unlocks 1 day (60cr) + a few swaps (5cr each) = hooked.
//      Cost to us depends on what they spend credits on:
//        - If unlock 1 day: ~$0.10 (Google + AI enrichment)
//        - If swaps only: ~$0.02 (AI-only, no enrichment)
//        - Blended estimate: ~$0.04/mo per active user
//      Not all users use their credits → effective cost lower.
//        - ~60% use some credits, ~40% lapse
//        - Effective recurring: ~$0.024/mo per user
//
//   4. CONVERSION: User runs out of 150cr, wants more days → buys pack.
//
// The scaling table uses the RECURRING cost ($0.024/mo).
// The one-time acquisition is shown separately.
// =============================================================================
const FREE_USER_ECONOMICS = {
  // Step 1: One-time free trip (bypasses credits entirely)
  freeTripDays: 2,
  freeEditsLimit: 5,
  oneFreeTripPerAccount: true,

  // One-time acquisition cost model
  acquisitionCosts: {
    tripBase: 0.043,
    perDay: 0.100,
    perEdit: 0.012,
    dnaLookup: 0.010,
  },

  // Blended one-time acquisition cost (assuming ~2.1 edits avg)
  acquisitionCostBlended: 0.278,

  // Worst case acquisition (all 5 edits used)
  acquisitionCostWorstCase: 0.313,

  // Step 2: Day 1 preview cost (always free, lightweight AI-only)
  day1PreviewCost: 0.010,   // AI-only, no enrichment

  // Step 3: Monthly credit grant (ALL users — free + paid)
  monthlyGrant: {
    credits: 150,
    expirationMonths: 2,
    maxBanked: 300,           // Can hold up to 2 months worth
    appliesToAllUsers: true,  // Not just free users!
    purchasedNeverExpire: true,
    costIfFullyUsed: 0.040,   // Blended cost if user spends all 150cr
    usageRate: 0.60,          // ~60% of users actually spend free credits
  },

  // RECURRING cost per user per month (blended with usage rate)
  // = $0.040 × 60% = $0.024/mo
  recurringCostPerMonth: 0.024,

  // Model name for display
  modelName: "Free Trip → Preview → 150cr/mo → Convert",
};

// Helper function: Calculate variable cost for N days
function calculateTripCost(days: number): number {
  const base = COST_MODEL.tripBase.perplexity + COST_MODEL.tripBase.aiSetup;
  const perDay = days * COST_MODEL.perDay.total;
  return base + perDay;
}

// AI Model breakdown (fallback static data)
const FALLBACK_AI_MODELS = [
  { model: "gemini-3-flash-preview", calls: 125, usage: "Primary generation" },
  { model: "gemini-2.5-flash-image", calls: 92, usage: "Image-related tasks" },
  { model: "gemini-2.5-flash-lite", calls: 75, usage: "Lightweight tasks" },
  { model: "gemini-2.5-flash", calls: 11, usage: "Fallback" },
];

type Scenario = 'A';

const SCENARIOS: Record<Scenario, { name: string; description: string; fullDescription: string; caching: boolean }> = {
  A: { 
    name: "Current Production", 
    description: "Caching enabled, AI hotel suggestions (no Amadeus)", 
    fullDescription: "Current live state: Photo caching enabled. Amadeus removed — hotels are now an AI-powered credit feature (40 credits/search).",
    caching: true, 
  },
};

// Credit pack tiers with USAGE-BASED COST MODELING
// Action costs (CURRENT): Unlock Day = 60cr/$0.018, Regen Day = 10cr/$0.018, Swap = 5cr/$0.009, Restaurant = 5cr/$0.015, AI = 5cr/$0.005, Hotel = 40cr/$0.020
// Free caps per trip (tier-based): swap 3-15, regen 1-5, ai_message 5-25, restaurant 1-5
// Cost derivations from production data: $0.091 total ÷ 5 days = $0.018/day
const CREDIT_TIERS = [
  // ── Flexible Credits ──
  { 
    key: "flex_100", 
    label: "Flex 100", 
    price: 9, 
    credits: 100, 
    color: "#94A3B8", 
    type: "flexible" as const,
    description: "Quick top-up for swaps & extras",
    // 1 day = 60cr, leaving 40cr → free swaps (10 free cap) + 4 paid swaps (20cr) + 4 paid AI msgs (20cr)
    typicalUsage: { daysUnlocked: 1, swaps: 4, regenerates: 0, restaurants: 0, aiMessages: 4 },
    // Cost: 1×$0.018 + 4×$0.009 + 4×$0.005 = $0.074
    estimatedCostToUs: 0.074,
    notes: "1 day (60cr) + 4 paid swaps (20cr) + 4 AI msgs (20cr). 10 free swaps used first.",
  },
  { 
    key: "flex_300", 
    label: "Flex 300", 
    price: 25, 
    credits: 300, 
    color: "#38BDF8", 
    type: "flexible" as const,
    description: "~5 days of itinerary",
    // 5 days = 300cr. Free caps cover swaps/regens within each trip.
    typicalUsage: { daysUnlocked: 5, swaps: 0, regenerates: 0, restaurants: 0, aiMessages: 0 },
    // Cost: 5×$0.018 = $0.090
    estimatedCostToUs: 0.090,
    notes: "5 days exactly (5×60cr). Free swap/regen caps cover typical editing.",
  },
  { 
    key: "flex_500", 
    label: "Flex 500", 
    price: 39, 
    credits: 500, 
    color: "#60A5FA", 
    type: "flexible" as const,
    description: "8-day trip + extras",
    // 8 days = 480cr, leaving 20cr → 4 paid swaps (20cr). Free caps: 10 swaps + 5 regens per trip.
    typicalUsage: { daysUnlocked: 8, swaps: 4, regenerates: 0, restaurants: 0, aiMessages: 0 },
    // Cost: 8×$0.018 + 4×$0.009 = $0.180
    estimatedCostToUs: 0.180,
    notes: "8 days (480cr) + 4 paid swaps (20cr). 10 free swaps + 5 free regens per trip.",
  },
  // ── Voyance Club ──
  { 
    key: "voyager", 
    label: "Voyager", 
    price: 49.99, 
    credits: 600, // 500 base + 100 bonus
    color: "#A78BFA", 
    type: "club" as const,
    description: "Club entry - 500 + 100 bonus",
    // 10 days = 600cr. Across 2 trips, free caps cover most micro-actions.
    typicalUsage: { daysUnlocked: 10, swaps: 0, regenerates: 0, restaurants: 0, aiMessages: 0 },
    // Cost: 10×$0.018 = $0.180
    estimatedCostToUs: 0.180,
    notes: "10 days (500 base + 100 bonus). Free caps cover swaps/regens across trips.",
  },
  { 
    key: "explorer", 
    label: "Explorer", 
    price: 89.99, 
    credits: 1600, // 1200 base + 400 bonus
    color: "#34D399", 
    type: "club" as const,
    description: "Popular - 1,200 + 400 bonus",
    // 26 days = 1560cr, leaving 40cr → 8 paid swaps (40cr)
    typicalUsage: { daysUnlocked: 26, swaps: 8, regenerates: 0, restaurants: 0, aiMessages: 0 },
    // Cost: 26×$0.018 + 8×$0.009 = $0.540
    estimatedCostToUs: 0.540,
    notes: "26 days (1560cr) + 8 paid swaps (40cr). Free caps per trip still apply.",
  },
  { 
    key: "adventurer", 
    label: "Adventurer", 
    price: 149.99, 
    credits: 3200, // 2500 base + 700 bonus
    color: "#F59E0B", 
    type: "club" as const,
    description: "Best value - 2,500 + 700 bonus",
    // 53 days = 3180cr, leaving 20cr → 4 paid swaps (20cr)
    typicalUsage: { daysUnlocked: 53, swaps: 4, regenerates: 0, restaurants: 0, aiMessages: 0 },
    // Cost: 53×$0.018 + 4×$0.009 = $0.990
    estimatedCostToUs: 0.990,
    notes: "53 days (3180cr) + 4 paid swaps (20cr). Free caps per trip still apply.",
  },
  // ── Group Unlock (Credit Pool) ──
  { 
    key: "group_small", 
    label: "Group Small", 
    price: 0, 
    credits: 150,
    color: "#14B8A6", 
    type: "group" as const,
    description: "Credit pool (2-3 travelers)",
    typicalUsage: { daysUnlocked: 0, swaps: 0, regenerates: 0, restaurants: 0, aiMessages: 0 },
    estimatedCostToUs: 0.50,
    sharedFreeCaps: 40,
    typicalPaidActions: 20,
    notes: "150 credit pool. 40 shared free actions (10 swap + 5 regen + 20 AI + 5 restaurant). ~20 paid actions after caps.",
  },
  { 
    key: "group_medium", 
    label: "Group Medium", 
    price: 0, 
    credits: 300,
    color: "#0EA5E9", 
    type: "group" as const,
    description: "Credit pool (4-6 travelers)",
    typicalUsage: { daysUnlocked: 0, swaps: 0, regenerates: 0, restaurants: 0, aiMessages: 0 },
    estimatedCostToUs: 1.00,
    sharedFreeCaps: 40,
    typicalPaidActions: 50,
    notes: "300 credit pool. 40 shared free actions. ~50 paid actions after caps. Refillable by owner.",
  },
  { 
    key: "group_large", 
    label: "Group Large", 
    price: 0, 
    credits: 500,
    color: "#6366F1", 
    type: "group" as const,
    description: "Credit pool (7+ travelers)",
    typicalUsage: { daysUnlocked: 0, swaps: 0, regenerates: 0, restaurants: 0, aiMessages: 0 },
    estimatedCostToUs: 1.50,
    sharedFreeCaps: 40,
    typicalPaidActions: 90,
    notes: "500 credit pool. 40 shared free actions. ~90 paid actions after caps. Refillable by owner.",
  },
];

// Cost per action (verified from production data, $0.091 avg/trip)
// Credit costs: Unlock=60, Regen=10, Swap=5, Restaurant=5, AI=5, Hotel=40, SmartFinish=50, MysteryGetaway=15, MysteryLogistics=5, Transport=5
// Free caps per trip: swap 10, regen 5, ai_message 20, restaurant 5, transport_mode_change 5
const ACTION_COSTS: Record<string, number> = {
  unlock_day: 0.018,      // $0.091 ÷ 5 days avg
  day_unlock: 0.018,      // alias
  swap_activity: 0.009,   // 1 Places ($0.004) + 1 Photo ($0.005)
  regenerate_day: 0.018,  // Same as unlock (full day regen)
  restaurant_rec: 0.015,  // 1 Perplexity call
  ai_message: 0.005,      // 1 Gemini call
  hotel_search: 0.020,    // ~2-3 Places calls per city
  smart_finish: 0.040,    // Smart Finish enrichment (route opt + reviews + tips)
  purchase_smart_finish: 0.040, // alias for ledger tracking
  group_unlock: 0.50,     // Group unlock pool utilization cost
  purchase_group_small: 0.50,
  purchase_group_medium: 1.00,
  purchase_group_large: 1.50,
  mystery_getaway: 0.025, // AI destination suggestions
  mystery_logistics: 0.015, // Flight + hotel estimates
  transport_mode_change: 0.005, // Route recalculation
};

// Column definitions with tooltips for per-trip scaling table
const SCALE_COLUMNS = [
  { key: "trips", label: "Total Trips", tooltip: "Total monthly trip volume (paid + free users combined)." },
  { key: "paid", label: "Paid", tooltip: "Number of paying users. Formula: Total × Conversion %." },
  { key: "free", label: "Free", tooltip: "Non-paying users (returning). Their trips are locked previews." },
  { key: "freeCost", label: "Free Var $", tooltip: `Monthly cost of free users (150cr grant). Formula: Free × $${FREE_USER_ECONOMICS.recurringCostPerMonth.toFixed(3)}/mo (blended credit usage × 60% activity rate). Excludes one-time acquisition.` },
  { key: "paidCost", label: "Paid Var $", tooltip: "Variable cost of serving all paid users. Formula: Paid × $0.091 (observed production cost)." },
  { key: "blended", label: "Blended/Trip", tooltip: "All-in cost per trip = Total Cost ÷ Total Trips." },
  { key: "revenue", label: "Revenue", tooltip: "Revenue from paying users. Formula: Paid × Blended AOV." },
  { key: "totalCost", label: "Total Cost", tooltip: "Free Var $ + Paid Var $ + $49 Fixed. This is your real monthly burn (excludes one-time acquisition)." },
  { key: "netProfit", label: "Net Profit", tooltip: "Revenue - Total Cost. What hits your bank account." },
  { key: "realMargin", label: "Margin", tooltip: "Net Profit ÷ Revenue × 100." },
];


const EXPENSE_COLUMNS = [
  { key: "trips", label: "Trips/Mo", tooltip: "Number of itineraries generated per month. Each trip = 1 full AI-powered travel plan." },
  { key: "google", label: "Google", tooltip: "Google Places API costs: Text Search, Place Details, Photos, Geocoding. Rate: ~$0.34/trip with caching." },
  { key: "lovableFixed", label: "Lovable (fixed)", tooltip: "Lovable Cloud platform fee: $25/mo flat. Includes hosting, DB, auth, edge functions. Does not scale with usage." },
  { key: "lovableAI", label: "Lovable AI", tooltip: "AI token costs via Lovable AI Gateway (Gemini models). Rate: ~$0.064/trip. Scales linearly with volume." },
  { key: "perplexity", label: "Perplexity", tooltip: "Perplexity Sonar API for destination intelligence & travel advisories. Rate: $0.005/call × ~3.4 calls/trip = $0.018/trip." },
  { key: "domain", label: "Domain", tooltip: "Custom domain cost: $49/year ÷ 12 = $4.08/mo. Fixed regardless of volume." },
  { key: "domain", label: "Domain", tooltip: "Custom domain cost: $49/year ÷ 12 = $4.08/mo. Fixed regardless of volume." },
  { key: "total", label: "Total", tooltip: "Sum of all costs for that month. This is your total infrastructure spend before any revenue." },
];

export default function UnitEconomics() {
  const [volume, setVolume] = useState(60);
  const [tier, setTier] = useState("voyager");
  const [scenario, setScenario] = useState<Scenario>('A');
  const [conversionRate, setConversionRate] = useState(2); // % of trips that convert to paid (niche product baseline)
  const [revenueMix, setRevenueMix] = useState<keyof typeof REVENUE_MIX_PRESETS>('conservative');
  const [viewMode, setViewMode] = useState<'itinerary' | 'lifecycle'>('lifecycle');
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  
  // Fetch real data from trip_cost_tracking table
  const { data: realMetrics, isLoading: metricsLoading, isError: metricsError } = useRealCostMetrics();
  
  // Fetch comprehensive unit economics data (costs + revenue + users + trips)
  const { data: econData, isLoading: econLoading, refetch: refetchEcon } = useUnitEconomicsData();
  
  // Use real data when available, otherwise fallback
  // Check BOTH data sources — econData (comprehensive) OR realMetrics (legacy)
  const hasRealData = (!!econData && econData.trips.totalTrips > 0) || (!!realMetrics && realMetrics.totalTrips > 0);
  
  // Data quality warning from the hook
  const dataQualityWarning = realMetrics?.dataQualityWarning;
  
  // Calculate blended average order value AND blended cost based on revenue mix
  const mixConfig = REVENUE_MIX_PRESETS[revenueMix];
  
  const { blendedAOV, blendedCostPerUser } = useMemo(() => {
    const scenarioCfg = SCENARIOS[scenario];

    const tiers = FALLBACK_DATA.revenue;
    // Groups no longer contribute to Stripe revenue (they consume credits)
    const aov = (
      (mixConfig.flex_100 / 100) * (tiers.flex_100 || 0) +
      (mixConfig.flex_300 / 100) * (tiers.flex_300 || 0) +
      (mixConfig.flex_500 / 100) * (tiers.flex_500 || 0) +
      (mixConfig.voyager / 100) * (tiers.voyager || 0) +
      (mixConfig.explorer / 100) * (tiers.explorer || 0) +
      (mixConfig.adventurer / 100) * (tiers.adventurer || 0)
    );

    // Scenario-aware tier costs
    // We preserve each tier's "extras" (swaps, chat, etc.) by treating the existing
    // estimatedCostToUs as the baseline, then swapping in scenario-adjusted base/per-day costs.
    const baselineTripBase = COST_MODEL.tripBase.total;
    const baselinePerDay = COST_MODEL.perDay.total;

    const googleMultiplier = scenarioCfg.caching ? (1 - PHOTO_CACHE_SAVINGS_RATIO) : 1;
    const scenarioTripBase = COST_MODEL.tripBase.perplexity + COST_MODEL.tripBase.aiSetup;
    const scenarioPerDay =
      (COST_MODEL.perDay.googleRestaurants + COST_MODEL.perDay.googleActivities + COST_MODEL.perDay.googlePhotos) * googleMultiplier +
      COST_MODEL.perDay.aiContent;

    const scenarioTierCosts = CREDIT_TIERS.reduce((acc, tier) => {
      const days = tier.typicalUsage.daysUnlocked;
      const trips = days > 0 ? Math.ceil(days / 5) : 0;

      const baselineModeled = (trips * baselineTripBase) + (days * baselinePerDay);
      const extras = tier.estimatedCostToUs - baselineModeled;

      const scenarioModeled = (trips * scenarioTripBase) + (days * scenarioPerDay);
      const scenarioCost = Math.max(0, scenarioModeled + extras);

      acc[tier.key] = scenarioCost;
      return acc;
    }, {} as Record<string, number>);

    const cost = (
      (mixConfig.flex_100 / 100) * (scenarioTierCosts.flex_100 ?? 0.02) +
      (mixConfig.flex_300 / 100) * (scenarioTierCosts.flex_300 ?? 0.07) +
      (mixConfig.flex_500 / 100) * (scenarioTierCosts.flex_500 ?? 0.12) +
      (mixConfig.voyager / 100) * (scenarioTierCosts.voyager ?? 0.14) +
      (mixConfig.explorer / 100) * (scenarioTierCosts.explorer ?? 0.35) +
      (mixConfig.adventurer / 100) * (scenarioTierCosts.adventurer ?? 0.66)
    );
    
    return { blendedAOV: aov, blendedCostPerUser: cost };
  }, [revenueMix, mixConfig, scenario, volume]);
  
  // Always compute a live date range label (30-day rolling window → today)
  const liveQueryPeriod = useMemo(() => {
    const end = new Date();
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  }, []);

  const VERIFIED_DATA = useMemo(() => {
    // When we have real econData, use ACTUAL observed costs ÷ actual trips
    // This replaces the old approach of hardcoded fallback per-trip rates
    if (econData && econData.trips.totalTrips > 0) {
      const trips = econData.trips.totalTrips;
      return {
        trips,
        // Use the query window dates, not the data's min/max created_at
        period: liveQueryPeriod,
        services: {
          google: { 
            total: econData.costs.google.cost, 
            perTrip: econData.costs.google.cost / trips,
            calls: econData.costs.google.calls, 
            callsPerTrip: econData.costs.google.calls / trips, 
            label: "Google Places + Photos", 
            color: "#4285F4" 
          },
          lovableAI: { 
            total: econData.costs.ai.cost, 
            perTrip: econData.costs.ai.cost / trips,
            perCall: econData.costs.ai.calls > 0 ? econData.costs.ai.cost / econData.costs.ai.calls : 0, 
            calls: econData.costs.ai.calls, 
            callsPerTrip: econData.costs.ai.calls / trips, 
            label: "Lovable AI (Gemini)", 
            color: "#A855F7" 
          },
          perplexity: { 
            total: econData.costs.perplexity.cost, 
            perTrip: econData.costs.perplexity.cost / trips,
            perCall: 0.005, 
            calls: econData.costs.perplexity.calls, 
            callsPerTrip: econData.costs.perplexity.calls / trips, 
            label: "Perplexity (Sonar)", 
            color: "#06B6D4" 
          },
        },
        fixed: FALLBACK_DATA.fixed,
        revenue: FALLBACK_DATA.revenue,
      };
    }
    
    if (!hasRealData) return { ...FALLBACK_DATA, period: liveQueryPeriod };
    
    // Legacy fallback using realMetrics (kept for backward compat)
    return {
      trips: realMetrics!.totalTrips,
      period: liveQueryPeriod,
      services: {
        google: { 
          total: realMetrics!.google.totalCost, 
          perTrip: realMetrics!.google.totalCost / realMetrics!.totalTrips,
          calls: realMetrics!.google.totalCalls, 
          callsPerTrip: realMetrics!.google.totalCalls / realMetrics!.totalTrips, 
          label: "Google Places", 
          color: "#4285F4" 
        },
        lovableAI: { 
          total: realMetrics!.ai.totalCost, 
          perTrip: realMetrics!.ai.totalCost / realMetrics!.totalTrips,
          perCall: realMetrics!.ai.callCount > 0 ? realMetrics!.ai.totalCost / realMetrics!.ai.callCount : 0.013, 
          calls: realMetrics!.ai.callCount, 
          callsPerTrip: realMetrics!.ai.callCount / realMetrics!.totalTrips, 
          label: "Lovable AI (Gemini)", 
          color: "#A855F7" 
        },
        perplexity: { 
          total: realMetrics!.perplexity.totalCost, 
          perTrip: realMetrics!.perplexity.totalCost / realMetrics!.totalTrips,
          perCall: 0.005, 
          calls: realMetrics!.perplexity.totalCalls, 
          callsPerTrip: realMetrics!.perplexity.totalCalls / realMetrics!.totalTrips, 
          label: "Perplexity (Sonar)", 
          color: "#06B6D4" 
        },
      },
      fixed: FALLBACK_DATA.fixed,
      revenue: FALLBACK_DATA.revenue,
    };
  }, [hasRealData, realMetrics, econData, liveQueryPeriod]);

  const revenue = VERIFIED_DATA.revenue[tier];
  const scenarioConfig = SCENARIOS[scenario];

  const costs = useMemo(() => {
    // IMPORTANT: Use FALLBACK google rate as the "pre-cache" baseline
    // Real data reflects current operational state (which may already include some caching)
    // When using real observed data (econData available), caching is already reflected in the numbers
    const hasRealObserved = !!econData && econData.trips.totalTrips > 0;
    const googlePreCacheRate = FALLBACK_DATA.services.google.perTrip; // $0.5052
    const googleBase = VERIFIED_DATA.services.google.perTrip;
    
    // Only apply caching adjustment when using fallback/estimated rates (not real data)
    const googlePerTrip = hasRealObserved 
      ? googleBase  // Real data already includes caching effects
      : (scenarioConfig.caching ? googleBase * (1 - PHOTO_CACHE_SAVINGS_RATIO) : googleBase);

    const aiPerTrip = VERIFIED_DATA.services.lovableAI.perTrip;
    const perplexityPerTrip = VERIFIED_DATA.services.perplexity.perTrip;

    // Amadeus removed — hotel search is now credit-gated AI feature (no API cost to us)

    const variablePerTrip = googlePerTrip + aiPerTrip + perplexityPerTrip;
    const variableTotal = variablePerTrip * volume;

    // TRUE fixed cost: Cloud + Domain + DevOps overhead (testing, internal usage)
    const fixedTotal = VERIFIED_DATA.fixed.lovableCloud + VERIFIED_DATA.fixed.domain + (VERIFIED_DATA.fixed.devOps || 0);
    const fixedPerTrip = fixedTotal / volume;

    const fullyLoaded = variablePerTrip + fixedPerTrip;
    
    // Per-trip margin (assuming 100% paid)
    const margin = ((revenue - fullyLoaded) / revenue) * 100;
    const contributionMargin = ((revenue - variablePerTrip) / revenue) * 100;

    // BLENDED ECONOMICS: Clean flat-rate model (matches scale table)
    // Uses RECURRING free cost ($0.024/mo for 150cr grant), NOT one-time acquisition
    const PAID_COST_PER_USER = 0.091; // Observed production cost
    const FREE_COST_PER_USER = FREE_USER_ECONOMICS.recurringCostPerMonth; // $0.024/mo recurring
    const payingTrips = volume * (conversionRate / 100);
    const freeTrips = volume - payingTrips;
    
    const freeVariableCost = freeTrips * FREE_COST_PER_USER;
    const paidVariableCost = payingTrips * PAID_COST_PER_USER;
    const totalVariableCostBlended = freeVariableCost + paidVariableCost;
    const totalCost = totalVariableCostBlended + fixedTotal;
    
    // Revenue from paying users only
    const totalRevenue = payingTrips * blendedAOV;
    
    const blendedProfit = totalRevenue - totalCost;
    const blendedMargin = totalRevenue > 0 ? (blendedProfit / totalRevenue) * 100 : -100;
    
    // Per-trip metrics (across ALL trips)
    const revenuePerTrip = totalRevenue / volume;
    const realMarginPerTrip = revenuePerTrip - (totalCost / volume);
    const blendedAllInCostPerTrip = totalCost / volume;

    const googleShare = variablePerTrip > 0 ? (googlePerTrip / variablePerTrip) * 100 : 0;

    return {
      google: { perTrip: googlePerTrip, total: googlePerTrip * volume, share: googleShare },
      googleBase, // Export for debugging
      ai: { perTrip: aiPerTrip, total: aiPerTrip * volume },
      perplexity: { perTrip: perplexityPerTrip, total: perplexityPerTrip * volume },
      variable: { perTrip: variablePerTrip, total: variableTotal },
      fixed: { perTrip: fixedPerTrip, total: fixedTotal },
      fullyLoaded,
      blendedAllInCostPerTrip,
      margin,
      contributionMargin,
      // Blended economics
      blendedAOV,
      payingTrips,
      totalRevenue,
      totalCost,
      blendedProfit,
      blendedMargin,
      revenuePerTrip,
      realMarginPerTrip,
    };
  }, [volume, tier, scenario, scenarioConfig, revenue, conversionRate, blendedAOV, blendedCostPerUser, hasRealData, VERIFIED_DATA]);

  // =========================================================================
  // INSIGHTS ENGINE - Detects leaks, opportunities, and anomalies
  // =========================================================================
  const insights = useMemo(() => {
    const list: Array<{
      type: 'leak' | 'opportunity' | 'warning' | 'success';
      title: string;
      description: string;
      impact: string;
      action?: string;
      category?: string;
    }> = [];
    
    // Analyze category breakdown for leaks
    if (hasRealData && realMetrics?.categoryBreakdown) {
      const totalCost = Object.values(realMetrics.categoryBreakdown).reduce((sum, d) => sum + d.cost, 0);
      
      // Check for Home/Browse being disproportionately high
      const homeBrowse = realMetrics.categoryBreakdown['home_browse'];
      if (homeBrowse && totalCost > 0) {
        const homePct = (homeBrowse.cost / totalCost) * 100;
        if (homePct > 50) {
          list.push({
            type: 'leak',
            title: 'Homepage causing majority of costs',
            description: `Home/Browse is ${homePct.toFixed(0)}% of total spend ($${homeBrowse.cost.toFixed(2)}). This is likely destination_images fetching Google Places photos for cards.`,
            impact: `-$${homeBrowse.cost.toFixed(2)}/period`,
            action: 'Cache destination images in Supabase Storage instead of fetching on every page load. Pre-warm cache for top 50 destinations.',
            category: 'home_browse',
          });
       } else if (homePct > 20) {
          list.push({
            type: 'warning',
            title: 'Homepage costs elevated',
            description: `Home/Browse is ${homePct.toFixed(0)}% of spend. Consider caching destination images.`,
            impact: `-$${homeBrowse.cost.toFixed(2)}/period`,
            action: 'Implement lazy loading and cache destination hero images.',
            category: 'home_browse',
          });
        }
      }
      
      // Check for enrichment costs (destination_images for itinerary photos)
      const enrichment = realMetrics.categoryBreakdown['enrichment'];
      if (enrichment && totalCost > 0) {
        const enrichPct = (enrichment.cost / totalCost) * 100;
        if (enrichPct > 50) {
          list.push({
            type: 'warning',
            title: 'Photo enrichment is high cost driver',
            description: `Enrichment (activity/destination photos) is ${enrichPct.toFixed(0)}% of spend ($${enrichment.cost.toFixed(2)}). This includes Google Places photos for itinerary cards.`,
            impact: `-$${enrichment.cost.toFixed(2)}/period`,
            action: 'Photos are cached per-venue but may be fetching repeatedly. Check if photo-storage.ts is active and caching to Supabase Storage.',
            category: 'enrichment',
          });
        }
      }
      
      // Check for booking search costs (Amadeus/hotels)
      const bookingSearch = realMetrics.categoryBreakdown['booking_search'];
      if (bookingSearch && bookingSearch.cost > 0.5) {
        const bookingPct = (bookingSearch.cost / totalCost) * 100;
        list.push({
          type: 'opportunity',
          title: 'Booking search costs active',
          description: `Hotel search is costing $${bookingSearch.cost.toFixed(2)} (${bookingPct.toFixed(0)}%). ${bookingSearch.count} searches triggered.`,
          impact: `$${bookingSearch.cost.toFixed(2)}/period`,
          action: 'Ensure search is only triggered for paid users or on explicit action (not automatic).',
          category: 'booking_search',
        });
      }
      
      // Check for low-cost categories that could be optimized further
      const quiz = realMetrics.categoryBreakdown['quiz'];
      if (quiz && quiz.cost < 0.01 && quiz.count > 5) {
        list.push({
          type: 'success',
          title: 'Quiz is highly efficient',
          description: `${quiz.count} DNA quizzes completed at only $${quiz.cost.toFixed(4)}. Cost per quiz: $${(quiz.cost / quiz.count).toFixed(5)}.`,
          impact: '✓ Minimal',
          category: 'quiz',
        });
      }
    }
    
    // Scenario-based opportunities
    if (!scenarioConfig.caching) {
      const potentialSavings = costs.google.total * PHOTO_CACHE_SAVINGS_RATIO;
      list.push({
        type: 'opportunity',
        title: 'Scenario: photo caching OFF',
        description: `This modeled scenario assumes photo caching is disabled. Turning caching on reduces Google Places costs by ~${(PHOTO_CACHE_SAVINGS_RATIO * 100).toFixed(0)}%.`,
        impact: `Model savings: ~$${potentialSavings.toFixed(2)}/mo at current volume`,
        action: 'Switch to a caching-enabled scenario to reflect the deployed optimization.',
      });
    }
    
    
    
    // Conversion rate warnings
    if (conversionRate < 5) {
      list.push({
        type: 'warning',
        title: 'Low conversion rate modeled',
        description: `At ${conversionRate}% conversion, ${(100 - conversionRate)}% of users are non-paying. All still receive 150cr/mo grant.`,
        impact: `Monthly grant cost: $${(volume * (1 - conversionRate / 100) * FREE_USER_ECONOMICS.recurringCostPerMonth).toFixed(2)}/mo (free users only, excludes acquisition)`,
        action: 'Improve conversion. Funnel: free 2-day trip → preview → 150cr taste → buy pack.',
      });
    }
    
    // Margin check
    if (costs.blendedMargin < 20) {
      list.push({
        type: 'warning',
        title: 'Low blended margin',
        description: `Blended margin is ${costs.blendedMargin.toFixed(1)}% - below target 50%.`,
        impact: `Net profit: $${costs.blendedProfit.toFixed(0)}/mo`,
        action: 'Increase conversion rate, adjust pricing, or reduce costs.',
      });
    } else if (costs.blendedMargin >= 50) {
      list.push({
        type: 'success',
        title: 'Healthy margins',
        description: `Blended margin is ${costs.blendedMargin.toFixed(1)}% - above target.`,
        impact: `Net profit: $${costs.blendedProfit.toFixed(0)}/mo`,
      });
    }
    
    // Credit pricing check
    const flexSmall = CREDIT_TIERS.find(t => t.key === 'flex_100');
    if (flexSmall) {
      const flexMargin = ((flexSmall.price - flexSmall.estimatedCostToUs) / flexSmall.price) * 100;
      if (flexMargin > 95) {
        list.push({
          type: 'success',
          title: 'Flex 100 tier is highly profitable',
          description: `$${flexSmall.price} Flex 100 has ${flexMargin.toFixed(1)}% margin ($${flexSmall.estimatedCostToUs.toFixed(3)} cost). 1 day + 1 AI message.`,
          impact: `$${(flexSmall.price - flexSmall.estimatedCostToUs).toFixed(2)} profit per sale`,
        });
      }
    }
    
    // Group pool depletion warning
    if (econData?.groupBudgets) {
      const depletedCount = econData.groupBudgets.pools.reduce((s, p) => s + p.depleted, 0);
      if (depletedCount > 0) {
        list.push({
          type: 'warning',
          title: `${depletedCount} group pool${depletedCount > 1 ? 's' : ''} depleted`,
          description: `${depletedCount} group budget pool${depletedCount > 1 ? 's have' : ' has'} 0 credits remaining. Owners may need a nudge to top up.`,
          impact: `${depletedCount} pools at 0`,
          action: 'Send pool depletion notification to group owners.',
        });
      }

      // Group credit absorption
      const totalAllocated = econData.groupBudgets.pools.reduce((s, p) => s + p.allocated, 0);
      if (totalAllocated > 0) {
        list.push({
          type: 'opportunity',
          title: 'Group credit absorption',
          description: `${totalAllocated.toLocaleString()} credits allocated to group pools (~$${(totalAllocated * 0.09).toFixed(2)} equivalent).`,
          impact: `${econData.groupBudgets.totalPools} pools active`,
        });
      }
    }

    // Tier margin check
    const allTiersAbove90 = CREDIT_TIERS.filter(t => t.price > 0).every(t => ((t.price - t.estimatedCostToUs) / t.price) * 100 > 90);
    if (allTiersAbove90) {
      list.push({
        type: 'success',
        title: 'All paid tiers maintain >90% margin',
        description: 'Every pricing tier with a dollar price maintains healthy margins above 90%.',
        impact: '✓ Margins healthy',
      });
    }

    return list;
  }, [hasRealData, realMetrics, scenarioConfig, costs, volume, conversionRate]);

  const verifiedMargins = useMemo(() => {
    // Clean model: each tier's cost = $0.091 per trip (observed) + fixed allocation
    const PAID_TRIP_COST = 0.091;
    const fixedPerTrip = costs.fixed.perTrip;
    const fullyLoadedCost = PAID_TRIP_COST + fixedPerTrip;
    
    return CREDIT_TIERS.filter(t => t.type !== 'group').map((tierData) => {
      const rev = tierData.price;
      return { 
        tier: tierData.key, 
        revenue: rev, 
        cost: fullyLoadedCost, 
        margin: ((rev - fullyLoadedCost) / rev * 100), 
        profit: rev - fullyLoadedCost 
      };
    });
  }, [costs.fixed.perTrip]);

  // Scale points: always include the current volume for live feedback
  const scalePoints = useMemo(() => {
    const base = [10, 50, 100, 250, 400, 500, 750, 1000];
    if (!base.includes(volume)) {
      base.push(volume);
      base.sort((a, b) => a - b);
    }
    return base;
  }, [volume]);

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: "#F1F5F9",
      padding: "32px 24px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ maxWidth: 1400, margin: "0 auto 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Link 
            to="/profile" 
            style={{ fontSize: 12, color: "#64748B", textDecoration: "none" }}
          >
            ← Back to Profile
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "#475569" }}>
              {VERIFIED_DATA.period}
            </span>
            <button
              onClick={() => { refetchEcon(); }}
              disabled={econLoading}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 6, fontSize: 11,
                background: "rgba(100, 116, 139, 0.15)", border: "1px solid rgba(100, 116, 139, 0.25)",
                color: "#94A3B8", cursor: econLoading ? "wait" : "pointer",
              }}
            >
              <RefreshCw style={{ width: 12, height: 12, ...(econLoading ? { animation: "spin 1s linear infinite" } : {}) }} />
              Refresh
            </button>
          </div>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F1F5F9", margin: "0 0 16px" }}>
          Unit Economics
        </h1>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Status bar */}
        {(metricsLoading || metricsError || dataQualityWarning || (!hasRealData && !metricsLoading)) && (
          <div style={{ 
            padding: "10px 16px",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: metricsError ? "rgba(248, 113, 113, 0.1)" : "rgba(100, 116, 139, 0.1)",
            border: `1px solid ${metricsError ? "rgba(248, 113, 113, 0.3)" : "rgba(100, 116, 139, 0.2)"}`,
            color: metricsError ? "#F87171" : "#94A3B8",
          }}>
            {metricsLoading && "⏳ Loading..."}
            {metricsError && "⚠️ Failed to load metrics - using fallback data"}
            {dataQualityWarning && !metricsLoading && !metricsError && `📊 ${dataQualityWarning}`}
            {!hasRealData && !metricsLoading && !metricsError && !dataQualityWarning && "📋 Using fallback baseline (61-trip sample)"}
          </div>
        )}

        {/* Live Data Summary */}
        {econData && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 12,
            marginBottom: 24,
          }}>
            {[
              { label: "API Spend", value: `$${econData.costs.totalCost.toFixed(2)}`, sub: `${econData.dataQuality.costDataDays}d tracked`, color: "#F87171" },
              { label: "Revenue", value: econData.revenue.totalRevenue > 0 ? `$${econData.revenue.totalRevenue.toFixed(2)}` : "-", sub: econData.revenue.purchaseCount > 0 ? `${econData.revenue.purchaseCount} purchases` : "No purchases", color: "#34D399" },
              { label: "Users", value: `${econData.users.totalUsers}`, sub: `${econData.users.paidUsers} paid`, color: "#38BDF8" },
              { label: "Trips", value: `${econData.trips.totalTrips}`, sub: `${econData.trips.uniqueTripUsers} creators`, color: "#A855F7" },
              { label: "Credit Liability", value: `${(econData.users.outstandingPurchased + econData.users.outstandingFree).toLocaleString()}`, sub: `${econData.users.outstandingPurchased.toLocaleString()} paid · ${econData.users.outstandingFree.toLocaleString()} free`, color: "#FBBF24", expandable: true },
            ].map((kpi, i) => (
              <div key={i} style={{
                background: "rgba(30, 41, 59, 0.5)",
                borderRadius: 8,
                padding: "12px 16px",
                borderTop: `2px solid ${kpi.color}`,
              }}>
                <p style={{ fontSize: 10, color: "#64748B", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: kpi.color, fontFamily: "'JetBrains Mono', monospace", margin: "0 0 2px" }}>{kpi.value}</p>
                <p style={{ fontSize: 10, color: "#94A3B8", margin: 0 }}>{kpi.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Credit Liability Drilldown — compact expandable */}
        {econData && (econData.users.outstandingPurchased > 0 || econData.users.outstandingFree > 0) && (
          <details style={{
            marginBottom: 24,
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            border: "1px solid rgba(251, 191, 36, 0.15)",
            overflow: "hidden",
          }}>
            <summary style={{ padding: "12px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#FBBF24", listStyle: "none", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, transition: "transform 0.2s" }}>▶</span>
              🏦 Credit Liability — {(econData.users.outstandingPurchased + econData.users.outstandingFree).toLocaleString()} total
              <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400, marginLeft: 8 }}>
                {econData.users.outstandingPurchased.toLocaleString()} paid · {econData.users.outstandingFree.toLocaleString()} free
              </span>
            </summary>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "12px 20px" }}>
              <div style={{ background: "rgba(251, 191, 36, 0.08)", borderRadius: 8, padding: "12px 14px", border: "1px solid rgba(251, 191, 36, 0.15)" }}>
                <p style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Purchased (Stripe-backed)</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#FBBF24", fontFamily: "'JetBrains Mono', monospace", margin: "0 0 2px" }}>
                  {econData.users.outstandingPurchased.toLocaleString()}
                </p>
                <p style={{ fontSize: 10, color: "#94A3B8", margin: 0 }}>
                  {econData.users.outstandingPurchased > 0 ? `≈ $${(econData.users.outstandingPurchased * 0.05).toFixed(2)} value @ $0.05/cr` : 'No real purchases yet'}
                </p>
              </div>
              <div style={{ background: "rgba(100, 116, 139, 0.08)", borderRadius: 8, padding: "12px 14px", border: "1px solid rgba(100, 116, 139, 0.15)" }}>
                <p style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Free / Granted</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", margin: "0 0 2px" }}>
                  {econData.users.outstandingFree.toLocaleString()}
                </p>
                <p style={{ fontSize: 10, color: "#64748B", margin: 0 }}>No cash liability - expires naturally</p>
              </div>
            </div>
          </details>
        )}

        {/* Revenue Drilldown - appears when there are paid users */}
        {econData && econData.revenue.purchaseCount > 0 && (
          <div style={{
            marginBottom: 24,
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            border: "1px solid rgba(52, 211, 153, 0.2)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(100, 116, 139, 0.15)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#34D399", margin: 0 }}>
                💰 Revenue Drilldown — {econData.revenue.userPurchases.length} Paying {econData.revenue.userPurchases.length === 1 ? 'User' : 'Users'}
              </h3>
            </div>
            
            {/* Tier Summary */}
            {econData.revenue.tiers.length > 0 && (
              <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(100, 116, 139, 0.1)" }}>
                <p style={{ fontSize: 10, color: "#64748B", marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>By Credit Pack</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {econData.revenue.tiers.map((tier) => (
                    <div key={tier.tier} style={{
                      background: "rgba(52, 211, 153, 0.08)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      minWidth: 100,
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0", margin: "0 0 2px", textTransform: "capitalize" }}>{tier.tier}</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#34D399", fontFamily: "'JetBrains Mono', monospace", margin: "0 0 2px" }}>
                        ${tier.totalRevenue.toFixed(2)}
                      </p>
                      <p style={{ fontSize: 10, color: "#94A3B8", margin: 0 }}>
                        {tier.count} purchase{tier.count !== 1 ? 's' : ''} · {tier.totalCredits.toLocaleString()} credits
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Per-User Breakdown */}
            <div style={{ padding: "12px 20px" }}>
              <p style={{ fontSize: 10, color: "#64748B", marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>By User</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(100, 116, 139, 0.2)" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "#94A3B8", fontWeight: 500 }}>User</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: "#94A3B8", fontWeight: 500 }}>Purchases</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: "#94A3B8", fontWeight: 500 }}>Credits</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: "#94A3B8", fontWeight: 500 }}>Revenue</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "#94A3B8", fontWeight: 500 }}>Packs Bought</th>
                  </tr>
                </thead>
                <tbody>
                  {econData.revenue.userPurchases.map((up) => {
                    const packSummary = up.purchases.reduce((acc, p) => {
                      acc[p.tier] = (acc[p.tier] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);
                    return (
                      <tr key={up.userId} style={{ borderBottom: "1px solid rgba(100, 116, 139, 0.1)" }}>
                        <td style={{ padding: "8px", color: "#E2E8F0", fontWeight: 500 }}>
                          {up.displayName}
                          <span style={{ fontSize: 10, color: "#64748B", marginLeft: 6 }}>{up.userId.slice(0, 8)}</span>
                        </td>
                        <td style={{ padding: "8px", textAlign: "right", color: "#CBD5E1", fontFamily: "'JetBrains Mono', monospace" }}>{up.purchaseCount}</td>
                        <td style={{ padding: "8px", textAlign: "right", color: "#CBD5E1", fontFamily: "'JetBrains Mono', monospace" }}>{up.totalCredits.toLocaleString()}</td>
                        <td style={{ padding: "8px", textAlign: "right", color: "#34D399", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>${up.totalRevenue.toFixed(2)}</td>
                        <td style={{ padding: "8px", color: "#94A3B8" }}>
                          {Object.entries(packSummary).map(([tier, count]) => (
                            <span key={tier} style={{
                              display: "inline-block",
                              background: "rgba(52, 211, 153, 0.1)",
                              borderRadius: 4,
                              padding: "2px 6px",
                              marginRight: 4,
                              fontSize: 10,
                              textTransform: "capitalize",
                            }}>
                              {tier} ×{count}
                            </span>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Credit Consumption by Action — tracks what actions are being charged */}
        {econData && (
          <details style={{
            marginBottom: 24,
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            border: "1px solid rgba(168, 85, 247, 0.2)",
            overflow: "hidden",
          }} open>
            <summary style={{ padding: "16px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#A855F7", listStyle: "none", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, transition: "transform 0.2s" }}>▶</span>
              ⚡ Credit Consumption by Action
              <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400, marginLeft: 8 }}>
                {econData.revenue.spendByAction ? `${Object.values(econData.revenue.spendByAction).reduce((s, a) => s + a.count, 0)} actions · ${Object.values(econData.revenue.spendByAction).reduce((s, a) => s + a.credits, 0).toLocaleString()} cr spent` : 'No data'}
              </span>
            </summary>
            <div style={{ padding: "12px 20px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(100, 116, 139, 0.2)" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "#94A3B8", fontWeight: 500 }}>Action</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: "#94A3B8", fontWeight: 500 }}>Uses</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: "#94A3B8", fontWeight: 500 }}>Credits</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: "#94A3B8", fontWeight: 500 }}>Avg/Use</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: "#94A3B8", fontWeight: 500 }}>Est. Cost</th>
                    <th style={{ textAlign: "center", padding: "6px 8px", color: "#94A3B8", fontWeight: 500 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(econData.revenue.spendByAction || {})
                    .sort(([, a], [, b]) => b.credits - a.credits)
                    .map(([action, data]) => {
                      const costPerUse = ACTION_COSTS[action as keyof typeof ACTION_COSTS] || 0.01;
                      const estCost = data.count * costPerUse;
                      const avgCredits = data.count > 0 ? (data.credits / data.count).toFixed(1) : '0';
                      const isTracked = data.credits > 0;
                      const isFreeOnly = data.credits === 0 && data.count > 0;
                      
                      return (
                        <tr key={action} style={{ borderBottom: "1px solid rgba(100, 116, 139, 0.1)" }}>
                          <td style={{ padding: "8px", color: "#E2E8F0", fontWeight: 500, textTransform: "capitalize" }}>
                            {action.replace(/_/g, ' ')}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#CBD5E1", fontFamily: "'JetBrains Mono', monospace" }}>
                            {data.count}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", color: isTracked ? "#A855F7" : "#64748B", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                            {data.credits.toLocaleString()}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
                            {avgCredits}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#F87171", fontFamily: "'JetBrains Mono', monospace" }}>
                            ${estCost.toFixed(3)}
                          </td>
                          <td style={{ padding: "8px", textAlign: "center" }}>
                            {isFreeOnly ? (
                              <span style={{ fontSize: 10, background: "rgba(52, 211, 153, 0.15)", color: "#34D399", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>FREE CAP</span>
                            ) : isTracked ? (
                              <span style={{ fontSize: 10, background: "rgba(168, 85, 247, 0.15)", color: "#A855F7", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>CHARGED</span>
                            ) : (
                              <span style={{ fontSize: 10, background: "rgba(248, 113, 113, 0.15)", color: "#F87171", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>NOT TRACKED</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {/* Show expected actions that are MISSING from spend tracking */}
                  {['regenerate_day', 'swap_activity', 'transport_mode_change', 'smart_finish', 'unlock_day', 'trip_generation', 'hotel_search', 'ai_message'].filter(
                    a => !(econData.revenue.spendByAction || {})[a]
                  ).map(action => (
                    <tr key={action} style={{ borderBottom: "1px solid rgba(100, 116, 139, 0.1)", opacity: 0.6 }}>
                      <td style={{ padding: "8px", color: "#F87171", fontWeight: 500, textTransform: "capitalize" }}>
                        ⚠️ {action.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: "8px", textAlign: "right", color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>0</td>
                      <td style={{ padding: "8px", textAlign: "right", color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>0</td>
                      <td style={{ padding: "8px", textAlign: "right", color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>-</td>
                      <td style={{ padding: "8px", textAlign: "right", color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>-</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        <span style={{ fontSize: 10, background: "rgba(248, 113, 113, 0.15)", color: "#F87171", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>NEVER FIRED</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 10, color: "#64748B", marginTop: 8, fontStyle: "italic" }}>
                "FREE CAP" = within per-trip free allowance (0 credits charged). "NEVER FIRED" = action bypassed spend-credits (now fixed). "CHARGED" = credits deducted.
              </p>
            </div>
          </details>
        )}

        {/* Global Controls - Volume & Conversion */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr 1fr", 
          gap: 16, 
          marginBottom: 24,
        }}>
          {/* Volume Slider */}
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "20px 24px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>Monthly Volume</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={volume}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(1000, +e.target.value || 1));
                    setVolume(v);
                  }}
                  style={{ width: 60, fontSize: 16, fontWeight: 700, color: "#63B3AA", fontFamily: "'JetBrains Mono', monospace", background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(100,116,139,0.3)", borderRadius: 6, padding: "2px 8px", textAlign: "right", outline: "none" }}
                />
                <span style={{ fontSize: 12, color: "#64748B" }}>trips</span>
              </div>
            </div>
            <input
              type="range"
              min="1"
              max="1000"
              value={volume}
              onChange={(e) => setVolume(+e.target.value)}
              style={{ width: "100%", accentColor: "#63B3AA", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 6 }}>
              <span>1</span><span>250</span><span>500</span><span>1,000</span>
            </div>
          </div>

          {/* Conversion Rate Slider */}
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "20px 24px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>Conversion Rate</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={conversionRate}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(100, +e.target.value || 1));
                    setConversionRate(v);
                  }}
                  style={{ width: 52, fontSize: 16, fontWeight: 700, color: "#F59E0B", fontFamily: "'JetBrains Mono', monospace", background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(100,116,139,0.3)", borderRadius: 6, padding: "2px 8px", textAlign: "right", outline: "none" }}
                />
                <span style={{ fontSize: 12, color: "#64748B" }}>%</span>
              </div>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={conversionRate}
              onChange={(e) => setConversionRate(+e.target.value)}
              style={{ width: "100%", accentColor: "#F59E0B", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 6 }}>
              <span>1%</span><span>10%</span><span>25%</span><span>50%</span><span>100%</span>
            </div>
            <p style={{ fontSize: 10, color: "#64748B", marginTop: 6 }}>
              {costs.payingTrips.toFixed(0)} paying users of {volume} total trips
            </p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div style={{ 
          display: "flex", 
          alignItems: "stretch", 
          marginBottom: 24,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(100, 116, 139, 0.2)",
        }}>
          {([
            { key: 'itinerary' as const, icon: '📊', title: 'Per-Itinerary Cost', desc: 'What ONE trip generation costs (APIs, AI tokens). Use for capacity planning.', accent: '#38BDF8' },
            { key: 'lifecycle' as const, icon: '👤', title: 'User Lifecycle Economics', desc: 'Revenue vs cost across all users (free + paid). Use for profitability.', accent: '#A855F7' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              style={{
                flex: 1,
                padding: "16px 20px",
                background: viewMode === tab.key ? "rgba(30, 41, 59, 0.7)" : "rgba(15, 23, 42, 0.5)",
                border: "none",
                borderBottom: viewMode === tab.key ? `2px solid ${tab.accent}` : "2px solid transparent",
                color: viewMode === tab.key ? "#E2E8F0" : "#64748B",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>{tab.icon} {tab.title}</span>
              <p style={{ fontSize: 10, color: viewMode === tab.key ? "#94A3B8" : "#475569", margin: "4px 0 0", lineHeight: 1.3 }}>{tab.desc}</p>
            </button>
          ))}
        </div>

        {/* Hero Metrics - Context-aware based on view mode */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 32 }}>
          {(viewMode === 'itinerary' ? (() => {
            // CLEAN FLAT-RATE MODEL: same formulas as the scale table
            // Uses RECURRING monthly grant cost, not one-time acquisition
            const PAID_COST = 0.091;
            const FREE_COST_RECURRING = FREE_USER_ECONOMICS.recurringCostPerMonth;
            const paid = volume * (conversionRate / 100);
            const free = volume - paid;
            const freeVarCost = free * FREE_COST_RECURRING;
            const paidVarCost = paid * PAID_COST;
            const totalCost = freeVarCost + paidVarCost + costs.fixed.total;
            const breakEvenPaying = Math.ceil(costs.fixed.total / (blendedAOV - PAID_COST));
            return [
              { label: "Monthly Grant", value: `$${FREE_COST_RECURRING.toFixed(3)}`, sub: `150cr/mo × 60% usage (ALL users, 2mo expiry)`, accent: "#F87171", icon: "🎁" },
              { label: "Acquisition", value: `$${FREE_USER_ECONOMICS.acquisitionCostBlended.toFixed(2)}`, sub: `One-time: free 2-day enriched trip (bypasses credits)`, accent: "#FB923C", icon: "🆓" },
              { label: "Paid Trip Cost", value: `$${PAID_COST.toFixed(3)}`, sub: `Photos $0.085 · Hotels $0.005 · AI ~$0`, accent: "#38BDF8", icon: "💎" },
              { label: "Fixed / Trip", value: `$${costs.fixed.perTrip.toFixed(2)}`, sub: `$${costs.fixed.total.toFixed(0)}/mo ÷ ${volume} trips`, accent: "#F59E0B", icon: "🏗" },
              { label: "Monthly Burn", value: `$${totalCost.toFixed(2)}`, sub: `Free $${freeVarCost.toFixed(2)} + Paid $${paidVarCost.toFixed(2)} + Fixed $${costs.fixed.total.toFixed(0)}`, accent: "#F87171", icon: "🔥" },
              { label: "Break-even", value: `${breakEvenPaying} paying`, sub: `@ $${blendedAOV.toFixed(2)} AOV to cover $${costs.fixed.total.toFixed(0)}/mo`, accent: "#A78BFA", icon: "📍" },
            ];
          })() : [
            { label: "Blended Margin", value: `${costs.blendedMargin.toFixed(1)}%`, sub: `${conversionRate}% convert @ $${blendedAOV.toFixed(2)} avg`, accent: costs.blendedMargin > 50 ? "#34D399" : costs.blendedMargin > 0 ? "#FBBF24" : "#F87171", icon: "📊" },
            { label: "Monthly Profit", value: `$${costs.blendedProfit.toFixed(0)}`, sub: `Rev $${costs.totalRevenue.toFixed(0)} - Cost $${costs.totalCost.toFixed(0)}`, accent: costs.blendedProfit > 0 ? "#34D399" : "#F87171", icon: "💰" },
            { label: "Revenue / Trip", value: `$${costs.revenuePerTrip.toFixed(2)}`, sub: `${costs.payingTrips.toFixed(0)} paying of ${volume}`, accent: "#38BDF8", icon: "🎯" },
            { label: "Cost / Trip", value: `$${costs.blendedAllInCostPerTrip.toFixed(2)}`, sub: `Incl $${costs.fixed.perTrip.toFixed(2)} fixed`, accent: "#A78BFA", icon: "📉" },
            { label: "Margin / Trip", value: `$${costs.realMarginPerTrip.toFixed(2)}`, sub: costs.realMarginPerTrip > 0 ? "Profitable" : "Loss", accent: costs.realMarginPerTrip > 0 ? "#34D399" : "#F87171", icon: "✅" },
          ]).map((m, i) => (
            <div key={i} style={{
              background: `linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)`,
              borderRadius: 12,
              padding: "14px 16px 12px",
              border: `1px solid ${m.accent}22`,
              position: "relative",
              overflow: "hidden",
              transition: "all 0.25s ease",
              boxShadow: `0 4px 24px -4px ${m.accent}15`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px -4px ${m.accent}25`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 24px -4px ${m.accent}15`; }}
            >
              {/* Accent glow */}
               <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 2, background: `linear-gradient(90deg, ${m.accent}, ${m.accent}00)` }} />
              
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                <span style={{ fontSize: 12 }}>{(m as any).icon}</span>
                <p style={{ fontSize: 9, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                  {m.label}
                </p>
              </div>
              <p style={{ fontSize: 20, fontWeight: 800, color: m.accent, margin: "0 0 2px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em" }}>
                {m.value}
              </p>
              <p style={{ fontSize: 9, color: "#94A3B8", margin: 0, lineHeight: 1.3 }}>{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Insights & Opportunities Panel - Collapsible */}
        {(() => {
          const activeInsights = insights.filter(i => !dismissedInsights.has(i.title));
          const leakCount = activeInsights.filter(i => i.type === 'leak').length;
          const warningCount = activeInsights.filter(i => i.type === 'warning').length;
          const oppCount = activeInsights.filter(i => i.type === 'opportunity').length;
          const successCount = activeInsights.filter(i => i.type === 'success').length;
          const actionableCount = leakCount + warningCount + oppCount;
          
          if (activeInsights.length === 0) return null;
          
          const INSIGHT_STYLES: Record<string, { bg: string; border: string; icon: string; accent: string }> = {
            leak: { bg: "rgba(239, 68, 68, 0.08)", border: "#EF4444", icon: "🚨", accent: "#EF4444" },
            warning: { bg: "rgba(245, 158, 11, 0.08)", border: "#F59E0B", icon: "⚠️", accent: "#F59E0B" },
            opportunity: { bg: "rgba(56, 189, 248, 0.08)", border: "#38BDF8", icon: "💡", accent: "#38BDF8" },
            success: { bg: "rgba(52, 211, 153, 0.08)", border: "#34D399", icon: "✓", accent: "#34D399" },
          };
          
          const groupOrder: Array<'leak' | 'warning' | 'opportunity' | 'success'> = ['leak', 'warning', 'opportunity', 'success'];
          const groupLabels: Record<string, string> = { leak: 'Leaks', warning: 'Warnings', opportunity: 'Opportunities', success: 'Resolved' };
          
          return (
            <div style={{
              background: "rgba(30, 41, 59, 0.4)",
              borderRadius: 12,
              border: "1px solid rgba(100, 116, 139, 0.15)",
              marginBottom: 32,
              overflow: "hidden",
            }}>
              {/* Clickable Header */}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setInsightsOpen(!insightsOpen); }}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 24px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(100, 116, 139, 0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, transition: "transform 0.2s", transform: insightsOpen ? "rotate(90deg)" : "rotate(0deg)", color: "#64748B" }}>▶</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#CBD5E1" }}>Insights</span>
                  {actionableCount > 0 && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 10,
                      background: leakCount > 0 ? "rgba(239, 68, 68, 0.25)" : "rgba(245, 158, 11, 0.25)",
                      color: leakCount > 0 ? "#EF4444" : "#F59E0B",
                    }}>
                      {actionableCount}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {leakCount > 0 && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "rgba(239, 68, 68, 0.15)", color: "#EF4444", fontWeight: 600 }}>{leakCount} leak{leakCount > 1 ? 's' : ''}</span>}
                  {warningCount > 0 && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "rgba(245, 158, 11, 0.15)", color: "#F59E0B", fontWeight: 600 }}>{warningCount} warn</span>}
                  {oppCount > 0 && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "rgba(56, 189, 248, 0.15)", color: "#38BDF8", fontWeight: 600 }}>{oppCount} opp</span>}
                  {successCount > 0 && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "rgba(52, 211, 153, 0.15)", color: "#34D399", fontWeight: 600 }}>{successCount} ✓</span>}
                </div>
              </button>
              
              {/* Collapsible Content */}
              {insightsOpen && (
                <div style={{ padding: "0 24px 20px" }}>
                  {groupOrder.map(groupType => {
                    const groupItems = activeInsights.filter(i => i.type === groupType);
                    if (groupItems.length === 0) return null;
                    const gs = INSIGHT_STYLES[groupType];
                    
                    return (
                      <div key={groupType} style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: gs.accent, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px", opacity: 0.8 }}>
                          {groupLabels[groupType]}
                        </p>
                        <div style={{ display: "grid", gap: 6 }}>
                          {groupItems.map((insight, i) => (
                            <div
                              key={i}
                              style={{
                                background: gs.bg,
                                borderRadius: 8,
                                padding: "12px 14px",
                                borderLeft: `3px solid ${gs.border}`,
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                position: "relative",
                              }}
                            >
                              <span style={{ fontSize: 14, lineHeight: 1, marginTop: 1 }}>{gs.icon}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                                  <p style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0", margin: 0 }}>{insight.title}</p>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: gs.accent, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap", flexShrink: 0 }}>{insight.impact}</span>
                                </div>
                                <p style={{ fontSize: 11, color: "#94A3B8", margin: "3px 0 0", lineHeight: 1.4 }}>{insight.description}</p>
                                {insight.action && (
                                  <p style={{ fontSize: 10, color: gs.accent, margin: "6px 0 0", padding: "4px 8px", background: "rgba(15, 23, 42, 0.4)", borderRadius: 4, display: "inline-block", opacity: 0.9 }}>
                                    → {insight.action}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDismissedInsights(prev => new Set([...prev, insight.title])); }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#475569",
                                  cursor: "pointer",
                                  fontSize: 14,
                                  padding: "2px 4px",
                                  borderRadius: 4,
                                  lineHeight: 1,
                                  flexShrink: 0,
                                  transition: "color 0.15s",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "#94A3B8")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
                                title="Dismiss"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {dismissedInsights.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setDismissedInsights(new Set())}
                      style={{ fontSize: 10, color: "#475569", background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginTop: 4 }}
                    >
                      Reset {dismissedInsights.size} dismissed
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Controls - Revenue Mix & Scenario */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr 1fr", 
          gap: 16, 
          marginBottom: 32,
        }}>
          {/* Revenue Mix - Visual */}
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "24px 28px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>Revenue Mix</span>
              <div style={{ display: "flex", gap: 16 }}>
                <span style={{ fontSize: 12, color: "#64748B" }}>
                  AOV: <span style={{ color: "#34D399", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>${blendedAOV.toFixed(2)}</span>
                </span>
                <span style={{ fontSize: 12, color: "#64748B" }}>
                  Cost: <span style={{ color: "#F87171", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>${blendedCostPerUser.toFixed(2)}</span>
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {(Object.keys(REVENUE_MIX_PRESETS) as (keyof typeof REVENUE_MIX_PRESETS)[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setRevenueMix(key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: revenueMix === key ? "1px solid #38BDF8" : "1px solid rgba(100,116,139,0.3)",
                    background: revenueMix === key ? "rgba(56, 189, 248, 0.15)" : "transparent",
                    color: revenueMix === key ? "#38BDF8" : "#64748B",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {REVENUE_MIX_PRESETS[key].label}
                </button>
              ))}
            </div>
            
            {/* Visual Bar Chart */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", height: 24, borderRadius: 6, overflow: "hidden", background: "rgba(15, 23, 42, 0.5)" }}>
                {CREDIT_TIERS.filter(t => t.type !== 'group').map((tier) => {
                  const pct = mixConfig[tier.key as keyof typeof mixConfig] as number;
                  if (!pct || pct === 0) return null;
                  return (
                    <div
                      key={tier.key}
                      style={{
                        width: `${pct}%`,
                        background: tier.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "width 0.3s ease",
                        position: "relative",
                      }}
                      title={`${tier.label}: ${pct}% @ $${tier.price}`}
                    >
                      {pct >= 15 && (
                        <span style={{ 
                          fontSize: 9, 
                          fontWeight: 600, 
                          color: tier.key === "topup" ? "#1E293B" : "#FFF",
                          textShadow: tier.key === "topup" ? "none" : "0 1px 2px rgba(0,0,0,0.3)",
                        }}>
                          {pct}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Tier Labels with $ - Compact for 6 tiers */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {CREDIT_TIERS.filter(t => t.type !== 'group').map((tier) => {
                const pct = mixConfig[tier.key as keyof typeof mixConfig] as number;
                return (
                  <div key={tier.key} style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 4,
                    padding: "2px 6px",
                    background: pct > 0 ? "rgba(15, 23, 42, 0.5)" : "transparent",
                    borderRadius: 4,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: tier.color }} />
                    <span style={{ fontSize: 9, color: pct > 0 ? "#CBD5E1" : "#475569" }}>
                      {tier.label}
                    </span>
                    <span style={{ 
                      fontSize: 9, 
                      color: pct > 0 ? tier.color : "#475569", 
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: pct > 20 ? 600 : 400,
                    }}>
                      ${tier.price}
                    </span>
                    {pct > 0 && (
                      <span style={{ fontSize: 8, color: "#64748B" }}>
                        ({pct}%)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            
            <p style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>
              {mixConfig.description}
            </p>
          </div>

          {/* Scenario */}
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "24px 28px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}>
            <p style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500, marginBottom: 12 }}>Cost Scenario</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {(Object.keys(SCENARIOS) as Scenario[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setScenario(key)}
                  title={SCENARIOS[key].fullDescription}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: scenario === key ? "1px solid #A78BFA" : "1px solid rgba(100,116,139,0.3)",
                    background: scenario === key ? "rgba(167, 139, 250, 0.15)" : "transparent",
                    color: scenario === key ? "#A78BFA" : "#64748B",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {key}: {SCENARIOS[key].name}
                </button>
              ))}
            </div>
            <div style={{ 
              background: "rgba(15, 23, 42, 0.5)", 
              borderRadius: 8, 
              padding: 12,
              borderLeft: "3px solid #A78BFA",
            }}>
              <p style={{ fontSize: 11, color: "#E2E8F0", fontWeight: 500, marginBottom: 4 }}>
                {scenarioConfig.name}
              </p>
              <p style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.5, margin: 0 }}>
                {scenarioConfig.fullDescription}
              </p>
            </div>
          </div>
        </div>

        {/* Two column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>

          {/* Cost Breakdown */}
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "28px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
              Cost Model · Flat-Rate Observed
            </h3>

            {/* Clean cost model breakdown */}
            {[
              { label: "Paid Trip Cost", value: 0.091, color: "#38BDF8", note: "From trip_cost_tracking: 567 entries / 41 trips", breakdown: "Photos $0.085 + Hotels $0.005 + Perplexity $0.001" },
              { label: "Monthly Grant (ALL users)", value: FREE_USER_ECONOMICS.recurringCostPerMonth, color: "#F87171", note: "150cr/mo for ALL users (free + paid), 2-month expiry, 60% usage rate", breakdown: "Blended: unlock 1 day ($0.10) or swaps ($0.02) - avg $0.04 if used. Purchased credits never expire." },
              { label: "Acquisition (one-time)", value: FREE_USER_ECONOMICS.acquisitionCostBlended, color: "#FB923C", note: "First trip bypasses credits entirely - full 2-day enriched trip + ~2.1 edits", breakdown: `Base $0.043 + 2 days $0.200 + edits $0.025 + DNA $0.010. Subsequent trip previews always free ($0.01 AI-only).` },
              { label: "Fixed Monthly", value: 49, color: "#F59E0B", note: "Cloud $25 + Domain $4 + DevOps $20", breakdown: `$${(49 / volume).toFixed(2)}/trip at ${volume} trips/mo` },
            ].map((item, i) => {
              const maxVal = 49;
              const barWidth = (item.value / maxVal) * 100;
              return (
                <div key={i} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
                      <span style={{ fontSize: 13, color: "#CBD5E1" }}>{item.label}</span>
                      <span style={{ fontSize: 9, background: "rgba(52, 211, 153, 0.15)", color: "#34D399", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>VERIFIED</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9", fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.value >= 1 ? `$${item.value.toFixed(0)}` : `$${item.value.toFixed(3)}`}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "rgba(30, 41, 59, 0.8)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(barWidth, 2)}%`, background: item.color, borderRadius: 3, transition: "width 0.3s ease" }} />
                  </div>
                  <p style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>{item.note}</p>
                  <p style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{item.breakdown}</p>
                </div>
              );
            })}

            {/* Blended economics summary */}
            <div style={{ borderTop: "1px solid rgba(100, 116, 139, 0.2)", paddingTop: 16, marginTop: 8 }}>
              {(() => {
                const paid = volume * (conversionRate / 100);
                const free = volume - paid;
                const totalVar = free * FREE_USER_ECONOMICS.recurringCostPerMonth + paid * 0.091;
                const totalAll = totalVar + 49;
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94A3B8", marginBottom: 6 }}>
                      <span>Variable ({free.toFixed(1)} free + {paid.toFixed(1)} paid)</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>${totalVar.toFixed(2)}/mo</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94A3B8", marginBottom: 6 }}>
                      <span>+ Fixed</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>$49.00/mo</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid rgba(100, 116, 139, 0.15)" }}>
                      <span style={{ fontSize: 13, color: "#E2E8F0", fontWeight: 500 }}>Total Monthly Cost</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: "#F87171", fontFamily: "'JetBrains Mono', monospace" }}>
                        ${totalAll.toFixed(2)}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Margin by Tier */}
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "28px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 24 }}>
              Margin By Pricing Tier · {volume} trips/mo
            </h3>

            {verifiedMargins.map((m, i) => {
              const barColor = m.margin > 97 ? "#34D399" : m.margin > 95 ? "#FBBF24" : "#F87171";
              const isActive = m.tier === tier;
              return (
                <div key={i} style={{
                  marginBottom: 16,
                  padding: 16,
                  borderRadius: 8,
                  background: isActive ? "rgba(99, 179, 170, 0.08)" : "rgba(15, 23, 42, 0.4)",
                  border: isActive ? "1px solid rgba(99, 179, 170, 0.3)" : "1px solid rgba(100, 116, 139, 0.15)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }} onClick={() => setTier(m.tier)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", textTransform: "capitalize" }}>{m.tier}</span>
                      <span style={{ fontSize: 12, color: "#64748B", marginLeft: 8 }}>${m.revenue}/trip</span>
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 700, color: barColor, fontFamily: "'JetBrains Mono', monospace" }}>
                      {m.margin.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: "rgba(30, 41, 59, 0.8)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${m.margin}%`, background: barColor, borderRadius: 2 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "#64748B" }}>
                    <span>Revenue: ${m.revenue.toFixed(2)}</span>
                    <span>Cost: ${m.cost.toFixed(2)}</span>
                    <span style={{ color: "#34D399" }}>Profit: ${m.profit.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}

            {/* Fixed cost detail */}
            <div style={{ marginTop: 20, padding: 16, background: "rgba(15, 23, 42, 0.5)", borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500, marginBottom: 8 }}>
                Fixed Costs · ${costs.fixed.total.toFixed(0)}/mo
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B", marginBottom: 4 }}>
                <span>Lovable Cloud</span>
                <span>$25.00</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B", marginBottom: 4 }}>
                <span>Domain</span>
                <span>$4.08</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B", marginBottom: 4 }}>
                <span>DevOps / Testing</span>
                <span>$20.00</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94A3B8", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(100, 116, 139, 0.2)" }}>
                <span>Per-trip allocation at {volume}/mo</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>${costs.fixed.perTrip.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scale Economics Table - With Free User Economics */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
          overflowX: "auto",
        }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 8 }}>
              Economics At Scale · Including Free User Costs · Scenario {scenario}
            </h3>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, lineHeight: 1.6 }}>
              Shows <strong style={{ color: "#F87171" }}>real profitability</strong> accounting for free users who cost money but pay nothing.
              Uses your <strong style={{ color: "#38BDF8" }}>{conversionRate}% conversion rate</strong> and 
              <strong style={{ color: "#A78BFA" }}> {REVENUE_MIX_PRESETS[revenueMix].label}</strong> revenue mix (${blendedAOV.toFixed(2)} blended AOV).
            </p>
          </div>

          {/* Current Settings Reminder */}
          <div style={{ 
            display: "flex", 
            gap: 24, 
            marginBottom: 16, 
            padding: 12, 
            background: "rgba(15, 23, 42, 0.5)", 
            borderRadius: 8,
            flexWrap: "wrap",
          }}>
            <div style={{ fontSize: 11 }}>
              <span style={{ color: "#64748B" }}>Conversion:</span>
              <span style={{ color: "#38BDF8", fontWeight: 600, marginLeft: 6 }}>{conversionRate}%</span>
            </div>
            <div style={{ fontSize: 11 }}>
              <span style={{ color: "#64748B" }}>Revenue Mix:</span>
              <span style={{ color: "#A78BFA", fontWeight: 600, marginLeft: 6 }}>{REVENUE_MIX_PRESETS[revenueMix].label}</span>
            </div>
            <div style={{ fontSize: 11 }}>
              <span style={{ color: "#64748B" }}>Blended AOV:</span>
              <span style={{ color: "#34D399", fontWeight: 600, marginLeft: 6 }}>${blendedAOV.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: 11 }}>
              <span style={{ color: "#64748B" }}>Monthly grant (all users):</span>
              <span style={{ color: "#F59E0B", fontWeight: 600, marginLeft: 6 }}>${FREE_USER_ECONOMICS.recurringCostPerMonth.toFixed(3)}</span>
              <span style={{ color: "#475569", marginLeft: 4 }}>(150cr, 2mo expiry, 60% usage)</span>
              <span style={{ color: "#64748B", marginLeft: 8 }}>Acquisition:</span>
              <span style={{ color: "#FB923C", fontWeight: 600, marginLeft: 6 }}>${FREE_USER_ECONOMICS.acquisitionCostBlended.toFixed(2)}</span>
              <span style={{ color: "#475569", marginLeft: 4 }}>(one-time free trip)</span>
            </div>
            <div style={{ fontSize: 11, borderLeft: "1px solid #334155", paddingLeft: 16 }}>
              <span style={{ color: "#EF4444", fontWeight: 600 }}>Fixed Burn: $49/mo</span>
              <span style={{ color: "#64748B", marginLeft: 6 }}>(Cloud $25 + Domain $4 + DevOps $20)</span>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {SCALE_COLUMNS.map(col => (
                  <th key={col.key} style={{ 
                    textAlign: col.key === "trips" ? "left" : "right", 
                    padding: "10px 12px", 
                    color: "#64748B", 
                    fontWeight: 500, 
                    borderBottom: "1px solid rgba(100, 116, 139, 0.3)",
                    whiteSpace: "nowrap",
                    cursor: "help",
                  }} title={col.tooltip}>
                    <span style={{ borderBottom: "1px dotted #64748B" }}>{col.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scalePoints.map((vol) => {
                // CLEAN FORMULAS — flat observed rates
                // Monthly grant cost applies to ALL users ($0.024/user/mo), not just free
                const GRANT_COST_PER_USER = FREE_USER_ECONOMICS.recurringCostPerMonth; // $0.024
                const PAID_COST_PER_USER = 0.091; // Observed production cost per paid trip
                const TOTAL_FIXED = 49;

                const paid = vol * (conversionRate / 100);
                const free = vol - paid;
                const freeVarCost = free * GRANT_COST_PER_USER;
                const paidVarCost = paid * PAID_COST_PER_USER;
                const totalCost = freeVarCost + paidVarCost + TOTAL_FIXED;
                const revenue = paid * blendedAOV;
                const netProfit = revenue - totalCost;
                const margin = revenue > 0 ? (netProfit / revenue) * 100 : -100;
                const blendedCostPerTrip = totalCost / vol;

                const isKeyVolume = vol === 100 || vol === 500 || vol === 1000;
                const isCurrentVolume = vol === volume;
                
                const getMarginColor = (m: number) => {
                  if (m >= 50) return "#34D399";
                  if (m >= 20) return "#FBBF24";
                  if (m >= 0) return "#F59E0B";
                  return "#EF4444";
                };

                return (
                  <tr key={vol} style={{ 
                    background: isCurrentVolume ? "rgba(99, 179, 170, 0.15)" : isKeyVolume ? "rgba(99, 179, 170, 0.05)" : "transparent",
                    outline: isCurrentVolume ? "1px solid rgba(99, 179, 170, 0.4)" : "none",
                  }}>
                    <td style={{ padding: "10px 12px", color: "#E2E8F0", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      {vol.toLocaleString()}{isCurrentVolume ? " ◀" : ""}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#34D399", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      {paid % 1 === 0 ? paid.toFixed(0) : paid.toFixed(1)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      {free % 1 === 0 ? free.toFixed(0) : free.toFixed(1)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      ${freeVarCost.toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748B", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      ${paidVarCost.toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#E2E8F0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      ${blendedCostPerTrip.toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#34D399", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      ${revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      -${totalCost.toFixed(0)}
                    </td>
                    <td style={{ padding: "10px 12px", color: netProfit > 0 ? "#34D399" : "#EF4444", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      {netProfit >= 0 ? "$" : "-$"}{Math.abs(netProfit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: "10px 12px", color: getMarginColor(margin), textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      {margin.toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <div style={{ marginTop: 16, padding: 12, background: "rgba(245, 158, 11, 0.1)", borderRadius: 8, borderLeft: "3px solid #F59E0B" }}>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: "#F59E0B" }}>Formulas:</strong>{" "}
              Paid = Total × {conversionRate}% · Free = Total - Paid · 
              Grant Cost = Free × <strong style={{ color: "#F59E0B" }}>${FREE_USER_ECONOMICS.recurringCostPerMonth.toFixed(3)}</strong> <span style={{ color: "#475569" }}>(150cr/mo, all users)</span> · 
              Paid Var = Paid × <strong style={{ color: "#38BDF8" }}>$0.091</strong> · 
              Fixed = <strong>$49</strong> · 
              Revenue = Paid × <strong style={{ color: "#34D399" }}>${blendedAOV.toFixed(2)}</strong> AOV · 
              Break-even ≈ <strong style={{ color: "#34D399" }}>{Math.ceil(49 / (blendedAOV - 0.091))} paying users</strong> · 
              <span style={{ color: "#FB923C" }}>Acquisition: ${FREE_USER_ECONOMICS.acquisitionCostBlended.toFixed(2)}/new user (one-time free trip, bypasses credits)</span>
            </p>
          </div>
        </div>

        {/* Credit ↔ Cost Economics - ENHANCED with Tier Breakdown */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", margin: 0 }}>
              Credit Pack → True Cost Conversion
            </h3>
            <span style={{ fontSize: 10, color: "#64748B", background: "rgba(15, 23, 42, 0.5)", padding: "4px 8px", borderRadius: 4 }}>
              What users pay vs. what it costs us
            </span>
          </div>

          {/* Action Cost Table - Dynamic across all tiers */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Action</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Credits</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Our Cost</th>
                <th style={{ textAlign: "right", padding: "8px 6px", color: "#EF4444", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)", fontSize: 10 }}>
                  Free<br/><span style={{ color: "#475569", fontWeight: 400 }}>$0/cr</span>
                </th>
                {CREDIT_TIERS.filter(t => t.type !== 'group').map(t => (
                  <th key={t.key} style={{ textAlign: "right", padding: "8px 6px", color: t.color || "#94A3B8", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)", fontSize: 10 }}>
                    {t.label}<br/><span style={{ color: "#475569", fontWeight: 400 }}>${(t.price / t.credits).toFixed(3)}/cr</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { action: "Unlock 1 Day", credits: 60, cost: 0.018, freeCap: null },
                { action: "Swap Activity", credits: 5, cost: 0.009, freeCap: "3-15/trip*" },
                { action: "Regenerate Day", credits: 10, cost: 0.018, freeCap: "1-5/trip*" },
                { action: "Restaurant Rec", credits: 5, cost: 0.015, freeCap: "1-5/trip*" },
                { action: "AI Message", credits: 5, cost: 0.005, freeCap: "5-25/trip*" },
                { action: "Hotel Search", credits: 40, cost: 0.020, freeCap: null },
                { action: "Smart Finish", credits: 50, cost: 0.040, freeCap: null },
                { action: "Group Unlock (Small)", credits: 150, cost: 0.50, freeCap: null },
                { action: "Group Unlock (Medium)", credits: 300, cost: 1.00, freeCap: null },
                { action: "Group Unlock (Large)", credits: 500, cost: 1.50, freeCap: null },
              ].map((row, i) => {
                const avgCost = row.cost;
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? "rgba(15, 23, 42, 0.3)" : "transparent" }}>
                    <td style={{ padding: "8px 10px", color: "#E2E8F0", fontWeight: 500, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      {row.action}
                      {row.freeCap && (
                        <span style={{ fontSize: 9, color: "#34D399", marginLeft: 6, background: "rgba(52, 211, 153, 0.1)", padding: "1px 5px", borderRadius: 3 }}>
                          {row.freeCap} free
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#A78BFA", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      {row.credits}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      ${avgCost.toFixed(3)}
                    </td>
                    {/* Free tier column - pure loss */}
                    <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, borderBottom: "1px solid rgba(30, 41, 59, 0.5)", fontSize: 11, color: "#EF4444" }}>
                      <><span style={{ color: "#64748B", fontWeight: 400, fontSize: 10 }}>$0</span>{" "}-100%</>
                    </td>
                    {CREDIT_TIERS.filter(t => t.type !== 'group').map(t => {
                      const perCredit = t.price / t.credits;
                      const userPays = (row.credits ?? 0) * perCredit;
                      const margin = userPays > 0 ? ((userPays - avgCost) / userPays) * 100 : -100;
                      return (
                        <td key={t.key} style={{ padding: "8px 6px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, borderBottom: "1px solid rgba(30, 41, 59, 0.5)", fontSize: 11,
                          color: margin > 95 ? "#34D399" : margin > 85 ? "#FBBF24" : "#F87171",
                        }}>
                          <span style={{ color: "#94A3B8", fontWeight: 400, fontSize: 10 }}>${userPays.toFixed(2)}</span>
                          {" "}
                          {margin.toFixed(0)}%
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
           <p style={{ fontSize: 10, color: "#64748B", marginBottom: 24 }}>
            Each cell shows <span style={{ color: "#94A3B8" }}>user pays</span> + <span style={{ color: "#34D399" }}>margin %</span> at that tier's $/credit rate.
            *Free caps vary by tier: Free/Flex (3/1/5/1 = 10 total), Voyager (6/2/10/2 = 20), Explorer (9/3/15/3 = 30), Adventurer (15/5/25/5 = 50). Free/Flex caps scale with trip length.
            Group tiers excluded — they use a shared credit pool model (see Group Budgets section).
          </p>

          {/* TIER-BASED COST BREAKDOWN TABLE */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", marginBottom: 12 }}>
              Tier → Usage Pattern → True Cost
            </h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "rgba(15, 23, 42, 0.5)" }}>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Tier</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Price</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Credits</th>
                  <th style={{ textAlign: "center", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Days</th>
                  <th style={{ textAlign: "center", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Free Acts</th>
                  <th style={{ textAlign: "center", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Pool/Extras</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Our Cost</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {CREDIT_TIERS.map((tier, i, arr) => {
                  const prevType = i > 0 ? arr[i - 1].type : null;
                  const showGroupHeader = tier.type !== prevType;
                  const isGroup = tier.type === 'group';
                  // For groups: margin based on credit value at $0.09/cr
                  const effectivePrice = isGroup ? tier.credits * 0.09 : tier.price;
                  const margin = effectivePrice > 0 ? ((effectivePrice - tier.estimatedCostToUs) / effectivePrice) * 100 : -100;
                  const marginColor = margin > 97 ? "#34D399" : margin > 95 ? "#FBBF24" : "#F87171";
                  
                  // Free acts by tier
                  const freeActsMap: Record<string, string> = {
                    flex_100: '10/trip', flex_300: '10-19/trip', flex_500: '10-28/trip',
                    voyager: '20/trip', explorer: '30/trip', adventurer: '50/trip',
                    group_small: '40 shared', group_medium: '40 shared', group_large: '40 shared',
                  };
                  const freeActs = freeActsMap[tier.key] || '—';
                  
                  // Pool/extras column
                  const poolExtras = isGroup ? `~${(tier as any).typicalPaidActions || 0} paid` : 
                    tier.typicalUsage.swaps > 0 ? `${tier.typicalUsage.swaps} swaps` : '—';
                  
                  return (<>
                    {showGroupHeader && (
                      <tr key={`group-${tier.type}`}>
                        <td colSpan={8} style={{ padding: "10px 10px 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: tier.type === 'club' ? "#A78BFA" : tier.type === 'group' ? "#14B8A6" : "#64748B", borderBottom: "1px solid rgba(100, 116, 139, 0.2)" }}>
                          {tier.type === 'flexible' ? '📦 Flexible Credits' : tier.type === 'club' ? '✨ Voyance Club' : '👥 Group Unlock (Credit Pool)'}
                        </td>
                      </tr>
                    )}
                    <tr key={tier.key} style={{ background: i % 2 === 0 ? "rgba(15, 23, 42, 0.2)" : "transparent" }}>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: tier.color }} />
                          <span style={{ color: "#E2E8F0", fontWeight: 500 }}>{tier.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 10px", color: tier.color, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        {isGroup ? `${tier.credits} cr` : `$${tier.price}`}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#A78BFA", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        {tier.credits}
                      </td>
                      <td style={{ padding: "8px 10px", color: isGroup ? "#64748B" : tier.typicalUsage.daysUnlocked === 0 ? "#F87171" : "#34D399", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        {isGroup ? "—" : tier.typicalUsage.daysUnlocked === 0 ? "-" : tier.typicalUsage.daysUnlocked}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#34D399", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        {freeActs}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#94A3B8", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        {poolExtras}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        ${tier.estimatedCostToUs.toFixed(2)}
                      </td>
                      <td style={{ padding: "8px 10px", color: marginColor, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        {margin.toFixed(1)}%
                      </td>
                    </tr>
                  </>);
                })}
                {/* Free user row - one free 2-day full-power trip */}
                <tr style={{ background: "rgba(248, 113, 113, 0.08)" }}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: "#EF4444" }} />
                      <span style={{ color: "#F87171", fontWeight: 500 }}>Free User</span>
                      <span style={{ fontSize: 9, color: "#64748B", background: "rgba(15, 23, 42, 0.5)", padding: "2px 6px", borderRadius: 4 }}>
                        1 free trip + {FREE_USER_ECONOMICS.freeEditsLimit} edits
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    $0
                  </td>
                  <td style={{ padding: "8px 10px", color: "#64748B", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    150/mo
                  </td>
                  <td style={{ padding: "8px 10px", color: "#F87171", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    {FREE_USER_ECONOMICS.freeTripDays}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#34D399", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    10/trip
                  </td>
                  <td style={{ padding: "8px 10px", color: "#64748B", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    —
                  </td>
                  <td style={{ padding: "8px 10px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    ${FREE_USER_ECONOMICS.acquisitionCostBlended.toFixed(2)}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#EF4444", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    -100%
                  </td>
                </tr>
                {/* Free user worst case row */}
                <tr style={{ background: "rgba(248, 113, 113, 0.04)" }}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: "#FB923C" }} />
                      <span style={{ color: "#FB923C", fontWeight: 500 }}>Free (worst case)</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>$0</td>
                  <td style={{ padding: "8px 10px", color: "#64748B", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>150/mo</td>
                  <td style={{ padding: "8px 10px", color: "#FB923C", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>{FREE_USER_ECONOMICS.freeTripDays}</td>
                  <td style={{ padding: "8px 10px", color: "#34D399", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>10/trip</td>
                  <td style={{ padding: "8px 10px", color: "#64748B", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>—</td>
                  <td style={{ padding: "8px 10px", color: "#FB923C", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>${FREE_USER_ECONOMICS.acquisitionCostWorstCase.toFixed(2)}</td>
                  <td style={{ padding: "8px 10px", color: "#EF4444", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>-100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Blended Cost Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={{ padding: 16, background: "rgba(15, 23, 42, 0.5)", borderRadius: 8, borderLeft: "3px solid #A78BFA" }}>
              <p style={{ fontSize: 10, color: "#64748B", margin: "0 0 4px 0" }}>Blended Paid User Cost</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: "#A78BFA", margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                ${blendedCostPerUser.toFixed(2)}
              </p>
              <p style={{ fontSize: 10, color: "#64748B", margin: "4px 0 0 0" }}>Based on {REVENUE_MIX_PRESETS[revenueMix].label} mix</p>
            </div>
            <div style={{ padding: 16, background: "rgba(15, 23, 42, 0.5)", borderRadius: 8, borderLeft: "3px solid #34D399" }}>
              <p style={{ fontSize: 10, color: "#64748B", margin: "0 0 4px 0" }}>Blended AOV</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: "#34D399", margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                ${blendedAOV.toFixed(2)}
              </p>
              <p style={{ fontSize: 10, color: "#64748B", margin: "4px 0 0 0" }}>
                Gross margin: {(((blendedAOV - blendedCostPerUser) / blendedAOV) * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Key Insights - Split into Paid & Free */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, background: "rgba(52, 211, 153, 0.1)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: "#34D399", margin: 0, lineHeight: 1.6 }}>
                <strong>💰 Paid User Economics:</strong> Flex 100 ($9) = 1 day + 8 swaps, <strong>$0.09 cost (99.0% margin)</strong>. 
                Club Adventurer ($99.99) = 53 days, <strong>$0.99 cost (99.0% margin)</strong>. All 6 tiers &gt;90% margin.
              </p>
            </div>
            <div style={{ padding: 12, background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: "#F59E0B", margin: 0, lineHeight: 1.6 }}>
                <strong>📋 Free User: Full Preview, No Details</strong><br/>
                Complete itinerary with real venues + DNA reasoning — gated logistics. 
                Cost: AI ($0.04) + validation ($0.06) = <strong>~$0.10/user</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Tier Distribution Section */}
        {econData?.tierDistribution && <Collapsible>
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "28px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
            marginBottom: 32,
          }}>
            <CollapsibleTrigger style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 0 }}>
                👤 User Tiers — {econData.tierDistribution.reduce((s, t) => s + t.count, 0).toLocaleString()} total users
              </h3>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 16 }}>
                <thead>
                  <tr>
                    {["Tier", "Users", "%", "Upgraded This Month"].map(h => (
                      <th key={h} style={{ textAlign: h === "Tier" ? "left" : "right", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const total = econData.tierDistribution.reduce((s, t) => s + t.count, 0);
                    return econData.tierDistribution.map(t => (
                      <tr key={t.tier}>
                        <td style={{ padding: "8px 10px", color: "#E2E8F0", fontWeight: 500, borderBottom: "1px solid rgba(30, 41, 59, 0.5)", textTransform: "capitalize" }}>{t.tier}</td>
                        <td style={{ padding: "8px 10px", color: "#CBD5E1", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>{t.count.toLocaleString()}</td>
                        <td style={{ padding: "8px 10px", color: "#64748B", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>{total > 0 ? ((t.count / total) * 100).toFixed(1) : 0}%</td>
                        <td style={{ padding: "8px 10px", color: t.upgradedThisMonth > 0 ? "#34D399" : "#64748B", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>{t.tier === "free" ? "—" : `+${t.upgradedThisMonth}`}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
              {(() => {
                const groupCreditsAllocated = econData.groupBudgets.pools.reduce((s, p) => s + p.allocated, 0);
                const groupValueAtFlexRate = groupCreditsAllocated * 0.09;
                return groupCreditsAllocated > 0 ? (
                  <p style={{ fontSize: 11, color: "#A78BFA", margin: "12px 0 0 0" }}>
                    Group pools absorbed <strong>{groupCreditsAllocated.toLocaleString()} credits</strong> (~${groupValueAtFlexRate.toFixed(2)} equivalent at Flex rate)
                  </p>
                ) : null;
              })()}
            </CollapsibleContent>
          </div>
        </Collapsible>}

        {/* Group Budget Analytics Section */}
        {econData?.groupBudgets && <Collapsible>
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "28px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
            marginBottom: 32,
          }}>
            <CollapsibleTrigger style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 0 }}>
                👥 Group Budgets — {econData.groupBudgets.totalPools} active pools
              </h3>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 16 }}>
                <thead>
                  <tr>
                    {["Tier", "Pools", "Allocated", "Remaining", "Utilization %", "Depleted"].map(h => (
                      <th key={h} style={{ textAlign: h === "Tier" ? "left" : "right", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {econData.groupBudgets.pools.map(p => {
                    const util = p.allocated > 0 ? ((p.allocated - p.remaining) / p.allocated * 100) : 0;
                    return (
                      <tr key={p.tier}>
                        <td style={{ padding: "8px 10px", color: "#E2E8F0", fontWeight: 500, borderBottom: "1px solid rgba(30, 41, 59, 0.5)", textTransform: "capitalize" }}>{p.tier}</td>
                        <td style={{ padding: "8px 10px", color: "#CBD5E1", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>{p.count}</td>
                        <td style={{ padding: "8px 10px", color: "#CBD5E1", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>{p.allocated.toLocaleString()}</td>
                        <td style={{ padding: "8px 10px", color: "#CBD5E1", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>{p.remaining.toLocaleString()}</td>
                        <td style={{ padding: "8px 10px", color: util > 75 ? "#F87171" : util > 50 ? "#FBBF24" : "#34D399", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>{util.toFixed(0)}%</td>
                        <td style={{ padding: "8px 10px", color: p.depleted > 0 ? "#F87171" : "#64748B", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: p.depleted > 0 ? 600 : 400, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>{p.depleted}</td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  {(() => {
                    const totals = econData.groupBudgets.pools.reduce((acc, p) => ({
                      count: acc.count + p.count,
                      allocated: acc.allocated + p.allocated,
                      remaining: acc.remaining + p.remaining,
                      depleted: acc.depleted + p.depleted,
                    }), { count: 0, allocated: 0, remaining: 0, depleted: 0 });
                    const totalUtil = totals.allocated > 0 ? ((totals.allocated - totals.remaining) / totals.allocated * 100) : 0;
                    return (
                      <tr style={{ borderTop: "2px solid rgba(100, 116, 139, 0.3)" }}>
                        <td style={{ padding: "8px 10px", color: "#E2E8F0", fontWeight: 700, borderBottom: "none" }}>TOTAL</td>
                        <td style={{ padding: "8px 10px", color: "#E2E8F0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, borderBottom: "none" }}>{totals.count}</td>
                        <td style={{ padding: "8px 10px", color: "#E2E8F0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, borderBottom: "none" }}>{totals.allocated.toLocaleString()}</td>
                        <td style={{ padding: "8px 10px", color: "#E2E8F0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, borderBottom: "none" }}>{totals.remaining.toLocaleString()}</td>
                        <td style={{ padding: "8px 10px", color: "#E2E8F0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, borderBottom: "none" }}>{totalUtil.toFixed(0)}%</td>
                        <td style={{ padding: "8px 10px", color: totals.depleted > 0 ? "#F87171" : "#E2E8F0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, borderBottom: "none" }}>{totals.depleted}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
              {/* Pool health indicators */}
              {(() => {
                const healthy = econData.groupBudgets.pools.reduce((s, p) => s + Math.max(0, p.count - p.depleted), 0);
                const depleted = econData.groupBudgets.pools.reduce((s, p) => s + p.depleted, 0);
                return (
                  <p style={{ fontSize: 11, color: "#94A3B8", margin: "12px 0 0 0" }}>
                    Pool Health: <span style={{ color: "#34D399" }}>🟢 Active: {healthy}</span> · <span style={{ color: depleted > 0 ? "#F87171" : "#64748B" }}>🔴 Depleted: {depleted}</span>
                  </p>
                );
              })()}
            </CollapsibleContent>
          </div>
        </Collapsible>}

        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
          overflowX: "auto",
        }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 8 }}>
              Monthly Expense Projections · Scenario {scenario}
            </h3>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, lineHeight: 1.5 }}>
              <strong style={{ color: "#A855F7" }}>Scenario {scenario}</strong>: {scenarioConfig.fullDescription}
            </p>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {EXPENSE_COLUMNS.map(col => (
                  <th key={col.key} style={{ 
                    textAlign: "right", 
                    padding: "10px 10px", 
                    color: "#64748B", 
                    fontWeight: 500, 
                    borderBottom: "1px solid rgba(100, 116, 139, 0.3)",
                    whiteSpace: "nowrap",
                    position: "relative",
                    cursor: "help",
                  }} title={col.tooltip}>
                    <span style={{ borderBottom: "1px dotted #64748B" }}>{col.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[50, 100, 250, 500, 1000].map((vol) => {
                // Use scenario-aware Google cost
                const googleBase = VERIFIED_DATA.services.google.perTrip;
                const googlePerTrip = scenarioConfig.caching ? googleBase * (1 - PHOTO_CACHE_SAVINGS_RATIO) : googleBase;
                const google = googlePerTrip * vol;
                const lovableFixed = 25.00;
                const lovableAI = VERIFIED_DATA.services.lovableAI.perTrip * vol;
                const perplexity = VERIFIED_DATA.services.perplexity.perTrip * vol;
                const domain = 4.08;
                const total = google + lovableFixed + lovableAI + perplexity + domain;

                return (
                  <tr key={vol}>
                    {[
                      vol.toLocaleString(),
                      `$${google.toFixed(2)}`,
                      `$${lovableFixed.toFixed(2)}`,
                      `$${lovableAI.toFixed(2)}`,
                      `$${perplexity.toFixed(2)}`,
                      `$${domain.toFixed(2)}`,
                      `$${total.toFixed(2)}`,
                    ].map((cell, j) => (
                      <td key={j} style={{
                        color: j === 7 ? "#F87171" : "#CBD5E1",
                        padding: "10px 10px",
                        textAlign: "right",
                        borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
                        fontWeight: j === 7 ? 600 : 400,
                        fontFamily: j > 0 ? "'JetBrains Mono', monospace" : "inherit",
                      }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 20, borderTop: "1px solid rgba(100, 116, 139, 0.2)", marginTop: 32 }}>
          <p style={{ fontSize: 11, color: "#475569" }}>
            Voyance Unit Economics · {VERIFIED_DATA.period}
          </p>
        </div>
      </div>
    </div>
  );
}
