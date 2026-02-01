import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import DestinationEntry from './DestinationEntry';
import OneQuestionEntry from './OneQuestionEntry';
import FixItineraryEntry from './FixItineraryEntry';

type HeroMode = 'destination' | 'question' | 'fix';

export default function ValueFirstHero() {
  const [mode, setMode] = useState<HeroMode>('destination');

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background with subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />
      
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-6 py-12">
        {/* Mode tabs - subtle navigation */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center gap-6 mb-16"
        >
          <button
            onClick={() => setMode('destination')}
            className={cn(
              "pb-1 text-sm font-medium transition-all duration-300",
              "border-b-2",
              mode === 'destination' 
                ? "border-primary text-foreground" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Plan a trip
          </button>
          <button
            onClick={() => setMode('question')}
            className={cn(
              "pb-1 text-sm font-medium transition-all duration-300",
              "border-b-2",
              mode === 'question' 
                ? "border-primary text-foreground" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Find my style
          </button>
          <button
            onClick={() => setMode('fix')}
            className={cn(
              "pb-1 text-sm font-medium transition-all duration-300",
              "border-b-2",
              mode === 'fix' 
                ? "border-primary text-foreground" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Fix my itinerary
          </button>
        </motion.div>

        {/* The interactions */}
        <AnimatePresence mode="wait">
          {mode === 'destination' && (
            <motion.div
              key="destination"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DestinationEntry />
            </motion.div>
          )}
          {mode === 'question' && (
            <motion.div
              key="question"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <OneQuestionEntry />
            </motion.div>
          )}
          {mode === 'fix' && (
            <motion.div
              key="fix"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <FixItineraryEntry />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground"
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs tracking-wide uppercase">Scroll to learn more</span>
          <div className="w-px h-8 bg-gradient-to-b from-muted-foreground/50 to-transparent" />
        </div>
      </motion.div>
    </section>
  );
}
