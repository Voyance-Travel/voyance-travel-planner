// =============================================================================
// PROFILE LOADER - Single Source of Truth for Traveler Data
// =============================================================================
// This module handles ALL resolution of traveler data from multiple sources.
// It returns a unified object with NO fallbacks needed elsewhere in the code.
// If resolution fails, it fails LOUDLY with explicit errors/warnings.
// =============================================================================

import { getFullArchetypeContext, type ArchetypeContext } from './archetype-data.ts';

// =============================================================================
// TYPES
// =============================================================================

export interface TraitScores {
  pace: number;            // -10 to +10: negative = slow, positive = fast
  budget: number;          // -10 to +10: negative = luxury, positive = frugal
  social: number;          // -10 to +10: negative = solo, positive = social
  planning: number;        // -10 to +10: negative = spontaneous, positive = planned
  comfort: number;         // -10 to +10: negative = roughing it, positive = comfort
  authenticity: number;    // -10 to +10: negative = tourist, positive = local
  adventure: number;       // -10 to +10: negative = safe, positive = risky
  cultural: number;        // -10 to +10: negative = shallow, positive = deep
  transformation: number;  // -10 to +10: negative = no change, positive = growth/wellness
}

export type BudgetTier = 'budget' | 'moderate' | 'premium' | 'luxury';

export interface TravelerProfile {
  // =========================================================================
  // CANONICAL FIELDS - Single source of truth
  // =========================================================================
  
  /** Primary archetype name - NEVER null, always resolved */
  archetype: string;
  
  /** Full archetype context with all data needed for prompt building */
  archetypeContext: ArchetypeContext;
  
  /** Trait scores with defaults of 0 */
  traitScores: TraitScores;
  
  /** Budget tier from trip settings */
  budgetTier: BudgetTier;
  
  /** User interests for activity filtering */
  interests: string[];
  
  /** Dietary restrictions - critical for dining */
  dietaryRestrictions: string[];
  
  /** Things to avoid - places, activities, foods */
  avoidList: string[];
  
  /** Mobility/accessibility needs */
  mobilityNeeds: string;
  
  /** Trip-specific intents from front-end */
  tripIntents: string[];
  
  // =========================================================================
  // RESOLUTION METADATA - For debugging and logging
  // =========================================================================
  
  /** Data completeness score 0-100 */
  dataCompleteness: number;
  
  /** Source of archetype resolution */
  archetypeSource: 'canonical' | 'travel_dna_blob' | 'v2_matches' | 'legacy_matches' | 'fallback';
  
  /** Whether this is a fallback profile */
  isFallback: boolean;
  
  /** Warnings about data resolution */
  warnings: string[];
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const DEFAULT_TRAIT_SCORES: TraitScores = {
  pace: 0,
  budget: 0,
  social: 0,
  planning: 0,
  comfort: 0,
  authenticity: 0,
  adventure: 0,
  cultural: 0,
  transformation: 0,
};

const DEFAULT_ARCHETYPE = 'balanced_story_collector';

// =============================================================================
// MAIN LOADER FUNCTION
// =============================================================================

/**
 * Loads and resolves all traveler data from multiple sources into a unified profile.
 * 
 * This is the SINGLE function that handles:
 * 1. Travel DNA profile loading
 * 2. Trip preferences loading
 * 3. Archetype resolution with clear priority
 * 4. Trait score normalization
 * 5. Preference merging
 * 
 * NO fallbacks in the rest of the code - this function handles ALL resolution.
 */
export async function loadTravelerProfile(
  supabase: any,
  userId: string,
  tripId: string,
  destination?: string
): Promise<TravelerProfile> {
  const warnings: string[] = [];
  let dataCompleteness = 0;
  
  // =========================================================================
  // STEP 1: Load Travel DNA Profile
  // =========================================================================
  
  let travelDNA: any = null;
  
  if (userId) {
    const { data, error } = await supabase
      .from('travel_dna_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error(`[profile-loader] Error loading Travel DNA: ${error.message}`);
      warnings.push(`Travel DNA load error: ${error.message}`);
    } else if (data) {
      travelDNA = data;
      dataCompleteness += 40; // DNA found
      console.log(`[profile-loader] Travel DNA loaded for user ${userId}`);
    } else {
      warnings.push('No Travel DNA profile found');
      console.warn(`[profile-loader] No Travel DNA found for user ${userId}`);
    }
  } else {
    warnings.push('No user ID provided');
  }
  
  // =========================================================================
  // STEP 2: Load Trip Data (for budget tier and intents)
  // =========================================================================
  
  let tripData: any = null;
  let budgetTier: BudgetTier = 'moderate';
  let tripIntents: string[] = [];
  
  if (tripId) {
    const { data, error } = await supabase
      .from('trips')
      .select('budget_tier, trip_type, metadata')
      .eq('id', tripId)
      .maybeSingle();
    
    if (error) {
      console.error(`[profile-loader] Error loading trip: ${error.message}`);
      warnings.push(`Trip load error: ${error.message}`);
    } else if (data) {
      tripData = data;
      dataCompleteness += 20; // Trip found
      
      // Resolve budget tier
      budgetTier = normalizeBudgetTier(data.budget_tier);
      
      // Extract trip intents from trip_type
      if (data.trip_type) {
        tripIntents.push(data.trip_type);
      }
      // Extract vibe/priorities from metadata (set by parse-trip-input / Smart Finish)
      const meta = data.metadata as any;
      if (meta?.tripVibe) tripIntents.push(meta.tripVibe);
      if (Array.isArray(meta?.tripPriorities)) {
        tripIntents.push(...meta.tripPriorities);
      }
    }
  }
  
  // =========================================================================
  // STEP 2b: Load User Preferences (interests, vibes, emotional drivers)
  // =========================================================================
  
  let userPrefs: any = null;
  
  if (userId) {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('interests, travel_vibes, emotional_drivers, traveler_type')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.warn(`[profile-loader] Error loading user_preferences: ${error.message}`);
    } else if (data) {
      userPrefs = data;
    }
  }
  
