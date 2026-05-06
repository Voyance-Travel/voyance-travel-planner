import { useState } from 'react';
import { openMapLocation } from '@/utils/mapNavigation';
import { motion } from 'framer-motion';
import { 
  Clock, MapPin, Check, Play, CircleDot, 
  Heart, MessageSquare, ChevronRight, Navigation
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ActivityFeedbackModal } from './ActivityFeedbackModal';
import { getActivityFallbackImage } from '@/utils/activityFallbackImages';
import { useActivityFeedback, type FeedbackRating } from '@/services/activityFeedbackAPI';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import { formatTime12h } from '@/utils/timeFormat';

type ActivityStatus = 'upcoming' | 'current' | 'completed' | 'skipped';

interface LiveActivityCardProps {
  activity: {
    id: string;
    name: string;
    description?: string;
    type?: string;
    category?: string;
    startTime?: string;
    endTime?: string;
    location?: {
      name?: string;
      address?: string;
      lat?: number;
      lng?: number;
    };
    imageUrl?: string;
  };
  status: ActivityStatus;
  tripId: string;
  destination?: string;
  onMarkComplete?: () => void;
  onSkip?: () => void;
  onGetDirections?: () => void;
}

const statusConfig: Record<ActivityStatus, { icon: React.ReactNode; color: string; label: string }> = {
  upcoming: { 
    icon: <CircleDot className="w-4 h-4" />, 
    color: 'text-muted-foreground border-muted', 
    label: 'Upcoming' 
  },
  current: { 
    icon: <Play className="w-4 h-4" />, 
    color: 'text-primary border-primary bg-primary/5', 
    label: 'Now' 
  },
  completed: { 
    icon: <Check className="w-4 h-4" />, 
    color: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5', 
    label: 'Done' 
  },
  skipped: { 
    icon: <Check className="w-4 h-4" />, 
    color: 'text-muted-foreground border-muted bg-muted/30 line-through', 
    label: 'Skipped' 
  }
};

const ratingIcons: Record<FeedbackRating, { icon: React.ReactNode; color: string }> = {
  loved: { icon: <Heart className="w-3 h-3 fill-current" />, color: 'text-rose-500' },
  liked: { icon: <Heart className="w-3 h-3" />, color: 'text-emerald-500' },
  neutral: { icon: <CircleDot className="w-3 h-3" />, color: 'text-amber-500' },
  disliked: { icon: <CircleDot className="w-3 h-3" />, color: 'text-slate-400' }
};

export function LiveActivityCard({
  activity,
  status,
  tripId,
  destination,
  onMarkComplete,
  onSkip,
  onGetDirections
}: LiveActivityCardProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const { data: feedback } = useActivityFeedback(activity.id);
  
  const config = statusConfig[status];
  const isCompleted = status === 'completed' || status === 'skipped';
  const isCurrent = status === 'current';

  const handleOpenMaps = () => {
    if (activity.location?.lat && activity.location?.lng) {
      openMapLocation({
        name: activity.name,
        lat: activity.location.lat,
        lng: activity.location.lng,
      });
    } else if (activity.location?.address) {
      openMapLocation({
        name: activity.name,
        address: activity.location.address,
      });
    } else if (activity.location?.name) {
      openMapLocation({ name: activity.location.name });
    }
    onGetDirections?.();
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'relative p-4 rounded-xl border-2 transition-all',
          config.color,
          isCurrent && 'shadow-lg shadow-primary/10'
        )}
      >
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {config.icon}
            <span className="text-xs font-medium uppercase tracking-wide">
              {config.label}
            </span>
            {activity.startTime && (
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {formatTime12h(activity.startTime)}
              </Badge>
            )}
          </div>
          
          {/* Feedback indicator */}
          {feedback && (
            <div className={cn('flex items-center gap-1', ratingIcons[feedback.rating].color)}>
              {ratingIcons[feedback.rating].icon}
              <span className="text-xs capitalize">{feedback.rating}</span>
            </div>
          )}
        </div>

        {/* Activity Content */}
        <div className="flex gap-4">
          {/* Image */}
          {(activity.imageUrl || true) && (
            <div className="hidden sm:block w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={activity.imageUrl || getActivityFallbackImage(activity.type, activity.name)}
                alt={activity.name}
                className={cn(
                  'w-full h-full object-cover',
                  isCompleted && 'grayscale opacity-60'
                )}
                onError={(e) => {
                  const fallback = getActivityFallbackImage(activity.type, activity.name);
                  if (e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  }
                }}
              />
            </div>
          )}

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h4 className={cn(
              'font-semibold text-foreground',
              status === 'skipped' && 'line-through text-muted-foreground'
            )}>
              {sanitizeActivityName(activity.name, { category: (activity as any).category, startTime: (activity as any).startTime, activity: activity as any })}
            </h4>
            
            {activity.description?.trim() && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {activity.description}
              </p>
            )}

            {activity.location && (
              <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  {typeof activity.location === 'string' 
                    ? activity.location 
                    : activity.location?.name || activity.location?.address || ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-4">
          {isCurrent && (
            <>
              <Button
                size="sm"
                onClick={handleOpenMaps}
                variant="outline"
                className="flex-1"
              >
                <Navigation className="w-4 h-4 mr-1" />
                Directions
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onMarkComplete?.();
                  setShowFeedback(true);
                }}
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-1" />
                Done
              </Button>
            </>
          )}

          {isCompleted && !feedback && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFeedback(true)}
              className="w-full"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              How was it?
            </Button>
          )}

          {isCompleted && feedback && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowFeedback(true)}
              className="w-full text-muted-foreground"
            >
              <ChevronRight className="w-4 h-4 mr-1" />
              Update feedback
            </Button>
          )}

          {status === 'upcoming' && onSkip && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onSkip}
              className="text-muted-foreground"
            >
              Skip this
            </Button>
          )}
        </div>

        {/* Current activity highlight */}
        {isCurrent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -left-0.5 top-4 bottom-4 w-1 bg-primary rounded-full"
          />
        )}
      </motion.div>

      {/* Feedback Modal */}
      <ActivityFeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        activity={activity}
        tripId={tripId}
        destination={destination}
      />
    </>
  );
}

export default LiveActivityCard;
