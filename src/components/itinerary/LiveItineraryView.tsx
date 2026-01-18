import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, isToday, isBefore, isAfter, parseISO, startOfDay } from 'date-fns';
import { 
  Calendar, Sun, Cloud, Sparkles, TrendingUp, 
  ChevronLeft, ChevronRight, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LiveActivityCard } from './LiveActivityCard';
import { useTripFeedback, useUserPreferenceInsights } from '@/services/activityFeedbackAPI';
import { cn } from '@/lib/utils';

interface Activity {
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
}

interface ItineraryDay {
  dayNumber: number;
  date: string;
  theme?: string;
  description?: string;
  activities: Activity[];
  weather?: {
    condition?: string;
    high?: number;
    low?: number;
  };
}

interface LiveItineraryViewProps {
  tripId: string;
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: ItineraryDay[];
  onActivityComplete?: (activityId: string) => void;
  onActivitySkip?: (activityId: string) => void;
}

export function LiveItineraryView({
  tripId,
  tripName,
  destination,
  startDate,
  endDate,
  days,
  onActivityComplete,
  onActivitySkip
}: LiveItineraryViewProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [completedActivities, setCompletedActivities] = useState<Set<string>>(new Set());
  const [skippedActivities, setSkippedActivities] = useState<Set<string>>(new Set());
  
  const { data: tripFeedback } = useTripFeedback(tripId);
  const { data: insights } = useUserPreferenceInsights();

  // Determine the current day based on dates
  useEffect(() => {
    const today = new Date();
    const tripStart = parseISO(startDate);
    
    if (isBefore(today, tripStart)) {
      setSelectedDayIndex(0);
      return;
    }

    const dayIndex = days.findIndex(day => {
      const dayDate = parseISO(day.date);
      return isToday(dayDate);
    });
    
    if (dayIndex >= 0) {
      setSelectedDayIndex(dayIndex);
    }
  }, [startDate, days]);

  const currentDay = days[selectedDayIndex];
  
  // Calculate activity statuses based on time
  const getActivityStatus = (activity: Activity, index: number) => {
    if (completedActivities.has(activity.id)) return 'completed';
    if (skippedActivities.has(activity.id)) return 'skipped';
    
    // Check if this is today's itinerary
    const dayDate = parseISO(currentDay.date);
    if (!isToday(dayDate)) {
      return isBefore(dayDate, new Date()) ? 'completed' : 'upcoming';
    }
    
    // For today, check time
    if (!activity.startTime) {
      // If no time, use index-based logic
      const completedCount = [...completedActivities, ...skippedActivities].length;
      if (index < completedCount) return 'completed';
      if (index === completedCount) return 'current';
      return 'upcoming';
    }
    
    const now = new Date();
    const [hours, minutes] = activity.startTime.split(':').map(Number);
    const activityTime = new Date(dayDate);
    activityTime.setHours(hours, minutes);
    
    if (activity.endTime) {
      const [endHours, endMinutes] = activity.endTime.split(':').map(Number);
      const endTime = new Date(dayDate);
      endTime.setHours(endHours, endMinutes);
      
      if (isAfter(now, endTime)) return 'completed';
      if (isAfter(now, activityTime) && isBefore(now, endTime)) return 'current';
    } else {
      if (isAfter(now, activityTime)) {
        // Check if next activity has started
        const nextActivity = currentDay.activities[index + 1];
        if (nextActivity?.startTime) {
          const [nextHours, nextMinutes] = nextActivity.startTime.split(':').map(Number);
          const nextTime = new Date(dayDate);
          nextTime.setHours(nextHours, nextMinutes);
          if (isBefore(now, nextTime)) return 'current';
        } else {
          return 'current';
        }
      }
    }
    
    return 'upcoming';
  };

  const handleMarkComplete = (activityId: string) => {
    setCompletedActivities(prev => new Set([...prev, activityId]));
    onActivityComplete?.(activityId);
  };

  const handleSkip = (activityId: string) => {
    setSkippedActivities(prev => new Set([...prev, activityId]));
    onActivitySkip?.(activityId);
  };

  // Calculate trip progress
  const totalActivities = days.reduce((sum, day) => sum + day.activities.length, 0);
  const feedbackCount = tripFeedback?.length || 0;
  const progressPercent = totalActivities > 0 ? (feedbackCount / totalActivities) * 100 : 0;

  // Get day navigation
  const canGoPrev = selectedDayIndex > 0;
  const canGoNext = selectedDayIndex < days.length - 1;

  return (
    <div className="space-y-6">
      {/* Trip Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tripName}</h1>
          <div className="flex items-center gap-2 text-muted-foreground mt-1">
            <MapPin className="w-4 h-4" />
            <span>{destination}</span>
          </div>
        </div>
        
        {/* Trip Progress */}
        <Card className="w-48">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Trip Progress</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {feedbackCount} of {totalActivities} reviewed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Day Navigation */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedDayIndex(prev => prev - 1)}
          disabled={!canGoPrev}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2 justify-center">
            {days.map((day, index) => {
              const dayDate = parseISO(day.date);
              const isSelected = index === selectedDayIndex;
              const isTodayDay = isToday(dayDate);
              
              return (
                <button
                  key={day.dayNumber}
                  onClick={() => setSelectedDayIndex(index)}
                  className={cn(
                    'flex flex-col items-center px-4 py-2 rounded-lg transition-all min-w-[80px]',
                    isSelected 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted/50 hover:bg-muted',
                    isTodayDay && !isSelected && 'ring-2 ring-primary ring-offset-2'
                  )}
                >
                  <span className="text-xs font-medium">
                    {format(dayDate, 'EEE')}
                  </span>
                  <span className="text-lg font-bold">
                    {format(dayDate, 'd')}
                  </span>
                  {isTodayDay && (
                    <Badge variant="secondary" className="text-[10px] mt-1">
                      Today
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedDayIndex(prev => prev + 1)}
          disabled={!canGoNext}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Day Content */}
      {currentDay && (
        <motion.div
          key={currentDay.dayNumber}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          {/* Day Header */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Day {currentDay.dayNumber}: {currentDay.theme || format(parseISO(currentDay.date), 'EEEE')}
                  </CardTitle>
                  {currentDay.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentDay.description}
                    </p>
                  )}
                </div>
                
                {/* Weather */}
                {currentDay.weather && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {currentDay.weather.condition === 'sunny' ? (
                      <Sun className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Cloud className="w-5 h-5" />
                    )}
                    {currentDay.weather.high && (
                      <span className="text-sm">
                        {currentDay.weather.high}°
                        {currentDay.weather.low && ` / ${currentDay.weather.low}°`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Activities Timeline */}
          <div className="space-y-3">
            {currentDay.activities.map((activity, index) => (
              <LiveActivityCard
                key={activity.id}
                activity={activity}
                status={getActivityStatus(activity, index)}
                tripId={tripId}
                destination={destination}
                onMarkComplete={() => handleMarkComplete(activity.id)}
                onSkip={() => handleSkip(activity.id)}
              />
            ))}
          </div>

          {/* Empty state */}
          {currentDay.activities.length === 0 && (
            <Card className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium">No activities planned</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This is a free day to explore at your own pace
              </p>
            </Card>
          )}
        </motion.div>
      )}

      {/* AI Insights */}
      {insights?.insights_summary && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Your Travel Insights</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {insights.insights_summary}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default LiveItineraryView;
