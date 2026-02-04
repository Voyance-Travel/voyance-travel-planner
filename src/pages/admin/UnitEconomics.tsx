/**
 * Admin Unit Economics Dashboard - Dynamic Production Data
 * Fetches real costs from trip_cost_tracking table
 * Falls back to static estimates when no tracking data available
 * Last Updated: February 4, 2026
 */

import { useState, useMemo } from "react";
import { useRealCostMetrics } from "@/hooks/useRealCostMetrics";

// =============================================================================
// FALLBACK STATIC DATA (used when no tracking data available)
// Source: Google Cloud Console, Lovable Cloud, Perplexity API, Amadeus Docs
// =============================================================================

// =============================================================================
// COST MODEL: Per-Trip Base + Per-Day Scaling (from verified production data)
// 
// Decomposition of $35.85 variable across 61 trips:
//   Per-trip base: $0.163 (Perplexity + Amadeus + AI setup)
//   Per-day increment: $0.100 (Google Places + AI content)
//
// Validation: 5-day average = $0.163 + (5 × $0.100) = $0.663
// Observed: $0.587/trip (estimates slightly conservative = correct for planning)
// =============================================================================

const COST_MODEL = {
  // Per-trip (once) costs
  tripBase: {
    perplexity: 0.018,      // Destination intelligence
    amadeus: 0.120,         // Hotel search (5 calls × $0.024) when live
    aiSetup: 0.025,         // DNA calculation, trip structure
    total: 0.163,
  },
  // Per-day costs
  perDay: {
    googleRestaurants: 0.045,
    googleActivities: 0.030,
    googlePhotos: 0.015,    // Post-cache estimate
    aiContent: 0.010,       // Day content generation
    total: 0.100,
  },
};

const FALLBACK_DATA = {
  trips: 61,
  period: "Jan 25 – Feb 4, 2026",
  services: {
    google: { total: 30.82, perTrip: 0.5052, calls: null, callsPerTrip: 55, label: "Google Places", color: "#4285F4" },
    lovableAI: { total: 3.93, perTrip: 0.0644, perCall: 0.013, calls: 303, callsPerTrip: 4.97, label: "Lovable AI (Gemini)", color: "#A855F7" },
    perplexity: { total: 1.10, perTrip: 0.0180, perCall: 0.005, calls: 208, callsPerTrip: 3.41, label: "Perplexity (Sonar)", color: "#06B6D4" },
    amadeus: { total: 0, perTrip: 0, perCall: 0.024, calls: 0, callsPerTrip: 5, label: "Amadeus Hotels", color: "#F59E0B" },
  },
  fixed: {
    lovableCloud: 25.00,
    domain: 4.08,
    email: 0.00, // Zoho free tier
  },
  revenue: { topup: 5, single: 12, starter: 29, explorer: 55, adventurer: 89 } as Record<string, number>,
};

// Revenue mix presets - what % of paying users buy each tier
// Now includes per-tier COSTS to calculate true blended margin
const REVENUE_MIX_PRESETS = {
  pessimistic: { topup: 50, single: 25, starter: 15, explorer: 8, adventurer: 2, label: "Pessimistic", description: "50% buy $5 top-ups (low cost, low revenue)" },
  conservative: { topup: 30, single: 30, starter: 25, explorer: 12, adventurer: 3, label: "Conservative", description: "30% top-ups, spread across tiers" },
  balanced: { topup: 15, single: 25, starter: 30, explorer: 22, adventurer: 8, label: "Balanced", description: "Most buy Starter/Explorer (higher cost, higher revenue)" },
  optimistic: { topup: 5, single: 15, starter: 25, explorer: 35, adventurer: 20, label: "Optimistic", description: "Heavy Explorer/Adventurer (highest cost, highest revenue)" },
};

// Amadeus: 1 hotel list + 4 offer batches (~200 hotels) = 5 calls
const AMADEUS_CALLS_PER_TRIP = 5;
const AMADEUS_COST_PER_CALL = 0.024;
const AMADEUS_FREE_MONTHLY = 2000; // per endpoint
const AMADEUS_FREE_TRIPS = Math.floor(AMADEUS_FREE_MONTHLY / AMADEUS_CALLS_PER_TRIP); // 400 trips

const PHOTO_CACHE_SAVINGS_RATIO = 0.33; // Estimated, not yet verified post-deployment

// =============================================================================
// FREE USER ECONOMICS - OPTIMIZED MODEL
// 
// CURRENT STATE (high cost):
//   Free users can generate Day 1 FREE (costs us ~$0.25-$0.40)
//   This is expensive because it triggers Google Places APIs
//
// OPTIMIZED STATE (target):
//   Free users get AI-only "Trip Preview" (costs us ~$0.02-$0.03)
//   - Shows day structure, themes, neighborhoods
//   - Does NOT trigger Google Places (no real venue names)
//   - Does NOT trigger Amadeus (no hotel search)
//   Real venue details require credits/purchase
//
// TRANSITION METRICS:
//   Pre-optimization: ~$0.30-$0.50 per free user
//   Post-optimization: ~$0.10-$0.17 per free user
// =============================================================================
// =============================================================================
// FREE USER ECONOMICS - OPTIMIZED MODEL (AI-only preview is now live)
// 
// Post-optimization: Free users get AI-only "Trip Preview"
//   - Shows day structure, themes, neighborhoods
//   - Does NOT trigger Google Places (no real venue names)  
//   - Does NOT trigger Amadeus (no hotel search)
//   - Cost: ~$0.02-$0.03 per preview
//
// Blended free user cost: ~$0.08 (70% light browse + 30% full preview)
// =============================================================================
const FREE_USER_ECONOMICS = {
  // Credit grants
  monthlyCredits: 150,
  maxBonusCredits: 100,
  maxFirstMonthCredits: 250,
  creditExpiry: "2 months",
  
  // Cost model (OPTIMIZED - AI-only preview is live)
  costs: {
    lightBrowse: 0.05,          // Explore + quiz, no trip gen
    fullFunnel: 0.15,           // Preview (AI-only) + quiz + explore
    tripPreview: 0.025,         // AI-only trip structure
  },
  
  // Blended cost calculation: 70% light browse ($0.05) + 30% full funnel ($0.15)
  // = 0.035 + 0.045 = $0.08
  blendedCostToUs: 0.08,
};

// Helper function: Calculate variable cost for N days
function calculateTripCost(days: number, includeAmadeus: boolean = false): number {
  const base = COST_MODEL.tripBase.perplexity + COST_MODEL.tripBase.aiSetup;
  const amadeus = includeAmadeus ? COST_MODEL.tripBase.amadeus : 0;
  const perDay = days * COST_MODEL.perDay.total;
  return base + amadeus + perDay;
}

