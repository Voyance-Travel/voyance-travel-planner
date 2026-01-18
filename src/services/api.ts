/**
 * Unified API Client - All backend calls go through Supabase
 */

import { supabase } from '@/integrations/supabase/client';

// Environment configuration
export const API_CONFIG = {
  timeout: 30000,
  useMockData: import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_DATA === 'true',
} as const;

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// Error Handling
// ============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============================================================================
// Edge Function Invoker
// ============================================================================

export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: body || {},
  });
  
  if (error) {
    console.error(`[${functionName}] Edge function error:`, error);
    throw new ApiError(error.message || 'Edge function failed', 500);
  }
  
  return data as T;
}

// ============================================================================
// Auth Header Helper
// ============================================================================

export async function getAuthHeader(): Promise<Record<string, string>> {
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
// Utility Functions
// ============================================================================

export function handleApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

// ============================================================================
// Export Supabase client for convenience
// ============================================================================

export { supabase } from '@/integrations/supabase/client';
