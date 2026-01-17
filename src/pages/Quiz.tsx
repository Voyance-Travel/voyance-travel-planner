import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

const questions = [
  {
    id: 'style',
    title: 'What\'s your travel style?',
    subtitle: 'Choose the option that best describes you',
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
  const { setPreferences } = useAuth();
  const navigate = useNavigate();

  const question = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

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

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete quiz
      setPreferences({
        style: answers.style as string,
        budget: answers.budget as string,
        pace: answers.pace as string,
        interests: answers.interests as string[],
        accommodation: answers.accommodation as string,
      });
      navigate(ROUTES.PROFILE.VIEW);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <MainLayout showFooter={false}>
      <Head
        title="Travel Quiz | Voyance"
        description="Tell us about your travel preferences to get personalized recommendations."
      />
      
      <div className="min-h-screen pt-20 pb-8 flex flex-col">
        {/* Progress */}
        <div className="max-w-2xl mx-auto w-full px-4 mb-8">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Question {currentStep + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Question */}
        <div className="flex-1 flex items-center justify-center px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl w-full"
            >
              <div className="text-center mb-8">
                <h1 className="text-3xl font-display font-bold text-foreground mb-2">
                  {question.title}
                </h1>
                <p className="text-muted-foreground">{question.subtitle}</p>
              </div>
              
              <div className="grid gap-3">
                {question.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all',
                      isSelected(option.value)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-foreground">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.description}</div>
                      </div>
                      {isSelected(option.value) && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Navigation */}
        <div className="max-w-2xl mx-auto w-full px-4 mt-8">
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="gap-2"
            >
              {currentStep === questions.length - 1 ? 'Complete' : 'Next'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
