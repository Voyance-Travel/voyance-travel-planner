/**
 * TripSetupFeedback - Dynamic feedback as users fill trip setup forms
 * Shows contextual responses based on their selections
 */

import { motion, AnimatePresence } from 'framer-motion';
import { 
  getDestinationFeedback, 
  getDurationFeedback,
  getTripTypeFeedback,
  getVisitorFeedback,
  getChildAgeFeedback,
  getTravelerCountFeedback,
} from '@/data/conversationFeedback';

interface TripSetupFeedbackProps {
  field: 'destination' | 'duration' | 'tripType' | 'visitor' | 'childAge' | 'travelers';
  value: string | number | boolean;
  destination?: string; // For visitor feedback
}

export default function TripSetupFeedback({ field, value, destination }: TripSetupFeedbackProps) {
  let feedback: string | null = null;
  
  switch (field) {
    case 'destination':
      if (typeof value === 'string' && value.length >= 2) {
        feedback = getDestinationFeedback(value);
      }
      break;
    case 'duration':
      if (typeof value === 'number' && value > 0) {
        feedback = getDurationFeedback(value);
      }
      break;
    case 'tripType':
      if (typeof value === 'string') {
        feedback = getTripTypeFeedback(value);
      }
      break;
    case 'visitor':
      if (typeof value === 'boolean' && destination) {
        feedback = getVisitorFeedback(value, destination);
      }
      break;
    case 'childAge':
      if (typeof value === 'number') {
        feedback = getChildAgeFeedback(value);
      }
      break;
    case 'travelers':
      if (typeof value === 'number' && value > 0) {
        feedback = getTravelerCountFeedback(value);
      }
      break;
  }
  
  if (!feedback) return null;
  
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={`${field}-${value}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="text-sm text-primary mt-1.5 font-medium"
      >
        {feedback}
      </motion.p>
    </AnimatePresence>
  );
}

/**
 * Inline feedback variant - for toast-style feedback
 */
export function InlineFeedback({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1.5 text-xs text-primary font-medium"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      {message}
    </motion.div>
  );
}
