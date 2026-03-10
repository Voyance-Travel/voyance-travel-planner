import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.90.1";
import { trackCost } from "../_shared/cost-tracker.ts";

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
}

function normalizeDestinationKey(destination: string): string {
  return destination
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Random archetype selection for anonymous previews
const PREVIEW_ARCHETYPES = [
  { name: "Slow Traveler", tagline: "Fewer things, done well. That's the whole philosophy.", style: "unhurried, intentional, fewer activities done well" },
  { name: "Cultural Purist", tagline: "Skip the gift shop. Find the soul.", style: "deep cultural immersion, museums, local traditions, historical context" },
  { name: "Urban Explorer", tagline: "Every city has a secret. You just have to walk far enough.", style: "neighborhood wandering, street art, hidden cafes, local hangouts" },
  { name: "Luxury Seeker", tagline: "Life's too short for bad hotels.", style: "refined experiences, premium dining, elegant venues, curated luxury" },
  { name: "Adventure Chaser", tagline: "Comfort zones are overrated.", style: "active exploration, outdoor adventures, thrill-seeking, off-the-beaten-path" },
  { name: "Foodie Voyager", tagline: "Tell me what you eat. I'll tell you where to go.", style: "culinary adventures, local food markets, cooking classes, hidden restaurants" },
  { name: "Wellness Wanderer", tagline: "Travel should leave you better than it found you.", style: "mindful travel, spa retreats, nature walks, healthy dining, restorative experiences" },
  { name: "Social Butterfly", tagline: "Strangers are just friends you haven't met yet.", style: "group activities, nightlife, social dining, community events, local meetups" },
];

function getRandomArchetype() {
  return PREVIEW_ARCHETYPES[Math.floor(Math.random() * PREVIEW_ARCHETYPES.length)];
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
  
  const name = currencyNames[code] || 'Local currency';
  if (!symbol || symbol === 'undefined') {
    return name;
  }
  return `${name} (${symbol})`;
}

function getPaymentTips(costLevel: string): string {
  if (costLevel === 'luxury' || costLevel === 'expensive') {
    return 'Cards widely accepted. Tipping customary in many places.';
  }
  if (costLevel === 'budget') {
    return 'Cash often preferred. Cards accepted at larger establishments.';
  }
  return 'Cards widely accepted. Check local tipping customs.';
}

async function fetchBudgetData(
  supabaseAdmin: SupabaseClient,
  destination: string
): Promise<{ budgetEstimate?: BudgetEstimate; paymentInfo?: PaymentInfo }> {
  try {
    const destinationLower = destination.toLowerCase();
    
    // Fetch cost data and currency info in parallel
    const [costResult, currencyResult] = await Promise.all([
      (async () => {
        let { data } = await supabaseAdmin
          .from('destination_cost_index')
          .select('city, country, cost_multiplier')
          .ilike('city', `%${destinationLower}%`)
          .limit(1)
          .single();
        
        if (!data) {
          const { data: defaultData } = await supabaseAdmin
            .from('destination_cost_index')
            .select('city, country, cost_multiplier')
            .eq('city', '_default')
            .single();
          data = defaultData;
        }
        return data as CostIndexRow | null;
      })(),
      (async () => {
        // Try airport_transfer_fares for currency info
        const { data } = await supabaseAdmin
          .from('airport_transfer_fares')
          .select('currency, currency_symbol')
          .ilike('city', `%${destinationLower}%`)
          .limit(1)
          .single();
        return data ? { currency_code: data.currency, currency_symbol: data.currency_symbol } : null;
      })(),
    ]);

    if (!costResult) {
      return {};
    }

    const budget = calculateDailyBudget(costResult);
    const costLevel = getCostLevel(costResult.cost_multiplier);
    
    const currencyCode = currencyResult?.currency_code || 'USD';
    const currencySymbol = currencyResult?.currency_symbol || '$';
    
    return {
      budgetEstimate: {
        dailyLow: budget.low,
        dailyHigh: budget.high,
        currency: 'USD',
        costLevel,
      },
      paymentInfo: {
        localCurrency: formatCurrencyName(currencyCode, currencySymbol),
        currencyCode: currencyCode,
        paymentTips: getPaymentTips(costLevel),
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
            content: `Entry requirements for ${destination} for US citizens in ${new Date().getFullYear()}/${new Date().getFullYear() + 1}?`
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
    
    // Track Perplexity cost (was previously untracked — LEAK 5 fix)
    try {
      const advisoryCostTracker = trackCost('quick_preview_advisory', 'perplexity/sonar');
      advisoryCostTracker.recordPerplexity(1);
      advisoryCostTracker.recordAiUsage(data, 'perplexity/sonar');
      await advisoryCostTracker.save();
    } catch (costErr) {
      console.warn('Cost tracking failed for advisory:', costErr);
    }
    
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
  const arch = getRandomArchetype();
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
      archetypeUsed: arch.name,
      archetypeTagline: fb.tagline || arch.tagline,
      isFallback: true,
    };
  }

  // No static fallback — return error so we don't show generic content
  return {
    destination: destination,
    days: [],
    totalDays: 7,
    archetypeUsed: arch.name,
    archetypeTagline: arch.tagline,
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

    // Sanitize and validate destination input
    const cleanDestination = destination.trim().slice(0, 100);
    if (cleanDestination.length < 2 || !/^[a-zA-ZÀ-ÿ\s\-'.]+$/.test(cleanDestination)) {
      return new Response(
        JSON.stringify({ error: "invalid_destination", message: "Please enter a valid city or country name." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate against known destinations, countries, or cost index
    const destLower = cleanDestination.toLowerCase();
    const [destMatch, costMatch, countryMatch] = await Promise.all([
      supabaseAdmin
        .from('destinations')
        .select('city', { count: 'exact', head: true })
        .or(`city.ilike.%${destLower}%,country.ilike.%${destLower}%`),
      supabaseAdmin
        .from('destination_cost_index')
        .select('city', { count: 'exact', head: true })
        .ilike('city', `%${destLower}%`),
      supabaseAdmin
        .from('airport_transfer_fares')
        .select('city', { count: 'exact', head: true })
        .ilike('city', `%${destLower}%`),
    ]);

    const isKnown = (destMatch.count ?? 0) > 0 || (costMatch.count ?? 0) > 0 || (countryMatch.count ?? 0) > 0;
    
    if (!isKnown) {
      return new Response(
        JSON.stringify({ error: "unknown_destination", message: `We couldn't find "${cleanDestination}". Try a well-known city or country.` }),
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

    const selectedArchetype = getRandomArchetype();

    // Fetch budget data and travel advisory in parallel with AI generation
    const [budgetResult, advisoryResult, aiResult] = await Promise.all([
      fetchBudgetData(supabaseAdmin, destination),
      fetchTravelAdvisory(destination),
      generateItineraryPreview(destination, selectedArchetype),
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
      archetypeUsed: selectedArchetype.name,
      archetypeTagline: selectedArchetype.tagline,
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
      JSON.stringify({ success: false, error: "Preview generation failed", code: "PREVIEW_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateItineraryPreview(destination: string, archetype: { name: string; tagline: string; style: string }): Promise<{ days: QuickPreviewDay[]; totalDays: number }> {
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

You are building this preview as a "${archetype.name}" — ${archetype.style}.

CRITICAL RULES:
1. Match the "${archetype.name}" style throughout: ${archetype.style}
2. Be HYPER-SPECIFIC: name REAL places, REAL restaurants, REAL neighborhoods, REAL landmarks
3. Example of BAD generic headline: "Explore the Local Scene" or "Cultural Immersion"
4. Example of GOOD specific headline: "Morning at Tsukiji Outer Market" or "Sunset from Supertree Grove"
5. Each headline should reference a SPECIFIC real place or activity (5-8 words)
6. Each description should mention 2-3 REAL venues, streets, or neighborhoods by name (20-30 words)
7. Show insider knowledge — things only a local or experienced traveler would know
8. NO generic phrases like "hidden gems", "local favorites", "immerse yourself", "explore the city"

TONE: Confident, specific, like a friend who lived there for a year sharing their actual favorites.

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

  // Track cost for this AI call
  const costTracker = trackCost('quick_preview', 'google/gemini-2.5-flash');
  costTracker.recordAiUsage(aiResponse);
  // Also record the Perplexity call if it happened (called in parallel earlier)
  // Note: Perplexity tracking should happen in fetchTravelAdvisory, but we track here for simplicity
  await costTracker.save();

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
