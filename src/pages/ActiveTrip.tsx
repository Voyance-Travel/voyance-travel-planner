/**
 * ActiveTrip
 * Living trip companion dashboard with Today, Overview, and Nearby views
 * "Your trip, in your pocket"
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isToday, isBefore, isAfter, differenceInMinutes, differenceInDays } from 'date-fns';
import {
  ArrowLeft, Calendar, MapPin, Clock, ChevronRight, Sun, Moon,
  Coffee, Sunrise, Sunset, Navigation, Ticket, Bookmark,
  QrCode, Copy, Check, ExternalLink, Sparkles, AlertCircle
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TripOverview } from '@/components/trips/TripOverview';
import WhatsNearby from '@/components/trips/WhatsNearby';
import { FeedbackPromptOverlay } from '@/components/feedback/FeedbackPromptOverlay';
import { DaySummaryPrompt } from '@/components/feedback/DaySummaryPrompt';
import { useFeedbackTrigger } from '@/hooks/useFeedbackTrigger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { parseActiveTripDays } from '@/utils/itineraryParser';
import type { Tables } from '@/integrations/supabase/types';
import type { ActivityContext } from '@/types/feedback';

type Trip = Tables<'trips'>;

interface ItineraryActivity {
  id: string;
  name: string;
  description?: string;
  type?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  location?: {
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  imageUrl?: string;
  tips?: string[];
  confirmationNumber?: string;
  voucherUrl?: string;
  bookingRequired?: boolean;
  reservationTime?: string;
}

interface ItineraryDay {
  dayNumber: number;
  date: string;
  theme?: string;
  description?: string;
  activities: ItineraryActivity[];
  weather?: {
    condition?: string;
    high?: number;
    low?: number;
  };
}

type ViewType = 'today' | 'overview' | 'nearby';

// Get time of day greeting and icon
function getTimeContext() {
  const hour = new Date().getHours();
  if (hour < 6) return { greeting: 'Night owl', icon: Moon, period: 'night' };
  if (hour < 12) return { greeting: 'Good morning', icon: Sunrise, period: 'morning' };
  if (hour < 17) return { greeting: 'Good afternoon', icon: Sun, period: 'afternoon' };
  if (hour < 21) return { greeting: 'Good evening', icon: Sunset, period: 'evening' };
  return { greeting: 'Good night', icon: Moon, period: 'night' };
}

export default function ActiveTrip() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewType>('today');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [completedActivities, setCompletedActivities] = useState<Set<string>>(new Set());
  const [recentCompletedActivity, setRecentCompletedActivity] = useState<ActivityContext | null>(null);
  const [showDaySummary, setShowDaySummary] = useState(false);

  // Load trip data
  useEffect(() => {
    async function loadTrip() {
      if (!tripId) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .maybeSingle();

        if (error) throw error;
        if (data) setTrip(data);
      } catch (err) {
        console.error('Error loading trip:', err);
        toast.error('Failed to load trip');
      } finally {
        setLoading(false);
      }
    }

    loadTrip();
  }, [tripId]);

  // Parse itinerary data using centralized safe parser
  const itinerary = useMemo((): ItineraryDay[] => {
    if (!trip?.itinerary_data) return [];
    return parseActiveTripDays(trip.itinerary_data, trip.start_date);
  }, [trip?.itinerary_data, trip?.start_date]);

  // Calculate trip context
  const tripContext = useMemo(() => {
    if (!trip) return null;
    
    const now = new Date();
    const start = parseISO(trip.start_date);
    const end = parseISO(trip.end_date);
    const totalDays = differenceInDays(end, start) + 1;
    const currentDayNumber = Math.max(1, Math.min(differenceInDays(now, start) + 1, totalDays));
    const daysRemaining = Math.max(0, differenceInDays(end, now));
    const progressPercent = (currentDayNumber / totalDays) * 100;
    const isActive = isAfter(now, start) && isBefore(now, end);
    const isLastDay = currentDayNumber === totalDays;

    return {
      totalDays,
      currentDayNumber,
      daysRemaining,
      progressPercent,
      isActive,
      isLastDay,
    };
  }, [trip]);

  // Get today's itinerary
  const todaysItinerary = useMemo(() => {
    if (!tripContext || itinerary.length === 0) return null;
    return itinerary.find(day => {
      const dayDate = parseISO(day.date);
      return isToday(dayDate);
    }) || itinerary[tripContext.currentDayNumber - 1];
  }, [itinerary, tripContext]);

  // Calculate NOW context - what's happening right now
  const nowContext = useMemo(() => {
    if (!todaysItinerary) return null;
    
    const now = new Date();
    const activities = todaysItinerary.activities;
    
    // Find current and next activity based on time
    let currentActivity: ItineraryActivity | null = null;
    let nextActivity: ItineraryActivity | null = null;
    let freeUntil: Date | null = null;
    
    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      if (!activity.startTime) continue;
      
      const [hours, minutes] = activity.startTime.split(':').map(Number);
      const activityStart = new Date(parseISO(todaysItinerary.date));
      activityStart.setHours(hours, minutes);
      
      let activityEnd = activityStart;
      if (activity.endTime) {
        const [endHours, endMinutes] = activity.endTime.split(':').map(Number);
        activityEnd = new Date(parseISO(todaysItinerary.date));
        activityEnd.setHours(endHours, endMinutes);
      } else if (activity.duration) {
        activityEnd = new Date(activityStart.getTime() + activity.duration * 60000);
      }
      
      if (isAfter(now, activityStart) && isBefore(now, activityEnd)) {
        currentActivity = activity;
        nextActivity = activities[i + 1] || null;
        break;
      } else if (isAfter(activityStart, now)) {
        freeUntil = activityStart;
        nextActivity = activity;
        break;
      }
    }
    
    // If we passed all activities, it's free time for the rest of the day
    const minutesUntilNext = freeUntil ? differenceInMinutes(freeUntil, now) : null;
    
    return {
      currentActivity,
      nextActivity,
      freeUntil,
      minutesUntilNext,
      isFreeTime: !currentActivity && freeUntil !== null,
      isDayComplete: !currentActivity && !nextActivity,
    };
  }, [todaysItinerary]);

  // Convert to activity context for feedback
  const activityContexts = useMemo((): ActivityContext[] => {
    if (!todaysItinerary) return [];
    return todaysItinerary.activities.map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      type: a.type,
      startTime: a.startTime,
      endTime: a.endTime,
    }));
  }, [todaysItinerary]);

  // Get user's archetype
  const userArchetype = useMemo(() => {
    const meta = trip?.metadata as Record<string, unknown> | null;
    return meta?.archetype as string | undefined;
  }, [trip?.metadata]);

  // Feedback trigger system
  const {
    currentPrompt,
    dismissPrompt,
    completePrompt,
  } = useFeedbackTrigger({
    tripId: tripId || '',
    destination: trip?.destination || '',
    startDate: trip?.start_date || '',
    endDate: trip?.end_date || '',
    userArchetype,
    activities: activityContexts,
    recentCompletedActivity: recentCompletedActivity || undefined,
    enabled: !!trip && tripContext?.isActive,
  });

  // Handle activity completion
  const handleActivityComplete = useCallback((activityId: string) => {
    setCompletedActivities(prev => new Set([...prev, activityId]));
    
    const activity = todaysItinerary?.activities.find(a => a.id === activityId);
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
  }, [todaysItinerary]);

  // Copy confirmation number
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get time-based context
  const timeContext = getTimeContext();
  const TimeIcon = timeContext.icon;

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </MainLayout>
    );
  }

  if (!trip || !tripContext) {
    return (
      <MainLayout>
        <Head title="Trip Not Found" />
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <h1 className="text-xl font-semibold mb-2">Trip not found</h1>
          <Button onClick={() => navigate('/trip/dashboard')}>Back to Dashboard</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Head title={`${trip.destination} - Day ${tripContext.currentDayNumber}`} />
      
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container max-w-2xl mx-auto px-4">
            <div className="flex items-center justify-between py-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <div className="text-center">
                <h1 className="font-bold text-lg">{trip.destination}</h1>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>Day {tripContext.currentDayNumber} of {tripContext.totalDays}</span>
                  <span>·</span>
                  <span>{format(new Date(), 'EEEE, MMM d')}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1">
                <TimeIcon className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium">{timeContext.greeting}</span>
              </div>
            </div>

            {/* View Tabs */}
            <div className="flex gap-4 pb-3">
              {(['today', 'overview', 'nearby'] as ViewType[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'pb-2 border-b-2 text-sm font-medium transition-colors capitalize',
                    view === v 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {v === 'today' ? 'Today' : v === 'overview' ? 'Trip' : 'Nearby'}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="container max-w-2xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            {view === 'today' && (
              <TodayView
                key="today"
                trip={trip}
                tripContext={tripContext}
                todaysItinerary={todaysItinerary}
                nowContext={nowContext}
                completedActivities={completedActivities}
                onActivityComplete={handleActivityComplete}
                onCopy={handleCopy}
                copiedId={copiedId}
                archetype={userArchetype}
              />
            )}

            {view === 'overview' && todaysItinerary && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <TripOverview
                  tripId={tripId || ''}
                  tripName={trip.name}
                  destination={trip.destination}
                  startDate={trip.start_date}
                  endDate={trip.end_date}
                  days={itinerary.map(day => ({
                    dayNumber: day.dayNumber,
                    date: day.date,
                    theme: day.theme,
                    activities: day.activities.map(a => ({
                      id: a.id,
                      name: a.name,
                      category: a.category,
                    })),
                  }))}
                  completedActivities={completedActivities}
                />
              </motion.div>
            )}

            {view === 'nearby' && (
              <motion.div
                key="nearby"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <WhatsNearby archetype={userArchetype} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Feedback Overlays */}
        <AnimatePresence>
          {currentPrompt && (
            <FeedbackPromptOverlay
              context={currentPrompt}
              tripId={tripId || ''}
              onClose={dismissPrompt}
              onComplete={completePrompt}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showDaySummary && todaysItinerary && (
            <DaySummaryPrompt
              tripId={tripId || ''}
              destination={trip.destination}
              dayNumber={tripContext.currentDayNumber}
              dayDate={todaysItinerary.date}
              activities={activityContexts}
              onClose={() => setShowDaySummary(false)}
              onComplete={() => setShowDaySummary(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  );
}

// ============================================================================
// TODAY VIEW COMPONENT
// ============================================================================

interface TodayViewProps {
  trip: Trip;
  tripContext: {
    totalDays: number;
    currentDayNumber: number;
    daysRemaining: number;
    progressPercent: number;
    isActive: boolean;
    isLastDay: boolean;
  };
  todaysItinerary: ItineraryDay | null;
  nowContext: {
    currentActivity: ItineraryActivity | null;
    nextActivity: ItineraryActivity | null;
    freeUntil: Date | null;
    minutesUntilNext: number | null;
    isFreeTime: boolean;
    isDayComplete: boolean;
  } | null;
  completedActivities: Set<string>;
  onActivityComplete: (id: string) => void;
  onCopy: (id: string, text: string) => void;
  copiedId: string | null;
  archetype?: string;
}

function TodayView({
  trip,
  tripContext,
  todaysItinerary,
  nowContext,
  completedActivities,
  onActivityComplete,
  onCopy,
  copiedId,
  archetype,
}: TodayViewProps) {
  if (!todaysItinerary) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12"
      >
        <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No itinerary for today</h3>
        <p className="text-sm text-muted-foreground">
          This is a free day to explore at your own pace
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-6"
    >
      {/* NOW Context Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">NOW</span>
          </div>

          {nowContext?.currentActivity ? (
            <div>
              <h3 className="text-lg font-semibold">{nowContext.currentActivity.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {nowContext.currentActivity.location?.address || nowContext.currentActivity.location?.name}
              </p>
              {nowContext.currentActivity.tips?.[0] && (
                <div className="flex items-start gap-2 mt-3 p-3 bg-amber-500/10 rounded-lg">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {nowContext.currentActivity.tips[0]}
                  </p>
                </div>
              )}
            </div>
          ) : nowContext?.isFreeTime ? (
            <div>
              <h3 className="text-lg font-semibold">
                Free time until {nowContext.freeUntil && format(nowContext.freeUntil, 'h:mm a')}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                You're near {trip.destination}. Some ideas:
              </p>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Coffee className="w-3.5 h-3.5" />
                  Coffee
                </Button>
                <Button variant="outline" size="sm">
                  Quick bite
                </Button>
                <Button variant="outline" size="sm">
                  Wander
                </Button>
              </div>
            </div>
          ) : nowContext?.isDayComplete ? (
            <div>
              <h3 className="text-lg font-semibold">Day complete! 🎉</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {tripContext.isLastDay 
                  ? "Last day of your trip. Make the most of it!"
                  : `${tripContext.daysRemaining} day${tripContext.daysRemaining > 1 ? 's' : ''} to go.`}
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold">Day is starting</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {todaysItinerary.theme || `Day ${tripContext.currentDayNumber} in ${trip.destination}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Activities */}
      <div className="space-y-3">
        <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
          {nowContext?.currentActivity ? 'Coming Up' : 'Today\'s Schedule'}
        </h3>

        {todaysItinerary.activities.map((activity, idx) => {
          const isCompleted = completedActivities.has(activity.id);
          const isCurrent = nowContext?.currentActivity?.id === activity.id;
          const isNext = nowContext?.nextActivity?.id === activity.id;

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className={cn(
                'transition-all',
                isCurrent && 'ring-2 ring-primary border-primary',
                isCompleted && 'opacity-60'
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Time */}
                    <div className="text-center min-w-[50px]">
                      <p className={cn(
                        'text-lg font-bold',
                        isCurrent && 'text-primary'
                      )}>
                        {activity.startTime || '--:--'}
                      </p>
                      {isCurrent && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] mt-1">
                          NOW
                        </Badge>
                      )}
                      {isNext && !isCurrent && (
                        <Badge variant="outline" className="text-[10px] mt-1">
                          NEXT
                        </Badge>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        'font-semibold',
                        isCompleted && 'line-through text-muted-foreground'
                      )}>
                        {activity.name}
                      </h4>
                      
                      {activity.location?.address && (
                        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {activity.location.address}
                        </p>
                      )}

                      {/* Tips */}
                      {activity.tips && activity.tips.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {activity.tips.slice(0, 2).map((tip, i) => (
                            <p key={i} className="text-sm flex items-start gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{tip}</span>
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Confirmation / Actions */}
                      {activity.confirmationNumber && (
                        <div className="flex items-center gap-2 mt-3 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                          <Ticket className="w-4 h-4 text-emerald-600" />
                          <code className="text-xs font-mono flex-1 truncate text-emerald-700">
                            {activity.confirmationNumber}
                          </code>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => onCopy(activity.id, activity.confirmationNumber!)}
                          >
                            {copiedId === activity.id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-3">
                        {activity.location && (
                          <Button size="sm" variant="outline" className="h-8 gap-1.5">
                            <Navigation className="w-3.5 h-3.5" />
                            Directions
                          </Button>
                        )}
                        {activity.voucherUrl && (
                          <Button size="sm" variant="outline" className="h-8 gap-1.5">
                            <QrCode className="w-3.5 h-3.5" />
                            Show tickets
                          </Button>
                        )}
                        {!isCompleted && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8"
                            onClick={() => onActivityComplete(activity.id)}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Done
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-center gap-4 pt-4">
        <Button variant="ghost" size="sm">
          View full day
        </Button>
        <Button variant="ghost" size="sm">
          Tomorrow →
        </Button>
      </div>
    </motion.div>
  );
}
