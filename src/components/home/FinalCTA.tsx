import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

export default function FinalCTA() {
  return (
    <section className="relative py-32 overflow-hidden bg-gradient-to-br from-primary via-primary to-emerald">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-10 w-64 h-64 bg-gold/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-accent/20 rounded-full blur-3xl" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-sm tracking-[0.25em] uppercase text-white/60 mb-6">
            Begin Your Journey
          </p>

          <h2 className="text-3xl md:text-5xl font-display font-medium text-white mb-6 leading-tight">
            Ready to plan your
            <br />
            next adventure?
          </h2>

          <p className="text-lg text-white/70 mb-10 max-w-md mx-auto font-light">
            Join travelers who've discovered thoughtfully planned journeys with Voyance.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="text-base px-8 bg-white text-primary hover:bg-white/90 shadow-lg"
              asChild
            >
              <Link to={ROUTES.START}>
                Start Planning
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 border-white/40 text-white bg-transparent hover:bg-white/10"
              asChild
            >
              <Link to={ROUTES.EXPLORE}>
                Explore Destinations
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
