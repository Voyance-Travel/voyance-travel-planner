import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { parseLocalDate, safeFormatDate } from '@/utils/dateUtils';
import { Plane, MapPin, Clock, Calendar, Loader2, RefreshCw, AlertCircle, Sparkles, CheckCircle, Users, Hotel, DollarSign, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { DayItinerary, ItineraryActivity } from '@/types/itinerary';
import { convertBackendDay } from '@/types/itinerary';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState, useCallback } from 'react';
import { useEntitlements, canUse, getRemainingQuota, useConsumeUsage } from '@/hooks/useEntitlements';
import { useAuth } from '@/contexts/AuthContext';
import { isQuizCompleted } from '@/utils/quizUtils';
import { formatWeatherCondition } from '@/utils/textFormatting';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import { formatTime12h } from '@/utils/timeFormat';
import { useLovableItinerary } from '@/hooks/useLovableItinerary';
import { AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TripBudgetTracker from '@/components/planner/budget/TripBudgetTracker';
import TripMembersPanel from '@/components/planner/budget/TripMembersPanel';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import CustomerDayCard from '@/components/planner/CustomerDayCard';
import { toast } from 'sonner';
import ItineraryContextForm, { ItineraryContextData } from '@/components/planner/ItineraryContextForm';
import SaveAsTemplateDialog from '@/components/itinerary/SaveAsTemplateDialog';

interface FlightSelectionData {
  // New structure (matches backend reader)
  departure?: {
    arrival?: { airport?: string; time?: string; city?: string; date?: string };
    arrivalTime?: string;
    departureTime?: string;
    connections?: Array<{ departureAirport?: string; arrivalAirport?: string; departureTime?: string; arrivalTime?: string }>;
  };
  return?: {
    departure?: { airport?: string; time?: string; city?: string; date?: string };
    departureTime?: string;
    connections?: Array<{ departureAirport?: string; arrivalAirport?: string; departureTime?: string; arrivalTime?: string }>;
  };
  // Legacy flat structure
  arrivalTime?: string;
  returnDepartureTime?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  // Multi-city
  interCityTransfers?: Array<{ mode?: string; fromCity?: string; toCity?: string; departureTime?: string; arrivalTime?: string }>;
  isMultiCity?: boolean;
}

interface ItineraryPreviewProps {
  tripId?: string;
  tripDetails: {
    name?: string;
    destination: string;
    departureCity: string;
    startDate: string;
    endDate: string;
    travelers: number;
    tripType?: string;
    flightSelection?: FlightSelectionData;
    hotelLocation?: string;
  };
  onComplete: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

// Loading skeleton for day cards
function DayCardSkeleton({ dayIndex }: { dayIndex: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.1 }}
      className="bg-card rounded-xl border border-border overflow-hidden"
    >
      <div className="bg-muted/50 px-6 py-4 border-b border-border">
        <Skeleton className="h-4 w-16 mb-2" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="flex items-center gap-2 w-24 flex-shrink-0">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex-1">
              <Skeleton className="h-5 w-48 mb-1" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Streaming day card component
function StreamingDayCard({ day, isNew }: { day: DayItinerary; isNew: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`bg-card rounded-xl border overflow-hidden ${isNew ? 'ring-2 ring-primary/50 border-primary/30' : 'border-border'}`}
    >
      {/* Day Header */}
      <div className="bg-muted/50 px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Day {day.dayNumber}
              </span>
              {isNew && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  Just added
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {day.date ? safeFormatDate(day.date, 'EEEE, MMMM d', day.theme || `Day ${day.dayNumber}`) : day.theme}
            </h3>
            {day.theme && day.date && (
              <p className="text-sm text-muted-foreground mt-1">{day.theme}</p>
            )}
          </div>
          {day.weather && (
            <div className="text-right text-sm text-muted-foreground">
              <p>{day.weather.high}°/{day.weather.low}°</p>
              <p>{formatWeatherCondition(day.weather.condition)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Activities */}
      <div className="p-6">
        <div className="space-y-4">
          {day.activities.map((activity, actIndex) => (
            <div key={activity.id || actIndex} className="flex gap-4">
              <div className="flex items-center gap-2 text-muted-foreground w-24 flex-shrink-0">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{formatTime12h(activity.time)}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{sanitizeActivityName(activity.title)}</p>
                <p className="text-sm text-muted-foreground">{activity.description}</p>
                {activity.location && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {typeof activity.location === 'string' 
                      ? activity.location 
                      : activity.location.name || activity.location.address}
                  </p>
                )}
                {activity.cost > 0 && (
                  <p className="text-xs text-primary mt-1">
                    Est. cost: ${activity.cost}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        {day.activities.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t text-sm text-muted-foreground">
            <span>{day.estimatedWalkingTime} walking</span>
            <span className="font-medium text-foreground">
              Day total: ${day.totalCost}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ItineraryPreview({
  tripId,
  tripDetails,
  onComplete,
  onBack,
  isLoading: isSubmitting,
}: ItineraryPreviewProps) {
  const { isAuthenticated, user } = useAuth();
  const { state: plannerState, setBasics } = useTripPlanner();
  const { entitlements, isLoading: isLoadingEntitlements, isPaid } = useEntitlements();
  const consumeUsage = useConsumeUsage();
  const [hasSetContext, setHasSetContext] = useState(false);
  const [hasConsumedQuota, setHasConsumedQuota] = useState(false);
  const [activeTab, setActiveTab] = useState('itinerary');
  const [regeneratingDayNumber, setRegeneratingDayNumber] = useState<number | null>(null);
  const [itineraryContext, setItineraryContext] = useState<ItineraryContextData>({});
  const [localDays, setLocalDays] = useState<DayItinerary[]>([]);
  
  // Check if user has completed the quiz
  const hasCompletedQuiz = user?.quizCompleted || isQuizCompleted();

  // Check entitlements
  const canGenerate = canUse(entitlements, 'ai.itinerary.generate');
  const canRegenerate = canUse(entitlements, 'ai.itinerary.regenerate');
  const remainingGenerations = getRemainingQuota(entitlements, 'ai.itinerary.generate_quota_month');

  // Extract flight times from existing flight_selection data (collected on Start page)
  // Handle both new structure (departure.arrival.time) and flat (arrivalTime)
  const existingFlightData = tripDetails.flightSelection;
  const existingArrivalTime = existingFlightData?.departure?.arrival?.time 
    || existingFlightData?.departure?.arrivalTime 
    || existingFlightData?.arrivalTime;
  const existingDepartureTime = existingFlightData?.return?.departure?.time 
    || existingFlightData?.return?.departureTime 
    || existingFlightData?.returnDepartureTime;
  const existingHotelLocation = tripDetails.hotelLocation;
  
  // Determine if we already have sufficient context from Start page
  const hasPreExistingContext = Boolean(existingArrivalTime || existingDepartureTime || existingHotelLocation);

  // Use new Lovable AI itinerary hook
  const {
    loading,
    progress,
    currentStep,
    currentDay,
    totalDays,
    message,
    days,
    error,
    hasExistingItinerary,
    generationDuration,
    checkExisting,
    generateItinerary,
    regenerate,
    cancel,
    clearError,
  } = useLovableItinerary(tripId || null);

  // Check for existing itinerary on mount, then auto-start if we have context
  useEffect(() => {
    if (!tripId) return;
    
    const init = async () => {
      const exists = await checkExisting();
      if (exists) {
        setHasSetContext(true); // Already has itinerary, skip context form
      } else if (hasPreExistingContext) {
        // We have flight data from Start page - auto-start generation
        // Fetch transport preferences from DB to include in generation
        let transportPrefs: { transportationModes?: string[]; primaryTransport?: string; hasRentalCar?: boolean } = {};
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: tripRow } = await supabase
            .from('trips')
            .select('transportation_preferences')
            .eq('id', tripId)
            .single();
          if (tripRow?.transportation_preferences) {
            const prefs = tripRow.transportation_preferences as any;
            // Handle both array-of-objects (multi-city) and object (single-city) formats
            if (Array.isArray(prefs)) {
              const modes = prefs.map((p: any) => p.type || p.mode).filter(Boolean);
              transportPrefs = { transportationModes: modes };
            } else if (prefs.modes) {
              transportPrefs = {
                transportationModes: prefs.modes,
                primaryTransport: prefs.primaryMode,
                hasRentalCar: prefs.modes?.includes('rental_car'),
              };
            }
          }
        } catch (e) {
          console.warn('[ItineraryPreview] Could not fetch transport prefs:', e);
        }

        const preContext: ItineraryContextData = {
          hotelLocation: existingHotelLocation,
          arrivalTime: existingArrivalTime,
          departureTime: existingDepartureTime,
        };
        setItineraryContext(preContext);
        setHasSetContext(true);
        setHasConsumedQuota(true);
        generateItinerary({ ...preContext, ...transportPrefs });
      }
    };
    init();
  }, [tripId, hasPreExistingContext, existingArrivalTime, existingDepartureTime, existingHotelLocation]);

  // Handle context form submission - start generation with optional context
  const handleContextSubmit = async (data: ItineraryContextData) => {
    if (!tripId) return;
    
    setItineraryContext(data);
    setHasSetContext(true);
    setHasConsumedQuota(true);
    
    // Save context data (mustDoActivities, isFirstTimeVisitor, etc.) to trip metadata
    // so the edge function can read it during generation
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Read existing metadata first to avoid overwriting
      const { data: tripRow } = await supabase
        .from('trips')
        .select('metadata, transportation_preferences')
        .eq('id', tripId)
        .single();
      
      const existingMetadata = (tripRow?.metadata as Record<string, unknown>) || {};
      
      // Merge context data into metadata
      const metadataUpdates: Record<string, unknown> = { ...existingMetadata };
      if (data.mustDoActivities) {
        metadataUpdates.mustDoActivities = data.mustDoActivities;
      }
      if (data.isFirstTimeVisitor !== undefined) {
        metadataUpdates.isFirstTimeVisitor = data.isFirstTimeVisitor;
      }
      if (data.childrenAges && data.childrenAges.length > 0) {
        metadataUpdates.childrenAges = data.childrenAges;
        metadataUpdates.childrenCount = data.childrenAges.length;
      }
      if (data.preBookedCommitments && data.preBookedCommitments.length > 0) {
        metadataUpdates.preBookedCommitments = data.preBookedCommitments;
      }
      
      // Save metadata to DB
      await supabase
        .from('trips')
        .update({ metadata: metadataUpdates as any })
        .eq('id', tripId);
      
      console.log('[ItineraryPreview] Context saved to metadata:', {
        mustDoActivities: !!data.mustDoActivities,
        isFirstTimeVisitor: data.isFirstTimeVisitor,
        childrenAges: data.childrenAges?.length,
        preBookedCommitments: data.preBookedCommitments?.length,
      });
      
      // Extract transport preferences from same query
      let transportPrefs: { transportationModes?: string[]; primaryTransport?: string; hasRentalCar?: boolean } = {};
      if (tripRow?.transportation_preferences) {
        const prefs = tripRow.transportation_preferences as any;
        if (Array.isArray(prefs)) {
          const modes = prefs.map((p: any) => p.type || p.mode).filter(Boolean);
          transportPrefs = { transportationModes: modes };
        } else if (prefs.modes) {
          transportPrefs = {
            transportationModes: prefs.modes,
            primaryTransport: prefs.primaryMode,
            hasRentalCar: prefs.modes?.includes('rental_car'),
          };
        }
      }

      // Pass context to generation
      generateItinerary({
        hotelLocation: data.hotelLocation,
        arrivalTime: data.arrivalTime,
        departureTime: data.departureTime,
        ...transportPrefs,
      });
    } catch (e) {
      console.warn('[ItineraryPreview] Could not save context or fetch transport prefs:', e);
      // Still proceed with generation even if metadata save fails
      generateItinerary({
        hotelLocation: data.hotelLocation,
        arrivalTime: data.arrivalTime,
        departureTime: data.departureTime,
      });
    }
  };

  // Handle skip - start generation without context
  const handleSkipContext = () => {
    if (!tripId) return;
    
    setHasSetContext(true);
    setHasConsumedQuota(true);
    generateItinerary({});
  };

  const isReady = currentStep === 'complete' && days.length > 0;
  const isGenerating = loading;

  // Handle retry/regenerate
  const handleRetry = () => {
    if (!tripId) return;
    
    // For regeneration, check entitlement
    if (isReady && !canRegenerate) {
      return;
    }
    
    // Consume quota if regenerating
    if (isReady) {
      consumeUsage.mutate(
        { metricKey: 'ai.itinerary.regenerate', amount: 1 },
        { onSuccess: () => regenerate() }
      );
    } else {
      regenerate();
    }
  };

  // Sync local days with hook days
  useEffect(() => {
    if (days.length > 0) {
      setLocalDays(days);
    }
  }, [days]);

  // Handle day regeneration
  const handleRegenerateDay = useCallback(async (dayNumber: number, keepActivities?: string[]) => {
    if (!tripId) return;
    
    setRegeneratingDayNumber(dayNumber);
    
    // Find current day's activities to pass as currentActivities for locked activity preservation
    const currentDay = localDays.find(d => d.dayNumber === dayNumber);
    
    // Convert to backend format with proper field names (startTime, isLocked, etc.)
    const backendActivities = (currentDay?.activities || []).map(a => ({
      id: a.id,
      name: a.title,
      title: a.title,
      description: a.description,
      category: a.type,
      startTime: a.time,
      endTime: '',
      location: a.location,
      cost: a.cost,
      estimatedCost: { amount: a.cost, currency: 'USD' },
      isLocked: a.isLocked, // CRITICAL: Backend checks this field
      tags: a.tags,
    }));
    
    try {
      const { data, error } = await import('@/integrations/supabase/client').then(m => 
        m.supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'regenerate-day',
            tripId,
            dayNumber,
            totalDays: localDays.length, // CRITICAL: Required for isFirstDay/isLastDay logic
            destination: tripDetails.destination,
            tripType: tripDetails.tripType,
            keepActivities,
            currentActivities: backendActivities, // Backend format with isLocked
            preferences: {
              hotelLocation: itineraryContext.hotelLocation,
              arrivalTime: itineraryContext.arrivalTime,
              departureTime: itineraryContext.departureTime,
            },
          },
        })
      );

      if (error) throw error;
      
      if (data?.success && data?.day) {
        // Update local days with the regenerated day
        setLocalDays(prev => prev.map(d => 
          d.dayNumber === dayNumber 
            ? { ...d, ...data.day, activities: data.day.activities || d.activities }
            : d
        ));
        toast.success(`Day ${dayNumber} has been refreshed!`);
      }
    } catch (error) {
      console.error('Failed to regenerate day:', error);
      toast.error('Failed to refresh day. Please try again.');
    } finally {
      setRegeneratingDayNumber(null);
    }
  }, [tripId, tripDetails.destination, itineraryContext, localDays]);

  // Handle activity lock toggle - persists immediately to normalized itinerary_activities table
  const handleActivityLock = useCallback(async (activityId: string, locked: boolean) => {
    // Find the activity's context for fallback matching
    let activityContext: { dayNumber: number; title: string; time?: string } | null = null;
    for (const day of localDays) {
      const activity = day.activities.find(a => a.id === activityId);
      if (activity) {
        const activityStartTime = (activity as any).startTime ?? activity.time;
        activityContext = { dayNumber: day.dayNumber, title: activity.title, time: activityStartTime };
        break;
      }
    }
    
    // Update local state immediately for responsive UI
    setLocalDays(prev => prev.map(day => ({
      ...day,
      activities: day.activities.map(a => 
        a.id === activityId ? { ...a, isLocked: locked } : a
      )
    })));
    toast.success(locked ? 'Activity locked' : 'Activity unlocked');
    
    // Persist lock state directly to itinerary_activities table
    if (tripId) {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { error } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'toggle-activity-lock',
            tripId,
            activityId,
            isLocked: locked,
            // Include fallback matching info for non-UUID IDs
            dayNumber: activityContext?.dayNumber,
            activityTitle: activityContext?.title,
            startTime: activityContext?.time,
          },
        });
        if (error) {
          console.error('[ItineraryPreview] Failed to persist lock state:', error);
          // Revert on error
          setLocalDays(prev => prev.map(day => ({
            ...day,
            activities: day.activities.map(a => 
              a.id === activityId ? { ...a, isLocked: !locked } : a
            )
          })));
          toast.error('Failed to save lock state');
        }
      } catch (err) {
        console.error('[ItineraryPreview] Lock persist error:', err);
      }
    }
  }, [tripId, localDays]);

  // Handle activity swap
  const handleActivitySwap = useCallback((oldActivityId: string, newActivity: ItineraryActivity) => {
    setLocalDays(prev => prev.map(day => ({
      ...day,
      activities: day.activities.map(a => 
        a.id === oldActivityId ? { ...newActivity, time: a.time } : a
      )
    })));
  }, []);

  // Handle day restore from version history (undo)
  const handleDayRestore = useCallback((
    dayNumber: number, 
    activities: ItineraryActivity[], 
    metadata?: { title?: string; theme?: string }
  ) => {
    setLocalDays(prev => prev.map(day => 
      day.dayNumber === dayNumber 
        ? { 
            ...day, 
            activities,
            theme: metadata?.theme || day.theme,
            description: metadata?.title || day.description, // title maps to description
          } 
        : day
    ));
  }, []);

  // TEMPORARILY DISABLED: Premium gate removed - will be re-enabled later
  // Original check: if (!isLoadingEntitlements && !canGenerate && !isReady && !isGenerating) { ... }

  // Show error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-10">
          <h1 className="text-3xl font-display font-medium text-foreground mb-2">
            Your Trip Preview
          </h1>
        </div>
        
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <div>
                <h3 className="font-semibold text-lg text-destructive">Generation Failed</h3>
                <p className="text-muted-foreground mt-1">{message}</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { clearError(); onBack(); }}>
                  Go Back
                </Button>
                <Button onClick={handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Show context form before generation starts (only if no pre-existing flight context)
  // This is a fallback for edge cases - normally we auto-start with flight data from Start page
  if (!hasSetContext && !isGenerating && !isReady && !hasExistingItinerary) {
    return (
      <ItineraryContextForm
        destination={tripDetails.destination}
        startDate={tripDetails.startDate}
        endDate={tripDetails.endDate}
        onContinue={handleContextSubmit}
        onSkip={handleSkipContext}
        initialHotelLocation={existingHotelLocation}
        initialArrivalTime={existingArrivalTime}
        initialDepartureTime={existingDepartureTime}
      />
    );
  }

  // Show generating/streaming state
  if (isGenerating) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Compact Progress Header */}
        <div className="text-center mb-8">
          <p className="text-xs tracking-[0.2em] uppercase text-primary font-medium mb-3">
            {tripDetails.destination}
          </p>
          <h1 className="font-serif text-3xl md:text-4xl font-light text-foreground mb-6">
            Crafting Your <em className="italic">Itinerary</em>
          </h1>
          
          {/* Inline Progress Bar */}
          <div className="max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative shrink-0">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
              <div className="flex-1">
                <Progress value={progress} className="h-1.5" />
              </div>
              <span className="text-sm text-muted-foreground tabular-nums w-10 text-right">
                {Math.round(progress)}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {message}
            </p>
          </div>
          
          <Button variant="ghost" size="sm" onClick={cancel} className="mt-4 text-muted-foreground">
            Cancel
          </Button>
        </div>

        {/* Quiz Not Completed Warning - compact */}
        {!hasCompletedQuiz && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-6 text-sm">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-muted-foreground">
              Generic itinerary - <a href="/quiz" className="text-primary hover:underline">take the quiz</a> for personalized recommendations
            </p>
          </div>
        )}

        {/* Streaming Day Cards - show as they're generated */}
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {days.map((day, index) => (
              <StreamingDayCard 
                key={day.dayNumber} 
                day={day} 
                isNew={index === days.length - 1}
              />
            ))}
          </AnimatePresence>

          {/* Show skeletons when no days yet */}
          {days.length === 0 && [0, 1, 2].map((i) => (
            <DayCardSkeleton key={i} dayIndex={i} />
          ))}
        </div>
      </motion.div>
    );
  }

  // Show complete state with itinerary
  // activeTab state moved to top of component to fix React hooks order

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="text-center mb-6">
        <h1 className="text-3xl font-display font-medium text-foreground mb-2">
          Your Trip Preview
        </h1>
        <p className="text-muted-foreground">
          Review your itinerary for {tripDetails.destination}
        </p>
      </div>

      {/* Quiz Not Completed Warning */}
      {!hasCompletedQuiz && activeTab === 'itinerary' && (
        <Card className="border-amber-500/30 bg-amber-500/10 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Generic Itinerary</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This itinerary is based on general recommendations. Take the <a href="/quiz" className="text-primary hover:underline font-medium">Travel Quiz</a> to get personalized suggestions tailored to your preferences, dietary needs, and travel style.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Header */}
      {isReady && (
        <Card className="border-primary/20 bg-primary/5 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="w-8 h-8 text-primary" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Your Itinerary is Ready!</h3>
                <p className="text-sm text-muted-foreground">
                  {days.length} days planned
                  {generationDuration && ` • Generated in ${(generationDuration / 1000).toFixed(1)}s`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Save as Template */}
                {localDays.length > 0 && (
                  <SaveAsTemplateDialog
                    days={localDays}
                    destination={tripDetails.destination}
                    tripId={tripId}
                  />
                )}
                {canRegenerate && (
                  <Button variant="outline" size="sm" onClick={handleRetry}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trip Summary Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white mb-8">
        <h2 className="text-2xl font-display font-medium mb-4">
          {tripDetails.name || `Trip to ${tripDetails.destination}`}
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Destination</p>
              <p className="font-medium">{tripDetails.destination}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">From</p>
              <p className="font-medium">{tripDetails.departureCity}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Dates</p>
              <p className="font-medium">
                {format(parseLocalDate(tripDetails.startDate), 'MMM d')} -{' '}
                {format(parseLocalDate(tripDetails.endDate), 'MMM d')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Hotel className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Travelers</p>
              <p className="font-medium">{tripDetails.travelers} guests</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-10">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="itinerary" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Itinerary
          </TabsTrigger>
          <TabsTrigger value="budget" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Budget
          </TabsTrigger>
          <TabsTrigger value="friends" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Friends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="itinerary">
          {/* Day-by-Day Itinerary with Refresh & Search */}
          <div className="space-y-6">
            {(localDays.length > 0 ? localDays : days).length > 0 ? (
              (localDays.length > 0 ? localDays : days).map((day, dayIndex) => (
                <CustomerDayCard
                  key={day.dayNumber || dayIndex}
                  day={day}
                  dayIndex={dayIndex}
                  tripId={tripId}
                  onRegenerateDay={handleRegenerateDay}
                  isRegenerating={regeneratingDayNumber === day.dayNumber}
                  onActivityLock={handleActivityLock}
                  onActivitySwap={handleActivitySwap}
                  onDayRestore={handleDayRestore}
                  destination={tripDetails.destination}
                />
              ))
            ) : (
              // Fallback if no days yet
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground mb-4">
                  No itinerary data available yet.
                </p>
                <Button 
                  onClick={() => generateItinerary()} 
                  variant="default" 
                  className="gap-2"
                  disabled={loading}
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Itinerary
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="budget">
          {tripId ? (
            <TripBudgetTracker tripId={tripId} />
          ) : (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Save your trip to enable budget tracking</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="friends">
          {tripId ? (
            <TripMembersPanel tripId={tripId} currentUserEmail={user?.email} />
          ) : (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Save your trip to invite friends</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="h-12 px-6">
          ← Back to Booking Options
        </Button>
        <Button
          onClick={onComplete}
          disabled={isSubmitting || !isReady || days.length === 0}
          className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Trip...
            </span>
          ) : (
            'Confirm & Book'
          )}
        </Button>
      </div>
    </motion.div>
  );
}
