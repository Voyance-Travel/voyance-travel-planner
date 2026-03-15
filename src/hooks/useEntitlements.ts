/**
 * Entitlements Hook & Utilities
 * 
 * Provides subscription-aware feature gating throughout the app.
 * Connects to Stripe subscriptions via the get-entitlements edge function.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessDaySimple } from '@/lib/voyanceFlowController';

// ============================================================================
// Types
// ============================================================================

export interface FreeCaps {
  swaps: number;
  regenerates: number;
  ai_messages: number;
  restaurant_recs: number;
}

export interface EntitlementsResponse {
  user_id: string;
  plan: string;
  is_subscribed: boolean;
  subscription_end: string | null;
  subscription_price_id: string | null;

  // Tier
  tier: 'free' | 'flex' | 'voyager' | 'explorer' | 'adventurer';

  // Credits
  credits_balance: number;
  credits_purchased: number;
  credits_free: number;

  // Access gates
  has_completed_purchase: boolean;
  is_first_trip: boolean;
  trip_has_smart_finish: boolean;
  unlocked_day_count: number;

  // Feature flags (computed from gates)
  can_view_photos: boolean;
  can_view_addresses: boolean;
  can_view_booking_links: boolean;
  can_view_tips: boolean;
  can_view_reviews: boolean;
  can_export_pdf: boolean;

  // Credit-gated actions
  can_build_itinerary: boolean;
  can_unlock_day: boolean;
  can_smart_finish: boolean;
  can_search_hotels: boolean;
  can_swap_activity: boolean;
  can_regenerate_day: boolean;
  can_send_message: boolean;
  can_get_restaurant_rec: boolean;

  // Free caps
  free_caps: FreeCaps;
  trip_usage: FreeCaps;
  remaining_free_actions: FreeCaps;

  // Legacy
  usage: Record<string, number>;
  draft_trips_count: number;
  unlocked_trips: string[];

  // Costs (frontend should use these)
  costs: Record<string, number>;

  // Backward compat aliases
  plans?: string[];
  is_paid?: boolean;
  has_addon?: boolean;
  entitlements?: Record<string, Entitlement>;
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
  credit_balance?: number;
  // Error state flag
  entitlements_error?: boolean;
  can_build_day?: boolean;
  can_use_flight_hotel_optimization?: boolean;
  can_use_group_budgeting?: boolean;
  can_co_edit?: boolean;
  can_optimize_routes?: boolean;
}

export interface Entitlement {
  enabled: boolean;
  limit?: number;
  used?: number;
}

// Feature flag keys for type safety
export type FeatureFlag =
  | 'ai.itinerary.generate'
  | 'ai.itinerary.generate_quota_month'
  | 'ai.itinerary.regenerate'
  | 'ai.itinerary.max_regenerations_per_trip'
  | 'ai.itinerary.reasoning'
  | 'ai.dream_quiz'
  | 'ai.chat_assistant'
  | 'trip.save.enabled'
  | 'trip.save.max_drafts'
  | 'trip.export'
  | 'booking.flight_search'
  | 'booking.hotel_search'
  | 'booking.checkout'
  | 'booking.price_lock'
  | 'enrich.venue_details'
  | 'enrich.photos'
  | 'enrich.reviews'
  | 'enrich.live_refresh'
  | 'enrich.max_venues_per_trip';

// ============================================================================
// Hook
// ============================================================================

export function useEntitlements(tripId?: string) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // QA MODE: Set to true to bypass all payment gates during testing
  const QA_MODE_PREMIUM = false;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['entitlements'] });
  };

  if (QA_MODE_PREMIUM) {
    return {
      data: {
        user_id: user?.id || 'demo',
        plan: 'monthly',
        is_subscribed: true,
        subscription_end: null,
        subscription_price_id: null,
        tier: 'adventurer' as const,
        credits_balance: 9999,
        credits_purchased: 9999,
        credits_free: 0,
        has_completed_purchase: true,
        is_first_trip: false,
        trip_has_smart_finish: false,
        can_view_photos: true,
        can_view_addresses: true,
        can_view_booking_links: true,
        can_view_tips: true,
        can_view_reviews: true,
        can_export_pdf: true,
        can_build_itinerary: true,
        can_unlock_day: true,
        can_smart_finish: true,
        can_search_hotels: true,
        can_swap_activity: true,
        can_regenerate_day: true,
        can_send_message: true,
        can_get_restaurant_rec: true,
        free_caps: { swaps: 999, regenerates: 999, ai_messages: 999, restaurant_recs: 999 },
        trip_usage: { swaps: 0, regenerates: 0, ai_messages: 0, restaurant_recs: 0 },
        remaining_free_actions: { swaps: 999, regenerates: 999, ai_messages: 999, restaurant_recs: 999 },
        usage: {},
        draft_trips_count: 0,
        unlocked_trips: [],
        costs: {},
        plans: ['monthly'],
        is_paid: true,
        has_addon: true,
        entitlements: {},
        entitlements_error: false,
        limits: { freeBuildsRemaining: 999, draftTripsRemaining: 999 },
      } as EntitlementsResponse,
      isLoading: false,
      isError: false,
      error: null,
      refetch: () => Promise.resolve({ data: undefined, error: null }),
      refresh,
      isPaid: true,
      hasAddon: true,
      plans: ['monthly'],
      entitlements: {},
      usage: {},
    };
  }

  const query = useQuery({
    queryKey: ['entitlements', user?.id, tripId],
    queryFn: async (): Promise<EntitlementsResponse> => {
      const { data, error } = await supabase.functions.invoke('get-entitlements', {
        body: tripId ? { tripId } : undefined,
      });
      
      if (error) {
        const errorBody = error.message || '';
        console.warn('[Entitlements] Fetch issue, using defaults:', errorBody);
        // Report to connection recovery system for cascade detection
        try {
          const { reportConnectionFailure } = await import('@/components/common/ConnectionRecoveryBanner');
          reportConnectionFailure();
        } catch {}
        // Return cached entitlements if available instead of restrictive defaults
        // This prevents paid days from appearing locked after transient network errors
        const cached = queryClient.getQueryData<EntitlementsResponse>(['entitlements', user?.id, tripId]);
        if (cached && !cached.entitlements_error) {
          console.log('[Entitlements] Returning cached entitlements instead of restrictive defaults');
          return cached;
        }
        return getDefaultEntitlements(user?.id || '');
      }
      return data;
    },
    enabled: isAuthenticated && !!user?.id,
    staleTime: 60000,
    placeholderData: (previousData: EntitlementsResponse | undefined) => previousData,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  return {
    ...query,
    refresh,
    isPaid: query.data?.is_subscribed ?? false,
    hasAddon: false,
    plans: query.data?.plan ? [query.data.plan] : ['free'],
    entitlements: query.data?.entitlements ?? {},
    usage: query.data?.usage ?? {},
  };
}

// ============================================================================
// Premium Content Helper
// ============================================================================

/**
 * Check if user can view premium content for a specific day.
 * Premium = photos, addresses, tips, reviews, booking links.
 */
