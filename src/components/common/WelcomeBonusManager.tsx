/**
 * Welcome Bonus Manager
 * Handles triggering welcome modal for new users after email verification
 * Also manages the floating credit progress bar
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBonusCredits } from '@/hooks/useBonusCredits';
import WelcomeCreditsModal from './WelcomeCreditsModal';
import CreditEarningProgressBar from './CreditEarningProgressBar';

const WELCOME_SHOWN_KEY = 'voyance_welcome_shown';

export function WelcomeBonusManager() {
  const { user, isLoading: authLoading } = useAuth();
  const { hasClaimedBonus, isLoading: bonusLoading } = useBonusCredits();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    // Wait for auth and bonus data to load
    if (authLoading || bonusLoading || !user) return;

    // Check if we've already shown the welcome modal this session
    const welcomeShown = sessionStorage.getItem(WELCOME_SHOWN_KEY);
    if (welcomeShown) return;

    // Check if user hasn't claimed welcome bonus yet (new user)
    if (!hasClaimedBonus('welcome')) {
      // Small delay to let the page settle
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
        sessionStorage.setItem(WELCOME_SHOWN_KEY, 'true');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, bonusLoading, hasClaimedBonus]);

  const handleCloseWelcome = () => {
    setShowWelcomeModal(false);
  };

  // Don't render anything if not authenticated
  if (!user) return null;

  return (
    <>
      {/* Welcome modal for new users */}
      <WelcomeCreditsModal 
        open={showWelcomeModal} 
        onClose={handleCloseWelcome} 
      />

      {/* Floating progress bar for earning more credits */}
      <CreditEarningProgressBar />
    </>
  );
}

export default WelcomeBonusManager;
