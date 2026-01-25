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
import TravelDNAEvolution from './TravelDNAEvolution';

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
  // V2 fields (typed loosely to accept DB Json)
  travel_dna_v2?: unknown;
  archetype_matches?: unknown;
  dna_version?: number;
  // Evolution fields
  trip_count?: number;
  travel_frequency?: string;
  has_overrides?: boolean;
  // User-adjusted trait overrides
  overrides?: Record<string, number>;
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

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Collapsible Identity Tab with sections */
function IdentityTabContent({ 
  narrative, 
  dnaData 
}: { 
  narrative: ArchetypeNarrative; 
  dnaData: TravelDNAData;
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    whyTravel: true,
    traits: false,
    growth: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Core Description - Always visible */}
      <p className="text-foreground/90 leading-relaxed text-lg max-w-2xl">
        {narrative.coreDescription}
      </p>

      {/* What This Means - Collapsible */}
      <Collapsible open={openSections.whyTravel} onOpenChange={() => toggleSection('whyTravel')}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-left group">
          <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
            This Is Why You Travel
          </h4>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            openSections.whyTravel && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="space-y-3 pt-3">
            {narrative.whatThisMeans.map((item, i) => (
              <motion.li 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 text-foreground/80"
              >
                <span className="w-1 h-1 rounded-full bg-foreground/40 mt-2.5 flex-shrink-0" />
                {item}
              </motion.li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>

      {/* Traits - Collapsible */}
      {dnaData.tone_tags && dnaData.tone_tags.length > 0 && (
        <Collapsible open={openSections.traits} onOpenChange={() => toggleSection('traits')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-left group">
            <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
              Your Travel Traits
            </h4>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              openSections.traits && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-wrap gap-2 pt-3">
              {dnaData.tone_tags.map((tag, i) => (
                <span 
                  key={i} 
                  className="px-3 py-1 text-sm border border-border rounded-full text-foreground/70 capitalize"
                >
                  {tag}
                </span>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Growth Edges - Collapsible */}
      <Collapsible open={openSections.growth} onOpenChange={() => toggleSection('growth')}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-left group">
          <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
            Room to Grow
          </h4>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            openSections.growth && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-3 pt-3">
            {narrative.growthEdges.slice(0, 2).map((edge, i) => (
              <div
                key={i}
                className="flex items-center gap-4 py-2 text-foreground/80"
              >
                <TrendingUp className="h-4 w-4 text-foreground/40" />
                <span>{edge}</span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}

/** Perfect Trip Preview - simple display */
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

export default function TravelDNAReveal({ userId, className }: TravelDNARevealProps) {
  const [dnaData, setDnaData] = useState<TravelDNAData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('identity');
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  useEffect(() => {
    async function loadDNA() {
      if (!userId) return;
      
      try {
        // Fetch DNA profile and trip count in parallel
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
          // Check if overrides exist (may be on profiles table)
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
          // Map from profiles.travel_dna to TravelDNAData format
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
  const secondaryNarrative = dnaData.secondary_archetype_name 
    ? getArchetypeNarrative(dnaData.secondary_archetype_name) 
    : null;
  const colors = getCategoryColors(narrative.category);
  const confidence = dnaData.dna_confidence_score || 85;
  const rarity = dnaData.dna_rarity || 'Uncommon';
  
  // Get the icon component for this category
  const CategoryIcon = CATEGORY_ICONS[narrative.category] || Compass;
  const SecondaryIcon = secondaryNarrative 
    ? CATEGORY_ICONS[secondaryNarrative.category] || Compass
    : null;
  const categoryInfo = CATEGORY_DESCRIPTIONS[narrative.category];

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
          {/* Category Icon - replaces emoji */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center",
              "bg-gradient-to-br", colors.primary
            )}
          >
            <CategoryIcon className="h-8 w-8 text-white" strokeWidth={1.5} />
          </motion.div>

          <div className="flex-1 space-y-3">

            {/* Primary Archetype Name */}
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="font-serif text-3xl md:text-4xl font-semibold text-foreground leading-tight"
            >
              {narrative.name}
            </motion.h2>

            {/* Secondary Archetype */}
            {secondaryNarrative && SecondaryIcon && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <SecondaryIcon className="h-4 w-4" />
                <span>with hints of</span>
                <span className="font-medium text-foreground">{secondaryNarrative.name}</span>
              </motion.div>
            )}

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

      {/* Expandable: Learn About Your Archetype */}
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
            {/* What is this category */}
            <div className="space-y-2">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <CategoryIcon className="h-4 w-4" />
                What is a {categoryInfo.name}?
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {categoryInfo.description}
              </p>
            </div>

            {/* Key traits */}
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

            {/* How it's calculated */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                How It's Calculated
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your Travel DNA is calculated by scoring your quiz responses across 8 core traits: 
                Planning, Social, Comfort, Pace, Authenticity, Adventure, Budget, and Transformation. 
                Each archetype has specific trait requirements—your responses are matched against these 
                to find your primary and secondary archetypes.
              </p>
            </div>

            {/* The 6 categories */}
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

      {/* Micro-Disambiguation for low confidence users */}
      {confidence < 60 && (
        <MicroDisambiguation
          userId={userId}
          confidence={confidence}
          onResolved={() => {
            // Could trigger a refetch of DNA data
            window.location.reload();
          }}
        />
      )}

      {/* Tabbed Content - Minimal Style */}
      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 gap-4 md:gap-6 overflow-x-auto">
            <TabsTrigger 
              value="identity" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent bg-transparent px-0 pb-3 text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap"
            >
              What This Means
            </TabsTrigger>
            <TabsTrigger 
              value="evolution" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent bg-transparent px-0 pb-3 text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap"
            >
              Evolution
            </TabsTrigger>
            <TabsTrigger 
              value="insights" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent bg-transparent px-0 pb-3 text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap"
            >
              Insights
            </TabsTrigger>
            <TabsTrigger 
              value="superpowers" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent bg-transparent px-0 pb-3 text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap"
            >
              Superpowers
            </TabsTrigger>
            <TabsTrigger 
              value="adjust" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent bg-transparent px-0 pb-3 text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap"
            >
              Adjust
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="identity" className="mt-8">
              <IdentityTabContent 
                narrative={narrative} 
                dnaData={dnaData} 
              />
            </TabsContent>

            {/* Evolution Tab - Traveler Maturity & Growth */}
            <TabsContent value="evolution" className="mt-8">
              <TravelDNAEvolution
                category={narrative.category}
                tripCount={dnaData.trip_count || 0}
                travelFrequency={dnaData.travel_frequency}
                hasOverrides={dnaData.has_overrides || false}
                quizCompleted={true}
              />
            </TabsContent>

            {/* NEW: Insights Tab - Travel DNA V2 Transparency */}
            <TabsContent value="insights" className="mt-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Travel DNA Transparency Component */}
                <TravelDNATransparency 
                  dnaData={dnaData.travel_dna_v2 as {
                    dna_version?: number;
                    trait_scores?: Record<string, number>;
                    archetype_matches?: Array<{
                      archetype_id: string;
                      name: string;
                      category?: string;
                      score: number;
                      pct: number;
                    }>;
                    confidence?: number;
                    trait_contributions?: Array<{
                      question_id: string;
                      answer_id: string;
                      label?: string;
                      deltas: Record<string, number>;
                      normalized_multiplier: number;
                    }>;
                  } | null}
                />
                
                {/* Accuracy Feedback Section */}
                <div className="pt-6 border-t border-border space-y-6">
                  <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
                    Help Us Improve
                  </h4>
                  
                  {/* Quick Rating Feedback */}
                  <DNAAccuracyFeedback
                    userId={userId}
                    dnaVersion={dnaData.dna_version || 1}
                    topArchetypes={(dnaData.archetype_matches as Array<{
                      archetype_id: string;
                      name: string;
                      pct: number;
                    }>) || []}
                  />
                  
                  {/* Chat-based Feedback */}
                  <div className="pt-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Prefer to explain in your own words?
                    </p>
                    <DNAFeedbackChat
                      userId={userId}
                      currentArchetype={dnaData.primary_archetype_name || undefined}
                      currentTraits={(dnaData.travel_dna_v2 as { trait_scores?: Record<string, number> })?.trait_scores || 
                        (dnaData.trait_scores as Record<string, number>) || {}}
                      onFeedbackApplied={async () => {
                        // Reload DNA data after chat feedback is applied
                        const { data } = await supabase
                          .from('travel_dna_profiles')
                          .select('*')
                          .eq('user_id', userId)
                          .maybeSingle();
                        if (data) {
                          setDnaData(prev => prev ? { ...prev, ...data, has_overrides: true } : null);
                        }
                      }}
                    />
                  </div>
                </div>
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

            {/* NEW: Adjust Tab - Trait Override Sliders */}
            <TabsContent value="adjust" className="mt-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <TraitOverrideSliders
                  userId={userId}
                  computedTraits={(dnaData.travel_dna_v2 as { trait_scores?: Record<string, number> })?.trait_scores || 
                    (dnaData.trait_scores as Record<string, number>) || {}}
                  existingOverrides={(dnaData as { overrides?: Record<string, number> }).overrides || {}}
                  onSave={async () => {
                    // Reload DNA data after save to reflect changes
                    const { data } = await supabase
                      .from('travel_dna_profiles')
                      .select('*')
                      .eq('user_id', userId)
                      .maybeSingle();
                    if (data) {
                      setDnaData(prev => prev ? { ...prev, ...data, has_overrides: true } : null);
                    }
                  }}
                />
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </div>

      {/* Perfect Trip Preview - Collapsible */}
      <PerfectTripPreview 
        preview={dnaData.perfect_trip_preview || narrative.perfectTripPreview} 
      />
    </motion.div>
  );
}