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

  // Helper to check if welcome modal should be allowed
  const shouldShowWelcome = () => {
    if (!user) return false;
    // Per-user persistent check — already claimed in DB
    if (hasClaimedBonus('welcome')) return false;
    // Per-user session check: prevents re-showing within the same tab session
    const shownForUser = sessionStorage.getItem(POPUP_STORAGE.WELCOME_SHOWN);
    if (shownForUser === user.id) return false;
    // Per-user persistent check — already claimed in this browser
    const claimedBy = localStorage.getItem('voyance_welcome_bonus_claimed');
    if (claimedBy === user.id) return false;
    return true;
  };

  useEffect(() => {
    // Wait for auth and bonus data to fully load
    if (authLoading || bonusLoading || !user) return;
    if (!shouldShowWelcome()) return;

    // Request permission from coordination system immediately
    // Welcome has highest priority (1) so it should win any race
    const timer = setTimeout(() => {
      const allowed = requestPopup('welcome_credits');
      if (allowed) {
        console.log('[WelcomeBonusManager] Welcome credits modal activated for user:', user.id);
        setShowWelcomeModal(true);
        sessionStorage.setItem(POPUP_STORAGE.WELCOME_SHOWN, user.id);
      } else {
        console.log('[WelcomeBonusManager] Popup slot denied, queuing...');
      }
    }, 500); // Fire quickly - welcome has highest priority
    return () => clearTimeout(timer);
  }, [user, authLoading, bonusLoading, hasClaimedBonus, requestPopup]);

  // React to being granted from the popup queue (e.g. if another popup grabbed the slot first)
  const activePopup = usePopupCoordination((s) => s.activePopup);
  useEffect(() => {
    if (activePopup === 'welcome_credits' && !showWelcomeModal && shouldShowWelcome()) {
      setShowWelcomeModal(true);
      sessionStorage.setItem(POPUP_STORAGE.WELCOME_SHOWN, user?.id ?? 'true');
    }
  }, [activePopup, showWelcomeModal, user, hasClaimedBonus]);

  const handleCloseWelcome = () => {
    setShowWelcomeModal(false);
    closePopup('welcome_credits');
    if (user?.id) localStorage.setItem('voyance_welcome_bonus_claimed', user.id);
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
