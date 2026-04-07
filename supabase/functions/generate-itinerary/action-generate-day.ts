/**
 * Action handler for generate-day / regenerate-day.
 * 
 * Extracted from index.ts for maintainability.
 * Contains all single-day generation logic with flight/hotel awareness.
 */

import { corsHeaders, verifyTripAccess } from './action-types.ts';
import type {
  ValidationContext,
} from './generation-types.ts';
import {
  validateItineraryPersonalization,
  buildValidationContext,
} from './generation-types.ts';
import {
  calculateDays,
  formatDate,
  timeToMinutes,
  calculateDuration,
  getCategoryIcon,
  normalizeVenueName,
  haversineDistanceKm,
  getDestinationId,
  getAirportTransferMinutes,
  getAirportTransferFare,
} from './generation-utils.ts';
import {
  sanitizeDateString,
  sanitizeOptionFields,
  sanitizeAITextField,
  sanitizeGeneratedDay,
  sanitizeDateFields,
  normalizeDurationString,
  stripPhantomHotelActivities,
  enforceMichelinPriceFloor,
  enforceBarNightcapPriceCap,
  enforceCasualVenuePriceCap,
  enforceVenueTypePriceCap,
} from './sanitization.ts';
import {
  EXCHANGE_RATES_TO_USD,
  convertToUSD,
  normalizeCostToUSD,
  deriveIntelligenceFields,
  isRecurringEvent,
} from './currency-utils.ts';
import {
  getBlockedTimeRange,
  parseMustDoInput,
  validateMustDosInItinerary,
  type ScheduledMustDo,
} from './must-do-priorities.ts';
import { GenerationTimer } from './generation-timer.ts';
import {
  parseTimeToMinutes,
  minutesToHHMM,
  addMinutesToHHMM,
  normalizeTo24h,
  getFlightHotelContext,
} from './flight-hotel-context.ts';
import {
  validateGeneratedDay,
  filterChainRestaurants,
  enforceRequiredMealsFinalGuard,
  detectMealSlots,
  type StrictDayMinimal,
} from './day-validation.ts';
import { compileDayFacts } from './pipeline/compile-day-facts.ts';
import type { LockedActivity } from './pipeline/types.ts';
import { validateDay, type ValidateDayInput } from './pipeline/validate-day.ts';
import { repairDay, type RepairDayInput } from './pipeline/repair-day.ts';
import { compilePrompt } from './pipeline/compile-prompt.ts';
import { persistDay } from './pipeline/persist-day.ts';
import { callAI, AICallError } from './pipeline/ai-call.ts';
import { enrichAndValidateHours } from './pipeline/enrich-day.ts';

// =============================================================================
// FALLBACK RESTAURANT DATABASE — Rich city-aware venue pool for placeholder replacement
// =============================================================================

interface FallbackRestaurant {
  name: string;
  address: string;
  price: number;
  description: string;
}

