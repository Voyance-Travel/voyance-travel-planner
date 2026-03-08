import { motion } from 'framer-motion';
import { strangerCopy } from '@/lib/strangerCopy';
import { Lightbulb } from 'lucide-react';
import MicroQuizComparison from './MicroQuizComparison';

export default function TheInsightSection() {
  const { insight } = strangerCopy.homepage;

  return (
    <section className="py-16 sm:py-24 md:py-32 relative overflow-hidden bg-muted/30">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      {/* Decorative circles */}
      <div className="absolute -left-32 top-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -right-32 bottom-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-16 relative z-10">
        {/* Header - Traveler Identity */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 md:mb-16"
        >
          {/* Eyebrow with icon */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Lightbulb className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
            </div>
            <span className="text-[10px] sm:text-sm tracking-[0.2em] uppercase text-muted-foreground font-medium">
              {insight.eyebrow}
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-normal text-foreground mb-4 sm:mb-6 leading-tight">
            {insight.headline}
          </h2>

          {/* Body */}
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            You're not a generic traveler. The problem isn't your research skills. 
            It's that no one asked what kind of traveler you are.
          </p>
        </motion.div>

        {/* Interactive Micro-Quiz */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <MicroQuizComparison />
        </motion.div>

        {/* The key insight - below quiz */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12 md:mt-16 p-4 sm:p-6 bg-primary/10 rounded-xl sm:rounded-2xl border border-primary/20 max-w-2xl mx-auto text-center"
        >
          <p className="text-xl sm:text-2xl md:text-3xl font-serif text-foreground mb-1 sm:mb-2">
            We ask.
          </p>
          <p className="text-sm sm:text-base text-muted-foreground">
            A few thoughtful questions. Then an itinerary that actually fits how you travel.
          </p>
        </motion.div>

        {/* 29 Travel DNA badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="flex justify-center mt-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
            <span className="text-primary font-bold">29</span>
            <span className="text-sm text-muted-foreground">Travel DNA Profiles</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
