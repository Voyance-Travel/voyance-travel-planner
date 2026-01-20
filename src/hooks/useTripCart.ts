/**
 * Trip Cart Hook
 * 
 * Manages cart state for bookable items (activities with selected_pending state).
 * Provides totals, item counts, and checkout functionality.
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BookingItemState, TravelerInfo } from '@/services/bookingStateMachine';
import { transitionBookingState, confirmBooking } from '@/services/bookingStateMachine';

export interface CartItem {
  id: string;
  tripId: string;
  title: string;
  type: string;
  category?: string;
  location?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  priceCents: number;
  currency: string;
  bookingRequired: boolean;
  travelerData?: TravelerInfo[];
  quoteExpiresAt?: string;
  quoteLocked?: boolean;
  vendorName?: string;
  externalBookingUrl?: string;
}

export interface TripCartState {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  currency: string;
  isLoading: boolean;
  hasExpiredQuotes: boolean;
}

/**
 * Get cart items for a trip (activities in selected_pending state)
 */
async function fetchCartItems(tripId: string): Promise<CartItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('trip_activities')
    .select('*')
    .eq('trip_id', tripId)
    .eq('booking_state', 'selected_pending')
    .order('block_order', { ascending: true });

  if (error) {
    console.error('Error fetching cart items:', error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any): CartItem => ({
    id: row.id,
    tripId: row.trip_id,
    title: row.title,
    type: row.type,
    category: row.category,
    location: row.location?.name || row.location,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.start_time,
    priceCents: row.quote_price_cents || (row.cost ? Math.round(Number(row.cost) * 100) : 0),
    currency: row.currency || 'USD',
    bookingRequired: row.booking_required ?? true,
    travelerData: row.traveler_data,
    quoteExpiresAt: row.quote_expires_at,
    quoteLocked: row.quote_locked,
    vendorName: row.vendor_name,
    externalBookingUrl: row.external_booking_url,
  }));
}

/**
 * Hook to manage trip cart state
 */
export function useTripCart(tripId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['tripCart', tripId];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => (tripId ? fetchCartItems(tripId) : Promise.resolve([])),
    enabled: !!tripId,
    refetchInterval: 30000, // Refetch every 30s for quote expiry
  });

  // Computed values
  const cartState = useMemo((): TripCartState => {
    const now = new Date();
    const hasExpiredQuotes = items.some(
      item => item.quoteExpiresAt && new Date(item.quoteExpiresAt) < now
    );

    return {
      items,
      itemCount: items.length,
      subtotalCents: items.reduce((sum, item) => sum + item.priceCents, 0),
      currency: items[0]?.currency || 'USD',
      isLoading,
      hasExpiredQuotes,
    };
  }, [items, isLoading]);

  // Remove from cart
  const removeFromCart = useMutation({
    mutationFn: async (activityId: string) => {
      const result = await transitionBookingState(activityId, 'not_selected', 'user');
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Mark as booked (for external bookings)
  const markAsBooked = useMutation({
    mutationFn: async (params: {
      activityId: string;
      confirmationNumber: string;
      vendorName?: string;
      voucherUrl?: string;
    }) => {
      const result = await confirmBooking(
        params.activityId,
        params.confirmationNumber,
        undefined,
        params.vendorName,
        params.voucherUrl ? { voucherUrl: params.voucherUrl } : undefined
      );
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Refresh cart data
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    ...cartState,
    removeFromCart: removeFromCart.mutate,
    markAsBooked: markAsBooked.mutate,
    refresh,
    isRemoving: removeFromCart.isPending,
    isMarking: markAsBooked.isPending,
  };
}

/**
 * Format price from cents
 */
export function formatCartPrice(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
