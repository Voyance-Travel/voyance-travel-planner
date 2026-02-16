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
import { fetchOnboardingState, mergeOnboardingState } from '@/utils/onboardingState';
import WelcomeCreditsModal from './WelcomeCreditsModal';
import CreditEarningProgressBar from './CreditEarningProgressBar';

export function WelcomeBonusManager() {
  const { user, isLoading: authLoading } = useAuth();
  const { hasClaimedBonus, isLoading: bonusLoading } = useBonusCredits();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  
  const { requestPopup, closePopup, hasActiveModal } = usePopupCoordination();

  const [dbChecked, setDbChecked] = useState(false);
  const [dbWelcomeShown, setDbWelcomeShown] = useState(false);

  // Check DB for welcome_shown flag on mount
  useEffect(() => {
    if (!user) return;
    fetchOnboardingState(user.id).then(state => {
      if (state.welcome_shown) {
        setDbWelcomeShown(true);
        // Re-sync localStorage
        sessionStorage.setItem(POPUP_STORAGE.WELCOME_SHOWN, user.id);
        localStorage.setItem('voyance_welcome_bonus_claimed', user.id);
      }
      setDbChecked(true);
    });
  }, [user]);

  // Helper to check if welcome modal should be allowed
  const shouldShowWelcome = () => {
    if (!user) return false;
    if (!dbChecked) return false; // Wait for DB check
    if (dbWelcomeShown) return false;
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

    // Welcome credits now fires AFTER the site tour (priority 2)
    // Queue it — it will show once the tour closes its slot
    const timer = setTimeout(() => {
      const allowed = requestPopup('welcome_credits');
      if (allowed) {
        console.log('[WelcomeBonusManager] Welcome credits modal activated for user:', user.id);
        setShowWelcomeModal(true);
        sessionStorage.setItem(POPUP_STORAGE.WELCOME_SHOWN, user.id);
      } else {
        console.log('[WelcomeBonusManager] Popup slot denied, queued for after tour');
      }
    }, 2000); // Delay to let tour claim slot first
    return () => clearTimeout(timer);
  }, [user, authLoading, bonusLoading, hasClaimedBonus, requestPopup, dbChecked]);

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
    if (user?.id) {
      localStorage.setItem('voyance_welcome_bonus_claimed', user.id);
      // Persist to DB
      mergeOnboardingState(user.id, {
        welcome_shown: true,
        welcome_shown_at: new Date().toISOString(),
      });
    }
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
