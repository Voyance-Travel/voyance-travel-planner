/**
 * Embedded Quiz Component
 * 
 * A streamlined version of the Travel DNA quiz designed to be embedded
 * within the trip planning flow. Includes the full 21-question quiz with
 * progress tracking and skip options.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, ArrowRight, Check, Compass, 
  Clock, Users, MapPin, Wand2, 
  Mountain, Globe, Star, AlertCircle, MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { 
  submitQuizComplete, 
  createQuizSession, 
  saveQuizResponse,
} from '@/utils/quizMapping';
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
  'Flexibility': <Wand2 className="w-5 h-5" />,
  'Outcomes': <Star className="w-5 h-5" />,
  'Cultural': <Globe className="w-5 h-5" />,
  'Priorities': <Star className="w-5 h-5" />,
  'Values': <Compass className="w-5 h-5" />,
  'Environment': <Mountain className="w-5 h-5" />,
  'Companions': <Users className="w-5 h-5" />,
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

const getQuestionsForStep = (step: number) => {
  const stepConfig = quizConfig.stepCategories[step];
  if (!stepConfig) return [];
  return questions.filter(q => stepConfig.questions.includes(q.id));
};

const stepCategories = quizConfig.stepCategories.map((s, idx) => ({
  step: idx + 1,
  category: s.label,
  label: s.label,
}));

interface EmbeddedQuizProps {
  onComplete: () => void;
  onSkip: () => void;
}

// Quiz Option Card
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
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative p-4 rounded-xl border-2 text-left transition-all w-full group',
        isSelected
          ? 'border-primary bg-primary/5 shadow-md'
          : 'border-border bg-card hover:border-primary/40'
      )}
    >
      <div className="absolute top-3 right-3">
        <div className={cn(
          'w-5 h-5 flex items-center justify-center transition-all',
          isMultiSelect ? 'rounded-md' : 'rounded-full',
          isSelected 
            ? 'bg-primary' 
            : 'border-2 border-border group-hover:border-primary/40'
        )}>
          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
        </div>
      </div>
      
      <div className="pr-8">
        <div className={cn(
          'font-medium text-sm',
          isSelected ? 'text-primary' : 'text-foreground'
        )}>
          {label}
        </div>
      </div>
    </motion.button>
  );
}

// Progress bar
function QuizProgressBar({ currentStep, totalSteps: total }: { currentStep: number; totalSteps: number }) {
  const progress = ((currentStep + 1) / total) * 100;
  
  return (
    <div className="w-full max-w-lg mx-auto mb-8">
      <div className="flex justify-between mb-2 text-xs text-muted-foreground">
        <span>Step {currentStep + 1} of {total}</span>
        <span>{stepCategories[currentStep]?.label}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// Intro screen
function QuizIntro({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center py-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"
      >
        <Compass className="w-10 h-10 text-primary" />
      </motion.div>
      
      <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-3">
        Discover Your Travel DNA
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Answer a few questions and we'll create recommendations that match your unique travel style.
      </p>
      
      <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mb-8">
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-primary" />
          <span>5 minutes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-primary" />
          <span>21 questions</span>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button size="lg" onClick={onStart} className="gap-2">
          <Wand2 className="w-5 h-5" />
          Begin Discovery
        </Button>
        <Button 
          size="lg" 
          variant="outline" 
          onClick={() => window.location.href = ROUTES.ONBOARD_CONVERSATION}
          className="gap-2"
        >
          <MessageCircle className="w-5 h-5" />
          Just Tell Us
        </Button>
      </div>
      
      <AnimatePresence mode="wait">
        {!showSkipWarning ? (
          <motion.button
            key="skip-btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSkipWarning(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-6"
          >
            Skip for now →
          </motion.button>
        ) : (
          <motion.div
            key="skip-warning"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 max-w-sm mx-auto"
          >
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-left">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Skip personalization?</p>
                  <p className="text-xs text-muted-foreground">
                    Your itineraries will be generic and won't reflect your preferences.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setShowSkipWarning(false)} className="text-xs h-8">
                      Take the Quiz
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onSkip} className="text-xs h-8 text-muted-foreground">
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
  );
}

export default function EmbeddedQuiz({ onComplete, onSkip }: EmbeddedQuizProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const stepQuestions = getQuestionsForStep(currentStep);

  // Initialize quiz session
  useEffect(() => {
    const initSession = async () => {
      if (user && !sessionId && hasStarted) {
        const newSessionId = await createQuizSession({
          userId: user.id,
          quizVersion: 'v4-embedded',
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

    // Save response
    if (user && sessionId) {
      const responseOrder = Object.keys(newAnswers).length;
      
      await saveQuizResponse(
        user.id,
        sessionId,
        {
          questionId,
          value: isMultiSelect 
            ? (newAnswers[questionId] as string[])
            : (newAnswers[questionId] as string),
        },
        responseOrder
      );
    }
  };

  const canProceed = useMemo(() => {
    return stepQuestions.every(q => {
      const answer = answers[q.id];
      if (q.multiSelect) {
        return Array.isArray(answer) && answer.length > 0;
      }
      return !!answer;
    });
  }, [stepQuestions, answers]);

  const handleNext = async () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Quiz complete - submit and call onComplete
      setIsSubmitting(true);
      try {
        if (user) {
          await submitQuizComplete(user.id, answers, sessionId);
        }
        
        onComplete();
      } catch (err) {
        console.error('Error submitting quiz:', err);
        onComplete(); // Continue anyway
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      setHasStarted(false);
    }
  };

  if (!hasStarted) {
    return <QuizIntro onStart={() => setHasStarted(true)} onSkip={onSkip} />;
  }

  return (
    <div className="max-w-lg mx-auto">
      <QuizProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          {stepQuestions.map((question) => (
            <div key={question.id} className="space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary mb-3">
                  {question.icon}
                </div>
                <h3 className="text-lg font-medium text-foreground mb-1">
                  {question.title}
                </h3>
                <p className="text-sm text-muted-foreground">{question.subtitle}</p>
              </div>
              
              <div className="space-y-2">
                {question.options.map((option, idx) => (
                  <QuizOptionCard
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    isSelected={
                      question.multiSelect
                        ? ((answers[question.id] as string[]) || []).includes(option.value)
                        : answers[question.id] === option.value
                    }
                    onSelect={(val) => handleSelect(question.id, val, question.multiSelect || false)}
                    index={idx}
                    isMultiSelect={question.multiSelect}
                  />
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
      
      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={handleBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button 
          onClick={handleNext} 
          disabled={!canProceed || isSubmitting}
          className="gap-2"
        >
          {currentStep === totalSteps - 1 ? 'Finish' : 'Next'}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
