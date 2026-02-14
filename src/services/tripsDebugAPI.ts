/**
 * Voyance Trips Debug API Service
 * 
 * Uses Supabase directly for trip debugging.
 */

import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/utils/dateUtils';
import { useQuery } from '@tanstack/react-query';

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
// Debug API using Supabase directly
// ============================================================================

/**
 * Get raw trip status values from database
 */
export async function getTripStatusRaw(): Promise<TripStatusRawResponse> {
  const { data: trips, error } = await supabase
    .from('trips')
    .select('status');
  
  if (error) {
    throw new Error(error.message);
  }
  
  // Count status distribution
  const statusMap = new Map<string, number>();
  (trips || []).forEach(trip => {
    const status = trip.status || 'unknown';
    statusMap.set(status, (statusMap.get(status) || 0) + 1);
  });
  
  const statusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));
  
  return {
    success: true,
    message: 'Status distribution retrieved',
    statusDistribution,
    totalTrips: trips?.length || 0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get trip status analysis for current user
 */
export async function getTripStatusAnalysis(): Promise<TripStatusAnalysisResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, status, name, destination, start_date, end_date, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(error.message);
  }
  
  const now = new Date();
  const categorization = {
    draft: [] as string[],
    upcoming: [] as string[],
    completed: [] as string[],
    other: [] as string[],
  };
  
  const statusMap = new Map<string, number>();
  
  (trips || []).forEach(trip => {
    const status = trip.status || 'unknown';
    statusMap.set(status, (statusMap.get(status) || 0) + 1);
    
    if (status === 'draft') {
      categorization.draft.push(trip.id);
    } else if (status === 'completed') {
      categorization.completed.push(trip.id);
    } else if (trip.start_date && parseLocalDate(trip.start_date) > now) {
      categorization.upcoming.push(trip.id);
    } else {
      categorization.other.push(trip.id);
    }
  });
  
  const statusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));
  
  return {
    success: true,
    statusDistribution,
    sampleTrips: (trips || []).slice(0, 10).map(t => ({
      id: t.id,
      status: t.status,
      name: t.name,
      destination: t.destination,
      created_at: t.created_at,
      updated_at: t.updated_at,
    })),
    draftCount: categorization.draft.length,
    upcomingCount: categorization.upcoming.length,
    completedCount: categorization.completed.length,
    categorization,
  };
}

/**
 * Get debug trips response for current user
 */
export async function getDebugTripsResponse(): Promise<DebugTripsResponseResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data: trips, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(error.message);
  }
  
  const statusMapping: Record<string, string> = {
    draft: 'Draft',
    planning: 'Planning',
    booked: 'Booked',
    active: 'Active',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  
  const mappedTrips = (trips || []).map(trip => ({
    id: trip.id,
    userId: trip.user_id,
    destination: trip.destination,
    name: trip.name,
    startDate: trip.start_date,
    endDate: trip.end_date,
    status: trip.status,
    displayStatus: statusMapping[trip.status] || trip.status,
    createdAt: trip.created_at,
    updatedAt: trip.updated_at,
  }));
  
  return {
    success: true,
    userId: user.id,
    totalTrips: trips?.length || 0,
    rawTrips: mappedTrips,
    mappedTrips,
    statusMapping,
  };
}

/**
 * Check trips table structure - returns column info
 */
export async function getTripsTableCheck(): Promise<TripsTableCheckResponse> {
  // Get sample trips and status counts
  const [tripsResult, statusResult] = await Promise.all([
    supabase.from('trips').select('id, status, name, destination, created_at, updated_at').limit(5),
    supabase.from('trips').select('status'),
  ]);
  
  const statusMap = new Map<string, number>();
  (statusResult.data || []).forEach(trip => {
    const status = trip.status || 'unknown';
    statusMap.set(status, (statusMap.get(status) || 0) + 1);
  });
  
  // Note: We can't query information_schema directly, so we list known columns
  const knownColumns: TableColumn[] = [
    { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
    { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO' },
    { column_name: 'name', data_type: 'text', is_nullable: 'NO' },
    { column_name: 'destination', data_type: 'text', is_nullable: 'NO' },
    { column_name: 'start_date', data_type: 'date', is_nullable: 'NO' },
    { column_name: 'end_date', data_type: 'date', is_nullable: 'NO' },
    { column_name: 'status', data_type: 'trip_status', is_nullable: 'NO' },
    { column_name: 'created_at', data_type: 'timestamptz', is_nullable: 'NO' },
    { column_name: 'updated_at', data_type: 'timestamptz', is_nullable: 'NO' },
  ];
  
  return {
    success: true,
    columns: knownColumns,
    statusCounts: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    recentTrips: (tripsResult.data || []).map(t => ({
      id: t.id,
      status: t.status,
      name: t.name,
      destination: t.destination,
      created_at: t.created_at,
      updated_at: t.updated_at,
    })),
    totalColumns: knownColumns.length,
  };
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useTripStatusRaw() {
  return useQuery({
    queryKey: ['debug-trip-status-raw'],
    queryFn: getTripStatusRaw,
    staleTime: 0,
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
