import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

export default function FinalCTA() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1920')] bg-cover bg-center opacity-10" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white/90 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Ready to explore?
          </div>

          <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-6">
            Ready to Start Your
            <br />
            Perfect Trip?
          </h2>

          <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto">
            Join thousands of travelers who've discovered their dream destinations with Voyance. 
            Your personalized journey is just one quiz away.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="secondary"
              className="text-base px-8"
              asChild
            >
              <Link to={ROUTES.QUIZ}>
                Take the Dream Quiz
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 border-white/30 text-white hover:bg-white/10"
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
