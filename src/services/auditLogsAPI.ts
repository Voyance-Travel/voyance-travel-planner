/**
 * Audit Logs API Service
 * 
 * Admin endpoint for viewing audit logs.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export interface AuditLog {
  id: string;
  actionType: string;
  actor: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogsParams {
  actionType?: string;
  actor?: string;
  targetId?: string;
  from?: string;
  to?: string;
  limit?: number;
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
 * Get audit logs (admin only)
 */
export async function getAuditLogs(params?: AuditLogsParams): Promise<AuditLog[]> {
  const headers = await getAuthHeader();
  const queryParams = new URLSearchParams();

  if (params?.actionType) queryParams.set('actionType', params.actionType);
  if (params?.actor) queryParams.set('actor', params.actor);
  if (params?.targetId) queryParams.set('targetId', params.targetId);
  if (params?.from) queryParams.set('from', params.from);
  if (params?.to) queryParams.set('to', params.to);
  if (params?.limit) queryParams.set('limit', params.limit.toString());

  const url = `${API_BASE_URL}/api/v1/audit/logs${queryParams.toString() ? `?${queryParams}` : ''}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch audit logs');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useAuditLogs(params?: AuditLogsParams) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => getAuditLogs(params),
    staleTime: 30000,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatActionType(actionType: string): string {
  return actionType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getActionTypeColor(actionType: string): string {
  if (actionType.includes('DELETE') || actionType.includes('REMOVE')) {
    return 'text-red-600';
  }
  if (actionType.includes('CREATE') || actionType.includes('ADD')) {
    return 'text-green-600';
  }
  if (actionType.includes('UPDATE') || actionType.includes('MODIFY')) {
    return 'text-blue-600';
  }
  return 'text-gray-600';
}
