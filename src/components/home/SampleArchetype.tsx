import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, Compass, Leaf, Palette, Heart, Mountain, Camera, Map } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { useRef } from 'react';

// Sample archetypes for the carousel (6-8 featured)
const FEATURED_ARCHETYPES = [
  {
    id: 'slow_traveler',
    name: 'Slow Traveler',
    tagline: 'Stay long enough to have a favorite café',
    icon: Leaf,
    category: 'RESTORER',
    traits: [
      { name: 'Pace', value: 15 },
      { name: 'Authenticity', value: 85 },
      { name: 'Spontaneity', value: 60 },
    ],
  },
  {
    id: 'adrenaline_architect',
    name: 'Adrenaline Architect',
    tagline: 'If it scares you, it should be on the list',
    icon: Zap,
    category: 'EXPLORER',
    traits: [
      { name: 'Pace', value: 95 },
      { name: 'Adventure', value: 90 },
      { name: 'Planning', value: 75 },
    ],
  },
  {
    id: 'culture_curator',
    name: 'Culture Curator',
    tagline: 'Museums before monuments, always',
    icon: Palette,
    category: 'CURATOR',
    traits: [
      { name: 'Depth', value: 90 },
      { name: 'Culture', value: 95 },
      { name: 'Comfort', value: 65 },
    ],
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    tagline: 'You collect friends, not souvenirs',
    icon: Heart,
    category: 'CONNECTOR',
    traits: [
      { name: 'Social', value: 95 },
      { name: 'Flexibility', value: 80 },
      { name: 'Spontaneity', value: 85 },
    ],
  },
  {
    id: 'bucket_list_conqueror',
    name: 'Bucket List Conqueror',
    tagline: 'Sleep when you are home',
    icon: Mountain,
    category: 'ACHIEVER',
    traits: [
      { name: 'Pace', value: 90 },
      { name: 'Ambition', value: 95 },
      { name: 'Planning', value: 85 },
    ],
  },
  {
    id: 'flexible_wanderer',
    name: 'Flexible Wanderer',
    tagline: 'Plans are just suggestions',
    icon: Compass,
    category: 'EXPLORER',
    traits: [
      { name: 'Spontaneity', value: 95 },
      { name: 'Flexibility', value: 90 },
      { name: 'Comfort', value: 50 },
    ],
  },
  {
    id: 'memory_maker',
    name: 'Memory Maker',
    tagline: 'Every photo tells a story',
    icon: Camera,
    category: 'CURATOR',
    traits: [
      { name: 'Documentation', value: 90 },
      { name: 'Planning', value: 70 },
      { name: 'Authenticity', value: 75 },
    ],
  },
  {
    id: 'balanced_explorer',
    name: 'Balanced Explorer',
    tagline: 'A little bit of everything, done well',
    icon: Map,
    category: 'TRANSFORMER',
    traits: [
      { name: 'Balance', value: 80 },
      { name: 'Flexibility', value: 75 },
      { name: 'Comfort', value: 70 },
    ],
  },
];

function ArchetypeCard({ archetype }: { archetype: typeof FEATURED_ARCHETYPES[0] }) {
  const Icon = archetype.icon;
  
  return (
    <div className="flex-shrink-0 w-64 sm:w-72 bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-300 group">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-border/50">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:from-primary/30 group-hover:to-accent/30 transition-colors">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] tracking-wider uppercase text-muted-foreground font-medium">
              {archetype.category}
            </span>
            <h3 className="text-base font-semibold text-foreground leading-tight">
              {archetype.name}
            </h3>
          </div>
        </div>
        <p className="text-sm text-muted-foreground italic line-clamp-2">
          "{archetype.tagline}"
        </p>
      </div>
      
      {/* Trait bars */}
      <div className="p-4 space-y-3">
        {archetype.traits.map((trait) => (
          <div key={trait.name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{trait.name}</span>
              <span className="text-foreground font-medium">{trait.value}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                style={{ width: `${trait.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SampleArchetype() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section id="sample-archetype" className="py-14 sm:py-20 md:py-24 bg-background relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.015]">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 md:px-16">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-12"
        >
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4">
            <div className="w-6 sm:w-8 h-px bg-primary" />
            <span className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
              Travel DNA
            </span>
            <div className="w-6 sm:w-8 h-px bg-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-normal text-foreground mb-3 sm:mb-4">
            What Kind of Traveler Are You?
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto font-sans">
            Explore our 27 unique archetypes. See which one resonates with you.
          </p>
        </motion.div>

        {/* Horizontal Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="relative mb-10"
        >
          {/* Scroll container */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {FEATURED_ARCHETYPES.map((archetype) => (
              <div key={archetype.id} className="snap-start">
                <ArchetypeCard archetype={archetype} />
              </div>
            ))}
          </div>
          
          {/* Fade edges for scroll indication - z-index lower than button */}
          <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-background to-transparent pointer-events-none z-0" />
          <div className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none z-0" />
        </motion.div>

        {/* See all link - More prominent */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-center mb-10"
        >
          <Link 
            to={ROUTES.ARCHETYPES}
            className="relative z-10 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-primary/30 bg-primary/5 text-primary font-medium text-sm hover:bg-primary/10 hover:border-primary/50 transition-all"
          >
            See all 27 archetypes
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Primary Quiz CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border border-primary/20 rounded-2xl p-6 sm:p-8 md:p-10 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary uppercase tracking-wider">
              Discover Yours
            </span>
          </div>
          
          <h3 className="text-xl sm:text-2xl md:text-3xl font-serif text-foreground mb-3">
            Not sure which one you are?
          </h3>
          
          <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm sm:text-base">
            Self-selection doesn't work for 27 archetypes. Take the quiz and let us match you perfectly.
          </p>
          
          <Button asChild size="lg" className="font-sans text-base px-8">
            <Link to={ROUTES.QUIZ}>
              Take the 5-Minute Quiz
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          
          <p className="text-xs text-muted-foreground mt-4">
            21 questions. No account required. Your Travel DNA awaits.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
