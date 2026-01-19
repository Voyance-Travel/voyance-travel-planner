import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, ArrowRight, Check, Sparkles, Compass, Plane, Hotel, Utensils, 
  Sun, Heart, Clock, Users, MapPin, Wand2, DollarSign, Briefcase, Glasses,
  UserCircle2, Palette, Mountain, Coffee, Luggage, Globe, Star, AlertCircle
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { QuizCompletion } from '@/components/quiz/QuizCompletion';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { scrollToTop } from '@/utils/scrollUtils';
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
    category: 'Vibes',
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
    category: 'Budget',
    title: 'What\'s your travel budget style?',
    subtitle: 'Per person, per trip. We\'ll match recommendations accordingly',
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
    category: 'Companions',
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
    category: 'Hotels',
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
    category: 'Hotels',
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
    category: 'Dining',
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
    category: 'Dining',
    title: 'Any dietary considerations?',
    subtitle: 'Select all that apply. We\'ll factor these in',
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
    hasTextInput: true,
    textInputId: 'food_allergies',
    textInputLabel: 'Any food allergies or other dietary needs?',
    textInputPlaceholder: 'e.g., nut allergy, shellfish, lactose intolerant...',
  },
  {
    id: 'weather_preference',
    step: 10,
    category: 'Logistics',
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
    category: 'Logistics',
    title: 'Flight preferences?',
    subtitle: 'Do you prefer direct flights?',
    icon: <Plane className="w-5 h-5" />,
    optional: true,
    options: [
      { value: 'direct', label: 'Direct Flights Only', description: 'No layovers, even if more expensive' },
      { value: 'flexible', label: 'Flexible on Connections', description: 'Open to layovers if it saves money or time' },
    ],
  },
];

// Group questions by step for display
const getQuestionsForStep = (step: number) => questions.filter(q => q.step === step);
const totalSteps = 10;
const stepCategories = [
  { step: 1, category: 'Identity', label: 'Who You Are' },
  { step: 2, category: 'Vibes', label: 'Your Vibes' },
  { step: 3, category: 'Habits', label: 'Travel Habits' },
  { step: 4, category: 'Budget', label: 'Budget' },
  { step: 5, category: 'Style', label: 'Your Style' },
  { step: 6, category: 'Companions', label: 'Companions' },
  { step: 7, category: 'Interests', label: 'Interests' },
  { step: 8, category: 'Hotels', label: 'Hotels' },
  { step: 9, category: 'Dining', label: 'Dining' },
  { step: 10, category: 'Logistics', label: 'Logistics' },
];

// Floating decorative motifs for visual interest
const FloatingMotif = ({ icon, delay, x, y }: { icon: React.ReactNode; delay: number; x: string; y: string }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0 }}
    animate={{ 
      opacity: [0, 0.15, 0.15, 0],
      scale: [0.8, 1, 1, 0.8],
      y: [0, -15, -15, 0]
    }}
    transition={{ 
      duration: 8, 
      delay, 
      repeat: Infinity,
      ease: "easeInOut"
    }}
    className="absolute text-primary/20 pointer-events-none"
    style={{ left: x, top: y }}
  >
    {icon}
  </motion.div>
);

