/**
 * Blended Profiles Card
 * 
 * Shows which Travel DNA profiles were combined for itinerary generation
 * and highlights trait alignments/compromises using real blended data.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Dna, Users, Check, ArrowRight, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTripCollaborators } from '@/services/tripCollaboratorsAPI';
import { fetchTravelDNA } from '@/utils/travelDNACompatibility';
import { blendTravelDna, compareTraits, type TravelerDnaInput, type TraitComparison } from '@/utils/dnaBlending';

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

export function BlendedProfilesCard({
  tripId,
  ownerId,
  ownerName,
  ownerAvatarUrl,
}: BlendedProfilesCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [traitComparisons, setTraitComparisons] = useState<TraitComparison[]>([]);
  const [blendSummary, setBlendSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  const { data: collaborators = [] } = useTripCollaborators(tripId);

  const includedCollaborators = collaborators.filter(c => 
    (c as any).include_preferences !== false
  );

  useEffect(() => {
    async function loadProfiles() {
      setLoading(true);
      
      // Load owner's DNA
      const ownerDNA = await fetchTravelDNA(ownerId);
      
      // Build TravelerDnaInput array for blending
      const travelerInputs: TravelerDnaInput[] = [{
        userId: ownerId,
        name: ownerName || 'Trip Owner',
        archetypeId: ownerDNA?.primary_archetype_name || 'balanced_story_collector',
        traitScores: (ownerDNA?.trait_scores as Record<string, number>) || {},
        isOwner: true,
        includePreferences: true,
      }];

      const profilesList: ProfileData[] = [{
        userId: ownerId,
        displayName: ownerName || 'Trip Owner',
        avatarUrl: ownerAvatarUrl,
        archetype: ownerDNA?.primary_archetype_name || undefined,
        weight: 0,
        hasDNA: !!ownerDNA?.trait_scores,
        includePreferences: true,
      }];

      // Load each collaborator's DNA
      for (const collab of includedCollaborators) {
        const dna = await fetchTravelDNA(collab.user_id);
        const includesPrefs = (collab as any).include_preferences !== false;
        
        travelerInputs.push({
          userId: collab.user_id,
          name: collab.profile?.display_name || collab.profile?.handle || 'Guest',
          archetypeId: dna?.primary_archetype_name || 'balanced_story_collector',
          traitScores: (dna?.trait_scores as Record<string, number>) || {},
          isOwner: false,
          includePreferences: includesPrefs,
        });

        profilesList.push({
          userId: collab.user_id,
          displayName: collab.profile?.display_name || collab.profile?.handle || 'Guest',
          avatarUrl: collab.profile?.avatar_url || undefined,
          archetype: dna?.primary_archetype_name || undefined,
          weight: 0,
          hasDNA: !!dna?.trait_scores,
          includePreferences: includesPrefs,
        });
      }

      // Run the blending algorithm
      const blendResult = blendTravelDna(travelerInputs);
      
      // Update weights in profiles
      for (const profile of profilesList) {
        const blendProfile = blendResult.travelerProfiles.find(p => p.userId === profile.userId);
        if (blendProfile) {
          profile.weight = Math.round(blendProfile.weight * 100);
        }
      }

      setProfiles(profilesList);

      // Compare traits if blended
      if (blendResult.isBlended && ownerDNA?.trait_scores) {
        const comparisons = compareTraits(
          ownerDNA.trait_scores as Record<string, number>,
          blendResult.blendedTraits
        );
        setTraitComparisons(comparisons);

        // Build summary text
        const archetypeNames = blendResult.travelerProfiles.map(p => {
          const formatted = p.archetypeId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          return `${formatted} (${Math.round(p.weight * 100)}%)`;
        });
        setBlendSummary(`Blends ${archetypeNames.join(' + ')}`);
      }

      setLoading(false);
    }

    loadProfiles();
  }, [tripId, ownerId, ownerName, ownerAvatarUrl, includedCollaborators.length]);

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
        {!expanded && blendSummary && (
          <p className="text-xs text-muted-foreground mt-1">{blendSummary}</p>
        )}
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

                  {/* Blended trait comparisons */}
                  {traitComparisons.length > 0 && (
                    <div className="border-t border-border/50 pt-3">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Blended Result
                      </p>
                      <div className="space-y-2">
                        {traitComparisons.map(trait => (
                          <div key={trait.name} className="flex items-start gap-2 text-sm">
                            {trait.status === 'aligned' ? (
                              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            ) : trait.status === 'compromised' ? (
                              <ArrowRight className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <ArrowUp className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <span className="font-medium">{trait.name}:</span>{' '}
                              <span className="text-muted-foreground">{trait.description}</span>
                              {trait.status === 'compromised' && (
                                <Badge variant="outline" className="ml-1.5 text-[10px] py-0 px-1 text-amber-600 border-amber-300">
                                  compromised
                                </Badge>
                              )}
                              {trait.status === 'boosted' && (
                                <Badge variant="outline" className="ml-1.5 text-[10px] py-0 px-1 text-blue-600 border-blue-300">
                                  boosted
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No DNA warning */}
                  {profiles.some(p => p.includePreferences && !p.hasDNA) && (
                    <div className="border-t border-border/50 pt-3">
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <p>
                          {profiles.filter(p => p.includePreferences && !p.hasDNA).map(p => p.displayName).join(', ')}{' '}
                          {profiles.filter(p => p.includePreferences && !p.hasDNA).length === 1 ? "hasn't" : "haven't"} taken the Travel DNA quiz yet. 
                          Their preferences won't be included in the blend.
                        </p>
                      </div>
                    </div>
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
