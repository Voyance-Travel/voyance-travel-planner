import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SESSION_KEY = 'voy_session_id';

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function logError(errorMessage: string, stackTrace?: string, componentName?: string, metadata?: Record<string, unknown>) {
  const userId = await getUserId();
  
  supabase.from('client_errors').insert([{
    user_id: userId,
    session_id: getSessionId(),
    error_message: errorMessage.slice(0, 2000),
    stack_trace: stackTrace?.slice(0, 5000) || null,
    page_path: window.location.pathname,
    component_name: componentName || null,
    metadata: metadata || {},
  } as any]).then();
}

/**
 * Captures unhandled errors and promise rejections, writes them to client_errors table.
 * Mount once in App.tsx alongside useAnalyticsTracker.
 */
export function useErrorTracker() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Skip browser extension errors
      if (event.filename && !event.filename.includes(window.location.origin)) return;
      
      logError(
        event.message || 'Unknown error',
        event.error?.stack,
        undefined,
        { filename: event.filename, lineno: event.lineno, colno: event.colno }
      );
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason || 'Unhandled rejection');
      const stack = event.reason instanceof Error ? event.reason.stack : undefined;
      
      // Skip browser extension errors
      if (msg.includes('message channel closed') || msg.includes('message port closed')) return;
      
      logError(msg, stack, undefined, { type: 'unhandled_rejection' });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
}
