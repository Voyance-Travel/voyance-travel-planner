/**
 * Travel DNA Transparency Component
 * 
 * Editorial display of archetype blend and trait insights
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronDown, 
  Sparkles,
  BarChart3
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

const TRAIT_DISPLAY: Record<string, { label: string; low: string; high: string }> = {
  planning: { label: 'Planning Style', low: 'Spontaneous', high: 'Detailed' },
  social: { label: 'Social Energy', low: 'Solo', high: 'Social' },
  comfort: { label: 'Comfort Level', low: 'Budget', high: 'Luxury' },
  pace: { label: 'Travel Pace', low: 'Relaxed', high: 'Active' },
  authenticity: { label: 'Experience Type', low: 'Tourist', high: 'Local' },
  adventure: { label: 'Adventure Level', low: 'Safe', high: 'Adventurous' },
  budget: { label: 'Spending Style', low: 'Splurge', high: 'Frugal' },
  transformation: { label: 'Travel Purpose', low: 'Leisure', high: 'Growth' },
};

// ============================================================================
// HELPERS
// ============================================================================

function formatArchetypeName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TravelDNATransparency({ dnaData, className }: TravelDNATransparencyProps) {
  const [isTraitsOpen, setIsTraitsOpen] = useState(false);

  if (!dnaData) {
    return null;
  }

  const { archetype_matches, confidence, trait_scores, trait_contributions } = dnaData;
  const confidenceLevel = confidence ?? 75;

  // Get top 3 archetypes for blend display
  const topArchetypes = (archetype_matches || []).slice(0, 3);
  
  // Get top 3 contributing answers
  const topContributions = (trait_contributions || [])
    .filter(c => c.label)
    .sort((a, b) => {
      const aMagnitude = Object.values(a.deltas).reduce((sum, d) => sum + Math.abs(d), 0);
      const bMagnitude = Object.values(b.deltas).reduce((sum, d) => sum + Math.abs(d), 0);
      return bMagnitude - aMagnitude;
    })
    .slice(0, 3);

  return (
    <div className={cn("space-y-8", className)}>
      {/* Archetype Blend - Editorial Style */}
      {topArchetypes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium text-foreground">Your Archetype Blend</h4>
            <span className="text-xs text-muted-foreground ml-auto">
              {Math.round(confidenceLevel)}% confidence
            </span>
          </div>

          <div className="space-y-4">
            {topArchetypes.map((archetype, index) => (
              <div key={archetype.archetype_id} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className={cn(
                    "font-serif",
                    index === 0 ? "text-lg font-medium text-foreground" : "text-sm text-muted-foreground"
                  )}>
                    {formatArchetypeName(archetype.name)}
                  </span>
                  <span className={cn(
                    "text-sm tabular-nums",
                    index === 0 ? "text-primary font-medium" : "text-muted-foreground"
                  )}>
                    {Math.round(archetype.pct)}%
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${archetype.pct}%` }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className={cn(
                      "h-full rounded-full",
                      index === 0 ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* What Shaped Your DNA - Editorial Quote Style */}
      {topContributions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h4 className="text-sm font-medium text-foreground">What shaped this</h4>
          <div className="space-y-3">
            {topContributions.map((contribution, index) => (
              <div 
                key={`${contribution.question_id}-${contribution.answer_id}`}
                className="flex items-start gap-3"
              >
                <span className="text-xs font-medium text-primary mt-0.5">
                  {index + 1}.
                </span>
                <div>
                  <p className="text-sm text-foreground/80 italic">
                    "{contribution.label}"
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {Object.entries(contribution.deltas)
                      .filter(([, delta]) => typeof delta === 'number' && delta !== 0)
                      .slice(0, 2)
                      .map(([trait, delta]) => (
                        <Badge
                          key={trait}
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {TRAIT_DISPLAY[trait]?.label || trait} {(delta as number) > 0 ? '↑' : '↓'}
                        </Badge>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Trait Scores - Collapsible */}
      {trait_scores && Object.keys(trait_scores).length > 0 && (
        <Collapsible open={isTraitsOpen} onOpenChange={setIsTraitsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-left group">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                View trait scores
              </span>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isTraitsOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-4 space-y-4"
            >
              {Object.entries(trait_scores).map(([trait, score]) => {
                const display = TRAIT_DISPLAY[trait];
                if (!display || typeof score !== 'number') return null;

                const normalizedValue = ((score + 10) / 20) * 100;
                
                return (
                  <div key={trait} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{display.low}</span>
                      <span className="font-medium text-foreground">{display.label}</span>
                      <span>{display.high}</span>
                    </div>
                    <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="absolute top-0 left-1/2 w-px h-full bg-border" />
                      <motion.div
                        initial={{ width: '50%' }}
                        animate={{ width: `${normalizedValue}%` }}
                        transition={{ duration: 0.5 }}
                        className="absolute top-0 left-0 h-full bg-primary/60 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export type { TravelDNAV2Data, ArchetypeMatch, TraitContribution };
