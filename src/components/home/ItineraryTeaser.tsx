/**
 * Itinerary Teaser for Hero Section
 * Shows a real 3-day preview (no login required)
 * Purpose: Demonstrate value, then guide to quiz or demo
 */

import { motion } from 'framer-motion';
import { 
  Calendar, 
  Sparkles, 
  ArrowRight, 
  Play,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

interface Day {
  dayNumber: number;
  headline: string;
  description: string;
}

interface ItineraryTeaserProps {
  destination: string;
  days: Day[];
  totalDays: number;
  archetypeUsed: string;
  archetypeTagline: string;
  onStartOver: () => void;
  onTakeQuiz: () => void;
}

export function ItineraryTeaser({ 
  destination, 
  days,
  totalDays,
  archetypeUsed,
  archetypeTagline,
  onStartOver,
  onTakeQuiz,
}: ItineraryTeaserProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <h2 className="text-2xl md:text-3xl font-serif font-normal mb-2 text-white drop-shadow-lg">
          Your {destination} Preview
        </h2>
        <p className="text-white/70 text-sm">
          Built as a <span className="text-primary font-medium">{archetypeUsed}</span>
        </p>
        <p className="text-white/60 text-xs mt-1 italic">
          "{archetypeTagline}"
        </p>
      </motion.div>

      {/* 3-Day Preview Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3 mb-6"
      >
        {days.map((day, i) => (
          <motion.div
            key={day.dayNumber}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-white/20 flex items-start gap-4"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-primary uppercase tracking-wide">
                  Day {day.dayNumber}
                </span>
              </div>
              <h3 className="text-white font-medium text-sm md:text-base">
                {day.headline}
              </h3>
              <p className="text-white/70 text-xs md:text-sm mt-1">
                {day.description}
              </p>
            </div>
          </motion.div>
        ))}

        {/* Remaining Days Teaser */}
        {totalDays > 3 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-center"
          >
            <p className="text-white/50 text-sm">
              + {totalDays - 3} more days of curated experiences
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* The Hook */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-black/30 backdrop-blur-sm rounded-2xl p-5 border border-white/20 mb-6 text-center"
      >
        <Sparkles className="w-5 h-5 text-primary mx-auto mb-2" />
        <p className="text-white font-medium mb-1">
          Not quite right?
        </p>
        <p className="text-white/70 text-sm">
          This was built for a {archetypeUsed}. Your style might be completely different.
        </p>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="space-y-3"
      >
        {/* Primary CTA: Take the Quiz */}
        <Button
          onClick={onTakeQuiz}
          size="lg"
          className="w-full rounded-full bg-white text-black hover:bg-white/90"
        >
          Find Your Travel Style
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>

        {/* Secondary CTA: See Demo */}
        <Button
          asChild
          variant="outline"
          size="lg"
          className="w-full rounded-full border-white/30 text-white hover:bg-white/10"
        >
          <Link to={ROUTES.DEMO}>
            <Play className="mr-2 w-4 h-4" />
            See How It Works
          </Link>
        </Button>

        {/* Tertiary: Try Another */}
        <button
          onClick={onStartOver}
          className="w-full flex items-center justify-center gap-2 text-sm text-white/50 hover:text-white/70 transition-colors py-2"
        >
          <RefreshCw className="w-3 h-3" />
          Try another destination
        </button>
      </motion.div>

      {/* Free tier callout */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-center text-xs text-white/50 mt-4"
      >
        No credit card required. Your first day is free, every month.
      </motion.p>
    </motion.div>
  );
}

export default ItineraryTeaser;
