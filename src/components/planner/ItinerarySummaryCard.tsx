import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Lock,
  MapPin,
  Utensils,
  Camera,
  Building,
  Car
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { sanitizeActivityText } from '@/utils/activityNameSanitizer';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import { formatTime12h, parseTimeToMinutes } from '@/utils/timeFormat';

interface Activity {
  id: string;
  title: string;
  time: string;
  type: 'activity' | 'meal' | 'hotel' | 'transport';
  description?: string;
  location?: string | { name?: string; address?: string };
  price?: number;
  duration?: string;
}

interface DayItinerary {
  day: number;
  date: Date;
  activities: Activity[];
  notes?: string;
}

interface ItinerarySummaryCardProps {
  itineraryDays: DayItinerary[];
  isBooked: boolean;
  className?: string;
}

const activityIcons: Record<string, React.ElementType> = {
  meal: Utensils,
  activity: Camera,
  hotel: Building,
  transport: Car,
};

export default function ItinerarySummaryCard({
  itineraryDays,
  isBooked = false,
  className
}: ItinerarySummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedDays, setExpandedDays] = useState<number[]>([]);

  const formatDate = (date: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const getActivityTimeOfDay = (time: string) => {
    const minutes = parseTimeToMinutes(time);
    const hour = Math.floor(minutes / 60);
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const toggleDayExpansion = (day: number) => {
    setExpandedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const toggleAllDays = () => {
    if (isExpanded) {
      setExpandedDays([]);
    } else {
      setExpandedDays(itineraryDays.map(d => d.day));
    }
    setIsExpanded(!isExpanded);
  };

  const getActivityIcon = (type: string) => {
    return activityIcons[type] || MapPin;
  };

  return (
    <motion.div
      className={cn('bg-card rounded-xl shadow-md overflow-hidden', className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-accent p-4 text-primary-foreground flex justify-between items-center">
        <h2 className="text-xl font-semibold">Daily Itinerary</h2>
        <button
          onClick={toggleAllDays}
          className="flex items-center text-primary-foreground text-sm font-medium hover:underline"
        >
          {isExpanded ? (
            <>
              <span>Collapse</span>
              <ChevronUp size={16} className="ml-1" />
            </>
          ) : (
            <>
              <span>Expand All</span>
              <ChevronDown size={16} className="ml-1" />
            </>
          )}
        </button>
      </div>

      <div className="relative">
        {/* Booking required overlay */}
        {!isBooked && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
            <div className="bg-card p-6 rounded-xl shadow-lg text-center max-w-md">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Complete Booking to View Full Itinerary
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Your personalized day-by-day itinerary will be available after you confirm your trip booking.
              </p>
              <button className="bg-accent text-accent-foreground px-6 py-2 rounded-lg hover:bg-accent/90 transition-colors">
                Complete Booking
              </button>
            </div>
          </div>
        )}

        {/* Itinerary Days */}
        <div className="divide-y divide-border">
          {itineraryDays.map((day) => {
            const isDayExpanded = expandedDays.includes(day.day);
            const IconComponent = MapPin;
            
            return (
              <div key={day.day} className="bg-card">
                {/* Day Header */}
                <button
                  onClick={() => toggleDayExpansion(day.day)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        Day {day.day}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(day.date)}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-foreground">
                        {day.activities.length} Activities
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {Array.from(new Set(day.activities.map(a => getActivityTimeOfDay(a.time)))).join(', ')}
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-5 h-5 text-muted-foreground transition-transform',
                      isDayExpanded && 'rotate-180'
                    )}
                  />
                </button>

                {/* Day Activities */}
                <AnimatePresence>
                  {isDayExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-6 pb-4"
                    >
                      <div className="space-y-3">
                        {day.activities.map((activity) => {
                          const ActivityIcon = getActivityIcon(activity.type);
                          return (
                            <div
                              key={activity.id}
                              className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg"
                            >
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <ActivityIcon className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-medium text-foreground">
                                      {sanitizeActivityName(activity.title, { category: (activity as any).category, startTime: (activity as any).startTime, activity: activity as any })}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        {formatTime12h(activity.time)}
                                      </span>
                                      {activity.duration && (
                                        <span>• {activity.duration}</span>
                                      )}
                                      {activity.location && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="w-4 h-4" />
                                          {typeof activity.location === 'string' 
                                            ? activity.location 
                                            : activity.location.name || activity.location.address}
                                        </span>
                                      )}
                                    </div>
                                    {(() => { const d = sanitizeActivityText(activity.description); return d ? (
                                      <p className="text-sm text-muted-foreground mt-2">
                                        {d}
                                      </p>
                                    ) : null; })()}
                                  </div>
                                  {activity.price && (
                                    <span className="text-sm font-medium text-foreground flex items-center gap-1">
                                      <DollarSign className="w-4 h-4" />
                                      {activity.price}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {day.notes && (
                        <div className="mt-4 p-3 bg-primary/5 rounded-lg">
                          <p className="text-sm text-primary">
                            <strong>Note:</strong> {day.notes}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
