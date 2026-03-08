import { motion } from 'framer-motion';
import { Sparkles, Palette, Share2, ArrowUpRight, Clock, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

const FREE_TIER_STEPS = [
  {
    icon: Zap,
    title: 'Quick & personalized',
    description: 'Take the quiz, pick a destination, get a personalized day built for your travel style.',
  },
  {
    icon: Palette,
    title: 'Customize freely',
    description: 'Swap activities, adjust timing, make it yours before you commit.',
  },
  {
    icon: Share2,
    title: 'Share with anyone',
    description: 'Send your itinerary to travel partners. They can view the full trip, no account needed.',
  },
  {
    icon: ArrowUpRight,
    title: 'Upgrade when ready',
    description: 'Love it? Unlock the full trip. Credits never expire on purchased packs.',
  },
];

// Note: This section is now de-emphasized per product decision.
// Free tier visibility is moderate - just a small callout near primary CTAs.
// This section remains for SEO and users who scroll, but is simplified.

export default function FreeTierSection() {
  return (
    <section className="relative py-12 sm:py-16 bg-background overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 text-center">
        {/* Simplified callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-4"
        >
          <h2 className="text-2xl sm:text-3xl font-serif font-normal text-foreground">
            150 free credits every month
          </h2>
          
          <p className="text-muted-foreground font-light max-w-lg mx-auto">
            Every user gets 150 credits monthly to unlock days, swap activities, and explore.
            Purchased credits never expire. No credit card required.
          </p>

          {/* Quick value props - inline */}
          <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground pt-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span>Free trip previews</span>
            </div>
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <span>Customize freely</span>
            </div>
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              <span>Share with anyone</span>
            </div>
          </div>

          <div className="pt-4">
            <Button 
              asChild 
              size="lg" 
              className="hidden sm:inline-flex rounded-full px-8"
            >
              <Link to={ROUTES.START}>
                <Sparkles className="mr-2 h-4 w-4" />
                Get Started Free
              </Link>
            </Button>
            <Link
              to={ROUTES.START}
              className="sm:hidden inline-flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Get Started Free
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
