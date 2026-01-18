import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Sparkles, Compass, Plane, Hotel, Utensils, Sun, Heart, Clock, Users, MapPin, Wand2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { QuizCompletion } from '@/components/quiz/QuizCompletion';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { 
  submitQuizComplete, 
  createQuizSession, 
  updateQuizSession,
  saveQuizResponse,
  type TravelDNAPayload 
} from '@/utils/quizMapping';

// Comprehensive 10-step quiz based on the detailed quiz documentation
const questions = [
  {
    id: 'traveler_type',
    step: 1,
    category: 'Identity',
    title: 'What kind of traveler are you?',
    subtitle: 'Choose the one that resonates most with how you approach travel',
    icon: <Compass className="w-5 h-5" />,
    options: [
      { value: 'explorer', label: 'Curiosity-Driven', description: 'You seek authentic, off-the-beaten-path adventures and hidden gems' },
      { value: 'escape_artist', label: 'Peace-Seeking', description: 'Travel is about disconnecting, recharging, and finding inner peace' },
      { value: 'curated_luxe', label: 'Refinement-Focused', description: 'You appreciate curated experiences, premium service, and elegant surroundings' },
      { value: 'story_seeker', label: 'Moment-Collecting', description: 'Every trip is about collecting memorable moments and cultural experiences' },
    ],
  },
  {
    id: 'travel_vibes',
    step: 2,
    category: 'Identity',
    title: 'What vibes draw you in?',
    subtitle: 'Select all the atmospheres that excite you',
    icon: <Heart className="w-5 h-5" />,
    multiSelect: true,
    options: [
      { value: 'coastal', label: 'Coastal', description: 'Beach, ocean, and seaside serenity' },
      { value: 'urban', label: 'Urban', description: 'City energy, architecture, and metropolitan buzz' },
      { value: 'mountain', label: 'Mountain', description: 'Alpine views, fresh air, and natural grandeur' },
      { value: 'quiet', label: 'Quiet & Peaceful', description: 'Secluded retreats and tranquil escapes' },
      { value: 'bold', label: 'Bold & Adventurous', description: 'Unique, unexpected, extraordinary experiences' },
      { value: 'spiritual', label: 'Spiritual & Mindful', description: 'Meaningful journeys with cultural depth' },
    ],
  },
  {
    id: 'trip_frequency',
    step: 3,
    category: 'Habits',
    title: 'How often do you travel?',
    subtitle: 'This helps us understand your travel lifestyle',
    icon: <Plane className="w-5 h-5" />,
    options: [
      { value: 'monthly', label: 'Monthly', description: 'Multiple trips per year, travel is a lifestyle' },
      { value: 'quarterly', label: 'Quarterly', description: '3-4 trips per year, regular escapes' },
      { value: 'biannually', label: 'Twice a Year', description: 'Intentional trips, quality over quantity' },
      { value: 'annually', label: 'Once a Year', description: 'One special trip that really counts' },
    ],
  },
  {
    id: 'trip_duration',
    step: 3,
    category: 'Habits',
    title: 'What\'s your ideal trip length?',
    subtitle: 'How long do you like to be away?',
    icon: <Clock className="w-5 h-5" />,
    options: [
      { value: 'weekend', label: 'Weekend Getaway', description: '2-3 days of quick escape' },
      { value: 'short_week', label: 'Short Week', description: '4-5 days, enough to unwind' },
      { value: 'week', label: 'A Full Week', description: '6-8 days to really explore' },
      { value: 'extended', label: 'Extended Journey', description: '10+ days to deeply immerse' },
    ],
  },
  {
    id: 'budget',
    step: 4,
    category: 'Preferences',
    title: 'What\'s your travel budget style?',
    subtitle: 'Per person, per trip — we\'ll match recommendations accordingly',
    icon: <Sparkles className="w-5 h-5" />,
    options: [
      { value: 'budget', label: 'Budget-Conscious', description: 'Maximize experiences without overspending' },
      { value: 'moderate', label: 'Balanced Value', description: 'Quality experiences at reasonable prices' },
      { value: 'premium', label: 'Premium Comfort', description: 'Willing to pay more for better experiences' },
      { value: 'luxury', label: 'Luxury First', description: 'The best of everything, cost is secondary' },
    ],
  },
  {
    id: 'pace',
    step: 5,
    category: 'Style',
    title: 'What\'s your ideal travel pace?',
    subtitle: 'How packed should your days be?',
    icon: <Clock className="w-5 h-5" />,
    options: [
      { value: 'relaxed', label: 'Slow & Intentional', description: '1-2 activities per day, lots of breathing room' },
      { value: 'balanced', label: 'Balanced Rhythm', description: '3-4 activities with breaks in between' },
      { value: 'active', label: 'Active Explorer', description: '5+ activities, maximizing every moment' },
    ],
  },
  {
    id: 'planning_style',
    step: 5,
    category: 'Style',
    title: 'How do you like to plan?',
    subtitle: 'Structure vs spontaneity',
    icon: <MapPin className="w-5 h-5" />,
    options: [
      { value: 'detailed', label: 'Every Detail Planned', description: 'I research extensively and plan it all in advance' },
      { value: 'flexible', label: 'Loose Framework', description: 'Key bookings made, but room for spontaneity' },
      { value: 'spontaneous', label: 'Figure It Out There', description: 'Minimal planning, maximum flexibility' },
    ],
  },
  {
    id: 'travel_companions',
    step: 6,
    category: 'Context',
    title: 'Who do you usually travel with?',
    subtitle: 'Select all that apply to you',
    icon: <Users className="w-5 h-5" />,
    multiSelect: true,
    options: [
      { value: 'solo', label: 'Solo', description: 'I enjoy traveling on my own' },
      { value: 'partner', label: 'Partner', description: 'Romantic getaways for two' },
      { value: 'family', label: 'Family', description: 'Trips with kids or extended family' },
      { value: 'friends', label: 'Friends', description: 'Group adventures with friends' },
    ],
  },
  {
    id: 'interests',
    step: 7,
    category: 'Interests',
    title: 'What experiences excite you most?',
    subtitle: 'Select all that you\'d want in your itinerary',
    icon: <Heart className="w-5 h-5" />,
    multiSelect: true,
    options: [
      { value: 'food', label: 'Food & Culinary', description: 'Local cuisine, restaurants, food tours' },
      { value: 'culture', label: 'Culture & History', description: 'Museums, monuments, heritage sites' },
      { value: 'nature', label: 'Nature & Outdoors', description: 'Parks, hiking, wildlife, scenic views' },
      { value: 'art', label: 'Art & Architecture', description: 'Galleries, design, creative spaces' },
      { value: 'nightlife', label: 'Nightlife & Social', description: 'Bars, clubs, live music venues' },
      { value: 'wellness', label: 'Wellness & Relaxation', description: 'Spas, yoga, mindfulness retreats' },
      { value: 'adventure', label: 'Adventure & Sports', description: 'Active excursions, adrenaline activities' },
      { value: 'shopping', label: 'Shopping & Markets', description: 'Local crafts, boutiques, souvenirs' },
    ],
  },
  {
    id: 'accommodation',
    step: 8,
    category: 'Accommodations',
    title: 'Where do you love to stay?',
    subtitle: 'Your preferred accommodation style',
    icon: <Hotel className="w-5 h-5" />,
    options: [
      { value: 'boutique', label: 'Boutique Hotels', description: 'Unique, design-forward, intimate properties' },
      { value: 'luxury', label: 'Luxury Hotels', description: 'Five-star service, premium amenities' },
      { value: 'chain', label: 'Trusted Brands', description: 'Reliable chains with consistent quality' },
      { value: 'vacation_rental', label: 'Vacation Rentals', description: 'Apartments, homes, local stays' },
      { value: 'resort', label: 'Resorts', description: 'All-inclusive or amenity-rich properties' },
    ],
  },
  {
    id: 'hotel_priorities',
    step: 8,
    category: 'Accommodations',
    title: 'What matters most in a hotel?',
    subtitle: 'Select your top priorities',
    icon: <Hotel className="w-5 h-5" />,
    multiSelect: true,
    options: [
      { value: 'location', label: 'Central Location', description: 'Walking distance to main attractions' },
      { value: 'quiet', label: 'Quiet & Peaceful', description: 'Away from noise and crowds' },
      { value: 'views', label: 'Scenic Views', description: 'Beautiful surroundings and vistas' },
      { value: 'pool', label: 'Pool & Amenities', description: 'Leisure facilities on-site' },
      { value: 'local', label: 'Local Neighborhood', description: 'Authentic, non-touristy area' },
    ],
  },
  {
    id: 'dining_style',
    step: 9,
    category: 'Food',
    title: 'How do you like to dine when traveling?',
    subtitle: 'Your food and dining preferences',
    icon: <Utensils className="w-5 h-5" />,
    options: [
      { value: 'adventurous', label: 'Adventurous Eater', description: 'I\'ll try anything local and authentic' },
      { value: 'balanced', label: 'Balanced Explorer', description: 'Mix of familiar and new cuisines' },
      { value: 'familiar', label: 'Comfort Seeker', description: 'I prefer cuisines I know I\'ll enjoy' },
      { value: 'fine_dining', label: 'Fine Dining Focus', description: 'Michelin stars and memorable meals' },
    ],
  },
  {
    id: 'dietary_restrictions',
    step: 9,
    category: 'Food',
    title: 'Any dietary considerations?',
    subtitle: 'Select all that apply — we\'ll factor these in',
    icon: <Utensils className="w-5 h-5" />,
    multiSelect: true,
    optional: true,
    options: [
      { value: 'vegetarian', label: 'Vegetarian', description: 'No meat, but may include dairy/eggs' },
      { value: 'vegan', label: 'Vegan', description: 'No animal products' },
      { value: 'gluten_free', label: 'Gluten-Free', description: 'No wheat or gluten' },
      { value: 'kosher', label: 'Kosher', description: 'Follows kosher dietary laws' },
      { value: 'halal', label: 'Halal', description: 'Follows halal dietary laws' },
      { value: 'none', label: 'No Restrictions', description: 'I eat everything!' },
    ],
  },
  {
    id: 'weather_preference',
    step: 10,
    category: 'Environment',
    title: 'What climate do you prefer?',
    subtitle: 'We\'ll recommend destinations that match',
    icon: <Sun className="w-5 h-5" />,
    multiSelect: true,
    options: [
      { value: 'tropical', label: 'Warm & Tropical', description: 'Beach weather, sun, and warmth' },
      { value: 'temperate', label: 'Mild & Temperate', description: 'Comfortable year-round temperatures' },
      { value: 'cold', label: 'Cool & Crisp', description: 'Cozy sweater weather' },
      { value: 'variable', label: 'I Adapt', description: 'Weather doesn\'t drive my decisions' },
    ],
  },
  {
    id: 'flight_preferences',
    step: 10,
    category: 'Travel',
    title: 'Flight preferences?',
    subtitle: 'Select what matters to you',
    icon: <Plane className="w-5 h-5" />,
    multiSelect: true,
    optional: true,
    options: [
      { value: 'direct', label: 'Direct Flights Only', description: 'No layovers, even if more expensive' },
      { value: 'window', label: 'Window Seat', description: 'I love looking out the window' },
      { value: 'aisle', label: 'Aisle Seat', description: 'Easy access and legroom' },
      { value: 'morning', label: 'Morning Flights', description: 'Early departures preferred' },
      { value: 'evening', label: 'Evening Flights', description: 'Later departures work better' },
    ],
  },
];

