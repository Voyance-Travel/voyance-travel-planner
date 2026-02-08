/**
 * Auth Return Path Utility
 * Persists the user's intended destination across auth flows
 * (sign-in, sign-up, OAuth redirects) so they don't lose their place.
 */

const STORAGE_KEY = 'voyance_auth_return_path';

/**
 * Save the path the user was trying to reach before auth redirect
 */
export function saveReturnPath(path: string): void {
  try {
    // Don't save auth pages or admin pages as return destinations
    if (path && 
        path !== '/signin' && 
        path !== '/signup' && 
        path !== '/forgot-password' &&
        !path.startsWith('/admin')) {
      sessionStorage.setItem(STORAGE_KEY, path);
    }
  } catch {
    // sessionStorage unavailable
  }
}

/**
 * Get and clear the saved return path
 */
export function consumeReturnPath(fallback: string = '/profile'): string {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      sessionStorage.removeItem(STORAGE_KEY);
      return saved;
    }
  } catch {
    // sessionStorage unavailable
  }
  return fallback;
}

/**
 * Peek at the saved return path without consuming it
 */
export function peekReturnPath(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
