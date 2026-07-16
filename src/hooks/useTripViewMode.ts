import { useCallback, useState } from 'react';

export type TripViewMode = 'edit' | 'preview';

interface UseTripViewModeOptions {
  /** Whether the current user owns or can edit this trip */
  isOwner: boolean;
  /** Whether a collaborator has edit permission (can propose changes) */
  canEdit?: boolean;
}

/**
 * Manages the Edit/Preview toggle state via React state.
 * - Everyone LANDS in 'preview' — a clean, readable trip first ("I have a trip
 *   now"), with edit controls one tap away. This prevents the "why are there so
 *   many controls?" first impression right after creating or importing a trip.
 * - Owner/editor can toggle to 'edit'; a non-owner is locked to 'preview'.
 */
export function useTripViewMode({ isOwner, canEdit = false }: UseTripViewModeOptions) {
  const hasEditAccess = isOwner || canEdit;

  // Default landing view is Preview for everyone; owners/editors switch to Edit
  // via the toggle. (Was: owners auto-forced into Edit on mount.)
  const [internalMode, setInternalMode] = useState<TripViewMode>('preview');

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
