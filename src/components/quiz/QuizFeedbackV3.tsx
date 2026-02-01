/**
 * Quiz Feedback Component v3.1
 * Displays context-aware micro-feedback after each quiz answer
 * Uses feedback strings from quiz-questions-v3.json config
 */

import { motion, AnimatePresence } from 'framer-motion';
import quizConfig from '@/config/quiz-questions-v3.json';

interface QuizFeedbackV3Props {
  questionId: string;
  answerValue: string | null;
  show: boolean;
}

/**
 * Get feedback text from the quiz config
 * Looks up feedback by question ID and answer ID
 */
function getFeedbackFromConfig(questionId: string, answerId: string): string | null {
  const question = quizConfig.questions.find(q => q.id === questionId);
  if (!question?.feedback) return null;
  
  // Feedback is keyed by answer ID in the config
  const feedback = question.feedback as Record<string, string>;
  return feedback[answerId] || null;
}

export default function QuizFeedbackV3({ questionId, answerValue, show }: QuizFeedbackV3Props) {
  if (!show || !answerValue) return null;
  
  const feedback = getFeedbackFromConfig(questionId, answerValue);
  
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
