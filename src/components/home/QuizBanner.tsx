import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

/**
 * Compact Quiz CTA strip - prominent but not overwhelming
 */
export default function QuizBanner() {
  return (
    <section className="relative py-4 sm:py-5 bg-primary overflow-hidden">
      {/* Subtle animated gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/95 to-accent opacity-90" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6"
        >
          {/* Text */}
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm sm:text-base font-medium">
              <span className="hidden sm:inline">Discover your Travel DNA: 5 minute quiz — </span>
              <span className="sm:hidden">Discover your Travel DNA: </span>
              <span className="text-white/80">We can customize your experience</span>
            </span>
          </div>

          {/* CTA Button */}
          <Button 
            asChild 
            size="sm"
            variant="secondary"
            className="bg-white text-primary hover:bg-white/90 font-semibold px-5 h-9 rounded-full shadow-lg"
          >
            <Link to={ROUTES.QUIZ}>
              Take the Quiz
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
