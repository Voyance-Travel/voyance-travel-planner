import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

export type TripViewMode = 'edit' | 'preview';

interface UseTripViewModeOptions {
  /** Whether the current user owns or can edit this trip */
  isOwner: boolean;
  /** Whether a collaborator has edit permission (can propose changes) */
  canEdit?: boolean;
}

/**
 * Manages the Edit/Preview toggle state via URL search params.
 * - Owner defaults to 'edit'
 * - Non-owner forced to 'preview' (cannot toggle)
 */
export function useTripViewMode({ isOwner, canEdit = false }: UseTripViewModeOptions) {
  // FIX 22A: Preview mode intentionally disabled while schema-driven generation
  // is being built in isolation. To re-enable, remove the early return below
  // and uncomment the original logic.
  const PREVIEW_MODE_ENABLED = true;

  const [searchParams, setSearchParams] = useSearchParams();

  const rawMode = searchParams.get('mode');

  const hasEditAccess = isOwner || canEdit;

  const mode: TripViewMode = useMemo(() => {
    if (!PREVIEW_MODE_ENABLED) return 'edit';
    if (!hasEditAccess) return 'preview';
    if (rawMode === 'preview') return 'preview';
    return 'edit';
  }, [hasEditAccess, rawMode]);

  const setMode = useCallback(
    (newMode: TripViewMode) => {
      if (!hasEditAccess) return; // View-only users can't toggle
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
    [hasEditAccess, setSearchParams]
  );

  return {
    mode,
    setMode,
    isPreviewMode: mode === 'preview',
    isEditMode: mode === 'edit',
    canToggle: PREVIEW_MODE_ENABLED && isOwner,
  };
}
