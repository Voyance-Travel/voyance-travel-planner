/**
 * fix-placeholders.ts — Extracted placeholder detection and replacement logic.
 * Shared by universal-quality-pass.ts and action-generate-day.ts.
 */

import { type DiningConfig } from './dining-config.ts';

// =============================================================================
// FALLBACK RESTAURANT DATABASE — Rich city-aware venue pool for placeholder replacement
// =============================================================================

export interface FallbackRestaurant {
  name: string;
  address: string;
  price: number;
  description: string;
}

export const INLINE_FALLBACK_RESTAURANTS: Record<string, Record<string, FallbackRestaurant[]>> = {
  paris: {
    breakfast: [
      { name: "Café de Flore", address: "172 Bd Saint-Germain, 75006 Paris", price: 35, description: "Iconic Left Bank café. Famous for its Art Deco interior and literary history. Order the croissants with house jam and a grand crème." },
      { name: "Carette", address: "4 Pl. du Trocadéro et du 11 Novembre, 75016 Paris", price: 30, description: "Elegant patisserie with Eiffel Tower views from the terrace. Known for their macarons and hot chocolate." },
      { name: "Le Nemours", address: "2 Pl. Colette, 75001 Paris", price: 25, description: "Classic Parisian terrace café facing the Palais Royal gardens. Perfect for a leisurely morning coffee and croissant." },
      { name: "Maison Sauvage", address: "5 Rue de Buci, 75006 Paris", price: 25, description: "Flower-covered façade in Saint-Germain. Excellent avocado toast and fresh pastries in a photogenic setting." },
      { name: "Hôtel Costes", address: "239 Rue Saint-Honoré, 75001 Paris", price: 45, description: "Glamorous hotel restaurant with a lush courtyard. A see-and-be-seen breakfast spot near Place Vendôme." },
      { name: "Claus Paris", address: "14 Rue Jean-Jacques Rousseau, 75001 Paris", price: 28, description: "Self-proclaimed 'haute couture of breakfast.' Artisanal granola, organic eggs, and fresh-squeezed juices." },
      { name: "Ob-La-Di", address: "54 Rue de Saintonge, 75003 Paris", price: 20, description: "Third-wave coffee shop in Le Marais with excellent pastries and avocado toast." },
      { name: "Café Kitsuné", address: "51 Galerie de Montpensier, 75001 Paris", price: 22, description: "Japanese-French café in the Palais-Royal gardens. Matcha latte and flaky croissants." },
      { name: "Holybelly", address: "19 Rue Lucien Sampaix, 75010 Paris", price: 25, description: "Australian-style brunch in the Canal Saint-Martin area. Legendary pancakes." },
      { name: "La Fontaine de Belleville", address: "31-33 Rue Juliette Dodu, 75010 Paris", price: 18, description: "Specialty coffee roastery with homemade pastries. A local favorite near République." },
    ],
    lunch: [
      { name: "Le Comptoir du Relais", address: "9 Carrefour de l'Odéon, 75006 Paris", price: 55, description: "Yves Camdeborde's legendary bistro. The lunch menu is a masterclass in French comfort food. No reservations at lunch — arrive early." },
      { name: "Breizh Café", address: "109 Rue Vieille du Temple, 75003 Paris", price: 30, description: "The best crêpes in Paris. Buckwheat galettes with premium ingredients in the heart of Le Marais." },
      { name: "Bouillon Pigalle", address: "22 Bd de Clichy, 75018 Paris", price: 25, description: "Neo-bouillon revival with stunning Belle Époque interior. Traditional French dishes at surprisingly accessible prices." },
      { name: "Chez Janou", address: "2 Rue Roger Verlomme, 75003 Paris", price: 40, description: "Provençal bistro near Place des Vosges. Famous for their chocolate mousse served in a giant bowl." },
      { name: "Le Petit Cler", address: "29 Rue Cler, 75007 Paris", price: 35, description: "Charming neighborhood bistro on the market street Rue Cler. Simple, excellent French cuisine near the Eiffel Tower." },
      { name: "Pink Mamma", address: "20bis Rue de Douai, 75009 Paris", price: 30, description: "Four-story Italian trattoria. Neapolitan pizza and handmade pasta in a vibrant, plant-filled space." },
    ],
    dinner: [
      { name: "Le Relais de l'Entrecôte", address: "20 Rue Saint-Benoît, 75006 Paris", price: 50, description: "One menu only: walnut salad followed by steak-frites with their legendary secret sauce, served in two rounds. No reservations — expect a short queue." },
      { name: "Chez l'Ami Jean", address: "27 Rue Malar, 75007 Paris", price: 75, description: "Basque-influenced gastro-bistro. The rice pudding dessert is legendary. Boisterous, generous, unforgettable." },
      { name: "Le Chateaubriand", address: "129 Av. Parmentier, 75011 Paris", price: 80, description: "Neo-bistro pioneer. Creative tasting menu that changes daily. One of the restaurants that defined modern Parisian dining." },
      { name: "Frenchie", address: "5 Rue du Nil, 75002 Paris", price: 95, description: "Gregory Marchand's celebrated restaurant. Market-driven tasting menu with inventive French-global flavors. Book well in advance." },
      { name: "Le Bouillon Julien", address: "16 Rue du Faubourg Saint-Denis, 75010 Paris", price: 30, description: "Stunning Art Nouveau dining room from 1906. Classic French brasserie fare — onion soup, duck confit, profiteroles." },
      { name: "Septime", address: "80 Rue de Charonne, 75011 Paris", price: 110, description: "Modern French tasting menu from chef Bertrand Grébaut. Michelin-starred, ingredient-forward, one of the world's best restaurants." },
    ],
  },
  rome: {
    breakfast: [
      { name: "Sciascia Caffè", address: "Via Fabio Massimo 80/A, 00192 Rome", price: 12, description: "Roman institution since 1919. Their caffè with chocolate cream is legendary. Standing at the bar for the full Italian experience." },
      { name: "Roscioli Caffè Pasticceria", address: "Piazza Benedetto Cairoli 16, 00186 Rome", price: 15, description: "Gourmet pastry bar near Campo de' Fiori. Incredible cornetti and artisanal coffee." },
    ],
    lunch: [
      { name: "Roscioli Salumeria", address: "Via dei Giubbonari 21, 00186 Rome", price: 45, description: "Legendary deli-restaurant. Outstanding cacio e pepe and curated wine list in a gourmet food temple." },
      { name: "Supplizio", address: "Via dei Banchi Vecchi 143, 00186 Rome", price: 15, description: "Gourmet supplì (Roman rice croquettes). The cacio e pepe version is unforgettable. Perfect quick lunch." },
      { name: "Pizzarium", address: "Via della Meloria 43, 00136 Rome", price: 15, description: "Gabriele Bonci's world-famous pizza al taglio. Creative toppings on impossibly light, crispy dough." },
    ],
    dinner: [
      { name: "Da Enzo al 29", address: "Via dei Vascellari 29, 00153 Rome", price: 35, description: "Trastevere institution. Perfect cacio e pepe, carbonara, and seasonal artichokes. No reservations — queue early." },
      { name: "Armando al Pantheon", address: "Salita dei Crescenzi 31, 00186 Rome", price: 50, description: "Family-run trattoria steps from the Pantheon. Classic Roman cuisine perfected over decades." },
      { name: "Salumeria Roscioli", address: "Via dei Giubbonari 21/22, 00186 Rome", price: 55, description: "Wine-bar-meets-deli in the historic center. Exceptional pasta, rare cheeses, and a stunning wine cellar." },
    ],
  },
  berlin: {
    breakfast: [
      { name: "House of Small Wonder", address: "Johannisstraße 20, 10117 Berlin", price: 18, description: "Japanese-inspired brunch in Mitte. Beautiful multi-level space with matcha lattes and okonomiyaki pancakes." },
      { name: "Café Einstein Stammhaus", address: "Kurfürstenstraße 58, 10785 Berlin", price: 20, description: "Grand Viennese-style café in a historic villa. Excellent Frühstück (German breakfast) and legendary apple strudel." },
    ],
    lunch: [
      { name: "Curry 36", address: "Mehringdamm 36, 10961 Berlin", price: 8, description: "Iconic currywurst stand at Mehringdamm. The quintessential Berlin street food experience since 1980." },
      { name: "Markthalle Neun", address: "Eisenbahnstraße 42/43, 10997 Berlin", price: 18, description: "Kreuzberg's historic market hall. Street food stalls, craft beer, and artisan producers under a stunning iron roof." },
    ],
    dinner: [
      { name: "Nobelhart & Schmutzig", address: "Friedrichstraße 218, 10969 Berlin", price: 120, description: "Michelin-starred 'vocally local' dining. Counter-seating only, seasonal Berlin-Brandenburg ingredients." },
      { name: "Katz Orange", address: "Bergstraße 22, 10115 Berlin", price: 55, description: "Farm-to-table in a gorgeous courtyard. Their 12-hour slow-roasted pulled pork is legendary." },
    ],
  },
  barcelona: {
    breakfast: [
      { name: "Federal Café", address: "Passatge de la Pau 11, 08002 Barcelona", price: 16, description: "Australian-style café in El Gòtic. Excellent flat whites and smashed avo in a light-filled corner space." },
      { name: "Flax & Kale", address: "Carrer dels Tallers 74b, 08001 Barcelona", price: 20, description: "Health-conscious restaurant with flexitarian menu. Smoothie bowls, poached eggs, and plant-based options." },
    ],
    lunch: [
      { name: "La Boqueria Market Stalls", address: "La Rambla 91, 08001 Barcelona", price: 20, description: "Iconic market. Skip the tourist stands — head to Bar Pinotxo or El Quim for authentic market dining." },
      { name: "Can Paixano (La Xampanyeria)", address: "Carrer de la Reina Cristina 7, 08003 Barcelona", price: 15, description: "Standing-room cava bar in Barceloneta. Cava and tapas at unbeatable prices. Chaotic, fun, authentic." },
    ],
    dinner: [
      { name: "Cal Pep", address: "Plaça de les Olles 8, 08003 Barcelona", price: 55, description: "Counter-seating tapas bar near Born. Chef Pep's seafood is extraordinary — the fried fish and clams are legendary." },
      { name: "Cervecería Catalana", address: "Carrer de Mallorca 236, 08008 Barcelona", price: 40, description: "Locals' favorite tapas in Eixample. Outstanding patatas bravas, jamón ibérico, and seafood montaditos." },
    ],
  },
  london: {
    breakfast: [
      { name: "Dishoom", address: "12 Upper St Martin's Ln, WC2H 9FB London", price: 20, description: "Bombay café reimagined. Bacon naan roll and chai are breakfast perfection. Expect queues at weekends." },
      { name: "The Wolseley", address: "160 Piccadilly, W1J 9EB London", price: 35, description: "Grand café-restaurant in a former car showroom. Viennese-style breakfast with impeccable service." },
    ],
    lunch: [
      { name: "Borough Market", address: "8 Southwark St, SE1 1TL London", price: 20, description: "London's legendary food market. Artisan producers, street food, and specialist ingredients under Victorian railway arches." },
      { name: "Padella", address: "6 Southwark St, SE1 1TQ London", price: 18, description: "Hand-rolled pasta at Borough Market. The pici cacio e pepe is extraordinary. No reservations — worth the queue." },
    ],
    dinner: [
      { name: "Brat", address: "4 Redchurch St, E1 6JL London", price: 65, description: "Michelin-starred Basque-inspired grill in Shoreditch. Whole turbot and padron peppers cooked over fire." },
      { name: "Gymkhana", address: "42 Albemarle St, W1S 4JH London", price: 75, description: "Michelin-starred Indian restaurant in Mayfair. Colonial hunting-lodge décor with extraordinary modern Indian cuisine." },
    ],
  },
  lisbon: {
    breakfast: [
      { name: "Heim Café", address: "R. de Santos-o-Velho 2, 1200-808 Lisbon", price: 15, description: "Cozy brunch spot in Santos. Excellent avocado toast, açaí bowls, and specialty coffee." },
      { name: "Copenhagen Coffee Lab", address: "R. Nova da Piedade 10, 1200-298 Lisbon", price: 12, description: "Scandinavian-style specialty coffee roaster. Perfectly crafted pour-overs in a minimalist Chiado setting." },
      { name: "Nicolau Lisboa", address: "R. de São Nicolau 17, 1100-547 Lisbon", price: 14, description: "Modern café near Rossio square. Great eggs Benedict and fresh juices with a street-level people-watching terrace." },
    ],
    lunch: [
      { name: "Cervejaria Ramiro", address: "Av. Almirante Reis 1H, 1150-007 Lisbon", price: 45, description: "Legendary seafood beer hall. Tiger prawns, percebes, and a steak sandwich to finish. Cash-heavy, always packed." },
      { name: "A Cevicheria", address: "R. Dom Pedro V 129, 1250-093 Lisbon", price: 40, description: "Chef Kiko Martins' Peruvian-Portuguese fusion. Creative ceviches under a hanging giant octopus sculpture." },
      { name: "Café de São Bento", address: "R. de São Bento 212, 1200-821 Lisbon", price: 50, description: "Classic Lisbon steakhouse. Their prego steak sandwich and garlic prawns are local institutions." },
    ],
    dinner: [
      { name: "Sacramento do Chiado", address: "R. do Sacramento 26, 1200-394 Lisbon", price: 45, description: "Converted church in Chiado. Portuguese cuisine with a modern twist in a stunning architectural setting." },
      { name: "Solar dos Presuntos", address: "R. das Portas de Santo Antão 150, 1150-269 Lisbon", price: 55, description: "Minho-style cooking near Restauradores. Legendary presunto (cured ham) and seafood rice." },
      { name: "Pharmácia", address: "R. Marechal Saldanha 1, 1249-069 Lisbon", price: 40, description: "Pharmacy-themed restaurant in Santa Catarina. Creative Portuguese dishes served in lab glassware with Tagus views." },
    ],
  },
};

