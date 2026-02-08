import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Dna, Sparkles, Sliders, RefreshCw, MapPin } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/routes';
import { ARCHETYPE_NARRATIVES, CATEGORY_DESCRIPTIONS, type ArchetypeNarrative } from '@/data/archetypeNarratives';
import React from 'react';

const CATEGORY_ORDER = ['EXPLORER', 'CONNECTOR', 'ACHIEVER', 'RESTORER', 'CURATOR', 'TRANSFORMER'] as const;

// All 27 archetypes grouped by category for organized display
const ARCHETYPES_BY_CATEGORY: Record<string, string[]> = {
  EXPLORER: ['cultural_anthropologist', 'urban_nomad', 'wilderness_pioneer', 'digital_explorer'],
  CONNECTOR: ['social_butterfly', 'family_architect', 'romantic_curator', 'story_seeker'],
  ACHIEVER: ['bucket_list_conqueror', 'adrenaline_architect', 'collection_curator', 'status_seeker'],
  RESTORER: ['zen_seeker', 'slow_traveler', 'beach_therapist', 'sanctuary_seeker', 'escape_artist', 'retreat_regular'],
  CURATOR: ['culinary_cartographer', 'luxury_luminary', 'art_aficionado', 'eco_ethicist'],
  TRANSFORMER: ['gap_year_graduate', 'midlife_explorer', 'healing_journeyer', 'sabbatical_scholar', 'retirement_ranger'],
};

// Featured archetypes for the hero spotlight
const SPOTLIGHT_ARCHETYPES = ['cultural_anthropologist', 'adrenaline_architect', 'culinary_cartographer'];

