/**
 * Site Onboarding Tour
 * 
 * A step-by-step guided tour for new users after their first sign-in.
 * Navigates users to actual feature pages and highlights key value props.
 * Uses spotlight/tooltip pattern with page navigation between steps.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, ChevronLeft, Sparkles, Compass,
  User, Rocket, Heart, Zap, Dna, Globe, Star
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
  /** Route to navigate to before showing this step */
  route?: string;
  /** CSS selector to spotlight an element on the page */
  selector?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Emphasis level — 'high' gets a special visual treatment */
  emphasis?: 'normal' | 'high';
}

const STORAGE_KEY = 'voyance_site_tour_completed';

interface SiteOnboardingTourProps {
  onComplete?: () => void;
}

export function SiteOnboardingTour({ onComplete }: SiteOnboardingTourProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { requestPopup, closePopup } = usePopupCoordination();
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const firstName = user?.name?.split(' ')[0] || 'there';

  const TOUR_STEPS: TourStep[] = [
    {
      id: 'welcome',
      title: `Welcome, ${firstName}!`,
      description: 'Quick 45-second tour of what makes Voyance different.',
      icon: <Sparkles className="h-5 w-5" />,
      route: '/',
      position: 'center',
    },
    {
      id: 'explore-page',
      title: 'Explore Destinations',
      description: 'Curated destinations with seasonal tips and hidden gems matched to your travel style.',
      icon: <Compass className="h-5 w-5" />,
      route: ROUTES.EXPLORE,
      position: 'center',
    },
    {
      id: 'travel-dna',
      title: 'Your Travel DNA',
      description: '2-minute quiz that identifies your traveler type. Every recommendation personalizes to match.',
      icon: <Dna className="h-5 w-5" />,
      route: ROUTES.QUIZ,
      position: 'center',
      emphasis: 'high',
    },
    {
      id: 'build-trip',
      title: 'Build Your Itinerary',
      description: 'Pick a destination and dates. We handle venue picks, timing, and routing.',
      icon: <Rocket className="h-5 w-5" />,
      route: ROUTES.START,
      position: 'center',
    },
    {
      id: 'profile-hub',
      title: 'Your Command Center',
      description: 'Trips, DNA results, and preferences — all in one place.',
      icon: <User className="h-5 w-5" />,
      route: ROUTES.PROFILE.VIEW,
      position: 'center',
    },
    {
      id: 'credits',
      title: 'Free Credits Included',
      description: 'Every trip starts free. Credits unlock addresses, booking links, and insider tips.',
      icon: <Zap className="h-5 w-5" />,
      route: `${ROUTES.PROFILE.VIEW}?tab=subscription`,
      position: 'center',
    },
    {
      id: 'intelligent-itineraries',
      title: 'Smart Itineraries',
      description: 'See WHY each pick was made — timing hacks, tourist trap warnings, and savings tallies.',
      icon: <Star className="h-5 w-5" />,
      route: ROUTES.DEMO,
      position: 'center',
      emphasis: 'high',
    },
    {
      id: 'start-journey',
      title: 'Ready to Go?',
      description: 'Take the DNA quiz first for best results, or jump straight into planning.',
      icon: <Heart className="h-5 w-5" />,
      route: ROUTES.QUIZ,
      position: 'center',
    },
  ];

  // TEMP: Force-show tour for preview testing (remove after review)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Navigate to route when step changes
  useEffect(() => {
    if (!isVisible) return;
    const step = TOUR_STEPS[currentStep];
    if (step?.route && location.pathname !== step.route) {
      setIsNavigating(true);
      navigate(step.route);
      navigationTimerRef.current = setTimeout(() => {
        setIsNavigating(false);
      }, 800);
    } else {
      setIsNavigating(false);
    }
    return () => {
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
    };
  }, [currentStep, isVisible]);

  // Update highlight position when step changes or navigation completes
  useEffect(() => {
    if (!isVisible || isNavigating) return;
    const step = TOUR_STEPS[currentStep];

    const updateHighlight = () => {
      if (step?.selector) {
        const element = document.querySelector(step.selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          setHighlightRect(rect);
          return;
        }
      }
      setHighlightRect(null);
    };

    // Delay to allow page render after navigation
    const timer = setTimeout(updateHighlight, 500);
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight, true);

    // Polling for dynamically rendered elements
    const interval = setInterval(() => {
      if (step?.selector) {
        const el = document.querySelector(step.selector);
        if (el) {
          const rect = el.getBoundingClientRect();
          setHighlightRect(prev => {
            if (!prev) return rect;
            const changed = Math.abs(prev.top - rect.top) > 2 || Math.abs(prev.left - rect.left) > 2;
            return changed ? rect : prev;
          });
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight, true);
    };
  }, [currentStep, isVisible, isNavigating]);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete('quiz');
    }
  }, [currentStep, TOUR_STEPS.length]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleComplete = useCallback((destination: 'quiz' | 'start' = 'start') => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    closePopup('site_tour');
    onComplete?.();
    navigate(destination === 'quiz' ? ROUTES.QUIZ : ROUTES.START);
  }, [onComplete, navigate, closePopup]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    closePopup('site_tour');
    onComplete?.();
  }, [onComplete, closePopup]);

  if (!isVisible) return null;

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const isCentered = step.position === 'center' || !highlightRect;
  const isHighEmphasis = step.emphasis === 'high';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ backgroundColor: isHighEmphasis ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.25)' }}
          onClick={handleSkip}
        />

        {/* Spotlight cutout */}
        {highlightRect && !isNavigating && (
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

        {/* Tooltip card — pinned to bottom so page content stays visible */}
        <div
          className="pointer-events-auto fixed inset-x-0 bottom-0 flex justify-center px-3 sm:px-4 pb-4 sm:pb-6"
          style={{ zIndex: 102 }}
        >
          <motion.div
            key={`card-${currentStep}`}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={cn(
              "w-full sm:w-[400px] max-w-[calc(100vw-1.5rem)] bg-card border rounded-xl shadow-2xl overflow-hidden",
              isHighEmphasis ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
            )}
          >
            {/* Header */}
            <div className={cn(
              "flex items-center justify-between p-3 sm:p-4 border-b border-border",
              isHighEmphasis
                ? "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent"
                : "bg-gradient-to-r from-primary/10 to-transparent"
            )}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-1.5 sm:p-2 rounded-lg",
                  isHighEmphasis ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
                )}>
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
            <div className="p-3 sm:p-5">
              <h3 className={cn(
                "font-serif font-semibold mb-2",
                isHighEmphasis ? "text-lg sm:text-xl" : "text-base sm:text-lg"
              )}>
                {step.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>

              {/* Emphasis callout for high-priority steps */}
              {isHighEmphasis && (
                <div className="mt-3 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {step.id === 'travel-dna'
                      ? 'Take the quiz after this tour for the most personalized experience'
                      : 'This is what makes Voyance different from every other travel app'
                    }
                  </p>
                </div>
              )}
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
                        : idx < currentStep
                          ? "bg-primary/40 w-1 sm:w-1.5"
                          : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1 sm:w-1.5"
                    )}
                  />
                ))}
              </div>

              {isLast ? (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleComplete('start')}
                    className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
                  >
                    Plan a Trip
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleComplete('quiz')}
                    className="h-8 px-2 sm:px-3 gap-0.5 sm:gap-1 text-xs sm:text-sm"
                  >
                    <Dna className="h-3 w-3 sm:h-4 sm:w-4" />
                    Take Quiz
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="h-8 px-2 sm:px-3 gap-0.5 sm:gap-1"
                >
                  <span className="text-xs sm:text-sm">Next</span>
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              )}
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
