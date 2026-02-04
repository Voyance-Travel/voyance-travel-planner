/**
 * OnboardingRedirect Component
 * 
 * Checks if a newly authenticated user has completed their preferences.
 * If not, shows a gentle nudge modal encouraging them to fill out preferences for better itineraries.
 * 
 * Uses popup coordination to prevent conflicts with other modals.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, ArrowRight, X, Clock, Utensils, MapPin, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePreferenceCompletion } from '@/hooks/usePreferenceCompletion';
import { usePopupCoordination, POPUP_STORAGE, POPUP_COOLDOWNS } from '@/stores/popup-coordination-store';
import { ROUTES } from '@/config/routes';

export function OnboardingRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { data: preferenceStatus, isLoading: isLoadingPreferences } = usePreferenceCompletion();
  const navigate = useNavigate();
  const [showNudge, setShowNudge] = useState(false);
  
  const { requestPopup, closePopup } = usePopupCoordination();

  useEffect(() => {
    // Only check after auth and preferences are fully loaded
    if (isLoading || isLoadingPreferences || !isAuthenticated || !user) return;

    // If user has good personalization, don't show anything
    if (preferenceStatus?.personalizationLevel === 'excellent' || preferenceStatus?.personalizationLevel === 'good') {
      return;
    }

    // Check if we've shown the nudge recently (24 hour cooldown)
    const lastShown = localStorage.getItem(POPUP_STORAGE.ONBOARDING_SHOWN);
    if (lastShown) {
      const lastShownTime = parseInt(lastShown, 10);
      if (Date.now() - lastShownTime < POPUP_COOLDOWNS.ONBOARDING_PREFERENCES) {
        return; // Don't show again within cooldown
      }
    }

    // Request permission from coordination system with delay
    // This gives welcome modal priority if it's also trying to show
    const timer = setTimeout(() => {
      const allowed = requestPopup('onboarding_preferences');
      if (allowed) {
        setShowNudge(true);
        localStorage.setItem(POPUP_STORAGE.ONBOARDING_SHOWN, Date.now().toString());
      }
    }, 2000); // 2 second delay to let welcome modal show first if applicable

    return () => clearTimeout(timer);
  }, [isLoading, isLoadingPreferences, isAuthenticated, user, preferenceStatus, requestPopup]);

  const handleGoToPreferences = () => {
    setShowNudge(false);
    closePopup('onboarding_preferences');
    navigate(ROUTES.PROFILE.VIEW + '?tab=preferences');
  };

  const handleDismiss = () => {
    setShowNudge(false);
    closePopup('onboarding_preferences');
  };

  return (
    <AnimatePresence>
      {showNudge && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative gradient header */}
            <div className="h-2 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />
            
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6 pt-8">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <Settings className="h-8 w-8 text-primary" />
                </motion.div>
              </div>

              {/* Content - Warm, encouraging tone */}
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-display font-bold text-foreground">
                  Let's personalize your trips! ✨
                </h2>
                <p className="text-muted-foreground">
                  The more we know about you, the better your itineraries will be. Share a few preferences and watch the magic happen.
                </p>
              </div>

              {/* What you'll unlock */}
              <div className="mt-6 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Your trips will include</p>
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <span>Hotels that match your style</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <Utensils className="h-4 w-4 text-orange-600" />
                  </div>
                  <span>Restaurants that fit your diet</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                    <Heart className="h-4 w-4 text-rose-600" />
                  </div>
                  <span>Activities you'll actually love</span>
                </div>
              </div>

              {/* Bonus credits nudge */}
              <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <p className="text-sm text-center">
                  <span className="font-medium text-accent">+50 bonus credits</span>
                  <span className="text-muted-foreground"> when you complete your preferences</span>
                </p>
              </div>

              {/* Actions - Simple and clear */}
              <div className="mt-6 space-y-3">
                <Button
                  onClick={handleGoToPreferences}
                  className="w-full h-12 gap-2"
                  size="lg"
                >
                  Set My Preferences
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <button
                  onClick={handleDismiss}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  I'll do this later
                </button>
              </div>

              {/* Reassurance */}
              <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Takes just a couple minutes</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}