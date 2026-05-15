/**
 * useReconcilingState
 *
 * Bounds the lifetime of the "Reconciling…" hint shown in the itinerary
 * header strip and the Payments tab. The hint is purely derived state —
 * snapshot vs chip-sum disagreement (header) or |paymentsTotal − headerTotal|
 * > $1 (Payments). When the underlying disagreement is real and persistent,
 * the predicate stays true forever and the hint latches on for the whole
 * session. This hook gives the indicator a defined completion condition:
 *
 *   1. While `active` is true, after RESOLVE_AFTER_MS dispatch a single
 *      silent `booking-changed` (`reason: 'reconciling-resolve-attempt'`)
 *      so the snapshot hook + cost-sync edge function get one more chance.
 *   2. If `active` is still true after TIMEOUT_MS total, return
 *      `visible: false` and log `[RECONCILING_TIMEOUT]`. The hint silently
 *      drops — better than lying indefinitely.
 *   3. If `active` flips to false at any point, reset cleanly and the next
 *      activation starts a fresh budget.
 *
 * See mem://constraints/finance/reconciling-and-delta-bounded-lifetime.
 */

import { useEffect, useRef, useState } from 'react';

const RESOLVE_AFTER_MS = 6_000;
const TIMEOUT_MS = 10_000;

export interface ReconcilingState {
  /** True while the hint should be rendered. False once the timeout fires. */
  visible: boolean;
  /** True after we've fired the one-shot resolve attempt. Telemetry only. */
  attemptedResolve: boolean;
}

interface Options {
  /** Identifies the call site for telemetry: 'header' | 'payments' | … */
  site: string;
  /** Trip context for telemetry. */
  tripId?: string | null;
  /** Optional: extra cents pair to log on timeout for forensics. */
  totalsCents?: { a: number; b: number };
}

export function useReconcilingState(active: boolean, opts: Options): ReconcilingState {
  const { site, tripId, totalsCents } = opts;
  const [visible, setVisible] = useState(false);
  const [attemptedResolve, setAttemptedResolve] = useState(false);

  // Track the most recent activation. Each new activation gets a fresh budget;
  // a flip back to inactive resets refs so the next activation starts clean.
  const activatedAtRef = useRef<number | null>(null);
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      // Reset cleanly.
      activatedAtRef.current = null;
      setVisible(false);
      setAttemptedResolve(false);
      if (resolveTimerRef.current) {
        clearTimeout(resolveTimerRef.current);
        resolveTimerRef.current = null;
      }
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
      return;
    }

    // Already armed — don't restart timers, but ensure visible is true.
    if (activatedAtRef.current != null) {
      setVisible(true);
      return;
    }

    activatedAtRef.current = Date.now();
    setVisible(true);

    resolveTimerRef.current = setTimeout(() => {
      setAttemptedResolve(true);
      // eslint-disable-next-line no-console
      console.warn(`[RECONCILING_RESOLVE_ATTEMPTED] tripId=${tripId ?? 'unknown'} site=${site}`);
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('booking-changed', {
            detail: { tripId, silent: true, reason: 'reconciling-resolve-attempt' },
          }));
        }
      } catch {
        // non-fatal — the timeout below will still drop the hint.
      }
      resolveTimerRef.current = null;
    }, RESOLVE_AFTER_MS);

    timeoutTimerRef.current = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(
        `[RECONCILING_TIMEOUT] tripId=${tripId ?? 'unknown'} site=${site}` +
        (totalsCents ? ` totalsCents={a:${totalsCents.a},b:${totalsCents.b}}` : '')
      );
      setVisible(false);
      timeoutTimerRef.current = null;
    }, TIMEOUT_MS);

    return () => {
      if (resolveTimerRef.current) {
        clearTimeout(resolveTimerRef.current);
        resolveTimerRef.current = null;
      }
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
    };
    // We intentionally do NOT depend on `totalsCents` — its identity changes
    // every render and would restart the budget. Site/tripId are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, site, tripId]);

  return { visible, attemptedResolve };
}

export default useReconcilingState;