  // =========================================================================
  // STEP 3: Resolve Archetype with CLEAR Priority
  // =========================================================================
  
  let archetype = DEFAULT_ARCHETYPE;
  let archetypeSource: TravelerProfile['archetypeSource'] = 'fallback';
  
  if (travelDNA) {
    // Priority 1: Canonical column (most reliable)
    if (travelDNA.primary_archetype_name) {
      archetype = travelDNA.primary_archetype_name;
      archetypeSource = 'canonical';
      dataCompleteness += 20;
    }
    // Priority 2: travel_dna_v2 blob (fixed: was incorrectly referencing travel_dna)
    else if ((travelDNA.travel_dna_v2 as any)?.primary_archetype_name) {
      archetype = (travelDNA.travel_dna_v2 as any).primary_archetype_name;
      archetypeSource = 'travel_dna_blob';
      dataCompleteness += 15;
    }
    // Priority 3: v2 archetype matches
    else if (Array.isArray(travelDNA.travel_dna_v2?.archetype_matches) && 
             travelDNA.travel_dna_v2.archetype_matches[0]?.name) {
      archetype = travelDNA.travel_dna_v2.archetype_matches[0].name;
      archetypeSource = 'v2_matches';
      dataCompleteness += 10;
    }
    // Priority 4: Legacy archetype_matches
    else if (Array.isArray(travelDNA.archetype_matches) && 
             travelDNA.archetype_matches[0]?.name) {
      archetype = travelDNA.archetype_matches[0].name;
      archetypeSource = 'legacy_matches';
      dataCompleteness += 10;
    }
    // Fallback
    else {
      warnings.push('No archetype found in Travel DNA, using fallback');
    }
  }
  
  const isFallback = archetypeSource === 'fallback';
  
  if (isFallback) {
    console.warn(`[profile-loader] ⚠️ Using fallback archetype. Travel DNA is missing or incomplete.`);
  } else {
    console.log(`[profile-loader] ✓ Resolved archetype: ${archetype} (source: ${archetypeSource})`);
  }
  
  // =========================================================================
  // STEP 4: Get Full Archetype Context
  // =========================================================================
  
  const archetypeContext = getFullArchetypeContext(archetype, destination);
  
  // =========================================================================
  // STEP 5: Resolve Trait Scores with Defaults
  // Fallback chain: travel_dna_profiles.trait_scores → profiles.travel_dna blob
  // =========================================================================
  
  let traitScores = resolveTraitScores(travelDNA);
  const hasSignal = Object.values(traitScores).some(v => v !== 0);
  
