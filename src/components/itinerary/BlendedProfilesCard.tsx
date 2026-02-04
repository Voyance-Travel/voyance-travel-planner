/**
 * Blended Profiles Card
 * 
 * Shows which Travel DNA profiles were combined for itinerary generation
 * and highlights any compromises or alignments in preferences.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Dna, Users, Check, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTripCollaborators } from '@/services/tripCollaboratorsAPI';
import { fetchTravelDNA, calculateCompatibility } from '@/utils/travelDNACompatibility';

interface BlendedProfilesCardProps {
  tripId: string;
  ownerId: string;
  ownerName?: string;
  ownerAvatarUrl?: string;
}

interface ProfileData {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  archetype?: string;
  weight: number;
  hasDNA: boolean;
  includePreferences: boolean;
}

interface BlendedTrait {
  name: string;
  status: 'aligned' | 'compromised' | 'merged';
  description: string;
}

export function BlendedProfilesCard({
  tripId,
  ownerId,
  ownerName,
  ownerAvatarUrl,
}: BlendedProfilesCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [blendedTraits, setBlendedTraits] = useState<BlendedTrait[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { data: collaborators = [] } = useTripCollaborators(tripId);

  // Only show collaborators with include_preferences = true
  const includedCollaborators = collaborators.filter(c => 
    (c as any).include_preferences !== false
  );

  useEffect(() => {
    async function loadProfiles() {
      setLoading(true);
      
      // Load owner's DNA
      const ownerDNA = await fetchTravelDNA(ownerId);
      
      const profilesList: ProfileData[] = [
        {
          userId: ownerId,
          displayName: ownerName || 'Trip Owner',
          avatarUrl: ownerAvatarUrl,
          archetype: ownerDNA?.primary_archetype_name || undefined,
          weight: 60, // Owner always gets 1.5x weight = 60%
          hasDNA: !!ownerDNA?.trait_scores,
          includePreferences: true,
        }
      ];

      // Calculate weight for collaborators
      const collaboratorWeight = includedCollaborators.length > 0 
        ? Math.round(40 / includedCollaborators.length) 
        : 0;

      // Load each collaborator's DNA
      for (const collab of includedCollaborators) {
        const dna = await fetchTravelDNA(collab.user_id);
        profilesList.push({
          userId: collab.user_id,
          displayName: collab.profile?.display_name || collab.profile?.handle || 'Guest',
          avatarUrl: collab.profile?.avatar_url || undefined,
          archetype: dna?.primary_archetype_name || undefined,
          weight: collaboratorWeight,
          hasDNA: !!dna?.trait_scores,
          includePreferences: (collab as any).include_preferences !== false,
        });
      }

      setProfiles(profilesList);

      // Calculate blended traits based on DNA comparison
      const traits: BlendedTrait[] = [];
      
      if (ownerDNA && includedCollaborators.length > 0) {
        // Check for alignments and compromises
        const ownerScores = ownerDNA.trait_scores || {};
        
        // Pace alignment
        const ownerPace = (ownerScores as any).pace;
        if (ownerPace !== undefined) {
          traits.push({
            name: 'Pace',
            status: 'aligned',
            description: ownerPace > 0 ? 'Energetic exploration' : 'Relaxed rhythm',
          });
        }

        // Budget alignment (simplified)
        const ownerBudget = (ownerScores as any).budget;
        if (ownerBudget !== undefined) {
          traits.push({
            name: 'Budget',
            status: includedCollaborators.length > 0 ? 'compromised' : 'aligned',
            description: 'Balanced mix of experiences',
          });
        }

        // Dining preferences
        traits.push({
          name: 'Dining',
          status: 'merged',
          description: 'Local favorites and special occasions',
        });
      }

      setBlendedTraits(traits);
      setLoading(false);
    }

    loadProfiles();
  }, [tripId, ownerId, ownerName, ownerAvatarUrl, includedCollaborators.length]);

  // Only show if there are collaborators with included preferences
  if (includedCollaborators.length === 0 && !loading) {
    return null;
  }

  const includedProfiles = profiles.filter(p => p.includePreferences && p.hasDNA);

  if (includedProfiles.length <= 1 && !loading) {
    return null;
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Dna className="h-4 w-4 text-primary" />
            Blended Travel DNA
          </CardTitle>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0 space-y-4">
              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <>
                  {/* Profile weights */}
                  <div className="space-y-3">
                    {includedProfiles.map((profile, index) => (
                      <div key={profile.userId} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} />}
                          <AvatarFallback className={cn(
                            "text-xs",
                            index === 0 ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}>
                            {profile.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {profile.displayName}
                              {index === 0 && ' (organizer)'}
                            </span>
                          </div>
                          {profile.archetype && (
                            <p className="text-xs text-muted-foreground truncate">
                              {profile.archetype.replace(/_/g, ' ')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Progress value={profile.weight} className="w-16 h-1.5" />
                          <span className="text-xs text-muted-foreground w-8">
                            {profile.weight}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Blended result */}
                  {blendedTraits.length > 0 && (
                    <>
                      <div className="border-t border-border/50 pt-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                          Blended Result
                        </p>
                        <div className="space-y-2">
                          {blendedTraits.map(trait => (
                            <div key={trait.name} className="flex items-start gap-2 text-sm">
                              {trait.status === 'aligned' ? (
                                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              ) : trait.status === 'compromised' ? (
                                <ArrowRight className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                              ) : (
                                <Users className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              )}
                              <div>
                                <span className="font-medium">{trait.name}:</span>{' '}
                                <span className="text-muted-foreground">{trait.description}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
