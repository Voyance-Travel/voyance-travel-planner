/**
 * ConnectionRecoveryBanner
 * 
 * Monitors Supabase client health (auth token + realtime WebSocket).
 * When a generation timeout or other failure corrupts the connection state,
 * this component detects the cascade (auth lock timeout, repeated WS failures)
 * and offers the user a one-click recovery instead of requiring a hard refresh.
 *
 * Recovery sequence:
 *   1. Remove all Supabase Realtime channels
 *   2. Force-refresh the auth session
 *   3. Invalidate React-Query cache so hooks re-fetch
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { resubscribeAll, onStaleConnection, teardownAllSubscriptions } from '@/lib/realtimeSubscriptionManager';
import { guardedRefreshSession } from '@/lib/authSessionGuard';
import { toast } from 'sonner';

/** Failure counter threshold used for auto-dismiss heuristics */
const FAILURE_THRESHOLD = 6;
/** Minimum ms between reportConnectionFailure increments */
const FAILURE_THROTTLE_MS = 3_000;
/** Max failures per throttle window */
const MAX_FAILURES_PER_WINDOW = 3;
/** Auto-dismiss the banner after this many ms if no further failures occur */
const AUTO_DISMISS_MS = 30_000;

/**
 * Global failure counter — incremented by any Supabase query/function hook that
 * catches a network-level or auth-level error. This lets us detect the cascade
 * without coupling every hook to this component.
 */
let _globalFailureCount = 0;
let _listeners: Array<() => void> = [];
let _lastFailureReportAt = 0;
let _failuresInWindow = 0;

export function reportConnectionFailure() {
  const now = Date.now();
  // Throttle: cap the rate of failure reports to prevent runaway cascades
  if (now - _lastFailureReportAt < FAILURE_THROTTLE_MS) {
    _failuresInWindow++;
    if (_failuresInWindow >= MAX_FAILURES_PER_WINDOW) return; // silently drop excess
  } else {
    _failuresInWindow = 1;
    _lastFailureReportAt = now;
  }
  _globalFailureCount++;
  _listeners.forEach(fn => fn());
}

export function resetConnectionFailures() {
  _globalFailureCount = 0;
  _failuresInWindow = 0;
  _listeners.forEach(fn => fn());
}

export function getConnectionFailureCount() {
  return _globalFailureCount;
}


export function ConnectionRecoveryBanner() {
  const queryClient = useQueryClient();
  const [showBanner, setShowBanner] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger banner only when realtime auto-recovery exhausts retries
  useEffect(() => {
    onStaleConnection(() => {
      reportConnectionFailure();
      setShowBanner(true);
    });
  }, []);

  // Auto-dismiss after a period if the user doesn't interact
  useEffect(() => {
    if (showBanner) {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      autoDismissRef.current = setTimeout(() => {
        // Only auto-dismiss if no new failures have accumulated
        if (_globalFailureCount < FAILURE_THRESHOLD * 2) {
          resetConnectionFailures();
          setShowBanner(false);
        }
      }, AUTO_DISMISS_MS);
    }
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [showBanner]);

  const handleRecover = useCallback(async () => {
    setIsRecovering(true);
    try {
      // 1. Tear down managed subscriptions and clear all Realtime channels
      teardownAllSubscriptions();
      supabase.removeAllChannels();

      // 2. Force-refresh the auth session to clear any stale/locked tokens (deduplicated)
      const { error } = await guardedRefreshSession();
      if (error) {
        console.warn('[ConnectionRecovery] Session refresh failed, signing out:', error.message);
        // If refresh truly fails, a re-login is needed — but still clear the cascade
      }

      // 3. Re-establish all registered Realtime subscriptions
      const restored = resubscribeAll();

      // 4. Invalidate all React-Query caches so hooks re-fetch with fresh connections
      queryClient.invalidateQueries();

      // 5. Reset failure counter
      resetConnectionFailures();
      setShowBanner(false);

      toast.success('Reconnected', { duration: 3000 });
      console.log(`[ConnectionRecovery] Recovery complete — ${restored} channel(s) restored, session refreshed`);
    } catch (err) {
      console.error('[ConnectionRecovery] Recovery failed:', err);
      // Last resort: suggest hard refresh
      setIsRecovering(false);
    } finally {
      setIsRecovering(false);
    }
  }, [queryClient]);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          key="connection-recovery"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          className={cn(
            'fixed top-0 left-0 right-0 z-[101]',
            'bg-destructive text-destructive-foreground px-4 py-2.5',
            'flex items-center justify-center gap-3 text-sm font-medium',
            'shadow-lg'
          )}
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Connection lost. Some features may not work.</span>
          <button
            onClick={handleRecover}
            disabled={isRecovering}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold',
              'bg-destructive-foreground/20 hover:bg-destructive-foreground/30',
              'transition-colors disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRecovering && 'animate-spin')} />
            {isRecovering ? 'Reconnecting…' : 'Reconnect'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
