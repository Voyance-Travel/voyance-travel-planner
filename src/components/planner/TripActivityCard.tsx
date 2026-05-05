import { motion } from 'framer-motion';
import { Clock, MapPin, DollarSign, Lock, LockOpen, ExternalLink, Target, Landmark, UtensilsCrossed, Building2, Plane, Bus, Coffee, Moon, Leaf, Mountain, Palette, Heart, ShoppingBag, CheckCircle2, Sparkles } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getActivityIconName, getActivityColor, formatDuration } from '@/utils/plannerUtils';
import { trackActivityClick } from '@/services/behaviorTrackingService';
import { sanitizeActivityName, sanitizeActivityText } from '@/utils/activityNameSanitizer';
import { formatTime12h } from '@/utils/timeFormat';
import { ExplainableActivity } from '@/components/itinerary/ExplainableActivity';
import type { TripActivity } from '@/types/trip';

// Map icon names to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Landmark, UtensilsCrossed, Building2, Plane, Bus, Coffee, Moon, Leaf, Mountain, Palette, Heart, ShoppingBag, MapPin
};

interface TripActivityCardProps {
  activity: TripActivity;
  currency?: string;
  destination?: string;
  tripType?: string;
  budget?: string;
  travelers?: number;
  onToggleLock?: (activityId: string, locked: boolean) => void;
  onEdit?: (activity: TripActivity) => void;
  onDelete?: (activityId: string) => void;
  onActivityUpdate?: (activity: TripActivity) => void;
  showExplain?: boolean;
  onOpenConcierge?: (activity: TripActivity) => void;
}

const TripActivityCard: React.FC<TripActivityCardProps> = ({
  activity,
  currency = "USD",
  destination = "",
  tripType,
  budget,
  travelers,
  onToggleLock,
  onEdit,
  onDelete: _onDelete,
  onActivityUpdate: _onActivityUpdate,
  showExplain = false,
  onOpenConcierge,
}) => {
  const categoryColor = getActivityColor(activity.category || activity.type);
  const iconName = getActivityIconName(activity.type);
  const IconComponent = iconMap[iconName] || MapPin;

  // Determine if concierge should be shown
  const cat = (activity.category || activity.type || '').toUpperCase();
  const title = activity.name || '';
  const hideConcierge =
    ['TRANSPORT', 'TRAVEL', 'LOGISTICS', 'TRANSIT'].includes(cat) ||
    /Return to Your Hotel|Freshen Up|Arrival Flight|Departure/i.test(title);
  const showConcierge = onOpenConcierge && !hideConcierge;

  const handleCardClick = () => {
    trackActivityClick(
      activity.id,
      activity.name,
      activity.category || activity.type,
      destination
    );
  };

  const cardContent = (
    <motion.div
      layout
      className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-4" onClick={(e) => e.stopPropagation()}>
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoryColor}`}>
          <IconComponent className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium text-foreground">{sanitizeActivityName(activity.name)}</h4>
              {(() => { const d = sanitizeActivityText(activity.description); return d ? (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {d}
                </p>
              ) : null; })()}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {showConcierge && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onOpenConcierge(activity)}
                  title="Ask AI concierge"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                </Button>
              )}
              {onToggleLock && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
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
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            {activity.startTime && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {formatTime12h(activity.startTime)}
                  {activity.endTime && ` - ${formatTime12h(activity.endTime)}`}
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

          {/* Category & Reservation Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {activity.category && (
              <Badge className={categoryColor}>
                {activity.category}
              </Badge>
            )}
            {activity.reservationMade && (
              <Badge variant="default" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Reserved
              </Badge>
            )}
          </div>

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
            <SafeImage
              src={activity.imageUrl}
              alt={activity.name}
              className="w-full h-full object-cover"
              fallbackCategory={activity.category || activity.type}
            />
          </div>
        )}
      </div>
    </motion.div>
  );

  // Wrap with ExplainableActivity if showExplain is enabled
  if (showExplain && destination) {
    return (
      <ExplainableActivity
        activity={activity}
        tripContext={{
          destination,
          tripType,
          budget,
          travelers,
        }}
      >
        {cardContent}
      </ExplainableActivity>
    );
  }

  return cardContent;
};

export default TripActivityCard;
