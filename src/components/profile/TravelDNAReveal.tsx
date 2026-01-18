import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Star, 
  Zap, 
  Heart, 
  TrendingUp,
  ChevronRight,
  RefreshCw,
  Award
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ROUTES } from '@/config/routes';
import { 
  getArchetypeNarrative, 
  getCategoryColors, 
  type ArchetypeNarrative 
} from '@/data/archetypeNarratives';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { isDemoModeEnabled } from '@/contexts/AuthContext';

interface TravelDNARevealProps {
  userId: string;
  className?: string;
}

interface TravelDNAData {
  primary_archetype_name: string | null;
  secondary_archetype_name: string | null;
  dna_confidence_score: number | null;
  dna_rarity: string | null;
  trait_scores: unknown;
  tone_tags: string[] | null;
  emotional_drivers: string[] | null;
  summary: string | null;
}

// Demo DNA data for preview mode
const DEMO_DNA_DATA: TravelDNAData = {
  primary_archetype_name: 'cultural_anthropologist',
  secondary_archetype_name: 'slow_traveler',
  dna_confidence_score: 92,
  dna_rarity: 'Uncommon',
  trait_scores: {
    adventure: 65,
    culture: 95,
    relaxation: 45,
    luxury: 55,
    social: 70,
    culinary: 85,
    wellness: 40,
  },
  tone_tags: ['culture', 'culinary', 'adventure', 'social'],
  emotional_drivers: ['understanding', 'connection', 'authenticity', 'growth'],
  summary: 'As a Cultural Anthropologist, you prefer immersive travel experiences with a focus on authentic local connections. Your travel personality reflects someone who values deep cultural understanding over surface-level tourism.',
};

export default function TravelDNAReveal({ userId, className }: TravelDNARevealProps) {
  const [dnaData, setDnaData] = useState<TravelDNAData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('identity');
  const isDemo = isDemoModeEnabled();

  useEffect(() => {
    async function loadDNA() {
      // Use demo data in demo mode
      if (isDemo || userId === 'demo-user-001') {
        setDnaData(DEMO_DNA_DATA);
        setIsLoading(false);
        return;
      }

      if (!userId) return;
      
      try {
        const { data, error } = await supabase
          .from('travel_dna_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (error) throw error;
        setDnaData(data);
      } catch (error) {
        console.error('Failed to load travel DNA:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadDNA();
  }, [userId, isDemo]);

  if (isLoading) {
    return (
      <div className={cn("bg-card rounded-xl border border-border p-8", className)}>
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!dnaData?.primary_archetype_name) {
    return (
      <div className={cn("bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl border border-border p-8", className)}>
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
            Discover Your Travel DNA
          </h3>
          <p className="text-muted-foreground mb-6">
            Take our quick quiz to uncover your unique travel personality. 
            It's like a horoscope, but for wanderlust.
          </p>
          <Button asChild size="lg" className="gap-2">
            <Link to={ROUTES.QUIZ}>
              <Sparkles className="h-4 w-4" />
              Take the Quiz
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const narrative = getArchetypeNarrative(dnaData.primary_archetype_name);
  const colors = getCategoryColors(narrative.category);
  const confidence = dnaData.dna_confidence_score || 85;
  const rarity = dnaData.dna_rarity || 'Uncommon';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-8", className)}
    >
      {/* Editorial Header - No Box */}
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <span className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
            Travel DNA
          </span>
          <span className="h-px flex-1 bg-border" />
          <Badge variant="outline" className="text-xs font-normal">
            {rarity} • {confidence}% Match
          </Badge>
        </motion.div>

        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Archetype Icon */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-5xl"
          >
            {narrative.emoji}
          </motion.div>

          <div className="flex-1 space-y-3">
            {/* Name */}
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="font-serif text-3xl md:text-4xl font-semibold text-foreground leading-tight"
            >
              {narrative.name}
            </motion.h2>

            {/* Hook Line */}
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-lg text-muted-foreground italic max-w-xl"
            >
              "{narrative.hookLine}"
            </motion.p>

            {/* Retake Link */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Button variant="link" size="sm" asChild className="px-0 text-muted-foreground hover:text-foreground">
                <Link to={ROUTES.QUIZ}>
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Retake Quiz
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Tabbed Content - Minimal Style */}
      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 gap-6">
            <TabsTrigger 
              value="identity" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent bg-transparent px-0 pb-3 text-muted-foreground data-[state=active]:text-foreground"
            >
              What This Means
            </TabsTrigger>
            <TabsTrigger 
              value="superpowers" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent bg-transparent px-0 pb-3 text-muted-foreground data-[state=active]:text-foreground"
            >
              Superpowers
            </TabsTrigger>
            <TabsTrigger 
              value="growth" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent bg-transparent px-0 pb-3 text-muted-foreground data-[state=active]:text-foreground"
            >
              Growth Edges
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="identity" className="mt-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Core Description */}
                <p className="text-foreground/90 leading-relaxed text-lg max-w-2xl">
                  {narrative.coreDescription}
                </p>

                {/* What This Means */}
                <div className="space-y-4">
                  <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                    This Is Why You Travel
                  </h4>
                  <ul className="space-y-3">
                    {narrative.whatThisMeans.map((item, i) => (
                      <motion.li 
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-3 text-foreground/80"
                      >
                        <span className="w-1 h-1 rounded-full bg-foreground/40 mt-2.5 flex-shrink-0" />
                        {item}
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Traits */}
                {dnaData.tone_tags && dnaData.tone_tags.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                      Your Travel Traits
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {dnaData.tone_tags.map((tag, i) => (
                        <span 
                          key={i} 
                          className="px-3 py-1 text-sm border border-border rounded-full text-foreground/70 capitalize"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </TabsContent>

            <TabsContent value="superpowers" className="mt-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <p className="text-muted-foreground">
                  These are the unique strengths you bring to every journey.
                </p>
                <div className="grid gap-3">
                  {narrative.superpowers.map((power, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0"
                    >
                      <Zap className="h-4 w-4 text-foreground/40" />
                      <span className="text-foreground">{power}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="growth" className="mt-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <p className="text-muted-foreground">
                  Every traveler has room to grow. These gentle nudges might open new horizons.
                </p>
                <div className="grid gap-3">
                  {narrative.growthEdges.map((edge, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0"
                    >
                      <TrendingUp className="h-4 w-4 text-foreground/40" />
                      <span className="text-foreground">{edge}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </div>

      {/* Perfect Trip Preview - Editorial Quote Style */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="pt-6 border-t border-border"
      >
        <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">
          Your Perfect Trip
        </p>
        <blockquote className="text-xl md:text-2xl font-serif text-foreground/90 leading-relaxed italic">
          "{narrative.perfectTripPreview}"
        </blockquote>
        <Button variant="link" asChild className="mt-4 px-0 gap-1 text-muted-foreground hover:text-foreground">
          <Link to={ROUTES.START}>
            Plan a trip like this
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </motion.div>
    </motion.div>
  );
}