import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Zap, 
  TrendingUp,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Compass,
  Users,
  Trophy,
  Leaf,
  Gem,
  Info,
  Settings2,
  Rocket
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ROUTES } from '@/config/routes';
import { 
  getArchetypeNarrative, 
  getCategoryColors,
  CATEGORY_DESCRIPTIONS,
  type ArchetypeNarrative 
} from '@/data/archetypeNarratives';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import TravelDNATransparency from './TravelDNATransparency';
import DNAAccuracyFeedback from './DNAAccuracyFeedback';
import DNAFeedbackChat from './DNAFeedbackChat';
import TraitOverrideSliders from './TraitOverrideSliders';
import MicroDisambiguation from './MicroDisambiguation';
import AchievementsPanel from './AchievementsPanel';
import DNATraitFingerprint from './DNATraitFingerprint';

/** Map category names to their Lucide icon components */
const CATEGORY_ICONS = {
  EXPLORER: Compass,
  CONNECTOR: Users,
  ACHIEVER: Trophy,
  RESTORER: Leaf,
  CURATOR: Gem,
  TRANSFORMER: Sparkles,
} as const;

interface TravelDNARevealProps {
  userId: string;
  className?: string;
}

interface TravelDNAData {
  primary_archetype_name: string | null;
  primary_archetype_display?: string | null;
  primary_archetype_category?: string | null;
  primary_archetype_tagline?: string | null;
  secondary_archetype_name: string | null;
  secondary_archetype_display?: string | null;
  dna_confidence_score: number | null;
  dna_rarity: string | null;
  trait_scores: unknown;
  tone_tags: string[] | null;
  emotional_drivers: string[] | null;
  perfect_trip_preview?: string | null;
  summary: string | null;
  travel_dna_v2?: unknown;
  archetype_matches?: unknown;
  dna_version?: number;
  trip_count?: number;
  travel_frequency?: string;
  has_overrides?: boolean;
  overrides?: Record<string, number>;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Archetype Hero Card with gradient background */
function ArchetypeHeroCard({ 
  narrative, 
  secondaryNarrative,
  colors,
  confidence,
  rarity,
}: { 
  narrative: ArchetypeNarrative;
  secondaryNarrative: ArchetypeNarrative | null;
  colors: ReturnType<typeof getCategoryColors>;
  confidence: number;
  rarity: string;
}) {
  const CategoryIcon = CATEGORY_ICONS[narrative.category] || Compass;
  const SecondaryIcon = secondaryNarrative 
    ? CATEGORY_ICONS[secondaryNarrative.category] || Compass
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 md:p-8",
        "bg-gradient-to-br",
        colors.primary,
      )}
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_20%,white_1px,transparent_1px)] bg-[size:24px_24px]" />
      
      <div className="relative z-10 space-y-4">
        {/* Top row: icon + badges */}
        <div className="flex items-start justify-between">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center"
          >
            <CategoryIcon className="h-7 w-7 text-white" strokeWidth={1.5} />
          </motion.div>
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm text-xs">
              {rarity}
            </Badge>
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm text-xs">
              {confidence}% match
            </Badge>
          </div>
        </div>

        {/* Archetype name */}
        <motion.h2 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="font-serif text-3xl md:text-4xl font-semibold text-white leading-tight"
        >
          {narrative.name}
        </motion.h2>

        {/* Hook line */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-lg text-white/85 italic max-w-xl leading-relaxed"
        >
          "{narrative.hookLine}"
        </motion.p>

        {/* Secondary archetype */}
        {secondaryNarrative && SecondaryIcon && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2 pt-1"
          >
            <div className="w-6 h-6 rounded-md bg-white/15 flex items-center justify-center">
              <SecondaryIcon className="h-3.5 w-3.5 text-white/80" />
            </div>
            <span className="text-sm text-white/70">with hints of</span>
            <span className="text-sm font-medium text-white">{secondaryNarrative.name}</span>
          </motion.div>
        )}

        {/* Retake link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Button 
            variant="ghost" 
            size="sm" 
            asChild 
            className="px-0 text-white/60 hover:text-white hover:bg-transparent"
          >
            <Link to={ROUTES.QUIZ}>
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Retake Quiz
            </Link>
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

/** Merged "About" tab: core description + superpowers + growth + traits */
function AboutTabContent({ 
  narrative, 
  dnaData 
}: { 
  narrative: ArchetypeNarrative; 
  dnaData: TravelDNAData;
}) {
  return (
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
      <div className="space-y-3">
        <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
          This Is Why You Travel
        </h4>
        <ul className="space-y-2.5">
          {narrative.whatThisMeans.map((item, i) => (
            <motion.li 
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-start gap-3 text-foreground/80"
            >
              <span className="w-1 h-1 rounded-full bg-primary/60 mt-2.5 flex-shrink-0" />
              {item}
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Superpowers */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
          Your Superpowers
        </h4>
        <div className="grid gap-2.5">
          {narrative.superpowers.map((power, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-start gap-3 text-foreground/80"
            >
              <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{power}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Tone Tags */}
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

      {/* Growth Edges */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
          Room to Grow
        </h4>
        <div className="grid gap-2.5">
          {narrative.growthEdges.slice(0, 2).map((edge, i) => (
            <div
              key={i}
              className="flex items-center gap-3 text-foreground/70"
            >
              <TrendingUp className="h-4 w-4 text-foreground/40" />
              <span>{edge}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/** Perfect Trip Preview */
function PerfectTripPreview({ preview }: { preview: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.7 }}
      className="pt-6 border-t border-border"
    >
      <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-2">
        Your Perfect Trip
      </p>
      <p className="text-base text-foreground/80 italic">
        "{preview}"
      </p>
      <Button variant="link" asChild className="mt-2 px-0 gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Link to={ROUTES.START}>
          Plan a trip like this
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TravelDNAReveal({ userId, className }: TravelDNARevealProps) {
  const [dnaData, setDnaData] = useState<TravelDNAData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('about');
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  useEffect(() => {
    async function loadDNA() {
      if (!userId) return;
      
      try {
        const [dnaResult, tripCountResult, preferencesResult] = await Promise.all([
          supabase
            .from('travel_dna_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('trips')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase
            .from('user_preferences')
            .select('travel_frequency')
            .eq('user_id', userId)
            .maybeSingle()
        ]);
        
        const { data: profileData, error: profileError } = dnaResult;
        const tripCount = tripCountResult.count || 0;
        const travelFrequency = preferencesResult.data?.travel_frequency as string | undefined;
        
        if (profileData?.primary_archetype_name) {
          const { data: profileOverrides } = await supabase
            .from('profiles')
            .select('travel_dna_overrides')
            .eq('id', userId)
            .maybeSingle();
          
          const overridesData = profileOverrides?.travel_dna_overrides as Record<string, number> | null;
          
          setDnaData({
            ...profileData,
            trip_count: tripCount,
            travel_frequency: travelFrequency,
            has_overrides: !!overridesData && Object.keys(overridesData).length > 0,
            overrides: overridesData || {},
          } as TravelDNAData);
          setIsLoading(false);
          return;
        }
        
        // Fallback: Check profiles.travel_dna column
        const { data: userProfile, error: userError } = await supabase
          .from('profiles')
          .select('travel_dna, quiz_completed, travel_dna_overrides')
          .eq('id', userId)
          .maybeSingle();
        
        if (userProfile?.travel_dna && typeof userProfile.travel_dna === 'object') {
          const dnaJson = userProfile.travel_dna as Record<string, unknown>;
          const overridesData = userProfile.travel_dna_overrides as Record<string, number> | null;
          setDnaData({
            primary_archetype_name: (dnaJson.primary_archetype_name as string) || null,
            secondary_archetype_name: (dnaJson.secondary_archetype_name as string) || null,
            dna_confidence_score: (dnaJson.dna_confidence_score as number) || null,
            dna_rarity: (dnaJson.dna_rarity as string) || null,
            trait_scores: dnaJson.trait_scores || null,
            tone_tags: (dnaJson.tone_tags as string[]) || null,
            emotional_drivers: (dnaJson.emotional_drivers as string[]) || null,
            summary: (dnaJson.summary as string) || null,
            trip_count: tripCount,
            travel_frequency: travelFrequency,
            has_overrides: !!overridesData && Object.keys(overridesData).length > 0,
            overrides: overridesData || {},
          });
        }
        
        if (profileError) console.error('travel_dna_profiles error:', profileError);
        if (userError) console.error('profiles error:', userError);
      } catch (error) {
        console.error('Failed to load travel DNA:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadDNA();
  }, [userId]);

  if (isLoading) {
    return (
      <div className={cn("rounded-2xl border border-border p-8", className)}>
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-14 h-14 rounded-xl bg-muted" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-40 bg-muted rounded" />
            <div className="h-3 w-28 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!dnaData?.primary_archetype_name) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border p-8 md:p-10",
          "bg-gradient-to-br from-primary/5 via-background to-accent/5",
          className
        )}
      >
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary))_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="relative text-center max-w-md mx-auto">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5"
          >
            <Sparkles className="h-8 w-8 text-primary" />
          </motion.div>
          <h3 className="font-serif text-2xl md:text-3xl font-semibold text-foreground mb-3">
            Discover Your Travel DNA
          </h3>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Take our quick quiz to uncover your unique travel personality. 
            It shapes every trip we build for you.
          </p>
          <Button asChild size="lg" className="gap-2 rounded-xl">
            <Link to={ROUTES.QUIZ}>
              <Sparkles className="h-4 w-4" />
              Take the Quiz
            </Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  const narrative = getArchetypeNarrative(dnaData.primary_archetype_name);
  const secondaryNarrativeRaw = dnaData.secondary_archetype_name 
    ? getArchetypeNarrative(dnaData.secondary_archetype_name) 
    : null;
  const secondaryNarrative = secondaryNarrativeRaw && secondaryNarrativeRaw.id !== narrative.id 
    ? secondaryNarrativeRaw 
    : null;
  const colors = getCategoryColors(narrative.category);
  const confidence = dnaData.dna_confidence_score || 85;
  const rarity = dnaData.dna_rarity || 'Uncommon';
  const CategoryIcon = CATEGORY_ICONS[narrative.category] || Compass;
  const categoryInfo = CATEGORY_DESCRIPTIONS[narrative.category];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("space-y-6", className)}
    >
      {/* 1. Hero Archetype Card */}
      <ArchetypeHeroCard
        narrative={narrative}
        secondaryNarrative={secondaryNarrative}
        colors={colors}
        confidence={confidence}
        rarity={rarity}
      />

      {/* 2. DNA Trait Fingerprint - Always visible hero element */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-border bg-card p-5 md:p-6"
      >
        <DNATraitFingerprint 
          traitScores={dnaData.trait_scores as Record<string, number> | null} 
        />
      </motion.div>

      {/* Low confidence disambiguation */}
      {confidence < 60 && (
        <MicroDisambiguation
          userId={userId}
          confidence={confidence}
          onResolved={() => window.location.reload()}
        />
      )}

      {/* 3. Expandable: How is my DNA determined? */}
      <Collapsible open={isInfoOpen} onOpenChange={setIsInfoOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-between text-muted-foreground hover:text-foreground group"
          >
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              How is my Travel DNA determined?
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform duration-200",
              isInfoOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-6 rounded-xl bg-muted/30 border border-border space-y-6"
          >
            <div className="space-y-2">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <CategoryIcon className="h-4 w-4" />
                What is a {categoryInfo.name}?
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {categoryInfo.description}
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                Key Traits
              </h4>
              <div className="flex flex-wrap gap-2">
                {categoryInfo.keyTraits.map((trait, i) => (
                  <span 
                    key={i}
                    className="px-3 py-1 text-sm bg-background border border-border rounded-full"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                How It Works
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your Travel DNA is calculated by scoring your quiz responses across 8 core traits: 
                Planning, Social, Comfort, Pace, Authenticity, Adventure, Budget, and Transformation. 
                Each archetype has specific trait requirements. Your responses are matched against these 
                to find your primary and secondary archetypes.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                The 6 Traveler Categories
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(CATEGORY_DESCRIPTIONS).map(([key, cat]) => {
                  const Icon = CATEGORY_ICONS[key as keyof typeof CATEGORY_ICONS];
                  const catColors = getCategoryColors(key as keyof typeof CATEGORY_DESCRIPTIONS);
                  const isActive = key === narrative.category;
                  return (
                    <div 
                      key={key}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg text-sm transition-colors",
                        isActive ? cn(catColors.bg, catColors.text, "font-medium") : "text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{cat.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </CollapsibleContent>
      </Collapsible>

      {/* 4. Simplified 3-Tab Deep Dive */}
      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 gap-6 overflow-x-auto">
            <TabsTrigger 
              value="about" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent bg-transparent px-0 pb-3 text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap"
            >
              About You
            </TabsTrigger>
            <TabsTrigger 
              value="fine-tune" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent bg-transparent px-0 pb-3 text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap"
            >
              Fine-Tune
            </TabsTrigger>
            <TabsTrigger 
              value="deeper" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent bg-transparent px-0 pb-3 text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap"
            >
              Deeper Insights
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            {/* About: Identity + Superpowers merged */}
            <TabsContent value="about" className="mt-8">
              <AboutTabContent narrative={narrative} dnaData={dnaData} />
            </TabsContent>

            {/* Fine-Tune: Adjust sliders + micro disambiguation */}
            <TabsContent value="fine-tune" className="mt-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <MicroDisambiguation 
                  userId={userId}
                  confidence={confidence}
                  onResolved={() => window.location.reload()}
                />
                <TraitOverrideSliders 
                  userId={userId}
                  computedTraits={dnaData.trait_scores as Record<string, number> | undefined}
                  existingOverrides={dnaData.overrides}
                  onSave={() => window.location.reload()}
                />
              </motion.div>
            </TabsContent>

            {/* Deeper: Transparency + Feedback + Achievements */}
            <TabsContent value="deeper" className="mt-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <TravelDNATransparency dnaData={dnaData.travel_dna_v2 as any} />
                <DNAAccuracyFeedback userId={userId} />
                <DNAFeedbackChat userId={userId} />
                <div className="pt-4 border-t border-border">
                  <AchievementsPanel />
                </div>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </div>

      {/* 5. Perfect Trip Preview */}
      <PerfectTripPreview 
        preview={dnaData.perfect_trip_preview || narrative.perfectTripPreview} 
      />
    </motion.div>
  );
}
