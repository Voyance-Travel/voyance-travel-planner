/**
 * Site Onboarding Tour
 * 
 * A step-by-step guided tour for new users after their first sign-in.
 * Highlights key features and drives users toward building their first trip.
 * 
 * Uses the same spotlight/tooltip pattern as ItineraryOnboardingTour
 * but targets site-level navigation elements.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, ChevronLeft, Sparkles, Compass,
  MapPin, User, Bell, Rocket, Heart, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { usePopupCoordination } from '@/stores/popup-coordination-store';

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  selector?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Optional action on step completion (e.g., navigate) */
  action?: () => void;
}

const STORAGE_KEY = 'voyance_site_tour_completed';

interface SiteOnboardingTourProps {
  onComplete?: () => void;
}

export function SiteOnboardingTour({ onComplete }: SiteOnboardingTourProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { requestPopup, closePopup } = usePopupCoordination();

  const firstName = user?.name?.split(' ')[0] || 'there';

  const TOUR_STEPS: TourStep[] = [
    {
      id: 'welcome',
      title: `Welcome to Voyance, ${firstName}! 🌍`,
      description: 'You just unlocked a smarter way to travel. Let me show you around — this will only take 30 seconds.',
      icon: <Sparkles className="h-5 w-5" />,
      position: 'center',
    },
    {
      id: 'build-itinerary',
      title: 'Build Your First Trip',
      description: 'This is where the magic happens. Tell us your destination, dates, and travel style — we\'ll craft a personalized day-by-day itinerary with real venue picks, insider tips, and optimized routing.',
      icon: <Rocket className="h-5 w-5" />,
      selector: '[data-site-tour="build-cta"]',
      position: 'bottom',
    },
    {
      id: 'explore',
      title: 'Explore Destinations',
      description: 'Not sure where to go? Browse curated destinations, discover your Travel DNA archetype, or get inspired by featured trips from real travelers.',
      icon: <Compass className="h-5 w-5" />,
      selector: '[data-site-tour="explore-menu"]',
      position: 'bottom',
    },
    {
      id: 'profile',
      title: 'Your Profile & Trips',
      description: 'Your avatar menu is command central — access your Trip Dashboard, complete your Travel DNA quiz, and set preferences so every itinerary is tailored to your style.',
      icon: <User className="h-5 w-5" />,
      selector: '[data-site-tour="profile"]',
      position: 'bottom',
    },
    {
      id: 'profile',
      title: 'Your Travel Profile',
      description: 'Complete your Travel DNA quiz and set preferences so every trip is tailored to you — dietary needs, pace, interests, and budget all factored in automatically.',
      icon: <User className="h-5 w-5" />,
      selector: '[data-site-tour="profile"]',
      position: 'bottom',
    },
    {
      id: 'notifications',
      title: 'Stay in the Loop',
      description: 'Get notified about trip updates, collaboration invites from travel companions, and personalized travel tips.',
      icon: <Bell className="h-5 w-5" />,
      selector: '[data-site-tour="notifications"]',
      position: 'bottom',
    },
    {
      id: 'credits',
      title: 'Your Free Credits',
      description: 'You\'ve got free credits to preview any trip. When you\'re ready for the full experience — addresses, photos, tips, and booking links — credits unlock everything.',
      icon: <Zap className="h-5 w-5" />,
      position: 'center',
    },
    {
      id: 'start',
      title: 'Ready to Plan? Let\'s Go! ✈️',
      description: 'Your first trip is just a few clicks away. We\'ll personalize every recommendation to match your travel style. No two itineraries are the same.',
      icon: <Heart className="h-5 w-5" />,
      position: 'center',
    },
  ];

  // Check if tour should show — coordinate with popup system
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed && user) {
      // Delay to let welcome modal finish first
      const timer = setTimeout(() => {
        const allowed = requestPopup('site_tour');
        if (allowed) {
          setIsVisible(true);
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [user, requestPopup]);

  // Update highlight position when step changes
  useEffect(() => {
    const updateHighlight = () => {
      const step = TOUR_STEPS[currentStep];
      if (step?.selector) {
        const element = document.querySelector(step.selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          setHighlightRect(rect);
        } else {
          setHighlightRect(null);
        }
      } else {
        setHighlightRect(null);
      }
    };

    const step = TOUR_STEPS[currentStep];
    if (step?.selector) {
      const element = document.querySelector(step.selector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const scrollTimer = setTimeout(updateHighlight, 400);
        window.addEventListener('resize', updateHighlight);
        window.addEventListener('scroll', updateHighlight, true);
        return () => {
          clearTimeout(scrollTimer);
          window.removeEventListener('resize', updateHighlight);
          window.removeEventListener('scroll', updateHighlight, true);
        };
      }
    }
    updateHighlight();
  }, [currentStep]);

  // Continuously update highlight position while tour is active
  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      const step = TOUR_STEPS[currentStep];
      if (step?.selector) {
        const element = document.querySelector(step.selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          setHighlightRect(prev => {
            if (!prev) return rect;
            const hasChanged = Math.abs(prev.top - rect.top) > 2 || Math.abs(prev.left - rect.left) > 2;
            return hasChanged ? rect : prev;
          });
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isVisible, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, TOUR_STEPS.length]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, []);

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    closePopup('site_tour');
    onComplete?.();

    // On last step, navigate to start planning
    if (currentStep === TOUR_STEPS.length - 1) {
      navigate(ROUTES.START);
    }
  }, [onComplete, currentStep, navigate, closePopup, TOUR_STEPS.length]);

  if (!isVisible) return null;

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const isCentered = step.position === 'center' || !highlightRect;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Click-to-dismiss overlay */}
        <div
          className="absolute inset-0 pointer-events-auto"
          onClick={handleSkip}
        />

        {/* Spotlight cutout */}
        {highlightRect && (
          <motion.div
            key={`spotlight-${currentStep}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed pointer-events-none rounded-lg"
            style={{
              top: highlightRect.top - 8,
              left: highlightRect.left - 8,
              width: highlightRect.width + 16,
              height: highlightRect.height + 16,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
              zIndex: 101,
            }}
          >
            <div className="w-full h-full rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-transparent animate-pulse bg-transparent" />
          </motion.div>
        )}

        {/* Tooltip card */}
        <div
          className="pointer-events-auto fixed inset-x-0 flex justify-center px-3 sm:px-4"
          style={{
            zIndex: 102,
            ...(typeof window !== 'undefined' && window.innerWidth < 640
              ? { bottom: 96 }
              : step.position === 'bottom' && highlightRect
                ? { top: Math.min(highlightRect.bottom + 20, window.innerHeight - 300) }
                : step.position === 'top' && highlightRect
                  ? { bottom: window.innerHeight - highlightRect.top + 20 }
                  : isCentered
                    ? { top: '50%', transform: 'translateY(-50%)' }
                    : {}
            ),
          }}
        >
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full sm:w-[360px] max-w-[calc(100vw-1.5rem)] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
              <div className="flex items-center gap-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {currentStep + 1} of {TOUR_STEPS.length}
                </span>
              </div>
              <button
                onClick={handleSkip}
                className="p-1.5 rounded-full hover:bg-secondary transition-colors text-muted-foreground"
                title="Skip tour"
                aria-label="Skip tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-3 sm:p-4">
              <h3 className="font-serif text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">
                {step.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>

            {/* Footer with navigation */}
            <div className="flex items-center justify-between p-3 sm:p-4 pt-2 border-t border-border bg-secondary/30">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                disabled={isFirst}
                className={cn("h-8 px-2 sm:px-3", isFirst && "invisible")}
              >
                <ChevronLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Back</span>
              </Button>

              {/* Progress dots */}
              <div className="flex items-center gap-0.5 sm:gap-1">
                {TOUR_STEPS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    aria-label={`Go to step ${idx + 1}`}
                    className={cn(
                      "h-1 sm:h-1.5 rounded-full transition-all",
                      idx === currentStep
                        ? "bg-primary w-2 sm:w-3"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1 sm:w-1.5"
                    )}
                  />
                ))}
              </div>

              <Button
                size="sm"
                onClick={handleNext}
                className="h-8 px-2 sm:px-3 gap-0.5 sm:gap-1"
              >
                <span className="text-xs sm:text-sm">
                  {isLast ? 'Start Planning!' : 'Next'}
                </span>
                {!isLast && <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

/**
 * Hook to check if site tour has been completed
 */
export function useSiteTourCompleted(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Hook to reset site tour (for testing)
 */
export function useResetSiteTour() {
  return useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);
}
