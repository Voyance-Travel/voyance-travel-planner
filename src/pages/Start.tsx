import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Calendar as CalendarIcon, Users, Loader2, DollarSign, 
  Sparkles, ChevronDown, PartyPopper, ArrowRight, Check, Clock,
  Eye, Gem, Utensils
} from 'lucide-react';
import { format, addDays, isBefore, startOfToday, parseISO, startOfMonth } from 'date-fns';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { DraftLimitBanner, DraftLimitBlocker } from '@/components/common/DraftLimitBanner';
import { useDraftLimitCheck } from '@/hooks/useDraftLimitCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Slider } from '@/components/ui/slider';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Import the embedded quiz component
import EmbeddedQuiz from '@/components/planner/steps/EmbeddedQuiz';
// Import destination autocomplete
import { DestinationAutocomplete } from '@/components/planner/shared/DestinationAutocomplete';

// Types
interface LocationSelection {
  display: string;
  cityName: string;
  airportCodes?: string[];
  isMetroArea?: boolean;
}

// Trip occasions
const tripOccasions = [
  { id: 'leisure', label: 'Leisure' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'anniversary', label: 'Anniversary' },
  { id: 'honeymoon', label: 'Honeymoon' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'girls-trip', label: "Girls' Trip" },
  { id: 'guys-trip', label: "Guys' Trip" },
  { id: 'family', label: 'Family' },
  { id: 'solo', label: 'Solo' },
  { id: 'friends', label: 'Friends' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'wellness', label: 'Wellness' },
];

const CELEBRATION_TRIP_TYPES = ['birthday', 'anniversary', 'honeymoon'] as const;

// Sample itineraries for sidebar motivation
const sampleItineraries = [
  {
    destination: 'Kyoto',
    duration: '5 days',
    highlight: 'Bamboo forest at dawn',
    tags: ['Culture', 'Hidden Gems'],
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400',
  },
  {
    destination: 'Amalfi Coast',
    duration: '7 days',
    highlight: 'Cliffside dinner in Ravello',
    tags: ['Romance', 'Cuisine'],
    image: 'https://images.unsplash.com/photo-1534113414509-0eec2bfb493f?w=400',
  },
  {
    destination: 'Bali',
    duration: '6 days',
    highlight: 'Private temple ceremony',
    tags: ['Wellness', 'Adventure'],
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400',
  },
];

