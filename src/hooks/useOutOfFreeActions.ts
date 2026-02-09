/**
 * Hook to manage the OutOfFreeActionsModal state.
 * Used by action handlers to show the modal when free caps are exhausted.
 */

import { useState, useCallback } from 'react';

interface OutOfFreeActionsState {
  isOpen: boolean;
  actionType: string;
  creditsAvailable: number;
  onContinue: () => void;
}

const INITIAL: OutOfFreeActionsState = {
  isOpen: false,
  actionType: '',
  creditsAvailable: 0,
  onContinue: () => {},
};

export function useOutOfFreeActions() {
  const [state, setState] = useState<OutOfFreeActionsState>(INITIAL);

  const showOutOfFreeActions = useCallback((params: {
    actionType: string;
    creditsAvailable: number;
    onContinue: () => void;
  }) => {
    setState({
      isOpen: true,
      actionType: params.actionType,
      creditsAvailable: params.creditsAvailable,
      onContinue: params.onContinue,
    });
  }, []);

  const dismiss = useCallback(() => {
    setState(INITIAL);
  }, []);

  return { state, showOutOfFreeActions, dismiss };
}