  if (!hasSignal && userId) {
    // Fallback: try profiles.travel_dna blob for legacy users
    console.warn(`[profile-loader] trait_scores all zeros — trying profiles.travel_dna fallback`);
    const { data: profileBlob } = await supabase
      .from('profiles')
      .select('travel_dna')
      .eq('id', userId)
      .maybeSingle();
    
    if (profileBlob?.travel_dna) {
      const legacyDna = profileBlob.travel_dna as Record<string, unknown>;
      const legacyScores = resolveTraitScores({ trait_scores: legacyDna.trait_scores });
      const legacyHasSignal = Object.values(legacyScores).some(v => v !== 0);
      if (legacyHasSignal) {
        traitScores = legacyScores;
        console.log(`[profile-loader] ✓ Recovered trait scores from profiles.travel_dna fallback`);
      } else {
        console.warn(`[profile-loader] profiles.travel_dna also has zero traits — using defaults`);
      }
    }
  }
  
  if (Object.values(traitScores).some(v => v !== 0)) {
    dataCompleteness += 20;
  }

  // =========================================================================
  // STEP 5b: Apply Fine-Tune trait overrides from profiles.travel_dna_overrides
  // The slider UI persists -10..+10 values per trait key. Merge them on top of
  // the base trait scores so the prompt actually reflects user adjustments.
  // =========================================================================
  if (userId) {
    try {
      const { data: overrideRow } = await supabase
        .from('profiles')
        .select('travel_dna_overrides')
        .eq('id', userId)
        .maybeSingle();

      const overrides = overrideRow?.travel_dna_overrides;
      if (overrides && typeof overrides === 'object') {
        const appliedKeys: string[] = [];
        const before: Record<string, number> = {};
        for (const key of Object.keys(traitScores) as Array<keyof TraitScores>) {
          const raw = (overrides as Record<string, unknown>)[key as string];
          const num = typeof raw === 'number' ? raw : Number(raw);
          if (Number.isFinite(num)) {
            const clamped = Math.max(-10, Math.min(10, num));
            if (clamped !== traitScores[key]) {
              before[key as string] = traitScores[key];
              traitScores[key] = clamped;
              appliedKeys.push(key as string);
            }
          }
        }
        if (appliedKeys.length > 0) {
          dataCompleteness += 5;
          warnings.push(`Trait overrides applied: ${appliedKeys.join(', ')}`);
          console.log(
            `[profile-loader] Trait overrides applied for ${userId}: ${appliedKeys
              .map(k => `${k} ${before[k]}→${traitScores[k as keyof TraitScores]}`)
              .join(', ')}`
          );
        }
      }
    } catch (e) {
      console.warn('[profile-loader] Failed to load trait overrides:', (e as Error).message);
    }
  }
  
  // =========================================================================
  // STEP 6: Extract Preferences
  // =========================================================================
  
  const interests = extractInterests(travelDNA, tripData, userPrefs, archetypeContext);
  const dietaryRestrictions = extractDietaryRestrictions(travelDNA);
  const avoidList = extractAvoidList(travelDNA, archetypeContext);
  const mobilityNeeds = extractMobilityNeeds(travelDNA);
  
  // =========================================================================
  // RETURN UNIFIED PROFILE
  // =========================================================================
  
  const profile: TravelerProfile = {
    archetype,
    archetypeContext,
    traitScores,
    budgetTier,
    interests,
    dietaryRestrictions,
    avoidList,
    mobilityNeeds,
    tripIntents,
    dataCompleteness: Math.min(100, dataCompleteness),
    archetypeSource,
    isFallback,
    warnings,
  };
  
  console.log(`[profile-loader] Profile loaded: archetype=${archetype}, completeness=${profile.dataCompleteness}%, warnings=${warnings.length}`);
  
