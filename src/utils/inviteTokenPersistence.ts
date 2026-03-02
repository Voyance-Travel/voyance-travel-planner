/**
 * Invite Token Persistence
 * Stores a pending invite token in BOTH sessionStorage and localStorage
 * so it survives OAuth redirects, email verification, and new-tab flows.
 */

const SESSION_KEY = 'voyance_pending_invite_token';
const DURABLE_KEY = 'voyance_pending_invite_token_durable';

/** Save invite token to both session and local storage */
export function savePendingInviteToken(token: string): void {
  if (!token) return;
  try { sessionStorage.setItem(SESSION_KEY, token); } catch { /* */ }
  try { localStorage.setItem(DURABLE_KEY, token); } catch { /* */ }
}

/** Peek at the stored invite token without consuming it */
export function peekPendingInviteToken(): string | null {
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    if (s) return s;
  } catch { /* */ }
  try {
    return localStorage.getItem(DURABLE_KEY);
  } catch {
    return null;
  }
}

/** Read and clear the stored invite token */
export function consumePendingInviteToken(): string | null {
  let token: string | null = null;
  try { token = sessionStorage.getItem(SESSION_KEY); } catch { /* */ }
  if (!token) {
    try { token = localStorage.getItem(DURABLE_KEY); } catch { /* */ }
  }
  clearPendingInviteToken();
  return token;
}

/** Clear invite token from both storages */
export function clearPendingInviteToken(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* */ }
  try { localStorage.removeItem(DURABLE_KEY); } catch { /* */ }
}

/** Extract invite token from a path like /invite/{token} */
export function extractInviteTokenFromPath(path: string | null): string | null {
  if (!path) return null;
  const match = path.match(/\/invite\/([^/?#]+)/);
  return match ? match[1] : null;
}
