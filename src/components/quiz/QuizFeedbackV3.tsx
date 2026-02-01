/**
 * QuizFeedbackV3 - Feedback component using v3 quiz config
 * Shows warm acknowledgment after quiz answer selection
 */

import { motion, AnimatePresence } from 'framer-motion';
import quizConfig from '@/config/quiz-questions-v3.json';

interface QuizFeedbackV3Props {
  questionId: string;
  answerValue: string | null;
  show: boolean;
}

// Get feedback from the v3 config
function getFeedbackFromConfig(questionId: string, answerId: string): string | null {
  const question = quizConfig.questions.find(q => q.id === questionId);
  if (!question || !question.feedback) return null;
  
  // Extract the key from answer ID (e.g., "q1a" -> "a")
  const feedbackKey = answerId.replace(questionId.replace('_', ''), '').replace(/^q\d+/, '');
  
  // Try direct match first
  if (question.feedback[feedbackKey]) {
    return question.feedback[feedbackKey];
  }
  
  // Try with answer ID
  if (question.feedback[answerId]) {
    return question.feedback[answerId];
  }
  
  return null;
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