// =============================================================================
// HELPER: Get a random fallback restaurant from the hardcoded pool
// =============================================================================
export function getRandomFallbackRestaurant(
  city: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  usedNames: Set<string>
): FallbackRestaurant | null {
  const cityKey = city.toLowerCase().trim();
  let cityData: Record<string, FallbackRestaurant[]> | undefined;
  for (const [key, data] of Object.entries(INLINE_FALLBACK_RESTAURANTS)) {
    if (cityKey.includes(key) || key.includes(cityKey)) {
      cityData = data;
      break;
    }
  }
  if (!cityData) return null;

  const options = cityData[mealType];
  if (!options || options.length === 0) return null;

  const available = options.filter(r => !usedNames.has(r.name.toLowerCase()));
  if (available.length === 0) return options[0];

  return available[Math.floor(Math.random() * available.length)];
}

// =============================================================================
// HELPER: Apply fallback restaurant data to an activity
// =============================================================================
export function applyFallbackToActivity(
  activity: any,
  fallback: FallbackRestaurant,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'drinks',
  usedVenueNamesInDay: Set<string>,
  diningConfig?: DiningConfig,
): void {
  const mealLabel = mealType === 'breakfast' ? 'Breakfast' : mealType === 'lunch' ? 'Lunch' : mealType === 'drinks' ? 'Drinks' : 'Dinner';
  activity.title = `${mealLabel} at ${fallback.name}`;
  activity.name = activity.title;
  if (activity.location) {
    activity.location.name = fallback.name;
    activity.location.address = fallback.address;
  } else {
    activity.location = { name: fallback.name, address: fallback.address };
  }
  activity.venue_name = fallback.name;
  if (fallback.description) activity.description = fallback.description;

  // Price clamping: clamp to DNA config range when available
  let price = fallback.price;
  if (price && diningConfig) {
    const pr = diningConfig.priceRange[mealType] || diningConfig.priceRange.dinner;
    if (pr) {
      price = Math.max(pr[0], Math.min(pr[1], price));
    }
  }
  if (price && activity.cost) {
    activity.cost.amount = price;
  }
  if (price) {
    activity.cost_per_person = price;
  }

  usedVenueNamesInDay.add(fallback.name.toLowerCase());
  console.log(`[PLACEHOLDER] REPLACED → "${activity.title}" at "${fallback.address}" (€${price}/pp)`);
}

