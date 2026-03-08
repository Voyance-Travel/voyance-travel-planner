import { useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { consumeReturnPath, peekReturnPath } from '@/utils/authReturnPath';
import { consumePendingInviteToken, extractInviteTokenFromPath } from '@/utils/inviteTokenPersistence';

/**
 * Handles redirect after OAuth sign-in.
 * Recovers invite tokens from URL params, return path, or persisted storage
 * and redirects to /invite/{token} to complete acceptance.
 * 
 * IMPORTANT: Only processes invite tokens when there's evidence of a real auth return
 * (URL param, or saved return path). Stale durable tokens alone are NOT enough to
 * trigger a redirect — this prevents the "haunted invite" loop where a persisted
 * token keeps redirecting the user on every homepage visit.
 */
export function OAuthReturnHandler() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading || hasRedirected.current) return;
    if (!isAuthenticated) return;
    
    // Only redirect from the root path (where OAuth lands)
    if (location.pathname !== '/') return;
    
    // Priority 1: inviteToken URL param (explicit — always trust)
    const urlInviteToken = searchParams.get('inviteToken');
    if (urlInviteToken) {
      hasRedirected.current = true;
      navigate(`/invite/${urlInviteToken}`, { replace: true });
      return;
    }

    // Priority 2: token extracted from saved return path (explicit — always trust)
    const returnPath = peekReturnPath();
    const pathToken = extractInviteTokenFromPath(returnPath);
    if (pathToken) {
      hasRedirected.current = true;
      consumeReturnPath('/');
      navigate(`/invite/${pathToken}`, { replace: true });
      return;
    }

    // Priority 3: persisted invite token — ONLY if there's a saved return path
    // (indicating we're returning from an auth flow, not just visiting the homepage).
    // Without this guard, stale durable tokens cause infinite redirect loops.
    if (returnPath) {
      const persistedToken = consumePendingInviteToken();
      if (persistedToken) {
        hasRedirected.current = true;
        consumeReturnPath('/');
        navigate(`/invite/${persistedToken}`, { replace: true });
        return;
      }
    }

    // No invite token — fall back to normal return path behavior
    if (returnPath) {
      hasRedirected.current = true;
      navigate(consumeReturnPath('/'), { replace: true });
    }
  }, [isAuthenticated, isLoading, location.pathname, navigate, searchParams]);

  return null;
}
