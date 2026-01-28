// =============================================================================
// DESTINATION × ARCHETYPE GUIDES
// =============================================================================
// Specific recommendations for each archetype in each destination.
// Start with major destinations, expand over time.
// =============================================================================

export interface DestinationArchetypeGuide {
  mustDo: string[];           // Can't miss for this archetype
  perfectFor: string[];       // Ideal matches
  hiddenGems: string[];       // Lesser known but fits
  avoid: string[];            // Skip these
  neighborhoods: string[];    // Where to stay/wander
  diningStyle: string;        // What kind of restaurants
}

export interface DestinationGuide {
  destination: string;
  country: string;
  byArchetype: Record<string, DestinationArchetypeGuide>;
}

// =============================================================================
// ROME
// =============================================================================

const ROME_GUIDE: DestinationGuide = {
  destination: 'Rome',
  country: 'Italy',
  byArchetype: {
    flexible_wanderer: {
      mustDo: ['Colosseum (at your own pace)', 'Trastevere wandering'],
      perfectFor: ['Monti neighborhood', 'Testaccio streets', 'Jewish Ghetto wandering', 'Piazza Navona at night', 'Piazza Santa Maria in Trastevere'],
      hiddenGems: ['Aventine Hill keyhole', 'Quartiere Coppedè', 'Protestant Cemetery', 'Via Margutta quiet streets'],
      avoid: ['Vatican tour groups', 'Spanish Steps at midday', 'Structured multi-stop tours', 'Restaurants with photo menus'],
      neighborhoods: ['Trastevere', 'Monti', 'Testaccio'],
      diningStyle: 'Find a trattoria that looks good, no reservations. Ask locals.'
    },

    culinary_cartographer: {
      mustDo: ['Testaccio Market', 'Carbonara at a proper trattoria', 'Supplì tasting'],
      perfectFor: ['Campo de Fiori morning market', 'Jewish Ghetto fried artichokes', 'Pasta-making class', 'Roscioli deli counter'],
      hiddenGems: ['Trapizzino in Testaccio', 'Giolitti gelato (not tourist, actually good)', 'Pizza bianca from Antico Forno', 'Aperitivo in Pigneto'],
      avoid: ['Restaurants on Piazza Navona', 'Anywhere with photos on menu', 'Near Vatican tourist traps', 'Alfredo restaurants (tourist myth)'],
      neighborhoods: ['Testaccio (food neighborhood)', 'Jewish Ghetto', 'Trastevere for dinner'],
      diningStyle: 'Research specific trattorias. One splurge at Roscioli or Armando al Pantheon. Otherwise local spots.'
    },

    cultural_anthropologist: {
      mustDo: ['Colosseum with deep historical context', 'Vatican Museums (early, less crowds)', 'Roman Forum understanding layers of history'],
      perfectFor: ['Appian Way ancient road', 'Ostia Antica day trip', 'Capitoline Museums', 'Centrale Montemartini'],
      hiddenGems: ['San Clemente church layers (Roman history in one building)', 'Crypta Balbi', 'Case Romane del Celio', 'Jewish Ghetto history walk'],
      avoid: ['Hop-on hop-off buses', 'Surface-level photo tours', 'Restaurants near major attractions'],
      neighborhoods: ['Centro Storico', 'Aventine', 'Celio'],
      diningStyle: 'Traditional Roman cuisine with history. Trattorias in residential areas.'
    },

    luxury_luminary: {
      mustDo: ['Private Vatican tour (after hours if possible)', 'Rooftop aperitivo at Hotel Eden'],
      perfectFor: ['La Pergola (3 Michelin stars)', 'Private Borghese Gallery tour', 'Bulgari spa', 'Il Pagliaccio tasting menu'],
      hiddenGems: ['Private palazzo visits', 'After-hours Sistine Chapel (if available)', 'Hassler rooftop bar', 'Private art collection tours'],
      avoid: ['Crowded sites at peak times', 'Budget restaurants', 'Public transport', 'Standing in any line'],
      neighborhoods: ['Via Veneto', 'Piazza di Spagna area', 'Parioli'],
      diningStyle: 'Michelin and acclaimed chef restaurants. Hotel dining done right.'
    },

    slow_traveler: {
      mustDo: ['Colosseum (no rush, really look)', 'One museum done properly (Borghese or Capitoline)'],
      perfectFor: ['Morning espresso ritual at a neighborhood bar', 'Borghese Gardens picnic and wandering', 'Sitting in Piazza Santa Maria in Trastevere', 'Afternoon in a single piazza'],
      hiddenGems: ['Orange Garden (Giardino degli Aranci) at sunset', 'Villa Doria Pamphili park', 'Caffè Sant Eustachio ritual', 'Quiet churches for contemplation'],
      avoid: ['Vatican in one morning rush', 'Multiple sites per day', 'Rushed meals', 'Tour groups anywhere'],
      neighborhoods: ['Trastevere', 'Prati (quieter)', 'Aventine'],
      diningStyle: 'Long lunches, simple dinners, 90+ minutes always. Never hurry a meal.'
    },

    adrenaline_architect: {
      mustDo: ['Colosseum underground tour (the intense version)'],
      perfectFor: ['Bike the Appian Way', 'Day trip to hike near Rome', 'Vespa tour of the city', 'Run through Villa Borghese at dawn'],
      hiddenGems: ['Catacombs exploration', 'Climbing St Peters dome (551 steps)', 'Night running route along Tiber'],
      avoid: ['Sitting in piazzas', 'Long museum visits', 'Fine dining', 'Anything described as leisurely'],
      neighborhoods: ['Anywhere with bike access', 'Near parks for running'],
      diningStyle: 'Quick, fuel-focused. Pizza al taglio. Grab and go.'
    },

    romantic_curator: {
      mustDo: ['Trevi Fountain at night (go late, fewer crowds)', 'Sunset from Pincian Hill'],
      perfectFor: ['Orange Garden sunset together', 'Dinner in Trastevere candlelit streets', 'Villa Borghese rowboats', 'Aperitivo overlooking the city'],
      hiddenGems: ['Aventine keyhole view together', 'Ponte Sisto at dusk', 'Via Giulia quiet evening walk', 'Castel Sant Angelo sunset'],
      avoid: ['Crowded Vatican midday', 'Group tours', 'Family restaurants', 'Fast food anywhere'],
      neighborhoods: ['Trastevere', 'Monti', 'Centro Storico evenings'],
      diningStyle: 'Intimate trattorias, candlelit, outdoor seating preferred. One special dinner.'
    },

    beach_therapist: {
      mustDo: ['Day trip to Sperlonga or Santa Marinella beach'],
      perfectFor: ['Ostia beach day', 'Coastal train ride along the Tyrrhenian', 'Fregene beach clubs'],
      hiddenGems: ['Anzio for seafood lunch by the water', 'Santa Severa castle beach', 'Sabaudia dunes'],
      avoid: ['Too many city sightseeing days', 'Being landlocked', 'Inland restaurants', 'Churches and museums overdose'],
      neighborhoods: ['Stay near Termini for easy beach train access', 'Or stay in Trastevere for evening vibes'],
      diningStyle: 'Seafood, casual, beachside. Fried fish and cold wine.'
    },

    bucket_list_conqueror: {
      mustDo: ['Colosseum', 'Vatican/Sistine Chapel', 'Trevi Fountain', 'Pantheon', 'Spanish Steps', 'Roman Forum'],
      perfectFor: ['St Peters dome climb', 'Palatine Hill', 'Piazza Navona', 'Castel Sant Angelo'],
      hiddenGems: ['Mouth of Truth (quick photo)', 'Altare della Patria rooftop'],
      avoid: ['Spending too long anywhere', 'Missing major sites', 'Too much downtime'],
      neighborhoods: ['Centro Storico (most efficient for sites)'],
      diningStyle: 'Efficient, good enough to keep moving. Not the priority.'
    },

    art_aficionado: {
      mustDo: ['Vatican Museums (properly, not rushed)', 'Borghese Gallery (must book ahead)'],
      perfectFor: ['MAXXI contemporary art', 'Palazzo Barberini Caravaggios', 'Caravaggio church tour (free!)', 'Galleria Doria Pamphilj'],
      hiddenGems: ['Centrale Montemartini (ancient art in power plant)', 'Street art in Ostiense/Pigneto', 'Palazzo Altemps', 'Macro museum'],
      avoid: ['Rushing through any museum', 'Skipping the art', 'Nature-focused activities'],
      neighborhoods: ['Centro (museum access)', 'Ostiense/Pigneto (contemporary)', 'Flaminio (MAXXI)'],
      diningStyle: 'Near cultural districts. Design-focused restaurants appreciated.'
    },

    zen_seeker: {
      mustDo: ['Early morning Pantheon (nearly empty)', 'Orange Garden at dawn'],
      perfectFor: ['Basilica Santa Maria Maggiore quiet hours', 'Borghese Gardens meditation', 'Chiesa del Gesù silence', 'Quiet cloister visits'],
      hiddenGems: ['Sant Ivo alla Sapienza (peaceful architecture)', 'Aventine churches (very quiet)', 'Protestant Cemetery peace', 'Orto Botanico gardens'],
      avoid: ['Crowds', 'Vatican midday chaos', 'Nightlife areas', 'Noisy trattorias'],
      neighborhoods: ['Aventine (most peaceful)', 'Prati', 'EUR (quiet, modern)'],
      diningStyle: 'Quiet restaurants, vegetarian options, peaceful settings.'
    },

    social_butterfly: {
      mustDo: ['Free walking tour (meet people)', 'Pub crawl in Centro'],
      perfectFor: ['Campo de Fiori nightlife', 'Trastevere bar hopping', 'Group cooking class', 'Aperitivo scene'],
      hiddenGems: ['Pigneto hipster bars', 'San Lorenzo student area', 'Testaccio clubs', 'Ostiense nightlife'],
      avoid: ['Solo contemplation', 'Private tours', 'Quiet museums alone', 'Early mornings'],
      neighborhoods: ['Trastevere', 'Campo de Fiori', 'San Lorenzo', 'Pigneto'],
      diningStyle: 'Communal tables, lively atmosphere, group-friendly spots.'
    },

    family_architect: {
      mustDo: ['Colosseum (gladiator stories for kids)', 'Gelato mission'],
      perfectFor: ['Borghese Gardens playground and zoo', 'Explora children museum', 'Pizza-making class', 'Gladiator school for kids'],
      hiddenGems: ['Time Elevator Rome', 'Technotown science museum', 'Villa Borghese bike rentals', 'Hydromania water park (summer)'],
      avoid: ['Long museum visits', 'Late dinners', 'Fine dining', 'Vatican with small children (too long)'],
      neighborhoods: ['Near Borghese Gardens (space for kids)', 'Trastevere (family-friendly vibe)'],
      diningStyle: 'Kid-friendly, pizza, early dinner times. Outdoor seating for wiggle room.'
    },

    gap_year_graduate: {
      mustDo: ['Free walking tour', 'Pantheon (free)', 'Sunset from Pincio (free)'],
      perfectFor: ['Street food in Testaccio', 'Aperitivo deals (one drink = free food)', 'San Lorenzo bars', 'Trastevere cheap eats'],
      hiddenGems: ['Pigneto student bars', 'Free church art (Caravaggio!)', 'Picnic in Borghese Gardens', 'Happy hour pizza'],
      avoid: ['Expensive restaurants', 'Private tours', 'Luxury anything', 'Tourist trap areas'],
      neighborhoods: ['Trastevere', 'San Lorenzo', 'Pigneto', 'Near Termini (hostels)'],
      diningStyle: 'Street food, pizza al taglio, aperitivo buffets, cheap trattorias.'
    },

    retreat_regular: {
      mustDo: ['Day at QC Terme spa', 'Borghese Gardens yoga'],
      perfectFor: ['Aqvi spa treatments', 'Vegetarian restaurants', 'Morning meditation classes', 'Thermal bath day trips'],
      hiddenGems: ['Terme di Roma', 'Yoga studios in Prati', 'Organic restaurants in Testaccio', 'Day trip to Terme dei Papi'],
      avoid: ['Crowded tourist sites', 'Heavy Roman food', 'Nightlife', 'Rushed schedules'],
      neighborhoods: ['Prati', 'EUR (quiet, green)'],
      diningStyle: 'Healthy, vegetarian-friendly, light. Juice bars.'
    },

    eco_ethicist: {
      mustDo: ['Bike tour of Rome', 'Local neighborhood markets'],
      perfectFor: ['Appian Way by bike', 'Farmers markets', 'Local cooperatives', 'Sustainable restaurants'],
      hiddenGems: ['NaturaSì organic markets', 'Car-free Sunday routes', 'Urban gardens', 'Zero-waste shops'],
      avoid: ['Tour buses', 'Chain restaurants', 'Over-touristed spots at peak', 'Disposable everything'],
      neighborhoods: ['Testaccio', 'Trastevere', 'Pigneto'],
      diningStyle: 'Farm-to-table, local, seasonal, organic when possible.'
    },

    urban_nomad: {
      mustDo: ['Walk from neighborhood to neighborhood, no metro', 'Discover at least 5 different areas'],
      perfectFor: ['Monti to Trastevere on foot', 'Testaccio market life', 'Campo de Fiori morning', 'San Lorenzo graffiti', 'Pigneto streets'],
      hiddenGems: ['Garbatella neighborhood', 'Ostiense street art', 'Via dei Coronari antiques', 'Rione Ponte'],
      avoid: ['Taxis for short trips', 'Staying in one area', 'Organized tours', 'Nature outside the city'],
      neighborhoods: ['All of them. Different one each day.'],
      diningStyle: 'Whatever looks good in whatever neighborhood youre in. Street food preferred.'
    }
  }
};

