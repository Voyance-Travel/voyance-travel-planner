import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Compass, Users, Trophy, Leaf, Gem, Sparkles, ArrowRight, Dna } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
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

// Featured archetypes to showcase (curated selection of ~20)
const FEATURED_ARCHETYPE_IDS = [
  // EXPLORER
  'cultural_anthropologist',
  'urban_nomad',
  'wilderness_pioneer',
  'digital_explorer',
  // CONNECTOR
  'social_butterfly',
  'family_architect',
  'romantic_curator',
  'story_seeker',
  // ACHIEVER
  'bucket_list_conqueror',
  'adrenaline_architect',
  'collection_curator',
  // RESTORER
  'zen_seeker',
  'slow_traveler',
  'beach_therapist',
  'sanctuary_seeker',
  // CURATOR
  'culinary_cartographer',
  'luxury_luminary',
  'art_aficionado',
  'eco_ethicist',
  // TRANSFORMER
  'gap_year_graduate',
  'midlife_explorer',
  'healing_journeyer',
];

function ArchetypeCard({ archetype }: { archetype: ArchetypeNarrative }) {
  const categoryStyle = CATEGORY_COLORS[archetype.category];
  const CategoryIcon = CATEGORY_ICONS[archetype.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`rounded-xl border p-5 transition-all hover:shadow-md ${categoryStyle.border} ${categoryStyle.bg}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl">{archetype.emoji}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{archetype.name}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <CategoryIcon className={`w-3 h-3 ${categoryStyle.text}`} />
            <span className={`text-xs ${categoryStyle.text}`}>
              {CATEGORY_DESCRIPTIONS[archetype.category].name}
            </span>
          </div>
        </div>
      </div>
      
      <p className="text-sm font-medium text-foreground italic mb-2">
        "{archetype.hookLine}"
      </p>
      
      <p className="text-sm text-muted-foreground line-clamp-3">
        {archetype.coreDescription}
      </p>
      
      <div className="mt-4 pt-3 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Perfect trip:</span> {archetype.perfectTripPreview}
        </p>
      </div>
    </motion.div>
  );
}

export default function Archetypes() {
  // Group archetypes by category
  const archetypesByCategory = CATEGORY_ORDER.reduce((acc, category) => {
    const archetypes = FEATURED_ARCHETYPE_IDS
      .map(id => ARCHETYPE_NARRATIVES[id])
      .filter(a => a && a.category === category);
    if (archetypes.length > 0) {
      acc[category] = archetypes;
    }
    return acc;
  }, {} as Record<string, ArchetypeNarrative[]>);

  return (
    <MainLayout>
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-muted/50 to-background">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Dna className="w-3 h-3 mr-1" />
              Travel DNA
            </Badge>
            <h1 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4">
              27 Ways to Travel
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Everyone travels differently. Our Travel DNA system identifies your unique style 
              from 27 distinct archetypes—each with its own superpowers, preferences, and perfect trip.
            </p>
            <Button asChild size="lg">
              <Link to={ROUTES.QUIZ}>
                Discover Your Archetype
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Category Overview */}
      <section className="py-12 border-b border-border">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {CATEGORY_ORDER.map((category) => {
              const Icon = CATEGORY_ICONS[category];
              const style = CATEGORY_COLORS[category];
              const desc = CATEGORY_DESCRIPTIONS[category];
              return (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className={`rounded-xl p-4 text-center ${style.bg} ${style.border} border`}
                >
                  <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center bg-gradient-to-br ${style.primary}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className={`font-semibold text-sm ${style.text}`}>{desc.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {desc.keyTraits[0]}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Archetypes by Category */}
      {CATEGORY_ORDER.map((category) => {
        const archetypes = archetypesByCategory[category];
        if (!archetypes || archetypes.length === 0) return null;
        
        const Icon = CATEGORY_ICONS[category];
        const style = CATEGORY_COLORS[category];
        const desc = CATEGORY_DESCRIPTIONS[category];

        return (
          <section key={category} className="py-12 border-b border-border last:border-b-0">
            <div className="max-w-6xl mx-auto px-4">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="mb-8"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${style.primary}`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-serif font-bold text-foreground">
                    {desc.name}s
                  </h2>
                </div>
                <p className="text-muted-foreground max-w-2xl">
                  {desc.description}
                </p>
              </motion.div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {archetypes.map((archetype) => (
                  <ArchetypeCard key={archetype.id} archetype={archetype} />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* CTA */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
              Which One Are You?
            </h2>
            <p className="text-muted-foreground mb-6">
              Take our 2-minute quiz to discover your Travel DNA archetype and get personalized trip recommendations.
            </p>
            <Button asChild size="lg">
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
