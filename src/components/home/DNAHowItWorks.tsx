import { motion } from 'framer-motion';
import { Dna, Sliders, MapPin, RefreshCw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

const STEPS = [
  {
    number: '1',
    icon: Dna,
    title: 'Discover your Travel DNA',
    description: 'Take our 5-minute quiz. We analyze your preferences across 10 traits to identify your unique travel personality from 27 archetypes.',
    highlight: '5-min quiz',
  },
  {
    number: '2',
    icon: Sliders,
    title: 'See yourself',
    description: 'Get a personalized profile that captures how you really travel. Your strengths, your preferences, your perfect trip preview.',
    highlight: 'Personalized profile',
  },
  {
    number: '3',
    icon: MapPin,
    title: 'Get matched trips',
    description: 'We build itineraries designed around your DNA - not generic templates. Every recommendation fits your pace, style, and interests.',
    highlight: 'Custom itineraries',
  },
  {
    number: '4',
    icon: RefreshCw,
    title: 'Refine over time',
    description: "Your Travel DNA evolves. Rate activities, save favorites, and watch your profile and recommendations get even more accurate.",
    highlight: 'Learns from you',
  },
];

export default function DNAHowItWorks() {
  return (
    <section className="py-14 sm:py-20 md:py-24 bg-muted/30 relative overflow-hidden">
      {/* Top curved divider */}
      <div className="absolute top-0 left-0 right-0 h-24 -translate-y-full">
        <svg viewBox="0 0 1440 96" fill="none" className="absolute bottom-0 w-full h-24" preserveAspectRatio="none">
          <path d="M0 96L1440 96L1440 0C1440 0 1080 96 720 96C360 96 0 0 0 0L0 96Z" className="fill-muted/30" />
        </svg>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 md:px-16">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-16"
        >
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4">
            <div className="w-6 sm:w-8 h-px bg-primary" />
            <span className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
              The Process
            </span>
            <div className="w-6 sm:w-8 h-px bg-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-normal text-foreground">
            How it <em className="font-normal">works</em>
          </h2>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
          {STEPS.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group"
            >
              <div className="bg-card border border-border rounded-xl p-6 h-full hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                {/* Step Number & Icon */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-4xl font-serif text-muted-foreground/30 font-light">
                    {step.number}
                  </span>
                </div>

                {/* Highlight Badge */}
                <div className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full mb-4">
                  {step.highlight}
                </div>

                {/* Title */}
                <h3 className="text-xl font-serif font-semibold text-foreground mb-3">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground font-sans text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <Button asChild size="lg" variant="outline" className="font-sans">
            <Link to={ROUTES.START}>
              Start with the Quiz
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
