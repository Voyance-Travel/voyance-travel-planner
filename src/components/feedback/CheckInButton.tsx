/**
 * CheckInButton
 * Prominent "I'm here" check-in button for activity cards.
 * Shows GPS proximity toast, animates on check-in, and auto-prompts rating.
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPinCheck, Check, Navigation, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ActivityFeedbackModal } from '@/components/itinerary/ActivityFeedbackModal';

interface CheckInButtonProps {
  activityId: string;
  activityName: string;
  tripId: string;
  destination: string;
  activityType?: string;
  activityCategory?: string;
  isCheckedIn: boolean;
  isNearby: boolean;
  distanceMeters?: number | null;
  onCheckIn: (activityId: string) => void;
}

export function CheckInButton({
  activityId,
  activityName,
  tripId,
  destination,
  activityType,
  activityCategory,
  isCheckedIn,
  isNearby,
  distanceMeters,
  onCheckIn,
}: CheckInButtonProps) {
  const [showRating, setShowRating] = useState(false);
  const [justCheckedIn, setJustCheckedIn] = useState(false);

  const handleCheckIn = useCallback(() => {
    onCheckIn(activityId);
    setJustCheckedIn(true);

    // Auto-prompt rating after 1.5s
    setTimeout(() => {
      setShowRating(true);
    }, 1500);
  }, [activityId, onCheckIn]);

  if (isCheckedIn) {
    return (
      <>
        <motion.div
          initial={justCheckedIn ? { scale: 0.8 } : false}
          animate={{ scale: 1 }}
          className="flex items-center gap-1.5"
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Check className="h-3.5 w-3.5" />
            Checked in
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-primary"
            onClick={() => setShowRating(true)}
          >
            <Star className="h-3 w-3" />
            Rate
          </Button>
        </motion.div>

        <ActivityFeedbackModal
          isOpen={showRating}
          onClose={() => setShowRating(false)}
          activity={{ id: activityId, name: activityName, type: activityType, category: activityCategory }}
          tripId={tripId}
          destination={destination}
        />
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={isNearby ? 'default' : 'outline'}
        className={cn(
          'h-8 gap-1.5 transition-all',
          isNearby && 'animate-pulse shadow-md'
        )}
        onClick={handleCheckIn}
      >
        <MapPinCheck className="h-3.5 w-3.5" />
        I'm here
      </Button>

      {/* Nearby indicator */}
      <AnimatePresence>
        {isNearby && distanceMeters != null && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1 text-[10px] text-primary font-medium"
          >
            <Navigation className="h-3 w-3" />
            {distanceMeters < 50 ? 'You\'re here!' : `${Math.round(distanceMeters)}m away`}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CheckInButton;
