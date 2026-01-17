import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { QuizProgress } from '@/components/quiz/QuizProgress';
import { QuizOption } from '@/components/quiz/QuizOption';
import { QuizCompletion } from '@/components/quiz/QuizCompletion';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';

const questions = [
  {
    id: 'style',
    title: 'What\'s your travel style?',
    subtitle: 'Choose the option that best describes you',
    shortTitle: 'Style',
    options: [
      { value: 'luxury', label: 'Luxury', description: 'Five-star hotels, fine dining, first-class everything' },
      { value: 'adventure', label: 'Adventure', description: 'Off the beaten path, unique experiences' },
      { value: 'cultural', label: 'Cultural', description: 'Museums, history, local traditions' },
      { value: 'relaxation', label: 'Relaxation', description: 'Beach resorts, spas, taking it easy' },
    ],
  },
  {
    id: 'budget',
    title: 'What\'s your typical travel budget?',
    subtitle: 'Per person, per trip',
    shortTitle: 'Budget',
    options: [
      { value: 'budget', label: 'Budget', description: 'Under $1,000' },
      { value: 'moderate', label: 'Moderate', description: '$1,000 - $3,000' },
      { value: 'premium', label: 'Premium', description: '$3,000 - $7,000' },
      { value: 'luxury', label: 'Luxury', description: '$7,000+' },
    ],
  },
  {
    id: 'pace',
    title: 'What pace do you prefer?',
    subtitle: 'How packed should your days be?',
    shortTitle: 'Pace',
    options: [
      { value: 'slow', label: 'Slow & Easy', description: '1-2 activities per day, lots of free time' },
      { value: 'moderate', label: 'Balanced', description: 'Mix of planned activities and downtime' },
      { value: 'fast', label: 'Action-Packed', description: 'See and do as much as possible' },
    ],
  },
  {
    id: 'interests',
    title: 'What interests you most?',
    subtitle: 'Select all that apply',
    shortTitle: 'Interests',
    multiSelect: true,
    options: [
      { value: 'food', label: 'Food & Wine', description: 'Local cuisine, fine dining, food tours' },
      { value: 'nature', label: 'Nature', description: 'Hiking, wildlife, scenic views' },
      { value: 'art', label: 'Art & Architecture', description: 'Museums, galleries, historic buildings' },
      { value: 'nightlife', label: 'Nightlife', description: 'Bars, clubs, live music' },
      { value: 'shopping', label: 'Shopping', description: 'Local markets, boutiques, souvenirs' },
      { value: 'wellness', label: 'Wellness', description: 'Spas, yoga, mindfulness' },
    ],
  },
  {
    id: 'accommodation',
    title: 'Where do you like to stay?',
    subtitle: 'Your preferred accommodation type',
    shortTitle: 'Stay',
    options: [
      { value: 'hotel', label: 'Hotels', description: 'Traditional hotels and resorts' },
      { value: 'boutique', label: 'Boutique', description: 'Unique, design-forward properties' },
      { value: 'airbnb', label: 'Vacation Rentals', description: 'Apartments, houses, local stays' },
      { value: 'hostel', label: 'Hostels', description: 'Budget-friendly, social atmosphere' },
    ],
  },
];

export default function Quiz() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isComplete, setIsComplete] = useState(false);
  const { setPreferences } = useAuth();
  const navigate = useNavigate();

  const question = questions[currentStep];
  const stepTitles = questions.map(q => q.shortTitle);

  const handleSelect = (value: string) => {
    if (question.multiSelect) {
      const current = (answers[question.id] as string[]) || [];
      const newValue = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      setAnswers({ ...answers, [question.id]: newValue });
    } else {
      setAnswers({ ...answers, [question.id]: value });
    }
  };

  const isSelected = (value: string) => {
    const answer = answers[question.id];
    if (Array.isArray(answer)) {
      return answer.includes(value);
    }
    return answer === value;
  };

  const canProceed = () => {
    const answer = answers[question.id];
    if (Array.isArray(answer)) {
      return answer.length > 0;
    }
    return !!answer;
  };

  const handleNext = async () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete quiz - save to Neon
      try {
        await setPreferences({
          style: answers.style as string,
          budget: answers.budget as string,
          pace: answers.pace as string,
          interests: answers.interests as string[],
          accommodation: answers.accommodation as string,
        });
        setIsComplete(true);
      } catch (error) {
        console.error('Failed to save preferences:', error);
        // Still show completion even if save failed
        setIsComplete(true);
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
        title="Travel Quiz | Voyance"
        description="Tell us about your travel preferences to get personalized recommendations."
      />
      
      <div className="min-h-screen pt-20 pb-8 flex flex-col">
        {/* Show completion screen or quiz */}
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
                <QuizProgress
                  currentStep={currentStep}
                  totalSteps={questions.length}
                  stepTitles={stepTitles}
                />
              </div>
              
              {/* Question */}
              <div className="flex-1 flex items-center justify-center px-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ 
                      type: 'spring',
                      stiffness: 300,
                      damping: 30
                    }}
                    className="max-w-2xl w-full"
                  >
                    {/* Question header */}
                    <motion.div 
                      className="text-center mb-8"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3">
                        {question.title}
                      </h1>
                      <p className="text-muted-foreground text-lg">{question.subtitle}</p>
                    </motion.div>
                    
                    {/* Options */}
                    <div className="grid gap-3">
                      {question.options.map((option, index) => (
                        <QuizOption
                          key={option.value}
                          value={option.value}
                          label={option.label}
                          description={option.description}
                          isSelected={isSelected(option.value)}
                          onSelect={handleSelect}
                          index={index}
                        />
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
              
              {/* Navigation */}
              <motion.div 
                className="max-w-2xl mx-auto w-full px-4 mt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className="gap-2 h-12 px-6"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="gap-2 h-12 px-8 bg-primary hover:bg-primary/90"
                  >
                    {currentStep === questions.length - 1 ? 'Complete' : 'Continue'}
                    <ArrowRight className="h-4 w-4" />
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
