/**
 * Travel DNA Transparency Component
 * 
 * Displays archetype blend, trait scores, and "why we think this" section
 * showing top contributing quiz answers.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Sparkles,
  Scale,
  Target,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface ArchetypeMatch {
  archetype_id: string;
  name: string;
  category?: string;
  score: number;
  pct: number;
  reasons?: Array<{ trait: string; effect: string; amount: number; note?: string }>;
}

interface TraitContribution {
  question_id: string;
  answer_id: string;
  label?: string;
  deltas: Record<string, number>;
  normalized_multiplier: number;
}

interface TravelDNAV2Data {
  dna_version?: number;
  trait_scores?: Record<string, number>;
  archetype_matches?: ArchetypeMatch[];
  confidence?: number;
  trait_contributions?: TraitContribution[];
  top_contributors?: TraitContribution[];
}

interface TravelDNATransparencyProps {
  dnaData: TravelDNAV2Data | null;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TRAIT_LABELS: Record<string, { negative: string; positive: string; icon: string }> = {
  planning: { negative: 'Spontaneous', positive: 'Detailed Planner', icon: '📋' },
  social: { negative: 'Solo Traveler', positive: 'Social Butterfly', icon: '👥' },
  comfort: { negative: 'Budget-Conscious', positive: 'Luxury-Seeking', icon: '✨' },
  pace: { negative: 'Relaxed', positive: 'Fast-Paced', icon: '⚡' },
  authenticity: { negative: 'Tourist-Friendly', positive: 'Local Explorer', icon: '🗺️' },
  adventure: { negative: 'Safe & Comfortable', positive: 'Thrill-Seeker', icon: '🏔️' },
  budget: { negative: 'Splurge', positive: 'Frugal', icon: '💰' },
  transformation: { negative: 'Pure Leisure', positive: 'Growth-Focused', icon: '🌱' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function TravelDNATransparency({ dnaData, className }: TravelDNATransparencyProps) {
  const [isWhyOpen, setIsWhyOpen] = useState(false);
  const [isTraitsOpen, setIsTraitsOpen] = useState(false);

  if (!dnaData) {
    return null;
  }

  const { archetype_matches, confidence, trait_scores, trait_contributions } = dnaData;
  const confidenceLevel = confidence ?? 75;
  const isLowConfidence = confidenceLevel < 60;

  // Get top 3 archetypes for blend display
  const topArchetypes = (archetype_matches || []).slice(0, 3);
  
  // Get top 5 contributing answers
  const topContributions = (trait_contributions || [])
    .filter(c => c.label) // Only show those with labels
    .sort((a, b) => {
      const aMagnitude = Object.values(a.deltas).reduce((sum, d) => sum + Math.abs(d), 0);
      const bMagnitude = Object.values(b.deltas).reduce((sum, d) => sum + Math.abs(d), 0);
      return bMagnitude - aMagnitude;
    })
    .slice(0, 5);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Archetype Blend Section */}
      {topArchetypes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-3 w-3" />
              Archetype Blend
            </h4>
            <Badge 
              variant={isLowConfidence ? "outline" : "secondary"}
              className={cn(
                "text-xs",
                isLowConfidence && "border-amber-500/50 text-amber-600 dark:text-amber-400"
              )}
            >
              {Math.round(confidenceLevel)}% Match
            </Badge>
          </div>

          {/* Low confidence warning */}
          {isLowConfidence && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Your profile shows mixed signals. We'll offer more variety in recommendations 
                until we learn more about your preferences.
              </p>
            </div>
          )}

          {/* Archetype blend bars */}
          <div className="space-y-3">
            {topArchetypes.map((archetype, index) => (
              <div key={archetype.archetype_id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {archetype.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(archetype.pct)}%
                  </span>
                </div>
                <Progress 
                  value={archetype.pct} 
                  className={cn(
                    "h-2",
                    index === 0 && "bg-primary/20",
                    index === 1 && "bg-secondary/20",
                    index === 2 && "bg-muted"
                  )}
                />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Trait Scores Section */}
      {trait_scores && Object.keys(trait_scores).length > 0 && (
        <Collapsible open={isTraitsOpen} onOpenChange={setIsTraitsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                View Trait Scores
              </span>
              {isTraitsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-4 space-y-4"
              >
                {Object.entries(trait_scores).map(([trait, score]) => {
                  const labels = TRAIT_LABELS[trait];
                  if (!labels || typeof score !== 'number') return null;

                  const normalizedValue = ((score + 10) / 20) * 100; // Convert -10..10 to 0..100
                  
                  return (
                    <div key={trait} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{labels.negative}</span>
                        <span className="font-medium text-foreground">
                          {labels.icon} {trait.charAt(0).toUpperCase() + trait.slice(1)}
                        </span>
                        <span className="text-muted-foreground">{labels.positive}</span>
                      </div>
                      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="absolute top-0 left-1/2 w-0.5 h-full bg-border z-10"
                        />
                        <motion.div
                          initial={{ width: '50%' }}
                          animate={{ width: `${normalizedValue}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className={cn(
                            "absolute top-0 left-0 h-full rounded-full",
                            score > 0 ? "bg-primary" : "bg-secondary"
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Why We Think This Section */}
      {topContributions.length > 0 && (
        <Collapsible open={isWhyOpen} onOpenChange={setIsWhyOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Why We Think This
              </span>
              {isWhyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-4 space-y-3"
              >
                <p className="text-xs text-muted-foreground mb-3">
                  These quiz answers had the biggest impact on your profile:
                </p>
                {topContributions.map((contribution, index) => (
                  <div 
                    key={`${contribution.question_id}-${contribution.answer_id}`}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border"
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {contribution.label || contribution.answer_id}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {Object.entries(contribution.deltas).map(([trait, delta]) => {
                          if (typeof delta !== 'number' || delta === 0) return null;
                          return (
                            <Badge
                              key={trait}
                              variant="outline"
                              className={cn(
                                "text-xs",
                                delta > 0 
                                  ? "border-green-500/50 text-green-600 dark:text-green-400"
                                  : "border-red-500/50 text-red-600 dark:text-red-400"
                              )}
                            >
                              {trait}: {delta > 0 ? '+' : ''}{delta}
                            </Badge>
                          );
                        })}
                      </div>
                      {contribution.normalized_multiplier < 1 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <Info className="h-3 w-3 inline mr-1" />
                          Weighted at {Math.round(contribution.normalized_multiplier * 100)}% (multi-select)
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export type { TravelDNAV2Data, ArchetypeMatch, TraitContribution };
