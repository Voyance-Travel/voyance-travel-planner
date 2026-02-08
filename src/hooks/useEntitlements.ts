/**
 * Entitlements Hook & Utilities
 * 
 * Provides subscription-aware feature gating throughout the app.
 * Connects to Stripe subscriptions via the get-entitlements edge function.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ============================================================================
// Types
// ============================================================================

export interface Entitlement {
  enabled: boolean;
  limit?: number;
  used?: number;
}

export interface EntitlementsResponse {
  user_id: string;
  plans: string[];
  is_paid: boolean;
  has_addon: boolean;
  subscription_end: string | null;
  entitlements: Record<string, Entitlement>;
  usage: Record<string, number>;
  // Extended fields from get-entitlements
  limits?: {
    fullBuilds?: number;
    draftTrips?: number;
    draftTripsRemaining?: number;
    dayRebuilds?: number;
    tripVersions?: number;
    flightHotelOptimization?: boolean;
    groupBudgeting?: boolean;
    coEditCollaboration?: boolean;
    routeOptimization?: boolean;
    weatherTracker?: boolean;
    freeBuildsRemaining?: number;
  };
  unlocked_trips?: string[];
  credit_balance?: number;
  can_build_itinerary?: boolean;
  can_build_day?: boolean;
  can_use_flight_hotel_optimization?: boolean;
  can_use_group_budgeting?: boolean;
  can_co_edit?: boolean;
  can_optimize_routes?: boolean;
}

// Feature flag keys for type safety
export type FeatureFlag =
  // AI / LLM
  | 'ai.itinerary.generate'
  | 'ai.itinerary.generate_quota_month'
  | 'ai.itinerary.regenerate'
  | 'ai.itinerary.max_regenerations_per_trip'
  | 'ai.itinerary.reasoning'
  | 'ai.dream_quiz'
  | 'ai.chat_assistant'
  // Trip saving
  | 'trip.save.enabled'
  | 'trip.save.max_drafts'
  | 'trip.export'
  // Booking
  | 'booking.flight_search'
  | 'booking.hotel_search'
  | 'booking.checkout'
  | 'booking.price_lock'
  // Enrichment
  | 'enrich.venue_details'
  | 'enrich.photos'
  | 'enrich.reviews'
  | 'enrich.live_refresh'
  | 'enrich.max_venues_per_trip';

// ============================================================================
// Hook
// ============================================================================

export function useEntitlements() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // QA MODE: Set to true to bypass all payment gates during testing
  const QA_MODE_PREMIUM = false;

  // Refresh entitlements (e.g., after checkout)
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['entitlements'] });
  };

  // QA Override: Return premium status immediately without API call
  // This prevents 401 errors for unauthenticated users on public pages
  if (QA_MODE_PREMIUM) {
    return {
      data: {
        user_id: user?.id || 'demo',
        plans: ['monthly'],
        is_paid: true,
        has_addon: true,
        subscription_end: null,
        entitlements: {},
        usage: {},
        can_build_itinerary: true,
        can_build_day: true,
        can_use_flight_hotel_optimization: true,
        can_use_group_budgeting: true,
        can_co_edit: true,
        can_optimize_routes: true,
        limits: {
          freeBuildsRemaining: 999,
          draftTripsRemaining: 999,
          fullBuilds: 999,
          draftTrips: 999,
        },
      } as EntitlementsResponse,
      isLoading: false,
      isError: false,
      error: null,
      refetch: () => Promise.resolve({ data: undefined, error: null }),
      refresh,
      // Force premium status for QA
      isPaid: true,
      hasAddon: true,
      plans: ['monthly'],
      entitlements: {},
      usage: {},
    };
  }

  const query = useQuery({
    queryKey: ['entitlements', user?.id],
    queryFn: async (): Promise<EntitlementsResponse> => {
      const { data, error } = await supabase.functions.invoke('get-entitlements');
      
      // Handle 401 auth errors - session is stale/invalid
      if (error) {
        const errorBody = error.message || '';
        if (errorBody.includes('401') || errorBody.includes('Session expired') || errorBody.includes('invalid')) {
          console.warn('[Entitlements] Session expired, user may need to re-authenticate');
          // Don't throw - return empty entitlements to avoid blocking the UI
          return {
            user_id: user?.id || '',
            plans: ['free'],
            is_paid: false,
            has_addon: false,
            subscription_end: null,
            entitlements: {},
            usage: {},
          };
        }
        throw error;
      }
      return data;
    },
    enabled: isAuthenticated && !!user?.id,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      // Don't retry auth errors
      const errorMsg = error?.message || '';
      if (errorMsg.includes('401') || errorMsg.includes('Session expired')) {
        return false;
      }
      return failureCount < 2;
    },
  });

  return {
    ...query,
    refresh,
    // Convenience accessors
    isPaid: query.data?.is_paid ?? false,
    hasAddon: query.data?.has_addon ?? false,
    plans: query.data?.plans ?? ['free'],
    entitlements: query.data?.entitlements ?? {},
    usage: query.data?.usage ?? {},
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

// QA MODE: Set to true to bypass all payment gates during testing
const QA_MODE_PREMIUM = false;

/**
 * Check if a feature is enabled
 */
