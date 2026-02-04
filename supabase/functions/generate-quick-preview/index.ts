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

interface BudgetEstimate {
  dailyLow: number;
  dailyHigh: number;
  currency: string;
  costLevel: 'budget' | 'moderate' | 'expensive' | 'luxury';
}

interface PaymentInfo {
  localCurrency: string;
  currencyCode: string;
  paymentTips: string;
}

interface NeedToKnow {
  visaSummary: string;
  safetyLevel: string;
  keyRequirement?: string;
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
  budgetEstimate?: BudgetEstimate;
  paymentInfo?: PaymentInfo;
  needToKnow?: NeedToKnow;
}

interface DestinationFallback {
  display_name: string;
  tagline: string;
  preview_days: QuickPreviewDay[];
}

interface CostIndexRow {
  city: string;
  country: string;
  cost_multiplier: number;
  currency_code: string;
  currency_symbol: string;
  tipping_culture: string;
  base_meal_cost: number;
  base_transport_cost: number;
  base_activity_cost: number;
  base_accommodation_cost: number;
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

function getCostLevel(multiplier: number): 'budget' | 'moderate' | 'expensive' | 'luxury' {
  if (multiplier < 0.6) return 'budget';
  if (multiplier < 0.9) return 'moderate';
  if (multiplier < 1.3) return 'expensive';
  return 'luxury';
}

function calculateDailyBudget(costData: CostIndexRow): { low: number; high: number } {
  const multiplier = costData.cost_multiplier;
  
  // Base daily budget ranges (in USD)
  const baseLow = 60;
  const baseHigh = 150;
  
  // Apply multiplier
  const low = Math.round(baseLow * multiplier);
  const high = Math.round(baseHigh * multiplier);
  
  return { low, high };
}

function formatCurrencyName(code: string, symbol: string): string {
  const currencyNames: Record<string, string> = {
    'JPY': 'Yen',
    'EUR': 'Euro',
    'GBP': 'Pound',
    'THB': 'Baht',
    'MXN': 'Peso',
    'AUD': 'Dollar',
    'CAD': 'Dollar',
    'USD': 'Dollar',
    'INR': 'Rupee',
    'KRW': 'Won',
    'CNY': 'Yuan',
    'SGD': 'Dollar',
    'HKD': 'Dollar',
    'NZD': 'Dollar',
    'CHF': 'Franc',
    'SEK': 'Krona',
    'NOK': 'Krone',
    'DKK': 'Krone',
    'CZK': 'Koruna',
    'PLN': 'Zloty',
    'HUF': 'Forint',
    'TRY': 'Lira',
    'ZAR': 'Rand',
    'BRL': 'Real',
    'ARS': 'Peso',
    'COP': 'Peso',
    'PEN': 'Sol',
    'CLP': 'Peso',
    'IDR': 'Rupiah',
    'MYR': 'Ringgit',
    'PHP': 'Peso',
    'VND': 'Dong',
    'TWD': 'Dollar',
    'AED': 'Dirham',
    'SAR': 'Riyal',
    'ILS': 'Shekel',
    'EGP': 'Pound',
    'MAD': 'Dirham',
  };
  
  const name = currencyNames[code] || 'currency';
  return `${name} (${symbol})`;
}

function getPaymentTips(tippingCulture: string, costLevel: string): string {
  const tips: Record<string, string> = {
    'required': 'Tips expected (15-20%)',
    'appreciated': 'Tips appreciated but not required',
    'optional': 'Tipping optional',
    'not_expected': 'Tipping not expected',
    'included': 'Service usually included',
  };
  
  const tippingTip = tips[tippingCulture] || 'Tipping varies';
  
  if (costLevel === 'luxury' || costLevel === 'expensive') {
    return `Cards widely accepted. ${tippingTip}`;
  }
  return `Cards + cash both common. ${tippingTip}`;
}

async function fetchBudgetData(
  supabaseAdmin: SupabaseClient,
  destination: string
): Promise<{ budgetEstimate?: BudgetEstimate; paymentInfo?: PaymentInfo }> {
  try {
    // Try to find destination in cost index
    const destinationLower = destination.toLowerCase();
    
    // Try exact city match first
    let { data: costData } = await supabaseAdmin
      .from('destination_cost_index')
      .select('*')
      .ilike('city', `%${destinationLower}%`)
      .limit(1)
      .single();
    
    // If not found, use default
    if (!costData) {
      const { data: defaultData } = await supabaseAdmin
        .from('destination_cost_index')
        .select('*')
        .eq('city', '_default')
        .single();
      
      costData = defaultData;
    }
    
    if (!costData) {
      return {};
    }

    const row = costData as CostIndexRow;
    const budget = calculateDailyBudget(row);
    const costLevel = getCostLevel(row.cost_multiplier);
    
    return {
      budgetEstimate: {
        dailyLow: budget.low,
        dailyHigh: budget.high,
        currency: 'USD',
        costLevel,
      },
      paymentInfo: {
        localCurrency: formatCurrencyName(row.currency_code, row.currency_symbol),
        currencyCode: row.currency_code,
        paymentTips: getPaymentTips(row.tipping_culture, costLevel),
      },
    };
  } catch (error) {
    console.error('Error fetching budget data:', error);
    return {};
  }
}

async function fetchTravelAdvisory(
  destination: string
): Promise<NeedToKnow | undefined> {
  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      console.log('PERPLEXITY_API_KEY not configured, skipping travel advisory');
      return undefined;
    }

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `You provide ultra-brief travel entry requirements. Respond in JSON only:
{
  "visaSummary": "Visa-free X days" or "Visa required" or "eVisa available",
  "safetyLevel": "low-risk" or "moderate" or "elevated" or "high-risk",
  "keyRequirement": "optional short note like 'Passport valid 6+ months'" or null
}
Be concise. Assume US passport holder. JSON only, no markdown.`
          },
          {
            role: "user",
            content: `Entry requirements for ${destination} for US citizens in 2024/2025?`
          }
        ],
        max_tokens: 150,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('Perplexity API error:', response.status);
      return undefined;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return undefined;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return undefined;

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      visaSummary: parsed.visaSummary || 'Check requirements',
      safetyLevel: parsed.safetyLevel || 'moderate',
      keyRequirement: parsed.keyRequirement || undefined,
    };
  } catch (error) {
    console.error('Error fetching travel advisory:', error);
    return undefined;
  }
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

    // Fetch budget data and travel advisory in parallel with AI generation
    const [budgetResult, advisoryResult, aiResult] = await Promise.all([
      fetchBudgetData(supabaseAdmin, destination),
      fetchTravelAdvisory(destination),
      generateItineraryPreview(destination),
    ]);

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
      days: aiResult.days || [],
      totalDays: aiResult.totalDays || 7,
      archetypeUsed: "Slow Traveler",
      archetypeTagline: "Fewer things, done well. That's the whole philosophy.",
      budgetEstimate: budgetResult.budgetEstimate,
      paymentInfo: budgetResult.paymentInfo,
      needToKnow: advisoryResult,
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

async function generateItineraryPreview(destination: string): Promise<{ days: QuickPreviewDay[]; totalDays: number }> {
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
      throw new Error("Rate limit exceeded. Please try again in a moment.");
    }
    if (response.status === 402) {
      throw new Error("Service temporarily unavailable.");
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

  return {
    days: parsed.days || [],
    totalDays: parsed.totalDays || 7,
  };
}
