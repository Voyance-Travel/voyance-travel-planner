import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Dna, Sliders, Sparkles } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/routes';
import { ARCHETYPE_NARRATIVES, CATEGORY_DESCRIPTIONS, type ArchetypeNarrative } from '@/data/archetypeNarratives';
import React from 'react';

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
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.02, duration: 0.4 }}
      className="group"
    >
      <div className="relative bg-card rounded-xl border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5 h-full">
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">{archetype.emoji}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-serif font-semibold text-foreground leading-tight">
                {archetype.name}
              </h3>
              <span className="text-xs text-muted-foreground">
                {CATEGORY_DESCRIPTIONS[archetype.category].name}
              </span>
            </div>
          </div>

          {/* Hook line */}
          <p className="text-sm text-foreground/80 italic mb-3 line-clamp-2">
            "{archetype.hookLine}"
          </p>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {archetype.coreDescription}
          </p>
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
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        }`}
      >
        All Types
      </button>
      {CATEGORY_ORDER.map((category) => {
        const isActive = activeCategory === category;
        return (
          <button
            key={category}
            onClick={() => onSelect(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
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
      <section className="pt-24 pb-12 md:pt-32 md:pb-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-background" />
        
        <div className="max-w-4xl mx-auto px-4 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Dna className="w-3 h-3 mr-1" />
              Travel DNA System
            </Badge>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground mb-5 leading-[1.1]">
              Twenty-Seven Ways<br />
              <span className="text-primary">to See the World</span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              Everyone travels differently. We've mapped 27 distinct traveler personalities—each 
              with unique strengths, preferences, and ideal adventures.
            </p>
            
            <Button asChild size="lg" className="rounded-full px-8">
              <Link to={ROUTES.QUIZ}>
                Discover Your Type
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* How We Match You - Brief Explainer */}
      <section className="py-12 border-y border-border bg-muted/20">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-6 text-center"
          >
            {[
              {
                icon: Sparkles,
                title: '8 Core Traits',
                description: 'We measure planning style, social energy, pace, adventure tolerance, and more to build your profile.',
              },
              {
                icon: Sliders,
                title: 'Weighted Matching',
                description: 'Your quiz responses are scored against each archetype to find the personality that fits best.',
              },
              {
                icon: Dna,
                title: 'Personalized Plans',
                description: 'Your archetype shapes every recommendation—from destinations to daily itineraries.',
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-4"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium text-foreground mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Category Navigation */}
      <section className="py-6 sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4">
          <CategoryNav activeCategory={activeCategory} onSelect={setActiveCategory} />
        </div>
      </section>

      {/* Category Description (when filtered) */}
      {activeCategory && (
        <motion.section 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="py-6 bg-muted/20"
        >
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-xl font-serif font-semibold text-foreground mb-2">
              {CATEGORY_DESCRIPTIONS[activeCategory as keyof typeof CATEGORY_DESCRIPTIONS].name}s
            </h2>
            <p className="text-muted-foreground text-sm">
              {CATEGORY_DESCRIPTIONS[activeCategory as keyof typeof CATEGORY_DESCRIPTIONS].description}
            </p>
          </div>
        </motion.section>
      )}

      {/* Archetypes Grid */}
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div 
            layout
            className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
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

      {/* CTA */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
              Which archetype are you?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Take our 2-minute quiz. We'll match your personality to one of 27 archetypes 
              and build trips that actually fit how you travel.
            </p>
            <Button asChild size="lg" className="rounded-full px-8">
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
