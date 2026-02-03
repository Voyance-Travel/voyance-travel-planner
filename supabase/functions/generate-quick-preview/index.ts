import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limit thresholds
const IP_RATE_LIMITS = {
  perMinute: 10,
  perHour: 30,
  perDay: 100,
};

// Daily limits for authenticated free users
const USER_DAILY_LIMITS = {
  preview: 3,
};

interface QuickPreviewRequest {
  destination: string;
}

interface QuickPreviewDay {
  dayNumber: number;
  headline: string;
  description: string;
}

interface QuickPreviewResponse {
  destination: string;
  days: QuickPreviewDay[];
  totalDays: number;
  archetypeUsed: string;
  archetypeTagline: string;
  isFallback?: boolean;
  dailyLimitReached?: boolean;
  usageToday?: number;
  dailyLimit?: number;
}

interface DestinationFallback {
  display_name: string;
  tagline: string;
  preview_days: QuickPreviewDay[];
}

function normalizeDestinationKey(destination: string): string {
  return destination
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function getClientIP(req: Request): string {
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;
  
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim();
  
  const xRealIP = req.headers.get('x-real-ip');
  if (xRealIP) return xRealIP;
  
  return 'unknown';
}

async function getStaticFallback(
  supabaseAdmin: SupabaseClient,
  destination: string
): Promise<QuickPreviewResponse> {
  const destinationKey = normalizeDestinationKey(destination);
  const { data: fallback } = await supabaseAdmin
    .from('destination_fallbacks')
    .select('display_name, tagline, preview_days')
    .eq('destination_key', destinationKey)
    .single();

  if (fallback) {
    const fb = fallback as DestinationFallback;
    return {
      destination: fb.display_name,
      days: fb.preview_days,
      totalDays: 7,
      archetypeUsed: "Slow Traveler",
      archetypeTagline: fb.tagline,
      isFallback: true,
    };
  }

  return {
    destination: destination,
    days: [
      { dayNumber: 1, headline: "Explore the Local Scene", description: "Discover hidden gems and local favorites in the heart of the city." },
      { dayNumber: 2, headline: "Cultural Immersion", description: "Dive into history, art, and the stories that shape this place." },
      { dayNumber: 3, headline: "Neighborhood Wandering", description: "Get lost on purpose. The best finds aren't on any map." },
    ],
    totalDays: 7,
    archetypeUsed: "Slow Traveler",
    archetypeTagline: "Fewer things, done well. That's the whole philosophy.",
    isFallback: true,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { destination }: QuickPreviewRequest = await req.json();

    if (!destination || typeof destination !== "string") {
      return new Response(
        JSON.stringify({ error: "Destination is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientIP = getClientIP(req);
    const endpoint = 'quick-preview';
    const now = new Date();

    // Check if user is authenticated
    let userId: string | null = null;
    let hasCredits = false;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        userId = user.id;
        
        // Check if user has purchased credits (no daily limit for paying users)
        const { data: balance } = await supabaseAdmin
          .from('credit_balances')
          .select('purchased_credits')
          .eq('user_id', userId)
          .single();
        
        hasCredits = (balance?.purchased_credits ?? 0) > 0;
      }
    }

    // For authenticated users without credits: check daily limit
    if (userId && !hasCredits) {
      const today = now.toISOString().split('T')[0];
      
      const { data: usage } = await supabaseAdmin
        .from('daily_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('action_type', 'preview')
        .eq('usage_date', today)
        .single();
      
      const usageCount = usage?.count ?? 0;
      
      if (usageCount >= USER_DAILY_LIMITS.preview) {
        console.log(`[daily-limit] User ${userId} hit preview limit: ${usageCount}/${USER_DAILY_LIMITS.preview}`);
        
        const fallback = await getStaticFallback(supabaseAdmin, destination);
        return new Response(JSON.stringify({
          ...fallback,
          dailyLimitReached: true,
          usageToday: usageCount,
          dailyLimit: USER_DAILY_LIMITS.preview,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // For unauthenticated users: IP rate limiting
    if (!userId) {
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [minuteCount, hourCount, dayCount] = await Promise.all([
        supabaseAdmin
          .from('rate_limits')
          .select('id', { count: 'exact', head: true })
          .eq('ip_address', clientIP)
          .eq('endpoint', endpoint)
          .gte('created_at', oneMinuteAgo),
        supabaseAdmin
          .from('rate_limits')
          .select('id', { count: 'exact', head: true })
          .eq('ip_address', clientIP)
          .eq('endpoint', endpoint)
          .gte('created_at', oneHourAgo),
        supabaseAdmin
          .from('rate_limits')
          .select('id', { count: 'exact', head: true })
          .eq('ip_address', clientIP)
          .eq('endpoint', endpoint)
          .gte('created_at', oneDayAgo),
      ]);

      const isRateLimited = 
        (minuteCount.count ?? 0) >= IP_RATE_LIMITS.perMinute ||
        (hourCount.count ?? 0) >= IP_RATE_LIMITS.perHour ||
        (dayCount.count ?? 0) >= IP_RATE_LIMITS.perDay;

      if (isRateLimited) {
        console.log(`[ip-rate-limited] IP: ${clientIP}, minute: ${minuteCount.count}, hour: ${hourCount.count}, day: ${dayCount.count}`);
        
        const fallback = await getStaticFallback(supabaseAdmin, destination);
        return new Response(JSON.stringify(fallback), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log IP request
      await supabaseAdmin.from('rate_limits').insert({
        ip_address: clientIP,
        endpoint,
      });
    }

    // Proceed with AI generation
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a travel expert creating quick trip previews. Generate a 3-day taste of what a trip could look like.

CRITICAL RULES:
1. Use the "Slow Traveler" style: unhurried, intentional, fewer activities done well
2. Be SPECIFIC to the destination - use real neighborhood names, real landmarks
3. Keep each day to ONE headline (5-7 words) and ONE description (15-25 words)
4. Show the CONTRAST with typical rushed tourism
5. Make it feel like insider knowledge

TONE: Confident, warm, slightly irreverent. Like a well-traveled friend sharing secrets.

OUTPUT FORMAT (JSON only, no markdown):
{
  "days": [
    { "dayNumber": 1, "headline": "...", "description": "..." },
    { "dayNumber": 2, "headline": "...", "description": "..." },
    { "dayNumber": 3, "headline": "...", "description": "..." }
  ],
  "totalDays": 7
}`
          },
          {
            role: "user",
            content: `Create a quick 3-day preview for: ${destination}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError, "Content:", content);
      throw new Error("Failed to parse AI response");
    }

    // Track usage for authenticated free users
    if (userId && !hasCredits) {
      const today = now.toISOString().split('T')[0];
      
      try {
        await supabaseAdmin.rpc('increment_daily_usage', {
          p_user_id: userId,
          p_action_type: 'preview',
          p_usage_date: today,
        });
      } catch (err) {
        console.error("Failed to increment daily usage:", err);
      }
    }

    const result: QuickPreviewResponse = {
      destination: destination,
      days: parsed.days || [],
      totalDays: parsed.totalDays || 7,
      archetypeUsed: "Slow Traveler",
      archetypeTagline: "Fewer things, done well. That's the whole philosophy.",
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-quick-preview error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