// AI Model breakdown (fallback static data)
const FALLBACK_AI_MODELS = [
  { model: "gemini-3-flash-preview", calls: 125, usage: "Primary generation" },
  { model: "gemini-2.5-flash-image", calls: 92, usage: "Image-related tasks" },
  { model: "gemini-2.5-flash-lite", calls: 75, usage: "Lightweight tasks" },
  { model: "gemini-2.5-flash", calls: 11, usage: "Fallback" },
];

type Scenario = 'A' | 'B' | 'C' | 'D';

const SCENARIOS: Record<Scenario, { name: string; description: string; fullDescription: string; caching: boolean; amadeus: boolean; amadeusWithinFree: boolean }> = {
  A: { 
    name: "Current Production", 
    description: "Pre-cache, no Amadeus", 
    fullDescription: "Current live state: No photo caching (full Google Places costs), no Amadeus hotel integration. Baseline for comparison.",
    caching: false, amadeus: false, amadeusWithinFree: true 
  },
  B: { 
    name: "Post Photo-Cache", 
    description: "With caching, no Amadeus", 
    fullDescription: "After deploying photo caching: Reduces Google Places costs by ~33% by storing photos locally. No hotel search yet.",
    caching: true, amadeus: false, amadeusWithinFree: true 
  },
  C: { 
    name: "Cache + Amadeus (Free)", 
    description: "Within Amadeus free tier", 
    fullDescription: "Full feature set within free limits: Caching active + Amadeus hotels. At <400 trips/mo, Amadeus is free (2000 calls/mo quota).",
    caching: true, amadeus: true, amadeusWithinFree: true 
  },
  D: { 
    name: "Cache + Amadeus (Paid)", 
    description: "Beyond 400 trips/mo", 
    fullDescription: "Scale mode: Beyond Amadeus free tier. At 400+ trips/mo, each additional trip costs $0.12 for hotel search (5 API calls × $0.024).",
    caching: true, amadeus: true, amadeusWithinFree: false 
  },
};

// Credit pack tiers with USAGE-BASED COST MODELING
// Uses the decomposed cost model: $0.163 base + $0.10/day
const CREDIT_TIERS = [
  { 
    key: "topup", 
    label: "Top-Up", 
    price: 5, 
    credits: 50, 
    color: "#94A3B8", 
    description: "Quick refill for small actions",
    // Top-Up users CAN'T unlock days (need 150 credits), so they only do swaps/AI messages
    typicalUsage: { daysUnlocked: 0, swaps: 8, regenerates: 0, restaurants: 0, aiMessages: 5 },
    // Cost: No trip base (no day unlock), just light AI calls
    estimatedCostToUs: 0.10,   // Reduced: only light actions
    notes: "Cannot unlock days - 50 credits insufficient",
  },
  { 
    key: "single", 
    label: "Single/Starter", 
    price: 12, 
    credits: 200, 
    color: "#38BDF8", 
    description: "One complete day",
    // 1 day = 150 credits (new trip), leaving 50 for extras
    typicalUsage: { daysUnlocked: 1, swaps: 6, regenerates: 1, restaurants: 1, aiMessages: 5 },
    // Cost: $0.163 base + 1 × $0.100/day = $0.263
    estimatedCostToUs: 0.263,
    notes: "1 new trip with 1 day",
  },
  { 
    key: "starter", 
    label: "Weekend", 
    price: 29, 
    credits: 500, 
    description: "3-day trip",
    // 3 days = 450 credits, leaving 50 for extras
    typicalUsage: { daysUnlocked: 3, swaps: 6, regenerates: 1, restaurants: 2, aiMessages: 8 },
    // Cost: $0.163 base + 3 × $0.100/day = $0.463
    estimatedCostToUs: 0.463,
    notes: "1 new trip with 3 days",
  },
  { 
    key: "explorer", 
    label: "Explorer", 
    price: 55, 
    credits: 1200, 
    color: "#34D399", 
    description: "Multi-day adventures",
    // 8 days across potentially 2 trips (5+3)
    typicalUsage: { daysUnlocked: 8, swaps: 12, regenerates: 3, restaurants: 4, aiMessages: 15 },
    // Cost: 2 × $0.163 base + 8 × $0.100/day = $1.126
    estimatedCostToUs: 1.126,
    notes: "May generate 2 trips (5+3 days)",
  },
  { 
    key: "adventurer", 
    label: "Adventurer", 
    price: 89, 
    credits: 2500, 
    color: "#F59E0B", 
    description: "Frequent travelers",
    // 16 days across multiple trips (5+5+5+1 pattern)
    typicalUsage: { daysUnlocked: 16, swaps: 16, regenerates: 4, restaurants: 6, aiMessages: 20 },
    // Cost: 4 × $0.163 base + 16 × $0.100/day = $2.252
    estimatedCostToUs: 2.252,
    notes: "May generate 4 trips (5+5+5+1)",
  },
];

// Cost per action (midpoint estimates from verified data)
const ACTION_COSTS = {
  dayUnlock: 0.065,     // AI generation + Places API for full day
  swap: 0.0125,         // Light AI call
  regenerate: 0.05,     // Medium AI call  
  restaurant: 0.025,    // AI + Places lookup
  aiMessage: 0.0125,    // Chat interaction
};

// Column definitions with tooltips for per-trip scaling table (now includes free user economics)
const SCALE_COLUMNS = [
  { key: "trips", label: "Total Trips", tooltip: "Total monthly trip volume (paid + free users combined)." },
  { key: "paid", label: "Paid", tooltip: "Number of paying users based on conversion rate slider. Formula: Total × Conversion %." },
  { key: "free", label: "Free", tooltip: "Number of free users who cost you money but pay nothing. Formula: Total × (100% - Conversion %)." },
  { key: "freeCost", label: "Free Var $", tooltip: `Variable cost of free users. Free users get ${FREE_USER_ECONOMICS.monthlyCredits} credits/mo → 1 day max unlock = ~$${FREE_USER_ECONOMICS.blendedCostToUs.toFixed(3)}/user (NOT full trip cost).` },
  { key: "loaded", label: "Cost/Trip", tooltip: "Fully-loaded cost per trip = Variable + Fixed ($29.08)/volume. Applies to both paid AND free users." },
  { key: "revenue", label: "Revenue", tooltip: "Total monthly revenue from paying users only. Formula: Paid Users × Blended AOV (based on revenue mix)." },
  { key: "totalCost", label: "Total Cost", tooltip: "INCLUDES FIXED COSTS. Formula: (All Trips × Variable Cost) + $29.08 fixed. This is your total monthly infrastructure spend." },
  { key: "netProfit", label: "Net Profit", tooltip: "Revenue minus ALL costs (variable + fixed). Formula: Revenue - Total Cost. This is what hits your bank account." },
  { key: "realMargin", label: "Real Margin", tooltip: "True margin after ALL costs including fixed overhead. Formula: Net Profit / Revenue. Much lower than per-tier margins." },
];


