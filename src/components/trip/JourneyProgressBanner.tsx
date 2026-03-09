/**
 * Journey Progress Banner
 * 
 * Shows a persistent bottom banner during multi-city journey generation.
 * Displays progress dots for each leg with navigation to completed legs.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Circle, AlertCircle, ChevronRight, Route, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useJourneyProgress, type JourneyProgress, type LegStatus } from '@/hooks/useJourneyProgress';

interface JourneyProgressBannerProps {
  tripId: string;
  onRetry?: (legTripId: string) => void;
}

function LegDot({ 
  status, 
  city, 
  order, 
  isCurrent, 
  onClick 
}: { 
  status: LegStatus; 
  city: string; 
  order: number; 
  isCurrent: boolean;
  onClick?: () => void;
}) {
  const isClickable = status === 'ready';
  
  return (
    <button
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={cn(
        "flex flex-col items-center gap-1 transition-all",
        isClickable && "cursor-pointer hover:scale-105",
        !isClickable && "cursor-default"
      )}
    >
      <div className={cn(
        "relative w-8 h-8 rounded-full flex items-center justify-center transition-all",
        status === 'ready' && "bg-primary text-primary-foreground",
        status === 'generating' && "bg-primary/20 border-2 border-primary",
        status === 'pending' && "bg-muted border border-border",
        status === 'failed' && "bg-destructive/20 border-2 border-destructive",
        isCurrent && status === 'generating' && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}>
        {status === 'ready' && <Check className="h-4 w-4" />}
        {status === 'generating' && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
        {status === 'pending' && <Circle className="h-3 w-3 text-muted-foreground" />}
        {status === 'failed' && <AlertCircle className="h-4 w-4 text-destructive" />}
      </div>
      <span className={cn(
        "text-xs font-medium truncate max-w-[60px]",
        status === 'ready' && "text-foreground",
        status === 'generating' && "text-primary",
        status === 'pending' && "text-muted-foreground",
        status === 'failed' && "text-destructive"
      )}>
        {city}
      </span>
    </button>
  );
}

export function JourneyProgressBanner({ tripId, onRetry }: JourneyProgressBannerProps) {
  const navigate = useNavigate();
  const { progress, isPartOfJourney, retryFailedLeg } = useJourneyProgress({ 
    tripId, 
    enabled: true,
    pollInterval: 3000,
  });

  // Don't show if not part of a journey or if journey is complete
  if (!isPartOfJourney || !progress || progress.isComplete) {
    return null;
  }

  const handleLegClick = (legTripId: string) => {
    if (legTripId !== tripId) {
      navigate(`/trip/${legTripId}`);
    }
  };

  const handleRetry = async (legTripId: string) => {
    await retryFailedLeg(legTripId);
    onRetry?.(legTripId);
    navigate(`/trip/${legTripId}?generate=true`);
  };

  const currentLeg = progress.legs.find((l) => l.order === progress.currentLegOrder);
  const overallProgress = progress.totalLegs > 0 
    ? Math.round((progress.completedLegs / progress.totalLegs) * 100) 
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border shadow-lg"
      >
        <div className="container max-w-4xl mx-auto px-4 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {progress.isGenerating ? 'Generating Your Journey' : 'Journey Progress'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {progress.completedLegs}/{progress.totalLegs} cities
            </span>
          </div>

          {/* Progress Bar */}
          <Progress value={overallProgress} className="h-1.5 mb-4" />

          {/* Leg Dots */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
            {progress.legs.map((leg, idx) => (
              <div key={leg.tripId} className="flex items-center">
                <LegDot
                  status={leg.autoChainFailed ? 'failed' : leg.status}
                  city={leg.city}
                  order={leg.order}
                  isCurrent={leg.order === progress.currentLegOrder}
                  onClick={() => handleLegClick(leg.tripId)}
                />
                {idx < progress.legs.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
                )}
              </div>
            ))}
          </div>

          {/* Status Message */}
          <div className="text-center mt-2">
            {progress.isGenerating && currentLeg && (
              <p className="text-sm text-muted-foreground">
                Creating your {currentLeg.city} itinerary...
                {currentLeg.totalDays > 0 && currentLeg.completedDays > 0 && (
                  <span className="ml-1">
                    ({currentLeg.completedDays}/{currentLeg.totalDays} days)
                  </span>
                )}
              </p>
            )}
            {progress.hasFailed && (
              <div className="flex items-center justify-center gap-2">
                <p className="text-sm text-destructive">
                  Auto-generation paused. Manual retry available.
                </p>
                {progress.legs.find((l) => l.autoChainFailed) && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 gap-1"
                    onClick={() => handleRetry(progress.legs.find((l) => l.autoChainFailed)!.tripId)}
                  >
                    <Sparkles className="h-3 w-3" />
                    Retry
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
