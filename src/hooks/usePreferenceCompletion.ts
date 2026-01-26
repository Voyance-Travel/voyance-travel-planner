/**
 * Hook to check user's preference completion status for personalization
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PreferenceStatus {
  hasQuiz: boolean;
  hasDNA: boolean;
  confidence: number;
  missingItems: MissingItem[];
  completionPercent: number;
  canGenerate: boolean;  // true if minimum requirements met
  personalizationLevel: 'none' | 'basic' | 'good' | 'excellent';
}

export interface MissingItem {
  id: string;
  label: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  action: string;  // Route or action to take
}

const MISSING_ITEMS_CONFIG: Record<string, Omit<MissingItem, 'id'>> = {
  quiz: {
    label: 'Travel DNA Quiz',
    description: 'Discover your travel personality for personalized recommendations',
    impact: 'high',
    action: '/quiz',
  },
  dietary: {
    label: 'Dietary preferences',
    description: 'Get restaurant recommendations that match your diet',
    impact: 'medium',
    action: '/profile?tab=preferences',
  },
  pace: {
    label: 'Travel pace',
    description: 'Match activity density to your energy level',
    impact: 'medium',
    action: '/profile?tab=preferences',
  },
  interests: {
    label: 'Interests & activities',
    description: 'See more of what you love in your itinerary',
    impact: 'medium',
    action: '/profile?tab=preferences',
  },
  budget: {
    label: 'Budget preferences',
    description: 'Get recommendations within your price range',
    impact: 'high',
    action: '/profile?tab=preferences',
  },
};

export function usePreferenceCompletion() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['preference-completion', user?.id],
    queryFn: async (): Promise<PreferenceStatus> => {
      if (!user?.id) {
        return {
          hasQuiz: false,
          hasDNA: false,
          confidence: 0,
          missingItems: [{ id: 'quiz', ...MISSING_ITEMS_CONFIG.quiz }],
          completionPercent: 0,
          canGenerate: true,  // Allow generation even without preferences
          personalizationLevel: 'none',
        };
      }

      // Fetch travel DNA profile
      const { data: dnaProfile } = await supabase
        .from('travel_dna_profiles')
        .select('dna_confidence_score, trait_scores, travel_dna_v2')
        .eq('user_id', user.id)
        .maybeSingle();

      // Fetch user profile for quiz completion and travel DNA
      const { data: profile } = await supabase
        .from('profiles')
        .select('quiz_completed, travel_dna, travel_dna_overrides')
        .eq('id', user.id)
        .maybeSingle();

      const hasQuiz = profile?.quiz_completed === true;
      const hasDNA = !!dnaProfile?.trait_scores || !!dnaProfile?.travel_dna_v2;
      const confidence = dnaProfile?.dna_confidence_score ?? 0;
      const traitScores = dnaProfile?.trait_scores as Record<string, number> | null;
      const travelDNA = profile?.travel_dna as Record<string, unknown> | null;

      // Determine missing items
      const missingItems: MissingItem[] = [];

      if (!hasQuiz) {
        missingItems.push({ id: 'quiz', ...MISSING_ITEMS_CONFIG.quiz });
      } else {
        // Quiz completed but check for specific missing data
        if (!traitScores?.pace && traitScores?.pace !== 0) {
          missingItems.push({ id: 'pace', ...MISSING_ITEMS_CONFIG.pace });
        }
        if (!traitScores?.budget && traitScores?.budget !== 0) {
          missingItems.push({ id: 'budget', ...MISSING_ITEMS_CONFIG.budget });
        }
      }

      // Check dietary preferences from travel_dna
      const hasDietary = travelDNA?.dietary_restrictions && 
        (Array.isArray(travelDNA.dietary_restrictions) 
          ? (travelDNA.dietary_restrictions as unknown[]).length > 0 
          : Object.keys(travelDNA.dietary_restrictions as object).length > 0);
      
      if (!hasDietary) {
        missingItems.push({ id: 'dietary', ...MISSING_ITEMS_CONFIG.dietary });
      }

      // Check interests from travel_dna
      const hasInterests = travelDNA?.interests && 
        (Array.isArray(travelDNA.interests) 
          ? (travelDNA.interests as unknown[]).length > 0 
          : true);
      
      if (!hasInterests && hasQuiz) {
        missingItems.push({ id: 'interests', ...MISSING_ITEMS_CONFIG.interests });
      }

      // Calculate completion percent
      const totalItems = Object.keys(MISSING_ITEMS_CONFIG).length;
      const completedItems = totalItems - missingItems.length;
      const completionPercent = Math.round((completedItems / totalItems) * 100);

      // Determine personalization level
      let personalizationLevel: PreferenceStatus['personalizationLevel'] = 'none';
      if (hasQuiz && confidence >= 70) {
        personalizationLevel = 'excellent';
      } else if (hasQuiz && confidence >= 50) {
        personalizationLevel = 'good';
      } else if (hasQuiz || hasDNA) {
        personalizationLevel = 'basic';
      }

      return {
        hasQuiz,
        hasDNA,
        confidence,
        missingItems,
        completionPercent,
        canGenerate: true,  // Always allow generation (soft nudge approach)
        personalizationLevel,
      };
    },
    enabled: !!user?.id,
    staleTime: 60000,  // Cache for 1 minute
  });
}