const EXPENSE_COLUMNS = [
  { key: "trips", label: "Trips/Mo", tooltip: "Number of itineraries generated per month. Each trip = 1 full AI-powered travel plan." },
  { key: "google", label: "Google", tooltip: "Google Places API costs: Text Search, Place Details, Photos, Geocoding. Rate: ~$0.34/trip with caching." },
  { key: "lovableFixed", label: "Lovable (fixed)", tooltip: "Lovable Cloud platform fee: $25/mo flat. Includes hosting, DB, auth, edge functions. Does not scale with usage." },
  { key: "lovableAI", label: "Lovable AI", tooltip: "AI token costs via Lovable AI Gateway (Gemini models). Rate: ~$0.064/trip. Scales linearly with volume." },
  { key: "perplexity", label: "Perplexity", tooltip: "Perplexity Sonar API for destination intelligence & travel advisories. Rate: $0.005/call × ~3.4 calls/trip = $0.018/trip." },
  { key: "amadeus", label: "Amadeus", tooltip: "Amadeus hotel search: 5 calls/trip × $0.024/call = $0.12/trip. FREE for first 400 trips/mo (2000 call quota)." },
  { key: "domain", label: "Domain", tooltip: "Custom domain cost: $49/year ÷ 12 = $4.08/mo. Fixed regardless of volume." },
  { key: "total", label: "Total", tooltip: "Sum of all costs for that month. This is your total infrastructure spend before any revenue." },
];

