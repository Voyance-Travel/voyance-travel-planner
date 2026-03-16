// =============================================================================
// ATTRACTION MATCHING - Dynamic Archetype-Based Attraction Queries
// =============================================================================
// Matches database attractions to traveler archetypes using the affinity matrix.
// Also handles dynamic generation and caching of archetype × destination guides.
// =============================================================================

import { getExperienceAffinity, EXPERIENCE_CATEGORIES } from './experience-affinity.ts';

// =============================================================================
// TYPES
// =============================================================================

export interface MatchedAttraction {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  experience_categories: string[];
  budget_level: string;
  physical_intensity: string;
  crowd_level: string;
  priority_score: number;  // 0 = must-see, 1 = high match, 2 = medium, 3 = low
  is_must_see: boolean;
}

export interface AttractionQuery {
  destinationId: string;
  archetype: string;
  budgetTier: 'budget' | 'moderate' | 'luxury';
  physicalIntensity?: 'low' | 'moderate' | 'high';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  includeEssentials?: boolean;
  limit?: number;
}

export interface ArchetypeDestinationGuide {
  mustDo: string[];
  hiddenGems: string[];
  neighborhoods: string[];
  skip: string[];
  diningStyle: string;
  bestTimeToVisit?: string;
  insiderTip?: string;
}

// =============================================================================
// BUDGET & INTENSITY FILTERS
// =============================================================================

const BUDGET_FILTERS: Record<string, string[]> = {
  budget: ['free', 'budget'],
  moderate: ['free', 'budget', 'moderate'],
  luxury: ['free', 'budget', 'moderate', 'expensive', 'luxury']
};

const INTENSITY_FILTERS: Record<string, string[]> = {
  low: ['low'],
  moderate: ['low', 'moderate'],
  high: ['low', 'moderate', 'high']
};

// =============================================================================
// MAIN QUERY FUNCTION
// =============================================================================

/**
 * Query attractions that match an archetype's preferences.
 * Uses the experience affinity matrix to prioritize results.
 * 
 * @param supabase - Supabase client
 * @param query - Query parameters
 * @returns Prioritized list of matching attractions
 */
export async function getMatchingAttractions(
  supabase: any,
  query: AttractionQuery
): Promise<MatchedAttraction[]> {
  const affinity = getExperienceAffinity(query.archetype);
  const budgetFilter = BUDGET_FILTERS[query.budgetTier] || BUDGET_FILTERS.moderate;
  const intensityFilter = query.physicalIntensity 
    ? INTENSITY_FILTERS[query.physicalIntensity] 
    : INTENSITY_FILTERS.moderate;
  const limit = query.limit || 50;

  // Build the query with priority scoring
  // We can't do complex array overlap in Supabase JS, so we fetch and filter in code
  const { data: attractions, error } = await supabase
    .from('attractions')
    .select(`
      id,
      name,
      description,
      category,
      experience_categories,
      budget_level,
      physical_intensity,
      crowd_level,
      average_rating
    `)
    .eq('destination_id', query.destinationId)
    .in('budget_level', budgetFilter)
    .in('physical_intensity', intensityFilter)
    .order('average_rating', { ascending: false, nullsFirst: false })
    .limit(200); // Fetch more, filter down

  if (error) {
    console.error('[AttractionMatching] Query error:', error);
    return [];
  }

  if (!attractions?.length) {
    console.log('[AttractionMatching] No attractions found for destination');
    return [];
  }

  // Score and filter attractions
  const scored = attractions
    .map((a: any) => {
      const categories = a.experience_categories || [];
      
      // Check for NEVER categories - hard exclude
      const hasNever = categories.some((c: string) => affinity.never.includes(c));
      if (hasNever) return null;
      
      // Calculate priority score
      let priority = 4; // Default: no match
      if (categories.some((c: string) => affinity.high.includes(c))) {
        priority = 1; // High affinity match
      } else if (categories.some((c: string) => affinity.medium.includes(c))) {
        priority = 2; // Medium affinity match
      } else if (categories.some((c: string) => affinity.low.includes(c))) {
        priority = 3; // Low affinity match
      }
      
      return {
        ...a,
        priority_score: priority
      };
    })
    .filter((a: any) => a !== null && a.priority_score < 4) // Remove nulls and no-matches
    .sort((a: any, b: any) => {
      // Sort by priority first, then by rating
      if (a.priority_score !== b.priority_score) {
        return a.priority_score - b.priority_score;
      }
      return (b.average_rating || 0) - (a.average_rating || 0);
    })
    .slice(0, limit);

  console.log(`[AttractionMatching] Found ${scored.length} matching attractions for ${query.archetype}`);
  
  return scored;
}

