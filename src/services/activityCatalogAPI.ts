/**
 * Activity Catalog API Service
 * Endpoints for searching and managing the activity catalog
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// TYPES
// ============================================================================

export interface ActivityLocation {
  lat: number;
  lng: number;
  address: string;
}

export interface CatalogActivity {
  id: string;
  destinationId: string;
  title: string;
  description?: string;
  category?: string;
  costUSD?: number;
  estimatedDurationHours?: number;
  location?: ActivityLocation;
  source?: string;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivitySearchParams {
  destinationId: string;
  query?: string;
  category?: string;
  minCost?: number;
  maxCost?: number;
  minDuration?: number;
  maxDuration?: number;
}

export interface BulkSeedActivityInput {
  title: string;
  description?: string;
  category?: string;
  costUSD?: number;
  estimatedDurationHours?: number;
  location?: ActivityLocation;
  source?: string;
  aiGenerated?: boolean;
}

export interface BulkSeedParams {
  destinationId: string;
  activities: BulkSeedActivityInput[];
}

// ============================================================================
// API HELPERS
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return { 'Content-Type': 'application/json' };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Search activities in the catalog
 */
export async function searchCatalogActivities(
  params: ActivitySearchParams
): Promise<CatalogActivity[]> {
  const queryParams = new URLSearchParams();
  
  queryParams.set('destinationId', params.destinationId);
  if (params.query) queryParams.set('query', params.query);
  if (params.category) queryParams.set('category', params.category);
  if (params.minCost !== undefined) queryParams.set('minCost', String(params.minCost));
  if (params.maxCost !== undefined) queryParams.set('maxCost', String(params.maxCost));
  if (params.minDuration !== undefined) queryParams.set('minDuration', String(params.minDuration));
  if (params.maxDuration !== undefined) queryParams.set('maxDuration', String(params.maxDuration));
  
  const response = await fetch(
    `${BACKEND_URL}/api/v1/activities/search?${queryParams.toString()}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to search activities: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get activity by ID
 */
export async function getCatalogActivity(id: string): Promise<CatalogActivity> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/activities/${id}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get activity: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.activity;
}

/**
 * Bulk seed activities for a destination (admin/AI use)
 */
export async function bulkSeedActivities(
  params: BulkSeedParams
): Promise<{ created: number; activities: CatalogActivity[] }> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/activities/bulk-seed`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to seed activities: ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Hook to search catalog activities
 */
export function useCatalogActivities(params: ActivitySearchParams | null) {
  return useQuery({
    queryKey: ['catalog-activities', params],
    queryFn: () => searchCatalogActivities(params!),
    enabled: !!params?.destinationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to search activities for a destination
 */
export function useDestinationActivities(
  destinationId: string | undefined,
  filters: Omit<ActivitySearchParams, 'destinationId'> = {}
) {
  return useQuery({
    queryKey: ['catalog-activities', destinationId, filters],
    queryFn: () => searchCatalogActivities({ destinationId: destinationId!, ...filters }),
    enabled: !!destinationId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to get a single activity
 */
export function useCatalogActivity(id: string | undefined) {
  return useQuery({
    queryKey: ['catalog-activity', id],
    queryFn: () => getCatalogActivity(id!),
    enabled: !!id,
  });
}

/**
 * Hook to bulk seed activities
 */
export function useBulkSeedActivities() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bulkSeedActivities,
    onSuccess: (data, variables) => {
      toast.success(`Created ${data.created} activities`);
      queryClient.invalidateQueries({ 
        queryKey: ['catalog-activities', variables.destinationId] 
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to seed activities');
    },
  });
}

export default {
  searchCatalogActivities,
  getCatalogActivity,
  bulkSeedActivities,
};
