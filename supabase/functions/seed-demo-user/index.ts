import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEMO_USER_EMAIL = "demo@voyance.travel";
const DEMO_USER_PASSWORD = "VoyanceDemo2026!";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if demo user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let demoUser = existingUsers?.users?.find(u => u.email === DEMO_USER_EMAIL);

    // Create demo user if doesn't exist
    if (!demoUser) {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: DEMO_USER_EMAIL,
        password: DEMO_USER_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: "Maya Chen",
          avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face"
        }
      });
      
      if (createError) throw createError;
      demoUser = newUser.user;
    }

    const userId = demoUser!.id;

    // Create/Update profile with rich marketing data
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        handle: "mayatravels",
        display_name: "Maya Chen",
        first_name: "Maya",
        last_name: "Chen",
        avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face",
        bio: "✈️ Digital nomad & wellness enthusiast | 32 countries explored | Seeking hidden temples, authentic cuisine & mountain sunrises | SF → World",
        home_airport: "SFO",
        preferred_currency: "USD",
        preferred_language: "en",
        quiz_completed: true,
        travel_dna: {
          archetype: "The Mindful Explorer",
          archetype_description: "You travel to grow, not just to go. Every journey is an opportunity for transformation.",
          primary_traits: ["Cultural Immersion", "Wellness Focused", "Sustainable Travel"],
          trait_scores: {
            adventure: 72,
            culture: 95,
            relaxation: 85,
            foodie: 88,
            nature: 78,
            social: 65,
            luxury: 70,
            budget: 45
          },
          travel_style: "Slow & Intentional",
          energy_pattern: "early_bird",
          social_preference: "small_groups"
        },
        updated_at: new Date().toISOString()
      });

    if (profileError) console.error('Profile error:', profileError);

    // Create user preferences with complete data
    const { error: prefsError } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        travel_pace: "relaxed",
        budget_tier: "luxury",
        accommodation_style: "boutique",
        dietary_restrictions: ["vegetarian-friendly", "gluten-aware"],
        mobility_needs: "full",
        interests: ["temples", "yoga", "cooking-classes", "hiking", "photography", "local-markets", "spa", "meditation"],
        home_airport: "SFO",
        preferred_airlines: ["Singapore Airlines", "Emirates", "ANA"],
        quiz_completed: true,
        quiz_version: "v2",
        completed_at: new Date().toISOString(),
        primary_goal: "cultural_immersion",
        traveler_type: "solo_explorer",
        travel_vibes: ["peaceful", "authentic", "transformative", "scenic"],
        emotional_drivers: ["personal-growth", "escape", "wonder", "connection"],
        travel_style: "slow_travel",
        travel_frequency: "3-4_trips_year",
        trip_duration: "1-2_weeks",
        schedule_flexibility: "flexible",
        trip_structure_preference: "semi_planned",
        travel_companions: ["solo", "partner"],
        preferred_group_size: "2-4",
        communication_style: "balanced",
        hotel_style: "boutique",
        hotel_vs_flight: "hotel_priority",
        direct_flights_only: false,
        preferred_regions: ["Southeast Asia", "Japan", "Mediterranean", "South America"],
        climate_preferences: ["tropical", "temperate"],
        weather_preferences: ["sunny", "mild"],
        mobility_level: "active",
        dining_style: "local_authentic",
        food_likes: ["thai", "japanese", "mediterranean", "indian", "vietnamese"],
        food_dislikes: ["fast_food"],
        eco_friendly: true,
        planning_preference: "semi_planned",
        activity_level: "moderate",
        seat_preference: "window",
        flight_time_preference: "morning",
        preferred_cabin_class: "premium_economy",
        sleep_schedule: "early_bird",
        daytime_bias: "morning",
        downtime_ratio: "balanced",
        enable_gap_filling: true,
        enable_route_optimization: true,
        enable_real_transport: true,
        enable_cost_lookup: true,
        preferred_downtime_minutes: 45,
        max_activities_per_day: 5,
        email_notifications: true,
        trip_reminders: true,
        price_alerts: true,
        updated_at: new Date().toISOString()
      });

    if (prefsError) console.error('Preferences error:', prefsError);

    // Create trips with various statuses
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    
    // Trip 1: Upcoming trip to Bali (in 30 days) - BOOKED
    const baliStart = new Date(today);
    baliStart.setDate(baliStart.getDate() + 30);
    const baliEnd = new Date(baliStart);
    baliEnd.setDate(baliEnd.getDate() + 6);

    const { data: baliTrip, error: baliError } = await supabase
      .from('trips')
      .upsert({
        user_id: userId,
        name: "Bali Wellness Retreat",
        origin_city: "San Francisco, CA",
        destination: "Bali, Indonesia",
        destination_country: "Indonesia",
        start_date: formatDate(baliStart),
        end_date: formatDate(baliEnd),
        travelers: 2,
        trip_type: "wellness",
        budget_tier: "luxury",
        status: "booked",
        itinerary_status: "complete",
        flight_selection: {
          outbound: {
            airline: "Singapore Airlines",
            flightNumber: "SQ 12",
            departureAirport: "SFO",
            arrivalAirport: "DPS",
            departureTime: "2026-02-25T23:35:00",
            arrivalTime: "2026-02-27T11:30:00",
            duration: "19h 55m",
            stops: 1,
            cabin: "Premium Economy",
            price: 1850
          },
          return: {
            airline: "Singapore Airlines",
            flightNumber: "SQ 11",
            departureAirport: "DPS",
            arrivalAirport: "SFO",
            departureTime: "2026-03-03T14:15:00",
            arrivalTime: "2026-03-03T22:25:00",
            duration: "18h 10m",
            stops: 1,
            cabin: "Premium Economy",
            price: 1650
          }
        },
        hotel_selection: {
          name: "Villa Amrita Ubud",
          type: "Luxury Private Villa",
          address: "Jalan Raya Sanggingan, Ubud, Bali",
          stars: 5,
          pricePerNight: 420,
          totalPrice: 2520,
          amenities: ["Private Pool", "Personal Butler", "Spa", "Airport Transfer"],
          imageUrl: "https://images.unsplash.com/photo-1602002418816-5c0aeef426aa?w=600"
        },
        metadata: {
          hero_image: "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1200",
          trip_vibe: ["peaceful", "spiritual", "luxurious"],
          highlights: ["Tanah Lot Temple", "Ubud Rice Terraces", "Traditional Spa"]
        },
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();

    // Trip 2: Upcoming trip to Japan (in 60 days) - PLANNING
    const japanStart = new Date(today);
    japanStart.setDate(japanStart.getDate() + 60);
    const japanEnd = new Date(japanStart);
    japanEnd.setDate(japanEnd.getDate() + 9);

    const { data: japanTrip } = await supabase
      .from('trips')
      .upsert({
        user_id: userId,
        name: "Cherry Blossom Japan",
        origin_city: "San Francisco, CA",
        destination: "Tokyo & Kyoto, Japan",
        destination_country: "Japan",
        start_date: formatDate(japanStart),
        end_date: formatDate(japanEnd),
        travelers: 1,
        trip_type: "cultural",
        budget_tier: "moderate",
        status: "planning",
        itinerary_status: "generating",
        is_multi_city: true,
        destinations: [
          { city: "Tokyo", country: "Japan", nights: 4 },
          { city: "Kyoto", country: "Japan", nights: 5 }
        ],
        metadata: {
          hero_image: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1200",
          trip_vibe: ["cultural", "serene", "photogenic"],
          highlights: ["Cherry Blossoms", "Fushimi Inari", "Teamlab Borderless"]
        },
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();

    // Trip 3: Completed trip to Portugal (past)
    const portugalStart = new Date(today);
    portugalStart.setDate(portugalStart.getDate() - 45);
    const portugalEnd = new Date(portugalStart);
    portugalEnd.setDate(portugalEnd.getDate() + 7);

    const { data: portugalTrip } = await supabase
      .from('trips')
      .upsert({
        user_id: userId,
        name: "Portuguese Coast Adventure",
        origin_city: "San Francisco, CA",
        destination: "Lisbon & Porto, Portugal",
        destination_country: "Portugal",
        start_date: formatDate(portugalStart),
        end_date: formatDate(portugalEnd),
        travelers: 2,
        trip_type: "adventure",
        budget_tier: "moderate",
        status: "completed",
        itinerary_status: "complete",
        is_multi_city: true,
        destinations: [
          { city: "Lisbon", country: "Portugal", nights: 4 },
          { city: "Porto", country: "Portugal", nights: 3 }
        ],
        flight_selection: {
          outbound: {
            airline: "TAP Portugal",
            flightNumber: "TP 236",
            departureAirport: "SFO",
            arrivalAirport: "LIS",
            price: 1250
          }
        },
        hotel_selection: {
          name: "Memmo Alfama",
          stars: 4,
          pricePerNight: 280,
          totalPrice: 1120
        },
        metadata: {
          hero_image: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1200",
          trip_vibe: ["romantic", "historic", "foodie"],
          highlights: ["Sintra Palaces", "Port Wine Cellars", "Pastel de Nata"]
        },
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();

    // Trip 4: Draft trip to Costa Rica
    const costaRicaStart = new Date(today);
    costaRicaStart.setDate(costaRicaStart.getDate() + 120);
    const costaRicaEnd = new Date(costaRicaStart);
    costaRicaEnd.setDate(costaRicaEnd.getDate() + 5);

    const { data: costaRicaTrip } = await supabase
      .from('trips')
      .upsert({
        user_id: userId,
        name: "Costa Rica Eco Adventure",
        origin_city: "San Francisco, CA",
        destination: "Arenal & Monteverde, Costa Rica",
        destination_country: "Costa Rica",
        start_date: formatDate(costaRicaStart),
        end_date: formatDate(costaRicaEnd),
        travelers: 2,
        trip_type: "nature",
        budget_tier: "moderate",
        status: "draft",
        itinerary_status: "not_started",
        metadata: {
          hero_image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200",
          trip_vibe: ["adventurous", "eco-friendly", "wildlife"]
        },
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();

    // Add itinerary days and activities for Bali trip
    if (baliTrip) {
      // Create itinerary days
      const days = [];
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(baliStart);
        dayDate.setDate(dayDate.getDate() + i);
        
        const themes = [
          "Arrival & Sacred Beginnings",
          "Temple Discovery & Culture",
          "Rice Terraces & Wellness",
          "Sacred Mountains & Coffee",
          "Beach & Water Temple",
          "Art, Craft & Local Life",
          "Departure & Farewell"
        ];
        
        days.push({
          trip_id: baliTrip.id,
          day_number: i + 1,
          date: formatDate(dayDate),
          theme: themes[i],
          notes: null
        });
      }
      
      const { data: insertedDays } = await supabase
        .from('itinerary_days')
        .upsert(days, { onConflict: 'trip_id,day_number' })
        .select();

      // Add activities for each day
      if (insertedDays && insertedDays.length > 0) {
        const activities = [];
        
        // Day 1 activities
        const day1 = insertedDays.find(d => d.day_number === 1);
        if (day1) {
          activities.push(
            {
              trip_id: baliTrip.id,
              itinerary_day_id: day1.id,
              type: "transportation",
              title: "Arrival at Ngurah Rai Airport",
              description: "Land in paradise and meet your private driver with traditional welcome",
              start_time: "11:30:00",
              end_time: "12:00:00",
              location: "Ngurah Rai International Airport",
              address: "Denpasar, Bali, Indonesia",
              block_order: 1,
              locked: false,
              cost: 0,
              currency: "USD",
              tags: ["arrival", "welcome"]
            },
            {
              trip_id: baliTrip.id,
              itinerary_day_id: day1.id,
              type: "transportation",
              title: "Private Transfer to Ubud",
              description: "Scenic 90-minute drive through rice paddies and traditional villages",
              start_time: "12:00:00",
              end_time: "13:30:00",
              location: "Private Car Service",
              block_order: 2,
              locked: false,
              cost: 75,
              currency: "USD",
              rating_value: 4.9,
              tags: ["scenic", "private"]
            },
            {
              trip_id: baliTrip.id,
              itinerary_day_id: day1.id,
              type: "accommodation",
              title: "Villa Amrita Check-in & Welcome Ceremony",
              description: "Arrive at your luxury villa with infinity pool and receive traditional blessing",
              start_time: "14:00:00",
              end_time: "15:00:00",
              location: "Villa Amrita Ubud",
              address: "Jalan Raya Sanggingan, Ubud",
              block_order: 3,
              locked: false,
              cost: 0,
              currency: "USD",
              rating_value: 4.9,
              photos: ["https://images.unsplash.com/photo-1602002418816-5c0aeef426aa?w=400"],
              tags: ["luxury", "villa", "pool"]
            },
            {
              trip_id: baliTrip.id,
              itinerary_day_id: day1.id,
              type: "dining",
              title: "Lunch at Bebek Bengil (Dirty Duck)",
              description: "Famous crispy duck with 25 spices at this iconic Ubud institution",
              start_time: "15:30:00",
              end_time: "17:00:00",
              location: "Bebek Bengil Restaurant",
              address: "Jl. Hanoman, Ubud",
              block_order: 4,
              locked: false,
              cost: 45,
              currency: "USD",
              rating_value: 4.6,
              rating_count: 2340,
              photos: ["https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400"],
              tags: ["famous", "local-cuisine", "must-try"]
            },
            {
              trip_id: baliTrip.id,
              itinerary_day_id: day1.id,
              type: "relaxation",
              title: "Sunset Yoga & Meditation",
              description: "Private session with local yoga master overlooking the Ayung River valley",
              start_time: "17:30:00",
              end_time: "19:00:00",
              location: "Villa Floating Pavilion",
              block_order: 5,
              locked: true,
              cost: 85,
              currency: "USD",
              rating_value: 5.0,
              photos: ["https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400"],
              tags: ["wellness", "sunset", "private"]
            },
            {
              trip_id: baliTrip.id,
              itinerary_day_id: day1.id,
              type: "dining",
              title: "Dinner at Locavore Restaurant",
              description: "Award-winning fine dining with 7-course tasting menu featuring local ingredients",
              start_time: "20:00:00",
              end_time: "22:30:00",
              location: "Locavore Restaurant",
              address: "Jl. Dewisita No.10, Ubud",
              block_order: 6,
              locked: false,
              cost: 165,
              currency: "USD",
              rating_value: 4.9,
              rating_count: 892,
              booking_required: true,
              photos: ["https://images.unsplash.com/photo-1544025162-d76978e8e23d?w=400"],
              tags: ["fine-dining", "award-winner", "tasting-menu"]
            }
          );
        }

        // Day 2 activities
        const day2 = insertedDays.find(d => d.day_number === 2);
        if (day2) {
          activities.push(
            {
              trip_id: baliTrip.id,
              itinerary_day_id: day2.id,
              type: "dining",
              title: "Traditional Balinese Breakfast",
              description: "Nasi goreng, fresh tropical fruits, and kopi luwak at the villa terrace",
              start_time: "07:30:00",
              end_time: "08:30:00",
              location: "Villa Amrita",
              block_order: 1,
              locked: false,
              cost: 0,
              currency: "USD",
              tags: ["breakfast", "included"]
            },
            {
              trip_id: baliTrip.id,
              itinerary_day_id: day2.id,
              type: "cultural",
              title: "Tanah Lot Temple Visit",
              description: "Explore the iconic 16th-century sea temple built on a dramatic rock formation",
              start_time: "09:00:00",
              end_time: "11:30:00",
              location: "Pura Tanah Lot",
              address: "Beraban Village, Tabanan",
              block_order: 2,
              locked: true,
              cost: 45,
              currency: "USD",
              rating_value: 4.9,
              rating_count: 5621,
              photos: ["https://images.unsplash.com/photo-1604999333679-b86d54738315?w=400"],
              tags: ["temple", "iconic", "ocean-views"]
            },
            {
              trip_id: baliTrip.id,
              itinerary_day_id: day2.id,
              type: "cultural",
              title: "Tirta Empul Purification Ritual",
              description: "Participate in sacred water purification ceremony at this holy spring temple",
              start_time: "12:30:00",
              end_time: "14:00:00",
              location: "Pura Tirta Empul",
              address: "Manukaya, Tampaksiring",
              block_order: 3,
              locked: false,
              cost: 55,
              currency: "USD",
              rating_value: 5.0,
              photos: ["https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=400"],
              tags: ["sacred", "spiritual", "unique-experience"]
            },
            {
              trip_id: baliTrip.id,
              itinerary_day_id: day2.id,
              type: "dining",
              title: "Lunch at Local Warung",
              description: "Authentic family-run warung serving gado-gado and nasi campur",
              start_time: "14:30:00",
              end_time: "15:30:00",
              location: "Warung Bu Rini",
              block_order: 4,
              locked: false,
              cost: 15,
              currency: "USD",
              rating_value: 4.7,
              tags: ["authentic", "local", "budget-friendly"]
            },
            {
              trip_id: baliTrip.id,
              itinerary_day_id: day2.id,
              type: "cultural",
              title: "Master Silversmith Workshop",
              description: "Learn ancient Balinese silver filigree techniques and create your own jewelry",
              start_time: "16:00:00",
              end_time: "18:00:00",
              location: "Celuk Silver Village",
              address: "Jl. Raya Celuk",
              block_order: 5,
              locked: false,
              cost: 125,
              currency: "USD",
              rating_value: 4.8,
              tags: ["hands-on", "artisan", "take-home"]
            },
            {
              trip_id: baliTrip.id,
              itinerary_day_id: day2.id,
              type: "dining",
              title: "Dinner at Mozaic Restaurant",
              description: "French-Indonesian fusion with 6-course degustation in a garden setting",
              start_time: "19:30:00",
              end_time: "22:00:00",
              location: "Mozaic Restaurant",
              address: "Jl. Raya Sanggingan",
              block_order: 6,
              locked: false,
              cost: 185,
              currency: "USD",
              rating_value: 4.9,
              booking_required: true,
              photos: ["https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400"],
              tags: ["fine-dining", "fusion", "romantic"]
            }
          );
        }

        // Insert all activities
        if (activities.length > 0) {
          await supabase.from('trip_activities').upsert(activities);
        }
      }
    }

    // Grant some achievements
    const achievements = [
      { achievement_id: 'first_quiz', progress: 100 },
      { achievement_id: 'first_trip', progress: 100 },
      { achievement_id: 'first_itinerary', progress: 100 },
      { achievement_id: 'trips_5', progress: 60 } // 3 out of 5
    ];

    for (const ach of achievements) {
      await supabase
        .from('achievement_unlocks')
        .upsert({
          user_id: userId,
          achievement_id: ach.achievement_id,
          progress: ach.progress,
          unlocked_at: new Date().toISOString()
        }, { onConflict: 'user_id,achievement_id' });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Demo user created successfully",
        user: {
          id: userId,
          email: DEMO_USER_EMAIL,
          password: DEMO_USER_PASSWORD,
          profile: {
            name: "Maya Chen",
            handle: "@mayatravels",
            archetype: "The Mindful Explorer"
          },
          trips: {
            upcoming: 2,
            completed: 1,
            drafts: 1
          }
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error seeding demo user:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
