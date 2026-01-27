// =============================================================================
// DESTINATION ENRICHMENT SERVICE
// =============================================================================
// Fetches destination essentials from database with freshness-based enrichment.
// If data is stale (>90 days), auto-enriches via Perplexity before generation.
// =============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const FRESHNESS_DAYS = 90;

// =============================================================================
// TYPES
// =============================================================================

export interface DestinationData {
  id: string;
  city: string;
  country: string;
  region?: string;
  pointsOfInterest: string[];
  knownFor: string[];
  lastEnriched: string | null;
  enrichmentStatus: {
    source?: string;
    lastUpdated?: string;
    confidence?: number;
  };
  // Enriched data (from Perplexity or cache)
  essentials?: EnrichedEssential[];
  hiddenGems?: EnrichedGem[];
  touristTraps?: string[];
}

export interface EnrichedEssential {
  name: string;
  category: 'landmark' | 'museum' | 'neighborhood' | 'food' | 'experience' | 'viewpoint';
  priority: number; // 1-10
  duration?: string;
  bestTime?: string;
  bookingRequired?: boolean;
  note?: string;
}

export interface EnrichedGem {
  name: string;
  category: string;
  whyLocal: string;
  bestFor: string[];
  crowdLevel: 'low' | 'moderate';
}

// =============================================================================
// FETCH DESTINATION FROM DATABASE
// =============================================================================

/**
 * Fetch destination data from database, with optional freshness check
 */
export async function getDestinationFromDB(
  supabase: SupabaseClient,
  destinationName: string
): Promise<DestinationData | null> {
  // Normalize search term
  const searchCity = destinationName.split(',')[0].trim().toLowerCase();
  
  console.log(`[DestEnrich] Fetching destination: "${searchCity}"`);
  
  // Try exact match first
  const { data, error } = await supabase
    .from('destinations')
    .select('id, city, country, region, points_of_interest, known_for, last_enriched, enrichment_status')
    .ilike('city', searchCity)
    .limit(1);
  
  if (error) {
    console.error('[DestEnrich] DB query error:', error.message);
    return null;
  }
  
  if (!data || data.length === 0) {
    // Try fuzzy match
    const { data: fuzzyData, error: fuzzyError } = await supabase
      .from('destinations')
      .select('id, city, country, region, points_of_interest, known_for, last_enriched, enrichment_status')
      .ilike('city', `%${searchCity}%`)
      .limit(1);
    
    if (fuzzyError || !fuzzyData || fuzzyData.length === 0) {
      console.log(`[DestEnrich] No destination found for: "${searchCity}"`);
      return null;
    }
    
    return mapDBToDestinationData(fuzzyData[0]);
  }
  
  return mapDBToDestinationData(data[0]);
}

/**
 * Map database row to DestinationData
 */
function mapDBToDestinationData(row: Record<string, unknown>): DestinationData {
  const pointsOfInterest = Array.isArray(row.points_of_interest) 
    ? row.points_of_interest as string[]
    : [];
  
  const knownFor = Array.isArray(row.known_for)
    ? row.known_for as string[]
    : [];
  
  return {
    id: row.id as string,
    city: row.city as string,
    country: row.country as string,
    region: row.region as string | undefined,
    pointsOfInterest,
    knownFor,
    lastEnriched: row.last_enriched as string | null,
    enrichmentStatus: (row.enrichment_status as Record<string, unknown>) || {},
  };
}

// =============================================================================
// FRESHNESS CHECK & ENRICHMENT
// =============================================================================

/**
 * Check if destination data needs refreshing
 */
