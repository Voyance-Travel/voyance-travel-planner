/**
 * Auth Audit API Service
 * Tracks authentication events for security and analytics
 * Uses the secure insert_user_audit_log function that determines user_id server-side
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
  metadata?: Record<string, unknown>;
}

/**
 * Log an authentication event to the audit_logs table
 * Uses the secure insert_user_audit_log function that gets user_id from auth.uid()
 * This prevents user_id spoofing since the server determines the user identity
 */
export async function logAuthEvent({
  action,
  metadata = {},
}: AuditLogParams): Promise<void> {
  try {
    // Use the secure database function that determines user_id server-side
    // This prevents any possibility of user_id spoofing
    const { error } = await supabase.rpc('insert_user_audit_log', {
      p_action: action,
      p_action_type: 'auth',
      p_target: 'auth',
      p_metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      },
    });

    if (error) {
      // Log but don't throw - audit logging should never break auth flow
      // Note: This may fail for unauthenticated events (signup, password reset request)
      // which is expected behavior for security
      console.debug('[authAudit] Could not log event (may be expected for unauthenticated actions):', action);
    }
  } catch (err) {
    // Don't throw - audit logging should never break auth flow
    console.debug('[authAudit] Exception (non-critical):', err);
  }
}

/**
 * Log user signup event
 * Note: This may not log if called before user is fully authenticated
 */
export async function logSignup(): Promise<void> {
  await logAuthEvent({
    action: 'user_signup',
    metadata: { method: 'email' },
  });
}

/**
 * Log user login event
 */
export async function logLogin(): Promise<void> {
  await logAuthEvent({
    action: 'user_login',
    metadata: { method: 'email' },
  });
}

/**
 * Log OAuth login event
 */
export async function logOAuthLogin(provider: string): Promise<void> {
  await logAuthEvent({
    action: 'oauth_login',
    metadata: { method: 'oauth', provider },
  });
}

/**
 * Log logout event
 */
export async function logLogout(): Promise<void> {
  await logAuthEvent({
    action: 'user_logout',
  });
}

/**
 * Log password reset request
 * Note: This typically won't log since user isn't authenticated
 */
export async function logPasswordResetRequest(): Promise<void> {
  await logAuthEvent({
    action: 'password_reset_request',
    metadata: { requested_at: new Date().toISOString() },
  });
}

/**
 * Log password reset completion
 */
export async function logPasswordResetComplete(): Promise<void> {
  await logAuthEvent({
    action: 'password_reset_complete',
    metadata: { completed_at: new Date().toISOString() },
  });
}

/**
 * Get auth audit logs for the current user
 */
export async function getAuthLogs(limit = 50): Promise<{
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
    // RLS ensures users can only see their own logs
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, action, created_at, metadata, actor')
      .eq('action_type', 'auth')
      .order('created_at', { ascending: false })
      .limit(limit);

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