// =============================================================================
// ARCHETYPE × DESTINATION GUIDE CACHE
// =============================================================================

/**
 * Get or generate an archetype-specific destination guide.
 * Checks cache first (90-day TTL), generates via AI if missing.
 * 
 * @param supabase - Supabase client with service role
 * @param archetype - The archetype name
 * @param destinationId - The destination UUID
 * @param destinationName - Human-readable destination name
 * @param aiGatewayKey - Lovable AI gateway key for generation
 */
export async function getOrGenerateArchetypeGuide(
  supabase: any,
  archetype: string,
  destinationId: string,
  destinationName: string,
  aiGatewayKey?: string
): Promise<ArchetypeDestinationGuide | null> {
  
  // Check cache first
  const { data: cached, error: cacheError } = await supabase
    .from('archetype_destination_guides')
    .select('guide, expires_at')
    .eq('archetype', archetype)
    .eq('destination_id', destinationId)
    .maybeSingle();

  if (cached && cached.guide && new Date(cached.expires_at) > new Date()) {
    console.log(`[ArchetypeGuide] Cache hit for ${archetype} × ${destinationName}`);
    
    // Increment usage count (manual read+write since supabase-js doesn't support SQL expressions in .update)
    try {
      const currentCount = cached.usage_count ?? 0;
      await supabase
        .from('archetype_destination_guides')
        .update({ usage_count: currentCount + 1 })
        .eq('archetype', archetype)
        .eq('destination_id', destinationId);
    } catch (countErr) {
      // Non-blocking — don't let a counter update break generation
      console.warn('[ArchetypeGuide] Failed to increment usage_count:', countErr);
    }
    
    return cached.guide as ArchetypeDestinationGuide;
  }

  // No cache or expired - generate new guide
  if (!aiGatewayKey) {
    console.log(`[ArchetypeGuide] No AI key, cannot generate for ${archetype} × ${destinationName}`);
    return null;
  }

  console.log(`[ArchetypeGuide] Generating new guide for ${archetype} × ${destinationName}`);
  
  const affinity = getExperienceAffinity(archetype);
  const guide = await generateArchetypeGuide(archetype, destinationName, affinity, aiGatewayKey);
  
  if (guide) {
    // Cache the result
    const { error: upsertError } = await supabase
      .from('archetype_destination_guides')
      .upsert({
        archetype,
        destination_id: destinationId,
        guide,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        usage_count: 1
      }, {
        onConflict: 'archetype,destination_id'
      });

    if (upsertError) {
      console.error('[ArchetypeGuide] Failed to cache guide:', upsertError);
    } else {
      console.log(`[ArchetypeGuide] Cached new guide for ${archetype} × ${destinationName}`);
    }
  }

  return guide;
}

/**
 * Generate an archetype-specific destination guide via AI.
 */
