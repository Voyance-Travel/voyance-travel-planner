/**
 * Voyance Transport API Service
 * 
 * Integrates with Railway backend transport endpoints:
 * - GET /transport/:destinationId/options - Get transport options for a destination
 */

import { useQuery } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export type TransportModeType = 
  | 'walking'
  | 'driving'
  | 'public_transport'
  | 'taxi'
  | 'bike'
  | 'metro'
  | 'bus'
  | 'tram'
  | 'ferry'
  | 'cable_car'
  | 'rickshaw'
  | 'scooter'
  | 'other';

export interface TransportOptionsResponse {
  destinationId: string;
  city: string;
  country: string;
  transportModes: TransportModeType[];
  isDefault: boolean;
}

// ============================================================================
// API Helpers
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  return { 'Content-Type': 'application/json' };
}

async function transportApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/transport${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData._error || errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Transport API
// ============================================================================

/**
 * Get transport options available for a destination
 */
export async function getTransportOptions(destinationId: string): Promise<TransportOptionsResponse> {
  return transportApiRequest<TransportOptionsResponse>(`/${destinationId}/options`);
}

/**
 * Get transport mode display name
 */
export function getTransportModeLabel(mode: TransportModeType): string {
  const labels: Record<TransportModeType, string> = {
    walking: 'Walking',
    driving: 'Driving',
    public_transport: 'Public Transport',
    taxi: 'Taxi/Rideshare',
    bike: 'Bicycle',
    metro: 'Metro/Subway',
    bus: 'Bus',
    tram: 'Tram',
    ferry: 'Ferry',
    cable_car: 'Cable Car',
    rickshaw: 'Rickshaw',
    scooter: 'Scooter',
    other: 'Other',
  };
  return labels[mode] || mode;
}

/**
 * Get transport mode icon name (for lucide-react)
 */
export function getTransportModeIcon(mode: TransportModeType): string {
  const icons: Record<TransportModeType, string> = {
    walking: 'Footprints',
    driving: 'Car',
    public_transport: 'Bus',
    taxi: 'CarTaxiFront',
    bike: 'Bike',
    metro: 'Train',
    bus: 'Bus',
    tram: 'Tram',
    ferry: 'Ship',
    cable_car: 'CableCar',
    rickshaw: 'Bike',
    scooter: 'Bike',
    other: 'Navigation',
  };
  return icons[mode] || 'Navigation';
}

// ============================================================================
// React Query Hooks
// ============================================================================

const transportKeys = {
  all: ['transport'] as const,
  options: (destinationId: string) => [...transportKeys.all, 'options', destinationId] as const,
};

export function useTransportOptions(destinationId: string | null) {
  return useQuery({
    queryKey: transportKeys.options(destinationId || ''),
    queryFn: () => destinationId ? getTransportOptions(destinationId) : Promise.reject('No destination ID'),
    enabled: !!destinationId,
    staleTime: 30 * 60_000, // 30 minutes - this data rarely changes
  });
}

// Default export
export default {
  getTransportOptions,
  getTransportModeLabel,
  getTransportModeIcon,
};
