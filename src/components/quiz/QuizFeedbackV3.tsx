/**
 * Quiz Feedback Component v3.1
 * Displays context-aware micro-feedback after each quiz answer
 * Uses feedback strings from quiz-questions-v3.json config
 */

import { motion } from 'framer-motion';
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
    <motion.span
      key={`${questionId}-${answerValue}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="inline-block text-xs text-primary/80 font-medium mt-1"
    >
      {feedback}
    </motion.span>
  );
}
