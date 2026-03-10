// =============================================================================
// EXPERIENCE AFFINITY MATRIX - What Each Archetype PRIORITIZES
// =============================================================================
// The "pull" side: what categories of experiences to seek out for each type.
// =============================================================================

export interface ExperienceAffinity {
  high: string[];    // Actively prioritize and include multiple
  medium: string[];  // Include if available and fits
  low: string[];     // Only if essential or specifically requested
  never: string[];   // Hard block - never include
}

// =============================================================================
// EXPERIENCE CATEGORY TAXONOMY - All possible experience types
// =============================================================================
// These are the categories attractions can be tagged with in the database.
// Used for matching attractions to archetypes dynamically.
// =============================================================================

export const EXPERIENCE_CATEGORIES: Record<string, string> = {
  // Cultural & Historical
  landmark: 'Major monuments, famous sites',
  museum: 'Art, history, science museums',
  historical_site: 'Ruins, archaeological sites',
  religious_site: 'Churches, temples, mosques, shrines',
  architecture: 'Notable buildings, design',
  cultural_performance: 'Theater, traditional shows, concerts',
  
  // Food & Drink
  fine_dining: 'Michelin, high-end restaurants',
  local_restaurant: 'Authentic local cuisine, mid-range',
  casual_dining: 'Everyday restaurants, trattorias',
  street_food: 'Markets, food stalls, quick bites',
  food_market: 'Fresh markets, food halls',
  food_tour: 'Guided culinary experiences',
  cooking_class: 'Hands-on food preparation',
  wine_tasting: 'Wineries, wine bars, tastings',
  cocktail_bar: 'Craft cocktails, rooftop bars',
  local_bar: 'Neighborhood bars, pubs',
  cafe: 'Coffee shops, tea houses',
  
  // Nature & Outdoors
  beach: 'Beaches, coastal areas',
  park: 'Urban parks, gardens',
  garden: 'Botanical gardens, formal gardens',
  hiking: 'Trails, mountain walks',
  nature_reserve: 'Protected areas, wildlife',
  viewpoint: 'Scenic overlooks, panoramas',
  water_activity: 'Swimming, kayaking, boat tours',
  
  // Adventure & Active
  adventure_activity: 'Skydiving, bungee, extreme sports',
  outdoor_sport: 'Cycling, climbing, surfing',
  walking_tour: 'Guided city walks',
  bike_tour: 'Cycling experiences',
  
  // Urban & Neighborhood
  neighborhood: 'District exploration, wandering',
  street_life: 'People watching, urban vibe',
  shopping_local: 'Boutiques, artisan shops, markets',
  shopping_luxury: 'High-end retail, designer brands',
  night_market: 'Evening markets, street shopping',
  
  // Wellness & Relaxation
  spa: 'Spa treatments, massage',
  wellness_center: 'Yoga studios, meditation centers',
  hot_spring: 'Onsen, thermal baths',
  retreat: 'Wellness retreats, health programs',
  
  // Entertainment & Nightlife
  nightclub: 'Dancing, DJ venues',
  live_music: 'Concerts, jazz clubs',
  nightlife: 'Evening entertainment, bar hopping',
  pub_crawl: 'Group bar tours',
  gaming: 'Arcades, gaming cafes, VR',
  
  // Learning & Enrichment
  workshop: 'Hands-on classes (non-food)',
  lecture: 'Talks, educational events',
  library: 'Libraries, reading rooms',
  university: 'Campus visits, academic sites',
  
  // Social & Group
  group_activity: 'Shared experiences with others',
  hostel_social: 'Hostel events, meetups',
  local_home: 'Home dining, local family visits',
  
  // Family
  family_attraction: 'Kid-friendly museums, zoos',
  playground: 'Parks with play areas',
  aquarium: 'Marine life exhibits',
  zoo: 'Animal parks',
  theme_park: 'Amusement parks',
  
  // Specialty
  photography_spot: 'Instagram-worthy locations',
  sunset_spot: 'Best sunset viewing',
  sunrise_spot: 'Best sunrise viewing',
  hidden_gem: 'Off-the-beaten-path',
  vip_experience: 'Exclusive access, private tours',
  volunteer: 'Community service opportunities',
  eco_tour: 'Sustainable tourism experiences'
};

// =============================================================================
// EXPERIENCE AFFINITY BY ARCHETYPE
// =============================================================================