// =============================================================================
// PLACEHOLDER DETECTION PATTERNS
// =============================================================================
export const PLACEHOLDER_TITLE_PATTERNS = [
  /^(breakfast|lunch|dinner|meal|brunch)\s+(at\s+)?a\s+/i,
  /^(breakfast|lunch|dinner|meal|brunch)\s+(at\s+)?the\s+/i,
  /^(breakfast|lunch|dinner)\s+at\s+(a\s+)?(local|nearby|neighborhood|traditional|typical|popular|cozy|charming)/i,
  /at a (bistro|brasserie|café|cafe|boulangerie|trattoria|osteria|taverna|izakaya|tapas bar|pub|diner|restaurant|eatery|food stall|canteen|pizzeria|ramen shop|noodle shop|sushi bar|beer hall|wine bar|gastro)/i,
  /get a restaurant recommendation/i,
];

export const PLACEHOLDER_VENUE_PATTERNS = [
  /^the destination$/i,
  /^the city$/i,
  /^(city|town) center$/i,
  /^downtown$/i,
  /^near(by)?\s+(the\s+)?hotel$/i,
  /^your hotel$/i,
  /get a restaurant recommendation/i,
  /^.{0,3}$/,
];

/**
 * Universal placeholder meal detection.
 * Returns true if the activity looks like a generic/placeholder dining entry.
 */