// =============================================================================
// PARIS
// =============================================================================

const PARIS_GUIDE: DestinationGuide = {
  destination: 'Paris',
  country: 'France',
  byArchetype: {
    flexible_wanderer: {
      mustDo: ['Eiffel Tower area (wander, dont queue)', 'Le Marais wandering'],
      perfectFor: ['Saint-Germain streets', 'Canal Saint-Martin', 'Montmartre side streets', 'Ile Saint-Louis stroll'],
      hiddenGems: ['Covered passages (Galerie Vivienne)', 'Rue Cremieux', 'Parc des Buttes-Chaumont', 'La Campagne à Paris village'],
      avoid: ['Louvre marathon', 'Eiffel Tower line', 'Champs-Élysées crowds', 'Rigid tour schedules'],
      neighborhoods: ['Le Marais', 'Saint-Germain', 'Montmartre (upper, quiet)'],
      diningStyle: 'Neighborhood bistros. No reservations. Find a terrace.'
    },

    culinary_cartographer: {
      mustDo: ['Croissant from a real boulangerie (not chain)', 'Classic bistro dinner'],
      perfectFor: ['Marché dAligre', 'Rue Montorgueil food street', 'Cooking class', 'Cheese shop tasting'],
      hiddenGems: ['Du Pain et des Idées bakery', 'Marché des Enfants Rouges', 'Hidden wine bars in Le Marais', 'Breizh Café crêpes'],
      avoid: ['Restaurants on Champs-Élysées', 'Tourist menus', 'Chains', 'Ladurée main store (overrated)'],
      neighborhoods: ['Le Marais', '11th arrondissement', 'Oberkampf', 'Montorgueil'],
      diningStyle: 'Bistronomy scene, natural wine bars, neighborhood spots. One Michelin splurge.'
    },

    art_aficionado: {
      mustDo: ['Musée dOrsay (not Louvre first)', 'Fondation Louis Vuitton'],
      perfectFor: ['Louvre (one wing, properly)', 'Centre Pompidou', 'Musée de lOrangerie', 'Rodin Museum'],
      hiddenGems: ['Musée Picasso', 'Palais de Tokyo', 'Atelier des Lumières', 'Street art in Belleville'],
      avoid: ['Rushing the Louvre', 'Skipping contemporary', 'Only major museums'],
      neighborhoods: ['Le Marais (galleries)', 'Saint-Germain', 'Belleville (street art)'],
      diningStyle: 'Design-conscious restaurants, museum cafés, artistic neighborhoods.'
    },

    romantic_curator: {
      mustDo: ['Sunset at Sacré-Cœur', 'Seine evening walk'],
      perfectFor: ['Pont des Arts', 'Luxembourg Gardens', 'Le Marais dinner', 'Montmartre evening'],
      hiddenGems: ['Square du Vert-Galant', 'Covered passages at dusk', 'Parc Monceau', 'Île de la Cité midnight'],
      avoid: ['Crowded Eiffel Tower base', 'Moulin Rouge tourist crowds', 'Group tours'],
      neighborhoods: ['Le Marais', 'Saint-Germain', 'Île Saint-Louis'],
      diningStyle: 'Intimate bistros, candlelit, terrace dining. One special dinner.'
    },

    slow_traveler: {
      mustDo: ['Luxembourg Gardens afternoon', 'One museum, no rushing'],
      perfectFor: ['Café culture properly (2 hours minimum)', 'Bookshops on Left Bank', 'Canal Saint-Martin sitting', 'Tuileries bench time'],
      hiddenGems: ['Shakespeare and Company hours', 'Palais Royal gardens', 'Square des Batignolles', 'Musée Rodin garden'],
      avoid: ['Louvre in one day', 'Multiple arrondissements daily', 'Quick meals', 'Tour schedules'],
      neighborhoods: ['Saint-Germain', 'Le Marais', '5th Latin Quarter'],
      diningStyle: 'Long lunches, terraces, watching the world. Coffee that lasts.'
    },

    luxury_luminary: {
      mustDo: ['Private after-hours Versailles', 'Dinner at Alain Ducasse'],
      perfectFor: ['Plaza Athénée', 'Dior spa', 'Private Louvre tour', 'Champagne at Ritz Bar'],
      hiddenGems: ['Private gallery viewings', 'Haute couture appointments', 'Exclusive members clubs'],
      avoid: ['Queues anywhere', 'Tourist restaurants', 'Public transport'],
      neighborhoods: ['8th (Golden Triangle)', '1st (Ritz area)', '6th (Saint-Germain)'],
      diningStyle: 'Multi-Michelin, private dining, palace hotel restaurants.'
    },

    bucket_list_conqueror: {
      mustDo: ['Eiffel Tower', 'Louvre (Mona Lisa)', 'Notre-Dame area', 'Arc de Triomphe', 'Versailles'],
      perfectFor: ['Sacré-Cœur', 'Champs-Élysées', 'Seine cruise', 'Moulin Rouge'],
      hiddenGems: ['Catacombs', 'Sainte-Chapelle (often missed)'],
      avoid: ['Missing the classics', 'Too much time in one place'],
      neighborhoods: ['Central for efficiency'],
      diningStyle: 'Good enough to keep moving. Iconic spots.'
    }
  }
};

