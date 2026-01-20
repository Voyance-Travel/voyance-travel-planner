/**
 * Trait Override Sliders Component
 * 
 * Panel with sliders for the 8 traits that users can adjust.
 * Overrides are stored in profiles.travel_dna_overrides.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  Loader2,
  Info
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
  },
  {
    key: 'social',
    label: 'Social Preference',
    negative: 'Solo/Intimate',
    positive: 'Social/Group',
    description: 'Do you prefer solo adventures or social experiences?',
    icon: '👥',
  },
  {
    key: 'comfort',
    label: 'Comfort Level',
    negative: 'Budget-Conscious',
    positive: 'Luxury-Seeking',
    description: 'Your preference for comfort and luxury.',
    icon: '✨',
  },
  {
    key: 'pace',
    label: 'Travel Pace',
    negative: 'Relaxed',
    positive: 'Fast-Paced',
    description: 'How many activities per day do you prefer?',
    icon: '⚡',
  },
  {
    key: 'authenticity',
    label: 'Authenticity',
    negative: 'Tourist-Friendly',
    positive: 'Local Explorer',
    description: 'Prefer popular attractions or hidden gems?',
    icon: '🗺️',
  },
  {
    key: 'adventure',
    label: 'Adventure Level',
    negative: 'Safe & Comfortable',
    positive: 'Thrill-Seeker',
    description: 'Your appetite for risk and adventure.',
    icon: '🏔️',
  },
  {
    key: 'budget',
    label: 'Spending Style',
    negative: 'Splurge',
    positive: 'Frugal',
    description: 'How price-conscious are you while traveling?',
    icon: '💰',
  },
  {
    key: 'transformation',
    label: 'Trip Purpose',
    negative: 'Pure Leisure',
    positive: 'Growth-Focused',
    description: 'Relaxation vs personal development.',
    icon: '🌱',
  },
];

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
  // Merge computed traits with existing overrides
  const [traitValues, setTraitValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    TRAITS.forEach(trait => {
      initial[trait.key] = existingOverrides[trait.key] ?? computedTraits[trait.key] ?? 0;
    });
    return initial;
  });

  const [originalValues, setOriginalValues] = useState<Record<string, number>>(traitValues);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
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
      resetValues[trait.key] = computedTraits[trait.key] ?? 0;
    });
    setTraitValues(resetValues);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Only save traits that differ from computed
      const overrides: Record<string, number> = {};
      TRAITS.forEach(trait => {
        if (traitValues[trait.key] !== (computedTraits[trait.key] ?? 0)) {
          overrides[trait.key] = traitValues[trait.key];
        }
      });

      // Update profiles.travel_dna_overrides
      const { error } = await supabase
        .from('profiles')
        .update({ travel_dna_overrides: overrides })
        .eq('id', userId);

      if (error) throw error;

      // Log event
      await supabase
        .from('voyance_events')
        .insert({
          user_id: userId,
          event_name: 'dna_overrides_saved',
          properties: {
            overrides,
            override_count: Object.keys(overrides).length,
            computed_traits: computedTraits,
            saved_at: new Date().toISOString(),
          },
        });

      setOriginalValues(traitValues);
      setHasChanges(false);
      toast.success('Your trait preferences have been saved!');
      onSave?.(overrides);

    } catch (error) {
      console.error('Failed to save overrides:', error);
      toast.error('Failed to save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

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
          const computedValue = computedTraits[trait.key] ?? 0;
          const isOverridden = value !== computedValue;

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
                    {value > 0 ? '+' : ''}{value}
                  </span>
                </div>
              </div>

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
