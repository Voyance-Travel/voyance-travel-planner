import { motion } from 'framer-motion';
import { Leaf, Check, Sparkles, ArrowRight, Snail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

const SAMPLE_ARCHETYPE = {
  name: 'The Slow Traveler',
  category: 'RESTORER',
  iconName: 'Snail',
  hookLine: 'Stay long enough to have a favorite café.',
  coreDescription: 
    "You resist the urge to rush. While others check boxes, you put down roots. You understand that knowing a place takes time, and you have all the time in the world.",
  whatThisMeans: [
    "You rent apartments, not hotel rooms",
    "You grocery shop like a local",
    "Your neighbors wave hello",
    "You've made friends you visit yearly"
  ],
  perfectTripPreview: "Three months in Lisbon: your own flat, a regular café, and feeling like a local.",
  traitScores: {
    pace: 15,
    authenticity: 85,
    planning: 60,
    comfort: 70,
  }
};

export default function SampleArchetype() {
  return (
    <section id="sample-archetype" className="py-20 md:py-24 bg-background relative overflow-hidden">
      {/* Top fade transition from hero */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/5 to-transparent pointer-events-none" />
      
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.015]">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '48px 48px' }} />
      </div>
      
      {/* Decorative side accent */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-48 bg-gradient-to-b from-transparent via-primary/20 to-transparent hidden lg:block" />

      <div className="max-w-6xl mx-auto px-8 md:px-16">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-8 h-px bg-primary" />
            <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
              Sample Result
            </span>
            <div className="w-8 h-px bg-primary" />
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-normal text-foreground mb-4">
            See yourself in your <em className="font-normal">Travel DNA</em>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto font-sans">
            Here's what one of our 27 archetypes looks like. Yours will be uniquely you.
          </p>
        </motion.div>

        {/* Archetype Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-8 md:p-12 border-b border-border">
              <div className="flex items-start gap-6">
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                  <Snail className="w-8 h-8 text-white" />
                </div>
                
                <div className="flex-1">
                  {/* Category badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <Leaf className="w-4 h-4 text-primary" />
                    <span className="text-xs tracking-wider uppercase text-primary font-medium">
                      {SAMPLE_ARCHETYPE.category}
                    </span>
                  </div>
                  
                  {/* Name */}
                  <h3 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-2">
                    {SAMPLE_ARCHETYPE.name}
                  </h3>
                  
                  {/* Hook line */}
                  <p className="text-lg text-muted-foreground italic font-serif">
                    "{SAMPLE_ARCHETYPE.hookLine}"
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-10">
                {/* Left: Description */}
                <div>
                  <p className="text-foreground text-lg leading-relaxed mb-8 font-sans">
                    {SAMPLE_ARCHETYPE.coreDescription}
                  </p>

                  {/* What this means */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                      What this means for you
                    </h4>
                    <ul className="space-y-3">
                      {SAMPLE_ARCHETYPE.whatThisMeans.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-foreground font-sans">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right: Perfect Trip + Traits */}
                <div>
                  {/* Perfect Trip Preview */}
                  <div className="bg-muted/50 rounded-xl p-6 mb-8 border border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Your Perfect Trip
                      </span>
                    </div>
                    <p className="text-foreground font-serif italic text-lg">
                      "{SAMPLE_ARCHETYPE.perfectTripPreview}"
                    </p>
                  </div>

                  {/* Trait Bars */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                      Key Traits
                    </h4>
                    {Object.entries(SAMPLE_ARCHETYPE.traitScores).map(([trait, score]) => (
                      <div key={trait}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground capitalize font-sans">{trait}</span>
                          <span className="text-foreground font-medium">{score}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${score}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: 0.5 }}
                            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer CTA */}
            <div className="bg-muted/30 border-t border-border p-8 text-center">
              <p className="text-muted-foreground mb-4 font-sans">
                Ready to discover your Travel DNA?
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" className="font-sans">
                  <Link to={ROUTES.ARCHETYPES}>
                    Explore All 27 Archetypes
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="font-sans">
                  <Link to={ROUTES.QUIZ}>
                    Take the Quiz
                    <Sparkles className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
