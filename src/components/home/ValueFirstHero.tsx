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
      {/* Full-screen Background Image */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80"
          alt="Scenic mountain road at sunset"
          className="w-full h-full object-cover"
        />
        {/* Multi-layer gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
      </div>

      {/* Editorial Grid Lines - Magazine Detail */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-6 md:left-16 top-0 bottom-0 w-px bg-white/10" />
        <div className="absolute right-6 md:right-16 top-0 bottom-0 w-px bg-white/10" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Mode tabs - subtle navigation */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center gap-3 sm:gap-6 mb-8 sm:mb-16 flex-wrap"
        >
          <button
            onClick={() => setMode('destination')}
            className={cn(
              "pb-1 text-xs sm:text-sm font-medium transition-all duration-300",
              "border-b-2",
              mode === 'destination' 
                ? "border-white text-white" 
                : "border-transparent text-white/60 hover:text-white/90"
            )}
          >
            Plan a trip
          </button>
          <button
            onClick={() => setMode('question')}
            className={cn(
              "pb-1 text-xs sm:text-sm font-medium transition-all duration-300",
              "border-b-2",
              mode === 'question' 
                ? "border-white text-white" 
                : "border-transparent text-white/60 hover:text-white/90"
            )}
          >
            Find my style
          </button>
          <button
            onClick={() => setMode('fix')}
            className={cn(
              "pb-1 text-xs sm:text-sm font-medium transition-all duration-300",
              "border-b-2",
              mode === 'fix' 
                ? "border-white text-white" 
                : "border-transparent text-white/60 hover:text-white/90"
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

      {/* Editorial Detail - Issue marker - hidden on mobile for cleaner look */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="absolute bottom-6 sm:bottom-8 left-4 sm:left-6 md:left-16 text-white/40 text-[10px] sm:text-xs tracking-[0.2em] uppercase font-sans hidden sm:block"
      >
        AI-Powered Planning
      </motion.div>

      {/* Scroll indicator - positioned better on mobile */}
      <motion.div
        className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 text-white/60"
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      >
        <div className="flex flex-col items-center gap-1 sm:gap-2">
          <span className="text-[10px] sm:text-xs tracking-wide uppercase">Scroll</span>
          <div className="w-px h-6 sm:h-8 bg-gradient-to-b from-white/50 to-transparent" />
        </div>
      </motion.div>
    </section>
  );
}
