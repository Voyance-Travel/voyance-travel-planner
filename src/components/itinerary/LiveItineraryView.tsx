import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isBefore, isAfter } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { 
  Calendar, Sun, Cloud, CloudRain, Sparkles, TrendingUp, 
  ChevronLeft, ChevronRight, MapPin, CheckCircle, Navigation, Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LiveActivityCard } from './LiveActivityCard';
import { useTripFeedback, useUserPreferenceInsights } from '@/services/activityFeedbackAPI';
import { useFeedbackTrigger } from '@/hooks/useFeedbackTrigger';
import { FeedbackPromptOverlay } from '@/components/feedback/FeedbackPromptOverlay';
import type { ActivityContext } from '@/types/feedback';
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

/** Derive clothing suggestion from weather */
function getWhatToWear(weather?: ItineraryDay['weather']): string | null {
  if (!weather?.high) return null;
  const high = weather.high;
  let suggestion = '';
  if (high > 85) suggestion = 'Light, breathable clothing and sun protection';
  else if (high >= 70) suggestion = 'Light layers, comfortable walking shoes';
  else if (high >= 55) suggestion = 'A light jacket and layers';
  else suggestion = 'Warm layers and a coat';

  const condition = weather.condition?.toLowerCase() || '';
  if (condition.includes('rain') || condition.includes('shower') || condition.includes('storm')) {
    suggestion += ', bring an umbrella';
  }
  return suggestion;
}

