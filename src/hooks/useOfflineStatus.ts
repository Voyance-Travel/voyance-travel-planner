/**
 * Offline Status Hook
 * Tracks network connectivity and provides offline state
 */

import { useState, useEffect, useCallback } from 'react';

export interface OfflineState {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
}

export function useOfflineStatus() {
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    lastOnlineAt: null,
  });

  const handleOnline = useCallback(() => {
    setState(prev => ({
      isOnline: true,
      wasOffline: true,
      lastOnlineAt: new Date(),
    }));
  }, []);

  const handleOffline = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOnline: false,
    }));
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Clear the "wasOffline" reconnection banner after 5s
  useEffect(() => {
    if (state.wasOffline && state.isOnline) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, wasOffline: false }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.wasOffline, state.isOnline]);

  return state;
}
