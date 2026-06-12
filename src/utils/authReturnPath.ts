/**
 * Auth Return Path Utility
 * Persists the user's intended destination across auth flows
 * (sign-in, sign-up, OAuth redirects) so they don't lose their place.
 */

const STORAGE_KEY = 'voyance_auth_return_path';
const DURABLE_KEY = 'voyance_auth_return_path_durable';

/**
 * Save the path the user was trying to reach before auth redirect.
 * Persists to both sessionStorage (fast, same-tab) AND localStorage
 * (survives new-tab opens, email-verification flows, etc.).
 */
export function saveReturnPath(path: string): void {
  // Don't save auth pages or admin pages as return destinations
  if (!path || 
      path === '/signin' || 
      path === '/signup' || 
      path === '/forgot-password' ||
      path.startsWith('/admin')) {
    return;
  }
  try { sessionStorage.setItem(STORAGE_KEY, path); } catch { /* unavailable */ }
  try { localStorage.setItem(DURABLE_KEY, path); } catch { /* unavailable */ }
}

/**
 * Get and clear the saved return path.
 * Checks sessionStorage first (same-tab), then falls back to localStorage
 * (cross-tab / post-verification).
 */
export function consumeReturnPath(fallback: string = '/profile'): string {
  let saved: string | null = null;
  try { saved = sessionStorage.getItem(STORAGE_KEY); } catch { /* */ }
  if (!saved) {
    try { saved = localStorage.getItem(DURABLE_KEY); } catch { /* */ }
  }
  // Clean up both stores
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* */ }
  try { localStorage.removeItem(DURABLE_KEY); } catch { /* */ }
  return saved || fallback;
}

/**
 * Clear the saved return path WITHOUT consuming it into a navigation.
 * Must run on sign-out: the durable localStorage copy otherwise survives a
 * full logout and is consumed by the NEXT account's login — landing them on a
 * trip they don't own (RLS → "Trip Not Found") or one since deleted. Same
 * shared-device hazard the invite-token clear already guards against.
 */
export function clearReturnPath(): void {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* */ }
  try { localStorage.removeItem(DURABLE_KEY); } catch { /* */ }
}

/**
 * Peek at the saved return path without consuming it
 */
export function peekReturnPath(): string | null {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY);
    if (s) return s;
  } catch { /* */ }
  try {
    return localStorage.getItem(DURABLE_KEY);
  } catch {
    return null;
  }
}
