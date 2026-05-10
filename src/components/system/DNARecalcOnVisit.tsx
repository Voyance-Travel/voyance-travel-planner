import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { recalculateIfNeeded } from '@/services/engines/travelDNA/recalculateArchetype';
import { toast } from 'sonner';

/**
 * Mounts inside AuthProvider. When a user is signed in, runs the one-shot
 * `recalculateIfNeeded` exactly once per session per user. If the user's
 * primary archetype shifted, shows a soft toast.
 *
 * Background trigger only — never blocks the UI.
 */
export default function DNARecalcOnVisit() {
  const { user } = useAuth();
  const ranForRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    if (ranForRef.current === userId) return;
    ranForRef.current = userId;

    let cancelled = false;
    void (async () => {
      try {
        const result = await recalculateIfNeeded(userId);
        if (cancelled) return;
        if (result.success && 'shifted' in result && result.shifted) {
          toast.success('Your Travel DNA has been refined', {
            description: 'We updated your archetype based on improved matching.',
            duration: 6000,
          });
        }
      } catch (err) {
        // Soft-fail: never surface to user
        console.warn('[DNARecalcOnVisit] failed', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return null;
}