/** Get a weather icon component */
function WeatherIcon({ condition }: { condition?: string }) {
  const c = condition?.toLowerCase() || '';
  if (c.includes('rain') || c.includes('shower') || c.includes('storm')) {
    return <CloudRain className="w-5 h-5 text-blue-500" />;
  }
  if (c.includes('cloud') || c.includes('overcast')) {
    return <Cloud className="w-5 h-5 text-muted-foreground" />;
  }
  return <Sun className="w-5 h-5 text-amber-500" />;
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
  const [recentCompletedActivity, setRecentCompletedActivity] = useState<ActivityContext | null>(null);
  
  const { data: tripFeedback } = useTripFeedback(tripId);
  const { data: insights } = useUserPreferenceInsights();

  // Convert activities to feedback context format
  const currentDayActivities = useMemo((): ActivityContext[] => {
    if (!days[selectedDayIndex]) return [];
    return days[selectedDayIndex].activities.map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      type: a.type,
      startTime: a.startTime,
      endTime: a.endTime,
    }));
  }, [days, selectedDayIndex]);

  // Feedback trigger system
  const {
    currentPrompt,
    dismissPrompt,
    completePrompt,
  } = useFeedbackTrigger({
    tripId,
    destination,
    startDate,
    endDate,
    activities: currentDayActivities,
    recentCompletedActivity: recentCompletedActivity || undefined,
    enabled: true,
  });

  // Determine the current day based on dates
  useEffect(() => {
    const today = new Date();
    const tripStart = parseLocalDate(startDate);
    
    if (isBefore(today, tripStart)) {
      setSelectedDayIndex(0);
      return;
    }

    const dayIndex = days.findIndex(day => {
      const dayDate = parseLocalDate(day.date);
      return isToday(dayDate);
    });
    
    if (dayIndex >= 0) {
      setSelectedDayIndex(dayIndex);
    }
  }, [startDate, days]);

  const currentDay = days[selectedDayIndex];
  const isTodaySelected = currentDay ? isToday(parseLocalDate(currentDay.date)) : false;
  
  // Calculate activity statuses based on time
  const getActivityStatus = useCallback((activity: Activity, index: number) => {
    if (completedActivities.has(activity.id)) return 'completed';
    if (skippedActivities.has(activity.id)) return 'skipped';
    
    const dayDate = parseLocalDate(currentDay.date);
    if (!isToday(dayDate)) {
      return isBefore(dayDate, new Date()) ? 'completed' : 'upcoming';
    }
    
    if (!activity.startTime) {
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
  }, [completedActivities, skippedActivities, currentDay]);

  // Find current & next activity for spotlight
  const { currentActivity, currentActivityIndex, nextActivity } = useMemo(() => {
    if (!currentDay || !isTodaySelected) return { currentActivity: null, currentActivityIndex: -1, nextActivity: null };
    
    let curActivity: Activity | null = null;
    let curIdx = -1;
    let nxtActivity: Activity | null = null;
    
    for (let i = 0; i < currentDay.activities.length; i++) {
      const status = getActivityStatus(currentDay.activities[i], i);
      if (status === 'current') {
        curActivity = currentDay.activities[i];
        curIdx = i;
        nxtActivity = currentDay.activities[i + 1] || null;
        break;
      }
    }
    
    // If no current, find first upcoming
    if (!curActivity) {
      for (let i = 0; i < currentDay.activities.length; i++) {
        const status = getActivityStatus(currentDay.activities[i], i);
        if (status === 'upcoming') {
          nxtActivity = currentDay.activities[i];
          break;
        }
      }
    }
    
    return { currentActivity: curActivity, currentActivityIndex: curIdx, nextActivity: nxtActivity };
  }, [currentDay, isTodaySelected, getActivityStatus]);

  const handleMarkComplete = useCallback((activityId: string) => {
    setCompletedActivities(prev => new Set([...prev, activityId]));
    onActivityComplete?.(activityId);
    
    const activity = days[selectedDayIndex]?.activities.find(a => a.id === activityId);
    if (activity) {
      setRecentCompletedActivity({
        id: activity.id,
        name: activity.name,
        category: activity.category,
        type: activity.type,
        startTime: activity.startTime,
        endTime: activity.endTime,
        completedAt: new Date(),
      });
    }
  }, [days, selectedDayIndex, onActivityComplete]);

  const handleSkip = useCallback((activityId: string) => {
    setSkippedActivities(prev => new Set([...prev, activityId]));
    onActivitySkip?.(activityId);
  }, [onActivitySkip]);

  const handleOpenMaps = (activity: Activity) => {
    const query = activity.location?.lat && activity.location?.lng
      ? `${activity.location.lat},${activity.location.lng}`
      : encodeURIComponent(activity.location?.name || activity.name);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  // Calculate trip progress
  const totalActivities = days.reduce((sum, day) => sum + day.activities.length, 0);
  const feedbackCount = tripFeedback?.length || 0;
  const progressPercent = totalActivities > 0 ? (feedbackCount / totalActivities) * 100 : 0;

  const canGoPrev = selectedDayIndex > 0;
  const canGoNext = selectedDayIndex < days.length - 1;

  const whatToWear = getWhatToWear(currentDay?.weather);

  return (
    <div className="space-y-5">
      {/* ═══ Day Navigation Pills ═══ */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setSelectedDayIndex(prev => prev - 1)}
          disabled={!canGoPrev}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 justify-start sm:justify-center">
            {days.map((day, index) => {
              const dayDate = parseLocalDate(day.date);
              const isSelected = index === selectedDayIndex;
              const isTodayDay = isToday(dayDate);
              
              return (
                <button
                  key={day.dayNumber}
                  onClick={() => setSelectedDayIndex(index)}
                  className={cn(
                    'flex flex-col items-center px-3 py-2 rounded-lg transition-all min-w-[64px] sm:min-w-[80px]',
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
                    <Badge variant="secondary" className="text-[10px] mt-0.5 px-1.5 py-0">
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
          className="shrink-0"
          onClick={() => setSelectedDayIndex(prev => prev + 1)}
          disabled={!canGoNext}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* ═══ Day Content ═══ */}
      {currentDay && (
        <motion.div
          key={currentDay.dayNumber}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          {/* ─── 1. Today Header ─── */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-serif font-bold text-foreground truncate">
                Day {currentDay.dayNumber}: {currentDay.theme || format(parseLocalDate(currentDay.date), 'EEEE')}
              </h2>
              {currentDay.description && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {currentDay.description}
                </p>
              )}
              {whatToWear && isTodaySelected && (
                <p className="text-xs text-muted-foreground mt-1.5 italic">
                  What to wear: {whatToWear}
                </p>
              )}
            </div>
            
            {currentDay.weather && (
              <div className="flex items-center gap-1.5 shrink-0 bg-muted/50 rounded-lg px-2.5 py-1.5">
                <WeatherIcon condition={currentDay.weather.condition} />
                {currentDay.weather.high != null && (
                  <span className="text-sm font-medium">
                    {currentDay.weather.high}°
                    {currentDay.weather.low != null && (
                      <span className="text-muted-foreground font-normal"> / {currentDay.weather.low}°</span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ─── 2. "Right Now" Spotlight (today only) ─── */}
          {isTodaySelected && (
            <AnimatePresence mode="wait">
              {currentActivity ? (
                <motion.div
                  key={`current-${currentActivity.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                >
                  <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background shadow-md">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                        </span>
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Right Now</span>
                      </div>
                      
                      <h3 className="text-xl sm:text-2xl font-serif font-bold text-foreground mb-1">
                        {currentActivity.name}
                      </h3>
                      
                      {(currentActivity.startTime || currentActivity.endTime) && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {currentActivity.startTime}
                          {currentActivity.endTime && ` – ${currentActivity.endTime}`}
                        </p>
                      )}
                      
                      {currentActivity.location?.name && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{currentActivity.location.name}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => handleMarkComplete(currentActivity.id)}
                          className="gap-1.5"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Mark Done
                        </Button>
                        {currentActivity.location && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenMaps(currentActivity)}
                            className="gap-1.5"
                          >
                            <Navigation className="w-4 h-4" />
                            Directions
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="free-time"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                >
                  <Card className="border-dashed border-muted-foreground/30">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm font-medium text-foreground">Free time</p>
                      {nextActivity && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Your next activity{nextActivity.startTime ? ` starts at ${nextActivity.startTime}` : `: ${nextActivity.name}`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* ─── 3. "Up Next" Card (today only, when there's a current activity) ─── */}
          {isTodaySelected && currentActivity && nextActivity && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-muted/30">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Up Next</p>
                    <p className="text-sm font-medium text-foreground truncate">{nextActivity.name}</p>
                    {nextActivity.startTime && (
                      <p className="text-xs text-muted-foreground">{nextActivity.startTime}</p>
                    )}
                  </div>
                  {nextActivity.location?.name && (
                    <div className="text-xs text-muted-foreground shrink-0 text-right max-w-[120px] truncate">
                      {nextActivity.location.name}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ─── 4. "Feeling Spontaneous?" ─── */}
          {isTodaySelected && (
            <div className="flex justify-center">
              <button className="text-xs text-primary/70 hover:text-primary transition-colors flex items-center gap-1.5 py-1">
                <Compass className="w-3.5 h-3.5" />
                Feeling spontaneous? Explore nearby
              </button>
            </div>
          )}

          {/* ─── 5. Full Day Timeline ─── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isTodaySelected ? "Today's Full Schedule" : `Day ${currentDay.dayNumber} Schedule`}
            </h3>
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

      {/* Activities Reviewed Progress */}
      {feedbackCount > 0 && (
        <div className="flex items-center gap-3 px-1">
          <TrendingUp className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1">
            <Progress value={progressPercent} className="h-1.5" />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {feedbackCount}/{totalActivities} rated
          </span>
        </div>
      )}

      {/* Contextual Feedback Prompt Overlay */}
      <AnimatePresence>
        {currentPrompt && (
          <FeedbackPromptOverlay
            context={currentPrompt}
            tripId={tripId}
            onClose={dismissPrompt}
            onComplete={completePrompt}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default LiveItineraryView;