// Group questions by step for display
const getQuestionsForStep = (step: number) => questions.filter(q => q.step === step);
const totalSteps = 10;
const stepCategories = [
  { step: 1, category: 'Identity', label: 'Who You Are' },
  { step: 2, category: 'Identity', label: 'Your Vibes' },
  { step: 3, category: 'Habits', label: 'Travel Habits' },
  { step: 4, category: 'Preferences', label: 'Budget' },
  { step: 5, category: 'Style', label: 'Your Style' },
  { step: 6, category: 'Context', label: 'Companions' },
  { step: 7, category: 'Interests', label: 'Interests' },
  { step: 8, category: 'Accommodations', label: 'Hotels' },
  { step: 9, category: 'Food', label: 'Dining' },
  { step: 10, category: 'Environment', label: 'Logistics' },
];

// Welcome/Intro Screen Component
function QuizIntro({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[80vh] flex items-center justify-center px-4"
    >
      <div className="max-w-2xl mx-auto text-center">
        {/* Animated compass icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
          className="relative mx-auto mb-8"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Wand2 className="w-10 h-10 text-primary" />
            </motion.div>
          </div>
          {/* Floating particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-primary/40"
              style={{
                top: '50%',
                left: '50%',
              }}
              animate={{
                x: [0, Math.cos(i * 60 * Math.PI / 180) * 60],
                y: [0, Math.sin(i * 60 * Math.PI / 180) * 60],
                opacity: [0, 1, 0],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            5 minutes to personalized travel
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
        >
          Discover Your{' '}
          <span className="text-primary italic">Travel DNA</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-lg md:text-xl text-muted-foreground mb-10 max-w-lg mx-auto"
        >
          Answer a few questions about how you love to travel, and we'll craft 
          a unique profile that powers personalized recommendations just for you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="space-y-4"
        >
          <Button
            size="lg"
            onClick={onStart}
            className="gap-3 h-14 px-10 text-lg shadow-xl shadow-primary/25 hover:shadow-primary/35 transition-all"
          >
            Begin Your Journey
            <ArrowRight className="w-5 h-5" />
          </Button>

          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mt-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <span>~5 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <span>10 questions</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Heart className="w-4 h-4" />
              </div>
              <span>Your unique profile</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Enhanced Quiz Option Component
function QuizOptionCard({ 
  value, 
  label, 
  description, 
  isSelected, 
  onSelect,
  index,
  isMultiSelect,
}: { 
  value: string;
  label: string;
  description: string;
  isSelected: boolean;
  onSelect: (value: string) => void;
  index: number;
  isMultiSelect?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(value)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.05,
        type: 'spring',
        stiffness: 400,
        damping: 30
      }}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'relative p-6 rounded-2xl border-2 text-left transition-all w-full group overflow-hidden',
        isSelected
          ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg shadow-primary/10'
          : 'border-border/60 bg-card/50 hover:border-primary/40 hover:bg-card hover:shadow-md'
      )}
    >
      {/* Background gradient on hover */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity',
        !isSelected && 'group-hover:opacity-100'
      )} />
      
      {/* Selection indicator */}
      <motion.div
        initial={false}
        animate={{
          scale: isSelected ? 1 : 0.8,
          opacity: isSelected ? 1 : 0,
        }}
        className="absolute top-4 right-4 z-10"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
          <Check className="w-4 h-4 text-primary-foreground" />
        </div>
      </motion.div>
      
      {/* Unselected indicator */}
      <motion.div
        initial={false}
        animate={{
          scale: isSelected ? 0.8 : 1,
          opacity: isSelected ? 0 : 1,
        }}
        className="absolute top-4 right-4 z-10"
      >
        <div className={cn(
          'w-8 h-8 border-2 transition-colors bg-background/50',
          isMultiSelect ? 'rounded-lg' : 'rounded-full',
          'border-border/60 group-hover:border-primary/40'
        )} />
      </motion.div>
      
      {/* Content */}
      <div className="pr-14 relative z-10">
        <div className={cn(
          'font-semibold text-lg mb-1.5 transition-colors',
          isSelected ? 'text-primary' : 'text-foreground group-hover:text-foreground'
        )}>
          {label}
        </div>
        <div className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </div>
      </div>
    </motion.button>
  );
}

