import { motion } from 'framer-motion';
import { Sparkles, Palette, Share2, ArrowUpRight, Clock, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

const FREE_TIER_STEPS = [
  {
    icon: Zap,
    title: 'Generate in 2 min',
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

export default function FreeTierSection() {
  return (
    <section className="relative py-14 sm:py-20 md:py-24 bg-muted/30 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 sm:mb-16"
        >
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-6 sm:w-8 h-px bg-primary" />
            <span className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
              No strings attached
            </span>
            <div className="w-6 sm:w-8 h-px bg-primary" />
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-foreground mb-4 leading-tight">
            Your first day is{' '}
            <em className="font-normal text-primary">always free</em>
          </h2>
          
          {/* Subhead */}
          <p className="text-base sm:text-lg text-muted-foreground font-sans font-light max-w-2xl mx-auto leading-relaxed">
            Every month, see what Voyance builds for you — free. No credit card. No commitment.
            Just a personalized preview of what travel could look like.
          </p>
        </motion.div>

        {/* Free tier value cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {FREE_TIER_STEPS.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group bg-card border border-border p-6 hover:border-primary/30 transition-all duration-300"
            >
              {/* Step number + Icon */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-mono text-muted-foreground/50">
                  0{index + 1}
                </span>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
              </div>
              
              {/* Content */}
              <h3 className="text-lg font-serif text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground font-sans font-light leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button 
            asChild 
            size="lg" 
            className="text-base px-10 py-6 font-sans font-medium tracking-wide"
          >
            <Link to={ROUTES.START}>
              <Sparkles className="mr-2 h-4 w-4" />
              Try It Free
            </Link>
          </Button>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>150 credits refresh monthly</span>
          </div>
        </motion.div>

        {/* Honest economics callout */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center mt-8 text-xs text-muted-foreground/60 font-sans max-w-lg mx-auto"
        >
          We built this to be shared. Free users help us grow — 
          that's why we'll always have a generous free tier.
        </motion.p>
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      </div>
    </section>
  );
}
