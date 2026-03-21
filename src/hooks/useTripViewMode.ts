import { useCallback, useEffect, useState } from 'react';

export type TripViewMode = 'edit' | 'preview';

interface UseTripViewModeOptions {
  /** Whether the current user owns or can edit this trip */
  isOwner: boolean;
  /** Whether a collaborator has edit permission (can propose changes) */
  canEdit?: boolean;
}

/**
 * Manages the Edit/Preview toggle state via React state.
 * - Owner defaults to 'edit'
 * - Non-owner forced to 'preview' (cannot toggle)
 */
export function useTripViewMode({ isOwner, canEdit = false }: UseTripViewModeOptions) {
  const hasEditAccess = isOwner || canEdit;

  const [internalMode, setInternalMode] = useState<TripViewMode>(
    hasEditAccess ? 'edit' : 'preview'
  );

  const mode: TripViewMode = hasEditAccess ? internalMode : 'preview';

  const setMode = useCallback(
    (newMode: TripViewMode) => {
      if (!hasEditAccess) return;
      setInternalMode(newMode);
    },
    [hasEditAccess]
  );

  return {
    mode,
    setMode,
    isPreviewMode: mode === 'preview',
    isEditMode: mode === 'edit',
    canToggle: hasEditAccess,
  };
}