// Progress bar component with enhanced visuals
function QuizProgressBar({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const progress = ((currentStep + 1) / totalSteps) * 100;
  
  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Step indicators for desktop */}
      <div className="hidden lg:flex justify-between mb-4 px-2">
        {stepCategories.map((s, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex flex-col items-center"
          >
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium mb-1.5 transition-all',
              idx === currentStep 
                ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/30' 
                : idx < currentStep 
                  ? 'bg-primary/20 text-primary' 
                  : 'bg-muted text-muted-foreground'
            )}>
              {idx < currentStep ? <Check className="w-4 h-4" /> : idx + 1}
            </div>
            <span className={cn(
              'text-[10px] font-medium transition-colors text-center',
              idx === currentStep ? 'text-primary' : 
              idx < currentStep ? 'text-muted-foreground' : 'text-muted-foreground/50'
            )}>
              {s.label}
            </span>
          </motion.div>
        ))}
      </div>
      
      {/* Progress bar with glow effect */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden shadow-inner">
        <motion.div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        {/* Glow effect */}
        <motion.div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-accent rounded-full blur-sm opacity-50"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      
      {/* Mobile step indicator */}
      <div className="lg:hidden text-center mt-4">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-muted/50">
          <span className="text-sm font-medium text-primary">
            Step {currentStep + 1}
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">
            {totalSteps}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm font-medium text-foreground">
            {stepCategories[currentStep]?.label}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Quiz() {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [travelDNA, setTravelDNA] = useState<TravelDNAPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, setPreferences } = useAuth();
  const navigate = useNavigate();

  const stepQuestions = getQuestionsForStep(currentStep + 1);

  // Initialize quiz session when user is available and quiz starts
  useEffect(() => {
    const initSession = async () => {
      if (user && !sessionId && hasStarted) {
        const newSessionId = await createQuizSession({
          userId: user.id,
          quizVersion: 'v4',
          currentStep: 1,
          totalSteps: totalSteps,
          completionPercentage: 0,
          status: 'in_progress',
          userAgent: navigator.userAgent,
          deviceType: /Mobile|Android|iPhone/.test(navigator.userAgent) ? 'mobile' : 'desktop',
        });
        setSessionId(newSessionId);
      }
    };
    initSession();
  }, [user, sessionId, hasStarted]);

  const handleSelect = async (questionId: string, value: string, isMultiSelect: boolean) => {
    let newAnswers: Record<string, string | string[]>;
    
    if (isMultiSelect) {
      const current = (answers[questionId] as string[]) || [];
      const newValue = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      newAnswers = { ...answers, [questionId]: newValue };
    } else {
      newAnswers = { ...answers, [questionId]: value };
    }
    
    setAnswers(newAnswers);

    // Save response to database in background
    if (user) {
      const question = questions.find(q => q.id === questionId);
      const responseValue = isMultiSelect 
        ? (newAnswers[questionId] as string[])
        : value;
      
      saveQuizResponse(
        user.id,
        sessionId,
        {
          questionId: questionId,
          value: responseValue,
          displayLabel: question?.options.find(o => o.value === value)?.label,
          stepId: `step-${currentStep + 1}`,
          questionPrompt: question?.title || '',
        },
        currentStep + 1
      );
    }
  };

  const isSelected = (questionId: string, value: string) => {
    const answer = answers[questionId];
    if (Array.isArray(answer)) {
      return answer.includes(value);
    }
    return answer === value;
  };

  const canProceed = () => {
    // Check if all required questions for this step have answers
    const requiredQuestions = stepQuestions.filter(q => !q.optional);
    return requiredQuestions.every(q => {
      const answer = answers[q.id];
      if (Array.isArray(answer)) {
        return answer.length > 0;
      }
      return !!answer;
    });
  };

  const handleNext = async () => {
    if (currentStep < totalSteps - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      
      // Update session progress
      if (sessionId) {
        updateQuizSession(sessionId, {
          currentStep: nextStep + 1,
          completionPercentage: Math.round(((nextStep + 1) / totalSteps) * 100),
        });
      }
    } else {
      // Complete quiz
      setIsSubmitting(true);
      try {
        if (user) {
          const result = await submitQuizComplete(user.id, answers, sessionId);
          
          if (result.success) {
            setTravelDNA(result.dna);
          }
        }
        
        // Map to legacy format for backward compatibility
        await setPreferences({
          style: answers.traveler_type as string,
          budget: answers.budget as string,
          pace: answers.pace as string,
          interests: answers.interests as string[],
          accommodation: answers.accommodation as string,
        });
        
        setIsComplete(true);
      } catch (error) {
        console.error('Failed to save preferences:', error);
        setIsComplete(true);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    navigate(ROUTES.PROFILE.VIEW);
  };

  return (
    <MainLayout showFooter={false}>
      <Head
        title="Discover Your Travel DNA | Voyance"
        description="Take our comprehensive quiz to get personalized travel recommendations tailored to your unique preferences."
      />
      
      <div className="min-h-screen flex flex-col relative overflow-hidden">
        {/* Enhanced background with animated elements */}
        <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 -z-10" />
        
        {/* Floating orbs */}
        <motion.div 
          className="fixed top-20 left-[10%] w-72 h-72 bg-primary/15 rounded-full blur-3xl -z-10"
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="fixed top-1/3 right-[5%] w-96 h-96 bg-accent/10 rounded-full blur-3xl -z-10"
          animate={{
            x: [0, -20, 0],
            y: [0, 30, 0],
            scale: [1, 0.9, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="fixed bottom-20 left-1/3 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10"
          animate={{
            x: [0, 40, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Sparkle particles */}
        {hasStarted && !isComplete && (
          <div className="fixed inset-0 pointer-events-none -z-5 overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-primary/40 rounded-full"
                style={{
                  left: `${10 + (i * 7) % 80}%`,
                  top: `${5 + (i * 11) % 90}%`,
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                  y: [0, -30, -60],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 0.4,
                  ease: "easeOut"
                }}
              />
            ))}
          </div>
        )}
        
        <AnimatePresence mode="wait">
          {!hasStarted ? (
            <QuizIntro key="intro" onStart={() => setHasStarted(true)} />
          ) : isComplete ? (
            <motion.div
              key="completion"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="flex-1 pt-28"
            >
              <QuizCompletion onContinue={handleComplete} />
            </motion.div>
          ) : (
            <motion.div
              key="quiz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col pt-32 pb-8"
            >
              {/* Progress */}
              <div className="px-4 mb-10">
                <QuizProgressBar currentStep={currentStep} totalSteps={totalSteps} />
              </div>
              
              {/* Questions for this step with magical transitions */}
              <div className="flex-1 flex items-start justify-center px-4 overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, scale: 0.95, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.02, y: -20 }}
                    transition={{ 
                      type: 'spring',
                      stiffness: 200,
                      damping: 25,
                      mass: 0.8,
                    }}
                    className="max-w-2xl w-full space-y-12 relative"
                  >
                    {/* Step transition sparkle burst */}
                    <motion.div
                      initial={{ opacity: 1, scale: 0 }}
                      animate={{ opacity: 0, scale: 3 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    >
                      <div className="w-20 h-20 bg-primary/20 rounded-full blur-xl" />
                    </motion.div>
                    
                    {stepQuestions.map((question, qIdx) => (
                      <div key={question.id} className={qIdx > 0 ? 'pt-10 border-t border-border/30' : ''}>
                        {/* Question header with staggered reveal */}
                        <motion.div 
                          className="text-center mb-10"
                          initial={{ opacity: 0, y: -20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ 
                            delay: 0.15 + qIdx * 0.1,
                            type: 'spring',
                            stiffness: 300,
                            damping: 25
                          }}
                        >
                          {/* Animated category badge */}
                          <motion.div 
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 text-primary text-xs font-semibold uppercase tracking-wider mb-5 border border-primary/20"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 + qIdx * 0.1, type: 'spring', stiffness: 400 }}
                          >
                            <motion.span
                              animate={{ rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: qIdx * 0.5 }}
                            >
                              {question.icon}
                            </motion.span>
                            {question.category}
                          </motion.div>
                          
                          {/* Title with letter animation feel */}
                          <motion.h1 
                            className="text-2xl md:text-4xl font-serif font-bold text-foreground mb-3 leading-tight"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 + qIdx * 0.1 }}
                          >
                            {question.title}
                          </motion.h1>
                          
                          <motion.p 
                            className="text-muted-foreground text-lg"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.35 + qIdx * 0.1 }}
                          >
                            {question.subtitle}
                            {question.optional && <span className="text-xs ml-2 text-muted-foreground/60">(optional)</span>}
                          </motion.p>
                        </motion.div>
                        
                        {/* Options with cascade reveal */}
                        <motion.div 
                          className={cn(
                            'grid gap-4',
                            question.options.length > 4 ? 'md:grid-cols-2' : ''
                          )}
                          initial="hidden"
                          animate="visible"
                          variants={{
                            hidden: {},
                            visible: {
                              transition: {
                                staggerChildren: 0.06,
                                delayChildren: 0.3 + qIdx * 0.15,
                              }
                            }
                          }}
                        >
                          {question.options.map((option, index) => (
                            <motion.div
                              key={option.value}
                              variants={{
                                hidden: { opacity: 0, y: 20, scale: 0.95 },
                                visible: { 
                                  opacity: 1, 
                                  y: 0, 
                                  scale: 1,
                                  transition: {
                                    type: 'spring',
                                    stiffness: 400,
                                    damping: 30,
                                  }
                                }
                              }}
                            >
                              <QuizOptionCard
                                value={option.value}
                                label={option.label}
                                description={option.description}
                                isSelected={isSelected(question.id, option.value)}
                                onSelect={(val) => handleSelect(question.id, val, !!question.multiSelect)}
                                index={index}
                                isMultiSelect={question.multiSelect}
                              />
                            </motion.div>
                          ))}
                        </motion.div>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
              
              {/* Navigation */}
              <motion.div 
                className="max-w-2xl mx-auto w-full px-4 mt-10 pt-6 border-t border-border/30"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className="gap-2 h-12 px-6 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  
                  <div className="hidden sm:flex items-center gap-2">
                    {[...Array(totalSteps)].map((_, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          'w-2 h-2 rounded-full transition-all',
                          idx === currentStep 
                            ? 'bg-primary w-6' 
                            : idx < currentStep 
                              ? 'bg-primary/40' 
                              : 'bg-muted'
                        )}
                      />
                    ))}
                  </div>
                  
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed() || isSubmitting}
                    className="gap-2 h-12 px-8 shadow-lg shadow-primary/20"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        {currentStep === totalSteps - 1 ? 'Complete' : 'Continue'}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  );
}