export function isDestinationStale(destination: DestinationData): boolean {
  if (!destination.lastEnriched) {
    // Never enriched = stale
    return true;
  }
  
  const lastEnriched = new Date(destination.lastEnriched);
  const now = new Date();
  const daysSinceEnrichment = Math.floor(
    (now.getTime() - lastEnriched.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return daysSinceEnrichment > FRESHNESS_DAYS;
}

/**
 * Enrich destination data via Perplexity
 */
export async function enrichDestinationViaPerplexity(
  destination: DestinationData,
  perplexityApiKey: string
): Promise<DestinationData> {
  console.log(`[DestEnrich] Enriching ${destination.city} via Perplexity...`);
  
  try {
    const query = `What are the top 10 must-see attractions and landmarks in ${destination.city}, ${destination.country} that first-time visitors should absolutely not miss?

Also provide 5-8 hidden gems that locals love but tourists rarely find.

Return as JSON:
{
  "essentials": [
    {"name": "...", "category": "landmark|museum|neighborhood|food|experience|viewpoint", "priority": 1-10, "duration": "2-3 hours", "bestTime": "early morning", "bookingRequired": true, "note": "..."}
  ],
  "hiddenGems": [
    {"name": "...", "category": "...", "whyLocal": "...", "bestFor": ["foodies", "photographers"], "crowdLevel": "low|moderate"}
  ],
  "touristTraps": ["Place to avoid 1", "Place to avoid 2"]
}`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { 
            role: 'system', 
            content: 'You are a travel expert. Return only valid JSON, no markdown or explanation.' 
          },
          { role: 'user', content: query }
        ],
      }),
    });

    if (!response.ok) {
      console.error('[DestEnrich] Perplexity API error:', response.status);
      return destination;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const enriched = JSON.parse(jsonMatch[0]);
      
      destination.essentials = enriched.essentials || [];
      destination.hiddenGems = enriched.hiddenGems || [];
      destination.touristTraps = enriched.touristTraps || [];
      
      console.log(`[DestEnrich] Enriched ${destination.city}: ${destination.essentials?.length || 0} essentials, ${destination.hiddenGems?.length || 0} gems`);
    }
  } catch (err) {
    console.error('[DestEnrich] Enrichment failed:', err);
  }
  
  return destination;
}

/**
 * Update database with enriched data
 */
