import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, Compass, Leaf, Palette, Heart, Mountain, Camera, Map } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { useRef } from 'react';

// Sample archetypes for the carousel (6-8 featured)
const FEATURED_ARCHETYPES = [
  {
    id: 'slow_traveler',
    name: 'Present Traveler',
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
    name: 'Connection Curator',
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
    name: 'Milestone Voyager',
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
    <div className="flex-shrink-0 w-[280px] sm:w-64 md:w-72 bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-300 group">
      {/* Header */}
      <div className="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-border/50">
        <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:from-primary/30 group-hover:to-accent/30 transition-colors">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] sm:text-[10px] tracking-wider uppercase text-muted-foreground font-medium">
              {archetype.category}
            </span>
            <h3 className="text-sm sm:text-base font-semibold text-foreground leading-tight">
              {archetype.name}
            </h3>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground italic line-clamp-2">
          "{archetype.tagline}"
        </p>
      </div>
      
      {/* Trait bars */}
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
        {archetype.traits.map((trait) => (
          <div key={trait.name}>
            <div className="flex justify-between text-[10px] sm:text-xs mb-1">
              <span className="text-muted-foreground">{trait.name}</span>
              <span className="text-foreground font-medium">{trait.value}%</span>
            </div>
            <div className="h-1 sm:h-1.5 bg-muted rounded-full overflow-hidden">
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
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section id="sample-archetype" className="py-10 sm:py-14 md:py-20 lg:py-24 bg-background relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.015]">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 md:px-16">
        {/* Section Header - mobile-optimized */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6 sm:mb-10 md:mb-12"
        >
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-3 sm:mb-4">
            <div className="w-4 sm:w-8 h-px bg-primary" />
            <span className="text-[9px] sm:text-xs tracking-[0.2em] sm:tracking-[0.25em] uppercase text-muted-foreground font-sans">
              Travel DNA
            </span>
            <div className="w-4 sm:w-8 h-px bg-primary" />
          </div>
          <h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-serif font-normal text-foreground mb-2 sm:mb-4 px-2">
            What Kind of Traveler Are You?
          </h2>
          <p className="text-xs sm:text-base text-muted-foreground max-w-lg mx-auto font-sans px-4">
            Explore our 29 unique archetypes. See which one resonates.
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
          <button 
            onClick={() => navigate(ROUTES.ARCHETYPES)}
            className="relative z-10 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-primary/30 bg-primary/5 text-primary font-medium text-sm hover:bg-primary/10 hover:border-primary/50 transition-all"
          >
            See all 29 archetypes
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        {/* Quiz CTA removed */}
      </div>
    </section>
  );
}
