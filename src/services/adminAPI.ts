/**
 * Voyance Admin API Service
 * 
 * Integrates with Railway backend admin endpoints:
 * - GET /api/v1/admin/status - Get admin dashboard status
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface StripeTransaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  createdAt: string;
}

export interface AIMatch {
  id: string;
  userId: string;
  query: string;
  matchScore: number;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminStatusResponse {
  redis: string;
  queueDepth: number;
  recentStripeTxs: StripeTransaction[];
  recentAIMatches: AIMatch[];
  recentAuditLogs: AuditLogEntry[];
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
// Admin API
// ============================================================================

/**
 * Get admin dashboard status
 * Requires admin_access feature flag
 */
export async function getAdminStatus(): Promise<AdminStatusResponse> {
  try {
    const headers = await getAuthHeader();
    
    const response = await fetch(`${BACKEND_URL}/api/v1/admin/status`, {
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
    console.error('[AdminAPI] Get status error:', error);
    throw error;
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useAdminStatus() {
  return useQuery({
    queryKey: ['admin-status'],
    queryFn: getAdminStatus,
    staleTime: 30_000, // 30 seconds
    retry: 1, // Only retry once for admin endpoints
  });
}

// ============================================================================
// Export
// ============================================================================

const adminAPI = {
  getAdminStatus,
};

export default adminAPI;
