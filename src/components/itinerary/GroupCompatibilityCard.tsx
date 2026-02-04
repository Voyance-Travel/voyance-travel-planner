/**
 * Group Compatibility Card
 * 
 * Shows overall travel compatibility score for the group
 * and highlights aligned traits vs potential conflict points.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Check, Zap, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTripCollaborators, type TripCollaborator } from '@/services/tripCollaboratorsAPI';
import { fetchTravelDNA, calculateCompatibility } from '@/utils/travelDNACompatibility';

interface GroupCompatibilityCardProps {
  tripId: string;
  ownerId: string;
  compact?: boolean;
}

interface CompatibilityResult {
  overallScore: number;
  alignedTraits: string[];
  conflictTraits: string[];
  profileCount: number;
}

const TRAIT_LABELS: Record<string, string> = {
  pace: 'Travel Pace',
  budget: 'Budget Style',
  social: 'Social Style',
  planning: 'Planning Style',
  comfort: 'Comfort Level',
  adventure: 'Adventure Level',
  authenticity: 'Authenticity',
};

export function GroupCompatibilityCard({
  tripId,
  ownerId,
  compact = false,
}: GroupCompatibilityCardProps) {
  const [compatibility, setCompatibility] = useState<CompatibilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  
  const { data: collaborators = [] } = useTripCollaborators(tripId);

  // Filter to only included collaborators with DNA
  const includedCollaborators = collaborators.filter(c => 
    (c as any).include_preferences !== false
  );

  useEffect(() => {
    async function calculateGroupCompatibility() {
      if (includedCollaborators.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Fetch all DNA profiles
        const ownerDNA = await fetchTravelDNA(ownerId);
        const collabDNAs = await Promise.all(
          includedCollaborators.map(c => fetchTravelDNA(c.user_id))
        );

        // Filter to only those with valid DNA
        const validProfiles = [
          ownerDNA,
          ...collabDNAs.filter(d => d?.trait_scores)
        ].filter(Boolean);

        if (validProfiles.length < 2) {
          setLoading(false);
          return;
        }

        // Calculate pairwise compatibility scores
        const scores: number[] = [];
        for (let i = 0; i < validProfiles.length; i++) {
          for (let j = i + 1; j < validProfiles.length; j++) {
            const score = calculateCompatibility(validProfiles[i]!, validProfiles[j]!);
            scores.push(score);
          }
        }

        const averageScore = scores.length > 0 
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

        // Analyze trait alignment across all profiles
        const traitVariances: Record<string, number[]> = {};
        for (const profile of validProfiles) {
          if (!profile?.trait_scores) continue;
          for (const [trait, value] of Object.entries(profile.trait_scores)) {
            if (typeof value === 'number') {
              if (!traitVariances[trait]) traitVariances[trait] = [];
              traitVariances[trait].push(value);
            }
          }
        }

        const aligned: string[] = [];
        const conflicts: string[] = [];

        for (const [trait, values] of Object.entries(traitVariances)) {
          if (values.length < 2) continue;
          
          const min = Math.min(...values);
          const max = Math.max(...values);
          const range = max - min;
          
          const label = TRAIT_LABELS[trait] || trait;
          
          // Low variance = aligned, high variance = potential conflict
          if (range <= 5) {
            aligned.push(label);
          } else if (range >= 10) {
            conflicts.push(label);
          }
        }

        setCompatibility({
          overallScore: averageScore,
          alignedTraits: aligned.slice(0, 4),
          conflictTraits: conflicts.slice(0, 3),
          profileCount: validProfiles.length,
        });
      } catch (error) {
        console.error('[GroupCompatibility] Error:', error);
      }

      setLoading(false);
    }

    calculateGroupCompatibility();
  }, [tripId, ownerId, includedCollaborators.length]);

  // Don't show if no collaborators or still loading
  if (!compatibility || loading || includedCollaborators.length === 0) {
    return null;
  }

  const scoreColor = compatibility.overallScore >= 80 
    ? 'text-green-500' 
    : compatibility.overallScore >= 60 
      ? 'text-amber-500' 
      : 'text-orange-500';

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{compatibility.overallScore}% compatible</span>
      </div>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Group Compatibility
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score circle */}
        <div className="flex justify-center">
          <motion.div 
            className="relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-20 h-20 rounded-full border-4 border-muted flex items-center justify-center">
              <span className={cn("text-2xl font-bold", scoreColor)}>
                {compatibility.overallScore}%
              </span>
            </div>
          </motion.div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Based on {compatibility.profileCount} Travel DNA profiles
        </p>

        {/* Aligned traits */}
        {compatibility.alignedTraits.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Aligned On:</p>
            <div className="flex flex-wrap gap-1.5">
              {compatibility.alignedTraits.map(trait => (
                <Badge 
                  key={trait} 
                  variant="secondary" 
                  className="text-xs gap-1 bg-green-500/10 text-green-600 border-green-500/20"
                >
                  <Check className="h-3 w-3" />
                  {trait}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Conflict traits */}
        {compatibility.conflictTraits.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">May Need Compromise:</p>
            <div className="flex flex-wrap gap-1.5">
              {compatibility.conflictTraits.map(trait => (
                <Badge 
                  key={trait} 
                  variant="secondary" 
                  className="text-xs gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20"
                >
                  <Zap className="h-3 w-3" />
                  {trait}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
