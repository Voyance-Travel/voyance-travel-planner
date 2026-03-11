import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

export type TripViewMode = 'edit' | 'preview';

interface UseTripViewModeOptions {
  /** Whether the current user owns or can edit this trip */
  isOwner: boolean;
}

/**
 * Manages the Edit/Preview toggle state via URL search params.
 * - Owner defaults to 'edit'
 * - Non-owner forced to 'preview' (cannot toggle)
 */
export function useTripViewMode({ isOwner }: UseTripViewModeOptions) {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawMode = searchParams.get('mode');

  const mode: TripViewMode = useMemo(() => {
    if (!isOwner) return 'preview';
    if (rawMode === 'preview') return 'preview';
    return 'edit';
  }, [isOwner, rawMode]);

  const setMode = useCallback(
    (newMode: TripViewMode) => {
      if (!isOwner) return; // Non-owners can't toggle
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newMode === 'edit') {
            next.delete('mode');
          } else {
            next.set('mode', 'preview');
          }
          return next;
        },
        { replace: true }
      );
    },
    [isOwner, setSearchParams]
  );

  return {
    mode,
    setMode,
    isPreviewMode: mode === 'preview',
    isEditMode: mode === 'edit',
    canToggle: isOwner,
  };
}
