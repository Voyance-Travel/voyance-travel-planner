/**
 * Real Cost Metrics Hook
 * Fetches actual aggregated data from trip_cost_tracking table
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RealCostMetrics {
  // Aggregated totals
  totalTrips: number;
  totalCost: number;
  costPerTrip: number;
  
  // Per-service breakdown
  google: {
    totalCalls: number;
    totalCost: number;
    perTrip: number;
  };
  ai: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    perTrip: number;
    callCount: number;
  };
  perplexity: {
    totalCalls: number;
    totalCost: number;
    perTrip: number;
  };
  amadeus: {
    totalCalls: number;
    totalCost: number;
    perTrip: number;
  };
  
  // Time range
  periodStart: string;
  periodEnd: string;
  
  // Action breakdown
  actionBreakdown: Record<string, { count: number; cost: number }>;
  
  // Model usage
  modelBreakdown: Record<string, { count: number; inputTokens: number; outputTokens: number }>;
   
   // Category breakdown (user-facing actions)
   categoryBreakdown: Record<string, { count: number; cost: number; label: string }>;
}

 // Cost category labels for display
 const CATEGORY_LABELS: Record<string, string> = {
   home_browse: 'Home / Browse',
   quiz: 'Travel DNA Quiz',
   explore: 'Explore',
   itinerary_gen: 'Itinerary Generation',
   itinerary_edit: 'Itinerary Editing',
   booking_search: 'Booking Search',
   recommendations: 'Recommendations',
   enrichment: 'Enrichment',
   other: 'Other',
 };

// Google API pricing (per call)
const GOOGLE_PRICING = {
  places: 0.017,
  geocoding: 0.005,
  photos: 0.007,
  routes: 0.005,
};

async function fetchRealCostMetrics(): Promise<RealCostMetrics | null> {
  // Check admin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin');

  if (!roles || roles.length === 0) return null;

  // Fetch all cost tracking entries
  const { data: entries, error } = await supabase
    .from('trip_cost_tracking')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !entries || entries.length === 0) {
    console.log('[useRealCostMetrics] No data or error:', error);
    return null;
  }

  // Get unique trips - but many entries may not have trip_id attached
  // Estimate trip count from action types that represent trip generation
  const tripGenerationActions = ['generate_itinerary', 'itinerary_generation', 'full_itinerary', 'day_generation'];
  const tripRelatedEntries = entries.filter(e => 
    e.trip_id || tripGenerationActions.some(a => e.action_type?.includes(a))
  );
  
  const uniqueTripIds = new Set(entries.filter(e => e.trip_id).map(e => e.trip_id));
  
  // If we have trip IDs, use them. Otherwise, estimate from action patterns
  // or fall back to a reasonable estimate based on total entries
  let totalTrips: number;
  if (uniqueTripIds.size > 0) {
    totalTrips = uniqueTripIds.size;
  } else {
    // No trip IDs tracked yet - use entry count to estimate
    // A typical trip might generate 5-10 tracking entries
    // For now, return null to indicate we don't have per-trip data
    console.log('[useRealCostMetrics] No trip_id data - cannot calculate per-trip costs accurately');
    totalTrips = Math.max(1, Math.ceil(entries.length / 8)); // Rough estimate: 8 entries per trip
  }

  // Aggregate metrics
  let totalCost = 0;
  let googlePlacesCalls = 0;
  let googleGeocodingCalls = 0;
  let googlePhotosCalls = 0;
  let googleRoutesCalls = 0;
  let perplexityCalls = 0;
  let amadeusCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let aiCallCount = 0;

  const actionBreakdown: Record<string, { count: number; cost: number }> = {};
  const modelBreakdown: Record<string, { count: number; inputTokens: number; outputTokens: number }> = {};

  for (const entry of entries) {
    const cost = entry.estimated_cost_usd || 0;
    totalCost += cost;

    // Google calls
    googlePlacesCalls += entry.google_places_calls || 0;
    googleGeocodingCalls += entry.google_geocoding_calls || 0;
    googlePhotosCalls += entry.google_photos_calls || 0;
    googleRoutesCalls += entry.google_routes_calls || 0;

    // Perplexity & Amadeus
    perplexityCalls += entry.perplexity_calls || 0;
    amadeusCalls += entry.amadeus_calls || 0;

    // AI tokens
    totalInputTokens += entry.input_tokens || 0;
    totalOutputTokens += entry.output_tokens || 0;
    if (entry.input_tokens || entry.output_tokens) {
      aiCallCount++;
    }

    // Action breakdown
    const action = entry.action_type || 'unknown';
    if (!actionBreakdown[action]) {
      actionBreakdown[action] = { count: 0, cost: 0 };
    }
    actionBreakdown[action].count++;
    actionBreakdown[action].cost += cost;

    // Model breakdown
    const model = entry.model || 'unknown';
    if (!modelBreakdown[model]) {
      modelBreakdown[model] = { count: 0, inputTokens: 0, outputTokens: 0 };
    }
    modelBreakdown[model].count++;
    modelBreakdown[model].inputTokens += entry.input_tokens || 0;
    modelBreakdown[model].outputTokens += entry.output_tokens || 0;
  }
   
   // Category breakdown
   const categoryBreakdown: Record<string, { count: number; cost: number; label: string }> = {};
   for (const entry of entries) {
     const category = (entry as any).cost_category || 'other';
     const cost = entry.estimated_cost_usd || 0;
     if (!categoryBreakdown[category]) {
       categoryBreakdown[category] = { 
         count: 0, 
         cost: 0, 
         label: CATEGORY_LABELS[category] || category 
       };
     }
     categoryBreakdown[category].count++;
     categoryBreakdown[category].cost += cost;
   }

  // Calculate Google costs
  const googleTotalCost = 
    googlePlacesCalls * GOOGLE_PRICING.places +
    googleGeocodingCalls * GOOGLE_PRICING.geocoding +
    googlePhotosCalls * GOOGLE_PRICING.photos +
    googleRoutesCalls * GOOGLE_PRICING.routes;

  const googleTotalCalls = googlePlacesCalls + googleGeocodingCalls + googlePhotosCalls + googleRoutesCalls;

  // Perplexity cost ($0.005/call estimate)
  const perplexityCost = perplexityCalls * 0.005;

  // Amadeus cost ($0.024/call when not in free tier)
  const amadeusCost = amadeusCalls * 0.024;

  // AI cost is total - google - perplexity - amadeus
  const aiCost = Math.max(0, totalCost - googleTotalCost - perplexityCost - amadeusCost);

  // Get time range
  const dates = entries.map(e => new Date(e.created_at)).sort((a, b) => a.getTime() - b.getTime());
  const periodStart = dates[0]?.toISOString().split('T')[0] || '';
  const periodEnd = dates[dates.length - 1]?.toISOString().split('T')[0] || '';

  return {
    totalTrips,
    totalCost,
    costPerTrip: totalCost / totalTrips,

    google: {
      totalCalls: googleTotalCalls,
      totalCost: googleTotalCost,
      perTrip: googleTotalCost / totalTrips,
    },
    ai: {
      totalInputTokens,
      totalOutputTokens,
      totalCost: aiCost,
      perTrip: aiCost / totalTrips,
      callCount: aiCallCount,
    },
    perplexity: {
      totalCalls: perplexityCalls,
      totalCost: perplexityCost,
      perTrip: perplexityCost / totalTrips,
    },
    amadeus: {
      totalCalls: amadeusCalls,
      totalCost: amadeusCost,
      perTrip: amadeusCost / totalTrips,
    },

    periodStart,
    periodEnd,
    actionBreakdown,
    modelBreakdown,
     categoryBreakdown,
  };
}

export function useRealCostMetrics() {
  return useQuery({
    queryKey: ['real-cost-metrics'],
    queryFn: fetchRealCostMetrics,
    staleTime: 60_000, // 1 minute
    retry: 1,
  });
}
