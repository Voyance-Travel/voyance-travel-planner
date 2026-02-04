import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DestinationInsightsRequest {
  destination: string;
  country?: string;
}

serve(async (req) => {
  const costTracker = trackCost('lookup_destination_insights', 'perplexity/sonar');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, country } = await req.json() as DestinationInsightsRequest;

    if (!destination) {
      return new Response(
        JSON.stringify({ success: false, error: 'Destination is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Search API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const locationContext = country ? `${destination}, ${country}` : destination;
    console.log(`Looking up destination insights for ${locationContext}`);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are a travel expert providing practical destination information for travelers.

Return a JSON object with this exact structure:
{
  "language": {
    "primary": "string (main language spoken)",
    "phrases": [
      {"phrase": "Hello", "translation": "local translation", "pronunciation": "phonetic guide"},
      {"phrase": "Thank you", "translation": "local translation", "pronunciation": "phonetic guide"},
      {"phrase": "Please", "translation": "local translation", "pronunciation": "phonetic guide"},
      {"phrase": "Excuse me", "translation": "local translation", "pronunciation": "phonetic guide"},
      {"phrase": "Where is...", "translation": "local translation", "pronunciation": "phonetic guide"},
      {"phrase": "How much?", "translation": "local translation", "pronunciation": "phonetic guide"}
    ],
    "englishFriendly": "string (how widely English is spoken)"
  },
  "currency": {
    "name": "string (e.g., 'Euro (€)')",
    "code": "string (e.g., 'EUR')",
    "tips": ["string tip 1", "string tip 2", "string tip 3"]
  },
  "tipping": {
    "custom": "string (brief tipping culture description)",
    "tips": ["string tip 1", "string tip 2", "string tip 3"]
  },
  "timezone": {
    "zone": "string (e.g., 'CET (UTC+1)')",
    "tips": ["string about business hours", "string about meal times", "string about local customs"]
  },
  "transit": {
    "overview": "string (main transport options)",
    "tips": ["string tip 1", "string tip 2", "string tip 3"]
  },
  "water": {
    "safe": boolean,
    "description": "string (tap water info)",
    "tips": ["string tip 1", "string tip 2"]
  },
  "voltage": {
    "voltage": "string (e.g., '230V')",
    "plugType": "string (e.g., 'Type C/F')",
    "tips": ["string tip 1", "string tip 2"]
  },
  "emergency": {
    "number": "string (emergency number)",
    "tips": ["string tip 1", "string tip 2", "string tip 3"]
  }
}

RULES:
- Provide ACCURATE, destination-specific information
- Use real local translations, not generic placeholders
- Include practical, actionable tips travelers actually need
- ONLY return valid JSON. No markdown, no explanation.`
          },
          {
            role: 'user',
            content: `Provide practical travel information for ${locationContext}. Include real local language phrases with accurate translations and pronunciation guides.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Search failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    
    // Track cost
    costTracker.recordPerplexity(1);
    costTracker.recordAiUsage(data, 'perplexity/sonar');
    await costTracker.save();
    
    console.log('Perplexity destination insights response received');

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const insightsData = JSON.parse(jsonMatch[0]);
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: insightsData, 
            destination: locationContext,
            citations: data.citations 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (parseError) {
      console.error('Failed to parse insights data:', parseError);
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Failed to parse destination data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error looking up destination insights:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
