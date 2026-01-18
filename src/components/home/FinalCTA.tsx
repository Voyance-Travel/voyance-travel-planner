import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

export default function FinalCTA() {
  return (
    <section className="relative py-32 bg-slate text-white overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=1920&q=80"
          alt="Travel inspiration"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate via-slate/95 to-slate" />
      </div>

      {/* Editorial Grid Lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-8 md:left-16 top-0 bottom-0 w-px bg-white/5" />
        <div className="absolute right-8 md:right-16 top-0 bottom-0 w-px bg-white/5" />
      </div>

      <div className="max-w-4xl mx-auto px-8 md:px-16 text-center relative z-10">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-4 mb-8"
        >
          <div className="w-8 h-px bg-white/40" />
          <span className="text-xs tracking-[0.25em] uppercase text-white/60 font-sans">
            Begin Today
          </span>
          <div className="w-8 h-px bg-white/40" />
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl lg:text-6xl font-serif font-normal mb-6 leading-tight"
        >
          Your journey awaits
        </motion.h2>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg text-white/70 font-sans font-light mb-12 max-w-xl mx-auto"
        >
          Let us craft an itinerary that reflects who you are and where you want to go.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <Button 
            asChild 
            size="lg" 
            className="text-base px-12 py-6 bg-white text-slate hover:bg-white/90 font-sans font-medium tracking-wide"
          >
            <Link to={ROUTES.START}>
              Start Planning
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-16 pt-12 border-t border-white/10"
        >
          <div className="flex flex-wrap justify-center gap-8 text-sm text-white/40 font-sans">
            <span>No booking fees</span>
            <span className="hidden sm:inline">•</span>
            <span>Best price guarantee</span>
            <span className="hidden sm:inline">•</span>
            <span>24/7 support</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}