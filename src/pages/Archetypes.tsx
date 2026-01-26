import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Compass, Users, Trophy, Leaf, Gem, Sparkles, ArrowRight } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { ARCHETYPE_NARRATIVES, CATEGORY_COLORS, CATEGORY_DESCRIPTIONS, type ArchetypeNarrative } from '@/data/archetypeNarratives';

const CATEGORY_ICONS = {
  EXPLORER: Compass,
  CONNECTOR: Users,
  ACHIEVER: Trophy,
  RESTORER: Leaf,
  CURATOR: Gem,
  TRANSFORMER: Sparkles,
};

const CATEGORY_ORDER = ['EXPLORER', 'CONNECTOR', 'ACHIEVER', 'RESTORER', 'CURATOR', 'TRANSFORMER'] as const;

// Featured archetypes to showcase (curated selection)
const FEATURED_ARCHETYPE_IDS = [
  'cultural_anthropologist', 'urban_nomad', 'wilderness_pioneer', 'digital_explorer',
  'social_butterfly', 'family_architect', 'romantic_curator', 'story_seeker',
  'bucket_list_conqueror', 'adrenaline_architect', 'collection_curator',
  'zen_seeker', 'slow_traveler', 'beach_therapist', 'sanctuary_seeker',
  'culinary_cartographer', 'luxury_luminary', 'art_aficionado', 'eco_ethicist',
  'gap_year_graduate', 'midlife_explorer', 'healing_journeyer',
];

function ArchetypeCard({ archetype, index }: { archetype: ArchetypeNarrative; index: number }) {
  const categoryStyle = CATEGORY_COLORS[archetype.category];

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.03, duration: 0.5 }}
      className="group"
    >
      <div className="relative bg-card rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-primary/20 hover:-translate-y-1">
        {/* Gradient accent bar */}
        <div className={`h-1 bg-gradient-to-r ${categoryStyle.primary}`} />
        
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{archetype.emoji}</span>
              <div>
                <h3 className="font-serif font-bold text-lg text-foreground leading-tight">
                  {archetype.name}
                </h3>
                <span className={`text-xs font-medium ${categoryStyle.text}`}>
                  {CATEGORY_DESCRIPTIONS[archetype.category].name}
                </span>
              </div>
            </div>
          </div>

          {/* Hook line */}
          <blockquote className="text-foreground font-medium italic border-l-2 border-primary/30 pl-3 mb-4">
            "{archetype.hookLine}"
          </blockquote>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            {archetype.coreDescription}
          </p>

          {/* Perfect trip */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Perfect trip:</span>{' '}
              {archetype.perfectTripPreview}
            </p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function CategoryNav({ activeCategory, onSelect }: { activeCategory: string | null; onSelect: (cat: string | null) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
          activeCategory === null
            ? 'bg-foreground text-background'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        }`}
      >
        All Types
      </button>
      {CATEGORY_ORDER.map((category) => {
        const Icon = CATEGORY_ICONS[category];
        const style = CATEGORY_COLORS[category];
        const isActive = activeCategory === category;
        return (
          <button
            key={category}
            onClick={() => onSelect(category)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              isActive
                ? `bg-gradient-to-r ${style.primary} text-white`
                : `${style.bg} ${style.text} hover:opacity-80`
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {CATEGORY_DESCRIPTIONS[category].name}
          </button>
        );
      })}
    </div>
  );
}

export default function Archetypes() {
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  // Get filtered archetypes
  const filteredArchetypes = FEATURED_ARCHETYPE_IDS
    .map(id => ARCHETYPE_NARRATIVES[id])
    .filter(a => a && (activeCategory === null || a.category === activeCategory));

  return (
    <MainLayout>
      {/* Hero */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-20 relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/40 via-background to-background" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
        
        <div className="max-w-4xl mx-auto px-4 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-sm font-medium text-primary tracking-wide uppercase mb-4"
            >
              Travel DNA System
            </motion.p>
            
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-foreground mb-6 leading-[1.1]">
              Twenty-Seven Ways<br />
              <span className="text-primary">to See the World</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              Everyone travels differently. We've identified 27 distinct traveler personalities—each 
              with unique superpowers, blind spots, and perfect adventures.
            </p>
            
            <Button asChild size="lg" className="rounded-full px-8">
              <Link to={ROUTES.QUIZ}>
                Discover Yours
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Category Navigation */}
      <section className="py-8 border-y border-border bg-muted/20 sticky top-16 z-40 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <CategoryNav activeCategory={activeCategory} onSelect={setActiveCategory} />
          </motion.div>
        </div>
      </section>

      {/* Category Description (when filtered) */}
      {activeCategory && (
        <motion.section 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="py-8 bg-gradient-to-r from-background via-muted/30 to-background"
        >
          <div className="max-w-3xl mx-auto px-4 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              {(() => {
                const Icon = CATEGORY_ICONS[activeCategory as keyof typeof CATEGORY_ICONS];
                const style = CATEGORY_COLORS[activeCategory as keyof typeof CATEGORY_COLORS];
                return (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br ${style.primary}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                );
              })()}
              <h2 className="text-2xl font-serif font-bold text-foreground">
                {CATEGORY_DESCRIPTIONS[activeCategory as keyof typeof CATEGORY_DESCRIPTIONS].name}s
              </h2>
            </div>
            <p className="text-muted-foreground">
              {CATEGORY_DESCRIPTIONS[activeCategory as keyof typeof CATEGORY_DESCRIPTIONS].description}
            </p>
          </div>
        </motion.section>
      )}

      {/* Archetypes Grid */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div 
            layout
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredArchetypes.map((archetype, index) => (
              <ArchetypeCard key={archetype.id} archetype={archetype} index={index} />
            ))}
          </motion.div>
          
          {filteredArchetypes.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No archetypes found in this category.</p>
            </div>
          )}
        </div>
      </section>

      {/* Editorial CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">
              Which archetype are you?
            </h2>
            <p className="text-lg text-white/60 mb-8 max-w-xl mx-auto">
              Take our 2-minute quiz. We'll match your personality to one of 27 archetypes 
              and build trips that actually fit how you travel.
            </p>
            <Button asChild size="lg" className="rounded-full px-8 bg-white text-slate-900 hover:bg-white/90">
              <Link to={ROUTES.QUIZ}>
                Take the Quiz
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}

// Need React for useState
import React from 'react';
