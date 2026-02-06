/**
 * Welcome Bonus Manager
 * Handles triggering welcome modal for new users after email verification
 * Also manages the floating credit progress bar
 * 
 * Uses popup coordination to prevent modal conflicts
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBonusCredits } from '@/hooks/useBonusCredits';
import { usePopupCoordination, POPUP_STORAGE } from '@/stores/popup-coordination-store';
import WelcomeCreditsModal from './WelcomeCreditsModal';
import CreditEarningProgressBar from './CreditEarningProgressBar';

export function WelcomeBonusManager() {
  const { user, isLoading: authLoading } = useAuth();
  const { hasClaimedBonus, isLoading: bonusLoading } = useBonusCredits();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  
  const { requestPopup, closePopup, hasActiveModal } = usePopupCoordination();

  useEffect(() => {
    // Wait for auth and bonus data to fully load
    if (authLoading || bonusLoading || !user) return;

    // Check if we've already shown the welcome modal this session
    const welcomeShown = sessionStorage.getItem(POPUP_STORAGE.WELCOME_SHOWN);
    if (welcomeShown) return;

    // Also check localStorage to prevent re-showing across sessions after claim
    const welcomeClaimed = localStorage.getItem('voyance_welcome_bonus_claimed');
    if (welcomeClaimed) return;

    // Check if user hasn't claimed welcome bonus yet (new user)
    if (!hasClaimedBonus('welcome')) {
      // Request permission from coordination system
      const timer = setTimeout(() => {
        const allowed = requestPopup('welcome_credits');
        if (allowed) {
          setShowWelcomeModal(true);
          sessionStorage.setItem(POPUP_STORAGE.WELCOME_SHOWN, 'true');
        }
      }, 1200); // Allow extra time for bonus query to settle
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, bonusLoading, hasClaimedBonus, requestPopup]);

  const handleCloseWelcome = () => {
    setShowWelcomeModal(false);
    closePopup('welcome_credits');
    localStorage.setItem('voyance_welcome_bonus_claimed', 'true');
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

      {/* Floating progress bar - hide when modals are active */}
      {!hasActiveModal() && <CreditEarningProgressBar />}
    </>
  );
}

export default WelcomeBonusManager;
