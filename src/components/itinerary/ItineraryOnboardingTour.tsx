/**
 * Itinerary Onboarding Tour
 * 
 * A step-by-step tooltip walkthrough that introduces users to
 * key itinerary features on their first-ever visit.
 * Shows only ONCE globally (not per trip).
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePopupCoordination } from '@/stores/popup-coordination-store';
import { fetchOnboardingState, mergeOnboardingState } from '@/utils/onboardingState';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronRight, ChevronLeft, Lock, MoreHorizontal, 
  RefreshCw, Save, Calendar, Sparkles, ArrowRightLeft,
  Route, Globe, Share2, MapPin, MessageSquare, HeartPulse,
  Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  selector?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'trip-at-a-glance',
    title: 'Your Trip at a Glance',
    description: 'We analyzed your destination and baked intelligence into every activity — hidden gems, timing tricks, and local picks. This summary shows what we found.',
    icon: <Sparkles className="h-5 w-5" />,
    selector: '[data-tour="value-header"]',
    position: 'bottom',
  },
  {
    id: 'trip-health',
    title: 'Trip Health & Status',
    description: 'Your Health Score tracks how trip-ready you are. Add flights, hotels, and resolve issues to hit 100%. Tap the score to see what needs attention.',
    icon: <HeartPulse className="h-5 w-5" />,
    selector: '[data-tour="health-score"]',
    position: 'right',
  },
  {
    id: 'trip-actions',
    title: 'Share, Optimize & Export',
    description: 'Share your trip with companions — they can propose changes or edit directly. Optimize lets AI improve flow and timing. Export creates a beautiful PDF.',
    icon: <Share2 className="h-5 w-5" />,
    selector: '[data-tour="trip-actions"]',
    position: 'top',
  },
  {
    id: 'day-header',
    title: 'Your Day, Your Way',
    description: 'Each day is a block you control. See the cost, view routes on a map, lock the day to protect it from changes, or regenerate it for fresh ideas.',
    icon: <Calendar className="h-5 w-5" />,
    selector: '[data-tour="day-header"]',
    position: 'bottom',
  },
  {
    id: 'activity-card',
    title: 'Customize Any Activity',
    description: 'Every activity can be swapped, moved, edited, or removed. Tap the ⋯ menu for options, or lock an activity to keep it safe. You get 3 free swaps per trip.',
    icon: <ArrowRightLeft className="h-5 w-5" />,
    selector: '[data-tour="activity-card"]',
    position: 'right',
  },
  {
    id: 'chat-bubble',
    title: 'Your AI Trip Assistant',
    description: "Tell the assistant what you want — 'Make Day 3 more relaxed' or 'Add more food options.' It'll suggest changes you can approve before they're applied. 5 free messages included.",
    icon: <MessageSquare className="h-5 w-5" />,
    selector: '[data-tour="chat-bubble"]',
    position: 'left',
  },
  {
    id: 'tab-bar',
    title: 'Beyond the Itinerary',
    description: "There's more here: set a Budget and track spending, split costs in Payments, see weather and logistics in Trip Details, and check visa/safety info in Need to Know.",
    icon: <Wallet className="h-5 w-5" />,
    selector: '[data-tour="tab-bar"]',
    position: 'bottom',
  },
];

const STORAGE_KEY = 'voyance_itinerary_tour_completed';

interface ItineraryOnboardingTourProps {
  tripId: string;
  onComplete?: () => void;
}

export function ItineraryOnboardingTour({ tripId, onComplete }: ItineraryOnboardingTourProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [shouldShowWhenAllowed, setShouldShowWhenAllowed] = useState(false);
  const { requestPopup, closePopup } = usePopupCoordination();
  const activePopup = usePopupCoordination(state => state.activePopup);
  const { user } = useAuth();

  // Show tour only once per user — check localStorage (fast) then DB (durable)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // Fast path: localStorage already has completion for this user
    if (localStorage.getItem(STORAGE_KEY) === user.id) return;

    // Slow path: check DB
    (async () => {
      const dbState = await fetchOnboardingState(user.id);
      if (cancelled) return;

      if (dbState.itinerary_tour_completed) {
        // Re-sync localStorage so next check is fast
        localStorage.setItem(STORAGE_KEY, user.id);
        return;
      }

      // Neither localStorage nor DB says completed — mark as ready to show
      setShouldShowWhenAllowed(true);
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Show entry banner instead of auto-starting tour
  useEffect(() => {
    if (!shouldShowWhenAllowed || isVisible || showBanner) return;

    const timer = setTimeout(() => {
      const allowed = requestPopup('itinerary_tour');
      if (allowed) setShowBanner(true);
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShowWhenAllowed]);

  const startTour = useCallback(() => {
    setShowBanner(false);
    setIsVisible(true);
  }, []);

  // Update highlight position when step changes
  useEffect(() => {
    if (!isVisible) return;

    const updateHighlight = () => {
      const step = TOUR_STEPS[currentStep];
      if (step?.selector) {
        const element = document.querySelector(step.selector);
        if (element) {
          setHighlightRect(element.getBoundingClientRect());
          return;
        }
      }
      setHighlightRect(null);
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
  }, [currentStep, isVisible]);

  // Polling for dynamic elements
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
            const changed = Math.abs(prev.top - rect.top) > 2 || Math.abs(prev.left - rect.left) > 2;
            return changed ? rect : prev;
          });
        }
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isVisible, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  }, [currentStep]);

  const handleComplete = useCallback(() => {
    if (user?.id) {
      localStorage.setItem(STORAGE_KEY, user.id);
      // Persist to DB (fire-and-forget)
      mergeOnboardingState(user.id, {
        itinerary_tour_completed: true,
        itinerary_tour_completed_at: new Date().toISOString(),
      });
    }
    setIsVisible(false);
    closePopup('itinerary_tour');
    onComplete?.();
  }, [onComplete, closePopup, user]);

  const handleSkip = useCallback(() => {
    setShowBanner(false);
    handleComplete();
  }, [handleComplete]);

  // Entry banner
  if (showBanner && !isVisible) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20"
      >
        <span className="text-sm text-foreground">
          First time here? Take a quick tour to see what you can do.
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleSkip} className="text-xs text-muted-foreground hover:text-foreground">
            Skip
          </button>
          <Button size="sm" onClick={startTour} className="h-7 text-xs">
            Show me
          </Button>
        </div>
      </motion.div>
    );
  }

  if (!isVisible) return null;

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const isCentered = step.position === 'center' || !highlightRect;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-none">
        <div className="absolute inset-0 pointer-events-auto" onClick={handleSkip} />

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
                  : (step.position === 'left' || step.position === 'right') && highlightRect
                    ? { top: Math.max(highlightRect.top + highlightRect.height / 2 - 110, 20) }
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
            className="w-full sm:w-[340px] max-w-[calc(100vw-1.5rem)] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          >
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
                aria-label="Skip tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 sm:p-4">
              <h3 className="font-serif text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">{step.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>

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

              <Button
                size="sm"
                onClick={handleNext}
                className="h-8 px-2 sm:px-3 gap-0.5 sm:gap-1"
              >
                <span className="text-xs sm:text-sm">{isLast ? 'Got It!' : 'Next'}</span>
                {!isLast && <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

export function useResetItineraryTour() {
  return useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);
}
