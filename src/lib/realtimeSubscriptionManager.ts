/**
 * RealtimeSubscriptionManager
 *
 * Centralized registry for Supabase Realtime subscriptions.
 * Solves the problem where removeAllChannels() kills subscriptions
 * but React components don't re-subscribe because their useEffect
 * dependencies haven't changed.
 *
 * Usage:
 *   1. Components register their subscription factory via `register(key, factory)`
 *   2. On disconnect recovery, call `resubscribeAll()` to re-establish everything
 *   3. Components call `unregister(key)` on unmount
 *   4. A 60s health-check ping detects silent WS drops and auto-recovers
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type SubscriptionFactory = () => RealtimeChannel;

interface RegisteredSubscription {
  key: string;
  factory: SubscriptionFactory;
  channel: RealtimeChannel | null;
}

const _registry = new Map<string, RegisteredSubscription>();
let _healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let _onStaleDetected: (() => void) | null = null;
/** Track consecutive stale health checks — only alert after repeated failures */
let _consecutiveStaleChecks = 0;
const STALE_CHECK_THRESHOLD = 3; // Must be stale for 3 consecutive checks (~3 min) before alerting

/**
 * Register a realtime subscription. If a subscription with the same key
 * already exists, it is replaced (old channel removed first).
 */
export function registerSubscription(key: string, factory: SubscriptionFactory): RealtimeChannel {
  // Clean up any existing subscription with the same key
  const existing = _registry.get(key);
  if (existing?.channel) {
    try { supabase.removeChannel(existing.channel); } catch {}
  }

  const channel = factory();
  _registry.set(key, { key, factory, channel });

  // Start health check if not running
  if (!_healthCheckInterval) {
    startHealthCheck();
  }

  return channel;
}

/**
 * Unregister a subscription (call on component unmount).
 */
export function unregisterSubscription(key: string) {
  const entry = _registry.get(key);
  if (entry?.channel) {
    try { supabase.removeChannel(entry.channel); } catch {}
  }
  _registry.delete(key);

  // Stop health check if no subscriptions remain
  if (_registry.size === 0 && _healthCheckInterval) {
    clearInterval(_healthCheckInterval);
    _healthCheckInterval = null;
    _consecutiveStaleChecks = 0;
  }
}

/**
 * Re-establish ALL registered subscriptions after a connection recovery.
 * Called after removeAllChannels() + refreshSession() succeeds.
 * Returns the count of channels re-created.
 */
export function resubscribeAll(): number {
  let restored = 0;

  for (const [key, entry] of _registry) {
    try {
      // Old channel reference is already dead (removeAllChannels was called)
      const newChannel = entry.factory();
      _registry.set(key, { ...entry, channel: newChannel });
      restored++;
    } catch (err) {
      console.warn(`[RealtimeManager] Failed to resubscribe "${key}":`, err);
    }
  }

  _consecutiveStaleChecks = 0;
  console.log(`[RealtimeManager] Resubscribed ${restored}/${_registry.size} channels`);
  return restored;
}

/**
 * Set a callback that fires when the health check detects persistently stale channels.
 */
export function onStaleConnection(cb: () => void) {
  _onStaleDetected = cb;
}

/**
 * Get count of registered subscriptions (for debugging).
 */
export function getActiveSubscriptionCount(): number {
  return _registry.size;
}

/**
 * Health check: every 60s, inspect channel states. If any channel is in a
 * "closed" or "errored" state while still registered, attempt to silently
 * re-subscribe it. Only escalate to the recovery banner if auto-recovery
 * fails for multiple consecutive checks.
 */
function startHealthCheck() {
  _healthCheckInterval = setInterval(() => {
    if (_registry.size === 0) return;

    let staleCount = 0;
    let recoveredCount = 0;

    for (const [key, entry] of _registry) {
      const state = (entry.channel as any)?.state;
      if (state === 'errored' || state === 'closed') {
        staleCount++;
        // Attempt silent auto-recovery for this channel
        try {
          if (entry.channel) {
            try { supabase.removeChannel(entry.channel); } catch {}
          }
          const newChannel = entry.factory();
          _registry.set(key, { ...entry, channel: newChannel });
          recoveredCount++;
        } catch (err) {
          console.warn(`[RealtimeManager] Auto-recovery failed for "${key}":`, err);
        }
      }
    }

    if (staleCount === 0) {
      // Everything healthy — reset consecutive counter
      _consecutiveStaleChecks = 0;
      return;
    }

    if (recoveredCount === staleCount) {
      // All stale channels were recovered silently — reset counter
      console.log(`[RealtimeManager] Health check: auto-recovered ${recoveredCount} stale channel(s)`);
      _consecutiveStaleChecks = 0;
      return;
    }

    // Some channels couldn't be recovered
    _consecutiveStaleChecks++;
    console.warn(`[RealtimeManager] Health check: ${staleCount - recoveredCount} unrecoverable stale channel(s), consecutive=${_consecutiveStaleChecks}`);

    if (_consecutiveStaleChecks >= STALE_CHECK_THRESHOLD && _onStaleDetected) {
      _onStaleDetected();
      _consecutiveStaleChecks = 0; // Reset after alerting to avoid spamming
    }
  }, 60_000);
}
