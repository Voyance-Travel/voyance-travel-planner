/**
 * Voyance Trips Debug API Service
 * 
 * Integrates with Railway backend debug endpoints:
 * - GET /api/v1/debug/trip-status-raw - Raw trip status values
 * - GET /api/v1/debug/trip-status-analysis - Trip status analysis
 * - GET /api/v1/debug/trips-response - Debug trips API response
 * - GET /api/v1/debug/trips-table-check - Check trips table structure
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface StatusCount {
  status: string;
  count: number;
}

export interface TripSample {
  id: string;
  status: string;
  name: string | null;
  destination: string;
  created_at: string;
  updated_at: string;
}

export interface TripStatusRawResponse {
  success: boolean;
  message: string;
  statusDistribution: StatusCount[];
  totalTrips: number;
  timestamp: string;
}

export interface TripStatusAnalysisResponse {
  success: boolean;
  statusDistribution: StatusCount[];
  sampleTrips: TripSample[];
  draftCount: number;
  upcomingCount: number;
  completedCount: number;
  categorization: {
    draft: string[];
    upcoming: string[];
    completed: string[];
    other: string[];
  };
}

export interface DebugTrip {
  id: string;
  userId: string;
  destination: string;
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  displayStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebugTripsResponseResult {
  success: boolean;
  userId: string;
  totalTrips: number;
  rawTrips: DebugTrip[];
  mappedTrips: DebugTrip[];
  statusMapping: Record<string, string>;
}

export interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export interface TripsTableCheckResponse {
  success: boolean;
  columns: TableColumn[];
  statusCounts: StatusCount[];
  recentTrips: TripSample[];
  totalColumns: number;
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

async function debugApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/debug${endpoint}`, {
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
// Debug API
// ============================================================================

/**
 * Get raw trip status values from database (no auth required)
 */
export async function getTripStatusRaw(): Promise<TripStatusRawResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/debug/trip-status-raw`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[DebugAPI] Get raw status error:', error);
    throw error;
  }
}

/**
 * Get trip status analysis (requires auth)
 */
export async function getTripStatusAnalysis(): Promise<TripStatusAnalysisResponse> {
  try {
    const response = await debugApiRequest<TripStatusAnalysisResponse>('/trip-status-analysis', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[DebugAPI] Get status analysis error:', error);
    throw error;
  }
}

/**
 * Get debug trips response (requires auth)
 */
export async function getDebugTripsResponse(): Promise<DebugTripsResponseResult> {
  try {
    const response = await debugApiRequest<DebugTripsResponseResult>('/trips-response', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[DebugAPI] Get debug trips error:', error);
    throw error;
  }
}

/**
 * Check trips table structure (no auth required)
 */
export async function getTripsTableCheck(): Promise<TripsTableCheckResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/debug/trips-table-check`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[DebugAPI] Get table check error:', error);
    throw error;
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useTripStatusRaw() {
  return useQuery({
    queryKey: ['debug-trip-status-raw'],
    queryFn: getTripStatusRaw,
    staleTime: 0, // Always fresh for debugging
  });
}

export function useTripStatusAnalysis() {
  return useQuery({
    queryKey: ['debug-trip-status-analysis'],
    queryFn: getTripStatusAnalysis,
    staleTime: 0,
  });
}

export function useDebugTripsResponse() {
  return useQuery({
    queryKey: ['debug-trips-response'],
    queryFn: getDebugTripsResponse,
    staleTime: 0,
  });
}

export function useTripsTableCheck() {
  return useQuery({
    queryKey: ['debug-trips-table-check'],
    queryFn: getTripsTableCheck,
    staleTime: 0,
  });
}

// ============================================================================
// Export
// ============================================================================

const tripsDebugAPI = {
  getTripStatusRaw,
  getTripStatusAnalysis,
  getDebugTripsResponse,
  getTripsTableCheck,
};

export default tripsDebugAPI;
