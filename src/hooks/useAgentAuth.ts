import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Shared auth guard hook for Agent CRM pages.
 * Ensures consistent auth loading behavior to prevent premature redirects.
 * 
 * @returns Object with:
 * - isReady: boolean indicating if auth check is complete and user is authenticated
 * - isLoading: boolean indicating if auth is still being checked
 */
export function useAgentAuth() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Don't do anything while auth is loading
    if (authLoading) {
      setIsReady(false);
      return;
    }
    
    // Auth finished loading - check if authenticated
    if (!isAuthenticated) {
      navigate('/signin', { replace: true });
      return;
    }
    
    // User is authenticated and ready
    setIsReady(true);
  }, [isAuthenticated, authLoading, navigate]);

  return {
    isReady,
    isLoading: authLoading,
    user,
  };
}