// =============================================================================
// TOKYO
// =============================================================================

const TOKYO_GUIDE: DestinationGuide = {
  destination: 'Tokyo',
  country: 'Japan',
  byArchetype: {
    flexible_wanderer: {
      mustDo: ['Get lost in Shibuya backstreets', 'Yanaka old Tokyo wandering'],
      perfectFor: ['Shimokitazawa vintage', 'Nakameguro canal', 'Koenji quirky streets', 'Golden Gai alleys'],
      hiddenGems: ['Yanesen (Yanaka-Nezu-Sendagi)', 'Kagurazaka French-Japanese quarter', 'Tomigaya village', 'Daikanyama quiet streets'],
      avoid: ['Tsukiji outer market tourist crush', 'Robot Restaurant (tourist trap)', 'Guided group tours'],
      neighborhoods: ['Shimokitazawa', 'Nakameguro', 'Yanaka'],
      diningStyle: 'Find a tiny counter spot. No reservation. Plastic food displays guide you.'
    },

    culinary_cartographer: {
      mustDo: ['Tsukiji outer market breakfast', 'Ramen in a proper shop', 'Izakaya experience'],
      perfectFor: ['Depachika (department store food halls)', 'Sushi counter omakase', 'Yakitori alley', 'Kaiseki multi-course'],
      hiddenGems: ['Omoide Yokocho alleys', 'Harmonica Yokocho Kichijoji', 'Kappabashi kitchen street', 'Standing bars under Yurakucho tracks'],
      avoid: ['Chain restaurants', 'Tourist conveyor sushi', 'Starbucks', 'American chains'],
      neighborhoods: ['Ginza (high-end)', 'Ebisu (foodie)', 'Shibuya/Shinjuku (variety)'],
      diningStyle: 'Counter seats, watch the chef. One Michelin splurge. Lots of street food.'
    },

    digital_explorer: {
      mustDo: ['TeamLab Planets', 'Akihabara deep dive'],
      perfectFor: ['VR arcades', 'Robot Restaurant (its a spectacle)', 'Gaming cafes', 'Harajuku photo spots'],
      hiddenGems: ['Nakano Broadway (otaku paradise)', 'Super Potato retro games', 'Digital art cafes', 'Sunshine City gaming'],
      avoid: ['Early mornings', 'Traditional temples only', 'Quiet zen experiences'],
      neighborhoods: ['Akihabara', 'Ikebukuro', 'Shibuya', 'Harajuku'],
      diningStyle: 'Themed cafes, gaming cafes, late-night ramen.'
    },

    zen_seeker: {
      mustDo: ['Senso-ji at 5am (no crowds)', 'Meiji Shrine forest walk'],
      perfectFor: ['Shinjuku Gyoen gardens', 'Temple lodging (shukubo)', 'Tea ceremony experience', 'Zazen meditation class'],
      hiddenGems: ['Nezu Shrine peaceful grounds', 'Gotokuji cat temple', 'Rikugien garden', 'Kyu-Furukawa Gardens'],
      avoid: ['Shibuya crossing madness', 'Robot Restaurant', 'Harajuku weekends', 'Golden Gai crowds'],
      neighborhoods: ['Yanaka', 'Ueno park area', 'Near Meiji Shrine'],
      diningStyle: 'Shojin ryori (temple cuisine), quiet tea houses, vegetarian options.'
    },

    urban_nomad: {
      mustDo: ['Walk across at least 5 neighborhoods in a day', 'Shibuya to Harajuku to Shinjuku on foot'],
      perfectFor: ['Neighborhood hopping by train', 'Street photography', 'Backstreet exploration', 'Nighttime city walks'],
      hiddenGems: ['Between stations exploring', 'Residential neighborhood discovery', 'Tokyo side streets', 'Beneath elevated tracks'],
      avoid: ['Staying in one area', 'Tour buses', 'Only major attractions'],
      neighborhoods: ['All of them. Different feel each one.'],
      diningStyle: 'Whatever the neighborhood specialty is. Counter seats.'
    },

    bucket_list_conqueror: {
      mustDo: ['Shibuya Crossing', 'Senso-ji', 'Meiji Shrine', 'Tokyo Tower or Skytree', 'Tsukiji Market'],
      perfectFor: ['Harajuku Takeshita Street', 'Imperial Palace East Gardens', 'Akihabara', 'Shinjuku nightlife'],
      hiddenGems: ['TeamLab (newer but bucket-list level)'],
      avoid: ['Missing the iconic shots', 'Too slow'],
      neighborhoods: ['Central Tokyo for efficiency'],
      diningStyle: 'Hit the famous spots, keep moving.'
    }
  }
};

