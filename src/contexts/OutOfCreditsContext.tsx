/**
 * Global "Out of Credits" context
 * Provides a way to trigger an out-of-credits modal from anywhere in the app.
 * Used by useSpendCredits when a credit deduction fails.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CREDIT_COSTS } from '@/config/pricing';
import { useCredits } from '@/hooks/useCredits';

type ActionType = keyof typeof CREDIT_COSTS;

interface OutOfCreditsState {
  isOpen: boolean;
  action?: ActionType;
  creditsNeeded?: number;
  creditsAvailable?: number;
  tripId?: string;
}

interface OutOfCreditsContextValue {
  state: OutOfCreditsState;
  showOutOfCredits: (params: {
    action?: ActionType;
    creditsNeeded?: number;
    creditsAvailable?: number;
    tripId?: string;
  }) => void;
  dismiss: () => void;
}

const OutOfCreditsContext = createContext<OutOfCreditsContextValue | null>(null);

export function OutOfCreditsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OutOfCreditsState>({ isOpen: false });
  const credits = useCredits();

  const showOutOfCredits = useCallback((params: {
    action?: ActionType;
    creditsNeeded?: number;
    creditsAvailable?: number;
    tripId?: string;
  }) => {
    // Fix #12: Suppress modal during new-user loading state
    if (credits.data?.isNewUserLoading) return;

    setState({
      isOpen: true,
      action: params.action,
      creditsNeeded: params.creditsNeeded,
      creditsAvailable: params.creditsAvailable,
      tripId: params.tripId,
    });
  }, [credits.data?.isNewUserLoading]);

  const dismiss = useCallback(() => {
    setState({ isOpen: false });
  }, []);

  return (
    <OutOfCreditsContext.Provider value={{ state, showOutOfCredits, dismiss }}>
      {children}
    </OutOfCreditsContext.Provider>
  );
}

export function useOutOfCredits() {
  const ctx = useContext(OutOfCreditsContext);
  if (!ctx) {
    throw new Error('useOutOfCredits must be used within OutOfCreditsProvider');
  }
  return ctx;
}
