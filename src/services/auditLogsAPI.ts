/**
 * Audit Logs API Service
 * 
 * Uses Supabase audit_logs table directly.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

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

/**
 * Get audit logs from Supabase
 */
export async function getAuditLogs(params?: AuditLogsParams): Promise<AuditLog[]> {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (params?.actionType) {
    query = query.eq('action_type', params.actionType);
  }
  if (params?.actor) {
    query = query.eq('actor', params.actor);
  }
  if (params?.targetId) {
    query = query.eq('target_id', params.targetId);
  }
  if (params?.from) {
    query = query.gte('created_at', params.from);
  }
  if (params?.to) {
    query = query.lte('created_at', params.to);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  } else {
    query = query.limit(100);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Failed to fetch audit logs');
  }

  return (data || []).map(log => ({
    id: log.id,
    actionType: log.action_type || log.action,
    actor: log.actor || 'system',
    targetId: log.target_id || undefined,
    metadata: log.metadata as Record<string, unknown> | undefined,
    createdAt: log.created_at,
  }));
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