// =============================================================================
// BARCELONA
// =============================================================================

const BARCELONA_GUIDE: DestinationGuide = {
  destination: 'Barcelona',
  country: 'Spain',
  byArchetype: {
    flexible_wanderer: {
      mustDo: ['La Sagrada Familia (book ahead)', 'Gothic Quarter wandering'],
      perfectFor: ['El Born neighborhood', 'Gràcia village feel', 'Beach walk Barceloneta', 'El Raval exploration'],
      hiddenGems: ['Jardins del Laberint', 'Sant Pau modernist hospital', 'Poblenou street art', 'Bunkers del Carmel sunset'],
      avoid: ['Las Ramblas main stretch', 'Tourist restaurants on squares', 'Structured Gaudi tours'],
      neighborhoods: ['El Born', 'Gràcia', 'Poblenou'],
      diningStyle: 'Vermouth bars, tapas hopping, find a terrace.'
    },

    beach_therapist: {
      mustDo: ['Barceloneta beach morning', 'Sunset from beach bars'],
      perfectFor: ['Mar Bella quieter beach', 'Bogatell beach', 'Port Olimpic waterfront', 'Sitges day trip'],
      hiddenGems: ['Ocata beach (train ride)', 'Calellas rocky coves', 'Nova Mar Bella', 'Castelldefels'],
      avoid: ['Sagrada Familia if beach weather', 'Inland all day', 'Too much museum time'],
      neighborhoods: ['Barceloneta', 'Poblenou (beach access)'],
      diningStyle: 'Seafood paella, chiringuitos (beach bars), casual and salty.'
    },

    culinary_cartographer: {
      mustDo: ['La Boqueria market (early, before tourists)', 'Proper paella'],
      perfectFor: ['Tapas crawl in El Born', 'Vermouth hour tradition', 'Catalan cooking class', 'Santa Caterina market'],
      hiddenGems: ['Bar Brutal natural wines', 'Quimet y Quimet (tiny, incredible)', 'Can Paixano cava bar', 'La Pepita gourmet tapas'],
      avoid: ['Las Ramblas tourist restaurants', 'Paella near the beach (tourist traps)', 'Chains'],
      neighborhoods: ['El Born', 'Sant Antoni', 'Poble Sec'],
      diningStyle: 'Tapas hopping, vermouth culture, late dinners (9pm+). One fine dining splurge.'
    },

    art_aficionado: {
      mustDo: ['Picasso Museum', 'Gaudí modernist route'],
      perfectFor: ['MACBA contemporary', 'Fundació Joan Miró', 'La Pedrera/Casa Batlló', 'MNAC'],
      hiddenGems: ['Hospital Sant Pau', 'Palau de la Música interior', 'Can Framis contemporary', 'Street art in Poblenou'],
      avoid: ['Rushing Gaudí', 'Skipping modernisme', 'Only beaches'],
      neighborhoods: ['Eixample (modernist architecture)', 'El Born', 'Montjuïc'],
      diningStyle: 'Design-conscious spots, artistic neighborhoods, gallery district dining.'
    }
  }
};

