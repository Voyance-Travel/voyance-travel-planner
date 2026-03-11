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
 *   4. A fast health-check loop retries disconnects with exponential backoff
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type SubscriptionFactory = () => RealtimeChannel;

interface RegisteredSubscription {
  key: string;
  factory: SubscriptionFactory;
  channel: RealtimeChannel | null;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  disconnectedAt: number | null;
  reconnecting: boolean;
  hasEscalated: boolean;
}

const _registry = new Map<string, RegisteredSubscription>();
let _healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let _onStaleDetected: (() => void) | null = null;

const HEALTH_CHECK_INTERVAL_MS = 1_000;
const BRIEF_DISCONNECT_MS = 30_000;
const MAX_RETRY_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 500;

function isStaleState(state: string | undefined): boolean {
  const normalized = (state || '').toLowerCase();
  return normalized === 'errored' || normalized === 'closed' || normalized === 'timed out';
}

function clearReconnectTimer(entry: RegisteredSubscription) {
  if (entry.reconnectTimer) {
    clearTimeout(entry.reconnectTimer);
  }
}

function resetRecoveryState(key: string, entry: RegisteredSubscription) {
  clearReconnectTimer(entry);
  _registry.set(key, {
    ...entry,
    reconnectAttempts: 0,
    reconnectTimer: null,
    disconnectedAt: null,
    reconnecting: false,
    hasEscalated: false,
  });
}

function scheduleReconnect(key: string, entry: RegisteredSubscription) {
  if (entry.reconnecting || entry.reconnectAttempts >= MAX_RETRY_ATTEMPTS) return;

  const nextAttempt = entry.reconnectAttempts + 1;
  const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, nextAttempt - 1);

  const timer = setTimeout(() => {
    const current = _registry.get(key);
    if (!current) return;

    const attempt = current.reconnectAttempts + 1;

    try {
      if (current.channel) {
        try { supabase.removeChannel(current.channel); } catch {}
      }

      const newChannel = current.factory();
      _registry.set(key, {
        ...current,
        channel: newChannel,
        reconnectAttempts: attempt,
        reconnectTimer: null,
        reconnecting: false,
      });

      console.log(`[RealtimeManager] Reconnect attempt ${attempt}/${MAX_RETRY_ATTEMPTS} for "${key}"`);
    } catch (err) {
      _registry.set(key, {
        ...current,
        reconnectAttempts: attempt,
        reconnectTimer: null,
        reconnecting: false,
      });

      console.warn(`[RealtimeManager] Reconnect attempt ${attempt}/${MAX_RETRY_ATTEMPTS} failed for "${key}":`, err);
    }
  }, delay);

  _registry.set(key, {
    ...entry,
    reconnecting: true,
    reconnectTimer: timer,
  });
}

/**
 * Register a realtime subscription. If a subscription with the same key
 * already exists, it is replaced (old channel removed first).
 */
export function registerSubscription(key: string, factory: SubscriptionFactory): RealtimeChannel {
  const existing = _registry.get(key);
  if (existing) {
    clearReconnectTimer(existing);
    if (existing.channel) {
      try { supabase.removeChannel(existing.channel); } catch {}
    }
  }

  const channel = factory();
  _registry.set(key, {
    key,
    factory,
    channel,
    reconnectAttempts: 0,
    reconnectTimer: null,
    disconnectedAt: null,
    reconnecting: false,
    hasEscalated: false,
  });

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
  if (entry) {
    clearReconnectTimer(entry);
    if (entry.channel) {
      try { supabase.removeChannel(entry.channel); } catch {}
    }
  }

  _registry.delete(key);

  if (_registry.size === 0 && _healthCheckInterval) {
    clearInterval(_healthCheckInterval);
    _healthCheckInterval = null;
  }
}

/**
 * Tear down all current channels while keeping factories so they can be re-established.
 */
export function teardownAllSubscriptions(): number {
  let removed = 0;

  for (const [key, entry] of _registry) {
    clearReconnectTimer(entry);
    if (entry.channel) {
      try { supabase.removeChannel(entry.channel); } catch {}
      removed++;
    }

    _registry.set(key, {
      ...entry,
      channel: null,
      reconnectAttempts: 0,
      reconnectTimer: null,
      disconnectedAt: null,
      reconnecting: false,
      hasEscalated: false,
    });
  }

  return removed;
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
      clearReconnectTimer(entry);
      if (entry.channel) {
        try { supabase.removeChannel(entry.channel); } catch {}
      }

      const newChannel = entry.factory();
      _registry.set(key, {
        ...entry,
        channel: newChannel,
        reconnectAttempts: 0,
        reconnectTimer: null,
        disconnectedAt: null,
        reconnecting: false,
        hasEscalated: false,
      });
      restored++;
    } catch (err) {
      console.warn(`[RealtimeManager] Failed to resubscribe "${key}":`, err);
    }
  }

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
 * Health check: inspects channel states every second.
 * - Auto-retries disconnects with exponential backoff (3 attempts)
 * - Treats disconnects under 5s as transient and silent
 * - Escalates only after retries are exhausted and disconnect persists
 */
function startHealthCheck() {
  _healthCheckInterval = setInterval(() => {
    if (_registry.size === 0) return;

    const now = Date.now();
    let shouldEscalate = false;

    for (const [key, entry] of _registry) {
      const state = (entry.channel as any)?.state as string | undefined;
      const stale = isStaleState(state);

      if (!stale) {
        if (
          entry.disconnectedAt !== null ||
          entry.reconnectAttempts > 0 ||
          entry.reconnecting ||
          entry.hasEscalated ||
          entry.reconnectTimer
        ) {
          resetRecoveryState(key, entry);
        }
        continue;
      }

      const withDisconnectStart = entry.disconnectedAt === null
        ? { ...entry, disconnectedAt: now }
        : entry;

      if (withDisconnectStart !== entry) {
        _registry.set(key, withDisconnectStart);
      }

      if (!withDisconnectStart.reconnecting && withDisconnectStart.reconnectAttempts < MAX_RETRY_ATTEMPTS) {
        scheduleReconnect(key, withDisconnectStart);
      }

      const latest = _registry.get(key) || withDisconnectStart;
      const elapsed = now - (latest.disconnectedAt || now);
      const retriesExhausted = latest.reconnectAttempts >= MAX_RETRY_ATTEMPTS;

      if (retriesExhausted && elapsed >= BRIEF_DISCONNECT_MS && !latest.hasEscalated) {
        _registry.set(key, { ...latest, hasEscalated: true });
        shouldEscalate = true;
        console.warn(
          `[RealtimeManager] "${key}" remained disconnected for ${elapsed}ms after ${MAX_RETRY_ATTEMPTS} retries`
        );
      }
    }

    if (shouldEscalate && _onStaleDetected) {
      _onStaleDetected();
    }
  }, HEALTH_CHECK_INTERVAL_MS);
}
