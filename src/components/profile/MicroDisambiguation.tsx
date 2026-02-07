/**
 * Micro-Disambiguation Component
 * 
 * Shows a single clarifying question when DNA confidence is low (<60%).
 * Answer saves deltas as overrides and triggers a full DNA recalculation
 * so archetypes, tone tags, and all derived data stay in sync.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HelpCircle, 
  Check,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { recalculateDNAFromPreferences } from '@/utils/quizMapping';

// ============================================================================
// TYPES
// ============================================================================

interface DisambiguationQuestion {
  id: string;
  question: string;
  subtext?: string;
  options: Array<{
    id: string;
    label: string;
    iconName?: string;
    deltas: Record<string, number>;
  }>;
}

interface MicroDisambiguationProps {
  userId: string;
  confidence: number;
  onResolved?: () => void;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DISAMBIGUATION_QUESTIONS: DisambiguationQuestion[] = [
  {
    id: 'regret_type',
    question: 'What do you regret more after a trip?',
    subtext: 'This helps us understand your planning style',
    options: [
      { 
        id: 'overplanning', 
        label: 'Over-planning and missing spontaneous moments', 
        iconName: 'ListTodo',
        deltas: { planning: -3, pace: -2 } 
      },
      { 
        id: 'missing_out', 
        label: 'Not planning enough and missing must-see spots', 
        iconName: 'AlertCircle',
        deltas: { planning: 3, pace: 2 } 
      },
      { 
        id: 'both_equally', 
        label: 'Both equally - I like balance', 
        iconName: 'Scale',
        deltas: { planning: 0, pace: 0 } 
      },
    ],
  },
  {
    id: 'ideal_day',
    question: 'Your ideal travel day has...',
    options: [
      { 
        id: 'few_activities', 
        label: '1-2 activities with lots of downtime', 
        iconName: 'Leaf',
        deltas: { pace: -4, comfort: 2 } 
      },
      { 
        id: 'balanced', 
        label: '3-4 activities with some rest', 
        iconName: 'Sun',
        deltas: { pace: 0 } 
      },
      { 
        id: 'packed', 
        label: '5+ activities - maximize every moment!', 
        iconName: 'Zap',
        deltas: { pace: 5, adventure: 2 } 
      },
    ],
  },
  {
    id: 'companion_preference',
    question: 'You enjoy travel most when...',
    options: [
      { 
        id: 'solo', 
        label: 'Traveling solo and meeting locals', 
        iconName: 'Compass',
        deltas: { social: -3, authenticity: 3 } 
      },
      { 
        id: 'small_group', 
        label: 'With a close friend or partner', 
        iconName: 'Users',
        deltas: { social: 0 } 
      },
      { 
        id: 'larger_group', 
        label: 'With a group of friends or guided tour', 
        iconName: 'UsersRound',
        deltas: { social: 4 } 
      },
    ],
  },
  {
    id: 'comfort_tradeoff',
    question: 'Would you sacrifice comfort for a unique experience?',
    options: [
      { 
        id: 'yes_definitely', 
        label: 'Absolutely - discomfort is part of adventure!', 
        iconName: 'Tent',
        deltas: { comfort: -4, adventure: 3, authenticity: 2 } 
      },
      { 
        id: 'depends', 
        label: 'Sometimes, if the experience is truly special', 
        iconName: 'HelpCircle',
        deltas: { comfort: 0, adventure: 1 } 
      },
      { 
        id: 'no', 
        label: 'No - comfort is non-negotiable for me', 
        iconName: 'Sparkles',
        deltas: { comfort: 4, adventure: -2 } 
      },
    ],
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function MicroDisambiguation({
  userId,
  confidence,
  onResolved,
  className,
}: MicroDisambiguationProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  // Don't show if confidence is high enough
  if (confidence >= 60) {
    return null;
  }

  // Pick a random question (or could be based on which traits have most uncertainty)
  const question = DISAMBIGUATION_QUESTIONS[
    Math.floor(Date.now() / 86400000) % DISAMBIGUATION_QUESTIONS.length // Changes daily
  ];

  const handleSubmit = async () => {
    if (!selectedAnswer) return;

    const selectedOption = question.options.find(o => o.id === selectedAnswer);
    if (!selectedOption) return;

    setIsSubmitting(true);

    try {
      // Log the disambiguation event
      await supabase
        .from('voyance_events')
        .insert({
          user_id: userId,
          event_name: 'dna_disambiguation',
          properties: {
            question_id: question.id,
            answer_id: selectedAnswer,
            deltas_applied: selectedOption.deltas,
            original_confidence: confidence,
            submitted_at: new Date().toISOString(),
          },
        });

      // Apply disambiguation deltas as overrides, then trigger full recalc
      // so archetypes and all derived data stay consistent
      const { data: profileData } = await supabase
        .from('profiles')
        .select('travel_dna_overrides')
        .eq('id', userId)
        .maybeSingle();

      const existingOverrides = (profileData?.travel_dna_overrides as Record<string, number>) || {};
      const mergedOverrides = { ...existingOverrides };
      
      for (const [trait, delta] of Object.entries(selectedOption.deltas)) {
        const currentValue = mergedOverrides[trait] || 0;
        mergedOverrides[trait] = Math.max(-10, Math.min(10, currentValue + delta));
      }

      // Save overrides to profiles table
      await supabase
        .from('profiles')
        .update({ travel_dna_overrides: mergedOverrides })
        .eq('id', userId);

      // Full recalculation — updates archetypes, tone tags, everything
      await recalculateDNAFromPreferences(userId);

      setIsResolved(true);
      toast.success('Thanks! Your profile has been refined.');
      onResolved?.();

    } catch (error) {
      console.error('Failed to submit disambiguation:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isResolved) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "p-6 rounded-xl bg-primary/5 border border-primary/20 text-center",
          className
        )}
      >
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h4 className="font-medium text-foreground mb-1">Profile Refined!</h4>
        <p className="text-sm text-muted-foreground">
          We've adjusted your Travel DNA based on your answer.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <CardTitle className="text-base font-medium">Help us understand you better</CardTitle>
          </div>
          <CardDescription className="text-amber-700 dark:text-amber-300">
            Your profile shows mixed signals. One quick question will help refine your recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{question.question}</p>
            {question.subtext && (
              <p className="text-xs text-muted-foreground">{question.subtext}</p>
            )}
          </div>

          <div className="space-y-2">
            {question.options.map((option) => (
              <Button
                key={option.id}
                variant={selectedAnswer === option.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedAnswer(option.id)}
                className={cn(
                  "w-full justify-start h-auto py-3 px-4 text-left",
                  selectedAnswer === option.id && "ring-2 ring-primary/20"
                )}
                >
                  <span className="flex-1 whitespace-normal">{option.label}</span>
                  {selectedAnswer === option.id && (
                    <Check className="h-4 w-4 ml-2 flex-shrink-0" />
                  )}
                </Button>
            ))}
          </div>

          <AnimatePresence>
            {selectedAnswer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Refine My Profile
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export type { MicroDisambiguationProps };
