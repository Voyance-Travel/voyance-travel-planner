/**
 * Auth Audit API Service
 * Tracks authentication events for security and analytics
 */

import { supabase } from '@/integrations/supabase/client';

export type AuthEventType = 
  | 'user_signup'
  | 'user_login'
  | 'user_logout'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'oauth_login'
  | 'session_refresh';

interface AuditLogParams {
  action: AuthEventType;
  userId?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an authentication event to the audit_logs table
 */
export async function logAuthEvent({
  action,
  userId,
  email,
  metadata = {},
}: AuditLogParams): Promise<void> {
  try {
    // Use the database function for consistent audit logging
    const { error } = await supabase.rpc('insert_audit_log', {
      p_action: action,
      p_action_type: 'auth',
      p_user_id: userId || null,
      p_actor: email || 'anonymous',
      p_target: 'auth',
      p_target_id: userId || null,
      p_metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      },
    });

    if (error) {
      console.error('[authAudit] Failed to log event:', error);
    } else {
      console.log(`[authAudit] Logged: ${action}`, { userId, email });
    }
  } catch (err) {
    // Don't throw - audit logging should never break auth flow
    console.error('[authAudit] Exception:', err);
  }
}

/**
 * Log user signup event
 */
export async function logSignup(userId: string, email: string): Promise<void> {
  await logAuthEvent({
    action: 'user_signup',
    userId,
    email,
    metadata: { method: 'email' },
  });
}

/**
 * Log user login event
 */
export async function logLogin(userId: string, email: string): Promise<void> {
  await logAuthEvent({
    action: 'user_login',
    userId,
    email,
    metadata: { method: 'email' },
  });
}

/**
 * Log OAuth login event
 */
export async function logOAuthLogin(userId: string, email: string, provider: string): Promise<void> {
  await logAuthEvent({
    action: 'oauth_login',
    userId,
    email,
    metadata: { method: 'oauth', provider },
  });
}

/**
 * Log logout event
 */
export async function logLogout(userId?: string, email?: string): Promise<void> {
  await logAuthEvent({
    action: 'user_logout',
    userId,
    email,
  });
}

/**
 * Log password reset request
 */
export async function logPasswordResetRequest(email: string): Promise<void> {
  await logAuthEvent({
    action: 'password_reset_request',
    email,
    metadata: { requested_at: new Date().toISOString() },
  });
}

/**
 * Log password reset completion
 */
export async function logPasswordResetComplete(userId: string, email?: string): Promise<void> {
  await logAuthEvent({
    action: 'password_reset_complete',
    userId,
    email,
    metadata: { completed_at: new Date().toISOString() },
  });
}

/**
 * Get auth audit logs for a user
 */
export async function getAuthLogs(userId?: string, limit = 50): Promise<{
  success: boolean;
  logs?: Array<{
    id: string;
    action: string;
    created_at: string;
    metadata: unknown;
    actor: string | null;
  }>;
  error?: string;
}> {
  try {
    let query = supabase
      .from('audit_logs')
      .select('id, action, created_at, metadata, actor')
      .eq('action_type', 'auth')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, logs: data || [] };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to fetch logs' 
    };
  }
}
