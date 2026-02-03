/**
 * Intelligence Teaser for Hero Section
 * Shows what Voyance knows about a destination (cached, no login)
 * Purpose: Make users curious enough to take the quiz
 */

import { motion } from 'framer-motion';
import { Sparkles, Clock, MapPinOff, Target, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IntelligenceTeaserProps {
  destination: string;
  stats: {
    hiddenGems: number;
    timingHacks: number;
    trapsToAvoid: number;
    insiderTips: number;
  };
  onTakeQuiz: () => void;
  onStartOver: () => void;
}

export function IntelligenceTeaser({ 
  destination, 
  stats, 
  onTakeQuiz,
  onStartOver 
}: IntelligenceTeaserProps) {
  const badges = [
    { icon: Sparkles, count: stats.hiddenGems, label: 'Hidden Gems', color: 'text-primary' },
    { icon: Clock, count: stats.timingHacks, label: 'Timing Hacks', color: 'text-accent' },
    { icon: MapPinOff, count: stats.trapsToAvoid, label: 'Traps to Skip', color: 'text-rose-500' },
    { icon: Target, count: stats.insiderTips, label: 'Insider Tips', color: 'text-gold' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto text-center"
    >
      {/* Header */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl md:text-4xl font-serif font-normal mb-3 text-white drop-shadow-lg"
      >
        What we know about {destination}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-white/80 mb-8"
      >
        40+ hours of research, curated for you.
      </motion.p>

      {/* Intelligence badges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
      >
        {badges.map((badge, i) => (
          <motion.div
            key={badge.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-white/20"
          >
            <badge.icon className={`h-5 w-5 mx-auto mb-2 ${badge.color}`} />
            <span className="block text-2xl font-bold text-white">{badge.count}</span>
            <span className="text-xs text-white/70">{badge.label}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* The hook */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 border border-white/20 mb-8"
      >
        <p className="text-lg font-medium text-white mb-2">
          But which ones matter to <em>you</em>?
        </p>
        <p className="text-white/70 text-sm">
          A quick quiz unlocks personalized intelligence. We show you what to skip based on 
          <strong className="text-white"> how you actually travel</strong>.
        </p>
      </motion.div>

      {/* CTA + Free tier callout */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="space-y-4"
      >
        <Button
          onClick={onTakeQuiz}
          size="lg"
          className="rounded-full px-8 bg-white text-black hover:bg-white/90"
        >
          Find out what's for me
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>

        {/* Free tier callout - moderate visibility */}
        <p className="text-sm text-white/60">
          No credit card required. Your first day is free, every month.
        </p>

        <button
          onClick={onStartOver}
          className="text-sm text-white/50 hover:text-white/70 transition-colors"
        >
          ← Try another destination
        </button>
      </motion.div>
    </motion.div>
  );
}

export default IntelligenceTeaser;