export function canViewPremiumContentForDay(
  entitlements: EntitlementsResponse | undefined,
  dayNumber: number
): boolean {
  // No entitlements loaded = assume first trip, days 1-2 free
  if (!entitlements) return dayNumber <= 2;
  return canAccessDaySimple(
    dayNumber,
    entitlements.unlocked_day_count ?? 0,
    entitlements.is_first_trip,
    entitlements.trip_has_smart_finish,
  );
}

// ============================================================================
// Default Entitlements (for unauthenticated/error state)
// ============================================================================

// GUARD: Error fallback must be RESTRICTIVE.
// If get-entitlements fails, lock all premium content to prevent unpaid access.
// Do NOT default premium flags to true here -- that creates a free-access loophole on errors.
// The UI should detect the error state and offer a retry.
// See: src/lib/voyanceFlowController.ts -- single source of truth for gating logic.
function getDefaultEntitlements(userId: string): EntitlementsResponse {
  return {
    user_id: userId,
    plan: 'free',
    is_subscribed: false,
    subscription_end: null,
    subscription_price_id: null,
    tier: 'free',
    credits_balance: 0,
    credits_purchased: 0,
    credits_free: 0,
    has_completed_purchase: false,
    is_first_trip: true,
    trip_has_smart_finish: false,
    unlocked_day_count: 0,
    can_view_photos: false,
    can_view_addresses: false,
    can_view_booking_links: false,
    can_view_tips: false,
    can_view_reviews: false,
    can_export_pdf: false,
    can_build_itinerary: false,
    can_unlock_day: false,
    can_smart_finish: false,
    can_search_hotels: false,
    can_swap_activity: true,
    can_regenerate_day: true,
    can_send_message: true,
    can_get_restaurant_rec: true,
    free_caps: { swaps: 3, regenerates: 1, ai_messages: 5, restaurant_recs: 1 },
    trip_usage: { swaps: 0, regenerates: 0, ai_messages: 0, restaurant_recs: 0 },
    remaining_free_actions: { swaps: 3, regenerates: 1, ai_messages: 5, restaurant_recs: 1 },
    usage: {},
    draft_trips_count: 0,
    unlocked_trips: [],
    costs: {},
    plans: ['free'],
    is_paid: false,
    has_addon: false,
    entitlements: {},
    entitlements_error: true,
  };
}

// ============================================================================
// Utility Functions (backward compat)
// ============================================================================

const QA_MODE_PREMIUM = false;

export function canUse(
  entitlements: Record<string, Entitlement> | undefined,
  flag: FeatureFlag
): boolean {
  if (QA_MODE_PREMIUM) return true;
  if (!entitlements) return false;
  const ent = entitlements[flag];
  if (!ent) return false;
  if (ent.limit !== undefined && ent.used !== undefined) {
    return ent.enabled && ent.used < ent.limit;
  }
  return ent.enabled;
}

export function getRemainingQuota(
  entitlements: Record<string, Entitlement> | undefined,
  flag: FeatureFlag
): number | null {
  if (QA_MODE_PREMIUM) return 999;
  if (!entitlements) return null;
  const ent = entitlements[flag];
  if (!ent || ent.limit === undefined) return null;
  const used = ent.used ?? 0;
  return Math.max(0, ent.limit - used);
}

export function isAtLimit(
  entitlements: Record<string, Entitlement> | undefined,
  flag: FeatureFlag
): boolean {
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
  if (!isAuthenticated) {
    return { allowed: false, reason: 'unauthenticated' };
  }
  if (QA_MODE_PREMIUM) {
    return { allowed: true, reason: 'enabled', remaining: 999, limit: 999 };
  }
  if (isLoading || !entitlements) {
    return { allowed: false, reason: 'loading' };
  }

  const ent = entitlements[flag];
  if (!ent) return { allowed: false, reason: 'disabled' };
  if (!ent.enabled) return { allowed: false, reason: 'disabled' };

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
  canViewPremiumContentForDay,
};
