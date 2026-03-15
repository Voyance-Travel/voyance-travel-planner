import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isBefore, isAfter } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { 
  Calendar, Sun, Cloud, CloudRain, Sparkles, TrendingUp, 
  ChevronLeft, ChevronRight, MapPin, CheckCircle, Navigation, Compass,
  Clock, SkipForward, MessageSquare, Plane, Train, Bus, Ship, Car
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTripFeedback, useUserPreferenceInsights, useActivityFeedback } from '@/services/activityFeedbackAPI';
import { useFeedbackTrigger } from '@/hooks/useFeedbackTrigger';
import { FeedbackPromptOverlay } from '@/components/feedback/FeedbackPromptOverlay';
import { ActivityFeedbackModal } from './ActivityFeedbackModal';
import { getActivityFallbackImage } from '@/utils/activityFallbackImages';
import SafeImage from '@/components/SafeImage';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import { openMapLocation } from '@/utils/mapNavigation';
import type { ActivityContext } from '@/types/feedback';
import { cn } from '@/lib/utils';
import { formatTime12h } from '@/utils/timeFormat';

// ── Types ────────────────────────────────────────────────────────────────────

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

type ActivityStatus = 'upcoming' | 'current' | 'completed' | 'skipped';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function WeatherIcon({ condition }: { condition?: string }) {
  const c = condition?.toLowerCase() || '';
  if (c.includes('rain') || c.includes('shower') || c.includes('storm')) {
    return <CloudRain className="w-4 h-4 text-blue-500" />;
  }
  if (c.includes('cloud') || c.includes('overcast')) {
    return <Cloud className="w-4 h-4 text-muted-foreground" />;
  }
  return <Sun className="w-4 h-4 text-amber-500" />;
}