export function canUse(
  entitlements: Record<string, Entitlement> | undefined,
  flag: FeatureFlag
): boolean {
  // QA Override: Always allow all features
  if (QA_MODE_PREMIUM) return true;
  
  if (!entitlements) return false;
  const ent = entitlements[flag];
  if (!ent) return false;
  
  // If it has a limit, check usage
  if (ent.limit !== undefined && ent.used !== undefined) {
    return ent.enabled && ent.used < ent.limit;
  }
  
  return ent.enabled;
}

/**
 * Get remaining quota for a feature
 */
export function getRemainingQuota(
  entitlements: Record<string, Entitlement> | undefined,
  flag: FeatureFlag
): number | null {
  // QA Override: Always return high quota
  if (QA_MODE_PREMIUM) return 999;
  
  if (!entitlements) return null;
  const ent = entitlements[flag];
  if (!ent || ent.limit === undefined) return null;
  
  const used = ent.used ?? 0;
  return Math.max(0, ent.limit - used);
}

/**
 * Check if user has hit their limit
 */
export function isAtLimit(
  entitlements: Record<string, Entitlement> | undefined,
  flag: FeatureFlag
): boolean {
  // QA Override: Never at limit
  if (QA_MODE_PREMIUM) return false;
  
  if (!entitlements) return true;
  const ent = entitlements[flag];
  if (!ent) return true;
  
  if (ent.limit !== undefined && ent.used !== undefined) {
    return ent.used >= ent.limit;
  }
  
  return !ent.enabled;
}

// ============================================================================
// Usage Consumption Hook
// ============================================================================

export function useConsumeUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ metricKey, amount = 1 }: { metricKey: string; amount?: number }) => {
      const { data, error } = await supabase.functions.invoke('consume-usage', {
        body: { metric_key: metricKey, amount },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Refresh entitlements to get updated usage
      queryClient.invalidateQueries({ queryKey: ['entitlements'] });
    },
  });
}

// ============================================================================
// Gating Component Helper
// ============================================================================

interface FeatureGateResult {
  allowed: boolean;
  reason: 'enabled' | 'disabled' | 'limit_reached' | 'loading' | 'unauthenticated';
  remaining?: number;
  limit?: number;
}

export function checkFeatureAccess(
  entitlements: Record<string, Entitlement> | undefined,
  flag: FeatureFlag,
  isLoading: boolean,
  isAuthenticated: boolean
): FeatureGateResult {
  // QA MODE: Allow all features for authenticated users
  const QA_MODE_PREMIUM = false;
  
  if (!isAuthenticated) {
    return { allowed: false, reason: 'unauthenticated' };
  }
  
  // QA Override: Always allow for authenticated users
  if (QA_MODE_PREMIUM) {
    return { allowed: true, reason: 'enabled', remaining: 999, limit: 999 };
  }
  
  if (isLoading || !entitlements) {
    return { allowed: false, reason: 'loading' };
  }

  const ent = entitlements[flag];
  if (!ent) {
    return { allowed: false, reason: 'disabled' };
  }

  if (!ent.enabled) {
    return { allowed: false, reason: 'disabled' };
  }

  if (ent.limit !== undefined) {
    const used = ent.used ?? 0;
    const remaining = Math.max(0, ent.limit - used);
    
    if (remaining <= 0) {
      return { allowed: false, reason: 'limit_reached', remaining: 0, limit: ent.limit };
    }
    
    return { allowed: true, reason: 'enabled', remaining, limit: ent.limit };
  }

  return { allowed: true, reason: 'enabled' };
}

// ============================================================================
// Export
// ============================================================================

export default {
  useEntitlements,
  useConsumeUsage,
  canUse,
  getRemainingQuota,
  isAtLimit,
  checkFeatureAccess,
};