export const EXPERIENCE_AFFINITY: Record<string, ExperienceAffinity> = {
  // =========================================================================
  // EXPLORERS
  // =========================================================================
  
  cultural_anthropologist: {
    high: ['historical_sites', 'local_neighborhoods', 'traditional_markets', 'cultural_performances', 'religious_sites', 'local_restaurants', 'walking_tours_with_context'],
    medium: ['museums', 'food_tours', 'architecture', 'artisan_workshops'],
    low: ['beaches', 'shopping', 'viewpoints'],
    never: ['tourist_traps', 'chain_restaurants', 'luxury_experiences', 'spa', 'nightclubs']
  },

  urban_nomad: {
    high: ['neighborhoods', 'street_life', 'local_cafes', 'walking_routes', 'markets', 'street_food', 'rooftops'],
    medium: ['architecture', 'local_bars', 'viewpoints', 'public_spaces'],
    low: ['museums', 'nature_outside_city'],
    never: ['taxis_for_short_trips', 'organized_tours', 'nature_focused', 'suburban_attractions', 'spa']
  },

  wilderness_pioneer: {
    high: ['hiking', 'national_parks', 'camping', 'wildlife', 'trekking', 'remote_nature', 'outdoor_adventures'],
    medium: ['eco_lodges', 'outdoor_activities', 'scenic_drives'],
    low: ['simple_dining'],
    never: ['cities', 'museums', 'shopping', 'fine_dining', 'spa', 'nightlife', 'luxury_hotels']
  },

  digital_explorer: {
    high: ['digital_art', 'gaming_cafes', 'tech_districts', 'instagram_spots', 'vr_experiences', 'arcades', 'modern_architecture'],
    medium: ['design_museums', 'night_markets', 'rooftop_bars', 'themed_cafes'],
    low: ['traditional_museums', 'historical_sites'],
    never: ['remote_no_wifi', 'early_mornings', 'unplugged_experiences', 'traditional_fine_dining']
  },

  flexible_wanderer: {
    high: ['neighborhoods', 'local_cafes', 'street_food', 'parks', 'viewpoints', 'markets', 'piazzas'],
    medium: ['landmarks', 'casual_dining', 'local_bars', 'churches'],
    low: ['museums', 'structured_tours'],
    never: ['spa', 'luxury_shopping', 'structured_tours', 'reservations_required', 'fine_dining', 'packed_schedules']
  },

  // =========================================================================
  // CONNECTORS
  // =========================================================================

  social_butterfly: {
    high: ['group_tours', 'pub_crawls', 'cooking_classes', 'nightlife', 'communal_dining', 'hostel_events', 'walking_tours'],
    medium: ['food_tours', 'bars', 'festivals', 'beach_parties'],
    low: ['museums_solo', 'quiet_attractions'],
    never: ['solo_activities', 'quiet_experiences', 'private_tours', 'meditation', 'spa_solo']
  },

  family_architect: {
    high: ['kid_friendly_museums', 'zoos', 'aquariums', 'parks', 'beaches', 'interactive_experiences', 'playgrounds'],
    medium: ['family_restaurants', 'easy_walks', 'ice_cream', 'boat_rides', 'pizza'],
    low: ['long_museums', 'walking_tours'],
    never: ['adult_only', 'fine_dining', 'late_nights', 'long_queues', 'alcohol_focused', 'nightclubs']
  },

  romantic_curator: {
    high: ['sunset_spots', 'intimate_restaurants', 'scenic_walks', 'couples_experiences', 'rooftop_bars', 'gardens'],
    medium: ['wine_tastings', 'spa_for_two', 'boat_rides', 'candlelit_dining', 'viewpoints'],
    low: ['crowded_attractions', 'group_activities'],
    never: ['group_tours', 'nightclubs', 'family_venues', 'solo_activities', 'hostels', 'fast_food']
  },

  community_builder: {
    high: ['volunteer', 'social_enterprises', 'local_ngos', 'community_tourism', 'local_homes', 'cooperatives'],
    medium: ['markets', 'local_restaurants', 'neighborhood_walks', 'artisan_workshops'],
    low: ['landmarks', 'museums'],
    never: ['luxury', 'tourist_bubbles', 'chains', 'passive_sightseeing', 'exploitative_tourism']
  },

  // =========================================================================
  // ACHIEVERS
  // =========================================================================

  bucket_list_conqueror: {
    high: ['major_landmarks', 'iconic_sites', 'famous_viewpoints', 'must_see_attractions', 'photo_ops', 'world_wonders'],
    medium: ['popular_restaurants', 'well_known_experiences', 'famous_museums'],
    low: ['hidden_gems', 'local_neighborhoods'],
    never: ['skipping_famous_sites', 'too_much_downtime', 'obscure_attractions']
  },

  adrenaline_architect: {
    high: ['adventure_activities', 'extreme_sports', 'hiking', 'water_sports', 'climbing', 'zip_lining', 'skydiving'],
    medium: ['nature', 'viewpoints', 'active_tours', 'biking'],
    low: ['casual_dining'],
    never: ['museums', 'spa', 'shopping', 'fine_dining', 'slow_experiences', 'sitting_around']
  },

  collection_curator: {
    high: ['specialty_museums', 'expert_tours', 'behind_scenes', 'deep_dives', 'workshops', 'private_collections'],
    medium: ['related_experiences', 'artisan_visits', 'specialized_shops'],
    low: ['unrelated_generic_sites'],
    never: ['surface_level', 'rushed_visits', 'generic_tours']
  },

  status_seeker: {
    high: ['vip_access', 'exclusive_venues', 'hard_to_book_restaurants', 'luxury_experiences', 'impressive_viewpoints', 'private_tours'],
    medium: ['instagram_worthy', 'rooftop_bars', 'premium_tours', 'michelin_dining'],
    low: ['budget_options'],
    never: ['crowded_tourist_lines', 'basic_experiences', 'hostels', 'fast_food', 'public_queues']
  },

  // =========================================================================
  // RESTORERS
  // =========================================================================

  zen_seeker: {
    high: ['temples', 'meditation_centers', 'yoga_studios', 'sacred_sites', 'nature_walks', 'gardens', 'tea_ceremonies'],
    medium: ['quiet_museums', 'peaceful_viewpoints', 'gentle_hikes', 'thermal_baths'],
    low: ['cultural_sites_quiet'],
    never: ['nightlife', 'crowds', 'noise', 'adrenaline', 'shopping', 'parties']
  },

  retreat_regular: {
    high: ['spa', 'wellness_centers', 'yoga_retreats', 'healthy_dining', 'meditation', 'treatments', 'thermal_baths'],
    medium: ['nature_walks', 'juice_bars', 'gentle_activities', 'pools'],
    low: ['light_sightseeing'],
    never: ['adventure', 'nightlife', 'unhealthy_food', 'alcohol', 'cities', 'crowds']
  },

  beach_therapist: {
    high: ['beaches', 'sunset_spots', 'waterfront_dining', 'casual_seafood', 'hammock_spots', 'coastal_walks'],
    medium: ['water_activities', 'beach_bars', 'boat_trips', 'snorkeling'],
    low: ['one_landmark', 'markets'],
    never: ['spa', 'fine_dining', 'city_sightseeing', 'shopping', 'museums', 'packed_schedules']
  },

  slow_traveler: {
    high: ['cafes', 'parks', 'piazzas', 'long_lunches', 'neighborhood_walks', 'bookshops', 'sitting_and_watching'],
    medium: ['single_museum', 'local_restaurants', 'viewpoints', 'gardens'],
    low: ['landmarks'],
    never: ['packed_tours', 'must_see_lists', 'rushed_anything', 'back_to_back', 'quick_meals']
  },

  sanctuary_seeker: {
    high: ['quiet_retreats', 'private_spaces', 'nature_solitude', 'peaceful_hotels', 'gardens', 'off_peak_visits'],
    medium: ['small_museums', 'quiet_cafes', 'scenic_drives'],
    low: ['popular_attractions_off_peak'],
    never: ['crowds', 'group_tours', 'nightlife', 'social_activities', 'hostels', 'parties']
  },

  escape_artist: {
    high: ['beach', 'pool', 'resort_amenity', 'cafe', 'casual_dining', 'cocktail_bar', 'local_bar', 'viewpoint'],
    medium: ['park', 'garden', 'water_activity', 'local_restaurant', 'street_food', 'neighborhood', 'spa'],
    low: ['museum', 'landmark', 'walking_tour', 'cultural_performance', 'food_tour'],
    never: ['adventure_activity', 'outdoor_sport', 'hiking']
  },

  // =========================================================================
  // CURATORS
  // =========================================================================

  culinary_cartographer: {
    high: ['food_markets', 'local_restaurants', 'cooking_classes', 'food_tours', 'specialty_food_shops', 'street_food'],
    medium: ['wine_tastings', 'fine_dining_once', 'bakeries', 'local_bars'],
    low: ['museums', 'landmarks'],
    never: ['chain_restaurants', 'tourist_trap_restaurants', 'hotel_restaurants', 'fast_food']
  },

  art_aficionado: {
    high: ['art_museums', 'galleries', 'architecture', 'street_art', 'design_districts', 'art_performances', 'artist_studios'],
    medium: ['historic_buildings', 'design_shops', 'cultural_centers'],
    low: ['nature', 'beaches'],
    never: ['rushing_museums', 'skipping_major_art', 'adventure_activities', 'sports']
  },

  luxury_luminary: {
    high: ['fine_dining', 'spa', 'vip_experiences', 'luxury_shopping', 'rooftop_bars', 'private_tours', 'michelin'],
    medium: ['landmarks_vip_access', 'five_star_hotels', 'champagne_bars', 'exclusive_clubs'],
    low: [],
    never: ['budget_options', 'street_food', 'hostels', 'public_transit', 'crowds', 'queues']
  },

  // =========================================================================
  // TRANSFORMERS
  // =========================================================================

  eco_ethicist: {
    high: ['eco_tours', 'conservation', 'sustainable_dining', 'local_businesses', 'nature', 'ethical_experiences', 'bike_tours'],
    medium: ['farmers_markets', 'walking_tours', 'eco_lodges', 'organic_restaurants'],
    low: ['necessary_landmarks'],
    never: ['chains', 'high_carbon', 'over_tourism', 'cruises', 'luxury_resorts', 'exploitative']
  },

  gap_year_graduate: {
    high: ['free_tours', 'street_food', 'hostels', 'backpacker_bars', 'budget_activities', 'other_travelers', 'beaches'],
    medium: ['markets', 'nightlife', 'walking_tours', 'cheap_eats'],
    low: ['one_paid_landmark'],
    never: ['expensive_restaurants', 'luxury', 'private_tours', 'fine_dining', 'spa']
  },

  midlife_explorer: {
    high: ['meaningful_experiences', 'cultural_sites', 'good_restaurants', 'comfortable_tours', 'new_challenges'],
    medium: ['wine_tastings', 'cooking_classes', 'scenic_spots', 'quality_hotels'],
    low: ['extreme_activities'],
    never: ['hostels', 'party_focus', 'youth_venues', 'rushed_itineraries', 'budget_dining']
  },

  sabbatical_scholar: {
    high: ['lectures', 'courses', 'libraries', 'universities', 'bookshops', 'historical_deep_dives', 'museums'],
    medium: ['quiet_cafes', 'architecture', 'documentary_sites', 'talks'],
    low: ['beaches'],
    never: ['party', 'adventure', 'surface_tourism', 'nightclubs', 'shopping']
  },

  healing_journeyer: {
    high: ['nature', 'peaceful_walks', 'gardens', 'quiet_cafes', 'scenic_beauty', 'gentle_experiences', 'reflection_spots'],
    medium: ['art_for_reflection', 'journaling_spots', 'peaceful_churches'],
    low: ['one_meaningful_site'],
    never: ['crowds', 'pressure', 'nightlife', 'adrenaline', 'packed_schedules', 'forced_social']
  },

  retirement_ranger: {
    high: ['accessible_attractions', 'comfortable_tours', 'scenic_drives', 'good_restaurants', 'gardens', 'cultural_sites'],
    medium: ['museums', 'easy_walks', 'boat_tours', 'afternoon_tea'],
    low: ['physically_demanding'],
    never: ['extreme_walking', 'late_nights', 'hostels', 'youth_venues', 'nightclubs', 'budget_food']
  },

  balanced_story_collector: {
    high: ['mix_of_iconic_and_local', 'varied_experiences', 'good_value', 'memorable_moments', 'local_restaurants'],
    medium: ['most_categories', 'museums', 'neighborhoods', 'markets'],
    low: [],
    never: ['extreme_luxury', 'extreme_budget', 'extreme_pace']
  }
};