function getTimeOfDay(startTime?: string): 'morning' | 'afternoon' | 'evening' {
  if (!startTime) return 'morning';
  const hour = parseInt(startTime.split(':')[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const TIME_LABELS: Record<string, { label: string; icon: string }> = {
  morning: { label: 'Morning', icon: '☀️' },
  afternoon: { label: 'Afternoon', icon: '🌤' },
  evening: { label: 'Evening', icon: '🌙' },
};

// ── Timeline Activity Card ───────────────────────────────────────────────────

function TimelineActivityCard({
  activity,
  status,
  isLast,
  tripId,
  destination,
  isPastDay,
  onMarkComplete,
  onSkip,
}: {
  activity: Activity;
  status: ActivityStatus;
  isLast: boolean;
  tripId: string;
  destination: string;
  isPastDay: boolean;
  onMarkComplete?: () => void;
  onSkip?: () => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const { data: feedback } = useActivityFeedback(activity.id);
  const isCurrent = status === 'current';
  const isCompleted = status === 'completed' || status === 'skipped';
  const isSkipped = status === 'skipped';

  const handleOpenMaps = () => {
    if (activity.location?.lat && activity.location?.lng) {
      openMapLocation({ name: activity.name, lat: activity.location.lat, lng: activity.location.lng });
    } else if (activity.location?.address) {
      openMapLocation({ name: activity.name, address: activity.location.address });
    } else if (activity.location?.name) {
      openMapLocation({ name: activity.location.name });
    }
  };

  // Inter-city transport: render as compact strip
  const isInterCity = activity.category?.startsWith('inter_city_') || activity.type?.startsWith('inter_city_');

  if (isInterCity) {
    const TransportIcon = (activity.category || activity.type || '').includes('flight') ? Plane
      : (activity.category || activity.type || '').includes('train') ? Train
      : (activity.category || activity.type || '').includes('bus') ? Bus
      : (activity.category || activity.type || '').includes('ferry') ? Ship
      : Car;

    return (
      <>
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-primary/40 bg-primary/10 shrink-0 z-10" />
            {!isLast && <div className="w-px flex-1 min-h-[20px] bg-border" />}
          </div>
          <div className={cn('flex-1 min-w-0', isLast ? 'pb-0' : 'pb-3')}>
            <div className="rounded-lg border border-primary/15 bg-primary/[0.03] px-3 py-2 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <TransportIcon className="h-3 w-3 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground truncate flex-1">
                {activity.name}
              </span>
              {activity.startTime && (
                <span className="text-xs font-semibold text-primary tabular-nums shrink-0">
                  {formatTime12h(activity.startTime)}
                </span>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-3"
      >
        {/* Timeline column */}
        <div className="flex flex-col items-center pt-1.5">
          <div className={cn(
            'w-3 h-3 rounded-full border-2 shrink-0 z-10',
            isCurrent && 'border-primary bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]',
            isCompleted && 'border-emerald-500 bg-emerald-500',
            status === 'upcoming' && 'border-border bg-background',
          )} />
          {!isLast && (
            <div className={cn(
              'w-px flex-1 min-h-[40px]',
              isCompleted ? 'bg-emerald-500/30' : 'bg-border'
            )} />
          )}
        </div>

        {/* Card content */}
        <div className={cn(
          'flex-1 pb-5 min-w-0',
          isLast && 'pb-0'
        )}>
          <div className={cn(
            'rounded-xl border p-3.5 transition-all',
            isCurrent && 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-md',
            isCompleted && !isSkipped && 'border-emerald-500/20 bg-emerald-500/5',
            isSkipped && 'border-muted bg-muted/20 opacity-60',
            status === 'upcoming' && 'border-border/60 bg-card hover:border-border',
          )}>
            {/* Time + status badge row */}
            <div className="flex items-center gap-2 mb-2">
              {activity.startTime && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime12h(activity.startTime)}
                  {activity.endTime && ` – ${formatTime12h(activity.endTime)}`}
                </span>
              )}
              {isCurrent && (
                <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 gap-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                  </span>
                  NOW
                </Badge>
              )}
              {isCompleted && !isSkipped && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-500/30">
                  ✓ Done
                </Badge>
              )}
              {isSkipped && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                  Skipped
                </Badge>
              )}
            </div>

            {/* Main content with image */}
            <div className="flex gap-3">
              {/* Image thumbnail */}
              <div className="hidden sm:block w-16 h-16 rounded-lg overflow-hidden shrink-0">
                <SafeImage
                  src={activity.imageUrl || getActivityFallbackImage(activity.type || activity.category, activity.name)}
                  alt={activity.name}
                  fallbackCategory={activity.category || activity.type}
                  className={cn(
                    'w-full h-full object-cover',
                    isCompleted && 'grayscale opacity-60'
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className={cn(
                  'font-serif text-base font-semibold text-foreground leading-snug',
                  isSkipped && 'line-through text-muted-foreground'
                )}>
                  {sanitizeActivityName(activity.name)}
                </h4>

                {activity.location?.name && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{activity.location.name}</span>
                  </div>
                )}

                {activity.description && !isSkipped && (
                  <p className="mt-1.5 text-xs text-muted-foreground/80 line-clamp-2 border-l-2 border-primary/20 pl-2 italic">
                    {activity.description}
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {!isPastDay && (
              <div className="flex items-center gap-2 mt-3">
                {isCurrent && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        onMarkComplete?.();
                        setShowFeedback(true);
                      }}
                      className="rounded-full gap-1.5 h-8 text-xs"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Done
                    </Button>
                    {activity.location && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOpenMaps}
                        className="rounded-full gap-1.5 h-8 text-xs"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Directions
                      </Button>
                    )}
                  </>
                )}

                {status === 'upcoming' && onSkip && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onSkip}
                    className="rounded-full gap-1 h-7 text-xs text-muted-foreground"
                  >
                    <SkipForward className="w-3 h-3" />
                    Skip
                  </Button>
                )}

                {isCompleted && !feedback && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowFeedback(true)}
                    className="rounded-full gap-1.5 h-8 text-xs w-full"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    How was it?
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

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

// ── Main Component ───────────────────────────────────────────────────────────

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

  useEffect(() => {
    const today = new Date();
    const tripStart = parseLocalDate(startDate);
    if (isBefore(today, tripStart)) {
      setSelectedDayIndex(0);
      return;
    }
    const dayIndex = days.findIndex(day => isToday(parseLocalDate(day.date)));
    if (dayIndex >= 0) setSelectedDayIndex(dayIndex);
  }, [startDate, days]);

  const currentDay = days[selectedDayIndex];
  const isTodaySelected = currentDay ? isToday(parseLocalDate(currentDay.date)) : false;
  const isPastDay = currentDay ? isBefore(parseLocalDate(currentDay.date), new Date()) && !isTodaySelected : false;
  
  const getActivityStatus = useCallback((activity: Activity, index: number): ActivityStatus => {
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
        const nextAct = currentDay.activities[index + 1];
        if (nextAct?.startTime) {
          const [nh, nm] = nextAct.startTime.split(':').map(Number);
          const nt = new Date(dayDate);
          nt.setHours(nh, nm);
          if (isBefore(now, nt)) return 'current';
        } else {
          return 'current';
        }
      }
    }
    return 'upcoming';
  }, [completedActivities, skippedActivities, currentDay]);

  const { currentActivity, nextActivity } = useMemo(() => {
    if (!currentDay || !isTodaySelected) return { currentActivity: null, nextActivity: null };
    let cur: Activity | null = null;
    let nxt: Activity | null = null;
    for (let i = 0; i < currentDay.activities.length; i++) {
      const s = getActivityStatus(currentDay.activities[i], i);
      if (s === 'current') {
        cur = currentDay.activities[i];
        nxt = currentDay.activities[i + 1] || null;
        break;
      }
    }
    if (!cur) {
      for (let i = 0; i < currentDay.activities.length; i++) {
        if (getActivityStatus(currentDay.activities[i], i) === 'upcoming') {
          nxt = currentDay.activities[i];
          break;
        }
      }
    }
    return { currentActivity: cur, nextActivity: nxt };
  }, [currentDay, isTodaySelected, getActivityStatus]);

  const handleMarkComplete = useCallback((activityId: string) => {
    setCompletedActivities(prev => new Set([...prev, activityId]));
    onActivityComplete?.(activityId);
    const activity = days[selectedDayIndex]?.activities.find(a => a.id === activityId);
    if (activity) {
      setRecentCompletedActivity({
        id: activity.id, name: activity.name, category: activity.category,
        type: activity.type, startTime: activity.startTime, endTime: activity.endTime,
        completedAt: new Date(),
      });
    }
  }, [days, selectedDayIndex, onActivityComplete]);

  const handleSkip = useCallback((activityId: string) => {
    setSkippedActivities(prev => new Set([...prev, activityId]));
    onActivitySkip?.(activityId);
  }, [onActivitySkip]);

  // Group activities by time of day
  const groupedActivities = useMemo(() => {
    if (!currentDay) return [];
    const groups: { period: string; label: string; icon: string; activities: { activity: Activity; index: number }[] }[] = [];
    const seen = new Set<string>();

    currentDay.activities.forEach((activity, index) => {
      const period = getTimeOfDay(activity.startTime);
      if (!seen.has(period)) {
        seen.add(period);
        groups.push({ period, ...TIME_LABELS[period], activities: [] });
      }
      groups.find(g => g.period === period)!.activities.push({ activity, index });
    });

    return groups;
  }, [currentDay]);

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
                  <span className="text-xs font-medium">{format(dayDate, 'EEE')}</span>
                  <span className="text-lg font-bold">{format(dayDate, 'd')}</span>
                  {isTodayDay && (
                    <Badge variant="secondary" className="text-[10px] mt-0.5 px-1.5 py-0">Today</Badge>
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
          className="space-y-5"
        >
          {/* ─── 1. Editorial Day Header ─── */}
          <div className="flex items-start gap-4">
            <div className="text-2xl sm:text-4xl font-serif font-bold text-primary/20 leading-none select-none">
              {String(currentDay.dayNumber).padStart(2, '0')}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="font-serif text-lg sm:text-xl font-bold text-foreground leading-tight truncate">
                {currentDay.theme || format(parseLocalDate(currentDay.date), 'EEEE')}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {format(parseLocalDate(currentDay.date), 'MMMM d, yyyy')}
                </span>
                {currentDay.weather && (
                  <div className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-0.5">
                    <WeatherIcon condition={currentDay.weather.condition} />
                    {currentDay.weather.high != null && (
                      <span className="text-xs font-medium">
                        {currentDay.weather.high}°
                        {currentDay.weather.low != null && (
                          <span className="text-muted-foreground"> / {currentDay.weather.low}°</span>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {currentDay.description && (
                <p className="text-sm text-muted-foreground mt-1 italic line-clamp-2">
                  {currentDay.description}
                </p>
              )}
              {whatToWear && isTodaySelected && (
                <p className="text-xs text-muted-foreground/70 mt-1 italic">
                  👕 {whatToWear}
                </p>
              )}
            </div>
          </div>

          {/* ─── 2. NOW Spotlight (today only) ─── */}
          {isTodaySelected && (
            <AnimatePresence mode="wait">
              {currentActivity ? (
                <motion.div
                  key={`now-${currentActivity.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 sm:p-5 shadow-md"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Right Now</span>
                  </div>

                  <div className="flex gap-4">
                    {/* Spotlight image */}
                    <div className="hidden sm:block w-20 h-20 rounded-lg overflow-hidden shrink-0">
                      <SafeImage
                        src={currentActivity.imageUrl || getActivityFallbackImage(currentActivity.type || currentActivity.category, currentActivity.name)}
                        alt={currentActivity.name}
                        fallbackCategory={currentActivity.category || currentActivity.type}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl sm:text-2xl font-serif font-bold text-foreground leading-tight">
                        {sanitizeActivityName(currentActivity.name)}
                      </h3>

                      {(currentActivity.startTime || currentActivity.endTime) && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {currentActivity.startTime}
                          {currentActivity.endTime && ` – ${currentActivity.endTime}`}
                        </p>
                      )}

                      {currentActivity.location?.name && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{currentActivity.location.name}</span>
                        </div>
                      )}

                      {currentActivity.description && (
                        <p className="mt-2 text-xs text-muted-foreground/80 border-l-2 border-primary/20 pl-2 italic line-clamp-2">
                          {currentActivity.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={() => handleMarkComplete(currentActivity.id)}
                      className="rounded-full gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Mark Done
                    </Button>
                    {currentActivity.location && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (currentActivity.location?.lat && currentActivity.location?.lng) {
                            openMapLocation({ name: currentActivity.name, lat: currentActivity.location.lat, lng: currentActivity.location.lng });
                          } else if (currentActivity.location?.name) {
                            openMapLocation({ name: currentActivity.location.name });
                          }
                        }}
                        className="rounded-full gap-1.5"
                      >
                        <Navigation className="w-4 h-4" />
                        Directions
                      </Button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="free-time"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="rounded-xl border border-dashed border-muted-foreground/30 p-4 text-center"
                >
                  <p className="text-sm font-serif font-medium text-foreground">Free time</p>
                  {nextActivity && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Next up{nextActivity.startTime ? ` at ${nextActivity.startTime}` : ''}: {sanitizeActivityName(nextActivity.name)}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* ─── 3. Up Next (today only) ─── */}
          {isTodaySelected && currentActivity && nextActivity && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-muted/20 rounded-xl border border-border/50 p-3 flex items-center gap-3"
            >
              <div className="hidden sm:block w-10 h-10 rounded-lg overflow-hidden shrink-0">
                <SafeImage
                  src={nextActivity.imageUrl || getActivityFallbackImage(nextActivity.type || nextActivity.category, nextActivity.name)}
                  alt={nextActivity.name}
                  fallbackCategory={nextActivity.category || nextActivity.type}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">Up Next</p>
                <p className="text-sm font-serif font-medium text-foreground truncate">{sanitizeActivityName(nextActivity.name)}</p>
                {nextActivity.startTime && (
                  <p className="text-xs text-muted-foreground">{nextActivity.startTime}</p>
                )}
              </div>
              {nextActivity.location?.name && (
                <div className="text-xs text-muted-foreground shrink-0 text-right max-w-[120px] truncate hidden sm:block">
                  {nextActivity.location.name}
                </div>
              )}
            </motion.div>
          )}

          {/* ─── 4. Feeling Spontaneous ─── */}
          {isTodaySelected && (
            <div className="flex justify-center">
              <button className="text-xs text-primary/70 hover:text-primary transition-colors flex items-center gap-1.5 py-1">
                <Compass className="w-3.5 h-3.5" />
                Feeling spontaneous? Explore nearby
              </button>
            </div>
          )}

          {/* ─── 5. Full Day Timeline with Time-of-Day Groups ─── */}
          <div className="space-y-5">
            {groupedActivities.map((group) => (
              <div key={group.period}>
                {/* Time-of-day section header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">{group.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
                  {isPastDay && group === groupedActivities[0] && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Completed
                    </Badge>
                  )}
                </div>

                {/* Timeline cards */}
                <div className="ml-1">
                  {group.activities.map(({ activity, index }, i) => (
                    <TimelineActivityCard
                      key={activity.id}
                      activity={activity}
                      status={getActivityStatus(activity, index)}
                      isLast={i === group.activities.length - 1}
                      tripId={tripId}
                      destination={destination}
                      isPastDay={isPastDay}
                      onMarkComplete={() => handleMarkComplete(activity.id)}
                      onSkip={() => handleSkip(activity.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {currentDay.activities.length === 0 && (
            <div className="rounded-xl border border-dashed border-muted-foreground/30 p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="font-serif font-medium text-foreground">No activities planned</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This is a free day to explore at your own pace
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* AI Insights */}
      {insights?.insights_summary && (
        <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif font-medium text-sm">Your Travel Insights</h4>
              <p className="text-sm text-muted-foreground mt-1">{insights.insights_summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
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

      {/* Feedback Prompt Overlay */}
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