async function generateArchetypeGuide(
  archetype: string,
  destination: string,
  affinity: ReturnType<typeof getExperienceAffinity>,
  aiGatewayKey: string
): Promise<ArchetypeDestinationGuide | null> {
  
  const archetypeDisplay = archetype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  const prompt = `You are creating a travel guide for a specific type of traveler visiting ${destination}.

TRAVELER TYPE: ${archetypeDisplay}

THEY PRIORITIZE: ${affinity.high.join(', ')}
THEY AVOID: ${affinity.never.join(', ')}

Based on your knowledge of ${destination}, provide recommendations specifically for this traveler type.

Return ONLY valid JSON (no markdown, no explanation):
{
  "mustDo": [
    "Specific activity 1 perfect for this traveler (name actual places)",
    "Specific activity 2 perfect for this traveler",
    "Specific activity 3 perfect for this traveler"
  ],
  "hiddenGems": [
    "Lesser-known spot 1 they'd love",
    "Lesser-known spot 2 they'd love",
    "Lesser-known spot 3 they'd love"
  ],
  "neighborhoods": [
    "Neighborhood 1 that matches their vibe",
    "Neighborhood 2 that matches their vibe"
  ],
  "skip": [
    "Popular thing that doesn't fit them",
    "Another thing to skip for this type"
  ],
  "diningStyle": "One sentence describing how/where they should eat",
  "bestTimeToVisit": "Time of day recommendations",
  "insiderTip": "One specific tip for this traveler type in ${destination}"
}

Be SPECIFIC to ${destination}. Not generic advice.
For a Culinary Cartographer in Rome, mustDo should include "Testaccio Market" not "visit a food market".`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiGatewayKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error(`[ArchetypeGuide] AI request failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('[ArchetypeGuide] No content in AI response');
      return null;
    }

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[ArchetypeGuide] No JSON found in response');
      return null;
    }

    const guide = JSON.parse(jsonMatch[0]) as ArchetypeDestinationGuide;
    console.log(`[ArchetypeGuide] Successfully generated guide with ${guide.mustDo?.length || 0} mustDo items`);
    
    return guide;
  } catch (e) {
    console.error('[ArchetypeGuide] Failed to generate guide:', e);
    return null;
  }
}

// =============================================================================
// BUILD ATTRACTION MATCHING PROMPT
// =============================================================================

/**
 * Build a prompt section with matched attractions for the AI.
 */
export function buildMatchedAttractionsPrompt(
  attractions: MatchedAttraction[],
  archetype: string
): string {
  if (!attractions.length) {
    return '';
  }

  const highMatch = attractions.filter(a => a.priority_score <= 1);
  const mediumMatch = attractions.filter(a => a.priority_score === 2);

  let prompt = `
=== MATCHED ATTRACTIONS FOR ${archetype.toUpperCase().replace(/_/g, ' ')} ===

`;

  if (highMatch.length > 0) {
    prompt += `TOP MATCHES (strongly recommended):
${highMatch.map(a => `★ ${a.name} - ${a.description?.substring(0, 80) || a.category || ''}`).join('\n')}

`;
    prompt += `PERFECT FOR THIS TRAVELER (high priority):
${highMatch.slice(0, 10).map(a => `✓ ${a.name} [${(a.experience_categories || []).slice(0, 2).join(', ')}]`).join('\n')}

`;
  }

  if (mediumMatch.length > 0) {
    prompt += `GOOD OPTIONS (medium priority):
${mediumMatch.slice(0, 8).map(a => `• ${a.name} [${(a.experience_categories || []).slice(0, 2).join(', ')}]`).join('\n')}

`;
  }

  prompt += `Use these matched attractions when building the itinerary.
Prioritize HIGH priority items. Include essentials but schedule per traveler's style.
`;

  return prompt;
}

/**
 * Build a prompt section with the archetype × destination guide.
 */
export function buildArchetypeGuidePrompt(
  guide: ArchetypeDestinationGuide | null,
  archetype: string,
  destination: string
): string {
  if (!guide) {
    return '';
  }

  const archetypeDisplay = archetype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return `
=== ${destination.toUpperCase()} FOR ${archetypeDisplay.toUpperCase()} ===

PERFECT FOR THIS TRAVELER:
${guide.mustDo.map(m => `★ ${m}`).join('\n')}

HIDDEN GEMS THEY'LL LOVE:
${guide.hiddenGems.map(g => `◆ ${g}`).join('\n')}

BEST NEIGHBORHOODS:
${guide.neighborhoods.join(', ')}

SKIP (popular but wrong for them):
${guide.skip.map(s => `✗ ${s}`).join('\n')}

DINING APPROACH:
${guide.diningStyle}

${guide.insiderTip ? `INSIDER TIP:\n${guide.insiderTip}` : ''}
`;
}

// =============================================================================
// BATCH ENRICHMENT HELPER
// =============================================================================

/**
 * Get attractions that need enrichment (no categories yet).
 */
export async function getAttractionsNeedingEnrichment(
  supabase: any,
  destinationId?: string,
  limit = 100
): Promise<any[]> {
  let query = supabase
    .from('attractions')
    .select('id, name, description, destination_id, category')
    .or('experience_categories.is.null,experience_categories.eq.{}')
    .is('enriched_at', null)
    .limit(limit);

  if (destinationId) {
    query = query.eq('destination_id', destinationId);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('[AttractionEnrichment] Query error:', error);
    return [];
  }

  return data || [];
}

/**
 * Update attraction with enriched category tags.
 */
export async function updateAttractionTags(
  supabase: any,
  attractionId: string,
  tags: {
    experience_categories: string[];
    vibe: string[];
    crowd_level: string;
    physical_intensity: string;
    requires_reservation: boolean;
    budget_level: string;
    best_time_of_day: string[];
    indoor_outdoor: string;
    typical_duration_minutes: number;
    family_friendly: boolean;
    romantic: boolean;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('attractions')
    .update({
      ...tags,
      enriched_at: new Date().toISOString()
    })
    .eq('id', attractionId);

  if (error) {
    console.error(`[AttractionEnrichment] Update failed for ${attractionId}:`, error);
    return false;
  }

  return true;
}

/**
 * Get valid experience categories for validation.
 */
export function getValidExperienceCategories(): string[] {
  return Object.keys(EXPERIENCE_CATEGORIES);
}
