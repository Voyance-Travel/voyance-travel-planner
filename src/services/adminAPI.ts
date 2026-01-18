/**
 * Voyance Admin API Service
 * 
 * Admin dashboard - now using Supabase directly.
 * Aggregates data from audit_logs and trips tables.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

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
// Admin API - Using Supabase
// ============================================================================

/**
 * Get admin dashboard status
 * Requires admin role
 */
export async function getAdminStatus(): Promise<AdminStatusResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check if user is admin
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin');

  if (!roles || roles.length === 0) {
    throw new Error('Admin access required');
  }

  // Get recent audit logs
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  const recentAuditLogs: AuditLogEntry[] = (auditLogs || []).map(log => ({
    id: log.id,
    userId: log.user_id || '',
    action: log.action,
    resource: log.target || '',
    metadata: log.metadata as Record<string, unknown> | undefined,
    createdAt: log.created_at,
  }));

  // Get trip counts as a proxy for system activity
  const { count: tripCount } = await supabase
    .from('trips')
    .select('id', { count: 'exact', head: true });

  return {
    redis: 'Not used (Lovable Cloud)',
    queueDepth: 0,
    recentStripeTxs: [], // Would need a transactions table
    recentAIMatches: [], // Would need an AI matches table
    recentAuditLogs,
  };
}

// ============================================================================
// React Query Hooks
// ============================================================================

export function useAdminStatus() {
  return useQuery({
    queryKey: ['admin-status'],
    queryFn: getAdminStatus,
    staleTime: 30_000, // 30 seconds
    retry: 1,
  });
}

// ============================================================================
// Export
// ============================================================================

const adminAPI = {
  getAdminStatus,
};

export default adminAPI;
