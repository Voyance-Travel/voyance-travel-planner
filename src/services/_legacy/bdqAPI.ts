/**
 * Voyance Background Discovery Queue (BDQ) API Service
 * 
 * Integrates with Railway backend BDQ admin endpoints:
 * - GET /api/v1/bdq/jobs - List jobs with filtering
 * - POST /api/v1/bdq/jobs - Create a new job
 * - GET /api/v1/bdq/jobs/:id - Get job details
 * - DELETE /api/v1/bdq/jobs/:id - Cancel a job
 * - GET /api/v1/bdq/stats - Get queue statistics
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export type JobStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';
export type JobType = 'PREFETCH' | 'RECO' | 'CACHE_WARM';

export interface BDQJob {
  id: string;
  jobType: JobType;
  targetId: string;
  status: JobStatus;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ListJobsParams {
  status?: JobStatus;
  limit?: number;
  offset?: number;
}

export interface ListJobsResponse {
  success: boolean;
  jobs: BDQJob[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateJobInput {
  jobType: JobType;
  targetId: string;
  payload?: Record<string, unknown>;
}

export interface CreateJobResponse {
  success: boolean;
  job?: BDQJob;
  error?: string;
}

export interface JobDetailsResponse {
  success: boolean;
  job?: BDQJob;
  error?: string;
}

export interface CancelJobResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface QueueStats {
  pending: number;
  inProgress: number;
  done: number;
  failed: number;
  total: number;
}

export interface QueueStatsResponse {
  success: boolean;
  stats?: QueueStats;
  error?: string;
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

async function bdqApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/bdq${endpoint}`, {
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
// BDQ API
// ============================================================================

/**
 * List BDQ jobs with optional filtering
 */
export async function listBDQJobs(params: ListJobsParams = {}): Promise<ListJobsResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());
    
    const queryString = queryParams.toString();
    const endpoint = `/jobs${queryString ? `?${queryString}` : ''}`;
    
    const response = await bdqApiRequest<ListJobsResponse>(endpoint, {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[BDQAPI] List jobs error:', error);
    return {
      success: false,
      jobs: [],
      total: 0,
      limit: params.limit || 50,
      offset: params.offset || 0,
    };
  }
}

/**
 * Create a new BDQ job
 */
export async function createBDQJob(input: CreateJobInput): Promise<CreateJobResponse> {
  try {
    const response = await bdqApiRequest<CreateJobResponse>('/jobs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response;
  } catch (error) {
    console.error('[BDQAPI] Create job error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create job',
    };
  }
}

/**
 * Get BDQ job details
 */
export async function getBDQJob(jobId: string): Promise<JobDetailsResponse> {
  try {
    const response = await bdqApiRequest<JobDetailsResponse>(`/jobs/${jobId}`, {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[BDQAPI] Get job error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job',
    };
  }
}

/**
 * Cancel a BDQ job
 */
export async function cancelBDQJob(jobId: string): Promise<CancelJobResponse> {
  try {
    const response = await bdqApiRequest<CancelJobResponse>(`/jobs/${jobId}`, {
      method: 'DELETE',
    });
    return response;
  } catch (error) {
    console.error('[BDQAPI] Cancel job error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel job',
    };
  }
}

/**
 * Get BDQ queue statistics
 */
export async function getBDQStats(): Promise<QueueStatsResponse> {
  try {
    const response = await bdqApiRequest<QueueStatsResponse>('/stats', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[BDQAPI] Get stats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useBDQJobs(params: ListJobsParams = {}) {
  return useQuery({
    queryKey: ['bdq-jobs', params],
    queryFn: () => listBDQJobs(params),
    staleTime: 10_000, // 10 seconds
    refetchInterval: 30_000, // Auto refresh every 30 seconds
  });
}

export function useBDQJob(jobId: string | null) {
  return useQuery({
    queryKey: ['bdq-job', jobId],
    queryFn: () => jobId ? getBDQJob(jobId) : Promise.reject('No job ID'),
    enabled: !!jobId,
    staleTime: 5_000,
    refetchInterval: (query) => {
      // Poll more frequently for in-progress jobs
      const data = query.state.data;
      if (data?.job?.status === 'IN_PROGRESS' || data?.job?.status === 'PENDING') {
        return 5_000;
      }
      return false;
    },
  });
}

export function useBDQStats() {
  return useQuery({
    queryKey: ['bdq-stats'],
    queryFn: getBDQStats,
    staleTime: 30_000,
  });
}

export function useCreateBDQJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createBDQJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdq-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['bdq-stats'] });
    },
  });
}

export function useCancelBDQJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: cancelBDQJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdq-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['bdq-stats'] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const bdqAPI = {
  listBDQJobs,
  createBDQJob,
  getBDQJob,
  cancelBDQJob,
  getBDQStats,
};

export default bdqAPI;
