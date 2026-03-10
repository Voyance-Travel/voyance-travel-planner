/**
 * Preference Context Module
 * Builds rich AI prompt context from user preferences, Travel DNA,
 * and behavioral enrichment data.
 */

import {
  deriveBudgetIntent,
  type BudgetIntent,
} from './budget-constraints.ts';

import {
  inferArchetypesFromTraits,
} from './user-context-normalization.ts';

// =============================================================================
// Types
// =============================================================================

interface TravelDNAV2 {
  user_id?: string;
  dna_version?: number;
  trait_scores?: Record<string, number>;
  archetype_matches?: Array<{
    archetype_id: string;
    name: string;
    category?: string;
    score: number;
    pct: number;
    reasons?: Array<{ trait: string; effect: string; amount: number; note?: string }>;
  }>;
  confidence?: number;
  trait_contributions?: Array<{
    question_id: string;
    answer_id: string;
    label?: string;
    deltas: Record<string, number>;
    normalized_multiplier: number;
  }>;
  budget_polarity_version?: number;
}

export interface TravelDNAProfile {
  user_id: string;
  trait_scores?: Record<string, number>;
  travel_dna_v2?: TravelDNAV2;
  archetype_matches?: TravelDNAV2['archetype_matches'];
  confidence?: number;
  dna_version?: number;
  primary_archetype_name?: string | null;
  secondary_archetype_name?: string | null;
  dna_confidence_score?: number | null;
  confidence_score?: any;
  travel_dna?: Record<string, unknown>;
}

export interface PreferenceProfile {
  user_id: string;
  interests?: string[];
  travel_pace?: string;
  budget_tier?: string;
  dining_style?: string;
  activity_level?: string;
  dietary_restrictions?: string[];
  accessibility_needs?: string[];
  mobility_needs?: string;
  mobility_level?: string;
  climate_preferences?: string[];
  eco_friendly?: boolean;
}

// =============================================================================
// Budget Trait Polarity Normalization
// =============================================================================

function normalizeBudgetTraitForPolarity(budgetTrait: number, polarityVersion: 1 | 2): number {
  return polarityVersion === 1 ? -budgetTrait : budgetTrait;
}

// =============================================================================
// Data Fetching Functions
// =============================================================================

