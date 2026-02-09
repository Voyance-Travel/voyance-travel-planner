import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

export default function PricingPreview() {
  return (
    <section className="py-12 sm:py-16 md:py-20 bg-muted/30 relative overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-8 md:px-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          {/* Main pricing message */}
          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-serif text-foreground leading-relaxed">
            Start free.{' '}
            <span className="text-muted-foreground">Top up from $9.</span>{' '}
            <span className="text-primary font-medium">Join the Club from $49.99.</span>
          </p>
          
          {/* Link to pricing */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
            <Link 
              to={ROUTES.PRICING}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-sans"
            >
              See all pricing options
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
