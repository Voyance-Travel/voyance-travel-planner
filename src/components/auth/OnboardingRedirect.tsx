/**
 * OnboardingRedirect Component
 * 
 * Checks if a newly authenticated user has completed their preferences/quiz.
 * If not, shows a gentle nudge modal encouraging them to complete it for better itineraries.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';

const ONBOARDING_SHOWN_KEY = 'voyance_onboarding_nudge_shown';
const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export function OnboardingRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    // Only check after auth is fully loaded
    if (isLoading || !isAuthenticated || !user) return;

    // If user has already completed the quiz, don't show anything
    if (user.quizCompleted) return;

    // Check if we've shown the nudge recently
    const lastShown = localStorage.getItem(ONBOARDING_SHOWN_KEY);
    if (lastShown) {
      const lastShownTime = parseInt(lastShown, 10);
      if (Date.now() - lastShownTime < NUDGE_COOLDOWN_MS) {
        return; // Don't show again within cooldown
      }
    }

    // Show the nudge modal
    setShowNudge(true);
    localStorage.setItem(ONBOARDING_SHOWN_KEY, Date.now().toString());
  }, [isLoading, isAuthenticated, user]);

  const handleTakeQuiz = () => {
    setShowNudge(false);
    navigate(ROUTES.QUIZ);
  };

  const handleDismiss = () => {
    setShowNudge(false);
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
                  <Sparkles className="h-8 w-8 text-primary" />
                </motion.div>
              </div>

              {/* Content */}
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-display font-bold text-foreground">
                  Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 🎉
                </h2>
                <p className="text-muted-foreground">
                  Take our 2-minute Travel Quiz and we'll create personalized itineraries that match your unique travel style.
                </p>
              </div>

              {/* Benefits */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                  <span>Activities tailored to your interests</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                  <span>Pace & budget that fits you</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                  <span>Discover your Travel DNA personality</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 space-y-3">
                <Button
                  onClick={handleTakeQuiz}
                  className="w-full h-12 gap-2"
                  size="lg"
                >
                  Take the Quiz
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <button
                  onClick={handleDismiss}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Maybe later
                </button>
              </div>

              {/* Time estimate */}
              <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Takes about 2 minutes</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
