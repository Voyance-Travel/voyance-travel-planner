import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { consumeReturnPath, peekReturnPath } from '@/utils/authReturnPath';

/**
 * Handles redirect after OAuth sign-in.
 * When a user signs in via Google OAuth, they land on "/" — 
 * this component checks for a saved return path and redirects them.
 */
export function OAuthReturnHandler() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only act once, after auth is resolved, user is authenticated,
    // and we're on the root page (OAuth redirect landing)
    if (isLoading || hasRedirected.current) return;
    if (!isAuthenticated) return;
    
    // Only redirect from the root path (where OAuth lands)
    if (location.pathname !== '/') return;
    
    const returnPath = peekReturnPath();
    if (returnPath) {
      hasRedirected.current = true;
      navigate(consumeReturnPath('/'), { replace: true });
    }
  }, [isAuthenticated, isLoading, location.pathname, navigate]);

  return null;
}
