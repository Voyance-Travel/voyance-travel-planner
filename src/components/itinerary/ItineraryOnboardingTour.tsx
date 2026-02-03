/**
 * Itinerary Onboarding Tour
 * 
 * A step-by-step tooltip walkthrough that introduces users to
 * key itinerary features on their first visit.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronRight, ChevronLeft, Lock, MoreHorizontal, 
  RefreshCw, Save, Calendar, Sparkles, ArrowRightLeft,
  Route, Globe, Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  selector?: string; // CSS selector to highlight (optional)
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Your Itinerary! ✨',
    description: 'This is your personalized travel plan. Let me show you how to customize it to make it perfect for your trip.',
    icon: <Sparkles className="h-5 w-5" />,
    position: 'center',
  },
  {
    id: 'optimize',
    title: 'Optimize Your Route',
    description: 'Click Optimize to intelligently reorder activities and minimize travel time between stops, typically saving ~30 minutes per day.',
    icon: <Route className="h-5 w-5" />,
    selector: '[data-tour="optimize-button"]',
    position: 'bottom',
  },
  {
    id: 'currency',
    title: 'Switch Currencies',
    description: 'Toggle between local currency and USD to see costs in your preferred format. Great for budgeting!',
    icon: <Globe className="h-5 w-5" />,
    selector: '[data-tour="currency-toggle"]',
    position: 'bottom',
  },
  {
    id: 'share',
    title: 'Share Your Trip',
    description: 'Share your itinerary with travel companions or save it for later. They can view and collaborate on the plan.',
    icon: <Share2 className="h-5 w-5" />,
    selector: '[data-tour="share-button"]',
    position: 'bottom',
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
    id: 'lock-activity',
    title: 'Lock Your Favorites',
    description: 'Love an activity? Click the lock icon to protect it from changes when regenerating the day.',
    icon: <Lock className="h-5 w-5" />,
    selector: '[data-tour="lock-button"]',
    position: 'left',
  },
  {
    id: 'find-alternative',
    title: 'Find Alternatives',
    description: 'Click "Find Alternative" on any activity to swap it for something else that matches your style.',
    icon: <MoreHorizontal className="h-5 w-5" />,
    selector: '[data-tour="find-alternative"]',
    position: 'left',
  },
  {
    id: 'more-actions',
    title: 'Move & Organize',
    description: 'Click the ⋯ menu to move activities up/down, transfer to another day, or remove them.',
    icon: <MoreHorizontal className="h-5 w-5" />,
    selector: '[data-tour="more-actions"]',
    position: 'left',
  },
  {
    id: 'regenerate',
    title: 'Regenerate Days',
    description: 'Want a fresh take? Click "Regenerate" to get new activity suggestions for any day. Locked activities stay put!',
    icon: <RefreshCw className="h-5 w-5" />,
    selector: '[data-tour="regenerate-button"]',
    position: 'bottom',
  },
  {
    id: 'save',
    title: 'Save Your Changes',
    description: 'Don\'t forget to save! Your changes are auto-tracked, but hit Save to make them permanent.',
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

  // Check if tour should show
  useEffect(() => {
    const completedTours = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!completedTours.includes(tripId)) {
      // Small delay to let the page render first
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [tripId]);

  // Update highlight position when step changes or window resizes/scrolls
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

    // Initial update with small delay to allow scroll to settle
    const step = TOUR_STEPS[currentStep];
    if (step?.selector) {
      const element = document.querySelector(step.selector);
      if (element) {
        // Scroll element into view first
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Wait for scroll to complete, then update position
        const scrollTimer = setTimeout(() => {
          updateHighlight();
        }, 400);
        
        // Add listeners for dynamic updates
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
          // Only update if position changed significantly
          setHighlightRect(prev => {
            if (!prev) return rect;
            const hasChanged = Math.abs(prev.top - rect.top) > 2 || 
                               Math.abs(prev.left - rect.left) > 2;
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
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, []);

  const handleComplete = useCallback(() => {
    const completedTours = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!completedTours.includes(tripId)) {
      completedTours.push(tripId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedTours));
    }
    setIsVisible(false);
    onComplete?.();
  }, [tripId, onComplete]);

  if (!isVisible) return null;

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const isCentered = step.position === 'center' || !highlightRect;

  // Calculate tooltip position - always center horizontally on screen for consistency
  const getTooltipStyle = (): React.CSSProperties => {
    if (isCentered || !highlightRect) {
      return {};
    }

    const padding = 20;
    const tooltipHeight = 220;

    switch (step.position) {
      case 'bottom':
        return {
          top: highlightRect.bottom + padding,
        };
      case 'top':
        return {
          bottom: window.innerHeight - highlightRect.top + padding,
        };
      case 'left':
        return {
          top: Math.min(
            Math.max(highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2, padding),
            window.innerHeight - tooltipHeight - padding
          ),
        };
      case 'right':
        return {
          top: Math.min(
            Math.max(highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2, padding),
            window.innerHeight - tooltipHeight - padding
          ),
        };
      default:
        return {};
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Click-to-dismiss layer - transparent, only for capturing clicks outside spotlight */}
        <div 
          className="absolute inset-0 pointer-events-auto"
          onClick={handleSkip}
        />

        {/* Spotlight cutout - positioned over target element */}
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

        {/* Tooltip card - mobile-optimized positioning */}
        <div 
          className="pointer-events-auto fixed inset-x-0 flex justify-center px-3 sm:px-4"
          style={{ 
            zIndex: 102,
            // On mobile, always position at bottom of screen for consistency
            // On desktop, position relative to highlighted element
            ...(typeof window !== 'undefined' && window.innerWidth < 640 
              // Leave room for the floating chat button on mobile
              ? { bottom: 96 } 
              : step.position === 'bottom' && highlightRect 
                ? { top: Math.min(highlightRect.bottom + 20, window.innerHeight - 280) } 
                : step.position === 'top' && highlightRect 
                  ? { bottom: window.innerHeight - highlightRect.top + 20 } 
                  : step.position === 'left' && highlightRect 
                    ? { top: Math.max(highlightRect.top + highlightRect.height / 2 - 110, 20) } 
                    : step.position === 'right' && highlightRect 
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
            className="w-full sm:w-[320px] max-w-[calc(100vw-1.5rem)] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          >
          {/* Header - more compact on mobile */}
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

          {/* Content - tighter padding on mobile */}
          <div className="p-3 sm:p-4">
            <h3 className="font-serif text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">{step.title}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Footer with navigation - compact on mobile */}
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

            {/* Progress dots - smaller on mobile */}
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
              <span className="text-xs sm:text-sm">{isLast ? 'Start' : 'Next'}</span>
              {!isLast && <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />}
            </Button>
          </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

// Hook to reset tour (for testing or user preference)
export function useResetItineraryTour() {
  return useCallback((tripId?: string) => {
    if (tripId) {
      const completedTours = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const filtered = completedTours.filter((id: string) => id !== tripId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);
}
