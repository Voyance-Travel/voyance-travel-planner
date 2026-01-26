import { motion } from 'framer-motion';
import { Clock, MapPin, DollarSign, Lock, LockOpen, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getActivityIcon, getActivityColor, formatDuration } from '@/utils/plannerUtils';
import { trackActivityClick } from '@/services/behaviorTrackingService';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import type { TripActivity } from '@/types/trip';

interface TripActivityCardProps {
  activity: TripActivity;
  currency?: string;
  destination?: string;
  onToggleLock?: (activityId: string, locked: boolean) => void;
  onEdit?: (activity: TripActivity) => void;
  onDelete?: (activityId: string) => void;
  onActivityUpdate?: (activity: TripActivity) => void;
}

const TripActivityCard: React.FC<TripActivityCardProps> = ({
  activity,
  currency = "USD",
  destination = "",
  onToggleLock,
  onEdit,
  onDelete: _onDelete,
  onActivityUpdate: _onActivityUpdate
}) => {
  const categoryColor = getActivityColor(activity.category || activity.type);
  const icon = getActivityIcon(activity.type);

  const handleCardClick = () => {
    // Track activity interaction for personalization
    trackActivityClick(
      activity.id,
      activity.name,
      activity.category || activity.type,
      destination
    );
  };

  return (
    <motion.div
      layout
      className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-4" onClick={(e) => e.stopPropagation()}>
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${categoryColor}`}>
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium text-foreground">{sanitizeActivityName(activity.name)}</h4>
              {activity.description && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {activity.description}
                </p>
              )}
            </div>

            {/* Lock Toggle */}
            {onToggleLock && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => onToggleLock(activity.id, !activity.isLocked)}
              >
                {activity.isLocked ? (
                  <Lock className="h-4 w-4 text-primary" />
                ) : (
                  <LockOpen className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            )}
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            {activity.startTime && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {activity.startTime}
                  {activity.endTime && ` - ${activity.endTime}`}
                </span>
              </div>
            )}
            
            {activity.duration && (
              <Badge variant="secondary" className="text-xs">
                {formatDuration(activity.duration)}
              </Badge>
            )}

            {activity.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span className="truncate max-w-[150px]">
                  {typeof activity.location === 'string' 
                    ? activity.location 
                    : activity.location?.name || activity.location?.address || ''}
                </span>
              </div>
            )}

            {activity.price !== undefined && activity.price > 0 && (
              <div className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span>{activity.price.toLocaleString()} {currency}</span>
              </div>
            )}
          </div>

          {/* Category Badge */}
          {activity.category && (
            <Badge className={`mt-2 ${categoryColor}`}>
              {activity.category}
            </Badge>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(activity)}
                className="text-xs h-7"
              >
                Edit
              </Button>
            )}
            
            {activity.bookingUrl && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                asChild
              >
                <a href={activity.bookingUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Book
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Image */}
        {activity.imageUrl && (
          <div className="hidden sm:block w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
            <img
              src={activity.imageUrl}
              alt={activity.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TripActivityCard;