export function isPlaceholderMeal(activity: any, cityName: string): boolean {
  const category = (activity.category || '').toUpperCase();
  if (category !== 'DINING' && category !== 'RESTAURANT') return false;

  const title = (activity.title || '').trim();
  const venue = (activity.location?.name || activity.venue_name || '').trim();
  const description = (activity.description || '').trim();

  if (PLACEHOLDER_TITLE_PATTERNS.some(p => p.test(title))) return true;
  if (cityName.length > 2 && venue.toLowerCase() === cityName.toLowerCase()) return true;
  if (PLACEHOLDER_VENUE_PATTERNS.some(p => p.test(venue))) return true;
  if (/get a restaurant recommendation/i.test(description)) return true;
  if (/get a restaurant recommendation/i.test(venue)) return true;

  return false;
}

interface PlaceholderSlot {
  activityRef: any;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'drinks';
}

// =============================================================================
// AI-POWERED RESTAURANT FALLBACK
// =============================================================================
const RESTAURANT_SUGGESTION_TOOL = {
  type: "function" as const,
  function: {
    name: "suggest_restaurant",
    description: "Suggest a single real restaurant",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Real restaurant name" },
        address: { type: "string", description: "Full street address" },
        price: { type: "number", description: "Average cost per person in USD" },
        description: { type: "string", description: "1-2 sentence description with signature dish" },
      },
      required: ["name", "address", "price", "description"],
    },
  },
};

