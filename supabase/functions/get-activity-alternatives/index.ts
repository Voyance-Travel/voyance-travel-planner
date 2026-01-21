import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  currentActivity: {
    id: string;
    name: string;
    type: string;
    description?: string;
    time?: string;
  };
  destination?: string;
  searchQuery?: string;
}

interface AlternativeActivity {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedDuration: string;
  estimatedCost: number;
  location: string;
  rating: number;
  matchScore: number;
  whyRecommended: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { currentActivity, destination, searchQuery } = body;

    console.log('[get-activity-alternatives] Request:', {
      activity: currentActivity.name,
      destination,
      searchQuery,
    });

    // Generate contextual alternatives based on the current activity
    const alternatives = generateAlternatives(currentActivity, destination, searchQuery);

    return new Response(
      JSON.stringify({
        success: true,
        alternatives,
        meta: {
          query: searchQuery,
          basedOn: currentActivity.name,
          destination,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[get-activity-alternatives] Error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        alternatives: [] 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateAlternatives(
  activity: RequestBody['currentActivity'],
  destination?: string,
  searchQuery?: string
): AlternativeActivity[] {
  const activityType = activity.type?.toLowerCase() || 'activity';
  const locationName = destination || 'the area';

  // Base templates for different activity types
  const templates: Record<string, AlternativeActivity[]> = {
    dining: [
      {
        id: `alt-dining-1-${Date.now()}`,
        name: `Fine Dining Experience in ${locationName}`,
        description: 'Upscale restaurant featuring local cuisine with a modern twist, complete with sommelier service.',
        category: 'dining',
        estimatedDuration: '2 hours',
        estimatedCost: 120,
        location: 'City Center',
        rating: 4.8,
        matchScore: 92,
        whyRecommended: 'Premium alternative with exceptional reviews',
      },
      {
        id: `alt-dining-2-${Date.now()}`,
        name: 'Local Food Market Tour',
        description: 'Explore vibrant food stalls and taste authentic local dishes with a knowledgeable guide.',
        category: 'dining',
        estimatedDuration: '3 hours',
        estimatedCost: 45,
        location: 'Historic District',
        rating: 4.7,
        matchScore: 88,
        whyRecommended: 'Authentic local experience at great value',
      },
      {
        id: `alt-dining-3-${Date.now()}`,
        name: 'Cooking Class with Local Chef',
        description: 'Learn to prepare traditional dishes in an interactive cooking session.',
        category: 'dining',
        estimatedDuration: '3.5 hours',
        estimatedCost: 85,
        location: 'Culinary School',
        rating: 4.9,
        matchScore: 85,
        whyRecommended: 'Interactive experience with takeaway skills',
      },
    ],
    cultural: [
      {
        id: `alt-cultural-1-${Date.now()}`,
        name: `Private Museum Tour in ${locationName}`,
        description: 'Skip-the-line access with a private guide explaining the collections in depth.',
        category: 'cultural',
        estimatedDuration: '2.5 hours',
        estimatedCost: 95,
        location: 'Museum District',
        rating: 4.9,
        matchScore: 94,
        whyRecommended: 'VIP experience with expert insights',
      },
      {
        id: `alt-cultural-2-${Date.now()}`,
        name: 'Historic Walking Tour',
        description: 'Discover hidden gems and local history through cobblestone streets and ancient landmarks.',
        category: 'cultural',
        estimatedDuration: '2 hours',
        estimatedCost: 35,
        location: 'Old Town',
        rating: 4.6,
        matchScore: 86,
        whyRecommended: 'Budget-friendly with great storytelling',
      },
      {
        id: `alt-cultural-3-${Date.now()}`,
        name: 'Art Gallery Hop',
        description: 'Visit curated contemporary and traditional art galleries with an art historian.',
        category: 'cultural',
        estimatedDuration: '3 hours',
        estimatedCost: 55,
        location: 'Arts District',
        rating: 4.7,
        matchScore: 82,
        whyRecommended: 'Perfect for art enthusiasts',
      },
    ],
    activity: [
      {
        id: `alt-activity-1-${Date.now()}`,
        name: `Adventure Experience in ${locationName}`,
        description: 'Thrilling outdoor activity with professional guides and all equipment included.',
        category: 'activity',
        estimatedDuration: '4 hours',
        estimatedCost: 110,
        location: 'Adventure Park',
        rating: 4.8,
        matchScore: 90,
        whyRecommended: 'Adrenaline-pumping alternative',
      },
      {
        id: `alt-activity-2-${Date.now()}`,
        name: 'Scenic Nature Walk',
        description: 'Peaceful trail through beautiful landscapes with photo opportunities.',
        category: 'activity',
        estimatedDuration: '2 hours',
        estimatedCost: 25,
        location: 'Nature Reserve',
        rating: 4.5,
        matchScore: 85,
        whyRecommended: 'Relaxing option with stunning views',
      },
      {
        id: `alt-activity-3-${Date.now()}`,
        name: 'Local Sports Experience',
        description: 'Try the popular local sport with experienced instructors.',
        category: 'activity',
        estimatedDuration: '2 hours',
        estimatedCost: 60,
        location: 'Sports Complex',
        rating: 4.6,
        matchScore: 78,
        whyRecommended: 'Unique cultural sports experience',
      },
    ],
    relaxation: [
      {
        id: `alt-relaxation-1-${Date.now()}`,
        name: 'Luxury Spa Day',
        description: 'Full-service spa with massage, thermal baths, and wellness treatments.',
        category: 'relaxation',
        estimatedDuration: '4 hours',
        estimatedCost: 180,
        location: 'Wellness Resort',
        rating: 4.9,
        matchScore: 95,
        whyRecommended: 'Ultimate relaxation experience',
      },
      {
        id: `alt-relaxation-2-${Date.now()}`,
        name: 'Yoga & Meditation Session',
        description: 'Guided yoga class in a serene setting with meditation practice.',
        category: 'relaxation',
        estimatedDuration: '1.5 hours',
        estimatedCost: 40,
        location: 'Wellness Studio',
        rating: 4.7,
        matchScore: 88,
        whyRecommended: 'Mindful and rejuvenating',
      },
      {
        id: `alt-relaxation-3-${Date.now()}`,
        name: 'Beach Day Package',
        description: 'Reserved beach cabana with refreshments and water activities included.',
        category: 'relaxation',
        estimatedDuration: '5 hours',
        estimatedCost: 95,
        location: 'Beachfront',
        rating: 4.6,
        matchScore: 82,
        whyRecommended: 'Perfect for sun and sea lovers',
      },
    ],
    shopping: [
      {
        id: `alt-shopping-1-${Date.now()}`,
        name: 'Personal Shopping Experience',
        description: 'Private shopping guide to the best boutiques and local artisan shops.',
        category: 'shopping',
        estimatedDuration: '3 hours',
        estimatedCost: 75,
        location: 'Fashion District',
        rating: 4.8,
        matchScore: 92,
        whyRecommended: 'Curated shopping with expert guidance',
      },
      {
        id: `alt-shopping-2-${Date.now()}`,
        name: 'Artisan Market Tour',
        description: 'Explore local crafts, handmade goods, and unique souvenirs.',
        category: 'shopping',
        estimatedDuration: '2 hours',
        estimatedCost: 20,
        location: 'Market Square',
        rating: 4.5,
        matchScore: 85,
        whyRecommended: 'Authentic local goods at great prices',
      },
      {
        id: `alt-shopping-3-${Date.now()}`,
        name: 'Antique District Walking Tour',
        description: 'Discover vintage treasures and collectibles with a knowledgeable guide.',
        category: 'shopping',
        estimatedDuration: '2.5 hours',
        estimatedCost: 35,
        location: 'Antique Quarter',
        rating: 4.6,
        matchScore: 80,
        whyRecommended: 'Perfect for collectors and history buffs',
      },
    ],
  };

  // Get alternatives based on activity type, default to general activities
  let alternatives = templates[activityType] || templates.activity;

  // If search query provided, filter by name/description match
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    alternatives = alternatives.filter(
      alt => 
        alt.name.toLowerCase().includes(query) ||
        alt.description.toLowerCase().includes(query) ||
        alt.category.toLowerCase().includes(query)
    );

    // If no matches, return general alternatives
    if (alternatives.length === 0) {
      alternatives = templates.activity;
    }
  }

  return alternatives.slice(0, 5);
}