// =============================================================================
// TIME OF DAY PREFERENCES
// =============================================================================

export interface TimePreferences {
  startTime: string;
  endTime: string;
  peakEnergy: 'morning' | 'afternoon' | 'evening' | 'night';
  notes: string;
}

export const TIME_PREFERENCES: Record<string, TimePreferences> = {
  // Early risers (6-8am starts)
  wilderness_pioneer: { startTime: '06:00', endTime: '20:00', peakEnergy: 'morning', notes: 'Dawn starts for best wildlife/weather. Early to bed.' },
  adrenaline_architect: { startTime: '07:00', endTime: '21:00', peakEnergy: 'morning', notes: 'Early for best conditions. Recovery time needed.' },
  zen_seeker: { startTime: '06:30', endTime: '21:00', peakEnergy: 'morning', notes: 'Early morning practice. Peaceful evenings.' },
  bucket_list_conqueror: { startTime: '07:30', endTime: '22:00', peakEnergy: 'morning', notes: 'Early to beat crowds at major sites.' },

  // Morning people (8-9am starts)
  cultural_anthropologist: { startTime: '08:30', endTime: '22:00', peakEnergy: 'morning', notes: 'Morning for cultural sites when fresh.' },
  family_architect: { startTime: '08:30', endTime: '19:00', peakEnergy: 'morning', notes: 'After kids wake. Early dinner. Home by bedtime.' },
  eco_ethicist: { startTime: '08:00', endTime: '21:00', peakEnergy: 'morning', notes: 'Early for nature, sustainable pacing.' },
  community_builder: { startTime: '08:30', endTime: '21:00', peakEnergy: 'morning', notes: 'Aligned with local community schedules.' },
  retirement_ranger: { startTime: '09:00', endTime: '20:00', peakEnergy: 'morning', notes: 'Comfortable morning start. Early dinner preferred.' },
  retreat_regular: { startTime: '07:30', endTime: '21:00', peakEnergy: 'morning', notes: 'Morning wellness routine. Early, healthy dinner.' },

  // Normal (9-10am starts)
  art_aficionado: { startTime: '09:30', endTime: '22:00', peakEnergy: 'afternoon', notes: 'Museums open at 10. Evening cultural events.' },
  culinary_cartographer: { startTime: '09:00', endTime: '23:00', peakEnergy: 'evening', notes: 'Market mornings. Long, late dinners.' },
  midlife_explorer: { startTime: '09:00', endTime: '22:00', peakEnergy: 'afternoon', notes: 'Balanced, comfortable timing.' },
  sabbatical_scholar: { startTime: '09:00', endTime: '22:00', peakEnergy: 'afternoon', notes: 'Libraries and lecture schedules.' },
  balanced_story_collector: { startTime: '09:00', endTime: '22:00', peakEnergy: 'afternoon', notes: 'Flexible, balanced approach.' },
  collection_curator: { startTime: '09:30', endTime: '21:00', peakEnergy: 'afternoon', notes: 'Specialty venue hours.' },
  status_seeker: { startTime: '09:30', endTime: '00:00', peakEnergy: 'evening', notes: 'VIP experiences often afternoon/evening.' },
  urban_nomad: { startTime: '09:00', endTime: '23:00', peakEnergy: 'afternoon', notes: 'Cities come alive throughout the day.' },

  // Late starters (10-11am starts)  
  flexible_wanderer: { startTime: '10:00', endTime: '22:00', peakEnergy: 'afternoon', notes: 'No alarm. Wander when ready.' },
  slow_traveler: { startTime: '10:00', endTime: '21:00', peakEnergy: 'afternoon', notes: 'Natural waking. Long, slow days.' },
  beach_therapist: { startTime: '10:00', endTime: '21:00', peakEnergy: 'afternoon', notes: 'Beach by late morning. Sunset essential.' },
  luxury_luminary: { startTime: '10:00', endTime: '00:00', peakEnergy: 'evening', notes: 'Leisurely mornings. Late, elegant dinners.' },
  healing_journeyer: { startTime: '10:00', endTime: '20:00', peakEnergy: 'afternoon', notes: 'Gentle start. No pressure. Early, quiet evenings.' },
  romantic_curator: { startTime: '10:00', endTime: '23:00', peakEnergy: 'evening', notes: 'Lazy mornings. Sunset and dinner focus.' },
  sanctuary_seeker: { startTime: '10:00', endTime: '20:00', peakEnergy: 'afternoon', notes: 'Quiet mornings. Peaceful evenings.' },
  escape_artist: { startTime: '10:00', endTime: '21:00', peakEnergy: 'afternoon', notes: 'No alarm. No schedule. Whatever feels right.' },

  // Night owls (11am+ starts, late nights)
  digital_explorer: { startTime: '11:00', endTime: '02:00', peakEnergy: 'night', notes: 'Late riser. Gaming/nightlife late.' },
  social_butterfly: { startTime: '10:00', endTime: '03:00', peakEnergy: 'night', notes: 'Social activities peak at night.' },
  gap_year_graduate: { startTime: '10:00', endTime: '03:00', peakEnergy: 'night', notes: 'Hostel life. Late nights normal.' }
};

