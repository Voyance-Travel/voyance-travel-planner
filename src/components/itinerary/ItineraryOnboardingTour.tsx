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
  RefreshCw, Save, Calendar, Sparkles, ArrowRightLeft
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
    id: 'more-actions',
    title: 'More Actions Menu',
    description: 'Click the ⋯ menu to move activities up/down, transfer them to another day, find alternatives, or remove them.',
    icon: <MoreHorizontal className="h-5 w-5" />,
    selector: '[data-tour="more-actions"]',
    position: 'left',
  },
  {
    id: 'find-alternative',
    title: 'Find Alternatives',
    description: 'Not feeling an activity? Use "Find alternative" to discover similar options that match your preferences.',
    icon: <ArrowRightLeft className="h-5 w-5" />,
    position: 'center',
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

  // Update highlight position when step changes
  useEffect(() => {
    const step = TOUR_STEPS[currentStep];
    if (step?.selector) {
      const element = document.querySelector(step.selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);
        // Scroll element into view if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setHighlightRect(null);
      }
    } else {
      setHighlightRect(null);
    }
  }, [currentStep]);

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

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (isCentered || !highlightRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 16;
    const tooltipWidth = 320;
    const tooltipHeight = 200;

    switch (step.position) {
      case 'bottom':
        return {
          top: highlightRect.bottom + padding,
          left: Math.min(
            Math.max(highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2, padding),
            window.innerWidth - tooltipWidth - padding
          ),
        };
      case 'top':
        return {
          bottom: window.innerHeight - highlightRect.top + padding,
          left: Math.min(
            Math.max(highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2, padding),
            window.innerWidth - tooltipWidth - padding
          ),
        };
      case 'left':
        return {
          top: Math.min(
            Math.max(highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2, padding),
            window.innerHeight - tooltipHeight - padding
          ),
          right: window.innerWidth - highlightRect.left + padding,
        };
      case 'right':
        return {
          top: Math.min(
            Math.max(highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2, padding),
            window.innerHeight - tooltipHeight - padding
          ),
          left: highlightRect.right + padding,
        };
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Backdrop with spotlight cutout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-auto"
          onClick={handleSkip}
        >
          <svg className="w-full h-full">
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {highlightRect && (
                  <rect
                    x={highlightRect.left - 8}
                    y={highlightRect.top - 8}
                    width={highlightRect.width + 16}
                    height={highlightRect.height + 16}
                    rx="8"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.75)"
              mask="url(#spotlight-mask)"
            />
          </svg>
        </motion.div>

        {/* Highlight ring around target element */}
        {highlightRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute pointer-events-none"
            style={{
              top: highlightRect.top - 8,
              left: highlightRect.left - 8,
              width: highlightRect.width + 16,
              height: highlightRect.height + 16,
            }}
          >
            <div className="w-full h-full rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse" />
          </motion.div>
        )}

        {/* Tooltip card */}
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute pointer-events-auto w-[320px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          style={getTooltipStyle()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
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
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-serif text-lg font-semibold mb-2">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Footer with navigation */}
          <div className="flex items-center justify-between p-4 pt-2 border-t border-border bg-secondary/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={isFirst}
              className={cn(isFirst && "invisible")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    idx === currentStep
                      ? "bg-primary w-4"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                />
              ))}
            </div>

            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1"
            >
              {isLast ? 'Get Started' : 'Next'}
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </motion.div>
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