export async function generateFallbackRestaurant(
  city: string,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'drinks',
  budgetTier: string,
  apiKey: string,
  usedNames: Set<string>,
  country?: string,
  tripType?: string,
  dayTheme?: string,
  neighborhood?: string,
  diningConfig?: DiningConfig,
): Promise<FallbackRestaurant | null> {
  const blocklist = Array.from(usedNames).slice(0, 20).join(', ');

  // If we have a DNA-aware dining config, use its price ranges and style
  let priceRange: string;
  let styleDesc: string;

  if (diningConfig) {
    const pr = diningConfig.priceRange[mealType] || diningConfig.priceRange.dinner;
    priceRange = `€${pr[0]}-${pr[1]} per person`;
    styleDesc = diningConfig.diningStyle;
  } else {
    // Legacy fallback
    const priceGuidance: Record<string, Record<string, string>> = {
      Luminary: {
        breakfast: '€25-60 per person',
        lunch: '€40-80 per person',
        dinner: '€60-200 per person (Michelin-starred options welcome)',
        drinks: '€20-50 per person',
      },
      Explorer: {
        breakfast: '€10-30 per person',
        lunch: '€20-50 per person',
        dinner: '€30-80 per person',
        drinks: '€15-35 per person',
      },
      Budget: {
        breakfast: '€5-15 per person',
        lunch: '€8-25 per person',
        dinner: '€15-40 per person',
        drinks: '€8-20 per person',
      },
    };

    const styleDescriptions: Record<string, string> = {
      Luminary: 'luxury, refined, memorable dining experiences',
      Explorer: 'authentic, local favorites, quality over price',
      Budget: 'affordable, good value, local gems',
    };

    const effectiveTripType = tripType || 'Explorer';
    const prices = priceGuidance[effectiveTripType] || priceGuidance.Explorer;
    priceRange = prices[mealType] || prices.lunch;
    styleDesc = styleDescriptions[effectiveTripType] || styleDescriptions.Explorer;
  }

  const locationStr = country ? `${city}, ${country}` : city;

  const avoidStr = diningConfig?.avoidPatterns?.length ? `\n- AVOID these dining types: ${diningConfig.avoidPatterns.join(', ')}` : '';
  const michelinHint = diningConfig?.michelinPolicy === 'required' && mealType === 'dinner'
    ? '\n- Consider Michelin-starred restaurants if appropriate'
    : diningConfig?.michelinPolicy === 'discouraged' && mealType === 'dinner'
      ? '\n- Do NOT suggest Michelin-starred restaurants'
      : '';

  const promptParts = [
    `You are a restaurant expert for ${locationStr}. Suggest ONE real, currently operating ${mealType} restaurant.`,
    `- Dining style: ${styleDesc}`,
    `- Price range: ${priceRange}`,
    neighborhood ? `- Preferably in or near: ${neighborhood}` : null,
    dayTheme ? `- Day theme: ${dayTheme}` : null,
    michelinHint || null,
    mealType === 'drinks' ? '- Suggest a bar, wine bar, cocktail lounge, or similar venue' : null,
    `- Must be a REAL place with a REAL street address`,
    `- Pick a well-reviewed local favorite, not a tourist trap`,
    avoidStr || null,
    `- DO NOT suggest: ${blocklist || 'none'}`,
  ].filter(Boolean);

  const prompt = promptParts.join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "user", content: prompt },
        ],
        tools: [RESTAURANT_SUGGESTION_TOOL],
        tool_choice: { type: "function", function: { name: "suggest_restaurant" } },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[ai-restaurant] HTTP ${response.status} for ${mealType} in ${city}`);
      return null;
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.warn(`[ai-restaurant] No tool call in response for ${mealType} in ${city}`);
      return null;
    }

    const args = typeof toolCall.function.arguments === 'string'
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    if (!args.name || !args.address) {
      console.warn(`[ai-restaurant] Missing name/address for ${mealType} in ${city}`);
      return null;
    }

    console.log(`[ai-restaurant] ✓ Generated: "${args.name}" for ${mealType} in ${city}`);
    return {
      name: args.name,
      address: args.address,
      price: args.price || 30,
      description: args.description || '',
    };
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      console.warn(`[ai-restaurant] Timeout for ${mealType} in ${city}`);
    } else {
      console.warn(`[ai-restaurant] Error for ${mealType} in ${city}:`, err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================================================
// HELPER: Determine meal type from start time
// =============================================================================
function parseMealType(startTime: string): 'breakfast' | 'lunch' | 'dinner' | 'drinks' {
  const hourMatch = startTime.match(/^(\d{1,2})/);
  const hour24 = hourMatch ? parseInt(hourMatch[1], 10) : 12;
  if (hour24 < 11) return 'breakfast';
  if (hour24 < 16) return 'lunch';
  if (hour24 < 21) return 'dinner';
  return 'drinks';
}

// =============================================================================
// EXPORTED: Fill a single placeholder slot (detection + replace + patch)
// =============================================================================
export async function fillPlaceholderSlot(
  activity: any,
  city: string,
  country: string,
  tripType: string,
  budgetTier: string,
  apiKey: string,
  usedVenueNames: Set<string>,
  dayTheme?: string,
  diningConfig?: DiningConfig,
): Promise<boolean> {
  const startTimeStr = activity.startTime || activity.start_time || '12:00';
  const mealType = parseMealType(startTimeStr);

  // Fast path: hardcoded fallback (free, instant)
  const fallback = getRandomFallbackRestaurant(city, mealType, usedVenueNames);
  if (fallback) {
    applyFallbackToActivity(activity, fallback, mealType, usedVenueNames, diningConfig);
    return true;
  }

  // Slow path: AI-powered fallback
  if (!apiKey) return false;

  try {
    const aiRestaurant = await generateFallbackRestaurant(
      city,
      mealType,
      budgetTier,
      apiKey,
      usedVenueNames,
      country || undefined,
      tripType || undefined,
      dayTheme,
      undefined,
      diningConfig,
    );
    if (aiRestaurant) {
      applyFallbackToActivity(activity, aiRestaurant, mealType, usedVenueNames, diningConfig);
      return true;
    }
  } catch (err) {
    console.warn(`[SLOT-FILLER] AI fallback failed for ${mealType} in ${city}:`, err);
  }

  return false;
}

// =============================================================================
// MAIN: Detect and fix all placeholder dining activities for a day
// =============================================================================
export async function fixPlaceholdersForDay(
  activities: any[],
  city: string,
  country: string,
  tripType: string,
  dayIndex: number,
  usedRestaurants: string[],
  budgetTier: string,
  apiKey: string,
  lockedActivities: any[],
  dayTitle?: string,
  diningConfig?: DiningConfig,
): Promise<void> {
  const destinationLower = (city || '').toLowerCase().trim();
  const destinationCity = destinationLower.split(',')[0].trim();

  const usedVenueNamesInDay = new Set<string>();
  // Seed with locked dining venue names
  for (const locked of lockedActivities) {
    const lCat = (locked.category || '').toLowerCase();
    if (lCat === 'dining' || lCat === 'restaurant') {
      const lName = (locked.location?.name || locked.title || '').toLowerCase();
      if (lName) usedVenueNamesInDay.add(lName);
    }
  }
  // Seed with usedRestaurants passed from orchestrator
  const usedList: string[] = Array.isArray(usedRestaurants) ? usedRestaurants : [];
  for (const u of usedList) {
    if (u) usedVenueNamesInDay.add(u.toLowerCase());
  }

  let placeholderCount = 0;

  for (const activity of activities) {
    if (!isPlaceholderMeal(activity, destinationCity)) continue;

    const title = (activity.title || '').trim();
    const venueName = (activity.location?.name || activity.venue_name || '').trim();
    console.error(`[QUALITY] Day ${dayIndex}: PLACEHOLDER DETECTED: "${title}" at "${venueName}" — replacing`);

    const success = await fillPlaceholderSlot(
      activity, city, country, tripType, budgetTier, apiKey,
      usedVenueNamesInDay, dayTitle, diningConfig,
    );

    if (success) {
      placeholderCount++;
      console.log(`[QUALITY] Replaced placeholder with: "${activity.title}"`);
    } else {
      console.error(`[QUALITY] Failed to fill placeholder at day ${dayIndex}: "${title}"`);
    }
  }

  if (placeholderCount === 0) {
    console.log(`[QUALITY] Day ${dayIndex}: No placeholders detected ✓`);
  } else {
    console.log(`[QUALITY] Day ${dayIndex}: Fixed ${placeholderCount} placeholder(s)`);
  }
}