  return profile;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function normalizeBudgetTier(tier: string | undefined | null): BudgetTier {
  const normalized = (tier || '').toLowerCase().trim();
  
  switch (normalized) {
    case 'budget':
    case 'backpacker':
    case 'economy':
      return 'budget';
    case 'moderate':
    case 'standard':
    case 'mid-range':
    case 'midrange':
      return 'moderate';
    case 'premium':
    case 'upscale':
      return 'premium';
    case 'luxury':
    case 'ultra-luxury':
    case 'first-class':
      return 'luxury';
    default:
      return 'moderate';
  }
}

function resolveTraitScores(travelDNA: any): TraitScores {
  if (!travelDNA) return { ...DEFAULT_TRAIT_SCORES };
  
  // Try multiple locations for trait scores (fixed: removed dead travel_dna reference)
  const rawScores = 
    travelDNA.trait_scores ||
    travelDNA.travel_dna_v2?.trait_scores ||
    {};
  
  // Normalize field names (some are named differently)
  return {
    pace: Number(rawScores.pace ?? rawScores.travel_pace ?? 0),
    budget: Number(rawScores.budget ?? rawScores.value_focus ?? 0),
    social: Number(rawScores.social ?? rawScores.social_battery ?? 0),
    planning: Number(rawScores.planning ?? rawScores.planning_preference ?? 0),
    comfort: Number(rawScores.comfort ?? rawScores.comfort_level ?? 0),
    authenticity: Number(rawScores.authenticity ?? rawScores.cultural_depth ?? 0),
    adventure: Number(rawScores.adventure ?? rawScores.risk_tolerance ?? 0),
    cultural: Number(rawScores.cultural ?? rawScores.cultural_interest ?? 0),
    transformation: Number(rawScores.transformation ?? rawScores.wellness ?? 0),
  };
}

function extractInterests(travelDNA: any, tripData: any, userPrefs: any, archetypeContext: ArchetypeContext): string[] {
  const interests = new Set<string>();
  
  const addArray = (arr: unknown) => {
    if (Array.isArray(arr)) arr.forEach((i: string) => { if (i) interests.add(i); });
  };
  
  // 1. user_preferences.interests (most explicit user signal)
  addArray(userPrefs?.interests);
  
  // 2. user_preferences.travel_vibes (e.g., "mountain", "coastal", "bold")
  addArray(userPrefs?.travel_vibes);
  
  // 3. travel_dna_profiles.tone_tags (e.g., "adventurous", "comfort-seeking")
  addArray(travelDNA?.tone_tags);
  
  // 4. travel_dna_profiles.emotional_drivers (e.g., "discovery", "connection")
  addArray(travelDNA?.emotional_drivers);
  
  // 5. trip_type from trip data (e.g., "honeymoon", "adventure")
  if (tripData?.trip_type) interests.add(tripData.trip_type);
  
  // 6. Archetype prefer list (e.g., "local restaurants", "hidden gems")
  addArray(archetypeContext?.definition?.prefer);
  
  // 7. Legacy: travel_dna_v2 blob interests
  addArray((travelDNA?.travel_dna_v2 as any)?.interests);
  
  console.log(`[profile-loader] Extracted ${interests.size} interests: ${Array.from(interests).slice(0, 8).join(', ')}`);
  
  return Array.from(interests);
}

function extractDietaryRestrictions(travelDNA: any): string[] {
  const restrictions = new Set<string>();
  
  if (travelDNA?.dietary_restrictions) {
    const items = Array.isArray(travelDNA.dietary_restrictions)
      ? travelDNA.dietary_restrictions
      : [travelDNA.dietary_restrictions];
    items.forEach((r: string) => restrictions.add(r));
  }
  
  // From travel_dna_v2 blob (fixed: was incorrectly referencing travel_dna)
  if ((travelDNA?.travel_dna_v2 as any)?.dietary_restrictions) {
    const items = (travelDNA.travel_dna_v2 as any).dietary_restrictions;
    if (Array.isArray(items)) {
      items.forEach((r: string) => restrictions.add(r));
    }
  }
  
  return Array.from(restrictions);
}

function extractAvoidList(travelDNA: any, archetypeContext: ArchetypeContext): string[] {
  const avoidItems = new Set<string>();
  
  // From Travel DNA explicit avoid list
  if (travelDNA?.avoid_list) {
    const items = Array.isArray(travelDNA.avoid_list)
      ? travelDNA.avoid_list
      : [travelDNA.avoid_list];
    items.forEach((a: string) => avoidItems.add(a));
  }
  
  // From archetype definition (always include)
  archetypeContext.definition.avoid.forEach((a: string) => avoidItems.add(a));
  
  // From experience affinity NEVER list
  archetypeContext.affinity.never.forEach((n: string) => avoidItems.add(n));
  
  return Array.from(avoidItems);
}

function extractMobilityNeeds(travelDNA: any): string {
  if (travelDNA?.mobility_needs) {
    return travelDNA.mobility_needs;
  }
  
  // From travel_dna_v2 blob (fixed: was incorrectly referencing travel_dna)
  if ((travelDNA?.travel_dna_v2 as any)?.mobility_needs) {
    return (travelDNA.travel_dna_v2 as any).mobility_needs;
  }
  
  return '';
}
