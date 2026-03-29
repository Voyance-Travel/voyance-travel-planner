/**
 * Shared helper to persist client-side errors to the client_errors table.
 * Used by both useErrorTracker (window errors) and ErrorBoundary (React render crashes).
 */
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

/**
 * Extract the deepest (first) component name from a React componentStack string.
 * e.g. "\n    at MyComponent (src/...)" → "MyComponent"
 */
export function extractFailingComponent(componentStack?: string): string | null {
  if (!componentStack) return null;
  const match = componentStack.match(/^\s*at\s+(\w+)/m);
  return match?.[1] ?? null;
}

export async function logClientError(
  errorMessage: string,
  stackTrace?: string,
  componentName?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const userId = await getUserId();

    await supabase.from('client_errors').insert([{
      user_id: userId,
      session_id: getSessionId(),
      error_message: errorMessage.slice(0, 2000),
      stack_trace: stackTrace?.slice(0, 5000) || null,
      page_path: window.location.pathname,
      component_name: componentName || null,
      metadata: metadata || {},
    } as any]);
  } catch {
    // Swallow - logging should never crash the app
  }
}