// Welcome/Intro Screen Component
function QuizIntro({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[80vh] flex items-center justify-center px-4 relative overflow-hidden"
    >
      {/* Floating decorative elements */}
      <FloatingMotif icon={<Plane className="w-8 h-8" />} delay={0} x="15%" y="20%" />
      <FloatingMotif icon={<Globe className="w-10 h-10" />} delay={1.5} x="80%" y="25%" />
      <FloatingMotif icon={<Mountain className="w-9 h-9" />} delay={3} x="10%" y="70%" />
      <FloatingMotif icon={<Coffee className="w-7 h-7" />} delay={4.5} x="85%" y="65%" />
      <FloatingMotif icon={<Luggage className="w-8 h-8" />} delay={2} x="75%" y="80%" />
      <FloatingMotif icon={<Star className="w-6 h-6" />} delay={3.5} x="20%" y="45%" />
      
      <div className="max-w-2xl mx-auto text-center relative z-10">
        {/* Animated compass icon with subtle glow */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
          className="relative mx-auto mb-8"
        >
          <motion.div
            animate={{ 
              boxShadow: [
                '0 0 0 0 hsl(var(--primary) / 0.2)',
                '0 0 30px 10px hsl(var(--primary) / 0.1)',
                '0 0 0 0 hsl(var(--primary) / 0.2)'
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: [0, 10, 0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Compass className="w-14 h-14 text-primary" />
            </motion.div>
          </motion.div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            Discover Your Travel DNA
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto leading-relaxed">
            Answer a few questions and we'll create personalized recommendations that match your unique travel style.
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mb-8">
            <motion.div 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
            >
              <Clock className="w-4 h-4 text-primary" />
              <span>5 minutes</span>
            </motion.div>
            <motion.div 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
            >
              <Star className="w-4 h-4 text-primary" />
              <span>10 questions</span>
            </motion.div>
          </div>
          
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              size="lg"
              onClick={onStart}
              className="h-14 px-10 text-lg shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
            >
              <Wand2 className="w-5 h-5 mr-2" />
              Begin Discovery
            </Button>
          </motion.div>
          
          {/* Skip Option */}
          <AnimatePresence mode="wait">
            {!showSkipWarning ? (
              <motion.button
                key="skip-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSkipWarning(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
              >
                Skip for now →
              </motion.button>
            ) : (
              <motion.div
                key="skip-warning"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 max-w-md mx-auto"
              >
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-left">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Skip personalization?
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Without completing the quiz, your itineraries will be generic and won't reflect your unique travel preferences, dietary needs, or activity style.
                      </p>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowSkipWarning(false)}
                          className="text-xs h-8"
                        >
                          Take the Quiz
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onSkip}
                          className="text-xs h-8 text-muted-foreground hover:text-foreground"
                        >
                          Skip Anyway
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Quiz Option Card
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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative p-5 rounded-xl border-2 text-left transition-all w-full group overflow-hidden',
        isSelected
          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
          : 'border-border bg-card hover:border-primary/40 hover:shadow-md'
      )}
    >
      {/* Subtle gradient overlay on selection */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"
        />
      )}
      
      {/* Selection indicator with animation */}
      <div className="absolute top-4 right-4">
        <motion.div 
          animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 0.3 }}
          className={cn(
            'w-6 h-6 flex items-center justify-center transition-all',
            isMultiSelect ? 'rounded-md' : 'rounded-full',
            isSelected 
              ? 'bg-primary shadow-md shadow-primary/30' 
              : 'border-2 border-border group-hover:border-primary/40'
          )}
        >
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Check className="w-4 h-4 text-primary-foreground" />
            </motion.div>
          )}
        </motion.div>
      </div>
      
      <div className="pr-10 relative z-10">
        <div className={cn(
          'font-semibold mb-1 transition-colors',
          isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary/80'
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

// Progress bar component
function QuizProgressBar({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const progress = ((currentStep + 1) / totalSteps) * 100;
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Step indicators */}
      <div className="hidden md:flex justify-between mb-3 px-1">
        {stepCategories.map((s, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium mb-1 transition-all',
              idx === currentStep 
                ? 'bg-primary text-primary-foreground' 
                : idx < currentStep 
                  ? 'bg-primary/20 text-primary' 
                  : 'bg-muted text-muted-foreground'
            )}>
              {idx < currentStep ? <Check className="w-3.5 h-3.5" /> : idx + 1}
            </div>
            <span className={cn(
              'text-[10px] font-medium transition-colors text-center',
              idx === currentStep ? 'text-primary' : 'text-muted-foreground/60'
            )}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
      
      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      
      {/* Mobile step indicator */}
      <div className="md:hidden text-center mt-3">
        <span className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {totalSteps} · {stepCategories[currentStep]?.label}
        </span>
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

    // Save response to database - properly await and handle errors
    if (user) {
      const question = questions.find(q => q.id === questionId);
      const responseValue = isMultiSelect 
        ? (newAnswers[questionId] as string[])
        : value;
      
      try {
        const success = await saveQuizResponse(
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
        
        if (!success) {
          console.warn('[Quiz] Failed to save response for:', questionId);
        }
      } catch (error) {
        console.error('[Quiz] Error saving response:', error);
      }
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
      
      // Scroll to top when navigating to next step
      scrollToTop();
      
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
      // Scroll to top when navigating back
      scrollToTop();
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
      
      <div className="min-h-screen flex flex-col">
        {/* Animated background gradient */}
        <motion.div 
          className="fixed inset-0 -z-10"
          animate={{
            background: [
              'linear-gradient(135deg, hsl(var(--primary) / 0.03) 0%, hsl(var(--background)) 50%, hsl(var(--accent) / 0.03) 100%)',
              'linear-gradient(135deg, hsl(var(--accent) / 0.03) 0%, hsl(var(--background)) 50%, hsl(var(--primary) / 0.03) 100%)',
              'linear-gradient(135deg, hsl(var(--primary) / 0.03) 0%, hsl(var(--background)) 50%, hsl(var(--accent) / 0.03) 100%)',
            ]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <AnimatePresence mode="wait">
          {!hasStarted ? (
            <QuizIntro key="intro" onStart={() => setHasStarted(true)} onSkip={() => navigate(ROUTES.START)} />
          ) : isComplete ? (
            <motion.div
              key="completion"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
              className="flex-1 flex flex-col pt-28 pb-8"
            >
              {/* Progress */}
              <div className="px-4 mb-8">
                <QuizProgressBar currentStep={currentStep} totalSteps={totalSteps} />
              </div>
              
              {/* Questions */}
              <div className="flex-1 flex items-start justify-center px-4 overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="max-w-2xl w-full space-y-10"
                  >
                    {stepQuestions.map((question, qIdx) => (
                      <div key={question.id} className={qIdx > 0 ? 'pt-8 border-t border-border' : ''}>
                        {/* Question header with subtle animation */}
                        <motion.div 
                          className="text-center mb-8"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                        >
                          <motion.div 
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4"
                            whileHover={{ scale: 1.05 }}
                          >
                            <motion.span
                              animate={{ rotate: [0, 5, 0, -5, 0] }}
                              transition={{ duration: 4, repeat: Infinity }}
                            >
                              {question.icon}
                            </motion.span>
                            {question.category}
                          </motion.div>
                          
                          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">
                            {question.title}
                          </h1>
                          
                          <p className="text-muted-foreground leading-relaxed">
                            {question.subtitle}
                            {question.optional && <span className="text-xs ml-2 opacity-60">(optional)</span>}
                          </p>
                        </motion.div>
                        
                        {/* Options */}
                        <div className={cn(
                          'grid gap-3',
                          question.options.length > 4 ? 'md:grid-cols-2' : ''
                        )}>
                          {question.options.map((option, index) => (
                            <QuizOptionCard
                              key={option.value}
                              value={option.value}
                              label={option.label}
                              description={option.description}
                              isSelected={isSelected(question.id, option.value)}
                              onSelect={(val) => handleSelect(question.id, val, !!question.multiSelect)}
                              index={index}
                              isMultiSelect={question.multiSelect}
                            />
                          ))}
                        </div>
                        
                        {/* Text input for allergies/custom input */}
                        {question.hasTextInput && question.textInputId && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="mt-6 pt-6 border-t border-border"
                          >
                            <label 
                              htmlFor={question.textInputId}
                              className="block text-sm font-medium text-foreground mb-2"
                            >
                              {question.textInputLabel}
                            </label>
                            <textarea
                              id={question.textInputId}
                              value={(answers[question.textInputId] as string) || ''}
                              onChange={(e) => handleSelect(question.textInputId!, e.target.value, false)}
                              placeholder={question.textInputPlaceholder}
                              rows={2}
                              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                            />
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
              
              {/* Navigation */}
              <div className="max-w-2xl mx-auto w-full px-4 mt-8 pt-6 border-t border-border">
                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className="gap-2 h-11"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  
                  <div className="hidden sm:flex items-center gap-1.5">
                    {[...Array(totalSteps)].map((_, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          'w-1.5 h-1.5 rounded-full transition-all',
                          idx === currentStep 
                            ? 'bg-primary w-4' 
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
                    className="gap-2 h-11 px-6"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      <>
                        {currentStep === totalSteps - 1 ? 'Complete' : 'Continue'}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  );
}
