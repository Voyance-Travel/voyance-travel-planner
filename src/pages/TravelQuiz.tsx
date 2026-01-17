import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

const questions = [
  {
    id: 'pace',
    title: "What's your ideal travel pace?",
    subtitle: 'How do you like to experience new places?',
    options: [
      { value: 'relaxed', label: 'Relaxed Explorer', description: 'Take it slow, savor every moment', icon: '🌴' },
      { value: 'balanced', label: 'Balanced Adventurer', description: 'Mix of activities and downtime', icon: '⚖️' },
      { value: 'active', label: 'Go-Getter', description: 'Pack in as much as possible', icon: '🚀' },
    ],
  },
  {
    id: 'interests',
    title: 'What draws you to a destination?',
    subtitle: 'Select all that apply',
    multiple: true,
    options: [
      { value: 'culture', label: 'Culture & History', icon: '🏛️' },
      { value: 'food', label: 'Food & Cuisine', icon: '🍜' },
      { value: 'nature', label: 'Nature & Outdoors', icon: '🏔️' },
      { value: 'adventure', label: 'Adventure & Thrills', icon: '🎢' },
      { value: 'relaxation', label: 'Relaxation & Wellness', icon: '🧘' },
      { value: 'nightlife', label: 'Nightlife & Entertainment', icon: '🎭' },
    ],
  },
  {
    id: 'budget',
    title: "What's your typical travel budget?",
    subtitle: 'Per person, per day',
    options: [
      { value: 'budget', label: 'Budget Traveler', description: 'Under $100/day', icon: '💰' },
      { value: 'moderate', label: 'Comfort Seeker', description: '$100-300/day', icon: '💳' },
      { value: 'luxury', label: 'Luxury Explorer', description: '$300+/day', icon: '💎' },
    ],
  },
  {
    id: 'accommodation',
    title: 'Where do you prefer to stay?',
    subtitle: 'Your home away from home',
    options: [
      { value: 'hostel', label: 'Hostels & Shared', description: 'Social and affordable', icon: '🛏️' },
      { value: 'hotel', label: 'Hotels & Resorts', description: 'Comfort and amenities', icon: '🏨' },
      { value: 'unique', label: 'Unique Stays', description: 'Airbnbs, treehouses, boats', icon: '🏡' },
    ],
  },
  {
    id: 'planning',
    title: 'How do you like to plan?',
    subtitle: 'Your approach to itineraries',
    options: [
      { value: 'spontaneous', label: 'Spontaneous', description: 'Go with the flow', icon: '🎲' },
      { value: 'flexible', label: 'Flexible Framework', description: 'Key plans, room to wander', icon: '📋' },
      { value: 'detailed', label: 'Detailed Planner', description: 'Every hour accounted for', icon: '📅' },
    ],
  },
];

export default function TravelQuiz() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const navigate = useNavigate();
  const { setPreferences } = useAuth();

  const question = questions[currentStep];
  const isLastStep = currentStep === questions.length - 1;
  const currentAnswer = answers[question.id];

  const handleSelect = (value: string) => {
    if (question.multiple) {
      const current = (answers[question.id] as string[]) || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      setAnswers({ ...answers, [question.id]: updated });
    } else {
      setAnswers({ ...answers, [question.id]: value });
    }
  };

  const canProceed = question.multiple
    ? ((currentAnswer as string[])?.length || 0) > 0
    : !!currentAnswer;

  const handleNext = () => {
    if (isLastStep) {
      setPreferences(answers);
      navigate('/profile');
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="h-6 w-6 text-accent" />
          <span className="font-serif text-xl font-semibold">Voyance</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {currentStep + 1} of {questions.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-6">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-2xl"
          >
            <h1 className="font-serif text-3xl md:text-4xl font-semibold text-center mb-2">
              {question.title}
            </h1>
            <p className="text-muted-foreground text-center mb-8">{question.subtitle}</p>

            <div className={`grid gap-4 ${question.options.length > 4 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-3'}`}>
              {question.options.map((option) => {
                const isSelected = question.multiple
                  ? (currentAnswer as string[])?.includes(option.value)
                  : currentAnswer === option.value;

                return (
                  <motion.button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <Check className="h-5 w-5 text-accent" />
                      </div>
                    )}
                    <span className="text-3xl mb-3 block">{option.icon}</span>
                    <h3 className="font-semibold mb-1">{option.label}</h3>
                    {option.description && (
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-6 flex justify-between">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep(currentStep - 1)}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button variant="accent" onClick={handleNext} disabled={!canProceed}>
          {isLastStep ? 'Complete' : 'Continue'}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