// =============================================================================
// ENVIRONMENT PREFERENCES
// =============================================================================

export interface EnvironmentPreferences {
  indoorOutdoor: 'indoor' | 'outdoor' | 'balanced';
  urbanNature: 'urban_only' | 'nature_only' | 'nature_preferred' | 'urban_preferred' | 'balanced';
  crowdTolerance: 'crowds_ok' | 'avoid_crowds' | 'vip_to_beat_crowds';
  structureLevel: 'highly_structured' | 'moderate' | 'low_structure' | 'none';
}

export const ENVIRONMENT_PREFERENCES: Record<string, EnvironmentPreferences> = {
  // Outdoor-focused
  wilderness_pioneer: { indoorOutdoor: 'outdoor', urbanNature: 'nature_only', crowdTolerance: 'avoid_crowds', structureLevel: 'moderate' },
  beach_therapist: { indoorOutdoor: 'outdoor', urbanNature: 'nature_preferred', crowdTolerance: 'avoid_crowds', structureLevel: 'low_structure' },
  eco_ethicist: { indoorOutdoor: 'outdoor', urbanNature: 'nature_preferred', crowdTolerance: 'avoid_crowds', structureLevel: 'moderate' },
  adrenaline_architect: { indoorOutdoor: 'outdoor', urbanNature: 'nature_preferred', crowdTolerance: 'crowds_ok', structureLevel: 'moderate' },

  // Indoor-focused
  art_aficionado: { indoorOutdoor: 'indoor', urbanNature: 'urban_preferred', crowdTolerance: 'avoid_crowds', structureLevel: 'moderate' },
  sabbatical_scholar: { indoorOutdoor: 'indoor', urbanNature: 'urban_preferred', crowdTolerance: 'avoid_crowds', structureLevel: 'moderate' },
  digital_explorer: { indoorOutdoor: 'indoor', urbanNature: 'urban_only', crowdTolerance: 'crowds_ok', structureLevel: 'low_structure' },

  // Urban-focused
  urban_nomad: { indoorOutdoor: 'outdoor', urbanNature: 'urban_only', crowdTolerance: 'crowds_ok', structureLevel: 'none' },
  social_butterfly: { indoorOutdoor: 'balanced', urbanNature: 'urban_preferred', crowdTolerance: 'crowds_ok', structureLevel: 'moderate' },
  gap_year_graduate: { indoorOutdoor: 'balanced', urbanNature: 'urban_preferred', crowdTolerance: 'crowds_ok', structureLevel: 'low_structure' },

  // Nature-preferred but not only
  zen_seeker: { indoorOutdoor: 'balanced', urbanNature: 'nature_preferred', crowdTolerance: 'avoid_crowds', structureLevel: 'moderate' },
  healing_journeyer: { indoorOutdoor: 'balanced', urbanNature: 'nature_preferred', crowdTolerance: 'avoid_crowds', structureLevel: 'none' },
  retreat_regular: { indoorOutdoor: 'balanced', urbanNature: 'nature_preferred', crowdTolerance: 'avoid_crowds', structureLevel: 'highly_structured' },

  // Avoid crowds specifically
  slow_traveler: { indoorOutdoor: 'balanced', urbanNature: 'balanced', crowdTolerance: 'avoid_crowds', structureLevel: 'low_structure' },
  flexible_wanderer: { indoorOutdoor: 'balanced', urbanNature: 'balanced', crowdTolerance: 'avoid_crowds', structureLevel: 'none' },
  romantic_curator: { indoorOutdoor: 'balanced', urbanNature: 'balanced', crowdTolerance: 'avoid_crowds', structureLevel: 'moderate' },
  sanctuary_seeker: { indoorOutdoor: 'balanced', urbanNature: 'balanced', crowdTolerance: 'avoid_crowds', structureLevel: 'none' },

  // VIP to beat crowds
  luxury_luminary: { indoorOutdoor: 'balanced', urbanNature: 'urban_preferred', crowdTolerance: 'vip_to_beat_crowds', structureLevel: 'moderate' },
  status_seeker: { indoorOutdoor: 'balanced', urbanNature: 'urban_preferred', crowdTolerance: 'vip_to_beat_crowds', structureLevel: 'moderate' },

  // Crowds OK (achievers, social)
  bucket_list_conqueror: { indoorOutdoor: 'balanced', urbanNature: 'balanced', crowdTolerance: 'crowds_ok', structureLevel: 'highly_structured' },
  family_architect: { indoorOutdoor: 'balanced', urbanNature: 'balanced', crowdTolerance: 'crowds_ok', structureLevel: 'moderate' },

  // Balanced defaults
  cultural_anthropologist: { indoorOutdoor: 'balanced', urbanNature: 'balanced', crowdTolerance: 'avoid_crowds', structureLevel: 'moderate' },
  culinary_cartographer: { indoorOutdoor: 'balanced', urbanNature: 'urban_preferred', crowdTolerance: 'avoid_crowds', structureLevel: 'moderate' },
  collection_curator: { indoorOutdoor: 'balanced', urbanNature: 'balanced', crowdTolerance: 'avoid_crowds', structureLevel: 'moderate' },
  community_builder: { indoorOutdoor: 'balanced', urbanNature: 'balanced', crowdTolerance: 'crowds_ok', structureLevel: 'moderate' },
  midlife_explorer: { indoorOutdoor: 'balanced', urbanNature: 'balanced', crowdTolerance: 'avoid_crowds', structureLevel: 'moderate' },
  retirement_ranger: { indoorOutdoor: 'balanced', urbanNature: 'balanced', crowdTolerance: 'avoid_crowds', structureLevel: 'moderate' },
  balanced_story_collector: { indoorOutdoor: 'balanced', urbanNature: 'balanced', crowdTolerance: 'crowds_ok', structureLevel: 'moderate' }
};

