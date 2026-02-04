import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Clock, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

/**
 * High-visibility Quiz CTA banner
 * Designed to be unmissable - placed prominently on homepage
 */
export default function QuizBanner() {
  return (
    <section className="relative py-12 sm:py-16 md:py-20 overflow-hidden">
      {/* Gradient background with animated accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent" />
      
      {/* Animated floating elements */}
      <motion.div
        className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl"
        animate={{ 
          x: [0, 30, 0], 
          y: [0, -20, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-10 right-20 w-48 h-48 bg-white/10 rounded-full blur-3xl"
        animate={{ 
          x: [0, -20, 0], 
          y: [0, 30, 0],
          scale: [1.1, 1, 1.1]
        }}
        transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
      />
      
      {/* Decorative pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div 
          className="absolute inset-0" 
          style={{ 
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', 
            backgroundSize: '32px 32px' 
          }} 
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 md:px-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-white/20 backdrop-blur-sm rounded-full border border-white/30"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-white tracking-wide">
              Discover Your Travel DNA
            </span>
          </motion.div>

          {/* Main headline */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-normal text-white mb-4 sm:mb-6 leading-tight">
            What Kind of Traveler
            <br className="hidden sm:block" />
            <span className="italic"> Are You?</span>
          </h2>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto mb-8 leading-relaxed">
            Take our 5-minute quiz and unlock personalized itineraries 
            built for how <em>you</em> actually travel.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mb-8 text-white/80">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span className="text-sm sm:text-base font-medium">5 minutes</span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-white/30" />
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              <span className="text-sm sm:text-base font-medium">21 questions</span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-white/30" />
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">27</span>
              <span className="text-sm sm:text-base font-medium">archetypes</span>
            </div>
          </div>

          {/* CTA Button - Extra large and prominent */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button 
              asChild 
              size="lg" 
              className="bg-white text-primary hover:bg-white/90 font-semibold text-lg px-10 py-7 h-auto rounded-xl shadow-2xl shadow-black/20"
            >
              <Link to={ROUTES.QUIZ}>
                Take the Quiz Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>

          {/* No account required */}
          <p className="text-sm text-white/70 mt-5">
            No sign-up required. See your results instantly.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