export default function UnitEconomics() {
  const [volume, setVolume] = useState(61);
  const [tier, setTier] = useState("explorer");
  const [scenario, setScenario] = useState<Scenario>('A');
  const [conversionRate, setConversionRate] = useState(10); // % of trips that convert to paid
  const [revenueMix, setRevenueMix] = useState<keyof typeof REVENUE_MIX_PRESETS>('conservative');
  
  // Fetch real data from trip_cost_tracking table
  const { data: realMetrics, isLoading: metricsLoading } = useRealCostMetrics();
  
  // Use real data when available, otherwise fallback
  const hasRealData = !!realMetrics && realMetrics.totalTrips > 0;
  
  // Calculate blended average order value AND blended cost based on revenue mix
  const mixConfig = REVENUE_MIX_PRESETS[revenueMix];
  
  const { blendedAOV, blendedCostPerUser } = useMemo(() => {
    const tiers = FALLBACK_DATA.revenue;
    const aov = (
      (mixConfig.topup / 100) * tiers.topup +
      (mixConfig.single / 100) * tiers.single +
      (mixConfig.starter / 100) * tiers.starter +
      (mixConfig.explorer / 100) * tiers.explorer +
      (mixConfig.adventurer / 100) * tiers.adventurer
    );
    
    // Calculate blended cost based on tier mix (each tier has different usage = different costs)
    const tierCosts = CREDIT_TIERS.reduce((acc, tier) => {
      acc[tier.key] = tier.estimatedCostToUs;
      return acc;
    }, {} as Record<string, number>);
    
    const cost = (
      (mixConfig.topup / 100) * (tierCosts.topup || 0.16) +
      (mixConfig.single / 100) * (tierCosts.single || 0.22) +
      (mixConfig.starter / 100) * (tierCosts.starter || 0.38) +
      (mixConfig.explorer / 100) * (tierCosts.explorer || 0.72) +
      (mixConfig.adventurer / 100) * (tierCosts.adventurer || 1.35)
    );
    
    return { blendedAOV: aov, blendedCostPerUser: cost };
  }, [revenueMix, mixConfig]);
  
  const VERIFIED_DATA = useMemo(() => {
    if (!hasRealData) return FALLBACK_DATA;
    
    return {
      trips: realMetrics.totalTrips,
      period: `${realMetrics.periodStart} – ${realMetrics.periodEnd}`,
      services: {
        google: { 
          total: realMetrics.google.totalCost, 
          perTrip: realMetrics.google.perTrip, 
          calls: realMetrics.google.totalCalls, 
          callsPerTrip: realMetrics.google.totalCalls / realMetrics.totalTrips, 
          label: "Google Places", 
          color: "#4285F4" 
        },
        lovableAI: { 
          total: realMetrics.ai.totalCost, 
          perTrip: realMetrics.ai.perTrip, 
          perCall: realMetrics.ai.callCount > 0 ? realMetrics.ai.totalCost / realMetrics.ai.callCount : 0.013, 
          calls: realMetrics.ai.callCount, 
          callsPerTrip: realMetrics.ai.callCount / realMetrics.totalTrips, 
          label: "Lovable AI (Gemini)", 
          color: "#A855F7" 
        },
        perplexity: { 
          total: realMetrics.perplexity.totalCost, 
          perTrip: realMetrics.perplexity.perTrip, 
          perCall: 0.005, 
          calls: realMetrics.perplexity.totalCalls, 
          callsPerTrip: realMetrics.perplexity.totalCalls / realMetrics.totalTrips, 
          label: "Perplexity (Sonar)", 
          color: "#06B6D4" 
        },
        amadeus: { 
          total: realMetrics.amadeus.totalCost, 
          perTrip: realMetrics.amadeus.perTrip, 
          perCall: 0.024, 
          calls: realMetrics.amadeus.totalCalls, 
          callsPerTrip: realMetrics.amadeus.totalCalls / realMetrics.totalTrips, 
          label: "Amadeus Hotels", 
          color: "#F59E0B" 
        },
      },
      fixed: FALLBACK_DATA.fixed,
      revenue: FALLBACK_DATA.revenue,
    };
  }, [hasRealData, realMetrics]);

  const revenue = VERIFIED_DATA.revenue[tier];
  const scenarioConfig = SCENARIOS[scenario];

  const costs = useMemo(() => {
    const googleBase = VERIFIED_DATA.services.google.perTrip;
    const googlePerTrip = scenarioConfig.caching ? googleBase * (1 - PHOTO_CACHE_SAVINGS_RATIO) : googleBase;

    const aiPerTrip = VERIFIED_DATA.services.lovableAI.perTrip;
    const perplexityPerTrip = VERIFIED_DATA.services.perplexity.perTrip;

    // Amadeus: $0 within free tier (400 trips), $0.12/trip beyond
    let amadeusPerTrip = 0;
    if (scenarioConfig.amadeus) {
      if (scenarioConfig.amadeusWithinFree || volume <= AMADEUS_FREE_TRIPS) {
        amadeusPerTrip = 0;
      } else {
        // Beyond free tier: pay for all calls
        amadeusPerTrip = AMADEUS_CALLS_PER_TRIP * AMADEUS_COST_PER_CALL; // $0.12
      }
    }

    const variablePerTrip = googlePerTrip + aiPerTrip + perplexityPerTrip + amadeusPerTrip;
    const variableTotal = variablePerTrip * volume;

    const fixedTotal = VERIFIED_DATA.fixed.lovableCloud + VERIFIED_DATA.fixed.domain;
    const fixedPerTrip = fixedTotal / volume;

    const fullyLoaded = variablePerTrip + fixedPerTrip;
    
    // Per-trip margin (assuming 100% paid)
    const margin = ((revenue - fullyLoaded) / revenue) * 100;
    const contributionMargin = ((revenue - variablePerTrip) / revenue) * 100;

    // BLENDED ECONOMICS: Factor in conversion rate and revenue mix
    // Total trips * cost = total cost
    // Paying trips * blended AOV = total revenue
    const payingTrips = volume * (conversionRate / 100);
    const totalRevenue = payingTrips * blendedAOV;
    const totalCost = variableTotal + fixedTotal;
    
    const blendedProfit = totalRevenue - totalCost;
    const blendedMargin = totalRevenue > 0 ? (blendedProfit / totalRevenue) * 100 : -100;
    
    // Revenue per trip (blended across all trips, not just paying)
    const revenuePerTrip = totalRevenue / volume;
    const realMarginPerTrip = revenuePerTrip - fullyLoaded;

    const googleShare = variablePerTrip > 0 ? (googlePerTrip / variablePerTrip) * 100 : 0;

    return {
      google: { perTrip: googlePerTrip, total: googlePerTrip * volume, share: googleShare },
      ai: { perTrip: aiPerTrip, total: aiPerTrip * volume },
      perplexity: { perTrip: perplexityPerTrip, total: perplexityPerTrip * volume },
      amadeus: { perTrip: amadeusPerTrip, total: amadeusPerTrip * volume },
      variable: { perTrip: variablePerTrip, total: variableTotal },
      fixed: { perTrip: fixedPerTrip, total: fixedTotal },
      fullyLoaded,
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
  }, [volume, tier, scenario, scenarioConfig, revenue, conversionRate, blendedAOV]);

  const verifiedMargins = useMemo(() => {
    return Object.entries(VERIFIED_DATA.revenue).map(([key, rev]) => {
      const cost = costs.fullyLoaded;
      return { tier: key, revenue: rev, cost, margin: ((rev - cost) / rev * 100), profit: rev - cost };
    });
  }, [costs.fullyLoaded, VERIFIED_DATA.revenue]);

  // Scale points matching the reference doc
  const scalePoints = [10, 50, 100, 250, 400, 500, 750, 1000];

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
      <div style={{ maxWidth: 1400, margin: "0 auto 40px" }}>
        <div style={{ 
          background: "rgba(30, 41, 59, 0.6)",
          borderRadius: 16,
          padding: "28px 36px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: hasRealData ? "#34D399" : "#FBBF24" }} />
                <span style={{ fontSize: 13, color: "#94A3B8", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Voyance · {hasRealData ? "Live Tracked Data" : "Fallback Estimates"}
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: "4px 0 0", letterSpacing: "-0.02em" }}>
                Cost Per Trip Analysis
              </h1>
              <p style={{ fontSize: 14, color: "#64748B", marginTop: 6 }}>
                {hasRealData ? "Real-time from trip_cost_tracking table" : "Using static fallback data"} · {VERIFIED_DATA.trips} trips · {VERIFIED_DATA.period}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: hasRealData ? "#34D399" : "#FBBF24", fontWeight: 600, marginBottom: 4 }}>
                {hasRealData ? "✓ Live Data" : "⚠ Using Estimates"}
              </div>
              <div style={{ fontSize: 11, color: "#64748B" }}>
                {metricsLoading ? "Loading..." : hasRealData ? `${Object.keys(realMetrics.actionBreakdown || {}).length} action types tracked` : "No tracking data yet"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Hero Metrics - Blended Economics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Blended Margin", value: `${costs.blendedMargin.toFixed(1)}%`, sub: `${conversionRate}% convert @ $${blendedAOV.toFixed(2)} avg`, accent: costs.blendedMargin > 50 ? "#34D399" : costs.blendedMargin > 0 ? "#FBBF24" : "#F87171" },
            { label: "Monthly Profit", value: `$${costs.blendedProfit.toFixed(0)}`, sub: `$${costs.totalRevenue.toFixed(0)} rev - $${costs.totalCost.toFixed(0)} cost`, accent: costs.blendedProfit > 0 ? "#34D399" : "#F87171" },
            { label: "Revenue / Trip", value: `$${costs.revenuePerTrip.toFixed(2)}`, sub: `${costs.payingTrips.toFixed(0)} paying of ${volume}`, accent: "#38BDF8" },
            { label: "Cost / Trip", value: `$${costs.fullyLoaded.toFixed(2)}`, sub: `Scenario ${scenario}`, accent: "#A78BFA" },
            { label: "Margin / Trip", value: `$${costs.realMarginPerTrip.toFixed(2)}`, sub: costs.realMarginPerTrip > 0 ? "Profitable" : "Loss", accent: costs.realMarginPerTrip > 0 ? "#34D399" : "#F87171" },
          ].map((m, i) => (
            <div key={i} style={{
              background: "rgba(30, 41, 59, 0.5)",
              borderRadius: 12,
              padding: "20px 24px",
              border: "1px solid rgba(100, 116, 139, 0.2)",
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: m.accent }} />
              <p style={{ fontSize: 11, color: "#64748B", marginBottom: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {m.label}
              </p>
              <p style={{ fontSize: 28, fontWeight: 700, color: m.accent, marginBottom: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                {m.value}
              </p>
              <p style={{ fontSize: 11, color: "#94A3B8" }}>{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Controls - 2x2 Grid */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr 1fr", 
          gap: 16, 
          marginBottom: 32,
        }}>
          {/* Volume Slider */}
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "24px 28px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>Monthly Volume</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#63B3AA", fontFamily: "'JetBrains Mono', monospace" }}>{volume} trips</span>
            </div>
            <input
              type="range"
              min="1"
              max="1000"
              value={volume}
              onChange={(e) => setVolume(+e.target.value)}
              style={{ width: "100%", accentColor: "#63B3AA", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 8 }}>
              <span>1</span><span>250</span><span>400</span><span>500</span><span>1,000</span>
            </div>
            {volume > AMADEUS_FREE_TRIPS && scenarioConfig.amadeus && (
              <p style={{ fontSize: 10, color: "#F59E0B", marginTop: 8 }}>
                ⚠️ Beyond Amadeus free tier ({AMADEUS_FREE_TRIPS} trips)
              </p>
            )}
          </div>

          {/* Conversion Rate Slider */}
          <div style={{
            background: "rgba(30, 41, 59, 0.5)",
            borderRadius: 12,
            padding: "24px 28px",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>Conversion Rate</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#F59E0B", fontFamily: "'JetBrains Mono', monospace" }}>{conversionRate}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={conversionRate}
              onChange={(e) => setConversionRate(+e.target.value)}
              style={{ width: "100%", accentColor: "#F59E0B", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 8 }}>
              <span>1%</span><span>10%</span><span>25%</span><span>50%</span><span>100%</span>
            </div>
            <p style={{ fontSize: 10, color: "#64748B", marginTop: 8 }}>
              {costs.payingTrips.toFixed(0)} paying users of {volume} total trips
            </p>
          </div>

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
                {CREDIT_TIERS.map((tier) => {
                  const pct = mixConfig[tier.key as keyof typeof mixConfig] as number;
                  if (pct === 0) return null;
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
            
            {/* Tier Labels with $ - Compact for 5 tiers */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {CREDIT_TIERS.map((tier) => {
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
              Variable Cost Breakdown · Scenario {scenario}
            </h3>

            {[
              { label: "Google Places", cost: costs.google.perTrip, color: "#4285F4", verified: scenario === 'A', note: scenarioConfig.caching ? "Post-cache estimate (-33%)" : "Verified: $30.82 ÷ 61 trips" },
              { label: "Lovable AI (Gemini)", cost: costs.ai.perTrip, color: "#A855F7", verified: true, note: `${VERIFIED_DATA.services.lovableAI.calls} calls ÷ ${VERIFIED_DATA.trips} trips = ${VERIFIED_DATA.services.lovableAI.callsPerTrip} calls/trip` },
              { label: "Perplexity (Sonar)", cost: costs.perplexity.perTrip, color: "#06B6D4", verified: true, note: `${VERIFIED_DATA.services.perplexity.calls} calls × $${VERIFIED_DATA.services.perplexity.perCall}/call` },
              { label: "Amadeus Hotels", cost: costs.amadeus.perTrip, color: "#F59E0B", verified: false, note: scenarioConfig.amadeus ? (volume <= AMADEUS_FREE_TRIPS || scenarioConfig.amadeusWithinFree ? `Free tier (${AMADEUS_FREE_TRIPS} trips/mo)` : `${AMADEUS_CALLS_PER_TRIP} calls × $${AMADEUS_COST_PER_CALL} = $0.12/trip`) : "Not active" },
            ].map((item, i) => {
              const maxCost = Math.max(costs.google.perTrip, costs.ai.perTrip, costs.perplexity.perTrip, costs.amadeus.perTrip, 0.01);
              const barWidth = (item.cost / maxCost) * 100;
              return (
                <div key={i} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
                      <span style={{ fontSize: 13, color: "#CBD5E1" }}>{item.label}</span>
                      {item.verified && (
                        <span style={{ fontSize: 9, background: "rgba(52, 211, 153, 0.15)", color: "#34D399", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>VERIFIED</span>
                      )}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9", fontFamily: "'JetBrains Mono', monospace" }}>
                      ${item.cost.toFixed(4)}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "rgba(30, 41, 59, 0.8)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${barWidth}%`, background: item.color, borderRadius: 3, transition: "width 0.3s ease" }} />
                  </div>
                  <p style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>{item.note}</p>
                </div>
              );
            })}

            <div style={{ borderTop: "1px solid rgba(100, 116, 139, 0.2)", paddingTop: 16, marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>Total Variable</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#63B3AA", fontFamily: "'JetBrains Mono', monospace" }}>
                  ${costs.variable.perTrip.toFixed(4)}
                </span>
              </div>
              <p style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                Google = {costs.google.share.toFixed(0)}% of variable cost
              </p>
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
                Fixed Costs · $29.08/mo
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
                <span>Email (Zoho)</span>
                <span>$0.00</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94A3B8", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(100, 116, 139, 0.2)" }}>
                <span>Per-trip allocation at {volume}/mo</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>${costs.fixed.perTrip.toFixed(3)}</span>
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
              Economics At Scale · Including Free User Costs · Scenario D
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
              <span style={{ color: "#64748B" }}>Free user cost:</span>
              <span style={{ color: "#34D399", fontWeight: 600, marginLeft: 6 }}>~${FREE_USER_ECONOMICS.blendedCostToUs.toFixed(2)}</span>
              <span style={{ color: "#475569", marginLeft: 4 }}>(optimized AI-only preview)</span>
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
                const goog = VERIFIED_DATA.services.google.perTrip * (1 - PHOTO_CACHE_SAVINGS_RATIO);
                const ai = VERIFIED_DATA.services.lovableAI.perTrip;
                const perp = VERIFIED_DATA.services.perplexity.perTrip;
                const amad = vol > AMADEUS_FREE_TRIPS ? AMADEUS_CALLS_PER_TRIP * AMADEUS_COST_PER_CALL : 0;
                const variable = goog + ai + perp + amad;
                const fixedPer = 29.08 / vol;
                const loaded = variable + fixedPer;
                
                // Free user economics - CREDIT-CONSTRAINED
                // Free users get 150 credits/month → can only unlock 1 day MAX
                // This costs us ~$0.065-$0.08, NOT $0.42 (which assumes 7-day trip)
                const paidUsers = Math.round(vol * (conversionRate / 100));
                const freeUsers = vol - paidUsers;
                const freeUserCost = FREE_USER_ECONOMICS.blendedCostToUs; // ~$0.076
                const freeCost = freeUsers * freeUserCost;
                
                // Paid users cost based on their tier's usage pattern:
                // - Top-Up ($5, 50 credits): can't unlock days, only swaps/AI (~$0.16)
                // - Single ($12, 200 credits): 1 day + extras (~$0.22)
                // - Explorer ($55, 1200 credits): 7 days + extras (~$0.72)
                const paidUserCost = blendedCostPerUser; // From tier mix calculation
                const paidCost = paidUsers * paidUserCost;
                
                // Total variable cost = free users (credit-limited) + paid users (tier-based)
                const totalVariableCost = freeCost + paidCost;
                
                // Revenue from paying users
                const revenue = paidUsers * blendedAOV;
                const totalCost = totalVariableCost + 29.08; // Variable + fixed
                const netProfit = revenue - totalCost;
                const realMargin = revenue > 0 ? (netProfit / revenue) * 100 : -100;

                const isAmadeusThreshold = vol === 400;
                const isKeyVolume = vol === 100 || vol === 500 || vol === 1000;
                
                const getMarginColor = (m: number) => {
                  if (m >= 50) return "#34D399";
                  if (m >= 20) return "#FBBF24";
                  if (m >= 0) return "#F59E0B";
                  return "#EF4444";
                };

                return (
                  <tr key={vol} style={{ 
                    background: isAmadeusThreshold ? "rgba(245, 158, 11, 0.08)" : isKeyVolume ? "rgba(99, 179, 170, 0.05)" : "transparent" 
                  }}>
                    <td style={{ 
                      padding: "10px 12px", 
                      color: "#E2E8F0", 
                      fontWeight: 600,
                      borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
                    }}>
                      {vol.toLocaleString()}{isAmadeusThreshold ? " ⚠️" : ""}
                    </td>
                    <td style={{ 
                      padding: "10px 12px", 
                      color: "#34D399", 
                      textAlign: "right",
                      fontFamily: "'JetBrains Mono', monospace",
                      borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
                    }}>
                      {paidUsers.toLocaleString()}
                    </td>
                    <td style={{ 
                      padding: "10px 12px", 
                      color: "#F87171", 
                      textAlign: "right",
                      fontFamily: "'JetBrains Mono', monospace",
                      borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
                    }}>
                      {freeUsers.toLocaleString()}
                    </td>
                    <td style={{ 
                      padding: "10px 12px", 
                      color: "#F87171", 
                      textAlign: "right",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 600,
                      borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
                    }}>
                      -${freeCost.toFixed(0)}
                    </td>
                    <td style={{ 
                      padding: "10px 12px", 
                      color: "#94A3B8", 
                      textAlign: "right",
                      fontFamily: "'JetBrains Mono', monospace",
                      borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
                    }}>
                      ${loaded.toFixed(2)}
                    </td>
                    <td style={{ 
                      padding: "10px 12px", 
                      color: "#34D399", 
                      textAlign: "right",
                      fontFamily: "'JetBrains Mono', monospace",
                      borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
                    }}>
                      ${revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ 
                      padding: "10px 12px", 
                      color: "#F87171", 
                      textAlign: "right",
                      fontFamily: "'JetBrains Mono', monospace",
                      borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
                    }}>
                      -${totalCost.toFixed(0)}
                    </td>
                    <td style={{ 
                      padding: "10px 12px", 
                      color: netProfit > 0 ? "#34D399" : "#EF4444", 
                      textAlign: "right",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 600,
                      borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
                    }}>
                      {netProfit >= 0 ? "$" : "-$"}{Math.abs(netProfit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ 
                      padding: "10px 12px", 
                      color: getMarginColor(realMargin), 
                      textAlign: "right",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 600,
                      borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
                    }}>
                      {realMargin.toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <div style={{ marginTop: 16, padding: 12, background: "rgba(15, 23, 42, 0.5)", borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: "#34D399" }}>✓ Optimized Free Tier Active:</strong> Free users get AI-only preview at ~$0.08 blended cost. 
              <strong style={{ color: "#38BDF8" }}> Top-Up users</strong> cost only ~$0.10 (no day unlocks). 
              <strong style={{ color: "#34D399" }}> Explorer users</strong> cost ~$1.13 (8 days across 2 trips). 
              Blended paid user cost at <strong style={{ color: "#A78BFA" }}>{REVENUE_MIX_PRESETS[revenueMix].label}</strong> mix: <strong style={{ color: "#F59E0B" }}>${blendedCostPerUser.toFixed(2)}</strong>.
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

          {/* Action Cost Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 12px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Action</th>
                <th style={{ textAlign: "right", padding: "10px 12px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Credits</th>
                <th style={{ textAlign: "right", padding: "10px 12px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>User Pays*</th>
                <th style={{ textAlign: "right", padding: "10px 12px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Our Cost</th>
                <th style={{ textAlign: "right", padding: "10px 12px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Gross Margin</th>
              </tr>
            </thead>
            <tbody>
              {[
                { action: "Unlock 1 Day", credits: 150, costMin: 0.03, costMax: 0.10 },
                { action: "Swap Activity", credits: 5, costMin: 0.005, costMax: 0.02 },
                { action: "Regenerate Day", credits: 15, costMin: 0.02, costMax: 0.08 },
                { action: "Restaurant Rec", credits: 10, costMin: 0.01, costMax: 0.04 },
                { action: "AI Message", credits: 2, costMin: 0.005, costMax: 0.02 },
              ].map((row, i) => {
                // Calculate user payment based on Explorer tier ($55 / 1200 credits = $0.046/credit)
                const pricePerCredit = 55 / 1200;
                const userPays = row.credits * pricePerCredit;
                const avgCost = (row.costMin + row.costMax) / 2;
                const grossMargin = ((userPays - avgCost) / userPays) * 100;
                
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? "rgba(15, 23, 42, 0.3)" : "transparent" }}>
                    <td style={{ padding: "10px 12px", color: "#E2E8F0", fontWeight: 500, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      {row.action}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#A78BFA", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      {row.credits}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#34D399", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      ${userPays.toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      ${avgCost.toFixed(3)}
                    </td>
                    <td style={{ padding: "10px 12px", color: grossMargin > 90 ? "#34D399" : grossMargin > 80 ? "#FBBF24" : "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                      {grossMargin.toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: 10, color: "#64748B", marginBottom: 24 }}>
            *User payment based on Explorer tier ($55 ÷ 1200 credits = $0.046/credit). Top-Up users pay more ($0.10/credit).
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
                  <th style={{ textAlign: "center", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Swaps</th>
                  <th style={{ textAlign: "center", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Regens</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Our Cost</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#64748B", fontWeight: 500, borderBottom: "1px solid rgba(100, 116, 139, 0.3)" }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {CREDIT_TIERS.map((tier, i) => {
                  const margin = ((tier.price - tier.estimatedCostToUs) / tier.price) * 100;
                  const marginColor = margin > 97 ? "#34D399" : margin > 95 ? "#FBBF24" : "#F87171";
                  
                  return (
                    <tr key={tier.key} style={{ background: i % 2 === 0 ? "rgba(15, 23, 42, 0.2)" : "transparent" }}>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: tier.color }} />
                          <span style={{ color: "#E2E8F0", fontWeight: 500 }}>{tier.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 10px", color: tier.color, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        ${tier.price}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#A78BFA", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        {tier.credits}
                      </td>
                      <td style={{ padding: "8px 10px", color: tier.typicalUsage.daysUnlocked === 0 ? "#F87171" : "#34D399", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        {tier.typicalUsage.daysUnlocked === 0 ? "—" : tier.typicalUsage.daysUnlocked}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#94A3B8", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        {tier.typicalUsage.swaps}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#94A3B8", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        {tier.typicalUsage.regenerates}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        ${tier.estimatedCostToUs.toFixed(2)}
                      </td>
                      <td style={{ padding: "8px 10px", color: marginColor, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                        {margin.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
                {/* Free user row - now with correct credit-constrained cost */}
                <tr style={{ background: "rgba(248, 113, 113, 0.08)" }}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: "#EF4444" }} />
                      <span style={{ color: "#F87171", fontWeight: 500 }}>Free User</span>
                      <span style={{ fontSize: 9, color: "#64748B", background: "rgba(15, 23, 42, 0.5)", padding: "2px 6px", borderRadius: 4 }}>
                        {FREE_USER_ECONOMICS.monthlyCredits}/mo
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    $0
                  </td>
                  <td style={{ padding: "8px 10px", color: "#64748B", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    {FREE_USER_ECONOMICS.monthlyCredits}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#F87171", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    1
                  </td>
                  <td style={{ padding: "8px 10px", color: "#64748B", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    0
                  </td>
                  <td style={{ padding: "8px 10px", color: "#64748B", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    0
                  </td>
                  <td style={{ padding: "8px 10px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    ${FREE_USER_ECONOMICS.blendedCostToUs.toFixed(2)}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#EF4444", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    -100%
                  </td>
                </tr>
                {/* Free user WITH bonus row */}
                <tr style={{ background: "rgba(248, 113, 113, 0.04)" }}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: "#FB923C" }} />
                      <span style={{ color: "#FB923C", fontWeight: 500 }}>Free + Bonus</span>
                      <span style={{ fontSize: 9, color: "#64748B", background: "rgba(15, 23, 42, 0.5)", padding: "2px 6px", borderRadius: 4 }}>
                        referral/share
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", color: "#F87171", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    $0
                  </td>
                  <td style={{ padding: "8px 10px", color: "#64748B", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    {FREE_USER_ECONOMICS.maxFirstMonthCredits}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#FB923C", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    1
                  </td>
                  <td style={{ padding: "8px 10px", color: "#64748B", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    ~15
                  </td>
                  <td style={{ padding: "8px 10px", color: "#64748B", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    1
                  </td>
                  <td style={{ padding: "8px 10px", color: "#FB923C", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    ${FREE_USER_ECONOMICS.blendedCostToUs.toFixed(2)}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#EF4444", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}>
                    -100%
                  </td>
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
                <strong>💰 Paid User Economics:</strong> $5 Top-Up can't unlock days (only swaps/AI) = <strong>$0.16 cost (97% margin)</strong>. 
                Adventurer unlocks 16 days = <strong>$1.35 cost vs $89 (98% margin)</strong>. All tiers profitable.
              </p>
            </div>
            <div style={{ padding: 12, background: "rgba(52, 211, 153, 0.1)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: "#34D399", margin: 0, lineHeight: 1.6 }}>
                <strong>🆓 Free User Economics (Optimized):</strong> AI-only preview costs ~$0.025. 
                {FREE_USER_ECONOMICS.monthlyCredits} credits/mo. 
                <strong>Blended: ~${FREE_USER_ECONOMICS.blendedCostToUs.toFixed(2)}/free user</strong>.
              </p>
            </div>
          </div>
        </div>

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
              Monthly Expense Projections · Scenario D
            </h3>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, lineHeight: 1.5 }}>
              <strong style={{ color: "#A855F7" }}>Scenario D</strong> = Best-case operational state: Photo caching active (-33% Google costs), 
              Amadeus hotel search live. Shows total monthly $ spend at each volume level, assuming every trip uses all services.
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
                const google = 0.3385 * vol;
                const lovableFixed = 25.00;
                const lovableAI = 0.0644 * vol;
                const perplexity = 0.018 * vol;
                const amadeus = vol > AMADEUS_FREE_TRIPS ? (vol - AMADEUS_FREE_TRIPS) * 0.12 : 0;
                const domain = 4.08;
                const total = google + lovableFixed + lovableAI + perplexity + amadeus + domain;

                return (
                  <tr key={vol}>
                    {[
                      vol.toLocaleString(),
                      `$${google.toFixed(2)}`,
                      `$${lovableFixed.toFixed(2)}`,
                      `$${lovableAI.toFixed(2)}`,
                      `$${perplexity.toFixed(2)}`,
                      `$${amadeus.toFixed(2)}`,
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

        {/* Verified Source Data */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 20 }}>
            Source Data · Raw Billing Verification
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {[
              {
                source: "Google Cloud Console",
                icon: "☁️",
                data: [
                  { k: "Project", v: "voyance-462423" },
                  { k: "Service", v: "Places API (New)" },
                  { k: "YTD Billed", v: "$30.82" },
                  { k: "SKUs Active", v: "7" },
                  { k: "Free Tiers", v: "EXCEEDED" },
                  { k: "Charges Since", v: "Jan 25, 2026" },
                ],
                color: "#4285F4",
              },
              {
                source: "Lovable Cloud",
                icon: "🧡",
                data: [
                  { k: "Cloud Usage", v: "$0.89 / $25.00" },
                  { k: "AI Usage", v: "$3.93 ($1 free + $2.93)" },
                  { k: "Top-up Balance", v: "$37.00 remaining" },
                  { k: "Total Requests", v: "303" },
                  { k: "Models", v: "4 (all Gemini Flash)" },
                  { k: "⚠️ Pricing", v: "Temporary until 2026" },
                ],
                color: "#A855F7",
              },
              {
                source: "Perplexity API",
                icon: "🔍",
                data: [
                  { k: "Model", v: "sonar (s4qP)" },
                  { k: "API Requests", v: "208" },
                  { k: "Request Cost", v: "$1.04" },
                  { k: "Token Cost", v: "~$0.04" },
                  { k: "Budget Loaded", v: "$5.00" },
                  { k: "Remaining", v: "~$3.90" },
                ],
                color: "#06B6D4",
              },
              {
                source: "Amadeus Self-Service",
                icon: "✈️",
                data: [
                  { k: "Status", v: "Configured (not live)" },
                  { k: "Endpoints", v: "Hotel List + Offers" },
                  { k: "Price/Call", v: "$0.024" },
                  { k: "Calls/Trip", v: "5 (1 list + 4 batches)" },
                  { k: "Cost/Trip", v: "$0.12 (beyond free)" },
                  { k: "Free Tier", v: "2,000/mo = 400 trips" },
                ],
                color: "#F59E0B",
              },
            ].map((src, i) => (
              <div key={i} style={{
                background: "rgba(15, 23, 42, 0.5)",
                borderRadius: 8,
                padding: 16,
                borderLeft: `3px solid ${src.color}`,
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0", marginBottom: 12 }}>
                  {src.icon} {src.source}
                </p>
                {src.data.map((d, j) => (
                  <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                    <span style={{ color: d.k.startsWith("⚠️") ? "#F59E0B" : "#64748B" }}>{d.k}</span>
                    <span style={{ color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>{d.v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* AI Models in Production */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 20 }}>
            AI Models in Production {hasRealData ? "· Real Tracked Data" : "· Fallback Estimates"}
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {(hasRealData && realMetrics?.modelBreakdown 
              ? Object.entries(realMetrics.modelBreakdown).map(([model, data]) => ({
                  model,
                  calls: data.count,
                  usage: `${(data.inputTokens / 1000).toFixed(0)}K in / ${(data.outputTokens / 1000).toFixed(0)}K out`
                }))
              : FALLBACK_AI_MODELS
            ).map((m, i) => (
              <div key={i} style={{
                background: "rgba(15, 23, 42, 0.5)",
                borderRadius: 8,
                padding: 14,
                borderLeft: "3px solid #A855F7",
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0", marginBottom: 4 }}>
                  {m.model}
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#A855F7", fontFamily: "'JetBrains Mono', monospace" }}>
                  {m.calls} calls
                </p>
                <p style={{ fontSize: 10, color: "#64748B" }}>{m.usage}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#64748B", marginTop: 16, padding: 12, background: "rgba(248, 113, 113, 0.1)", borderRadius: 6, borderLeft: "3px solid #F87171" }}>
            <strong style={{ color: "#F87171" }}>CORRECTED:</strong> Production runs Gemini Flash variants, not GPT-5/GPT-5-mini. Previous internal docs were wrong. Real AI cost is 3-10× lower than documented estimates.
          </p>
        </div>

        {/* Key Findings */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 20 }}>
            Key Findings & Caveats
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 16 }}>
            {[
              { title: "AI is a rounding error", body: "Lovable AI + Perplexity combined = $0.082/trip. At $35 revenue, AI is 0.23% of revenue. Model selection barely matters for margins.", tag: "VERIFIED", tagColor: "#34D399" },
              { title: "Google Places is 63-86% of variable cost", body: "$0.505/trip pre-caching. Photo caching deployed but not yet measured — 33% reduction is estimated, not verified.", tag: "CRITICAL", tagColor: "#F87171" },
              { title: "AI cost includes non-trip overhead", body: "The $0.064/trip includes quiz, explore, homepage preview — not just itinerary generation. Marginal cost of one more trip is lower.", tag: "NOTE", tagColor: "#38BDF8" },
              { title: "Amadeus adds $0.12/trip beyond 400/mo", body: "5 calls × $0.024/call. Free tier covers 400 trips/month. Step change visible in economics at scale table.", tag: "PROJECTED", tagColor: "#F59E0B" },
              { title: "Google free tiers already exceeded", body: "As of Jan 25, 2026, Google Places free tiers are exhausted. All usage now billable. Need SKU breakdown to optimize.", tag: "ACTION", tagColor: "#FBBF24" },
              { title: "Lovable pricing is temporary", body: "Billing page states pricing model being refined through early 2026. Current margins depend partly on a structure the vendor may change.", tag: "RISK", tagColor: "#F87171" },
            ].map((f, i) => (
              <div key={i} style={{
                background: "rgba(15, 23, 42, 0.5)",
                borderRadius: 8,
                padding: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 9, background: `${f.tagColor}20`, color: f.tagColor, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{f.tag}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0" }}>{f.title}</span>
                </div>
                <p style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What to Track */}
        <div style={{
          background: "rgba(30, 41, 59, 0.5)",
          borderRadius: 12,
          padding: "28px",
          border: "1px solid rgba(100, 116, 139, 0.2)",
          marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 20 }}>
            What to Track Going Forward
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            {[
              { metric: "Google Places spend", where: "console.cloud.google.com/billing", freq: "Weekly" },
              { metric: "Google SKU breakdown", where: "Cloud Console → Cost breakdown", freq: "Weekly" },
              { metric: "Lovable AI spend", where: "Lovable → Cloud & AI balance", freq: "Weekly" },
              { metric: "Perplexity balance", where: "perplexity.ai/account/api/billing", freq: "Monthly" },
              { metric: "Amadeus calls (when live)", where: "developers.amadeus.com dashboard", freq: "Weekly" },
              { metric: "Photo cache hit rate", where: "curated_images + storage bucket", freq: "Weekly" },
              { metric: "Cost per trip (actual)", where: "Total spend ÷ trips", freq: "Weekly" },
            ].map((item, i) => (
              <div key={i} style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                padding: "10px 14px",
                background: "rgba(15, 23, 42, 0.5)",
                borderRadius: 6,
                fontSize: 11,
              }}>
                <span style={{ color: "#E2E8F0", fontWeight: 500 }}>{item.metric}</span>
                <span style={{ color: "#64748B", fontSize: 10 }}>{item.freq}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 20, borderTop: "1px solid rgba(100, 116, 139, 0.2)" }}>
          <p style={{ fontSize: 11, color: "#64748B" }}>
            Voyance Unit Economics · Built from verified production billing data · {VERIFIED_DATA.trips} trips · {VERIFIED_DATA.period}
          </p>
          <p style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
            Generated Feb 4, 2026. "Verified" = from billing dashboards. "Projected" = documented pricing + estimates. Update weekly.
          </p>
        </div>
      </div>
    </div>
  );
}
