import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Sparkles, Compass, Plane, Hotel, Utensils, Sun, Heart, Clock, Users, MapPin } from 'lucide-react';
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
      { value: 'explorer', label: 'The Explorer', description: 'You seek authentic, off-the-beaten-path adventures and hidden gems' },
      { value: 'escape_artist', label: 'The Escape Artist', description: 'Travel is about disconnecting, recharging, and finding inner peace' },
      { value: 'curated_luxe', label: 'Curated Luxe', description: 'You appreciate refined experiences, premium service, and elegant surroundings' },
      { value: 'story_seeker', label: 'The Story Seeker', description: 'Every trip is about collecting memorable moments and cultural experiences' },
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
        'relative p-5 rounded-xl border-2 text-left transition-all w-full group',
        'hover:shadow-lg hover:shadow-primary/5',
        isSelected
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
          : 'border-border bg-card hover:border-primary/40'
      )}
    >
      {/* Selection indicator */}
      <motion.div
        initial={false}
        animate={{
          scale: isSelected ? 1 : 0.8,
          opacity: isSelected ? 1 : 0,
        }}
        className="absolute top-4 right-4"
      >
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
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
        className="absolute top-4 right-4"
      >
        <div className={cn(
          'w-7 h-7 rounded-full border-2 transition-colors',
          isMultiSelect ? 'rounded-md' : 'rounded-full',
          'border-border group-hover:border-primary/50'
        )} />
      </motion.div>
      
      {/* Content */}
      <div className="pr-12">
        <div className={cn(
          'font-medium text-lg mb-1 transition-colors',
          isSelected ? 'text-primary' : 'text-foreground'
        )}>
          {label}
        </div>
        <div className="text-sm text-muted-foreground">
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
      {/* Step indicators for desktop */}
      <div className="hidden md:flex justify-between mb-3">
        {stepCategories.map((s, idx) => (
          <div 
            key={idx}
            className={cn(
              'text-xs font-medium transition-colors',
              idx === currentStep ? 'text-primary' : 
              idx < currentStep ? 'text-muted-foreground' : 'text-muted-foreground/50'
            )}
          >
            {s.label}
          </div>
        ))}
      </div>
      
      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      
      {/* Mobile step indicator */}
      <div className="md:hidden text-center mt-3">
        <span className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <span className="mx-2 text-muted-foreground">·</span>
        <span className="text-sm font-medium text-foreground">
          {stepCategories[currentStep]?.label}
        </span>
      </div>
    </div>
  );
}

export default function Quiz() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [travelDNA, setTravelDNA] = useState<TravelDNAPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, setPreferences } = useAuth();
  const navigate = useNavigate();

  const stepQuestions = getQuestionsForStep(currentStep + 1);

  // Initialize quiz session when user is available
  useEffect(() => {
    const initSession = async () => {
      if (user && !sessionId) {
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
  }, [user, sessionId]);

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
      
      <div className="min-h-screen pt-20 pb-8 flex flex-col bg-gradient-to-b from-background via-background to-muted/30">
        <AnimatePresence mode="wait">
          {isComplete ? (
            <motion.div
              key="completion"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <QuizCompletion onContinue={handleComplete} />
            </motion.div>
          ) : (
            <motion.div
              key="quiz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              {/* Progress */}
              <div className="px-4 mb-8">
                <QuizProgressBar currentStep={currentStep} totalSteps={totalSteps} />
              </div>
              
              {/* Questions for this step */}
              <div className="flex-1 flex items-start justify-center px-4 overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ 
                      type: 'spring',
                      stiffness: 300,
                      damping: 30
                    }}
                    className="max-w-2xl w-full space-y-12"
                  >
                    {stepQuestions.map((question, qIdx) => (
                      <div key={question.id} className={qIdx > 0 ? 'pt-8 border-t border-border/50' : ''}>
                        {/* Question header */}
                        <motion.div 
                          className="text-center mb-8"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + qIdx * 0.1 }}
                        >
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium uppercase tracking-wider mb-4">
                            {question.icon}
                            {question.category}
                          </div>
                          <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">
                            {question.title}
                          </h1>
                          <p className="text-muted-foreground">
                            {question.subtitle}
                            {question.optional && <span className="text-xs ml-2">(optional)</span>}
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
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
              
              {/* Navigation */}
              <motion.div 
                className="max-w-2xl mx-auto w-full px-4 mt-8 pt-6 border-t border-border/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className="gap-2 h-12 px-6"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  
                  <div className="text-sm text-muted-foreground">
                    {currentStep + 1} / {totalSteps}
                  </div>
                  
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed() || isSubmitting}
                    className="gap-2 h-12 px-8"
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