// =============================================================================
// DESTINATION REGISTRY
// =============================================================================

const DESTINATION_GUIDES: Record<string, DestinationGuide> = {
  'rome': ROME_GUIDE,
  'roma': ROME_GUIDE,
  'paris': PARIS_GUIDE,
  'tokyo': TOKYO_GUIDE,
  '東京': TOKYO_GUIDE,
  'barcelona': BARCELONA_GUIDE,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function normalizeDestination(destination: string): string {
  return destination.toLowerCase()
    .split(',')[0] // Take city name only
    .trim()
    .replace(/[^a-z\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g, '');
}

export function getDestinationGuide(destination: string): DestinationGuide | null {
  const normalized = normalizeDestination(destination);
  return DESTINATION_GUIDES[normalized] || null;
}

export function getArchetypeDestinationGuide(
  destination: string,
  archetype: string
): DestinationArchetypeGuide | null {
  const guide = getDestinationGuide(destination);
  if (!guide) return null;
  
  const key = archetype.toLowerCase().replace(/[\s-]/g, '_');
  return guide.byArchetype[key] || null;
}

export function buildDestinationGuidancePrompt(
  destination: string,
  archetype: string
): string {
  const guide = getArchetypeDestinationGuide(destination, archetype);
  
  if (!guide) {
    return `
=== DESTINATION-SPECIFIC GUIDANCE ===

No specific guide available for ${destination} with this archetype.
Use the experience priorities and avoid lists from the archetype definition.
Research this destination's character and apply archetype principles.
`;
  }
  
  const destGuide = getDestinationGuide(destination);
  
  return `
=== ${destGuide?.destination.toUpperCase() || destination.toUpperCase()} — ARCHETYPE-SPECIFIC GUIDE ===

MUST DO for this traveler type:
${guide.mustDo.map(e => `★ ${e}`).join('\n')}

PERFECT FOR this archetype:
${guide.perfectFor.map(e => `• ${e}`).join('\n')}

HIDDEN GEMS they'll love:
${guide.hiddenGems.map(e => `◆ ${e}`).join('\n')}

SKIP (wrong for this type):
${guide.avoid.map(e => `✗ ${e}`).join('\n')}

BEST NEIGHBORHOODS for them:
${guide.neighborhoods.join(', ')}

DINING APPROACH:
${guide.diningStyle}

Use these specific recommendations when building the itinerary.
Activities not in these lists should still match the general archetype preferences.
`;
}

// =============================================================================
// CHECK IF DESTINATION HAS GUIDE
// =============================================================================

export function hasDestinationGuide(destination: string): boolean {
  return getDestinationGuide(destination) !== null;
}

export function getAvailableDestinations(): string[] {
  return [...new Set(Object.values(DESTINATION_GUIDES).map(g => g.destination))];
}