const INLINE_FALLBACK_RESTAURANTS: Record<string, Record<string, FallbackRestaurant[]>> = {
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
      { name: "Roscioli Caffè", address: "2 Piazza Benedetto Cairoli, 00186 Rome", price: 18, description: "Artisan pastries and specialty coffee from the famous Roscioli family. Try the cornetto with pistachio cream." },
      { name: "Sant'Eustachio Il Caffè", address: "82 Piazza di Sant'Eustachio, 00186 Rome", price: 12, description: "Legendary Roman coffee bar since 1938. Their gran caffè is pre-sweetened and impossibly creamy." },
      { name: "Antico Caffè Greco", address: "86 Via dei Condotti, 00187 Rome", price: 25, description: "Rome's oldest café, established 1760. Marble tables, gilded mirrors, and a pastry selection worthy of the setting." },
    ],
    lunch: [
      { name: "Da Enzo al 29", address: "29 Via dei Vascellari, 00153 Rome", price: 30, description: "Trastevere institution. The cacio e pepe and carbonara are textbook-perfect Roman cuisine." },
      { name: "Armando al Pantheon", address: "110 Salita dei Crescenzi, 00186 Rome", price: 45, description: "Family-run trattoria steps from the Pantheon. Classic Roman dishes executed with precision for over 60 years." },
      { name: "Roscioli", address: "21 Via dei Giubbonari, 00186 Rome", price: 50, description: "Part deli, part restaurant. World-class cheese and salumi selection. Their carbonara is competition-worthy." },
    ],
    dinner: [
      { name: "Ristorante Aroma", address: "1 Via Labicana, 00184 Rome", price: 130, description: "Michelin-starred rooftop dining with direct Colosseum views. Chef Di Iorio's modern Italian cuisine is theatrical and precise." },
      { name: "Pipero", address: "9 Corso Vittorio Emanuele II, 00186 Rome", price: 120, description: "Michelin-starred contemporary Roman restaurant. Cacio e pepe reimagined. Elegant but not stuffy." },
      { name: "Il Pagliaccio", address: "129 Via dei Banchi Vecchi, 00186 Rome", price: 200, description: "Two Michelin stars. Chef Kotaro Noda's Japanese-Italian fusion is among Rome's most refined dining experiences." },
    ],
  },
  berlin: {
    breakfast: [
      { name: "Café Einstein Stammhaus", address: "58 Kurfürstenstraße, 10785 Berlin", price: 25, description: "Grand Viennese-style café in a 1920s villa. Excellent Wiener Frühstück with fresh pastries and newspapers." },
      { name: "House of Small Wonder", address: "11 Johannisstraße, 10117 Berlin", price: 20, description: "Japanese-inspired brunch café. Fluffy Japanese pancakes and matcha lattes in a treehouse-like interior." },
      { name: "Café Anna Blume", address: "49 Kollwitzstraße, 10405 Berlin", price: 20, description: "Flower shop meets café in Prenzlauer Berg. Their signature 'Blumenstrauß' breakfast platter is a feast." },
    ],
    lunch: [
      { name: "Borchardt", address: "47 Französische Str., 10117 Berlin", price: 55, description: "Berlin's power-lunch institution. High ceilings, white tablecloths, and the city's most famous Wiener Schnitzel." },
      { name: "Katz Orange", address: "27 Bergstraße, 10115 Berlin", price: 45, description: "Slow food in a former brewery courtyard. Famous for their 12-hour roasted Duroc pork. Beautiful garden." },
      { name: "Lokal", address: "3 Linienstraße, 10178 Berlin", price: 35, description: "Farm-to-table German cuisine in Mitte. Daily changing menu based on what's fresh from Brandenburg farms." },
    ],
    dinner: [
      { name: "Horváth", address: "44 Paul-Lincke-Ufer, 10999 Berlin", price: 130, description: "Michelin-starred modern Austrian cuisine on the Landwehr Canal. Chef Sebastian Frank's vegetable-forward tasting menu is Berlin's finest." },
      { name: "Facil", address: "3 Potsdamer Str., 10785 Berlin", price: 180, description: "Two Michelin stars in the Mandala Hotel. A glass-roofed garden setting with impeccable contemporary European cuisine." },
      { name: "Rutz", address: "44 Chausseestraße, 10115 Berlin", price: 200, description: "Three Michelin stars — Berlin's highest-rated restaurant. Marco Müller's creative German tasting menu. Legendary wine list." },
    ],
  },
  london: {
    breakfast: [
      { name: "The Wolseley", address: "160 Piccadilly, W1J 9EB London", price: 30, description: "Grand European café-restaurant in a former car showroom. The quintessential London breakfast experience." },
      { name: "Dishoom", address: "12 Upper St Martin's Ln, WC2H 9FB London", price: 20, description: "Bombay-inspired café. Their bacon naan roll and chai are legendary. Expect a queue at weekends." },
      { name: "Granger & Co", address: "175 Westbourne Grove, W11 2SB London", price: 22, description: "Australian brunch pioneer. Famous ricotta hotcakes and scrambled eggs in a light-filled Notting Hill space." },
    ],
    lunch: [
      { name: "Padella", address: "6 Southwark St, SE1 1TQ London", price: 18, description: "Fresh handmade pasta near Borough Market. The pici cacio e pepe is unmissable. No reservations — queue early." },
      { name: "Barrafina", address: "26-27 Dean St, W1D 3LL London", price: 45, description: "Counter-seated Spanish tapas bar. Michelin-starred quality in a buzzy Soho setting." },
      { name: "Brasserie Zédel", address: "20 Sherwood St, W1F 7ED London", price: 25, description: "Grand Parisian brasserie hidden beneath Piccadilly. Remarkable value for central London." },
    ],
    dinner: [
      { name: "St. John", address: "26 St John St, EC1M 4AY London", price: 60, description: "Pioneering nose-to-tail restaurant. Fergus Henderson's roast bone marrow is a pilgrimage dish." },
      { name: "The Palomar", address: "34 Rupert St, W1D 6DN London", price: 55, description: "Modern Jerusalem cuisine in the heart of Soho. Sit at the bar for the full experience." },
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

function getRandomFallbackRestaurant(
  city: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  usedNames: Set<string>
): FallbackRestaurant | null {
  const cityKey = city.toLowerCase().trim();
  // Find matching city key (partial match for "Paris, France" etc.)
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
  if (available.length === 0) return options[0]; // Last resort: allow a repeat

  return available[Math.floor(Math.random() * available.length)];
}

// =============================================================================
// HELPER: Apply fallback restaurant data to an activity
// =============================================================================
function applyFallbackToActivity(
  activity: any,
  fallback: FallbackRestaurant,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'drinks',
  usedVenueNamesInDay: Set<string>,
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
  if (fallback.price && activity.cost) {
    activity.cost.amount = fallback.price;
  }
  usedVenueNamesInDay.add(fallback.name.toLowerCase());
  console.log(`[generate-day] PLACEHOLDER REPLACED → "${activity.title}" at "${fallback.address}"`);
}

// =============================================================================
// AI MICRO-CALL: Generate a real restaurant for any city
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

async function generateFallbackRestaurant(
  city: string,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'drinks',
  budgetTier: string,
  apiKey: string,
  usedNames: Set<string>,
  country?: string,
  tripType?: string,
  dayTheme?: string,
  neighborhood?: string,
): Promise<FallbackRestaurant | null> {
  const blocklist = Array.from(usedNames).slice(0, 20).join(', ');

  // Trip-type-aware price guidance
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
  const priceRange = prices[mealType] || prices.lunch;
  const styleDesc = styleDescriptions[effectiveTripType] || styleDescriptions.Explorer;
  const locationStr = country ? `${city}, ${country}` : city;

  const promptParts = [
    `You are a restaurant expert for ${locationStr}. Suggest ONE real, currently operating ${mealType} restaurant.`,
    `- Trip style: ${effectiveTripType} (${styleDesc})`,
    `- Price range: ${priceRange}`,
    neighborhood ? `- Preferably in or near: ${neighborhood}` : null,
    dayTheme ? `- Day theme: ${dayTheme}` : null,
    mealType === 'dinner' && effectiveTripType === 'Luminary' ? '- Consider Michelin-starred restaurants if appropriate' : null,
    mealType === 'drinks' ? '- Suggest a bar, wine bar, cocktail lounge, or similar venue' : null,
    `- Must be a REAL place with a REAL street address`,
    `- Pick a well-reviewed local favorite, not a tourist trap`,
    `- DO NOT suggest: ${blocklist || 'none'}`,
  ].filter(Boolean);

  const prompt = promptParts.join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s max

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

export async function handleGenerateDay(
  supabase: any,
  userId: string,
  params: Record<string, any>
): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Extract params BUT NOT userId from request body
  const { tripId, dayNumber, totalDays, destination, destinationCountry, date, travelers, tripType, budgetTier, preferences, previousDayActivities, keepActivities, currentActivities,
    isMultiCity: paramIsMultiCity, isTransitionDay: paramIsTransitionDay, transitionFrom: paramTransitionFrom, transitionTo: paramTransitionTo, transitionMode: paramTransitionMode,
    mustDoActivities: paramMustDoActivities, interestCategories: paramInterestCategories, generationRules: paramGenerationRules,
    pacing: paramPacing, isFirstTimeVisitor: paramIsFirstTimeVisitor,
    hotelOverride: paramHotelOverride, isFirstDayInCity: paramIsFirstDayInCity, isLastDayInCity: paramIsLastDayInCity,
    restaurantPool: paramRestaurantPool, usedRestaurants: paramUsedRestaurants, generationLogId: paramGenerationLogId,
    hotelName: paramHotelName, action: paramAction } = params;
  
  // userId comes from the function parameter (authenticated user ID)
  // Security guard: if request body includes userId that differs from auth token, log and reject
  if (params.userId && params.userId !== userId) {
    console.warn(`[generate-day] userId mismatch! auth=${userId}, params=${params.userId} - rejecting`);
    return new Response(
      JSON.stringify({ error: "User ID mismatch. Please re-authenticate." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  // Verify trip access: user must be owner or accepted collaborator with edit permission
  if (tripId) {
    const tripAccessResult = await verifyTripAccess(supabase, tripId, userId, true);
    if (!tripAccessResult.allowed) {
      console.warn(`[generate-day] Access denied: user=${userId}, trip=${tripId}, reason=${tripAccessResult.reason}`);
      return new Response(
        JSON.stringify({ error: tripAccessResult.reason || "Trip not found or access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log(`[generate-day] ✓ Using authenticated userId: ${userId} (trip owner: ${tripAccessResult.isOwner})`);
  } else {
    console.log(`[generate-day] ✓ Using authenticated userId: ${userId} (no tripId to verify)`);
  }

  // ── PERFORMANCE TIMER (inner phase tracking) ──
  let innerTimer: GenerationTimer | null = null;
  if (paramGenerationLogId) {
    try {
      innerTimer = new GenerationTimer(tripId || '', supabase);
      await innerTimer.resume(paramGenerationLogId, destination || '', totalDays || 1, travelers || 1);
      // Write initial progress so the UI knows this day is actively being worked on
      await innerTimer.updateProgress(`day_${dayNumber}_context_loading`, 5 + Math.round(((dayNumber - 1) / Math.max(1, totalDays || 1)) * 90));
    } catch (e) {
      console.warn('[generate-day] Timer resume failed (non-blocking):', e);
      innerTimer = null;
    }
  }

  // Debug: log incoming usedRestaurants for cross-day dedup tracing
  console.log(`[generate-day] Generating day ${dayNumber}/${totalDays}. usedRestaurants (${(paramUsedRestaurants || []).length}):`, JSON.stringify(paramUsedRestaurants || []));


  // ═══════════════════════════════════════════════════════════════════════
  // COMPILED FACTS: Transition context, locked activities, flight/hotel,
  // transport preferences — extracted to pipeline/compile-day-facts.ts
  // ═══════════════════════════════════════════════════════════════════════
  const facts = await compileDayFacts(supabase, userId, params);
  const {
    resolvedIsTransitionDay, resolvedTransitionFrom, resolvedTransitionTo,
    resolvedTransportMode, resolvedTransportDetails,
    resolvedNextLegTransport, resolvedNextLegCity, resolvedNextLegTransportDetails,
    resolvedHotelOverride, resolvedIsMultiCity, resolvedIsLastDayInCity,
    resolvedDestination, resolvedCountry,
    lockedActivities, lockedSlotsInstruction,
    isFirstDay, isLastDay,
    transportPreferencePrompt, resolvedTransportModes,
    arrivalAirportDisplay, airportTransferMinutes,
  } = facts;
  let flightContext = facts.flightContext;

  // ═══════════════════════════════════════════════════════════════════════
  // COMPILED PROMPT: Preferences, trip intents, must-dos, timing, profile,
  // archetype guidance, Voyance Picks, attribution, system + user prompt.
  // Extracted to pipeline/compile-prompt.ts (Phase 4)
  // ═══════════════════════════════════════════════════════════════════════
  const prompt = await compilePrompt(supabase, userId, LOVABLE_API_KEY, params, facts);
  const {
    systemPrompt, userPrompt,
    mustDoEventItems, dayMealPolicy,
    allUserIdsForAttribution,
    actualDailyBudgetPerPerson,
    profile, effectiveBudgetTier,
    isSmartFinish, smartFinishRequested,
    metadata, mustDoActivitiesRaw: mustDoActivities,
    preferenceContext, dayConstraints,
  } = prompt;
  flightContext = prompt.flightContext;

  // ── DIAGNOSTICS TRACKING ──
  const _diagTimers = { aiCallStart: 0, aiCallEnd: 0, enrichStart: 0, enrichEnd: 0 };

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // AI CALL: Extracted to pipeline/ai-call.ts (Phase 6)
    // ═══════════════════════════════════════════════════════════════════════
    if (innerTimer) innerTimer.startPhase(`ai_call_day_${dayNumber}`);
    _diagTimers.aiCallStart = Date.now();
    let aiResult;
    try {
      aiResult = await callAI({
        systemPrompt,
        userPrompt,
        apiKey: LOVABLE_API_KEY,
        dayNumber,
      });
    } catch (err) {
      if (err instanceof AICallError) {
        return new Response(
          JSON.stringify({ error: err.userMessage }),
          { status: err.statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }
    _diagTimers.aiCallEnd = Date.now();
    const { data } = aiResult;

    // Record AI phase timing, token usage, and model
    if (innerTimer) {
      innerTimer.endPhase(`ai_call_day_${dayNumber}`);
      try {
        innerTimer.addTokenUsage(
          aiResult.usage?.prompt_tokens || 0,
          aiResult.usage?.completion_tokens || 0,
          aiResult.model,
        );
      } catch (_e) { /* non-blocking */ }
      const aiDonePct = 5 + Math.round(((dayNumber - 0.3) / Math.max(1, totalDays || 1)) * 90);
      await innerTimer.updateProgress(`day_${dayNumber}_ai_complete`, aiDonePct);
      innerTimer.startPhase(`parse_response_day_${dayNumber}`);
    }

    const message = data.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0];

    let generatedDay;
    if (toolCall?.function?.arguments) {
      // Standard tool call response
      generatedDay = sanitizeGeneratedDay(sanitizeOptionFields(sanitizeDateFields(JSON.parse(toolCall.function.arguments))), dayNumber, resolvedDestination, paramUsedRestaurants);
    } else if (message?.content) {
      // Fallback: AI returned content instead of tool call
      console.log("[generate-day] AI returned content instead of tool_call, attempting to parse...");
      try {
        // Try to extract JSON from the content
        const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          generatedDay = sanitizeGeneratedDay(sanitizeOptionFields(sanitizeDateFields(JSON.parse(jsonMatch[0]))), dayNumber, resolvedDestination, paramUsedRestaurants);
        } else {
          console.error("[generate-day] No JSON found in content:", contentStr.substring(0, 500));
          throw new Error("Invalid AI response format - no JSON in content");
        }
      } catch (parseErr) {
        console.error("[generate-day] Failed to parse content as JSON:", parseErr);
        throw new Error("Invalid AI response format - content not parseable");
      }
    } else {
      console.error("[generate-day] Invalid AI response - no tool_calls or content:", JSON.stringify(data).substring(0, 1000));
      throw new Error("Invalid AI response format");
    }

    // End parse phase, start post-processing
    if (innerTimer) {
      innerTimer.endPhase(`parse_response_day_${dayNumber}`);
      innerTimer.startPhase(`post_processing_day_${dayNumber}`);
    }

    // Note: lockedActivities were already loaded BEFORE the AI call (see line ~4452-4565)
    // This ensures AI knows to skip those time slots, saving money and guaranteeing locks work

    // Phantom hotel stripping — only strip fabricated specific hotel names.
    // Generic placeholders ("Your Hotel", "Check-in at hotel") are preserved.
    // Broad hotel detection: selected hotel, accommodation notes, metadata, or existing accom activities
    const hasHotelForStripping = !!(flightContext as any).hotelName ||
      !!(flightContext as any).hotelAddress ||
      !!paramHotelName ||
      !!(params.hotelOverride?.name) ||
      generatedDay.activities?.some((a: any) => {
        const cat = (a.category || '').toLowerCase();
        return cat === 'accommodation';
      });
    if (!hasHotelForStripping) {
      const { stripPhantomHotelActivities } = await import('./sanitization.ts');
      generatedDay = stripPhantomHotelActivities(generatedDay, false);
    }

    // Normalize activities: ensure title exists, add IDs and enhancements
    let normalizedActivities = generatedDay.activities.map((act: { 
      id?: string; 
      title?: string; 
      name?: string; 
      startTime?: string; 
      endTime?: string; 
      category?: string;
      estimatedCost?: { amount: number; currency: string; basis?: string };
      cost?: { amount: number; currency: string; basis?: string };
      location?: string | { name?: string; address?: string };
    }, idx: number) => {
      // Normalize title: use title, fallback to name
      const normalizedTitle = act.title || act.name || `Activity ${idx + 1}`;
      
      // Normalize cost: convert from local currency to USD for consistent storage
      // AI may return costs in local currency (e.g., JPY 6000 for Japan)
      const rawCost = act.cost || act.estimatedCost || { amount: 0, currency: 'USD' };
      const normalizedCost = normalizeCostToUSD(rawCost);
      // Preserve cost basis (per_person, flat, per_room) from AI response
      const costBasis = (act.cost as any)?.basis || (act.estimatedCost as any)?.basis || 'per_person';
      
      // Normalize location: convert string to object if needed
      let normalizedLocation = act.location;
      if (typeof act.location === 'string') {
        normalizedLocation = { name: act.location, address: act.location };
      }
      
      // Normalize times: ensure 24h format (AI may return "1:20 PM" or ambiguous "1:20")
      const normalizedStartTime = act.startTime ? (normalizeTo24h(act.startTime) || act.startTime) : undefined;
      const normalizedEndTime = act.endTime ? (normalizeTo24h(act.endTime) || act.endTime) : undefined;

      const normalized = {
        ...act,
        id: act.id || `day${dayNumber}-act${idx + 1}-${Date.now()}`,
        title: normalizedTitle,
        name: normalizedTitle, // Keep both for compatibility
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        cost: normalizedCost,
        costBasis: costBasis, // per_person | flat | per_room
        location: normalizedLocation,
        durationMinutes: normalizedStartTime && normalizedEndTime ? calculateDuration(normalizedStartTime, normalizedEndTime) : 60,
        categoryIcon: getCategoryIcon(act.category || 'activity'),
        isLocked: false, // New activities are unlocked by default
      };
      // Derive intelligence fields if AI didn't set them
      deriveIntelligenceFields(normalized);
      return normalized;
    });

    // =========================================================================
    // UNIVERSAL PLACEHOLDER ELIMINATION — works for ANY city worldwide
    // =========================================================================
    await fixPlaceholdersForDay(
      normalizedActivities,
      destination,
      destinationCountry || '',
      tripType || 'Explorer',
      dayNumber,
      usedVenueNamesFromParams,
      budgetTier || 'moderate',
      LOVABLE_API_KEY,
      lockedActivities,
      dayItinerary?.theme,
    );

    // =========================================================================
    // ARRIVAL / DEPARTURE TIMING ENFORCEMENT — deterministic, unconditional
    // =========================================================================
    {
      const _arrivalTime24 = (flightContext as any)?.arrivalTime24 as string | undefined;
      const _departureTime24 = (flightContext as any)?.returnDepartureTime24 as string | undefined;

      if (isFirstDay && _arrivalTime24) {
        const arrivalMins = parseTimeToMinutes(_arrivalTime24) || 0;
        const earliestAllowed = arrivalMins + 120; // 2 hours after landing
        const before = normalizedActivities.length;
        normalizedActivities = normalizedActivities.filter((a: any) => {
          const cat = ((a.category || '') as string).toUpperCase();
          if (['TRANSPORT', 'TRAVEL', 'FLIGHT', 'TRANSIT'].includes(cat)) return true;
          if (cat === 'STAY' || cat === 'ACCOMMODATION') {
            if (/check.?in/i.test(a.title || '')) return true;
          }
          const actMins = parseTimeToMinutes(a.startTime || '') || 0;
          if (actMins > 0 && actMins < earliestAllowed) {
            console.warn(`ARRIVAL TIMING: Removed "${a.title}" at ${a.startTime} — before arrival buffer (${_arrivalTime24} + 2h = ${minutesToHHMM(earliestAllowed)})`);
            return false;
          }
          return true;
        });
        if (normalizedActivities.length < before) {
          console.log(`[generate-day] Arrival timing filter removed ${before - normalizedActivities.length} activities`);
        }
      }

      if (isLastDay && _departureTime24) {
        const departureMins = parseTimeToMinutes(_departureTime24) || 0;
        const latestAllowed = departureMins - 180; // 3 hours before departure (international buffer)
        if (latestAllowed > 0) {
          const before = normalizedActivities.length;
          normalizedActivities = normalizedActivities.filter((a: any) => {
            const cat = ((a.category || '') as string).toUpperCase();
            if (['TRANSPORT', 'TRAVEL', 'FLIGHT', 'TRANSIT'].includes(cat)) return true;
            if (cat === 'STAY' || cat === 'ACCOMMODATION') {
              if (/check.?out/i.test(a.title || '')) return true;
            }
            const actMins = parseTimeToMinutes(a.startTime || '') || 0;
            if (actMins > 0 && actMins > latestAllowed) {
              console.warn(`DEPARTURE TIMING: Removed "${a.title}" at ${a.startTime} — after departure buffer (${_departureTime24} - 3h = ${minutesToHHMM(latestAllowed)})`);
              return false;
            }
            return true;
          });
          if (normalizedActivities.length < before) {
            console.log(`[generate-day] Departure timing filter removed ${before - normalizedActivities.length} activities`);
          }
        }
      }
    }

    if (lockedActivities.length > 0) {
      // Remove any generated activities that conflict with locked activity times
      for (const locked of lockedActivities) {
        const lockedStart = parseTimeToMinutes(locked.startTime);
        const lockedEnd = parseTimeToMinutes(locked.endTime);
        
        if (lockedStart !== null && lockedEnd !== null) {
          normalizedActivities = normalizedActivities.filter((act: { startTime?: string; endTime?: string }) => {
            const actStart = parseTimeToMinutes(act.startTime || '00:00');
            const actEnd = parseTimeToMinutes(act.endTime || '23:59');
            if (actStart === null || actEnd === null) return true;
            const overlaps = !(actEnd <= lockedStart || actStart >= lockedEnd);
            return !overlaps;
          });
        }
      }

      // Semantic dedup: remove generated activities whose titles are similar to locked ones
      const beforeSemanticDedup = normalizedActivities.length;
      normalizedActivities = normalizedActivities.filter((genAct: any) => {
        const genTitle = (genAct.title || '').toLowerCase();
        for (const locked of lockedActivities) {
          const lockedTitle = (locked.title || '').toLowerCase();
          if (genTitle.includes(lockedTitle) || lockedTitle.includes(genTitle)) return false;
          const keywords = lockedTitle.replace(/\b(the|a|an|at|in|on|for|and|or|to|of)\b/g, '').split(/\s+/).filter((w: string) => w.length > 2);
          if (keywords.length > 0) {
            const matchCount = keywords.filter((kw: string) => genTitle.includes(kw)).length;
            if (matchCount >= Math.ceil(keywords.length * 0.5) && matchCount >= 1) return false;
          }
        }
        return true;
      });
      if (normalizedActivities.length < beforeSemanticDedup) {
        console.log(`[generate-day] Semantic dedup removed ${beforeSemanticDedup - normalizedActivities.length} activities that duplicated locked ones`);
      }
      
      // Insert locked activities back and sort by time
      normalizedActivities = [...normalizedActivities, ...lockedActivities];
      normalizedActivities.sort((a: { startTime?: string }, b: { startTime?: string }) => {
        const aTime = parseTimeToMinutes(a.startTime || '00:00') ?? 0;
        const bTime = parseTimeToMinutes(b.startTime || '00:00') ?? 0;
        return aTime - bTime;
      });
      
      console.log(`[generate-day] Merged ${lockedActivities.length} locked activities, final count: ${normalizedActivities.length}`);
    }

    // =========================================================================
    // TIME OVERLAP FIXER — shift overlapping activities forward
    // =========================================================================
    {
      normalizedActivities.sort((a: any, b: any) => {
        const aM = parseTimeToMinutes(a.startTime || '00:00') ?? 0;
        const bM = parseTimeToMinutes(b.startTime || '00:00') ?? 0;
        return aM - bM;
      });
      for (let i = 1; i < normalizedActivities.length; i++) {
        const prev = normalizedActivities[i - 1] as any;
        const curr = normalizedActivities[i] as any;
        const prevEnd = parseTimeToMinutes(prev.endTime || '') ?? 0;
        const currStart = parseTimeToMinutes(curr.startTime || '') ?? 0;
        if (prevEnd > 0 && currStart > 0 && currStart < prevEnd) {
          const newStart = prevEnd + 15;
          const duration = (parseTimeToMinutes(curr.endTime || '') ?? (currStart + 60)) - currStart;
          console.warn(`TIME OVERLAP: "${prev.title}" ends ${prev.endTime} but "${curr.title}" starts ${curr.startTime}. Shifting to ${minutesToHHMM(newStart)}`);
          curr.startTime = minutesToHHMM(newStart);
          curr.endTime = minutesToHHMM(newStart + Math.max(duration, 30));
        }
      }
    }

    // =======================================================================
    // ENRICHMENT + OPENING HOURS: Extracted to pipeline/enrich-day.ts (Phase 6)
    // =======================================================================
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    // Resolve hotel coordinates for proximity guard (rejects mainland venues in water-bound cities)
    let hotelCoordinates: { lat: number; lng: number } | undefined;
    if (GOOGLE_MAPS_API_KEY) {
      const hotelName = resolvedHotelOverride?.name || paramHotelName || (flightContext as any)?.hotelName;
      const hotelAddress = resolvedHotelOverride?.address || (flightContext as any)?.hotelAddress;
      const hotelQuery = hotelAddress ? `${hotelName} ${hotelAddress}` : (hotelName ? `${hotelName} ${destination}` : null);
      if (hotelQuery) {
        try {
          const { getDestinationCenter } = await import('./venue-enrichment.ts');
          const coords = await getDestinationCenter(hotelQuery, GOOGLE_MAPS_API_KEY);
          if (coords) {
            hotelCoordinates = coords;
            console.log(`[generate-day] Hotel coordinates resolved: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
          }
        } catch (e) {
          console.warn(`[generate-day] Hotel geocoding failed (non-blocking):`, e);
        }
      }
    }

    _diagTimers.enrichStart = Date.now();
    normalizedActivities = await enrichAndValidateHours({
      activities: normalizedActivities,
      destination,
      date,
      supabaseUrl,
      supabaseKey,
      googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
      lovableApiKey: LOVABLE_API_KEY,
      hotelCoordinates,
    });
    _diagTimers.enrichEnd = Date.now();

    // =======================================================================
    // AUTO ROUTE OPTIMIZATION: Reorder flexible activities by proximity
    // No API calls, no credit charge — uses coordinates from enrichment
    // =======================================================================
    try {
      const { autoOptimizeDayRoute } = await import('./auto-route-optimizer.ts');
      normalizedActivities = autoOptimizeDayRoute(normalizedActivities);
    } catch (routeErr) {
      console.warn(`[generate-day] Auto route optimization failed (non-blocking):`, routeErr);
    }

    generatedDay.activities = normalizedActivities;

    // =======================================================================
    // MUST-DO EVENT OVERLAP STRIPPING
    // If this day has all-day or half-day events, remove any non-structural
    // activities that overlap the blocked time window
    // =======================================================================
    if (mustDoEventItems.length > 0) {
      const beforeCount = normalizedActivities.length;
      for (const eventItem of mustDoEventItems) {
        const { blockedStart, blockedEnd } = getBlockedTimeRange(eventItem);
        const blockedStartMins = parseTimeToMinutes(blockedStart);
        const blockedEndMins = parseTimeToMinutes(blockedEnd);
        if (blockedStartMins === null || blockedEndMins === null) continue;

        const eventTitleLower = eventItem.priority.title.toLowerCase();
        normalizedActivities = normalizedActivities.filter((act: any) => {
          // Always keep the event itself (fuzzy title match)
          const actTitle = (act.title || '').toLowerCase();
          if (actTitle.includes(eventTitleLower) || eventTitleLower.includes(actTitle)) return true;
          // Always keep structural categories: transit, transport, hotel, meals
          const cat = (act.category || '').toLowerCase();
          if (['transport', 'transportation', 'transit', 'hotel', 'accommodation'].includes(cat)) return true;
          // Keep meals (breakfast before event, dinner after)
          if (cat === 'food' || cat === 'dining' || cat === 'restaurant' || cat === 'meal') {
            // Keep if meal ends before blocked start or starts after blocked end
            const mealStart = parseTimeToMinutes(act.startTime);
            const mealEnd = parseTimeToMinutes(act.endTime);
            if (mealStart !== null && mealEnd !== null) {
              if (mealEnd <= blockedStartMins || mealStart >= blockedEndMins) return true;
            }
            // Meal overlaps the event window — drop it
            return false;
          }
          // For all other activities, check time overlap
          const actStart = parseTimeToMinutes(act.startTime);
          const actEnd = parseTimeToMinutes(act.endTime);
          if (actStart === null || actEnd === null) return true; // can't determine, keep
          // Remove if overlaps: activity starts before event ends AND ends after event starts
          if (actStart < blockedEndMins && actEnd > blockedStartMins) {
            console.log(`[generate-day] 🗑️ Removing "${act.title}" (${act.startTime}-${act.endTime}) — overlaps blocked time ${blockedStart}-${blockedEnd} for "${eventItem.priority.title}"`);
            return false;
          }
          return true;
        });
      }
      const removed = beforeCount - normalizedActivities.length;
      if (removed > 0) {
        console.log(`[generate-day] ✓ Stripped ${removed} activities overlapping must-do event time blocks`);
        generatedDay.activities = normalizedActivities;
      }
    }

    // =======================================================================
    // DETERMINISTIC EVENT BACKFILL
    // If any must-do event is STILL missing from the day (model skipped it),
    // inject a synthetic activity entry so the card always appears.
    // =======================================================================
    if (mustDoEventItems.length > 0) {
      for (const eventItem of mustDoEventItems) {
        const { blockedStart, blockedEnd } = getBlockedTimeRange(eventItem);
        const eventTitleLower = eventItem.priority.title.toLowerCase();

        // Check if a NON-TRANSPORT activity matching this event already exists
        // Transit activities like "Subway to US Open" contain the event name but are NOT the event
        const transportCategories = ['transport', 'transportation', 'transit', 'transfer'];
        const transportTitlePatterns = /\b(transfer|transit|taxi|uber|subway|metro|bus|drive|ride|lyft|car service|shuttle|walk(?:ing)?)\s+(to|from|back)\b/i;
        // Extract core keywords from the must-do title for semantic matching
        // e.g., "Comedy Show" → ["comedy", "show"]
        const coreKeywords = eventTitleLower
          .replace(/\b(the|a|an|at|in|on|for|and|or|to|of|my|our)\b/g, '')
          .split(/\s+/)
          .filter(w => w.length > 2);

        const eventExists = generatedDay.activities.some((act: any) => {
          const actTitle = (act.title || '').toLowerCase();
          const actCategory = (act.category || '').toLowerCase();

          // Transport/transit activities do NOT count as the event itself
          if (transportCategories.includes(actCategory)) return false;
          if (transportTitlePatterns.test(act.title || '')) return false;
          // Empty or very short titles are false positives
          if (actTitle.length < 3) return false;

          // Exact/substring match (original logic)
          const titleMatchesEvent = actTitle.includes(eventTitleLower) || eventTitleLower.includes(actTitle);
          if (titleMatchesEvent) return true;

          // Semantic keyword match — if the AI generated a different title
          // for the same activity (e.g., "Friday Night Stand-Up Comedy" vs "Comedy Show"),
          // check if a majority of the must-do's core keywords appear in the AI title
          if (coreKeywords.length > 0) {
            const matchCount = coreKeywords.filter(kw => actTitle.includes(kw)).length;
            const matchRatio = matchCount / coreKeywords.length;
            if (matchRatio >= 0.5 && matchCount >= 1) {
              console.log(`[generate-day] Semantic match: must-do "${eventTitleLower}" ↔ AI activity "${actTitle}" (${matchCount}/${coreKeywords.length} keywords)`);
              return true;
            }
          }

          return false;
        });

        // Also check if this must-do is already locked on the day — no need to backfill
        const eventIsLocked = lockedActivities.some((locked: any) => {
          const lockedTitle = (locked.title || '').toLowerCase();
          if (lockedTitle.includes(eventTitleLower) || eventTitleLower.includes(lockedTitle)) return true;
          if (coreKeywords.length > 0) {
            const matchCount = coreKeywords.filter((kw: string) => lockedTitle.includes(kw)).length;
            if (matchCount >= Math.ceil(coreKeywords.length * 0.5) && matchCount >= 1) return true;
          }
          return false;
        });
        if (eventIsLocked) {
          console.log(`[generate-day] Skipping must-do backfill "${eventItem.priority.title}" — already locked on this day`);
          continue;
        }

        if (!eventExists) {
          console.log(`[generate-day] ⚠️ BACKFILL: Must-do event "${eventItem.priority.title}" missing from Day ${dayNumber} — injecting deterministic activity card`);

          // Find the right insertion point (chronological order)
          let insertIndex = generatedDay.activities.length;
          const blockedStartMins = parseTimeToMinutes(blockedStart);
          for (let i = 0; i < generatedDay.activities.length; i++) {
            const act = generatedDay.activities[i];
            const actStart = parseTimeToMinutes(act.startTime);
            if (actStart !== null && blockedStartMins !== null && actStart >= blockedStartMins) {
              insertIndex = i;
              break;
            }
          }

          const syntheticEvent = {
            id: crypto.randomUUID(),
            title: eventItem.priority.title,
            startTime: blockedStart,
            endTime: blockedEnd,
            category: 'activity',
            description: `${eventItem.priority.title} — user's scheduled event for this day.${eventItem.priority.requiresBooking ? ' Tickets/advance booking required.' : ''}`,
            location: eventItem.priority.venueName
              ? { name: eventItem.priority.venueName }
              : { name: eventItem.priority.title },
            estimatedCost: { amount: 0, currency: 'USD' },
            tips: `This is your dedicated ${eventItem.priority.title} day. Arrive early to get settled and enjoy the full experience.`,
            crowdLevel: 'high',
            isHiddenGem: false,
            hasTimingHack: false,
            voyanceInsight: `Multi-day event attendance — enjoy today's experience!`,
            personalization: {
              whyThisFits: `You specifically requested ${eventItem.priority.title} for this day.`,
            },
            bookingRequired: eventItem.priority.requiresBooking || false,
          };

          generatedDay.activities.splice(insertIndex, 0, syntheticEvent);
          console.log(`[generate-day] ✅ BACKFILL: Injected "${eventItem.priority.title}" at position ${insertIndex} (${blockedStart}–${blockedEnd})`);
        }
      }
    }

    // Sync normalizedActivities with any backfilled events
    normalizedActivities = generatedDay.activities;

    // If AI omitted the travel activity, inject deterministic fallback
    // =======================================================================
    if (resolvedIsTransitionDay && resolvedTransitionFrom && resolvedTransitionTo) {
      const hasInterCityTravel = normalizedActivities.some((act: { title?: string; category?: string; description?: string }) => {
        const t = (act.title || '').toLowerCase();
        const d = (act.description || '').toLowerCase();
        const fromLower = resolvedTransitionFrom.toLowerCase();
        const toLower = resolvedTransitionTo.toLowerCase();
        const isTransport = act.category === 'transport' || act.category === 'transportation';
        const mentionsBothCities = (t.includes(fromLower) || d.includes(fromLower)) && (t.includes(toLower) || d.includes(toLower));
        const mentionsMode = t.includes(resolvedTransportMode) || d.includes(resolvedTransportMode) || t.includes('travel') || t.includes('transfer');
        return isTransport && (mentionsBothCities || mentionsMode);
      });

      if (!hasInterCityTravel) {
        console.warn(`[generate-day] ⚠️ TELEPORTING DETECTED! No inter-city travel found for ${resolvedTransitionFrom} → ${resolvedTransitionTo}. Injecting fallback transport blocks.`);
        
        const modeLabel = resolvedTransportMode.charAt(0).toUpperCase() + resolvedTransportMode.slice(1);
        const td = resolvedTransportDetails || {};
        
        // Use real times from transport_details if available, else defaults
        const hasTimes = !!(td.departureTime || td.arrivalTime);
        const depTime = td.departureTime || '10:30';
        const arrTime = td.arrivalTime || '13:30';
        const depStation = td.departureStation || td.departureAirport || `${modeLabel} Station`;
        const arrStation = td.arrivalStation || td.arrivalAirport || `${modeLabel} Station`;
        const carrier = td.carrier || '';
        const duration = td.duration || '';
        const costPP = td.costPerPerson || 50;

        // Calculate derived times from real schedule
        const depMins = parseTimeToMinutes(depTime);
        const arrMins = parseTimeToMinutes(arrTime);
        // Transfer to station: 45 min before departure
        const transferDepStart = depMins ? minutesToHHMM(depMins - 45) : '09:30';
        const transferDepEnd = depMins ? minutesToHHMM(depMins) : '10:15';
        // Checkout: 30 min before transfer
        const checkoutStart = depMins ? minutesToHHMM(depMins - 75) : '09:00';
        const checkoutEnd = depMins ? minutesToHHMM(depMins - 45) : '09:30';
        // Transfer from station: starts at arrival
        const transferArrStart = arrMins ? minutesToHHMM(arrMins) : '13:30';
        const transferArrEnd = arrMins ? minutesToHHMM(arrMins + 45) : '14:15';
        // Check-in: after transfer
        const checkinStart = arrMins ? minutesToHHMM(arrMins + 45) : '14:15';
        const checkinEnd = arrMins ? minutesToHHMM(arrMins + 90) : '15:00';

        const interCityDesc = hasTimes
          ? `${carrier ? carrier + ' — ' : ''}${resolvedTransportMode} from ${resolvedTransitionFrom} to ${resolvedTransitionTo}. Departs ${depTime}, arrives ${arrTime}${duration ? ` (${duration})` : ''}.`
          : `Inter-city ${resolvedTransportMode} travel from ${resolvedTransitionFrom} to ${resolvedTransitionTo}. Duration varies by route and operator.`;

        const fallbackTransport = [
          {
            id: `day${dayNumber}-checkout-${Date.now()}`,
            title: `Hotel Checkout – ${resolvedTransitionFrom}`,
            name: `Hotel Checkout – ${resolvedTransitionFrom}`,
            category: 'accommodation',
            startTime: checkoutStart,
            endTime: checkoutEnd,
            description: `Check out of hotel in ${resolvedTransitionFrom} and prepare for travel day`,
            location: { name: `Hotel in ${resolvedTransitionFrom}`, address: resolvedTransitionFrom },
            cost: { amount: 0, currency: 'USD' },
            isLocked: false,
            durationMinutes: 30,
          },
          {
            id: `day${dayNumber}-transfer-depart-${Date.now()}`,
            title: `Transfer to ${depStation}`,
            name: `Transfer to ${depStation}`,
            category: 'transport',
            startTime: transferDepStart,
            endTime: transferDepEnd,
            description: `Travel to ${depStation} in ${resolvedTransitionFrom}`,
            location: { name: depStation, address: resolvedTransitionFrom },
            cost: { amount: 15, currency: 'USD', basis: 'flat' },
            isLocked: false,
            durationMinutes: 45,
          },
          {
            id: `day${dayNumber}-intercity-${Date.now()}`,
            title: `${modeLabel} – ${resolvedTransitionFrom} to ${resolvedTransitionTo}`,
            name: `${modeLabel} – ${resolvedTransitionFrom} to ${resolvedTransitionTo}`,
            category: 'transport',
            startTime: depTime,
            endTime: arrTime,
            description: interCityDesc,
            location: { name: `${resolvedTransitionFrom} → ${resolvedTransitionTo}`, address: '' },
            cost: { amount: costPP, currency: td.currency || 'USD', basis: 'per_person' },
            isLocked: false,
            durationMinutes: (arrMins && depMins) ? Math.max(30, arrMins - depMins) : 180,
          },
          {
            id: `day${dayNumber}-transfer-arrive-${Date.now()}`,
            title: `Transfer to Hotel – ${resolvedTransitionTo}`,
            name: `Transfer to Hotel – ${resolvedTransitionTo}`,
            category: 'transport',
            startTime: transferArrStart,
            endTime: transferArrEnd,
            description: `Travel from ${arrStation} to hotel in ${resolvedTransitionTo}`,
            location: { name: `Hotel in ${resolvedTransitionTo}`, address: resolvedTransitionTo },
            cost: { amount: 15, currency: 'USD', basis: 'flat' },
            isLocked: false,
            durationMinutes: 45,
          },
          {
            id: `day${dayNumber}-checkin-${Date.now()}`,
            title: `Hotel Check-in – ${resolvedTransitionTo}`,
            name: `Hotel Check-in – ${resolvedTransitionTo}`,
            category: 'accommodation',
            startTime: checkinStart,
            endTime: checkinEnd,
            description: `Check in to hotel in ${resolvedTransitionTo}, freshen up and rest after travel`,
            location: { name: `Hotel in ${resolvedTransitionTo}`, address: resolvedTransitionTo },
            cost: { amount: 0, currency: 'USD' },
            isLocked: false,
            durationMinutes: 45,
          },
        ];

        // Prepend travel blocks, keep evening activities from AI
        const eveningActivities = normalizedActivities.filter((act: { startTime?: string }) => {
          const mins = parseTimeToMinutes(act.startTime || '00:00');
          return mins !== null && mins >= 15 * 60; // 3pm or later
        });
        
        generatedDay.activities = [...fallbackTransport, ...eveningActivities];
        normalizedActivities = generatedDay.activities;
        console.log(`[generate-day] Injected ${fallbackTransport.length} fallback travel blocks + ${eveningActivities.length} evening activities`);
      } else {
        console.log(`[generate-day] ✓ Transition day has inter-city travel activity`);
      }

      // Persist transition metadata on the generated day
      generatedDay.city = resolvedTransitionTo;
      generatedDay.country = resolvedCountry;
      generatedDay.isTransitionDay = true;
      generatedDay.transitionFrom = resolvedTransitionFrom;
      generatedDay.transitionTo = resolvedTransitionTo;
      generatedDay.transportType = resolvedTransportMode;
      generatedDay.title = generatedDay.title || `${resolvedTransitionFrom} → ${resolvedTransitionTo} (Travel Day)`;
    } else if (resolvedIsMultiCity) {
      // Even for non-transition days in multi-city, persist city metadata
      generatedDay.city = resolvedDestination;
      generatedDay.country = resolvedCountry;
      generatedDay.isTransitionDay = false;
    }

    generatedDay.title = generatedDay.title || generatedDay.theme || `Day ${dayNumber}`;

    // =======================================================================
    // PIPELINE PHASE 3: VALIDATE + REPAIR
    // Replaces inline trip-wide dedup, personalization, departure sequence,
    // and bookend validators with structured pipeline calls.
    // =======================================================================
    {
      // Sync generatedDay.activities with normalizedActivities before pipeline
      generatedDay.activities = normalizedActivities;

      try {
        // Build previousDays for trip-wide dedup
        let previousDaysForPipeline: StrictDayMinimal[] = [];
        if (tripId) {
          const { data: tripItinData } = await supabase
            .from('trips')
            .select('itinerary_data')
            .eq('id', tripId)
            .single();
          const existingDays = (tripItinData?.itinerary_data as any)?.days || [];
          previousDaysForPipeline = existingDays
            .filter((d: any) => d.dayNumber !== dayNumber)
            .map((d: any) => ({
              dayNumber: d.dayNumber || 0,
              date: d.date || '',
              title: d.title || d.theme || '',
              theme: d.theme,
              activities: (d.activities || []).map((a: any) => ({
                id: a.id || '',
                title: a.title || a.name || '',
                startTime: a.startTime || a.start_time || '',
                endTime: a.endTime || a.end_time || '',
                category: a.category || 'activity',
                location: a.location || { name: '', address: '' },
                cost: a.cost || a.estimatedCost || { amount: 0, currency: 'USD' },
                description: a.description || '',
                tags: a.tags || [],
                bookingRequired: a.bookingRequired || false,
                transportation: a.transportation || { method: '', duration: '', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
              })),
            }));
        }

        // Build the current day in StrictDayMinimal format for validation
        const currentDayMinimal: StrictDayMinimal = {
          dayNumber,
          date: date || '',
          title: generatedDay.title || '',
          theme: generatedDay.theme,
          activities: (generatedDay.activities || []).map((a: any) => ({
            id: a.id || '',
            title: a.title || a.name || '',
            startTime: a.startTime || '',
            endTime: a.endTime || '',
            category: a.category || 'activity',
            location: a.location || { name: '', address: '' },
            cost: a.cost || a.estimatedCost || { amount: 0, currency: 'USD' },
            description: a.description || '',
            tags: a.tags || [],
            bookingRequired: a.bookingRequired || false,
            transportation: a.transportation || { method: '', duration: '', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
          })),
        };

        // Gather avoid list and dietary restrictions from profile
        const pipelineAvoidList = profile?.avoidList || [];
        const pipelineDietaryRestrictions = profile?.dietaryRestrictions || [];
        const mustDoList = (paramMustDoActivities || '').split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);

        // --- Use unified hotel resolution from compile-day-facts (single source of truth) ---
        const resolvedRepairHotelName = resolvedHotelOverride?.name || (flightContext as any).hotelName || paramHotelName || undefined;
        const resolvedRepairHotelAddr = resolvedHotelOverride?.address || (flightContext as any).hotelAddress || '';
        const resolvedIsHotelChange = facts.resolvedIsHotelChange;
        const resolvedPreviousHotelName = facts.resolvedPreviousHotelName;

        // --- VALIDATE ---
        const validationInput: ValidateDayInput = {
          day: currentDayMinimal,
          dayNumber,
          isFirstDay,
          isLastDay,
          totalDays,
          destination: resolvedDestination || destination || undefined,
          hasHotel: !!((flightContext as any).hotelName || paramHotelName || params.hotelOverride?.name),
          hotelName: (flightContext as any).hotelName || paramHotelName || params.hotelOverride?.name || undefined,
          arrivalTime24: flightContext.arrivalTime24 || (isFirstDay ? '09:00' : undefined),
          returnDepartureTime24: flightContext.returnDepartureTime24
            || (flightContext.returnDepartureTime ? normalizeTo24h(flightContext.returnDepartureTime) : undefined)
            || undefined,
          requiredMeals: dayMealPolicy?.requiredMeals || [],
          previousDays: previousDaysForPipeline,
          avoidList: pipelineAvoidList,
          dietaryRestrictions: pipelineDietaryRestrictions,
          mustDoActivities: mustDoList,
          isHotelChange: resolvedIsHotelChange,
          previousHotelName: resolvedPreviousHotelName,
        };

        const validationResults = validateDay(validationInput);

        const errorCount = validationResults.filter(r => r.severity === 'error' || r.severity === 'critical').length;
        const warningCount = validationResults.filter(r => r.severity === 'warning').length;
        if (validationResults.length > 0) {
          console.log(`[pipeline] Day ${dayNumber} validation: ${validationResults.length} issues (${errorCount} errors, ${warningCount} warnings)`);
        } else {
          console.log(`[pipeline] Day ${dayNumber} validation: all checks passed`);
        }

        // --- REPAIR ---
        const repairInput: RepairDayInput = {
          day: currentDayMinimal,
          validationResults,
          dayNumber,
          isFirstDay,
          isLastDay,
          arrivalTime24: validationInput.arrivalTime24,
          returnDepartureTime24: validationInput.returnDepartureTime24,
          hotelName: resolvedRepairHotelName,
          hotelAddress: resolvedRepairHotelAddr,
          hasHotel: true, // Always treat as having hotel — repair will use "Your Hotel" placeholder if none selected
          lockedActivities: lockedActivities as any[],
          restaurantPool: paramRestaurantPool || undefined,
          usedRestaurants: paramUsedRestaurants || undefined,
          // New fields for post-gen guarantees (Part B)
          isTransitionDay: resolvedIsTransitionDay,
          isMultiCity: resolvedIsMultiCity,
          isLastDayInCity: resolvedIsLastDayInCity,
          resolvedDestination: resolvedDestination || destination,
          nextLegTransport: resolvedNextLegTransport,
          nextLegCity: resolvedNextLegCity,
          nextLegTransportDetails: resolvedNextLegTransportDetails,
          arrivalAirport: arrivalAirportDisplay || flightContext.arrivalAirport || undefined,
          airportTransferMinutes: airportTransferMinutes || undefined,
          hotelOverride: resolvedHotelOverride ? { name: resolvedHotelOverride.name, address: resolvedHotelOverride.address } : undefined,
          hotelCoordinates: hotelCoordinates,
          isHotelChange: resolvedIsHotelChange,
          previousHotelName: resolvedPreviousHotelName,
          previousHotelAddress: facts.resolvedPreviousHotelAddress,
        };

        const { day: repairedDay, repairs } = repairDay(repairInput);

        if (repairs.length > 0) {
          console.log(`[pipeline] Day ${dayNumber} repairs: ${repairs.length} fixes applied — ${repairs.map(r => r.action).join(', ')}`);
        }

        // Apply repaired activities back
        generatedDay.activities = repairedDay.activities;
        normalizedActivities = generatedDay.activities;

      } catch (pipelineErr) {
        console.warn('[pipeline] Validate/repair failed (non-blocking):', pipelineErr);
      }
    }

    // =======================================================================
    // PERSIST: Day upsert, activity insert, UUID mapping, version save
    // Extracted to pipeline/persist-day.ts (Phase 5)
    // =======================================================================
    if (tripId) {
      try {
        const persistResult = await persistDay({
          supabase,
          tripId,
          dayNumber,
          date,
          generatedDay,
          normalizedActivities,
          action: paramAction,
          profile,
          resolvedIsTransitionDay,
          resolvedTransitionFrom,
          resolvedTransitionTo,
          resolvedTransportMode,
          resolvedDestination,
        });
        normalizedActivities = persistResult.normalizedActivities;
        generatedDay.activities = normalizedActivities;
      } catch (persistErr) {
        console.error('[generate-day] Persist error:', persistErr);
      }
    }

    // =====================================================================
    // POST-GENERATION: Validate must-do items for this day (logging only)
    // =====================================================================
    if (mustDoActivities && mustDoActivities.trim()) {
      try {
        const forceAllMust = !!isSmartFinish || !!smartFinishRequested;
        const dayMustDos = parseMustDoInput(mustDoActivities, destination, forceAllMust, preferences?.startDate || date?.split('T')[0], totalDays)
          .filter(m => m.priority === 'must');

        if (dayMustDos.length > 0) {
          const dayForValidation = [{
            dayNumber,
            activities: (normalizedActivities || []).map((a: any) => ({ title: a.title || a.name || '' })),
          }];
          const dayValidation = validateMustDosInItinerary(dayForValidation, dayMustDos);

          if (dayValidation.missing.length > 0) {
            console.warn(`[generate-day] ⚠️ Day ${dayNumber} missing must-do items: ${dayValidation.missing.map(m => m.activityName).join(', ')}`);
          } else if (dayValidation.found.length > 0) {
            console.log(`[generate-day] ✓ Day ${dayNumber} must-do validation passed (${dayValidation.found.length} found)`);
          }
        }
      } catch (valErr) {
        console.warn('[generate-day] Must-do validation error (non-blocking):', valErr);
      }
    }

    // Post-gen hotel check-in, checkout, departure sequence, and airport stripping
    // are now handled by pipeline/repair-day.ts (steps 9-12)

    // ====================================================================
    if (allUserIdsForAttribution.length > 1 && generatedDay?.activities?.length) {
      let backfilledCount = 0;
      const transportCategories = ['transport', 'transit', 'transfer', 'transportation', 'flight', 'travel'];
      generatedDay.activities.forEach((act: any, idx: number) => {
        if (!act.suggestedFor) {
          const cat = (act.category || '').toLowerCase();
          if (transportCategories.includes(cat)) {
            // Transport is shared — assign all travelers
            act.suggestedFor = allUserIdsForAttribution.join(',');
          } else {
            // Round-robin assignment across travelers
            act.suggestedFor = allUserIdsForAttribution[idx % allUserIdsForAttribution.length];
          }
          backfilledCount++;
        }
      });
      if (backfilledCount > 0) {
        console.log(`[generate-day] ✓ Backfilled suggestedFor on ${backfilledCount}/${generatedDay.activities.length} activities for Day ${dayNumber}`);
      }
    }

    // ====================================================================
    // MEAL FINAL GUARD — Last line of defense for generate-day path
    // Runs AFTER all post-processing (dedup, personalization strip,
    // opening hours removal, route optimization, etc.)
    // Now pre-fetches real venues from verified_venues table so fallbacks
    // use REAL restaurant names instead of generic "dinner spot" text.
    // ====================================================================
    let mealGuardResult: { alreadyCompliant: boolean; activities: any[]; injectedMeals: string[] } | null = null;
    let mealsBeforeGuard: string[] = [];
    let mealsAfterGuard: string[] = [];
    if (dayMealPolicy && dayMealPolicy.requiredMeals.length > 0) {
      // Build meal fallback venues from restaurant pool first, then verified_venues
      let mealFallbackVenues: Array<{ name: string; address: string; mealType: string }> = [];
      
      // PRIORITY 1: Use the pre-generated restaurant pool (real, curated restaurants)
      if (paramRestaurantPool && Array.isArray(paramRestaurantPool) && paramRestaurantPool.length > 0) {
        const usedSet = new Set((paramUsedRestaurants || []).map((n: string) => n.toLowerCase()));
        for (const r of paramRestaurantPool) {
          if (!usedSet.has((r.name || '').toLowerCase())) {
            mealFallbackVenues.push({
              name: r.name,
              address: r.address || r.neighborhood || (resolvedDestination || destination || ''),
              mealType: r.mealType || 'any',
            });
          }
        }
        if (mealFallbackVenues.length > 0) {
          console.log(`[generate-day] Meal guard using ${mealFallbackVenues.length} venues from restaurant pool`);
        }
      }
      
      // PRIORITY 2: Fallback to verified_venues if pool is empty
      if (mealFallbackVenues.length < 5) {
        try {
          const destQuery = resolvedDestination || destination || '';
          if (destQuery && supabase) {
            let { data: venues } = await supabase
              .from('verified_venues')
              .select('name, address, category')
              .ilike('city', `%${destQuery}%`)
              .in('category', ['restaurant', 'dining', 'cafe', 'bar', 'food'])
              .limit(30);
            if ((!venues || venues.length === 0) && destQuery.includes(',')) {
              const cityOnly = destQuery.split(',')[0].trim();
              const broader = await supabase
                .from('verified_venues')
                .select('name, address, category')
                .ilike('city', `%${cityOnly}%`)
                .in('category', ['restaurant', 'dining', 'cafe', 'bar', 'food'])
                .limit(30);
              venues = broader.data;
              if (venues && venues.length > 0) {
                console.log(`[generate-day] Broadened verified_venues query to "${cityOnly}" — found ${venues.length} results`);
              }
            }
            if (venues && venues.length > 0) {
              for (const v of venues) {
                const nameLower = (v.name || '').toLowerCase();
                let mealType = 'any';
                if (nameLower.includes('breakfast') || nameLower.includes('brunch') || nameLower.includes('café') || nameLower.includes('cafe') || nameLower.includes('bakery')) mealType = 'breakfast';
                else if (nameLower.includes('ramen') || nameLower.includes('lunch') || nameLower.includes('noodle') || nameLower.includes('sandwich')) mealType = 'lunch';
                else if (nameLower.includes('dinner') || nameLower.includes('izakaya') || nameLower.includes('steakhouse') || nameLower.includes('bistro')) mealType = 'dinner';
                mealFallbackVenues.push({ name: v.name, address: v.address || destQuery, mealType });
              }
              console.log(`[generate-day] Supplemented with ${venues.length} verified_venues candidates`);
            }
          }
        } catch (e) {
          console.warn('[generate-day] Could not pre-fetch venue candidates:', e);
        }
      }

      // Chain restaurant filtering is now handled by pipeline/validate-day + repair-day

      // Snapshot meals BEFORE guard for accurate diagnostics
      mealsBeforeGuard = detectMealSlots(generatedDay.activities || []);

      mealGuardResult = enforceRequiredMealsFinalGuard(
        generatedDay.activities || [],
        dayMealPolicy.requiredMeals,
        dayNumber,
        resolvedDestination || destination || 'the destination',
        'USD',
        dayMealPolicy.dayMode,
        mealFallbackVenues,
      );
      if (!mealGuardResult.alreadyCompliant) {
        generatedDay.activities = mealGuardResult.activities as any;
        normalizedActivities = generatedDay.activities;
        console.warn(`[generate-day] 🍽️ MEAL GUARD FIRED: Day ${dayNumber} was missing [${mealGuardResult.injectedMeals.join(', ')}] — injected ${mealFallbackVenues.length > 0 ? 'REAL POOL venues' : 'destination-aware fallbacks'} before return`);
      } else {
        console.log(`[generate-day] ✓ Meal guard passed — Day ${dayNumber} has all required meals [${dayMealPolicy.requiredMeals.join(', ')}]`);
      }

      // Snapshot meals AFTER guard
      mealsAfterGuard = detectMealSlots(generatedDay.activities || []);
    }

    // End post-processing phase and write progress
    if (innerTimer) {
      innerTimer.endPhase(`post_processing_day_${dayNumber}`);
      const postProcPct = 5 + Math.round((dayNumber / Math.max(1, totalDays || 1)) * 90);
      await innerTimer.updateProgress(`day_${dayNumber}_post_processing_complete`, postProcPct);
    }

    // ── FINAL MICHELIN PRICE FLOOR GUARD ──
    // Must run LAST so no other pricing step can overwrite the corrected price
    if (Array.isArray(generatedDay.activities)) {
      for (const act of generatedDay.activities) {
        enforceBarNightcapPriceCap(act, 'GENERATE_DAY_FINAL');
        enforceCasualVenuePriceCap(act, 'GENERATE_DAY_FINAL');
        enforceVenueTypePriceCap(act, 'GENERATE_DAY_FINAL');
        enforceMichelinPriceFloor(act, 'GENERATE_DAY_FINAL');
      }
    }

    // ── BUILD DIAGNOSTICS ──
    // Use the canonical detectMealSlots for consistent reporting
    const finalMeals = mealsAfterGuard.length > 0 ? mealsAfterGuard : detectMealSlots(generatedDay.activities || []);

    const _diagnostics = {
      aiCallMs: _diagTimers.aiCallEnd - _diagTimers.aiCallStart,
      enrichMs: _diagTimers.enrichEnd - _diagTimers.enrichStart,
      meals: {
        required: dayMealPolicy?.requiredMeals || [],
        found: finalMeals,
        beforeGuard: mealsBeforeGuard,
        guardFired: !!(mealGuardResult && !mealGuardResult.alreadyCompliant),
        injected: mealGuardResult?.injectedMeals || [],
      },
      transport: {
        isTransitionDay: resolvedIsTransitionDay,
        mode: resolvedTransportMode || null,
        hadInterCityTravel: !!(resolvedNextLegTransport && resolvedNextLegTransport !== 'none'),
        fallbackInjected: false,
      },
      llm: {
        model: aiResult?.model || 'unknown',
        promptTokens: aiResult?.usage?.prompt_tokens || 0,
        completionTokens: aiResult?.usage?.completion_tokens || 0,
      },
    };

    return new Response(
      JSON.stringify({
        success: true,
        day: generatedDay,
        dayNumber,
        totalDays,
        usedPersonalization: !!preferenceContext,
        flightAware: !!(flightContext.arrivalTime || flightContext.returnDepartureTime),
        preservedLocked: lockedActivities.length,
        _diagnostics,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-day] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Day generation failed", code: "GENERATE_DAY_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

}
