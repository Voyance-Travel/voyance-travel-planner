/**
 * QuizFeedback - Warm acknowledgment after quiz answer selection
 * Transforms the quiz from a form into a conversation
 */

import { motion, AnimatePresence } from 'framer-motion';
import { getQuizFeedback } from '@/data/conversationFeedback';

interface QuizFeedbackProps {
  questionId: string;
  answerValue: string | null;
  show: boolean;
}

export default function QuizFeedback({ questionId, answerValue, show }: QuizFeedbackProps) {
  if (!show || !answerValue) return null;
  
  const feedback = getQuizFeedback(questionId, answerValue);
  
  if (!feedback) return null;
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${questionId}-${answerValue}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mt-4 text-center"
      >
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
          {feedback}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