export async function saveEnrichmentToDatabase(
  supabase: SupabaseClient,
  destination: DestinationData
): Promise<void> {
  console.log(`[DestEnrich] Saving enrichment for ${destination.city}...`);
  
  // Merge essentials into points_of_interest if we have new data
  let pointsOfInterest = [...destination.pointsOfInterest];
  
  if (destination.essentials && destination.essentials.length > 0) {
    const newPOIs = destination.essentials.map(e => e.name);
    pointsOfInterest = [...new Set([...newPOIs, ...pointsOfInterest])];
  }
  
  const { error } = await supabase
    .from('destinations')
    .update({
      points_of_interest: pointsOfInterest,
      last_enriched: new Date().toISOString(),
      enrichment_status: {
        source: 'perplexity',
        lastUpdated: new Date().toISOString(),
        essentialsCount: destination.essentials?.length || 0,
        hiddenGemsCount: destination.hiddenGems?.length || 0,
        confidence: 0.85,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', destination.id);
  
  if (error) {
    console.error('[DestEnrich] Failed to save enrichment:', error.message);
  } else {
    console.log(`[DestEnrich] Saved enrichment for ${destination.city}`);
  }
}

// =============================================================================
// MAIN: GET DESTINATION WITH FRESH ESSENTIALS
// =============================================================================

/**
 * Get destination data with freshness-based enrichment
 * - Fetches from DB
 * - If stale (>90 days), enriches via Perplexity and updates DB
 * - Returns fresh data for prompt injection
 */
export async function getDestinationWithEssentials(
  supabase: SupabaseClient,
  destinationName: string,
  perplexityApiKey?: string
): Promise<DestinationData | null> {
  // 1. Fetch from database
  const destination = await getDestinationFromDB(supabase, destinationName);
  
  if (!destination) {
    console.log(`[DestEnrich] No destination found for: ${destinationName}`);
    return null;
  }
  
  console.log(`[DestEnrich] Found ${destination.city}: ${destination.pointsOfInterest.length} POIs, last enriched: ${destination.lastEnriched || 'never'}`);
  
  // 2. Check freshness
  const isStale = isDestinationStale(destination);
  
  if (isStale && perplexityApiKey) {
    console.log(`[DestEnrich] Data is stale, enriching...`);
    
    // 3. Enrich via Perplexity
    const enriched = await enrichDestinationViaPerplexity(destination, perplexityApiKey);
    
    // 4. Save to database (async, don't block)
    saveEnrichmentToDatabase(supabase, enriched).catch(console.error);
    
    return enriched;
  }
  
  // Return existing data if fresh
  return destination;
}

// =============================================================================
// BUILD PROMPT FROM DB DATA
// =============================================================================

/**
 * Build destination essentials prompt from database data
 */
export function buildDBEssentialsPrompt(
  destination: DestinationData,
  tripDays: number,
  authenticityScore: number,
  isFirstTimeVisitor: boolean = true
): string {
  const lines: string[] = [];
  
  // Calculate coverage requirements
  const mode = authenticityScore <= 2 ? 'tourist' : authenticityScore >= 4 ? 'local' : 'balanced';
  const minRequired = tripDays <= 2 ? 3 : tripDays <= 4 ? 5 : Math.min(8, destination.pointsOfInterest.length);
  
  lines.push(`${'='.repeat(70)}`);
  lines.push(`🎯 DESTINATION ESSENTIALS — ${destination.city.toUpperCase()}, ${destination.country.toUpperCase()}`);
  lines.push(`${'='.repeat(70)}`);
  lines.push('');
  
  if (isFirstTimeVisitor) {
    lines.push(`⚠️ FIRST-TIME VISITOR DETECTED`);
    lines.push(`   Non-negotiable landmarks MUST be included. Skipping them is a FAILURE.`);
    lines.push('');
  }
  
  lines.push(`📊 TRAVELER MODE: ${mode.toUpperCase()}`);
  lines.push(`   Authenticity score: ${authenticityScore > 0 ? '+' : ''}${authenticityScore}`);
  lines.push(`   Trip length: ${tripDays} days`);
  lines.push(`   Required essentials: ${minRequired}+`);
  lines.push('');
  
  // Known for section
  if (destination.knownFor.length > 0) {
    lines.push(`📍 KNOWN FOR: ${destination.knownFor.slice(0, 5).join(', ')}`);
    lines.push('');
  }
  
  // Non-negotiables from points_of_interest
  if (destination.pointsOfInterest.length > 0) {
    lines.push(`🏛️ NON-NEGOTIABLE LANDMARKS (MUST INCLUDE for first-time visitors):`);
    
    const topPOIs = destination.pointsOfInterest.slice(0, Math.min(10, destination.pointsOfInterest.length));
    topPOIs.forEach((poi, i) => {
      lines.push(`   ${i + 1}. ${poi}`);
    });
    lines.push('');
    
    lines.push(`   RULE: For ${tripDays}-day trip, include at least ${minRequired} of these.`);
    if (isFirstTimeVisitor) {
      lines.push(`   If ANY major landmarks (top 5) are missing, you have FAILED.`);
    }
    lines.push('');
  }
  
  // Enriched essentials (if available from Perplexity)
  if (destination.essentials && destination.essentials.length > 0) {
    lines.push(`📋 DETAILED ESSENTIALS (with timing):`);
    destination.essentials.slice(0, 8).forEach(e => {
      lines.push(`   • ${e.name} (${e.category}) — ${e.duration || 'varies'}${e.bestTime ? ', best: ' + e.bestTime : ''}${e.bookingRequired ? ' [BOOK AHEAD]' : ''}`);
      if (e.note) lines.push(`     ↳ ${e.note}`);
    });
    lines.push('');
  }
  
  // Hidden gems (for high authenticity)
  if (destination.hiddenGems && destination.hiddenGems.length > 0 && authenticityScore >= 3) {
    lines.push(`💎 HIDDEN GEMS (for local exploration):`);
    destination.hiddenGems.slice(0, 6).forEach(g => {
      lines.push(`   • ${g.name} — ${g.whyLocal}`);
      lines.push(`     Best for: ${g.bestFor.join(', ')} | Crowd: ${g.crowdLevel}`);
    });
    lines.push('');
  }
  
  // Tourist traps to avoid
  if (destination.touristTraps && destination.touristTraps.length > 0 && authenticityScore >= 3) {
    lines.push(`🚫 AVOID (tourist traps):`);
    destination.touristTraps.forEach(trap => {
      lines.push(`   • ${trap}`);
    });
    lines.push('');
  }
  
  // Authenticity calibration rules
  lines.push(`${'='.repeat(70)}`);
  lines.push(`AUTHENTICITY CALIBRATION RULES`);
  lines.push(`${'='.repeat(70)}`);
  
  if (mode === 'tourist') {
    lines.push(`MODE: TOURIST-FRIENDLY (authenticity ≤ +2)`);
    lines.push(`• Prioritize iconic, bucket-list attractions from the list above`);
    lines.push(`• Include world-famous restaurants and classic experiences`);
    lines.push(`• Photo opportunities at landmarks MATTER to this traveler`);
    lines.push(`• Classic > clever — they WANT the hits`);
  } else if (mode === 'local') {
    lines.push(`MODE: OFF-THE-BEATEN-PATH (authenticity ≥ +4)`);
    lines.push(`• STILL include top landmarks (they're non-negotiable for first-timers)`);
    lines.push(`• Fill remaining time with hidden gems from the list above`);
    lines.push(`• Prioritize neighborhood spots locals actually go`);
    lines.push(`• Restaurants without English menus = plus`);
    lines.push(`• They'd rather discover something unique than wait in line`);
  } else {
    lines.push(`MODE: BALANCED (authenticity +2 to +4)`);
    lines.push(`• Mix both worlds: one iconic experience per day, one local discovery`);
    lines.push(`• Morning: famous landmark from essentials`);
    lines.push(`• Afternoon: neighborhood exploration`);
    lines.push(`• Evening: local dining spot`);
  }
  
  lines.push('');
  
  return lines.join('\n');
}
