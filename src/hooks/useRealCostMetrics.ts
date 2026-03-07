/**
 * Real Cost Metrics Hook
 * Fetches actual aggregated data from trip_cost_tracking table
 * 
 * Error Handling:
 * - Returns null gracefully for non-admins (not an error)
 * - Logs errors to console for debugging
 * - Shows toast notifications for unexpected failures
 * - Provides isError and error state for UI feedback
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface RealCostMetrics {
  // Aggregated totals
  totalTrips: number;
  totalCost: number;
  costPerTrip: number;
  
  // User & interaction counts
  uniqueUsers: number;
  totalInteractions: number;
  
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
   
   // Data quality indicators
   hasCompleteTripIds: boolean;
   dataQualityWarning?: string;
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
   enrichment: 'Photo Enrichment',
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
  try {
    // Check admin role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('[useRealCostMetrics] Auth error:', authError.message);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    
    if (!user) {
      // Not logged in - not an error, just return null
      return null;
    }

    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');

    if (roleError) {
      console.error('[useRealCostMetrics] Role check error:', roleError.message);
      throw new Error(`Role verification failed: ${roleError.message}`);
    }

    if (!roles || roles.length === 0) {
      // Not an admin - not an error, just return null
      return null;
    }

    // Fetch cost tracking entries and real trip count in parallel
    const [costResult, tripCountResult] = await Promise.all([
      supabase
        .from('trip_cost_tracking')
        .select('*')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('trips')
        .select('id', { count: 'exact', head: true }),
    ]);

    if (costResult.error) {
      console.error('[useRealCostMetrics] Fetch error:', costResult.error.message);
      throw new Error(`Failed to load cost data: ${costResult.error.message}`);
    }

    const entries = costResult.data;

    // Handle empty data gracefully
    if (!entries || entries.length === 0) {
      console.log('[useRealCostMetrics] No cost tracking data available yet');
      return null;
    }

    // Get trip count from cost tracking trip_ids, falling back to trips table
    const uniqueTripIds = new Set(entries.filter(e => e.trip_id).map(e => e.trip_id));
    const tripsTableCount = tripCountResult.count || 0;
    
    // Determine data quality and trip count
    const hasCompleteTripIds = uniqueTripIds.size > 0 && uniqueTripIds.size >= entries.length * 0.5;
    let dataQualityWarning: string | undefined;
    let totalTrips: number;
    
    if (hasCompleteTripIds) {
      totalTrips = uniqueTripIds.size;
    } else if (tripsTableCount > 0) {
      // Use actual trip count from trips table — this is reliable
      totalTrips = tripsTableCount;
      // No warning needed — trips table is the canonical source
    } else {
      totalTrips = Math.max(1, Math.ceil(entries.length / 8));
      dataQualityWarning = 'No trip data available. Using estimated trip count';
    }

    // Count unique users and total interactions
    const uniqueUserIds = new Set(entries.filter(e => e.user_id).map(e => e.user_id));
    const uniqueUsers = uniqueUserIds.size;
    const totalInteractions = entries.length;

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
      uniqueUsers,
      totalInteractions,

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
      hasCompleteTripIds,
      dataQualityWarning,
    };
  } catch (error) {
    // Log the error for debugging
    console.error('[useRealCostMetrics] Unexpected error:', error);
    // Re-throw to let React Query handle it
    throw error;
  }
}

export function useRealCostMetrics() {
  const query = useQuery({
    queryKey: ['real-cost-metrics'],
    queryFn: fetchRealCostMetrics,
    staleTime: 60_000, // 1 minute
    retry: 1,
  });

  // Show toast on error - but only once per error
  useEffect(() => {
    if (query.isError && query.error) {
      const message = query.error instanceof Error 
        ? query.error.message 
        : 'Failed to load cost metrics';
      toast.error(message, { id: 'cost-metrics-error' });
    }
  }, [query.isError, query.error]);

  return query;
}
