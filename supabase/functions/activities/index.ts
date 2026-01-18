import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ViatorProduct {
  productCode: string;
  title: string;
  description: string;
  price: {
    amount: number;
    currency: string;
  };
  duration: {
    fixedDurationInMinutes?: number;
  };
  images: Array<{
    variants: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  }>;
  rating?: number;
  reviewCount?: number;
  bookingInfo?: {
    url: string;
  };
  categories?: Array<{
    name: string;
  }>;
}

interface ViatorSearchResponse {
  products: ViatorProduct[];
  totalCount: number;
}

interface Activity {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  duration: number;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  bookingUrl: string | null;
  source: 'viator' | 'database';
}

async function searchViator(
  destination: string, 
  apiKey: string,
  category?: string,
  limit: number = 20
): Promise<Activity[]> {
  try {
    // Viator Partner API endpoint
    const url = 'https://api.viator.com/partner/products/search';
    
    console.log('[Activities] Searching Viator for:', destination);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json;version=2.0',
        'Content-Type': 'application/json',
        'exp-api-key': apiKey,
      },
      body: JSON.stringify({
        filtering: {
          destination: destination,
          ...(category && { tags: [category] }),
        },
        pagination: {
          start: 1,
          count: limit,
        },
        sorting: {
          sort: 'TRAVELER_RATING',
          order: 'DESCENDING',
        },
        currency: 'USD',
      }),
    });

    if (!response.ok) {
      console.error('[Activities] Viator API error:', response.status, await response.text());
      return [];
    }

    const data: ViatorSearchResponse = await response.json();
    
    return data.products.map((product) => ({
      id: product.productCode,
      title: product.title,
      description: product.description?.substring(0, 300) || '',
      category: product.categories?.[0]?.name || 'Activity',
      price: product.price?.amount || 0,
      currency: product.price?.currency || 'USD',
      duration: product.duration?.fixedDurationInMinutes || 120,
      imageUrl: product.images?.[0]?.variants?.find(v => v.width >= 400)?.url || null,
      rating: product.rating || null,
      reviewCount: product.reviewCount || null,
      bookingUrl: product.bookingInfo?.url || null,
      source: 'viator' as const,
    }));
  } catch (error) {
    console.error('[Activities] Viator search error:', error);
    return [];
  }
}

async function searchDatabase(
  supabase: any,
  destinationId: string,
  category?: string,
  limit: number = 20
): Promise<Activity[]> {
  try {
    let query = supabase
      .from('activity_catalog')
      .select('*')
      .eq('destination_id', destinationId)
      .limit(limit);
    
    if (category) {
      query = query.eq('category', category);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[Activities] Database error:', error);
      return [];
    }
    
    return (data || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description || '',
      category: item.category || 'Activity',
      price: item.cost_usd || 0,
      currency: 'USD',
      duration: (item.estimated_duration_hours || 2) * 60,
      imageUrl: null,
      rating: null,
      reviewCount: null,
      bookingUrl: null,
      source: 'database' as const,
    }));
  } catch (error) {
    console.error('[Activities] Database search error:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const destination = url.searchParams.get('destination');
    const destinationId = url.searchParams.get('destinationId');
    const category = url.searchParams.get('category') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '20');

    if (!destination && !destinationId) {
      return new Response(
        JSON.stringify({ error: 'Destination or destinationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const viatorApiKey = Deno.env.get('VIATOR_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let activities: Activity[] = [];
    let source: 'viator' | 'database' | 'mixed' = 'database';
    
    // Try Viator first if we have an API key and destination name
    if (viatorApiKey && destination) {
      const viatorResults = await searchViator(destination, viatorApiKey, category, limit);
      if (viatorResults.length > 0) {
        activities = viatorResults;
        source = 'viator';
        console.log('[Activities] Found', viatorResults.length, 'Viator results');
      }
    }
    
    // Fallback to database if no Viator results
    if (activities.length === 0 && destinationId) {
      activities = await searchDatabase(supabase, destinationId, category, limit);
      source = 'database';
      console.log('[Activities] Using', activities.length, 'database results');
    }

    return new Response(
      JSON.stringify({
        success: true,
        activities,
        totalCount: activities.length,
        source,
        fromCache: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Activities] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