export async function getTravelDNAV2(supabase: any, userId: string): Promise<TravelDNAProfile | null> {
  try {
    const { data: dnaProfile, error: dnaError } = await supabase
      .from('travel_dna_profiles')
      .select('user_id, trait_scores, travel_dna_v2, archetype_matches, dna_version')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (dnaProfile?.travel_dna_v2) {
      console.log('[TravelDNA] Found v2 profile with archetype blend');
      
      const v2Data = dnaProfile.travel_dna_v2;
      const polarityVersion = (v2Data.budget_polarity_version ?? 1) as 1 | 2;
      let normalizedTraitScores = v2Data.trait_scores;
      const rawBudget = normalizedTraitScores?.budget;
      
      if (rawBudget !== undefined) {
        const normalizedBudget = normalizeBudgetTraitForPolarity(rawBudget, polarityVersion);
        if (normalizedBudget !== rawBudget) {
          console.log(`[TravelDNA] Normalizing budget from polarity v${polarityVersion}: ${rawBudget} -> ${normalizedBudget}`);
        }
        normalizedTraitScores = {
          ...normalizedTraitScores,
          budget: normalizedBudget,
        };
      }
      
      return {
        user_id: dnaProfile.user_id,
        trait_scores: normalizedTraitScores,
        travel_dna_v2: { ...v2Data, trait_scores: normalizedTraitScores },
        archetype_matches: v2Data.archetype_matches,
        confidence: v2Data.confidence,
        dna_version: 2,
      };
    }

    if (dnaProfile?.archetype_matches) {
      console.log('[TravelDNA] Found v1 profile with archetype_matches - normalizing budget polarity');
      let traitScores = dnaProfile.trait_scores;
      
      if (traitScores?.budget !== undefined) {
        traitScores = {
          ...traitScores,
          budget: normalizeBudgetTraitForPolarity(traitScores.budget, 1),
        };
      }
      
      return {
        user_id: dnaProfile.user_id,
        trait_scores: traitScores,
        archetype_matches: dnaProfile.archetype_matches,
        dna_version: 1,
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('travel_dna, travel_dna_overrides')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.travel_dna) {
      const dna = profile.travel_dna as Record<string, unknown>;
      console.log('[TravelDNA] Found profile.travel_dna blob');
      
      const primaryArchetype = dna.primary_archetype_name;
      const secondaryArchetype = dna.secondary_archetype_name;
      console.log(`[TravelDNA] Archetype from profile: primary=${primaryArchetype}, secondary=${secondaryArchetype}`);
      
      let traitScores = dna.trait_scores as Record<string, number>;
      
      if (traitScores?.budget !== undefined) {
        traitScores = {
          ...traitScores,
          budget: normalizeBudgetTraitForPolarity(traitScores.budget, 1),
        };
      }
      
      return {
        user_id: userId,
        trait_scores: traitScores,
        travel_dna: dna,
        dna_version: 1,
      };
    }

    return null;
  } catch (e) {
    console.error('[TravelDNA] Error fetching:', e);
    return null;
  }
}

export async function getTraitOverrides(supabase: any, userId: string): Promise<Record<string, number> | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('travel_dna_overrides')
      .eq('id', userId)
      .maybeSingle();
    
    if (data?.travel_dna_overrides && typeof data.travel_dna_overrides === 'object') {
      console.log('[TravelDNA] Found trait overrides');
      return data.travel_dna_overrides as Record<string, number>;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getUserPreferences(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select(`
        interests, 
        travel_pace, 
        budget_tier, 
        dining_style, 
        activity_level,
        dietary_restrictions,
        accessibility_needs,
        mobility_needs,
        mobility_level,
        hotel_style,
        accommodation_style,
        flight_preferences,
        flight_time_preference,
        seat_preference,
        direct_flights_only,
        climate_preferences,
        weather_preferences,
        preferred_regions,
        eco_friendly,
        traveler_type,
        travel_vibes,
        planning_preference,
        travel_companions,
        vibe,
        travel_style,
        primary_goal,
        emotional_drivers,
        food_likes,
        food_dislikes,
        active_hours_per_day,
        allergies
      `)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getLearnedPreferences(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_preference_insights')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getBehavioralEnrichment(supabase: any, userId: string) {
  try {
    const { data: enrichments } = await supabase
      .from('user_enrichment')
      .select('enrichment_type, entity_id, entity_name, interaction_count, metadata')
      .eq('user_id', userId)
      .in('enrichment_type', ['category_preference', 'activity_remove', 'time_change'])
      .order('interaction_count', { ascending: false })
      .limit(50);
    
    if (!enrichments?.length) return null;
    
    const categoryScores = new Map<string, number>();
    const removedCategories: string[] = [];
    const timePrefs: { category: string; slot: string }[] = [];
    
    for (const e of enrichments) {
      if (e.enrichment_type === 'category_preference') {
        const weight = e.metadata?.weight || 1;
        const current = categoryScores.get(e.entity_id) || 0;
        categoryScores.set(e.entity_id, current + weight * (e.interaction_count || 1));
      } else if (e.enrichment_type === 'activity_remove' && e.metadata?.category) {
        removedCategories.push(e.metadata.category);
      } else if (e.enrichment_type === 'time_change' && e.metadata?.category && e.metadata?.new_slot) {
        timePrefs.push({ category: e.metadata.category, slot: e.metadata.new_slot });
      }
    }
    
    const likedCategories = Array.from(categoryScores.entries())
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat.replace(/_/g, ' '));
    
    const avoidedCategories = [...new Set(removedCategories)].slice(0, 5);
    
    return { likedCategories, avoidedCategories, timePrefs };
  } catch {
    return null;
  }
}

export async function getCollaboratorPreferences(supabase: any, tripId: string): Promise<PreferenceProfile[]> {
  try {
    const { data: collaborators, error: collabError } = await supabase
      .from('trip_collaborators')
      .select('user_id, include_preferences')
      .eq('trip_id', tripId)
      .eq('include_preferences', true);

    if (collabError || !collaborators?.length) {
      return [];
    }

    const userIds = collaborators.map((c: { user_id: string }) => c.user_id);
    
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences_safe')
      .select('*')
      .in('user_id', userIds);

    if (prefError) {
      console.error('[GroupBlend] Error fetching collaborator preferences:', prefError);
      return [];
    }

    return (preferences || []) as PreferenceProfile[];
  } catch (e) {
    console.error('[GroupBlend] Error:', e);
    return [];
  }
}

// =============================================================================
// Group Preference Blending
// =============================================================================

export function blendGroupPreferences(
  profiles: PreferenceProfile[],
  organizerId?: string
): PreferenceProfile | null {
  if (profiles.length === 0) return null;
  if (profiles.length === 1) return profiles[0];

  console.log(`[GroupBlend] Blending preferences for ${profiles.length} travelers`);

  const weights = profiles.map(p => p.user_id === organizerId ? 1.5 : 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights = weights.map(w => w / totalWeight);

  const interestCounts: Record<string, number> = {};
  profiles.forEach((p, idx) => {
    (p.interests || []).forEach(interest => {
      interestCounts[interest] = (interestCounts[interest] || 0) + normalizedWeights[idx];
    });
  });
  const blendedInterests = Object.entries(interestCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([interest]) => interest);

  const paceCounts: Record<string, number> = {};
  profiles.forEach((p, idx) => {
    if (p.travel_pace) {
      paceCounts[p.travel_pace] = (paceCounts[p.travel_pace] || 0) + normalizedWeights[idx];
    }
  });
  const blendedPace = Object.entries(paceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'moderate';

  const activityCounts: Record<string, number> = {};
  profiles.forEach((p, idx) => {
    if (p.activity_level) {
      activityCounts[p.activity_level] = (activityCounts[p.activity_level] || 0) + normalizedWeights[idx];
    }
  });
  const blendedActivity = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const diningCounts: Record<string, number> = {};
  profiles.forEach((p, idx) => {
    if (p.dining_style) {
      diningCounts[p.dining_style] = (diningCounts[p.dining_style] || 0) + normalizedWeights[idx];
    }
  });
  const blendedDining = Object.entries(diningCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const allDietary = new Set<string>();
  profiles.forEach(p => {
    (p.dietary_restrictions || []).forEach(d => allDietary.add(d));
  });

  const allAccessibility = new Set<string>();
  profiles.forEach(p => {
    (p.accessibility_needs || []).forEach(a => allAccessibility.add(a));
  });

  const mobilityLevels = ['limited', 'moderate', 'active', 'very_active'];
  let mostRestrictiveMobility = 'active';
  profiles.forEach(p => {
    if (p.mobility_level) {
      const currentIdx = mobilityLevels.indexOf(mostRestrictiveMobility);
      const newIdx = mobilityLevels.indexOf(p.mobility_level);
      if (newIdx < currentIdx) mostRestrictiveMobility = p.mobility_level;
    }
  });

  const anyEcoFriendly = profiles.some(p => p.eco_friendly);

  const climateSets = profiles.map(p => new Set(p.climate_preferences || []));
  let blendedClimate: string[] = [];
  if (climateSets.every(s => s.size > 0)) {
    const first = climateSets[0];
    const intersection = [...first].filter(c => climateSets.every(s => s.has(c)));
    if (intersection.length > 0) {
      blendedClimate = intersection;
    } else {
      const union = new Set<string>();
      climateSets.forEach(s => s.forEach(c => union.add(c)));
      blendedClimate = [...union];
    }
  }

  console.log(`[GroupBlend] Result: ${blendedInterests.length} interests, pace=${blendedPace}, ${allDietary.size} dietary restrictions`);

  return {
    user_id: 'blended',
    interests: blendedInterests,
    travel_pace: blendedPace,
    activity_level: blendedActivity,
    dining_style: blendedDining,
    dietary_restrictions: [...allDietary],
    accessibility_needs: [...allAccessibility],
    mobility_level: mostRestrictiveMobility,
    climate_preferences: blendedClimate,
    eco_friendly: anyEcoFriendly,
  };
}

// =============================================================================
// Build Travel DNA Context
// =============================================================================

export async function buildTravelDNAContext(
  dna: TravelDNAProfile | null, 
  overrides: Record<string, number> | null,
  budgetTier?: string,
  supabase?: any,
  userId?: string
): Promise<{ context: string; budgetIntent: BudgetIntent | null }> {
  if (!dna) return { context: '', budgetIntent: null };

  const sections: string[] = [];
  
  const traitScores = overrides 
    ? { ...dna.trait_scores, ...overrides }
    : dna.trait_scores;
  
  const budgetTrait = traitScores?.budget as number | undefined;
  const comfortTrait = traitScores?.comfort as number | undefined;
  const budgetIntent = deriveBudgetIntent(budgetTier, budgetTrait, comfortTrait);
  
  if (budgetIntent.conflict && supabase && userId) {
    try {
      await supabase.from('voyance_events').insert({
        user_id: userId,
        event_type: 'budget_intent_conflict',
        properties: {
          budget_tier: budgetTier,
          budget_trait: budgetTrait,
          comfort_trait: comfortTrait,
          resolved_tier: budgetIntent.tier,
          resolved_spend_style: budgetIntent.spendStyle,
          price_sensitivity: budgetIntent.priceSensitivity,
          conflict_details: budgetIntent.conflictDetails,
          notes: budgetIntent.notes,
        },
      });
      console.log('[BudgetIntent] Logged conflict event to voyance_events');
    } catch (logErr) {
      console.warn('[BudgetIntent] Failed to log event:', logErr);
    }
  }
  
  let budgetSection = `\n💰 BUDGET INTENT:\n🎯 ${budgetIntent.notes}`;
  budgetSection += `\n✅ PRIORITIZE: ${budgetIntent.prioritize.slice(0, 3).join('; ')}`;
  budgetSection += `\n❌ AVOID: ${budgetIntent.avoid.slice(0, 3).join('; ')}`;
  budgetSection += `\n📊 Upgrade cadence: ${budgetIntent.splurgeCadence.dinners} dinners, ${budgetIntent.splurgeCadence.experiences} experiences`;
  
  sections.push(budgetSection);
  
  const explicitPrimary =
    (dna as any)?.primary_archetype_name ||
    (dna as any)?.travel_dna?.primary_archetype_name;
  const explicitSecondary =
    (dna as any)?.secondary_archetype_name ||
    (dna as any)?.travel_dna?.secondary_archetype_name;

  let archetypes: Array<{ name: string; pct: number }> | undefined = undefined;
  if (explicitPrimary && typeof explicitPrimary === 'string') {
    archetypes = [
      { name: explicitPrimary, pct: explicitSecondary ? 70 : 100 },
      ...(explicitSecondary && typeof explicitSecondary === 'string'
        ? [{ name: explicitSecondary, pct: 30 }]
        : []),
    ];
    console.log(`[TravelDNA] Using explicit archetypes (no inference): primary=${explicitPrimary}, secondary=${explicitSecondary || 'none'}`);
  } else {
    archetypes = dna.travel_dna_v2?.archetype_matches || dna.archetype_matches;
  }
  const confidence = dna.travel_dna_v2?.confidence ?? dna.confidence ?? 75;
  
  if ((!archetypes || archetypes.length === 0) && traitScores) {
    archetypes = inferArchetypesFromTraits(traitScores);
    if (archetypes && archetypes.length > 0) {
      console.log('[TravelDNA] Inferred archetypes from trait scores:', archetypes.map(a => a.name));
    }
  }
  
  if (archetypes && archetypes.length > 0) {
    const blendParts = archetypes.slice(0, 3).map((a) => 
      `${a.name.replace(/_/g, ' ')} (${Math.round(a.pct)}%)`
    );
    
    const confidenceLabel = confidence >= 80 ? 'High' : confidence >= 60 ? 'Moderate' : 'Uncertain';
    
    let personaSection = `\n${'='.repeat(60)}\n🧬 TRAVEL DNA ARCHETYPE BLEND\n${'='.repeat(60)}`;
    personaSection += `\nArchetype Blend: ${blendParts.join(' + ')}`;
    personaSection += `\nConfidence: ${Math.round(confidence)}/100 (${confidenceLabel})`;
    
    if (confidence < 60) {
      personaSection += `\n\n⚠️ LOW CONFIDENCE NOTICE:`;
      personaSection += `\n   - This traveler's profile has mixed signals or is still being refined`;
      personaSection += `\n   - Avoid overly assertive persona-based recommendations`;
      personaSection += `\n   - Include more variety and let activities speak for themselves`;
      personaSection += `\n   - Consider offering 2 stylistic alternatives for key decisions`;
    } else if (confidence >= 80) {
      personaSection += `\n\n✅ HIGH CONFIDENCE:`;
      personaSection += `\n   - Lean into the primary archetype's preferences confidently`;
      personaSection += `\n   - Personalization can be more specific and targeted`;
    }
    
    sections.push(personaSection);
  }
  
  if (traitScores && Object.keys(traitScores).length > 0) {
    const traitLabels: Record<string, [string, string]> = {
      planning: ['Spontaneous', 'Detailed Planner'],
      social: ['Solo/Intimate', 'Social/Group'],
      pace: ['Relaxed', 'Fast-Paced'],
      authenticity: ['Tourist-Friendly', 'Local/Authentic'],
      adventure: ['Safe/Comfortable', 'Adventurous'],
      transformation: ['Leisure', 'Growth-Focused'],
    };
    
    let traitSection = `\n${'='.repeat(60)}\n📊 TRAIT PROFILE (Non-Budget)\n${'='.repeat(60)}`;
    
    for (const [trait, score] of Object.entries(traitScores)) {
      if (trait === 'budget' || trait === 'comfort') continue;
      
      const labels = traitLabels[trait];
      if (labels && typeof score === 'number') {
        const normalized = Math.round(score);
        const direction = normalized > 0 ? labels[1] : normalized < 0 ? labels[0] : 'Balanced';
        const intensity = Math.abs(normalized) >= 7 ? 'Strong' : Math.abs(normalized) >= 4 ? 'Moderate' : 'Slight';
        traitSection += `\n   ${trait}: ${normalized > 0 ? '+' : ''}${normalized}/10 → ${intensity} ${direction}`;
      }
    }
    
    if (overrides && Object.keys(overrides).length > 0) {
      traitSection += `\n\n   ⚙️ User has manually adjusted some traits - respect these preferences.`;
    }
    
    sections.push(traitSection);
  }
  
  return { context: sections.join('\n'), budgetIntent };
}

// =============================================================================
// Build Preference Context (from user prefs + learned insights)
// =============================================================================

export function buildPreferenceContext(insights: any, prefs: any): string {
  const sections: { title: string; items: string[] }[] = [];

  if (insights) {
    const insightItems: string[] = [];
    
    const lovedTypes = Object.entries(insights.loved_activity_types || {})
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([type]) => type.replace(/_/g, ' '));
    if (lovedTypes.length > 0) {
      insightItems.push(`✅ LOVES: ${lovedTypes.join(', ')}`);
    }

    const dislikedTypes = Object.entries(insights.disliked_activity_types || {})
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([type]) => type.replace(/_/g, ' '));
    if (dislikedTypes.length > 0) {
      insightItems.push(`❌ AVOID activities: ${dislikedTypes.join(', ')}`);
    }

    if (insights.preferred_pace) {
      const formattedPace = insights.preferred_pace.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      insightItems.push(`Learned pace preference: ${formattedPace}`);
    }
    
    if (insightItems.length > 0) {
      sections.push({ title: '📊 LEARNED FROM YOUR FEEDBACK', items: insightItems });
    }
  }

  if (prefs) {
    const coreItems: string[] = [];
    const restrictionItems: string[] = [];
    const mobilityItems: string[] = [];
    const climateItems: string[] = [];
    const accommodationItems: string[] = [];
    const personaItems: string[] = [];

    if (prefs.primary_goal) {
      const goalDescriptions: Record<string, string> = {
        'explore_culture': 'immerse in local culture, history, and traditions',
        'relaxation': 'unwind and recharge with minimal stress',
        'adventure': 'seek thrills, outdoor activities, and new experiences',
        'food_wine': 'discover culinary gems and local gastronomy',
        'romance': 'create intimate, memorable moments',
        'family_fun': 'ensure everyone (especially kids) has a great time',
        'nightlife': 'experience vibrant evening entertainment',
        'shopping': 'explore local markets, boutiques, and retail',
        'wellness': 'focus on health, spa, and mindful experiences',
        'photography': 'capture stunning visuals and scenic spots',
      };
      personaItems.push(`🎯 PRIMARY GOAL: ${goalDescriptions[prefs.primary_goal] || prefs.primary_goal}`);
    }
    
    if (prefs.emotional_drivers?.length) {
      const driverDescriptions: Record<string, string> = {
        'escape': 'wants to completely disconnect from daily routine',
        'restoration': 'needs recovery and recharging energy',
        'pleasure': 'desires enjoyment, indulgence, and sensory experiences',
        'adventure': 'craves excitement and new challenges',
        'connection': 'wants meaningful relationships and cultural bonds',
        'discovery': 'driven by curiosity and learning',
        'achievement': 'seeks accomplishment and bucket-list experiences',
        'transformation': 'looking for personal growth and change',
      };
      const driverContext = prefs.emotional_drivers
        .slice(0, 5)
        .map((d: string) => driverDescriptions[d] || d)
        .join('; ');
      personaItems.push(`💫 EMOTIONAL DRIVERS: ${driverContext}`);
      personaItems.push(`   → Design activities that fulfill these emotional needs`);
    }
    
    if (prefs.travel_vibes?.length) {
      personaItems.push(`🌍 Attracted to: ${prefs.travel_vibes.join(', ')} environments`);
    }
    
    if (prefs.vibe || prefs.travel_style) {
      personaItems.push(`Overall vibe: ${prefs.vibe || prefs.travel_style}`);
    }
    
    if (prefs.travel_companions?.length) {
      const companionContext = prefs.travel_companions.map((c: string) => {
        const map: Record<string, string> = {
          'solo': 'solo traveler - include opportunities for reflection and meeting locals',
          'partner': 'traveling with partner - include romantic spots and couple activities',
          'family': 'family travel - ensure kid-friendly options and manageable pacing',
          'friends': 'group of friends - include social activities and shared experiences',
        };
        return map[c] || c;
      });
      personaItems.push(`Travel style: ${companionContext.join('; ')}`);
    }
    
    if (prefs.planning_preference) {
      const planningMap: Record<string, string> = {
        'detailed': 'Plans everything in advance - provide specific times, reservations, and backup options',
        'flexible': 'Prefers a loose framework - provide key bookings but leave room for spontaneity',
        'spontaneous': 'Minimal planning preferred - focus on must-see highlights, leave gaps for discovery',
      };
      personaItems.push(`Planning style: ${planningMap[prefs.planning_preference] || prefs.planning_preference}`);
    }
    
    if (personaItems.length > 0) {
      sections.push({ title: '🎭 TRAVELER PERSONA', items: personaItems });
    }

    if (prefs.interests?.length) {
      coreItems.push(`Interests: ${prefs.interests.slice(0, 6).join(', ')}`);
    }
    if (prefs.travel_pace) {
      const paceInstructions: Record<string, string> = {
        'relaxed': `RELAXED PACE: 
   → Maximum 4-5 activities per day (including meals)
   → Include 2+ hour downtime blocks for rest/exploration
   → No back-to-back activities - allow 30+ min REST buffers AFTER travel time
   → Prioritize quality over quantity
   → TRAVEL TIME IS SEPARATE: Add realistic travel/transit time (15-45 min depending on distance) BETWEEN activities, then add rest buffer ON TOP`,
        'balanced': `BALANCED PACE:
   → 5-6 activities per day (including meals)
   → Include at least one 1-hour downtime block
   → TRAVEL TIME IS SEPARATE from rest buffers: Add realistic travel time (15-30 min for nearby, 30-60 min for cross-city) BETWEEN activities, plus 10-15 min settling buffer
   → If two activities are in different neighborhoods, the gap should be 30-60 min, NOT 15 min
   → A 15-min gap is ONLY acceptable for activities within walking distance of each other`,
        'active': `ACTIVE PACE:
   → Can handle 7-8 activities per day
   → Minimal downtime needed - keep them moving
   → Pack the day with experiences
   → Still account for realistic travel time between locations (10-30 min minimum depending on distance)`,
      };
      coreItems.push(paceInstructions[prefs.travel_pace] || `Travel pace: ${prefs.travel_pace}`);
    }
    if (prefs.activity_level) {
      const activityInstructions: Record<string, string> = {
        'light': 'LIGHT ACTIVITY: Avoid strenuous walking, hiking, or physically demanding activities',
        'moderate': 'MODERATE ACTIVITY: Some walking is fine, but avoid exhausting activities',
        'active': 'ACTIVE: Can handle hiking, long walks, and physically demanding activities',
        'intense': 'INTENSE: Seeks challenging physical activities and adventure sports',
      };
      coreItems.push(activityInstructions[prefs.activity_level] || `Activity level: ${prefs.activity_level}`);
    }
    
    if (prefs.sleep_schedule || prefs.daytime_bias) {
      const timingItems: string[] = [];
      
      if (prefs.sleep_schedule) {
        const sleepInstructions: Record<string, string> = {
          'early_bird': `🌅 EARLY BIRD: 
   → START day at 7:00-8:00 AM
   → Schedule key attractions in morning when energy is highest
   → Plan dinner for 6:00-7:00 PM, end activities by 8:30 PM`,
          'night_owl': `🌙 NIGHT OWL:
   → START day at 10:00-11:00 AM (late breakfast)
   → Schedule key activities for afternoon/evening
   → Include nightlife, late dinners (8:00+ PM), evening tours`,
          'needs_day': `😴 NEEDS DAYTIME REST:
   → START day at 9:00-10:00 AM
   → Include a 2+ hour afternoon siesta/rest block (2-4 PM)
   → Resume activities in late afternoon
   → Plan dinner for 7:00-8:00 PM`,
        };
        timingItems.push(sleepInstructions[prefs.sleep_schedule] || `Sleep schedule: ${prefs.sleep_schedule}`);
      }
      
      if (prefs.daytime_bias) {
        const biasInstructions: Record<string, string> = {
          'morning': '☀️ MORNING PERSON: Front-load the day with key activities before noon',
          'afternoon': '🌤️ AFTERNOON PEAK: Schedule main attractions for 1:00-5:00 PM',
          'evening': '🌆 EVENING FOCUS: Light mornings, ramp up activity in late afternoon/evening',
        };
        if (biasInstructions[prefs.daytime_bias]) {
          timingItems.push(biasInstructions[prefs.daytime_bias]);
        }
      }
      
      if (timingItems.length > 0) {
        sections.push({ title: '⏰ TIMING & SCHEDULE PREFERENCES', items: timingItems });
      }
    }
    
    if (prefs.max_activities_per_day && prefs.max_activities_per_day < 8) {
      coreItems.push(`📊 MAX ${prefs.max_activities_per_day} activities per day (user-set limit)`);
    }
    if (prefs.preferred_downtime_minutes && prefs.preferred_downtime_minutes > 15) {
      coreItems.push(`⏳ Minimum ${prefs.preferred_downtime_minutes} minute buffers between activities`);
    }
    
    if (prefs.dining_style) {
      coreItems.push(`Dining style: ${prefs.dining_style}`);
    }
    if (prefs.eco_friendly) {
      coreItems.push(`🌱 Eco-conscious traveler - prefer sustainable options`);
    }
    
    if (coreItems.length > 0) {
      sections.push({ title: '🎯 TRAVEL STYLE', items: coreItems });
    }

    const foodItems: string[] = [];
    foodItems.push(`⭐ QUALITY REQUIREMENT: ONLY recommend restaurants with 4+ star ratings`);
    foodItems.push(`   → No low-quality, poorly-reviewed, or tourist-trap venues`);
    if (prefs.food_likes?.length) {
      foodItems.push(`✅ FOOD LOVES: ${prefs.food_likes.join(', ')}`);
      foodItems.push(`   → Prioritize restaurants/cafes that specialize in these cuisines`);
    }
    if (prefs.food_dislikes?.length) {
      foodItems.push(`❌ FOOD DISLIKES: ${prefs.food_dislikes.join(', ')}`);
      foodItems.push(`   → AVOID recommending these types of food/restaurants`);
    }
    if (foodItems.length > 0) {
      sections.push({ title: '🍴 FOOD PREFERENCES', items: foodItems });
    }

    if (prefs.dietary_restrictions?.length) {
      restrictionItems.push(`⚠️ DIETARY RESTRICTIONS: ${prefs.dietary_restrictions.join(', ')}`);
      restrictionItems.push(`ALL meal recommendations MUST accommodate these restrictions`);
    }
    
    if (restrictionItems.length > 0) {
      sections.push({ title: '🍽️ DIETARY REQUIREMENTS (MANDATORY)', items: restrictionItems });
    }

    if (prefs.accessibility_needs?.length || prefs.mobility_needs || prefs.mobility_level) {
      if (prefs.accessibility_needs?.length) {
        mobilityItems.push(`♿ ACCESSIBILITY NEEDS: ${prefs.accessibility_needs.join(', ')}`);
      }
      if (prefs.mobility_needs) {
        mobilityItems.push(`Mobility requirements: ${prefs.mobility_needs}`);
      }
      if (prefs.mobility_level) {
        mobilityItems.push(`Mobility level: ${prefs.mobility_level}`);
      }
      mobilityItems.push(`ALL venues MUST be accessible. Avoid long walks, steep stairs, or inaccessible locations.`);
      
      sections.push({ title: '♿ ACCESSIBILITY (MANDATORY)', items: mobilityItems });
    }

    if (prefs.climate_preferences?.length || prefs.weather_preferences?.length) {
      if (prefs.climate_preferences?.length) {
        climateItems.push(`Preferred climates: ${prefs.climate_preferences.join(', ')}`);
      }
      if (prefs.weather_preferences?.length) {
        climateItems.push(`Weather preferences: ${prefs.weather_preferences.join(', ')}`);
      }
      climateItems.push(`Schedule outdoor activities during optimal weather conditions`);
      climateItems.push(`Have indoor backup options for weather-sensitive activities`);
      
      sections.push({ title: '🌤️ CLIMATE & WEATHER PREFERENCES', items: climateItems });
    }

    if (prefs.hotel_style || prefs.accommodation_style) {
      if (prefs.hotel_style) {
        accommodationItems.push(`Hotel style: ${prefs.hotel_style}`);
      }
      if (prefs.accommodation_style) {
        accommodationItems.push(`Accommodation preference: ${prefs.accommodation_style}`);
      }
      
      sections.push({ title: '🏨 ACCOMMODATION STYLE', items: accommodationItems });
    }

    if (prefs.flight_preferences || prefs.flight_time_preference || prefs.seat_preference) {
      const flightItems: string[] = [];
      if (prefs.flight_time_preference) {
        flightItems.push(`Preferred flight times: ${prefs.flight_time_preference}`);
      }
      if (prefs.direct_flights_only) {
        flightItems.push(`Prefers direct flights only`);
      }
      
      if (flightItems.length > 0) {
        sections.push({ title: '✈️ FLIGHT PREFERENCES', items: flightItems });
      }
    }

    if (prefs.preferred_regions?.length) {
      sections.push({ 
        title: '🗺️ REGIONAL PREFERENCES', 
        items: [`Favorite regions: ${prefs.preferred_regions.join(', ')}`] 
      });
    }
  }

  if (sections.length === 0) {
    return '';
  }

  const contextParts = sections.map(section => 
    `${section.title}:\n${section.items.map(item => `  - ${item}`).join('\n')}`
  );

  return `\n\n${'='.repeat(60)}\n🎯 PERSONALIZED TRAVELER PROFILE\n${'='.repeat(60)}\n${contextParts.join('\n\n')}`;
}

// =============================================================================
// AI Preference Enrichment
// =============================================================================

export async function enrichPreferencesWithAI(prefs: any, destination: string, LOVABLE_API_KEY: string): Promise<string> {
  if (!prefs || Object.keys(prefs).filter(k => prefs[k] !== null).length === 0) {
    return "";
  }

  const prompt = `You are a travel personalization expert. Transform these raw user preferences into RICH, DETAILED guidance for an AI itinerary generator.

RAW PREFERENCES:
${JSON.stringify(prefs, null, 2)}

DESTINATION: ${destination}

Your task: Expand each preference into actionable, specific guidance. For example:
- "vegetarian" → "This traveler is vegetarian - recommend restaurants with dedicated vegetarian menus, avoid steakhouses, highlight plant-based cuisine, suggest local vegetarian specialties of ${destination}"
- "temperate climate" → "Prefers mild weather 60-75°F - schedule outdoor activities in morning/late afternoon, include shaded walking tours, have indoor alternatives for midday heat"
- "accessibility_needs: wheelchair" → "Requires wheelchair access - verify elevator access at all venues, avoid cobblestone areas, recommend accessible transportation, ensure restaurant seating accommodates wheelchairs"

Create a detailed traveler profile with:
1. **TRAVELER PERSONA** (2-3 sentences capturing their travel style and what drives them)
2. **MANDATORY CONSTRAINTS** (dietary, accessibility, allergies - these are non-negotiable)
3. **CLIMATE GUIDANCE** (how weather preferences should shape the schedule)
4. **ACTIVITY PRIORITIES** (what to emphasize based on interests)
5. **SPECIAL INSTRUCTIONS** (3-5 specific "always" or "never" rules)

Make it conversational and actionable, not a bullet list. The AI reading this should feel like they deeply understand this traveler.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a travel personalization expert. Create rich, detailed traveler profiles that help AI itinerary generators deeply understand each traveler." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      console.warn("[Preference Enrichment] AI call failed, using raw context");
      return "";
    }

    const result = await response.json();
    const enrichedProfile = result.choices?.[0]?.message?.content || "";
    
    if (enrichedProfile) {
      console.log("[Preference Enrichment] Successfully enriched preferences");
      return `\n\n${'='.repeat(60)}\n🌟 AI-ENRICHED TRAVELER PROFILE\n${'='.repeat(60)}\n${enrichedProfile}`;
    }
    
    return "";
  } catch (error) {
    console.warn("[Preference Enrichment] Error:", error);
    return "";
  }
}
