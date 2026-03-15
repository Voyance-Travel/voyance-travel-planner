import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumeReturnPath, saveReturnPath } from '@/utils/authReturnPath';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, ArrowRight, Check, Compass, Plane,
  Clock, Users, MapPin, Wand2, ClipboardList, 
  Mountain, Coffee, Luggage, Globe, Star, AlertCircle, MessageCircle, Gift
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { QuizCompletion } from '@/components/quiz/QuizCompletion';
import QuizFeedbackV3 from '@/components/quiz/QuizFeedbackV3';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { useBonusCredits, BONUS_INFO } from '@/hooks/useBonusCredits';
import { 
  submitQuizComplete, 
  createQuizSession, 
  updateQuizSession,
  saveQuizResponse,
  type TravelDNAPayload 
} from '@/utils/quizMapping';
import { determineArchetype } from '@/services/engines/travelDNA/archetype-matcher';
import quizConfig from '@/config/quiz-questions-v3.json';

// Transform JSON config into component-ready format
interface QuizQuestion {
  id: string;
  step: number;
  category: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  options: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  multiSelect?: boolean;
  optional?: boolean;
  hasTextInput?: boolean;
  textInputId?: string;
  textInputLabel?: string;
  textInputPlaceholder?: string;
  feedback?: Record<string, string>;
}

// Map categories to icons
const categoryIcons: Record<string, React.ReactNode> = {
  'Pace': <Clock className="w-5 h-5" />,
  'Motivation': <Compass className="w-5 h-5" />,
  'Budget': <Star className="w-5 h-5" />,
  'Style': <MapPin className="w-5 h-5" />,
  'Social': <Users className="w-5 h-5" />,
  'Interests': <Globe className="w-5 h-5" />,
  'Accommodation': <MapPin className="w-5 h-5" />,
  'Flexibility': <Wand2 className="w-5 h-5" />,
  'Outcomes': <Star className="w-5 h-5" />,
  'Cultural': <Globe className="w-5 h-5" />,
  'Priorities': <Star className="w-5 h-5" />,
  'Values': <Compass className="w-5 h-5" />,
  'Environment': <Mountain className="w-5 h-5" />,
  'Companions': <Users className="w-5 h-5" />,
  'Wellbeing': <Coffee className="w-5 h-5" />,
  'Life Stage': <Users className="w-5 h-5" />,
  'Quality': <Star className="w-5 h-5" />,
};

// Transform questions from JSON config
function transformQuestions(): QuizQuestion[] {
  return quizConfig.questions.map(q => ({
    id: q.id,
    step: q.step,
    category: q.category,
    title: q.prompt,
    subtitle: q.type === 'multi' ? 'Select all that apply' : 'Choose the one that fits best',
    icon: categoryIcons[q.category] || <Compass className="w-5 h-5" />,
    multiSelect: q.type === 'multi',
    feedback: q.feedback,
    options: q.answers.map(a => ({
      value: a.id,
      label: a.label,
    })),
  }));
}

const questions = transformQuestions();
const totalSteps = quizConfig.stepCategories.length;

// Get questions for a specific step
const getQuestionsForStep = (step: number) => {
  const stepConfig = quizConfig.stepCategories[step];
  if (!stepConfig) return [];
  return questions.filter(q => stepConfig.questions.includes(q.id));
};

// Step categories from config
const stepCategories = quizConfig.stepCategories.map((s, idx) => ({
  step: idx + 1,
  category: s.label,
  label: s.label,
}));

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
  const { hasClaimedBonus } = useBonusCredits();
  const canEarnBonus = !hasClaimedBonus('quiz_completion');
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[80vh] flex items-center justify-center px-4 relative overflow-hidden"
    >
      {/* Floating decorative elements — hidden on mobile to avoid overlap */}
      <div className="hidden sm:block">
        <FloatingMotif icon={<Plane className="w-8 h-8" />} delay={0} x="15%" y="20%" />
        <FloatingMotif icon={<Globe className="w-10 h-10" />} delay={1.5} x="80%" y="25%" />
        <FloatingMotif icon={<Mountain className="w-9 h-9" />} delay={3} x="10%" y="70%" />
        <FloatingMotif icon={<Coffee className="w-7 h-7" />} delay={4.5} x="85%" y="65%" />
        <FloatingMotif icon={<Luggage className="w-8 h-8" />} delay={2} x="75%" y="80%" />
        <FloatingMotif icon={<Star className="w-6 h-6" />} delay={3.5} x="20%" y="45%" />
      </div>
      
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
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            Tell us your story
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto leading-relaxed">
            This isn't a "beach or mountains" quiz. We want to know how you actually enjoy travel, and we'll remember what you like!
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          {/* Credit earning nudge */}
          {canEarnBonus && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6"
            >
              <Gift className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">
                Earn +{BONUS_INFO.quiz_completion.credits} credits for completing!
              </span>
            </motion.div>
          )}
          
          <div className="flex flex-col items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                size="lg"
                onClick={onStart}
                className="h-14 px-10 text-lg shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
              >
                <ClipboardList className="w-5 h-5 mr-2" />
                Start Quiz
              </Button>
            </motion.div>


            <div className="flex items-center gap-3 text-muted-foreground text-sm">
              <span>or</span>
              <Button
                variant="link"
                onClick={() => window.location.href = ROUTES.ONBOARD_CONVERSATION}
                className="text-sm px-0 h-auto font-medium"
              >
                <MessageCircle className="w-4 h-4 mr-1.5" />
                Just Tell Us Your Story
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mt-4">
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
              <span>We remember forever</span>
            </motion.div>
          </div>
          
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