// =============================================================================
// PHYSICAL INTENSITY
// =============================================================================

export interface PhysicalIntensity {
  level: 'high' | 'moderate' | 'low';
  dailySteps: string;
  walkingHours: string;
  notes: string;
}

export const PHYSICAL_INTENSITY: Record<string, PhysicalIntensity> = {
  // High intensity
  wilderness_pioneer: { level: 'high', dailySteps: '20,000-30,000', walkingHours: '5-8', notes: 'Full-day hikes, physical challenges expected.' },
  adrenaline_architect: { level: 'high', dailySteps: '15,000-25,000', walkingHours: '4-6', notes: 'High energy activities. Recovery time needed.' },
  urban_nomad: { level: 'high', dailySteps: '18,000-25,000', walkingHours: '5-7', notes: 'Walking is the point. Covers many neighborhoods.' },
  bucket_list_conqueror: { level: 'high', dailySteps: '15,000-20,000', walkingHours: '4-5', notes: 'Lots of sites = lots of walking. Efficient routing.' },

  // Moderate intensity
  cultural_anthropologist: { level: 'moderate', dailySteps: '12,000-16,000', walkingHours: '3-4', notes: 'Walking tours and neighborhood exploration.' },
  culinary_cartographer: { level: 'moderate', dailySteps: '10,000-15,000', walkingHours: '3-4', notes: 'Food tours, market visits, restaurant hopping.' },
  art_aficionado: { level: 'moderate', dailySteps: '10,000-14,000', walkingHours: '3-4', notes: 'Museum walking, gallery hopping. Standing time in museums.' },
  gap_year_graduate: { level: 'moderate', dailySteps: '12,000-18,000', walkingHours: '3-5', notes: 'Budget means walking. Young and flexible.' },
  midlife_explorer: { level: 'moderate', dailySteps: '10,000-14,000', walkingHours: '3-4', notes: 'Active but comfortable. Smart about energy.' },
  collection_curator: { level: 'moderate', dailySteps: '10,000-14,000', walkingHours: '3-4', notes: 'Focused walking in areas of interest.' },
  social_butterfly: { level: 'moderate', dailySteps: '10,000-15,000', walkingHours: '3-4', notes: 'Group activities, walking tours, bar hopping.' },
  eco_ethicist: { level: 'moderate', dailySteps: '12,000-16,000', walkingHours: '3-5', notes: 'Walking and biking preferred over transport.' },
  community_builder: { level: 'moderate', dailySteps: '10,000-14,000', walkingHours: '3-4', notes: 'Community visits, neighborhood walking.' },
  sabbatical_scholar: { level: 'moderate', dailySteps: '8,000-12,000', walkingHours: '2-3', notes: 'Library time, lectures, some walking.' },
  balanced_story_collector: { level: 'moderate', dailySteps: '10,000-14,000', walkingHours: '3-4', notes: 'Balanced mix of activity types.' },
  digital_explorer: { level: 'moderate', dailySteps: '8,000-12,000', walkingHours: '2-3', notes: 'Some walking for photo spots, but lots of sitting.' },
  status_seeker: { level: 'moderate', dailySteps: '8,000-12,000', walkingHours: '2-3', notes: 'Private transport available. Walking is by choice.' },
  zen_seeker: { level: 'moderate', dailySteps: '8,000-12,000', walkingHours: '2-4', notes: 'Mindful walking, nature walks. Gentle pace.' },
  romantic_curator: { level: 'moderate', dailySteps: '10,000-14,000', walkingHours: '3-4', notes: 'Scenic walks together. Leisurely pace.' },
  family_architect: { level: 'moderate', dailySteps: '8,000-12,000', walkingHours: '2-3', notes: 'Kid pace. Rest breaks. Stroller-friendly routes.' },

  // Low intensity
  slow_traveler: { level: 'low', dailySteps: '5,000-10,000', walkingHours: '1-2', notes: 'Leisurely. Lots of sitting. Transport between areas.' },
  luxury_luminary: { level: 'low', dailySteps: '5,000-10,000', walkingHours: '1-2', notes: 'Private transport. Walking is scenic, not practical.' },
  beach_therapist: { level: 'low', dailySteps: '4,000-8,000', walkingHours: '1-2', notes: 'Beach lounging. Coastal strolls. Not hiking.' },
  healing_journeyer: { level: 'low', dailySteps: '5,000-8,000', walkingHours: '1-2', notes: 'Gentle only. No exertion. Rest is important.' },
  retirement_ranger: { level: 'low', dailySteps: '5,000-10,000', walkingHours: '1-2', notes: 'Accessible routes. Rest breaks. Seated options.' },
  sanctuary_seeker: { level: 'low', dailySteps: '5,000-8,000', walkingHours: '1-2', notes: 'Quiet, private. Not rushing anywhere.' },
  retreat_regular: { level: 'low', dailySteps: '5,000-10,000', walkingHours: '1-2', notes: 'Spa and wellness focus. Gentle movement only.' },
  flexible_wanderer: { level: 'low', dailySteps: '6,000-12,000', walkingHours: '2-3', notes: 'Wandering at their own pace. Can stop anytime.' }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getExperienceAffinity(archetype: string | undefined): ExperienceAffinity {
  if (!archetype) {
    return EXPERIENCE_AFFINITY.balanced_story_collector;
  }
  
  const key = archetype.toLowerCase().replace(/[\s-]/g, '_');
  return EXPERIENCE_AFFINITY[key] || EXPERIENCE_AFFINITY.balanced_story_collector;
}

export function getTimePreferences(archetype: string | undefined): TimePreferences {
  if (!archetype) {
    return TIME_PREFERENCES.balanced_story_collector;
  }
  
  const key = archetype.toLowerCase().replace(/[\s-]/g, '_');
  return TIME_PREFERENCES[key] || TIME_PREFERENCES.balanced_story_collector;
}

export function getEnvironmentPreferences(archetype: string | undefined): EnvironmentPreferences {
  if (!archetype) {
    return ENVIRONMENT_PREFERENCES.balanced_story_collector;
  }
  
  const key = archetype.toLowerCase().replace(/[\s-]/g, '_');
  return ENVIRONMENT_PREFERENCES[key] || ENVIRONMENT_PREFERENCES.balanced_story_collector;
}

export function getPhysicalIntensity(archetype: string | undefined): PhysicalIntensity {
  if (!archetype) {
    return PHYSICAL_INTENSITY.balanced_story_collector;
  }
  
  const key = archetype.toLowerCase().replace(/[\s-]/g, '_');
  return PHYSICAL_INTENSITY[key] || PHYSICAL_INTENSITY.balanced_story_collector;
}

// =============================================================================
// BUILD EXPERIENCE GUIDANCE PROMPT
// =============================================================================

export function buildExperienceGuidancePrompt(archetype: string | undefined): string {
  const affinity = getExperienceAffinity(archetype);
  const time = getTimePreferences(archetype);
  const env = getEnvironmentPreferences(archetype);
  const intensity = getPhysicalIntensity(archetype);
  
  const crowdText = {
    'crowds_ok': 'Crowds are acceptable, can visit popular sites at peak times',
    'avoid_crowds': 'AVOID crowded times. Visit popular sites early morning or late afternoon',
    'vip_to_beat_crowds': 'Use VIP access to skip lines. Never wait in queues.'
  }[env.crowdTolerance];
  
  const structureText = {
    'highly_structured': 'Structured itinerary with clear times and bookings',
    'moderate': 'Balanced structure with some flexibility',
    'low_structure': 'Loose structure, suggestions more than schedules',
    'none': 'Minimal structure. Neighborhoods to explore, not hourly schedules'
  }[env.structureLevel];
  
  return `
=== EXPERIENCE PRIORITIES ===

ACTIVELY SEEK OUT (high priority):
${affinity.high.map(e => `✓ ${e.replace(/_/g, ' ')}`).join('\n')}

INCLUDE IF AVAILABLE (medium priority):
${affinity.medium.map(e => `• ${e.replace(/_/g, ' ')}`).join('\n')}

ONLY IF ESSENTIAL (low priority):
${affinity.low.length > 0 ? affinity.low.map(e => `○ ${e.replace(/_/g, ' ')}`).join('\n') : '(none specified)'}

NEVER INCLUDE:
${affinity.never.map(e => `✗ ${e.replace(/_/g, ' ')}`).join('\n')}

=== TIMING & ENERGY ===

Day structure:
- Start time: ${time.startTime}
- End time: ${time.endTime}
- Peak energy: ${time.peakEnergy} - schedule demanding activities then
- ${time.notes}

=== ENVIRONMENT ===

- Indoor/Outdoor: ${env.indoorOutdoor}
- Urban/Nature: ${env.urbanNature.replace(/_/g, ' ')}
- Crowd tolerance: ${crowdText}
- Structure level: ${structureText}

=== PHYSICAL INTENSITY: ${intensity.level.toUpperCase()} ===

- Expected daily walking: ${intensity.walkingHours} hours
- Approximate steps: ${intensity.dailySteps}
- ${intensity.notes}

When selecting activities, verify:
1. Is this in HIGH priority categories? → Good choice
2. Is this in NEVER categories? → DO NOT INCLUDE
3. Does physical intensity match this traveler's level?
4. Does timing work with their energy patterns?
5. Does environment preference align?
`;
}
