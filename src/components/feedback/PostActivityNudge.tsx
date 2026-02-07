/**
 * PostActivityNudge
 * Gentle inline nudge shown on completed activities that haven't been rated yet.
 * Appears after check-in to encourage feedback without being intrusive.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActivityFeedbackModal } from '@/components/itinerary/ActivityFeedbackModal';
import { cn } from '@/lib/utils';

interface PostActivityNudgeProps {
  activityId: string;
  activityName: string;
  tripId: string;
  destination: string;
  activityType?: string;
  activityCategory?: string;
  isCompleted: boolean;
  hasRating: boolean;
}

const NUDGE_MESSAGES = [
  'How was it? Your feedback improves future trips.',
  'Quick take? Helps us learn what you love.',
  'Worth it? A quick rating helps us get smarter.',
  'Rate this one — it takes 5 seconds.',
];

export function PostActivityNudge({
  activityId,
  activityName,
  tripId,
  destination,
  activityType,
  activityCategory,
  isCompleted,
  hasRating,
}: PostActivityNudgeProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [message] = useState(() =>
    NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)]
  );

  // Don't show if not completed, already rated, or dismissed
  if (!isCompleted || hasRating || dismissed) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15"
      >
        <Star className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground flex-1">{message}</p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2.5 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
          onClick={() => setShowRating(true)}
        >
          Rate
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground"
          onClick={() => setDismissed(true)}
        >
          <X className="w-3 h-3" />
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
