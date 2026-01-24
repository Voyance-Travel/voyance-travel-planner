/**
 * Trait Override Sliders Component
 * 
 * Panel with sliders for the 8 traits that users can adjust.
 * Shows computed vs adjusted values with explanations.
 * Overrides are stored in profiles.travel_dna_overrides.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  Loader2,
  Info,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface TraitOverrideSlidersProps {
  userId: string;
  computedTraits?: Record<string, number>;
  existingOverrides?: Record<string, number>;
  onSave?: (overrides: Record<string, number>) => void;
  className?: string;
}

interface TraitConfig {
  key: string;
  label: string;
  negative: string;
  positive: string;
  description: string;
  icon: string;
  whyExplanations: {
    high: string;
    low: string;
    neutral: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TRAITS: TraitConfig[] = [
  {
    key: 'planning',
    label: 'Planning Style',
    negative: 'Spontaneous',
    positive: 'Detailed Planner',
    description: 'How much structure do you want in your trips?',
    icon: '📋',
    whyExplanations: {
      high: 'Based on your preference for detailed itineraries and advance booking',
      low: 'Based on your love for going with the flow and last-minute decisions',
      neutral: 'Based on a balance between planned activities and free time',
    },
  },
  {
    key: 'social',
    label: 'Social Preference',
    negative: 'Solo/Intimate',
    positive: 'Social/Group',
    description: 'Do you prefer solo adventures or social experiences?',
    icon: '👥',
    whyExplanations: {
      high: 'Based on your preference for group travel and meeting new people',
      low: 'Based on your preference for solo or intimate travel experiences',
      neutral: 'Based on enjoying both solo time and social activities',
    },
  },
  {
    key: 'comfort',
    label: 'Comfort Level',
    negative: 'Budget-Conscious',
    positive: 'Luxury-Seeking',
    description: 'Your preference for comfort and luxury.',
    icon: '✨',
    whyExplanations: {
      high: 'Based on your preference for luxury accommodations and premium experiences',
      low: 'Based on your preference for budget-friendly stays and authentic local options',
      neutral: 'Based on valuing comfort without needing luxury',
    },
  },
  {
    key: 'pace',
    label: 'Travel Pace',
    negative: 'Relaxed',
    positive: 'Fast-Paced',
    description: 'How many activities per day do you prefer?',
    icon: '⚡',
    whyExplanations: {
      high: 'Based on your desire to pack in lots of activities and see everything',
      low: 'Based on your preference for slow travel and deep exploration',
      neutral: 'Based on enjoying a balanced mix of activities and downtime',
    },
  },
  {
    key: 'authenticity',
    label: 'Authenticity',
    negative: 'Tourist-Friendly',
    positive: 'Local Explorer',
    description: 'Prefer popular attractions or hidden gems?',
    icon: '🗺️',
    whyExplanations: {
      high: 'Based on your love for off-the-beaten-path experiences and local culture',
      low: 'Based on your preference for popular attractions and reliable experiences',
      neutral: 'Based on enjoying a mix of famous sites and local discoveries',
    },
  },
  {
    key: 'adventure',
    label: 'Adventure Level',
    negative: 'Safe & Comfortable',
    positive: 'Thrill-Seeker',
    description: 'Your appetite for risk and adventure.',
    icon: '🏔️',
    whyExplanations: {
      high: 'Based on your interest in thrilling activities and pushing boundaries',
      low: 'Based on your preference for safe, relaxing experiences',
      neutral: 'Based on enjoying occasional adventures without extreme risks',
    },
  },
  {
    key: 'budget',
    label: 'Spending Style',
    negative: 'Splurge',
    positive: 'Frugal',
    description: 'How price-conscious are you while traveling?',
    icon: '💰',
    whyExplanations: {
      high: 'Based on your focus on value and smart spending while traveling',
      low: 'Based on your willingness to splurge on special experiences',
      neutral: 'Based on balancing value with occasional splurges',
    },
  },
  {
    key: 'transformation',
    label: 'Trip Purpose',
    negative: 'Pure Leisure',
    positive: 'Growth-Focused',
    description: 'Relaxation vs personal development.',
    icon: '🌱',
    whyExplanations: {
      high: 'Based on your interest in travel that promotes personal growth',
      low: 'Based on your desire for pure relaxation and escape',
      neutral: 'Based on seeking both relaxation and meaningful experiences',
    },
  },
];

function getWhyExplanation(trait: TraitConfig, value: number): string {
  if (value >= 4) return trait.whyExplanations.high;
  if (value <= -4) return trait.whyExplanations.low;
  return trait.whyExplanations.neutral;
}

function formatTraitValue(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function getTraitLabel(trait: TraitConfig, value: number): string {
  if (value >= 6) return trait.positive;
  if (value <= -6) return trait.negative;
  if (value >= 3) return `Leaning ${trait.positive.toLowerCase()}`;
  if (value <= -3) return `Leaning ${trait.negative.toLowerCase()}`;
  return 'Balanced';
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TraitOverrideSliders({
  userId,
  computedTraits = {},
  existingOverrides = {},
  onSave,
  className,
}: TraitOverrideSlidersProps) {
  // State for trait values - will be initialized after preferences are loaded
  const [traitValues, setTraitValues] = useState<Record<string, number>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, number>>({});
  const [computedBaseline, setComputedBaseline] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load preferences and derive initial trait values
  useEffect(() => {
    async function loadPreferencesAndInitialize() {
      setIsLoading(true);
      
      try {
        // Fetch user preferences to derive trait values
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('budget_tier, travel_pace, planning_preference, travel_companions, interests, accommodation_style, travel_vibes')
          .eq('user_id', userId)
          .maybeSingle();
        
        // Derive trait values from preferences as baseline
        const derivedFromPrefs: Record<string, number> = {};
        
        if (prefs) {
          // Planning trait: detailed = +7, balanced = 0, spontaneous = -5
          if (prefs.planning_preference === 'detailed') derivedFromPrefs.planning = 7;
          else if (prefs.planning_preference === 'spontaneous') derivedFromPrefs.planning = -5;
          else derivedFromPrefs.planning = 0;
          
          // Social trait: based on companions
          const companions = prefs.travel_companions as string[] | null;
          if (companions?.includes('solo')) derivedFromPrefs.social = -3;
          else if (companions?.includes('group')) derivedFromPrefs.social = 5;
          else derivedFromPrefs.social = 2;
          
          // Comfort trait: based on budget and accommodation
          if (prefs.budget_tier === 'luxury') derivedFromPrefs.comfort = 7;
          else if (prefs.budget_tier === 'premium') derivedFromPrefs.comfort = 4;
          else if (prefs.budget_tier === 'budget') derivedFromPrefs.comfort = -3;
          else derivedFromPrefs.comfort = 0;
          
          // Pace trait
          if (prefs.travel_pace === 'packed' || prefs.travel_pace === 'fast') derivedFromPrefs.pace = 6;
          else if (prefs.travel_pace === 'relaxed' || prefs.travel_pace === 'slow') derivedFromPrefs.pace = -6;
          else derivedFromPrefs.pace = 0;
          
          // Authenticity trait: based on interests
          const interests = prefs.interests as string[] | null;
          if (interests?.includes('culture') || interests?.includes('food') || interests?.includes('local')) {
            derivedFromPrefs.authenticity = 5;
          } else {
            derivedFromPrefs.authenticity = 0;
          }
          
          // Adventure trait
          const vibes = prefs.travel_vibes as string[] | null;
          if (interests?.includes('adventure') || vibes?.includes('bold')) {
            derivedFromPrefs.adventure = 6;
          } else {
            derivedFromPrefs.adventure = 0;
          }
          
          // Budget trait (frugal vs splurge)
          if (prefs.budget_tier === 'budget') derivedFromPrefs.budget = 5;
          else if (prefs.budget_tier === 'luxury') derivedFromPrefs.budget = -5;
          else derivedFromPrefs.budget = 0;
          
          // Transformation trait
          if (vibes?.includes('spiritual') || interests?.includes('wellness')) {
            derivedFromPrefs.transformation = 5;
          } else {
            derivedFromPrefs.transformation = 0;
          }
        }
        
        // Store the computed baseline (before any overrides)
        const computed: Record<string, number> = {};
        TRAITS.forEach(trait => {
          computed[trait.key] = computedTraits[trait.key] ?? derivedFromPrefs[trait.key] ?? 0;
        });
        setComputedBaseline(computed);
        
        // Priority: existingOverrides > computedTraits > derivedFromPrefs > 0
        const initial: Record<string, number> = {};
        TRAITS.forEach(trait => {
          initial[trait.key] = 
            existingOverrides[trait.key] ?? 
            computedTraits[trait.key] ?? 
            derivedFromPrefs[trait.key] ?? 
            0;
        });
        
        setTraitValues(initial);
        setOriginalValues(initial);
      } catch (error) {
        console.error('Failed to load preferences for trait sliders:', error);
        // Fallback to computed traits
        const initial: Record<string, number> = {};
        const computed: Record<string, number> = {};
        TRAITS.forEach(trait => {
          initial[trait.key] = existingOverrides[trait.key] ?? computedTraits[trait.key] ?? 0;
          computed[trait.key] = computedTraits[trait.key] ?? 0;
        });
        setTraitValues(initial);
        setOriginalValues(initial);
        setComputedBaseline(computed);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadPreferencesAndInitialize();
  }, [userId, computedTraits, existingOverrides]);

  // Track changes
  useEffect(() => {
    if (Object.keys(originalValues).length === 0) return;
    const changed = TRAITS.some(
      trait => traitValues[trait.key] !== originalValues[trait.key]
    );
    setHasChanges(changed);
  }, [traitValues, originalValues]);

  const handleSliderChange = (traitKey: string, value: number[]) => {
    setTraitValues(prev => ({
      ...prev,
      [traitKey]: value[0],
    }));
  };

  const handleReset = () => {
    // Reset to computed values (not overrides)
    const resetValues: Record<string, number> = {};
    TRAITS.forEach(trait => {
      resetValues[trait.key] = computedBaseline[trait.key] ?? 0;
    });
    setTraitValues(resetValues);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Only save traits that differ from computed
      const overrides: Record<string, number> = {};
      TRAITS.forEach(trait => {
        if (traitValues[trait.key] !== (computedBaseline[trait.key] ?? 0)) {
          overrides[trait.key] = traitValues[trait.key];
        }
      });

      // Update profiles.travel_dna_overrides
      const { error } = await supabase
        .from('profiles')
        .update({ travel_dna_overrides: overrides })
        .eq('id', userId);

      if (error) throw error;

      // Log event with before/after comparison
      await supabase
        .from('voyance_events')
        .insert({
          user_id: userId,
          event_name: 'dna_overrides_saved',
          properties: {
            overrides,
            override_count: Object.keys(overrides).length,
            computed_traits: computedBaseline,
            changes_made: Object.entries(overrides).map(([key, newVal]) => ({
              trait: key,
              from: computedBaseline[key] ?? 0,
              to: newVal,
            })),
            saved_at: new Date().toISOString(),
          },
        });

      setOriginalValues(traitValues);
      setHasChanges(false);
      
      const overrideCount = Object.keys(overrides).length;
      toast.success(
        overrideCount > 0 
          ? `${overrideCount} trait adjustment${overrideCount > 1 ? 's' : ''} saved!`
          : 'Traits reset to quiz-calculated values!',
        { description: 'Your next itinerary will reflect these changes.' }
      );
      
      onSave?.(overrides);

    } catch (error) {
      console.error('Failed to save overrides:', error);
      toast.error('Failed to save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-6", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-medium text-foreground">Adjust Your Travel DNA</h3>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-1.5"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      {/* Info */}
      <p className="text-sm text-muted-foreground">
        Fine-tune your travel personality. These adjustments override quiz-derived scores 
        and affect your itinerary recommendations.
      </p>

      {/* Sliders */}
      <div className="space-y-8">
        {TRAITS.map((trait) => {
          const value = traitValues[trait.key];
          const computedValue = computedBaseline[trait.key] ?? 0;
          const isOverridden = value !== computedValue;
          const whyText = getWhyExplanation(trait, computedValue);

          return (
            <div key={trait.key} className="space-y-3">
              {/* Label Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{trait.icon}</span>
                  <span className="text-sm font-medium text-foreground">{trait.label}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">{trait.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-2">
                  {isOverridden && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      Modified
                    </span>
                  )}
                  <span className={cn(
                    "text-sm font-mono w-8 text-right",
                    value > 0 ? "text-primary" : value < 0 ? "text-secondary" : "text-muted-foreground"
                  )}>
                    {formatTraitValue(value)}
                  </span>
                </div>
              </div>

              {/* Before/After Comparison (if modified) */}
              {isOverridden && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg px-3 py-2"
                >
                  <span className="text-muted-foreground">Quiz result:</span>
                  <span className="font-mono text-foreground/70">
                    {formatTraitValue(computedValue)}
                  </span>
                  <span className="text-muted-foreground/50">({getTraitLabel(trait, computedValue)})</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />
                  <span className="text-muted-foreground">Now:</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-medium">
                    {formatTraitValue(value)}
                  </span>
                  <span className="text-amber-600/70 dark:text-amber-400/70">({getTraitLabel(trait, value)})</span>
                </motion.div>
              )}

              {/* Why This Score (computed baseline explanation) */}
              {!isOverridden && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <HelpCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{whyText}</span>
                </div>
              )}

              {/* Slider */}
              <div className="space-y-1">
                <Slider
                  value={[value]}
                  min={-10}
                  max={10}
                  step={1}
                  onValueChange={(val) => handleSliderChange(trait.key, val)}
                  className={cn(
                    "w-full",
                    isOverridden && "[&_[role=slider]]:border-amber-500"
                  )}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{trait.negative}</span>
                  <span className="text-center">Balanced</span>
                  <span>{trait.positive}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Trait overrides take effect immediately for new itinerary generations. 
            Previous itineraries are not affected.
          </span>
        </p>
      </div>
    </motion.div>
  );
}

export type { TraitOverrideSlidersProps };
