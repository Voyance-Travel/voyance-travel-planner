/**
 * useFirstUseHint — fires a one-time hint for a feature key.
 * Persists to localStorage (fast) + Supabase onboarding_state JSONB (durable).
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOnboardingState, mergeOnboardingState } from '@/utils/onboardingState';

const LS_PREFIX = 'voyance_hint_';

export function useFirstUseHint(key: string): {
  shouldShow: boolean;
  dismiss: () => void;
} {
  const [shouldShow, setShouldShow] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // Fast path: already dismissed in localStorage
    if (localStorage.getItem(`${LS_PREFIX}${key}`) === 'true') return;

    // Slow path: check DB
    (async () => {
      const state = await fetchOnboardingState(user.id);
      if (cancelled) return;

      if ((state as Record<string, unknown>)[key]) {
        localStorage.setItem(`${LS_PREFIX}${key}`, 'true');
        return;
      }

      setShouldShow(true);
    })();

    return () => { cancelled = true; };
  }, [user, key]);

  const dismiss = useCallback(() => {
    setShouldShow(false);
    localStorage.setItem(`${LS_PREFIX}${key}`, 'true');

    if (user?.id) {
      mergeOnboardingState(user.id, { [key]: true } as any);
    }
  }, [key, user]);

  return { shouldShow, dismiss };
}