function SpotlightCard({ archetype, index }: { archetype: ArchetypeNarrative; index: number }) {
  const isCenter = index === 1;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.15, duration: 0.6 }}
      className={`relative ${isCenter ? 'md:-mt-4 md:scale-105 z-10' : 'opacity-90'}`}
    >
      <div className={`bg-card rounded-2xl border ${isCenter ? 'border-primary/30 shadow-xl shadow-primary/10' : 'border-border'} overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}>
        {/* Gradient top accent */}
        <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
        
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{archetype.emoji}</span>
            <div>
              <h3 className="font-serif font-bold text-lg text-foreground">{archetype.name}</h3>
              <span className="text-xs text-primary font-medium">
                {CATEGORY_DESCRIPTIONS[archetype.category].name}
              </span>
            </div>
          </div>
          
          <p className="text-foreground/80 italic text-sm mb-3 leading-relaxed">
            "{archetype.hookLine}"
          </p>
          
          <p className="text-sm text-muted-foreground line-clamp-3">
            {archetype.coreDescription}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function ArchetypeCard({ archetype, index }: { archetype: ArchetypeNarrative; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ delay: index * 0.03, duration: 0.4 }}
      className="group"
    >
      <div className="relative bg-card rounded-xl border border-border p-5 h-full transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5">
        {/* Subtle hover glow */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="relative">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl group-hover:scale-110 transition-transform duration-300">{archetype.emoji}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-serif font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
                {archetype.name}
              </h3>
            </div>
          </div>

          <p className="text-sm text-foreground/70 italic mb-2 line-clamp-2">
            "{archetype.hookLine}"
          </p>

          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {archetype.coreDescription}
          </p>
        </div>
      </div>
    </motion.article>
  );
}

function CategorySection({ category, archetypeIds, categoryIndex }: { 
  category: string; 
  archetypeIds: string[];
  categoryIndex: number;
}) {
  const archetypes = archetypeIds
    .map(id => ARCHETYPE_NARRATIVES[id])
    .filter(Boolean);
  
  const isEven = categoryIndex % 2 === 0;
  
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      className={`py-12 ${isEven ? '' : 'bg-muted/30'}`}
    >
      <div className="max-w-6xl mx-auto px-4">
        {/* Category header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-primary rounded-full" />
            <h2 className="text-2xl font-serif font-bold text-foreground">
              {CATEGORY_DESCRIPTIONS[category as keyof typeof CATEGORY_DESCRIPTIONS].name}s
            </h2>
          </div>
          <div className="hidden md:block flex-1 h-px bg-border" />
        </motion.div>
        
        {/* Category description */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-muted-foreground mb-8 max-w-2xl"
        >
          {CATEGORY_DESCRIPTIONS[category as keyof typeof CATEGORY_DESCRIPTIONS].description}
        </motion.p>
        
        {/* Archetypes grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {archetypes.map((archetype, index) => (
            <ArchetypeCard key={archetype.id} archetype={archetype} index={index} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

export default function Archetypes() {
  const spotlightArchetypes = SPOTLIGHT_ARCHETYPES
    .map(id => ARCHETYPE_NARRATIVES[id])
    .filter(Boolean);

  return (
    <MainLayout>
      <Head
        title="Travel Archetypes | Voyance - Discover Your Travel DNA"
        description="Explore 27 unique traveler personalities and discover which one matches your travel style. From Cultural Anthropologists to Adrenaline Architects, find your travel DNA."
        canonical="https://travelwithvoyance.com/archetypes"
      />
      {/* Hero with spotlight cards */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-20 relative overflow-hidden">
        {/* Warm gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/2" />
        <div className="absolute top-32 right-1/4 w-[300px] h-[300px] bg-accent/10 rounded-full blur-[100px]" />
        
        <div className="max-w-5xl mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6"
            >
              <Dna className="w-4 h-4" />
              Travel DNA System
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground mb-5 leading-[1.1]">
              Twenty-Seven Ways<br />
              <span className="text-primary italic">to See the World</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Everyone travels differently. Discover which of our 27 traveler personalities 
              captures how <em>you</em> explore - and unlock trips designed around it.
            </p>
          </motion.div>

          {/* Spotlight cards */}
          <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-10">
            {spotlightArchetypes.map((archetype, index) => (
              <SpotlightCard key={archetype.id} archetype={archetype} index={index} />
            ))}
          </div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center"
          >
            <Button asChild size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20">
              <Link to={ROUTES.QUIZ}>
                <Sparkles className="w-4 h-4 mr-2" />
                Discover Your Type
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* How It Works - The DNA Methodology */}
      <section className="py-16 bg-muted/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Sliders className="w-3 h-3 mr-1" />
              The Science Behind It
            </Badge>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">
              How We Match You
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Your archetype isn't random. It's the result of a careful analysis of how you actually travel.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6 mb-10">
            {[
              {
                icon: Sparkles,
                title: '8 Core Traits',
                description: 'We measure planning style, social energy, pace, adventure tolerance, budget mindset, and more.',
              },
              {
                icon: Dna,
                title: 'Quiz Analysis',
                description: 'Your answers build a trait profile that captures your authentic travel personality.',
              },
              {
                icon: Sliders,
                title: 'Archetype Matching',
                description: 'We score your profile against all 27 archetypes to find your best fit.',
              },
              {
                icon: MapPin,
                title: 'Personalized Trips',
                description: 'Your archetype shapes every recommendation: destinations, pace, activities, dining.',
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Beyond 27 - Deeper personalization */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 rounded-2xl p-8 max-w-3xl mx-auto"
          >
            <div className="text-center mb-6">
              <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">
                Beyond the 27
              </Badge>
              <h3 className="text-xl font-serif font-bold text-foreground mb-2">
                Your Archetype Is Just the Beginning
              </h3>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Once we place you in one of 27 archetypes, we don't stop there. Your preferences, 
                adjustments, and feedback shape every itinerary to fit <em>you</em> specifically.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-card/50 rounded-xl p-4 border border-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground">Continuous Learning</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Rate activities, save favorites, adjust preferences. The more you use Voyance, 
                  the better we know you.
                </p>
              </div>
              
              <div className="bg-card/50 rounded-xl p-4 border border-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground">Your Travel Agent</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Eventually, you have a travel agent in your pocket. One that knows you and plans 
                  trips for you, and only you...
                </p>
              </div>
            </div>
            
            <div className="text-center pt-4 border-t border-border/50">
              <p className="text-sm text-foreground/80 italic">
                ...unless you bring a friend. Invite someone, and we'll blend both profiles 
                to plan trips that work for everyone.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Category sections */}
      {CATEGORY_ORDER.map((category, index) => (
        <CategorySection
          key={category}
          category={category}
          archetypeIds={ARCHETYPES_BY_CATEGORY[category]}
          categoryIndex={index}
        />
      ))}

      {/* Don't see yourself? - Edge case callout */}
      <section className="py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto text-center"
        >
          <h3 className="text-xl font-serif font-bold text-foreground mb-3">
            Don't see yourself?
          </h3>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Your Travel DNA is unique. Take the quiz. You might be a blend of multiple archetypes, 
            with hints of personalities that make you one of a kind.
          </p>
          <Button asChild variant="outline" className="rounded-full px-6">
            <Link to={ROUTES.QUIZ}>
              Take the Quiz
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        
        <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">
              Ready to find yours?
            </h2>
            <p className="text-lg text-white/60 mb-8 max-w-xl mx-auto">
              Take our 5-minute quiz. We'll match you to your archetype and start 
              building trips that actually fit how you travel.
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
