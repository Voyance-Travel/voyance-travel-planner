import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Plane, Hotel, MapPin, Clock, Calendar, Loader2, RefreshCw, AlertCircle, Sparkles, CheckCircle, DollarSign, Users, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { DayItinerary, ItineraryActivity } from '@/types/itinerary';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState, useCallback } from 'react';
import { useEntitlements, canUse, getRemainingQuota, useConsumeUsage } from '@/hooks/useEntitlements';
import { useAuth } from '@/contexts/AuthContext';
import { isQuizCompleted } from '@/utils/quizUtils';
import { UpgradePrompt } from '@/components/common/UpgradePrompt';
import { formatWeatherCondition } from '@/utils/textFormatting';
import { useLovableItinerary } from '@/hooks/useLovableItinerary';
import { AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TripBudgetTracker from '@/components/planner/budget/TripBudgetTracker';
import TripMembersPanel from '@/components/planner/budget/TripMembersPanel';
import TransportationPreferences, { TransportationPreference } from '@/components/planner/TransportationPreferences';
import RentalCarModal, { RentalCarDetails } from '@/components/planner/RentalCarModal';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import CustomerDayCard from '@/components/planner/CustomerDayCard';
import { toast } from 'sonner';

interface ItineraryPreviewProps {
  tripId?: string;
  tripDetails: {
    name?: string;
    destination: string;
    departureCity: string;
    startDate: string;
    endDate: string;
    travelers: number;
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
              {day.date ? format(new Date(day.date), 'EEEE, MMMM d') : day.theme}
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
                <span className="text-sm">{activity.time}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{activity.title}</p>
                <p className="text-sm text-muted-foreground">{activity.description}</p>
                {activity.location?.name && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {activity.location.name}
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
  const [showRentalCarModal, setShowRentalCarModal] = useState(false);
  const [hasSetTransport, setHasSetTransport] = useState(false);
  const [hasConsumedQuota, setHasConsumedQuota] = useState(false);
  const [activeTab, setActiveTab] = useState('itinerary');
  const [regeneratingDayNumber, setRegeneratingDayNumber] = useState<number | null>(null);
  const [localDays, setLocalDays] = useState<DayItinerary[]>([]);
  
  // Check if user has completed the quiz
  const hasCompletedQuiz = user?.quizCompleted || isQuizCompleted();

  // Check entitlements
  const canGenerate = canUse(entitlements, 'ai.itinerary.generate');
  const canRegenerate = canUse(entitlements, 'ai.itinerary.regenerate');
  const remainingGenerations = getRemainingQuota(entitlements, 'ai.itinerary.generate_quota_month');

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

  // Transportation preference state
  const [transportPref, setTransportPref] = useState<TransportationPreference>(
    plannerState.basics.transportationPreference || { modes: [] }
  );
  const [rentalCar, setRentalCar] = useState<RentalCarDetails | undefined>(
    plannerState.basics.rentalCar
  );

  // Handle transportation change
  const handleTransportChange = (pref: TransportationPreference) => {
    setTransportPref(pref);
    setBasics({ transportationPreference: pref });
  };

  const handleRentalCarSave = (details: RentalCarDetails) => {
    setRentalCar(details);
    setBasics({ rentalCar: details });
  };

  // Check for existing itinerary on mount, then auto-start if needed
  useEffect(() => {
    if (!tripId) return;
    
    const init = async () => {
      const exists = await checkExisting();
      if (exists) {
        setHasSetTransport(true); // Already has itinerary, skip transport selection
      }
      // Don't auto-generate yet - wait for user to set transport preferences
    };
    init();
  }, [tripId]);

  // Start generation after transport preferences are set
  const handleStartGeneration = () => {
    if (!tripId) return; // Removed canGenerate check - gate temporarily disabled
    
    setHasSetTransport(true);
    
    // Skip quota consumption for now - gate temporarily disabled
    setHasConsumedQuota(true);
    // Pass transport preferences to generation
    generateItinerary({
      transportationModes: transportPref.modes,
      primaryTransport: transportPref.primaryMode,
      hasRentalCar: !!rentalCar,
    });
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
    
    try {
      const { data, error } = await import('@/integrations/supabase/client').then(m => 
        m.supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'regenerate-day',
            tripId,
            dayNumber,
            destination: tripDetails.destination,
            keepActivities,
            preferences: {
              transportationModes: transportPref.modes,
              primaryTransport: transportPref.primaryMode,
              hasRentalCar: !!rentalCar,
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
  }, [tripId, tripDetails.destination, transportPref, rentalCar]);

  // Handle activity lock toggle
  const handleActivityLock = useCallback((activityId: string, locked: boolean) => {
    setLocalDays(prev => prev.map(day => ({
      ...day,
      activities: day.activities.map(a => 
        a.id === activityId ? { ...a, isLocked: locked } : a
      )
    })));
    toast.success(locked ? 'Activity locked' : 'Activity unlocked');
  }, []);

  // Handle activity swap
  const handleActivitySwap = useCallback((oldActivityId: string, newActivity: ItineraryActivity) => {
    setLocalDays(prev => prev.map(day => ({
      ...day,
      activities: day.activities.map(a => 
        a.id === oldActivityId ? { ...newActivity, time: a.time } : a
      )
    })));
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

  // Show transportation selection before generation starts
  if (!hasSetTransport && !isGenerating && !isReady && !hasExistingItinerary) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-medium text-foreground mb-2">
            Before We Plan Your Trip
          </h1>
          <p className="text-muted-foreground">
            Help us personalize your {tripDetails.destination} itinerary
          </p>
        </div>

        {/* Trip Summary Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white mb-8">
          <h2 className="text-xl font-display font-medium mb-4">
            {tripDetails.name || `Trip to ${tripDetails.destination}`}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>{tripDetails.destination}</span>
            </div>
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-slate-400" />
              <span>{tripDetails.departureCity}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>
                {format(new Date(tripDetails.startDate), 'MMM d')} - {format(new Date(tripDetails.endDate), 'MMM d')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span>{tripDetails.travelers} travelers</span>
            </div>
          </div>
        </div>

        {/* Transportation Preferences */}
        <TransportationPreferences
          value={transportPref}
          onChange={handleTransportChange}
          onAddRentalCar={() => setShowRentalCarModal(true)}
          hasRentalCar={!!rentalCar}
        />

        {/* Rental Car Summary */}
        {rentalCar && (
          <Card className="mt-4 border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Car className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">
                      {rentalCar.rentalCompany ? `${rentalCar.rentalCompany} - ` : ''}
                      {rentalCar.carType || 'Rental Car'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {rentalCar.pickupLocation || 'Pickup location TBD'}
                      {rentalCar.totalCost && ` • ${rentalCar.currency || 'USD'} ${rentalCar.totalCost}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRentalCarModal(true)}
                >
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={onBack} className="h-12 px-6">
            Back
          </Button>
          <Button
            onClick={handleStartGeneration}
            className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Generate My Itinerary
          </Button>
        </div>

        {/* Rental Car Modal */}
        <RentalCarModal
          open={showRentalCarModal}
          onClose={() => setShowRentalCarModal(false)}
          onSave={handleRentalCarSave}
          initialData={rentalCar}
          tripDates={{ startDate: tripDetails.startDate, endDate: tripDetails.endDate }}
        />
      </motion.div>
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
        <div className="text-center mb-6">
          <h1 className="text-3xl font-display font-medium text-foreground mb-2">
            Your Trip Preview
          </h1>
          <p className="text-muted-foreground">
            Generating itinerary for {tripDetails.destination}
          </p>
        </div>

        {/* Quiz Not Completed Warning - show during generation too */}
        {!hasCompletedQuiz && (
          <Card className="border-amber-500/30 bg-amber-500/10 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Generating Generic Itinerary</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Since you haven't completed the quiz, this itinerary won't reflect your personal preferences. You can take the quiz later to get more personalized recommendations.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">{message}</span>
                  <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </div>
            
            {currentStep === 'generating' && totalDays > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Day {currentDay} of {totalDays}</span>
              </div>
            )}

            <div className="flex justify-center mt-4">
              <Button variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

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

          {/* Placeholder for next day being generated */}
          {currentDay > 0 && currentDay <= totalDays && days.length < currentDay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8"
            >
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating Day {currentDay}...</span>
              </div>
            </motion.div>
          )}

          {/* Show skeletons for remaining days */}
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
              {canRegenerate && (
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
              )}
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
                {format(new Date(tripDetails.startDate), 'MMM d')} -{' '}
                {format(new Date(tripDetails.endDate), 'MMM d')}
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
                  onRegenerateDay={handleRegenerateDay}
                  isRegenerating={regeneratingDayNumber === day.dayNumber}
                  onActivityLock={handleActivityLock}
                  onActivitySwap={handleActivitySwap}
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
          Back
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
