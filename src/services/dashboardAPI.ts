/**
 * Voyance Dashboard API Service
 * 
 * Integrates with Railway backend dashboard endpoints:
 * - GET /api/v1/dashboard - Get user's saved trips and active sessions
 * - GET /api/v1/user/budget-zone - Get user's budget zone visualization
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface SavedTrip {
  sessionId: string;
  tripDetails: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSession {
  userId: string;
  sessionId: string;
  tripDetails: Record<string, unknown>;
}

export interface DashboardResponse {
  trips: SavedTrip[];
  redisCache: ActiveSession[];
}

export type BudgetZone = 'budget' | 'moderate' | 'premium' | 'luxury';

export interface BudgetZoneThreshold {
  min: number;
  max: number;
}

export interface BudgetZoneResponse {
  zone: BudgetZone;
  color: string;
  description: string;
  threshold: BudgetZoneThreshold;
}

// ============================================================================
// API Helpers
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }
  
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return { 'Content-Type': 'application/json' };
}

// ============================================================================
// Dashboard API
// ============================================================================

/**
 * Get user's dashboard data (saved trips and active sessions)
 */
export async function getDashboard(): Promise<DashboardResponse> {
  try {
    const headers = await getAuthHeader();
    
    const response = await fetch(`${BACKEND_URL}/api/v1/dashboard`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData._error || `HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[DashboardAPI] Get dashboard error:', error);
    throw error;
  }
}

/**
 * Get user's budget zone visualization
 */
export async function getBudgetZone(budget?: number): Promise<BudgetZoneResponse> {
  try {
    const headers = await getAuthHeader();
    
    const queryParams = budget ? `?budget=${budget}` : '';
    
    const response = await fetch(`${BACKEND_URL}/api/v1/user/budget-zone${queryParams}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData._error || `HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[DashboardAPI] Get budget zone error:', error);
    throw error;
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 60_000, // 1 minute
  });
}

export function useBudgetZone(budget?: number) {
  return useQuery({
    queryKey: ['budget-zone', budget],
    queryFn: () => getBudgetZone(budget),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getBudgetZoneColor(zone: BudgetZone): string {
  switch (zone) {
    case 'budget': return 'bg-green-500';
    case 'moderate': return 'bg-blue-500';
    case 'premium': return 'bg-purple-500';
    case 'luxury': return 'bg-amber-500';
    default: return 'bg-muted';
  }
}

export function getBudgetZoneLabel(zone: BudgetZone): string {
  switch (zone) {
    case 'budget': return 'Budget Traveler';
    case 'moderate': return 'Moderate Spender';
    case 'premium': return 'Premium Traveler';
    case 'luxury': return 'Luxury Explorer';
    default: return 'Unknown';
  }
}

// ============================================================================
// Export
// ============================================================================

const dashboardAPI = {
  getDashboard,
  getBudgetZone,
  getBudgetZoneColor,
  getBudgetZoneLabel,
};

export default dashboardAPI;
