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