// Quiz Option Card - Compact version for faster pace
function QuizOptionCard({ 
  value, 
  label, 
  isSelected, 
  onSelect,
  index,
  isMultiSelect,
}: { 
  value: string;
  label: string;
  description?: string;
  isSelected: boolean;
  onSelect: (value: string) => void;
  index: number;
  isMultiSelect?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(value)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative px-4 py-3 rounded-lg border text-left transition-all w-full group',
        isSelected
          ? 'border-primary bg-primary/10'
          : 'border-border bg-card hover:border-primary/50'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Compact selection indicator */}
        <div className={cn(
          'w-5 h-5 flex items-center justify-center shrink-0 transition-all',
          isMultiSelect ? 'rounded' : 'rounded-full',
          isSelected 
            ? 'bg-primary' 
            : 'border-2 border-muted-foreground/30'
        )}>
          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
        </div>
        
        <span className={cn(
          'text-sm font-medium transition-colors',
          isSelected ? 'text-primary' : 'text-foreground'
        )}>
          {label}
        </span>
      </div>
    </motion.button>
  );
}

// Sticky progress bar with percentage
function QuizProgressBar({ currentStep, totalSteps, questionIndex, questionsInStep }: { 
  currentStep: number; 
  totalSteps: number;
  questionIndex?: number;
  questionsInStep?: number;
}) {
  // Calculate overall progress including question within step
  const baseProgress = (currentStep / totalSteps) * 100;
  const stepProgress = questionsInStep && questionIndex !== undefined 
    ? ((questionIndex + 1) / questionsInStep) * (100 / totalSteps)
    : 0;
  const progress = Math.min(baseProgress + stepProgress, 100);
  
  return (
    <div className="w-full">
      {/* Compact progress indicator */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums min-w-[3rem] text-right">
          {Math.round(progress)}%
        </span>
      </div>
      
      {/* Step dots - minimal */}
      <div className="flex items-center justify-center gap-1.5">
        {[...Array(totalSteps)].map((_, idx) => (
          <div 
            key={idx}
            className={cn(
              'h-1.5 rounded-full transition-all duration-200',
              idx === currentStep 
                ? 'bg-primary w-6' 
                : idx < currentStep 
                  ? 'bg-primary/50 w-1.5' 
                  : 'bg-muted w-1.5'
            )}
          />
        ))}
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
  const [showAuthGate, setShowAuthGate] = useState(false);
  const { user, setPreferences } = useAuth();
  const navigate = useNavigate();

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const stepQuestions = getQuestionsForStep(currentStep);

  // Initialize quiz session when user is authenticated and quiz starts
  useEffect(() => {
    const initSession = async () => {
      // Guard: require user.id to be present before creating session
      if (user?.id && !sessionId && hasStarted) {
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
  }, [user?.id, sessionId, hasStarted]); // Use user?.id for stable dependency

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

    // Auto-scroll to next question after single-select answer
    if (!isMultiSelect) {
      const currentIndex = stepQuestions.findIndex(q => q.id === questionId);
      if (currentIndex >= 0 && currentIndex < stepQuestions.length - 1) {
        const nextQuestion = stepQuestions[currentIndex + 1];
        setTimeout(() => {
          questionRefs.current[nextQuestion.id]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 350); // Wait for feedback animation
      }
    }

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
      
      // Scroll to top immediately when navigating to next step
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      // Also reset any scrollable container
      const container = document.querySelector('.quiz-scroll-container');
      if (container) container.scrollTop = 0;

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
      // Scroll to top immediately when navigating back
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      const container = document.querySelector('.quiz-scroll-container');
      if (container) container.scrollTop = 0;
    }
  };

  const handleComplete = () => {
    // Check for post-quiz redirect (e.g., guest returning to shared trip)
    const postQuizRedirect = sessionStorage.getItem('postQuizRedirect');
    if (postQuizRedirect) {
      sessionStorage.removeItem('postQuizRedirect');
      navigate(postQuizRedirect);
      return;
    }
    navigate(consumeReturnPath(ROUTES.PROFILE.VIEW));
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
          <QuizIntro key="intro" onStart={() => {
              if (!user) {
                saveReturnPath('/quiz');
                setShowAuthGate(true);
                return;
              }
              setHasStarted(true);
            }} onSkip={() => navigate(ROUTES.START)} />
          ) : isComplete ? (
            <motion.div
              key="completion"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 pt-28"
            >
              <QuizCompletion onContinue={handleComplete} dnaResult={travelDNA} />
            </motion.div>
          ) : (
            <motion.div
              key="quiz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col pt-20 pb-4"
            >
              {/* Sticky Progress */}
              <div className="sticky top-14 sm:top-16 z-20 bg-background/95 backdrop-blur-sm px-4 py-2 sm:py-3 border-b border-border/50">
                <div className="max-w-xl mx-auto">
                  <QuizProgressBar 
                    currentStep={currentStep} 
                    totalSteps={totalSteps}
                    questionIndex={0}
                    questionsInStep={stepQuestions.length}
                  />
                </div>
              </div>
              
              {/* Questions - Compact layout */}
              <div className="quiz-scroll-container flex-1 px-4 py-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="max-w-xl mx-auto space-y-6"
                  >
                    {stepQuestions.map((question, qIdx) => (
                      <div
                        key={question.id}
                        ref={(el) => { questionRefs.current[question.id] = el; }}
                        className={cn('scroll-mt-28', qIdx > 0 ? 'pt-4 border-t border-border/50' : '')}
                      >
                        {/* Compact question header */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 text-xs text-primary font-medium uppercase tracking-wide mb-2">
                            {question.icon}
                            <span>{question.category}</span>
                            {question.optional && <span className="text-muted-foreground font-normal">(optional)</span>}
                          </div>
                          
                          <h2 className="text-lg md:text-xl font-semibold text-foreground leading-snug">
                            {question.title}
                          </h2>
                          
                          {question.multiSelect && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Select all that apply
                            </p>
                          )}
                        </div>
                        
                        {/* Compact options grid */}
                        <div className="grid gap-2">
                          {question.options.map((option, index) => (
                            <QuizOptionCard
                              key={option.value}
                              value={option.value}
                              label={option.label}
                              isSelected={isSelected(question.id, option.value)}
                              onSelect={(val) => handleSelect(question.id, val, !!question.multiSelect)}
                              index={index}
                              isMultiSelect={question.multiSelect}
                            />
                          ))}
                        </div>
                        
                        {/* Inline feedback - minimal */}
                        {answers[question.id] && !question.multiSelect && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-2 overflow-hidden"
                          >
                            <QuizFeedbackV3
                              questionId={question.id}
                              answerValue={answers[question.id] as string}
                              show={true}
                            />
                          </motion.div>
                        )}
                        {/* Text input for allergies/custom input */}
                        {question.hasTextInput && question.textInputId && (
                          <div className="mt-3">
                            <label 
                              htmlFor={question.textInputId}
                              className="block text-xs font-medium text-foreground mb-1"
                            >
                              {question.textInputLabel}
                            </label>
                            <textarea
                              id={question.textInputId}
                              value={(answers[question.textInputId] as string) || ''}
                              onChange={(e) => handleSelect(question.textInputId!, e.target.value, false)}
                              placeholder={question.textInputPlaceholder}
                              rows={2}
                              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-none"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
              
              {/* Compact Navigation */}
              <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="max-w-xl mx-auto flex justify-between items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className="gap-1.5 h-9"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  
                  <span className="text-xs text-muted-foreground">
                    {currentStep + 1} of {totalSteps}
                  </span>
                  
                  <Button
                    size="sm"
                    onClick={handleNext}
                    disabled={!canProceed() || isSubmitting}
                    className="gap-1.5 h-9 px-4"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin rounded-full h-3 w-3 border-2 border-primary-foreground border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      <>
                        {currentStep === totalSteps - 1 ? 'Complete' : 'Next'}
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

      {/* Auth Gate Dialog */}
      <Dialog open={showAuthGate} onOpenChange={setShowAuthGate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              Sign up to discover your Travel DNA
            </DialogTitle>
            <DialogDescription>
              Create a free account so we can save your results. It takes two seconds, just your name and email, no credit card.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={() => navigate(ROUTES.SIGNUP + '?redirect=' + encodeURIComponent('/quiz'))}
              className="w-full gap-2"
            >
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(ROUTES.SIGNIN + '?redirect=' + encodeURIComponent('/quiz'))}
              className="w-full"
            >
              I already have an account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
