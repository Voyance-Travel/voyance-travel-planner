import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnalyzeRequest {
  lovedTypes: Record<string, number>;
  dislikedTypes: Record<string, number>;
  lovedCategories: Record<string, number>;
  dislikedCategories: Record<string, number>;
  feedbackCount: number;
}

// Authentication helper
async function validateAuth(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return null;
    }
    return { userId: data.user.id };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authResult = await validateAuth(req);
    if (!authResult) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Please sign in to analyze preferences." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[analyze-preferences] Authenticated user: ${authResult.userId}`);

    const { 
      lovedTypes, 
      dislikedTypes, 
      lovedCategories, 
      dislikedCategories, 
      feedbackCount 
    }: AnalyzeRequest = await req.json();

    // Sort to find top preferences
    const topLoved = Object.entries(lovedTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    const topDisliked = Object.entries(dislikedTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    const topLovedCategories = Object.entries(lovedCategories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    // Generate AI summary using Lovable AI
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      // Fallback to simple summary
      const summary = generateSimpleSummary(topLoved, topDisliked, topLovedCategories, feedbackCount);
      return new Response(
        JSON.stringify({ summary }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Lovable AI for a personalized summary
    const prompt = `Based on a traveler's feedback from ${feedbackCount} activities:

Loved activities: ${topLoved.map(([type, score]) => `${type} (score: ${score})`).join(', ') || 'None yet'}
Disliked activities: ${topDisliked.map(([type, score]) => `${type} (score: ${score})`).join(', ') || 'None yet'}
Favorite categories: ${topLovedCategories.map(([cat, score]) => `${cat} (score: ${score})`).join(', ') || 'None yet'}

Write a brief, warm 2-3 sentence summary of their travel preferences. Be specific about what they enjoy and gently note what they tend to skip. Make it feel personal and insightful.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: "You are a travel insights analyst. Write brief, personalized summaries of traveler preferences."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!aiResponse.ok) {
      const summary = generateSimpleSummary(topLoved, topDisliked, topLovedCategories, feedbackCount);
      return new Response(
        JSON.stringify({ summary }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || 
      generateSimpleSummary(topLoved, topDisliked, topLovedCategories, feedbackCount);

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error analyzing preferences:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to analyze preferences",
        summary: "Keep exploring and sharing feedback to help us learn your travel style!"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateSimpleSummary(
  topLoved: [string, number][],
  topDisliked: [string, number][],
  topCategories: [string, number][],
  feedbackCount: number
): string {
  const parts: string[] = [];
  
  if (feedbackCount > 0) {
    parts.push(`Based on ${feedbackCount} activities you've reviewed`);
  }
  
  if (topLoved.length > 0) {
    const lovedList = topLoved.map(([t]) => t.replace(/_/g, ' ')).join(' and ');
    parts.push(`you clearly love ${lovedList} experiences`);
  }
  
  if (topCategories.length > 0) {
    const catList = topCategories.map(([c]) => c.replace(/_/g, ' ')).join(' and ');
    parts.push(`especially ${catList}`);
  }
  
  if (topDisliked.length > 0) {
    const dislikedList = topDisliked.map(([t]) => t.replace(/_/g, ' ')).join(' and ');
    parts.push(`while you tend to skip ${dislikedList}`);
  }
  
  if (parts.length === 0) {
    return "Keep exploring and sharing feedback to help us learn your travel style!";
  }
  
  return parts.join(', ') + '.';
}
