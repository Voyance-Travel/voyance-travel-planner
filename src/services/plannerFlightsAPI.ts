/**
 * Planner Flights API Service
 * 
 * Handles flight search and price lock for the trip planner.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';
export type BudgetTier = 'safe' | 'stretch' | 'splurge';
export type LockStatus = 'LOCKED' | 'EXPIRED' | 'RELEASED' | 'CAPTURED';

export interface FlightSearchInput {
  tripId: string;
  origin: string;
  destination: string;
  dates: {
    out: string;
    back?: string;
  };
  cabin?: CabinClass;
  passengers: number;
  budgetTier: BudgetTier;
}

export interface FlightPrice {
  amount: number;
  currency: string;
}

export interface FlightResult {
  id: string;
  optionId: string;
  carrier: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  duration: number;
  stops: number;
  price: FlightPrice;
  cabin: CabinClass;
  reasonCodes: string[];
  recommended: boolean;
  aircraft?: string;
  operatingCarrier?: string;
}

export interface FlightSearchResponse {
  success: boolean;
  tripId: string;
  searchId: string;
  results: FlightResult[];
  returnResults: FlightResult[];
  meta: {
    origin: string;
    destination: string;
    dates: {
      out: string;
      back?: string;
    };
    passengers: number;
    outboundResultCount: number;
    returnResultCount: number;
    totalResultCount: number;
  };
}

export interface FlightHoldInput {
  tripId: string;
  optionId: string;
  total: number;
  currency?: string;
}

export interface PriceLock {
  id: string;
  expiresAt: string;
  amount: number;
  currency: string;
  status: LockStatus;
}

export interface FlightHoldResponse {
  success: boolean;
  priceLock: PriceLock;
}

export interface PriceLockStatusResponse {
  success: boolean;
  lockId: string;
  status: LockStatus;
  expiresAt: string;
  timeRemaining: number;
  amount: number;
  currency: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  const token = localStorage.getItem('voyance_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Search flights with trip context
 */
export async function searchFlights(input: FlightSearchInput): Promise<FlightSearchResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/flights/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Search failed' }));
    throw new Error(error.error || error.message || 'Failed to search flights');
  }

  return response.json();
}

/**
 * Create price lock for selected flight
 */
export async function holdFlight(input: FlightHoldInput): Promise<FlightHoldResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/flights/hold`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Hold failed' }));
    throw new Error(error.error || error.message || 'Failed to hold flight price');
  }

  return response.json();
}

/**
 * Check price lock status
 */
export async function getPriceLockStatus(lockId: string): Promise<PriceLockStatusResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/v1/flights/hold/${lockId}/status`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to get price lock status');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useFlightSearch() {
  return useMutation({
    mutationFn: searchFlights,
  });
}

export function useHoldFlight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: holdFlight,
    onSuccess: (data) => {
      queryClient.setQueryData(['price-lock', data.priceLock.id], {
        success: true,
        ...data.priceLock,
        timeRemaining: Math.floor((new Date(data.priceLock.expiresAt).getTime() - Date.now()) / 1000),
      });
    },
  });
}

export function usePriceLockStatus(lockId: string | null) {
  return useQuery({
    queryKey: ['price-lock', lockId],
    queryFn: () => getPriceLockStatus(lockId!),
    enabled: !!lockId,
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 10000,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatFlightDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatFlightTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatFlightDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function getStopsLabel(stops: number): string {
  if (stops === 0) return 'Nonstop';
  if (stops === 1) return '1 stop';
  return `${stops} stops`;
}

export function getCabinLabel(cabin: CabinClass): string {
  const labels: Record<CabinClass, string> = {
    economy: 'Economy',
    premium_economy: 'Premium Economy',
    business: 'Business',
    first: 'First Class',
  };
  return labels[cabin];
}

export function getBudgetTierLabel(tier: BudgetTier): string {
  const labels: Record<BudgetTier, string> = {
    safe: 'Budget',
    stretch: 'Balanced',
    splurge: 'Premium',
  };
  return labels[tier];
}

export function formatPriceLockTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
  return `0:${secs.toString().padStart(2, '0')}`;
}

export function isPriceLockActive(status: LockStatus, expiresAt: string): boolean {
  return status === 'LOCKED' && new Date(expiresAt) > new Date();
}

export function getReasonCodeLabel(code: string): string {
  const labels: Record<string, string> = {
    budget_match: 'Within Budget',
    nonstop_convenience: 'Nonstop Flight',
    lowest_price: 'Best Price',
    preferred_carrier: 'Preferred Airline',
    optimal_timing: 'Best Timing',
  };
  return labels[code] || code;
}
