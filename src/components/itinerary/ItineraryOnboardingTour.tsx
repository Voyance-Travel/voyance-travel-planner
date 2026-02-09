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
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronRight, ChevronLeft, Lock, MoreHorizontal, 
  RefreshCw, Save, Calendar, Sparkles, ArrowRightLeft,
  Route, Globe, Share2, MapPin, MessageSquare
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
    id: 'welcome',
    title: 'Welcome to Your Itinerary! ✨',
    description: 'This is your personalized travel plan, powered by AI and tailored to your Travel DNA. Let me show you how to make it perfect.',
    icon: <Sparkles className="h-5 w-5" />,
    position: 'center',
  },
  {
    id: 'day-picker',
    title: 'Navigate Between Days',
    description: 'Use the day picker to jump between different days of your trip. Today\'s date is highlighted for easy reference.',
    icon: <Calendar className="h-5 w-5" />,
    selector: '[data-tour="day-picker"]',
    position: 'bottom',
  },
  {
    id: 'transit-routes',
    title: 'Routes & Transit Between Stops',
    description: 'Between every activity you\'ll see transit badges showing walking time, metro lines, taxi costs, and step-by-step directions. We optimize your route so you spend less time commuting and more time experiencing.',
    icon: <MapPin className="h-5 w-5" />,
    selector: '[data-tour="transit-badge"]',
    position: 'bottom',
  },
  {
    id: 'optimize',
    title: 'AI Route Optimization',
    description: 'Click Optimize to intelligently reorder your day\'s activities, minimizing travel time between stops. Typically saving ~30 minutes per day with smarter sequencing.',
    icon: <Route className="h-5 w-5" />,
    selector: '[data-tour="optimize-button"]',
    position: 'bottom',
  },
  {
    id: 'find-alternative',
    title: 'AI-Powered Alternatives',
    description: 'Don\'t love a suggestion? Click "Find Alternative" and our AI instantly swaps it for something that matches your travel style, pace, and budget. No generic replacements.',
    icon: <ArrowRightLeft className="h-5 w-5" />,
    selector: '[data-tour="find-alternative"]',
    position: 'left',
  },
  {
    id: 'regenerate',
    title: 'Regenerate Entire Days',
    description: 'Want a completely fresh take? Hit "Regenerate" to get an entirely new set of AI-curated activities for any day. Locked activities stay put, everything else gets reimagined.',
    icon: <RefreshCw className="h-5 w-5" />,
    selector: '[data-tour="regenerate-button"]',
    position: 'bottom',
  },
  {
    id: 'lock-activity',
    title: 'Lock Your Favorites',
    description: 'Love an activity? Lock it down. Locked activities are protected when you regenerate or optimize. They\'ll never be moved or replaced.',
    icon: <Lock className="h-5 w-5" />,
    selector: '[data-tour="lock-button"]',
    position: 'left',
  },
  {
    id: 'more-actions',
    title: 'Move, Reorder & Customize',
    description: 'Use the ⋯ menu to move activities between days, reorder within a day, or remove them entirely. You\'re in full control of your itinerary.',
    icon: <MoreHorizontal className="h-5 w-5" />,
    selector: '[data-tour="more-actions"]',
    position: 'left',
  },
  {
    id: 'currency',
    title: 'Local Currency Toggle',
    description: 'Switch between local currency and USD to see real costs in the format you prefer. Great for on-the-ground budgeting.',
    icon: <Globe className="h-5 w-5" />,
    selector: '[data-tour="currency-toggle"]',
    position: 'bottom',
  },
  {
    id: 'share',
    title: 'Share With Travel Companions',
    description: 'Send your itinerary to friends, family, or your travel group. They can view the full plan and collaborate on changes.',
    icon: <Share2 className="h-5 w-5" />,
    selector: '[data-tour="share-button"]',
    position: 'bottom',
  },
  {
    id: 'save',
    title: 'Save Your Changes',
    description: 'Your edits are tracked automatically, but hit Save to make them permanent. You can always come back and refine later.',
    icon: <Save className="h-5 w-5" />,
    selector: '[data-tour="save-button"]',
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
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const { requestPopup, closePopup } = usePopupCoordination();
  const { user } = useAuth();

  // Clear stale tour flags when a different user signs in
  useEffect(() => {
    if (!user) return;
    const completedVal = localStorage.getItem(STORAGE_KEY);
    if (completedVal && completedVal !== user.id) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  // Show tour only once per user, gated through popup coordination
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(STORAGE_KEY) === user.id) return;

    const timer = setTimeout(() => {
      const allowed = requestPopup('itinerary_tour');
      if (allowed) {
        setIsVisible(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [user, requestPopup]);

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
    if (user?.id) localStorage.setItem(STORAGE_KEY, user.id);
    setIsVisible(false);
    closePopup('itinerary_tour');
    onComplete?.();
  }, [onComplete, closePopup, user]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

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
