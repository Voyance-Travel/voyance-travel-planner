/**
 * Voyance User Dashboard API Service
 * 
 * Integrates with Railway backend dashboard endpoints:
 * - GET /api/v1/user/dashboard - Full aggregated dashboard data
 * - GET /api/v1/user/dashboard/minimal - Lightweight quick check
 * - GET /api/v1/user/dashboard/test - Health check
 */

import { useQuery } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface DashboardCounts {
  trips: number;
  countries: number;
  daysAbroad: number;
}

export interface DashboardTrip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  status?: string;
}

export interface DashboardData {
  counts: DashboardCounts;
  lastTrip: DashboardTrip | null;
  upcomingTrip: DashboardTrip | null;
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardData;
}

export interface MinimalDashboardUser {
  id: string;
  email: string;
  name: string | null;
}

export interface MinimalDashboardResponse {
  user: MinimalDashboardUser | null;
  hasTrips: boolean;
  _meta: {
    fetchedAt: string;
    ttl: number;
  };
}

export interface DashboardTestResponse {
  success: boolean;
  message: string;
  userId: string;
  timestamp: string;
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

async function dashboardApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/user${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Dashboard API
// ============================================================================

/**
 * Get full aggregated dashboard data
 */
export async function getDashboard(): Promise<DashboardResponse> {
  return dashboardApiRequest<DashboardResponse>('/dashboard');
}

/**
 * Get minimal dashboard data for quick checks
 */
export async function getMinimalDashboard(): Promise<MinimalDashboardResponse> {
  return dashboardApiRequest<MinimalDashboardResponse>('/dashboard/minimal');
}

/**
 * Test dashboard endpoint health
 */
export async function testDashboard(): Promise<DashboardTestResponse> {
  return dashboardApiRequest<DashboardTestResponse>('/dashboard/test');
}

// ============================================================================
// React Query Hooks
// ============================================================================

const dashboardKeys = {
  all: ['user-dashboard'] as const,
  full: () => [...dashboardKeys.all, 'full'] as const,
  minimal: () => [...dashboardKeys.all, 'minimal'] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.full(),
    queryFn: getDashboard,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useMinimalDashboard() {
  return useQuery({
    queryKey: dashboardKeys.minimal(),
    queryFn: getMinimalDashboard,
    staleTime: 10 * 60_000, // 10 minutes
  });
}

// Default export
export default {
  getDashboard,
  getMinimalDashboard,
  testDashboard,
};