// Progress Step Indicator
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const steps = [
    { label: 'Your Style', step: 1 },
    { label: 'Trip Details', step: 2 },
    { label: 'Budget', step: 3 },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, idx) => (
        <div key={s.step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                currentStep === s.step
                  ? 'bg-primary text-primary-foreground'
                  : currentStep > s.step
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {currentStep > s.step ? <Check className="w-4 h-4" /> : s.step}
            </div>
            <span
              className={cn(
                'text-xs mt-1 font-medium',
                currentStep === s.step ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'w-12 h-0.5 mx-2 mt-[-16px]',
                currentStep > s.step ? 'bg-primary' : 'bg-muted'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Sidebar with sample itineraries
function MotivationSidebar() {
  return (
    <div className="hidden lg:block w-80 shrink-0">
      <div className="sticky top-24 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            What you'll get
          </h3>
          <p className="text-xs text-muted-foreground">
            AI-crafted itineraries tailored to your travel DNA
          </p>
        </div>

        <div className="space-y-4">
          {sampleItineraries.map((itinerary) => (
            <motion.div
              key={itinerary.destination}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="group relative overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="aspect-[16/10] overflow-hidden">
                <img
                  src={itinerary.image}
                  alt={itinerary.destination}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="flex items-center justify-between text-white mb-1">
                  <span className="font-medium text-sm">{itinerary.destination}</span>
                  <span className="text-xs opacity-80">{itinerary.duration}</span>
                </div>
                <p className="text-xs text-white/80 mb-2">{itinerary.highlight}</p>
                <div className="flex gap-1">
                  {itinerary.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-[10px] text-white"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Intelligence metrics preview */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Intelligence Included
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Gem className="w-4 h-4 text-emerald-500" />
              <span className="text-foreground">Hidden gems locals love</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-foreground">Best timing for each spot</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Utensils className="w-4 h-4 text-amber-500" />
              <span className="text-foreground">Curated dining picks</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 2: Trip Details Form
function TripDetailsStep({
  destinationSelection,
  setDestinationSelection,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  travelers,
  setTravelers,
  tripType,
  setTripType,
  celebrationDay,
  setCelebrationDay,
  onContinue,
  onBack,
}: {
  destinationSelection: LocationSelection;
  setDestinationSelection: (s: LocationSelection) => void;
  startDate: Date | undefined;
  setStartDate: (d: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (d: Date | undefined) => void;
  travelers: number;
  setTravelers: (n: number) => void;
  tripType: string;
  setTripType: (t: string) => void;
  celebrationDay: number | undefined;
  setCelebrationDay: (d: number | undefined) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const today = startOfToday();
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => 
    startDate ? startOfMonth(startDate) : startOfMonth(new Date())
  );

  // Auto-set end date when start date changes
  useEffect(() => {
    if (startDate && !endDate) {
      setEndDate(addDays(startDate, 5));
    }
  }, [startDate, endDate, setEndDate]);

  const isValid = destinationSelection.cityName && startDate && endDate;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-2">
          Where are you going?
        </h2>
        <p className="text-muted-foreground">
          Tell us about your trip and we'll tailor the experience
        </p>
      </div>

      <div className="space-y-5 max-w-md mx-auto">
        {/* Destination */}
        <div className="space-y-2">
          <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
            Destination
          </label>
          <DestinationAutocomplete
            value={destinationSelection.display}
            onChange={setDestinationSelection}
            placeholder="Search cities..."
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
              Arriving
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-12 justify-between text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  {startDate ? format(startDate, 'MMM d, yyyy') : 'Select date'}
                  <CalendarIcon className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  onSelect={setStartDate}
                  disabled={(date) => isBefore(date, today)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
              Leaving
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-12 justify-between text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  {endDate ? format(endDate, 'MMM d, yyyy') : 'Select date'}
                  <CalendarIcon className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  onSelect={setEndDate}
                  disabled={(date) => (startDate ? isBefore(date, startDate) : isBefore(date, today))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Travelers */}
        <div className="space-y-2">
          <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
            Travelers
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  setTravelers(num);
                  if (num === 1 && tripType !== 'solo') {
                    setTripType('solo');
                  } else if (num > 1 && tripType === 'solo') {
                    setTripType('leisure');
                  }
                }}
                className={cn(
                  'w-12 h-12 rounded-lg border-2 transition-all text-sm font-medium',
                  travelers === num
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                )}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTravelers(Math.min(10, travelers + 1))}
              className="w-12 h-12 rounded-lg border-2 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all text-sm"
            >
              {travelers > 4 ? travelers : '5+'}
            </button>
          </div>
        </div>

        {/* Trip Type */}
        <div className="space-y-3">
          <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
            Trip Type
          </label>
          <div className="flex flex-wrap gap-2">
            {tripOccasions.slice(0, 6).map((occasion) => (
              <button
                key={occasion.id}
                type="button"
                onClick={() => setTripType(occasion.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full border transition-all text-sm',
                  tripType === occasion.id
                    ? 'bg-primary/10 border-primary text-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {occasion.label}
              </button>
            ))}
          </div>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <ChevronDown className="h-3 w-3" />
                More options
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="flex flex-wrap gap-2">
                {tripOccasions.slice(6).map((occasion) => (
                  <button
                    key={occasion.id}
                    type="button"
                    onClick={() => setTripType(occasion.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full border transition-all text-sm',
                      tripType === occasion.id
                        ? 'bg-primary/10 border-primary text-primary font-medium'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    {occasion.label}
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Celebration Day */}
        {CELEBRATION_TRIP_TYPES.includes(tripType as typeof CELEBRATION_TRIP_TYPES[number]) && startDate && endDate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
            <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground flex items-center gap-2">
              <PartyPopper className="h-4 w-4 text-amber-500" />
              Which day is the celebration?
            </label>
            <div className="flex flex-wrap gap-2">
              {Array.from(
                { length: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 },
                (_, i) => i + 1
              ).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setCelebrationDay(day)}
                  className={cn(
                    'w-10 h-10 rounded-full border transition-all text-sm font-medium',
                    celebrationDay === day
                      ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400'
                      : 'border-border text-muted-foreground hover:border-amber-500/40 hover:text-foreground'
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 max-w-md mx-auto">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={!isValid} className="gap-2">
          Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// Step 3: Budget Step
function BudgetStep({
  budgetAmount,
  setBudgetAmount,
  onSubmit,
  onBack,
  isSubmitting,
}: {
  budgetAmount: number | undefined;
  setBudgetAmount: (n: number | undefined) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}) {
  const [showBudget, setShowBudget] = useState(!!budgetAmount);

  const budgetPresets = [
    { label: 'Budget', value: 500, description: 'Under $500/person' },
    { label: 'Moderate', value: 1000, description: '$500–$1,500' },
    { label: 'Premium', value: 2500, description: '$1,500–$3,500' },
    { label: 'Luxury', value: 5000, description: '$3,500+' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-2">
          What's your budget?
        </h2>
        <p className="text-muted-foreground">
          Optional — helps us match recommendations to your comfort level
        </p>
      </div>

      <div className="space-y-6 max-w-md mx-auto">
        {/* Budget presets */}
        <div className="grid grid-cols-2 gap-3">
          {budgetPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setBudgetAmount(preset.value);
                setShowBudget(true);
              }}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all',
                budgetAmount === preset.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <div className="font-medium text-foreground">{preset.label}</div>
              <div className="text-xs text-muted-foreground">{preset.description}</div>
            </button>
          ))}
        </div>

        {/* Custom amount */}
        {showBudget && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
            <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
              Or set exact amount per person
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="e.g. 2000"
                value={budgetAmount || ''}
                onChange={(e) => setBudgetAmount(e.target.value ? Number(e.target.value) : undefined)}
                className="h-12 pl-9 text-base"
                min={0}
              />
            </div>
          </motion.div>
        )}

        {/* Skip option */}
        <button
          type="button"
          onClick={() => {
            setBudgetAmount(undefined);
            setShowBudget(false);
          }}
          className={cn(
            'w-full p-4 rounded-xl border-2 text-center transition-all',
            !budgetAmount
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/40'
          )}
        >
          <div className="font-medium text-foreground">Skip for now</div>
          <div className="text-xs text-muted-foreground">
            We'll use your travel style to guide recommendations
          </div>
        </button>
      </div>

      {/* Submit */}
      <div className="flex justify-between pt-6 max-w-md mx-auto">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="h-14 px-8 text-base font-medium rounded-xl shadow-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Build My Itinerary
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

export default function Start() {
  const { state: plannerState, setBasics, saveTrip } = useTripPlanner();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canCreateDraft, needsCredits } = useDraftLimitCheck();
  const [showLimitBlocker, setShowLimitBlocker] = useState(false);

  // Current step: 1 = Quiz, 2 = Trip Details, 3 = Budget
  const [currentStep, setCurrentStep] = useState(1);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // Trip state
  const destinationFromQuery = searchParams.get('destination');
  const [destinationSelection, setDestinationSelection] = useState<LocationSelection>(() => ({
    display: destinationFromQuery || plannerState.basics.destination || '',
    cityName: destinationFromQuery || plannerState.basics.destination || '',
    airportCodes: undefined,
  }));
  const [startDate, setStartDate] = useState<Date | undefined>(
    plannerState.basics.startDate ? parseISO(plannerState.basics.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    plannerState.basics.endDate ? parseISO(plannerState.basics.endDate) : undefined
  );
  const [travelers, setTravelers] = useState(plannerState.basics.travelers || 2);
  const [tripType, setTripType] = useState<string>('leisure');
  const [celebrationDay, setCelebrationDay] = useState<number | undefined>(undefined);
  const [budgetAmount, setBudgetAmount] = useState<number | undefined>(plannerState.basics.budgetAmount);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check draft limit
  useEffect(() => {
    if (!canCreateDraft && user) {
      setShowLimitBlocker(true);
    }
  }, [canCreateDraft, user]);

  // Check if user already has Travel DNA
  useEffect(() => {
    const checkExistingDNA = async () => {
      if (!user) return;
      
      try {
        const { data } = await supabase
          .from('user_preferences')
          .select('traveler_type')
          .eq('user_id', user.id)
          .single();
        
        if (data?.traveler_type) {
          // User already has Travel DNA, skip quiz
          setQuizCompleted(true);
          setCurrentStep(2);
        }
      } catch (err) {
        // No existing DNA, start with quiz
      }
    };

    checkExistingDNA();
  }, [user]);

  // Handle quiz completion
  const handleQuizComplete = () => {
    setQuizCompleted(true);
    setCurrentStep(2);
  };

  // Handle quiz skip
  const handleQuizSkip = () => {
    setCurrentStep(2);
  };

  // Handle final submission
  const handleSubmit = async () => {
    if (!destinationSelection.cityName || !startDate || !endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      // Save basics to context
      setBasics({
        destination: destinationSelection.cityName,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        travelers,
        budgetAmount,
      });

      // Check if user needs to authenticate
      if (!user) {
        // Store trip data and redirect to sign up
        navigate(ROUTES.SIGNUP + '?redirect=' + ROUTES.PLANNER.ITINERARY);
        return;
      }

      // Navigate to itinerary generation
      navigate(ROUTES.PLANNER.ITINERARY);
    } catch (err) {
      console.error('Error starting trip:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout showFooter={false}>
      <Head
        title="Plan Your Trip | Voyance"
        description="Start planning your personalized travel itinerary with Voyance."
      />

      {/* Draft limit blocker */}
      {showLimitBlocker && <DraftLimitBlocker />}

      <section className="min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Progress Indicator */}
          <StepIndicator currentStep={currentStep} totalSteps={3} />

          {/* Time estimate */}
          <div className="text-center mb-8">
            <span className="text-sm text-muted-foreground">
              <Clock className="w-4 h-4 inline mr-1" />
              Takes ~2 minutes
            </span>
          </div>

          {/* Main content with sidebar */}
          <div className="flex gap-12">
            {/* Main form area */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {currentStep === 1 && (
                  <motion.div
                    key="quiz"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <EmbeddedQuiz
                      onComplete={handleQuizComplete}
                      onSkip={handleQuizSkip}
                    />
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <TripDetailsStep
                    key="details"
                    destinationSelection={destinationSelection}
                    setDestinationSelection={setDestinationSelection}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    travelers={travelers}
                    setTravelers={setTravelers}
                    tripType={tripType}
                    setTripType={setTripType}
                    celebrationDay={celebrationDay}
                    setCelebrationDay={setCelebrationDay}
                    onContinue={() => setCurrentStep(3)}
                    onBack={() => setCurrentStep(1)}
                  />
                )}

                {currentStep === 3 && (
                  <BudgetStep
                    key="budget"
                    budgetAmount={budgetAmount}
                    setBudgetAmount={setBudgetAmount}
                    onSubmit={handleSubmit}
                    onBack={() => setCurrentStep(2)}
                    isSubmitting={isSubmitting}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Motivation Sidebar */}
            <MotivationSidebar />
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
