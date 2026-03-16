/**
 * ActiveTrip
 * Living trip companion dashboard with Today, Overview, and Nearby views
 * "Your trip, in your pocket"
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isBefore, isAfter, differenceInMinutes, differenceInDays } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { openMapLocation, toTravelMode } from '@/utils/mapNavigation';
import {
  ArrowLeft, Calendar, MapPin, Clock, ChevronRight, Sun, Moon,
  Coffee, Sunrise, Sunset, Navigation, Ticket, Bookmark,
  QrCode, Copy, Check, ExternalLink, Sparkles, AlertCircle, Pencil, Map,
  Route as RouteIcon, ChevronDown
} from 'lucide-react';
import { useActivityImage } from '@/hooks/useActivityImage';
import SafeImage from '@/components/SafeImage';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { InlineActivityRating } from '@/components/feedback/InlineActivityRating';
import { TripRescueBanner } from '@/components/feedback/TripRescueBanner';
import { CheckInButton } from '@/components/feedback/CheckInButton';
import { DailyProgressBar } from '@/components/trips/DailyProgressBar';
import { SmartSwapSuggestion } from '@/components/trips/SmartSwapSuggestion';
import ActivityAlternativesDrawer from '@/components/planner/ActivityAlternativesDrawer';
import { PostActivityNudge } from '@/components/feedback/PostActivityNudge';
import { MemoryUploadButton } from '@/components/memories/MemoryUploadButton';
import { VoiceNotePlayer } from '@/components/memories/VoiceNotePlayer';
import { GuideBookmarkButton } from '@/components/guides/GuideBookmarkButton';
import { MemoriesTimeline } from '@/components/memories/MemoriesTimeline';
import { ActiveTripStats } from '@/components/trips/ActiveTripStats';
import { ActiveTripNotes } from '@/components/trips/ActiveTripNotes';
import { DayRouteMap } from '@/components/itinerary/DayRouteMap';
import TripChat from '@/components/chat/TripChat';
import { MidTripDNA as DailyBriefing } from '@/components/trips/MidTripDNA';
import type { ItineraryActivity as DrawerItineraryActivity } from '@/types/itinerary';
import { ActivityMediaCapture } from '@/components/feedback/ActivityMediaCapture';
import { useFeedbackTrigger } from '@/hooks/useFeedbackTrigger';
import { useTripSentiment } from '@/hooks/useTripSentiment';
import { useTripFeedback } from '@/services/activityFeedbackAPI';
import { useProximityCheckIn } from '@/hooks/useProximityCheckIn';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineItinerary, getCachedTrip } from '@/hooks/useOfflineItinerary';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
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
  transportationMethod?: string;
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

type ViewType = 'today' | 'overview' | 'nearby' | 'memories' | 'stats' | 'chat' | 'dna';

// ── Sub-component: Activity thumbnail (hook wrapper) ──────────────────────
function ActivityImageThumb({ name, category, imageUrl, destination }: {
  name: string; category?: string; imageUrl?: string; destination?: string;
}) {
  const { imageUrl: resolvedUrl } = useActivityImage(name, category, imageUrl, destination);
  return (
    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
      <SafeImage
        src={resolvedUrl || ''}
        alt={name}
        className="w-full h-full object-cover"
        fallbackCategory={category}
      />
    </div>
  );
}

// ── Sub-component: Inline route directions ────────────────────────────────
function InlineRouteDetails({ activity, previousActivity }: {
  activity: ItineraryActivity;
  previousActivity: ItineraryActivity | null;
}) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<any[] | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeMeta, setRouteMeta] = useState<{ duration: string; distance: string } | null>(null);

  const mode = activity.transportationMethod || 'walk';

  const fetchRoute = useCallback(async () => {
    if (steps) return; // already fetched
    if (!previousActivity?.location?.lat || !activity.location?.lat) return;
    setRouteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('route-details', {
        body: {
          origin: { lat: previousActivity.location.lat, lng: previousActivity.location.lng },
          destination: { lat: activity.location!.lat, lng: activity.location!.lng },
          travelMode: mode.toUpperCase(),
        },
      });
      if (error) throw error;
      const route = data?.routes?.[0] || data?.route;
      if (route) {
        const leg = route.legs?.[0] || route;
        setSteps(leg.steps || []);
        setRouteMeta({
          duration: leg.duration?.text || leg.localizedValues?.duration?.text || '',
          distance: leg.distance?.text || leg.localizedValues?.distance?.text || '',
        });
      }
    } catch (err) {
      console.error('[InlineRouteDetails] fetch error:', err);
    } finally {
      setRouteLoading(false);
    }
  }, [activity, previousActivity, mode, steps]);

  if (!previousActivity?.location?.lat) return null;

  return (
    <Collapsible open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) fetchRoute();
    }}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground mt-2 transition-colors">
          <RouteIcon className="w-3 h-3" />
          <span className="capitalize">{mode}</span> route
          {routeMeta && <span className="text-primary">· {routeMeta.duration}</span>}
          <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 pl-4 border-l-2 border-primary/15 space-y-1.5">
          {routeLoading && (
            <div className="space-y-1 animate-pulse">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          )}
          {steps && steps.length > 0 && (
            <>
              {routeMeta && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
                  {routeMeta.distance} · {routeMeta.duration}
                </p>
              )}
              {steps.slice(0, 5).map((step: any, i: number) => (
                <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-primary/60 font-medium mr-1">{i + 1}.</span>
                  {step.navigationInstruction?.instructions || step.htmlInstructions || step.instruction || 'Continue'}
                  {(step.localizedValues?.distance?.text || step.distance?.text) && (
                    <span className="text-muted-foreground/50 ml-1">
                      ({step.localizedValues?.distance?.text || step.distance?.text})
                    </span>
                  )}
                </p>
              ))}
              {steps.length > 5 && (
                <p className="text-[11px] text-primary font-medium">+ {steps.length - 5} more steps</p>
              )}
            </>
          )}
          {steps && steps.length === 0 && !routeLoading && (
            <p className="text-xs text-muted-foreground italic">No detailed route available</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

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
  const { isOnline } = useOfflineStatus();

  // Auto-cache trip data for offline use
  useOfflineItinerary(trip);

  const [view, setView] = useState<ViewType>('today');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [completedActivities, setCompletedActivities] = useState<Set<string>>(new Set());
  const [recentCompletedActivity, setRecentCompletedActivity] = useState<ActivityContext | null>(null);
  const [showDaySummary, setShowDaySummary] = useState(false);
  const [rescueDismissed, setRescueDismissed] = useState(false);
  const [mediaCapture, setMediaCapture] = useState<{ open: boolean; activityId: string; activityName: string; mode: 'photo' | 'voice' }>({
    open: false, activityId: '', activityName: '', mode: 'photo'
  });

  // Load trip data (with offline fallback)
  useEffect(() => {
    async function loadTrip() {
      if (!tripId) return;
      
      try {
        setLoading(true);

        // If offline, use cached data
        if (!navigator.onLine) {
          const cached = getCachedTrip(tripId);
          if (cached) {
            setTrip(cached);
            return;
          }
        }

        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .maybeSingle();

        if (error) throw error;
        if (data) setTrip(data);
      } catch (err) {
        console.error('Error loading trip:', err);
        // Fallback to cache on network error
        const cached = getCachedTrip(tripId);
        if (cached) {
          setTrip(cached);
          toast.info('Showing cached trip data');
        } else {
          toast.error('Failed to load trip');
        }
      } finally {
        setLoading(false);
      }
    }

    loadTrip();
  }, [tripId, isOnline]);

  // Parse itinerary data using centralized safe parser
  const itinerary = useMemo((): ItineraryDay[] => {
    if (!trip?.itinerary_data) return [];
    return parseActiveTripDays(trip.itinerary_data, trip.start_date);
  }, [trip?.itinerary_data, trip?.start_date]);

  // Calculate trip context
  const tripContext = useMemo(() => {
    if (!trip) return null;
    
    const now = new Date();
    const start = parseLocalDate(trip.start_date);
    const end = parseLocalDate(trip.end_date);
    const totalDays = differenceInDays(end, start);
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
      const dayDate = parseLocalDate(day.date);
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
      const activityStart = new Date(parseLocalDate(todaysItinerary.date));
      activityStart.setHours(hours, minutes);
      
      let activityEnd = activityStart;
      if (activity.endTime) {
        const [endHours, endMinutes] = activity.endTime.split(':').map(Number);
        activityEnd = new Date(parseLocalDate(todaysItinerary.date));
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

  // Trip sentiment detection for rescue system
  const sentiment = useTripSentiment({
    tripId: tripId || '',
    currentDayNumber: tripContext?.currentDayNumber || 1,
    enabled: !!trip && tripContext?.isActive,
  });

  // Get existing feedback for inline ratings
  const { data: tripFeedback = [] } = useTripFeedback(tripId || null);
  const feedbackByActivity = useMemo(() => {
    const map: globalThis.Map<string, { rating: string; personalization_tags?: string[] | null }> = new globalThis.Map();
    tripFeedback.forEach(f => map.set(f.activity_id, { rating: f.rating, personalization_tags: f.personalization_tags }));
    return map;
  }, [tripFeedback]);

  // Handle media capture
  const openMediaCapture = useCallback((activityId: string, activityName: string, mode: 'photo' | 'voice') => {
    setMediaCapture({ open: true, activityId, activityName, mode });
  }, []);

  // Handle rescue actions
  const handleSwapActivity = useCallback(() => {
    // Navigate to the trip detail page with swap mode
    navigate(`/trip/${tripId}`);
    toast.info('Use "Find Alternative" on any activity to swap it');
  }, [tripId, navigate]);

  const handleLightenPace = useCallback(() => {
    toast.success('We\'ll adjust tomorrow\'s schedule to give you more breathing room');
    setRescueDismissed(true);
    // The actual pace adjustment would be handled by the itinerary system
  }, []);



  const handleActivityComplete = useCallback(async (activityId: string) => {
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

    // Persist completion to the database
    try {
      const { data: existing } = await supabase
        .from('trip_activities')
        .select('metadata')
        .eq('id', activityId)
        .maybeSingle();

      const currentMeta = (existing?.metadata as Record<string, unknown>) || {};
      await supabase
        .from('trip_activities')
        .update({
          metadata: { ...currentMeta, completed: true, completedAt: new Date().toISOString() } as any,
        })
        .eq('id', activityId);
    } catch (err) {
      console.error('[ActiveTrip] Failed to persist activity completion:', err);
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
            {/* Top row: navigation + actions */}
            <div className="flex items-center justify-between pt-3 pb-1">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1">
                  <TimeIcon className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-medium">{timeContext.greeting}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/trip/${tripId}?edit=true`)}
                  className="gap-1.5 text-muted-foreground"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              </div>
            </div>

            {/* Destination + day info — centered, with breathing room */}
            <div className="text-center pb-3">
              <h1 className="font-serif font-bold text-xl">{trip.destination}</h1>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-0.5">
                <span>Day {tripContext.currentDayNumber} of {tripContext.totalDays}</span>
                <span>·</span>
                <span>{format(new Date(), 'EEEE, MMM d')}</span>
              </div>
            </div>

            {/* View Tabs */}
            <div className="flex gap-3 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
              {(['today', 'overview', 'nearby', 'memories', 'stats', 'dna', 'chat'] as ViewType[]).map(v => {
                const labels: Record<ViewType, string> = {
                  today: 'Today', overview: 'Trip', nearby: 'Nearby', memories: 'Memories', stats: 'Stats', dna: 'DNA', chat: 'Chat'
                };
                return (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      'pb-2 border-b-2 text-sm font-medium transition-colors whitespace-nowrap',
                      view === v
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {labels[v]}
                  </button>
                );
              })}
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
                feedbackByActivity={feedbackByActivity}
                onMediaPress={(id, name) => openMediaCapture(id, name, 'photo')}
                onVoicePress={(id, name) => openMediaCapture(id, name, 'voice')}
                sentiment={sentiment}
                rescueDismissed={rescueDismissed}
                onRescueDismiss={() => setRescueDismissed(true)}
                onSwapActivity={handleSwapActivity}
                onLightenPace={handleLightenPace}
                destination={trip.destination}
                tripId={tripId || ''}
                itineraryActivities={todaysItinerary?.activities.map(a => a.name) || []}
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

            {view === 'memories' && (
              <motion.div
                key="memories"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <MemoriesTimeline
                  tripId={tripId || ''}
                  tripName={trip.name}
                />
              </motion.div>
            )}

            {view === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <ActiveTripStats
                  tripId={tripId || ''}
                  tripName={trip.name}
                  destination={trip.destination}
                  itinerary={itinerary.map(day => ({
                    dayNumber: day.dayNumber,
                    date: day.date,
                    theme: day.theme,
                    activities: day.activities.map(a => ({
                      id: a.id,
                      name: a.name,
                      category: a.category,
                      duration: a.duration,
                    })),
                  }))}
                  completedActivities={completedActivities}
                  currentDayNumber={tripContext?.currentDayNumber || 1}
                  totalDays={tripContext?.totalDays || 1}
                  budget={trip.budget_total_cents ? trip.budget_total_cents / 100 : undefined}
                  currency={trip.budget_currency || 'USD'}
                  travelers={trip.travelers || 1}
                />
              </motion.div>
            )}

            {view === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-[calc(100vh-280px)]"
              >
                <TripChat
                  tripId={tripId || ''}
                  tripType="consumer"
                />
              </motion.div>
            )}

            {view === 'dna' && (
              <motion.div
                key="dna"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <DailyBriefing tripId={tripId || ''} />
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

        {/* Media Capture Modal */}
        <ActivityMediaCapture
          open={mediaCapture.open}
          onOpenChange={(open) => setMediaCapture(prev => ({ ...prev, open }))}
          activityId={mediaCapture.activityId}
          activityName={mediaCapture.activityName}
          tripId={tripId || ''}
          mode={mediaCapture.mode}
        />
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
  feedbackByActivity: Map<string, { rating: string; personalization_tags?: string[] | null }>;
  onMediaPress: (activityId: string, activityName: string) => void;
  onVoicePress: (activityId: string, activityName: string) => void;
  sentiment: import('@/hooks/useTripSentiment').TripSentiment;
  rescueDismissed: boolean;
  onRescueDismiss: () => void;
  onSwapActivity: () => void;
  onLightenPace: () => void;
  destination: string;
  tripId: string;
  itineraryActivities: string[];
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
  feedbackByActivity,
  onMediaPress,
  onVoicePress,
  sentiment,
  rescueDismissed,
  onRescueDismiss,
  onSwapActivity,
  onLightenPace,
  destination,
  tripId,
  itineraryActivities,
}: TodayViewProps) {
  // Swap drawer state
  const [swapDrawerOpen, setSwapDrawerOpen] = useState(false);
  const [swapTargetActivity, setSwapTargetActivity] = useState<DrawerItineraryActivity | null>(null);
  const [showMap, setShowMap] = useState(true);

  const handleSwapRequest = useCallback((activityId: string) => {
    const activity = todaysItinerary?.activities.find(a => a.id === activityId);
    if (!activity) return;
    
    const drawerActivity: DrawerItineraryActivity = {
      id: activity.id,
      title: activity.name,
      description: activity.description || '',
      time: activity.startTime || '09:00',
      duration: activity.duration ? `${activity.duration} min` : '1 hour',
      type: (activity.category as DrawerItineraryActivity['type']) || 'activity',
      cost: 0,
      location: {
        name: activity.location?.name || '',
        address: activity.location?.address || '',
        coordinates: activity.location?.lat && activity.location?.lng
          ? { lat: activity.location.lat, lng: activity.location.lng }
          : undefined,
      },
      tags: [],
      isLocked: false,
    };
    setSwapTargetActivity(drawerActivity);
    setSwapDrawerOpen(true);
  }, [todaysItinerary]);

  const handleAlternativeSelected = useCallback((newActivity: DrawerItineraryActivity) => {
    setSwapDrawerOpen(false);
    setSwapTargetActivity(null);
    onSwapActivity();
  }, [onSwapActivity]);

  // GPS proximity detection for check-in
  const venues = useMemo(() => {
    if (!todaysItinerary) return [];
    return todaysItinerary.activities
      .filter(a => a.location?.lat && a.location?.lng)
      .map(a => ({
        id: a.id,
        lat: a.location!.lat!,
        lng: a.location!.lng!,
        name: a.name,
      }));
  }, [todaysItinerary]);

  const proximity = useProximityCheckIn(venues, completedActivities, !!todaysItinerary);

  // Group activities by time-of-day
  const timeGroups = useMemo(() => {
    if (!todaysItinerary) return [];
    const groups: { label: string; activities: ItineraryActivity[] }[] = [];
    let currentGroup = '';
    
    for (const activity of todaysItinerary.activities) {
      const hour = activity.startTime ? parseInt(activity.startTime.split(':')[0], 10) : 9;
      let group: string;
      if (hour < 12) group = 'Morning';
      else if (hour < 17) group = 'Afternoon';
      else group = 'Evening';
      
      if (group !== currentGroup) {
        currentGroup = group;
        groups.push({ label: group, activities: [] });
      }
      groups[groups.length - 1].activities.push(activity);
    }
    return groups;
  }, [todaysItinerary]);

  // Route map activities
  const routeMapActivities = useMemo(() => {
    if (!todaysItinerary) return [];
    return todaysItinerary.activities.map(a => ({
      id: a.id,
      title: a.name,
      location: a.location ? {
        name: a.location.name,
        address: a.location.address,
        lat: a.location.lat,
        lng: a.location.lng,
      } : undefined,
    }));
  }, [todaysItinerary]);

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

  // Determine if the displayed day is in the past (not today)
  const dayDate = parseLocalDate(todaysItinerary.date);
  const isPastDay = isBefore(dayDate, new Date()) && !isToday(dayDate);

  // Get hero image for Today tab
  const seededHero = (trip.metadata as Record<string, unknown>)?.hero_image;
  const seededHeroUrl = typeof seededHero === 'string' && seededHero.length > 0 ? seededHero : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-8"
    >
      {/* Hero Image */}
      {seededHeroUrl && (
        <div className="relative h-48 rounded-xl overflow-hidden">
          <img
            src={seededHeroUrl}
            alt={trip.destination}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
          <div className="absolute bottom-3 left-4">
            <p className="font-serif text-lg font-semibold text-white drop-shadow-md">
              {todaysItinerary.theme || `Day ${tripContext.currentDayNumber}`}
            </p>
          </div>
        </div>
      )}

      {/* Daily Progress Bar */}
      <DailyProgressBar
        completedCount={completedActivities.size}
        totalCount={todaysItinerary.activities.length}
        dayNumber={tripContext.currentDayNumber}
        totalDays={tripContext.totalDays}
        daysRemaining={tripContext.daysRemaining}
        isLastDay={tripContext.isLastDay}
      />

      {/* Editorial Day Header */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-4xl font-bold text-primary/20">
            {String(tripContext.currentDayNumber).padStart(2, '0')}
          </span>
          <div>
            <span className="inline-block bg-gradient-to-r from-primary/15 to-primary/5 px-3 py-1 rounded-full">
              <h2 className="font-serif text-xl font-semibold leading-tight text-foreground">
                {todaysItinerary.theme || `Day ${tripContext.currentDayNumber}`}
              </h2>
            </span>
            {todaysItinerary.description && (
              <p className="font-serif text-sm italic text-muted-foreground mt-1">
                {todaysItinerary.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] font-medium">
            {format(parseLocalDate(todaysItinerary.date), 'EEEE, MMMM d')}
          </Badge>
          {todaysItinerary.weather?.condition && (
            <Badge variant="outline" className="text-[10px]">
              {todaysItinerary.weather.condition}
              {todaysItinerary.weather.high && ` · ${todaysItinerary.weather.high}°`}
            </Badge>
          )}
        </div>
      </div>

      {/* NOW Context — editorial styled */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Now</span>
        </div>

        {nowContext?.currentActivity ? (
          <div>
            <h3 className="font-serif text-lg font-semibold">{nowContext.currentActivity.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {nowContext.currentActivity.location?.address || nowContext.currentActivity.location?.name}
            </p>
            {nowContext.currentActivity.tips?.[0] && (
              <div className="mt-3 pl-3 border-l-2 border-primary/30">
                <p className="font-serif text-sm italic text-muted-foreground">
                  {nowContext.currentActivity.tips[0]}
                </p>
              </div>
            )}
          </div>
        ) : nowContext?.isFreeTime ? (
          <div>
            <h3 className="font-serif text-lg font-semibold">
              Free time until {nowContext.freeUntil && format(nowContext.freeUntil, 'h:mm a')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              You're near {trip.destination}. Some ideas:
            </p>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
                <Coffee className="w-3.5 h-3.5" />
                Coffee
              </Button>
              <Button variant="outline" size="sm" className="rounded-full">
                Quick bite
              </Button>
              <Button variant="outline" size="sm" className="rounded-full">
                Wander
              </Button>
            </div>
          </div>
        ) : nowContext?.isDayComplete ? (
          <div>
            <h3 className="font-serif text-lg font-semibold">Day complete! 🎉</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {tripContext.isLastDay 
                ? "Last day of your trip. Make the most of it!"
                : `${tripContext.daysRemaining} day${tripContext.daysRemaining > 1 ? 's' : ''} to go.`}
            </p>
          </div>
        ) : (
          <div>
            <h3 className="font-serif text-lg font-semibold">Day is starting</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {todaysItinerary.theme || `Day ${tripContext.currentDayNumber} in ${trip.destination}`}
            </p>
          </div>
        )}
      </div>

      {/* Trip Rescue Banner — only for today */}
      {!isPastDay && sentiment.needsRescue && !rescueDismissed && (
        <TripRescueBanner
          sentiment={sentiment}
          destination={trip.destination}
          tripId={trip.id}
          dayNumber={tripContext.currentDayNumber}
          totalDays={tripContext.totalDays}
          onSwapActivity={onSwapActivity}
          onLightenPace={onLightenPace}
          onDismiss={onRescueDismiss}
        />
      )}

      {/* Smart Swap Suggestion — only for today */}
      {!isPastDay && (
        <SmartSwapSuggestion
          currentActivity={nowContext?.currentActivity ? {
            id: nowContext.currentActivity.id,
            name: nowContext.currentActivity.name,
            startTime: nowContext.currentActivity.startTime,
            endTime: nowContext.currentActivity.endTime,
            location: nowContext.currentActivity.location,
          } : null}
          nextActivity={nowContext?.nextActivity ? {
            id: nowContext.nextActivity.id,
            name: nowContext.nextActivity.name,
            startTime: nowContext.nextActivity.startTime,
            endTime: nowContext.nextActivity.endTime,
            duration: nowContext.nextActivity.duration,
            location: nowContext.nextActivity.location,
            type: nowContext.nextActivity.type,
            category: nowContext.nextActivity.category,
          } : null}
          dayDate={todaysItinerary.date}
          completedActivities={completedActivities}
          onSwapRequest={handleSwapRequest}
        />
      )}

      {/* Past day indicator */}
      {isPastDay && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
          <Check className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">This day has passed</span>
        </div>
      )}

      {/* Route Map (collapsible) */}
      <div>
        <button
          onClick={() => setShowMap(!showMap)}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <Map className="w-3.5 h-3.5" />
          {showMap ? 'Hide route' : "Today's route"}
          <ChevronRight className={cn('w-3 h-3 transition-transform', showMap && 'rotate-90')} />
        </button>
        <AnimatePresence>
          {showMap && (
            <DayRouteMap activities={routeMapActivities} />
          )}
        </AnimatePresence>
      </div>

      {/* Activities — grouped by time of day with editorial timeline */}
      <div className="space-y-6">
        {timeGroups.map((group) => (
          <div key={group.label} className="space-y-4">
            {/* Time-of-day section header */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
                {group.label}
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
            </div>

            {/* Activities with timeline */}
            {group.activities.map((activity, idx) => {
              const isCompleted = completedActivities.has(activity.id);
              const isCurrent = nowContext?.currentActivity?.id === activity.id;
              const isNext = nowContext?.nextActivity?.id === activity.id;
              const isLast = idx === group.activities.length - 1;

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="flex gap-3"
                >
                  {/* Timeline column */}
                  <div className="flex flex-col items-center pt-1.5">
                    <div className={cn(
                      'w-3 h-3 rounded-full border-2 shrink-0',
                      isCurrent
                        ? 'bg-primary border-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]'
                        : isCompleted
                          ? 'bg-primary/50 border-primary/50'
                          : 'bg-background border-border'
                    )} />
                    {!isLast && (
                      <div className={cn(
                        'w-px flex-1 mt-1',
                        isCompleted ? 'bg-primary/30' : 'bg-border/60'
                      )} />
                    )}
                  </div>

                  {/* Activity card */}
                  <div className={cn(
                    'flex-1 min-w-0 rounded-xl border p-4 transition-all',
                    isCurrent && 'ring-1 ring-primary/40 border-primary/30 bg-primary/[0.03]',
                    isCompleted && 'opacity-60',
                    !isCurrent && !isCompleted && 'bg-card border-border/50'
                  )}>
                    <div className="flex gap-3">
                      {/* Activity thumbnail */}
                      <ActivityImageThumb
                        name={activity.name}
                        category={activity.category}
                        imageUrl={activity.imageUrl}
                        destination={trip.destination}
                      />
                      <div className="flex-1 min-w-0">
                        {/* Time + status badges */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={cn(
                            'text-xs font-medium',
                            isCurrent ? 'text-primary' : 'text-muted-foreground'
                          )}>
                            {activity.startTime || '--:--'}
                          </span>
                          {isCurrent && (
                            <Badge className="bg-primary text-primary-foreground text-[9px] h-4 px-1.5">
                              NOW
                            </Badge>
                          )}
                          {isNext && !isCurrent && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                              NEXT
                            </Badge>
                          )}
                          {activity.duration && (
                            <span className="text-[10px] text-muted-foreground">
                              {activity.duration < 60
                                ? `${activity.duration}m`
                                : `${Math.floor(activity.duration / 60)}h${activity.duration % 60 ? ` ${activity.duration % 60}m` : ''}`}
                            </span>
                          )}
                        </div>

                        {/* Activity name — serif editorial */}
                        <h4 className={cn(
                          'font-serif text-base font-semibold leading-snug',
                          isCompleted && 'line-through text-muted-foreground'
                        )}>
                          {activity.name}
                        </h4>
                      </div>
                    </div>

                    {activity.location?.address && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{activity.location.address}</span>
                      </p>
                    )}

                    {/* Tips — editorial pull-quote style */}
                    {activity.tips && activity.tips.length > 0 && (
                      <div className="mt-3 pl-3 border-l-2 border-primary/20 space-y-1">
                        {activity.tips.slice(0, 2).map((tip, i) => (
                          <p key={i} className="text-xs font-serif italic text-muted-foreground leading-relaxed">
                            {tip}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Confirmation number */}
                    {activity.confirmationNumber && (
                      <div className="flex items-center gap-2 mt-3 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                        <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                        <code className="text-[11px] font-mono flex-1 truncate text-emerald-700">
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

                    {/* Post-Activity Nudge */}
                    {!isPastDay && isCompleted && !feedbackByActivity.has(activity.id) && (
                      <div className="mt-3">
                        <PostActivityNudge
                          activityId={activity.id}
                          activityName={activity.name}
                          tripId={trip.id}
                          destination={trip.destination}
                          activityType={activity.type}
                          activityCategory={activity.category}
                          isCompleted={isCompleted}
                          hasRating={feedbackByActivity.has(activity.id)}
                        />
                      </div>
                    )}

                    {/* Inline Rating + Guide Bookmark — today only */}
                    {!isPastDay && (
                      <div className="mt-3 pt-2 border-t border-border/30 flex items-center justify-between">
                        <InlineActivityRating
                          activityId={activity.id}
                          tripId={trip.id}
                          activityType={activity.type}
                          activityCategory={activity.category}
                          destination={trip.destination}
                          existingRating={feedbackByActivity.get(activity.id)?.rating as any || null}
                          onVoicePress={() => onVoicePress(activity.id, activity.name)}
                          compact
                        />
                        <GuideBookmarkButton
                          activityId={activity.id}
                          activityName={activity.name}
                          tripId={trip.id}
                          compact
                        />
                      </div>
                    )}

                    {/* Voice note indicator */}
                    {feedbackByActivity.get(activity.id)?.personalization_tags?.includes('has_voice_note') && (
                      <VoiceNotePlayer tripId={trip.id} activityId={activity.id} />
                    )}

                    {/* Action Buttons — today only */}
                    {!isPastDay && (
                      <>
                        <div className="flex items-center gap-2 mt-3">
                          {activity.location && (
                            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs rounded-full" onClick={() => {
                              openMapLocation({
                                name: activity.location?.name || activity.name,
                                address: activity.location?.address,
                                lat: activity.location?.lat,
                                lng: activity.location?.lng,
                              }, 'auto', toTravelMode(activity.transportationMethod));
                            }}>
                              <Navigation className="w-3 h-3" />
                              Directions
                            </Button>
                          )}
                          {activity.voucherUrl && (
                            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs rounded-full">
                              <QrCode className="w-3 h-3" />
                              Tickets
                            </Button>
                          )}
                          <MemoryUploadButton
                            tripId={trip.id}
                            activityId={activity.id}
                            activityName={activity.name}
                            locationName={activity.location?.name}
                            dayNumber={tripContext.currentDayNumber}
                            variant="icon"
                          />
                          <div className="ml-auto">
                            <CheckInButton
                              activityId={activity.id}
                              activityName={activity.name}
                              tripId={trip.id}
                              destination={trip.destination}
                              activityType={activity.type}
                              activityCategory={activity.category}
                              isCheckedIn={isCompleted}
                              isNearby={proximity.nearbyActivityId === activity.id}
                              distanceMeters={proximity.nearbyActivityId === activity.id ? proximity.distanceMeters : null}
                              onCheckIn={onActivityComplete}
                            />
                          </div>
                        </div>

                        {/* Inline Route Details */}
                        {activity.location && (
                          <InlineRouteDetails
                            activity={activity}
                            previousActivity={idx > 0 ? group.activities[idx - 1] : null}
                          />
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Inline Notes */}
      <div className="pt-2">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6" />
        <ActiveTripNotes tripId={tripId} dayNumber={tripContext.currentDayNumber} />
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-center gap-4 pt-4">
        <Button variant="ghost" size="sm" className="font-serif italic text-muted-foreground">
          View full day
        </Button>
        <Button variant="ghost" size="sm" className="font-serif italic text-muted-foreground">
          Tomorrow →
        </Button>
      </div>

      {/* Activity Alternatives Drawer (Smart Swap) */}
      <ActivityAlternativesDrawer
        open={swapDrawerOpen}
        onClose={() => {
          setSwapDrawerOpen(false);
          setSwapTargetActivity(null);
        }}
        activity={swapTargetActivity}
        destination={destination}
        existingActivities={itineraryActivities}
        onSelectAlternative={handleAlternativeSelected}
      />
    </motion.div>
  );
}
