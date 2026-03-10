import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// All 27 archetypes with their traits for AI matching
const ARCHETYPES = [
  // EXPLORER
  { id: 'cultural_anthropologist', name: 'The Cultural Anthropologist', category: 'EXPLORER', traits: ['authenticity-seeking', 'cultural-immersion', 'local-experiences', 'history-lover'] },
  { id: 'urban_nomad', name: 'The Urban Nomad', category: 'EXPLORER', traits: ['city-lover', 'street-food', 'neighborhoods', 'nightlife'] },
  { id: 'wilderness_pioneer', name: 'The Wilderness Pioneer', category: 'EXPLORER', traits: ['nature-first', 'hiking', 'camping', 'off-grid'] },
  { id: 'digital_explorer', name: 'The Untethered Traveler', category: 'EXPLORER', traits: ['remote-work', 'flexible', 'wifi-essential', 'long-stays'] },
  { id: 'flexible_wanderer', name: 'The Flexible Wanderer', category: 'EXPLORER', traits: ['spontaneous', 'no-plans', 'go-with-flow', 'discovery'] },
  // CONNECTOR
  { id: 'social_butterfly', name: 'The Connection Curator', category: 'CONNECTOR', traits: ['group-travel', 'meeting-people', 'social-activities', 'extroverted'] },
  { id: 'family_architect', name: 'The Family Architect', category: 'CONNECTOR', traits: ['kid-friendly', 'multi-generational', 'educational', 'safe'] },
  { id: 'romantic_curator', name: 'The Romantic Curator', category: 'CONNECTOR', traits: ['couples', 'romantic-dinners', 'intimate', 'special-occasions'] },
  { id: 'community_builder', name: 'The Community Builder', category: 'CONNECTOR', traits: ['voluntourism', 'local-connections', 'meaningful', 'giving-back'] },
  { id: 'story_seeker', name: 'The Story Seeker', category: 'CONNECTOR', traits: ['conversations', 'local-stories', 'people-watching', 'authentic-encounters'] },
  // ACHIEVER
  { id: 'bucket_list_conqueror', name: 'The Milestone Voyager', category: 'ACHIEVER', traits: ['must-see-attractions', 'iconic-experiences', 'checking-off', 'ambitious'] },
  { id: 'adrenaline_architect', name: 'The Adrenaline Architect', category: 'ACHIEVER', traits: ['extreme-sports', 'thrill-seeking', 'adventure', 'physical-challenges'] },
  { id: 'collection_curator', name: 'The Passport Collector', category: 'ACHIEVER', traits: ['wine-regions', 'art-collecting', 'themed-trips', 'connoisseur'] },
  { id: 'status_seeker', name: 'The Prestige Traveler', category: 'ACHIEVER', traits: ['exclusive-access', 'vip-experiences', 'instagram-worthy', 'prestigious'] },
  // RESTORER
  { id: 'zen_seeker', name: 'The Zen Seeker', category: 'RESTORER', traits: ['wellness', 'meditation', 'yoga', 'spiritual'] },
  { id: 'retreat_regular', name: 'The Retreat Regular', category: 'RESTORER', traits: ['spa-resorts', 'all-inclusive', 'pampering', 'relaxation'] },
  { id: 'beach_therapist', name: 'The Beach Therapist', category: 'RESTORER', traits: ['beach', 'ocean', 'sun', 'water-activities'] },
  { id: 'slow_traveler', name: 'The Slow Traveler', category: 'RESTORER', traits: ['unhurried', 'long-stays', 'local-rhythm', 'anti-tourist'] },
  // CURATOR
  { id: 'culinary_cartographer', name: 'The Culinary Cartographer', category: 'CURATOR', traits: ['food-focused', 'local-cuisine', 'cooking-classes', 'restaurants'] },
  { id: 'art_aficionado', name: 'The Art Aficionado', category: 'CURATOR', traits: ['museums', 'galleries', 'architecture', 'design'] },
  { id: 'luxury_luminary', name: 'The Luxury Luminary', category: 'CURATOR', traits: ['five-star', 'michelin', 'private-tours', 'premium'] },
  // TRANSFORMER
  { id: 'eco_ethicist', name: 'The Mindful Voyager', category: 'TRANSFORMER', traits: ['sustainable', 'eco-lodges', 'conservation', 'low-impact'] },
  { id: 'gap_year_graduate', name: 'The Horizon Chaser', category: 'TRANSFORMER', traits: ['backpacking', 'hostels', 'budget', 'youth'] },
  { id: 'midlife_explorer', name: 'The Renaissance Voyager', category: 'TRANSFORMER', traits: ['bucket-list', 'new-experiences', 'rediscovery', 'adventure-lite'] },
  { id: 'sabbatical_scholar', name: 'The Sabbatical Scholar', category: 'TRANSFORMER', traits: ['learning', 'courses', 'deep-dive', 'extended-stays'] },
  { id: 'healing_journeyer', name: 'The Restoration Seeker', category: 'TRANSFORMER', traits: ['recovery', 'therapeutic', 'nature-healing', 'restorative'] },
  { id: 'balanced_story_collector', name: 'The Balanced Story Collector', category: 'EXPLORER', traits: ['variety', 'balanced', 'mix-of-everything', 'adaptable'] },
];

