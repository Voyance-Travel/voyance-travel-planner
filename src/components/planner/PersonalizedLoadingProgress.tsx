/**
 * PersonalizedLoadingProgress - Loading messages that reflect the user's context
 * Makes the wait feel like preparation, not just loading
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { buildLoadingMessages } from '@/data/conversationFeedback';

interface PersonalizedLoadingProgressProps {
  archetype?: string;
  tripType?: string;
  hasToddler?: boolean;
  isFirstTime?: boolean;
  destination?: string;
  travelers?: number;
  /** Progress percentage 0-100 */
  progress?: number;
  /** Current step description from the generation process */
  currentStep?: string;
}

export default function PersonalizedLoadingProgress({
  archetype,
  tripType,
  hasToddler,
  isFirstTime,
  destination,
  travelers,
  progress = 0,
  currentStep,
}: PersonalizedLoadingProgressProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  
  // Build personalized message queue
  const messages = useMemo(() => {
    return buildLoadingMessages({
      archetype,
      tripType,
      hasToddler,
      isFirstTime,
      destination,
      travelers,
    });
  }, [archetype, tripType, hasToddler, isFirstTime, destination, travelers]);
  
  // Cycle through messages
  useEffect(() => {
    if (messageIndex >= messages.length - 1) return;
    
    const interval = setInterval(() => {
      setMessageIndex(prev => 
        prev < messages.length - 1 ? prev + 1 : prev
      );
    }, 2800);
    
    return () => clearInterval(interval);
  }, [messages.length, messageIndex]);
  
  // Use currentStep if provided, otherwise use our message queue
  const displayMessage = currentStep || messages[messageIndex];
  
  return (
    <div className="flex flex-col items-center justify-center py-12">
      {/* Animated icon */}
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0],
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="mb-6 relative"
      >
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary/30"
          animate={{ scale: [1, 1.3, 1.5], opacity: [0.5, 0.2, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
      
      {/* Progress bar */}
      {progress > 0 && (
        <div className="w-64 h-1.5 bg-muted rounded-full overflow-hidden mb-4">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      )}
      
      {/* Personalized message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={displayMessage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="text-lg text-foreground/80 text-center max-w-md"
        >
          {displayMessage}
        </motion.p>
      </AnimatePresence>
      
      {/* Progress indicator dots */}
      <div className="flex gap-1.5 mt-6">
        {messages.slice(0, Math.min(messages.length, 6)).map((_, idx) => (
          <motion.div
            key={idx}
            className={`w-2 h-2 rounded-full ${
              idx <= messageIndex ? 'bg-primary' : 'bg-muted'
            }`}
            animate={idx === messageIndex ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.5 }}
          />
        ))}
      </div>
    </div>
  );
}
