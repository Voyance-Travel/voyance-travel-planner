/**
 * Travel DNA Compatibility Calculator
 * 
 * Calculates preference match scores between travelers based on their Travel DNA profiles.
 */

import { supabase } from '@/integrations/supabase/client';

interface TraitScores {
  planning?: number;
  social?: number;
  comfort?: number;
  pace?: number;
  authenticity?: number;
  adventure?: number;
  budget?: number;
  transformation?: number;
}

interface TravelDNAProfile {
  user_id: string;
  trait_scores: TraitScores | null;
  primary_archetype_name: string | null;
  emotional_drivers: string[] | null;
}

/**
 * Fetch Travel DNA profile for a user
 */
export async function fetchTravelDNA(userId: string): Promise<TravelDNAProfile | null> {
  const { data, error } = await supabase
    .from('travel_dna_profiles')
    .select('user_id, trait_scores, primary_archetype_name, emotional_drivers')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  
  return {
    user_id: data.user_id,
    trait_scores: data.trait_scores as TraitScores | null,
    primary_archetype_name: data.primary_archetype_name,
    emotional_drivers: data.emotional_drivers,
  };
}

/**
 * Calculate compatibility score between two Travel DNA profiles
 * Returns a score from 0-100 where higher = more compatible
 */
export function calculateCompatibility(
  profile1: TravelDNAProfile,
  profile2: TravelDNAProfile
): number {
  const traits1 = profile1.trait_scores || {};
  const traits2 = profile2.trait_scores || {};

  // Core traits to compare (all on -10 to +10 scale)
  const traitKeys: (keyof TraitScores)[] = [
    'planning', 'social', 'comfort', 'pace', 
    'authenticity', 'adventure', 'budget', 'transformation'
  ];

  let totalDiff = 0;
  let comparableTraits = 0;

  for (const trait of traitKeys) {
    const val1 = traits1[trait];
    const val2 = traits2[trait];
    
    if (val1 !== undefined && val2 !== undefined) {
      // Calculate absolute difference (max diff = 20 on -10 to +10 scale)
      const diff = Math.abs(val1 - val2);
      totalDiff += diff;
      comparableTraits++;
    }
  }

  if (comparableTraits === 0) {
    // No comparable traits - return neutral score
    return 75;
  }

  // Average difference per trait (0-20 scale)
  const avgDiff = totalDiff / comparableTraits;
  
  // Convert to compatibility score (0-100)
  // avgDiff of 0 = 100% compatible, avgDiff of 20 = 0% compatible
  const baseScore = Math.round((1 - avgDiff / 20) * 100);

  // Bonus for matching archetypes
  const archetypeBonus = 
    profile1.primary_archetype_name && 
    profile2.primary_archetype_name &&
    profile1.primary_archetype_name === profile2.primary_archetype_name
      ? 5
      : 0;

  // Bonus for shared emotional drivers
  const drivers1 = new Set(profile1.emotional_drivers || []);
  const drivers2 = profile2.emotional_drivers || [];
  const sharedDrivers = drivers2.filter(d => drivers1.has(d)).length;
  const driverBonus = Math.min(sharedDrivers * 2, 5);

  return Math.min(100, Math.max(0, baseScore + archetypeBonus + driverBonus));
}

/**
 * Calculate compatibility between current user and a friend
 * Returns the match score (0-100) or null if DNA unavailable
 */
export async function calculateGuestCompatibility(
  currentUserId: string,
  guestUserId: string
): Promise<number | null> {
  try {
    // Fetch both profiles in parallel
    const [currentProfile, guestProfile] = await Promise.all([
      fetchTravelDNA(currentUserId),
      fetchTravelDNA(guestUserId),
    ]);

    if (!currentProfile || !guestProfile) {
      // One or both users don't have Travel DNA
      return null;
    }

    if (!currentProfile.trait_scores || !guestProfile.trait_scores) {
      // Profiles exist but no trait scores
      return null;
    }

    return calculateCompatibility(currentProfile, guestProfile);
  } catch (error) {
    console.error('[Compatibility] Error calculating:', error);
    return null;
  }
}