interface ParsedTraits {
  pace: 'slow' | 'balanced' | 'active';
  social: 'solo' | 'small-group' | 'social';
  planning: 'spontaneous' | 'flexible' | 'structured';
  comfort: 'budget' | 'moderate' | 'luxury';
  authenticity: 'tourist' | 'balanced' | 'local-immersion';
  adventure: 'relaxed' | 'moderate' | 'thrill-seeking';
  whatWorked: string[];
  whatFailed: string[];
}

interface StoryAnalysis {
  primaryArchetype: typeof ARCHETYPES[number];
  secondaryArchetype: typeof ARCHETYPES[number] | null;
  traits: ParsedTraits;
  confidence: number;
  reasoning: string;
  followUpQuestion?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { story, previousAnalysis } = await req.json();

    if (!story || typeof story !== 'string' || story.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Please share a bit more about your travel experience." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const archetypeList = ARCHETYPES.map(a => 
      `- ${a.id}: "${a.name}" (${a.category}) - ${a.traits.join(', ')}`
    ).join('\n');

    const systemPrompt = `You are a travel personality analyst. Your job is to read a traveler's story about a past trip and extract their travel archetype from the 27 defined archetypes.

ARCHETYPES:
${archetypeList}

TRAIT DIMENSIONS TO EXTRACT:
- pace: How packed vs relaxed they prefer (slow/balanced/active)
- social: Solo preference vs group travel (solo/small-group/social)
- planning: Spontaneous vs structured (spontaneous/flexible/structured)
- comfort: Budget to luxury preference (budget/moderate/luxury)
- authenticity: Tourist spots vs local immersion (tourist/balanced/local-immersion)
- adventure: Relaxed to thrill-seeking (relaxed/moderate/thrill-seeking)

ANALYZE THE STORY FOR:
1. What they loved (positive signals → matching archetypes)
2. What frustrated them (negative signals → archetypes to avoid)
3. The ideal day they describe (key archetype indicators)
4. Travel companions mentioned (solo, partner, family, friends)
5. Budget signals (hostels/Airbnb = budget, boutique = moderate, five-star = luxury)
6. Pace signals (exhausting = too active, boring = wanted more, perfect balance)

OUTPUT FORMAT (JSON):
{
  "primaryArchetypeId": "archetype_id",
  "secondaryArchetypeId": "archetype_id_or_null",
  "traits": {
    "pace": "slow|balanced|active",
    "social": "solo|small-group|social",
    "planning": "spontaneous|flexible|structured",
    "comfort": "budget|moderate|luxury",
    "authenticity": "tourist|balanced|local-immersion",
    "adventure": "relaxed|moderate|thrill-seeking"
  },
  "whatWorked": ["list of things they loved"],
  "whatFailed": ["list of things that didn't work"],
  "confidence": 0-100,
  "reasoning": "2-3 sentences explaining the match",
  "followUpQuestion": "Optional question if confidence < 70"
}

Be empathetic and insightful. Read between the lines - if someone says "the trip was exhausting but amazing", they might prefer a slower pace next time.`;

    const userPrompt = previousAnalysis 
      ? `Previous analysis suggested "${previousAnalysis.primaryArchetype.name}" with ${previousAnalysis.confidence}% confidence.
      
The traveler provided more context:
"${story}"

Refine your analysis based on this additional information.`
      : `Analyze this travel story and determine the traveler's archetype:

"${story}"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "We're processing many requests. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Track AI usage
    const costTracker = trackCost('parse_travel_story', 'google/gemini-2.5-flash');
    costTracker.recordAiUsage(data);
    await costTracker.save();

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    let parsed;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, content];
      parsed = JSON.parse(jsonMatch[1] || content);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to analyze your story. Please try again.");
    }

    // Find the archetype objects
    const primaryArchetype = ARCHETYPES.find(a => a.id === parsed.primaryArchetypeId);
    const secondaryArchetype = parsed.secondaryArchetypeId 
      ? ARCHETYPES.find(a => a.id === parsed.secondaryArchetypeId) 
      : null;

    if (!primaryArchetype) {
      // Fallback to balanced story collector
      const fallback = ARCHETYPES.find(a => a.id === 'balanced_story_collector')!;
      parsed.primaryArchetypeId = fallback.id;
    }

    const analysis: StoryAnalysis = {
      primaryArchetype: primaryArchetype || ARCHETYPES.find(a => a.id === 'balanced_story_collector')!,
      secondaryArchetype: secondaryArchetype ?? null,
      traits: {
        pace: parsed.traits?.pace || 'balanced',
        social: parsed.traits?.social || 'small-group',
        planning: parsed.traits?.planning || 'flexible',
        comfort: parsed.traits?.comfort || 'moderate',
        authenticity: parsed.traits?.authenticity || 'balanced',
        adventure: parsed.traits?.adventure || 'moderate',
        whatWorked: parsed.whatWorked || [],
        whatFailed: parsed.whatFailed || [],
      },
      confidence: parsed.confidence || 50,
      reasoning: parsed.reasoning || "Based on your travel story, this archetype seems like a good match.",
      followUpQuestion: parsed.confidence < 70 ? parsed.followUpQuestion : undefined,
    };

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[parse-travel-story] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Story analysis failed", code: "PARSE_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
