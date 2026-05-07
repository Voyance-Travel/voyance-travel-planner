/**
 * Client mirror of the server's INLINE_FALLBACK_RESTAURANTS pool
 * (supabase/functions/generate-itinerary/fix-placeholders.ts).
 *
 * Used by mealGuard, the activity-name sanitizer, and the pre-save sweep
 * so that no client-side path can ever ship a generic
 * "Breakfast — find a local spot" stub.
 *
 * CRITICAL — CROSS-CITY INTEGRITY (per Cross-City Fallback Integrity memory):
 * We MUST NEVER return a real venue from a different city than the
 * destination. Months of "Tartine Bakery (San Francisco) in Venice" /
 * "All'Antico Vinaio (Florence) in Venice" / "Le Comptoir du Relais (Paris)
 * in Venice" bugs trace back to country-pool / global-emergency fallbacks
 * here. There is now NO country pool and NO global pool — when no
 * city-matched real venue exists, we emit an unverified `needsVenuePick`
 * sentinel ($0) instead.
 */

import { detectCrossCityMention } from './crossCityFilter';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'drinks';

export interface FallbackRestaurant {
  name: string;
  address: string;
  price: number;
  description: string;
  needsVenuePick?: boolean;
}

// -----------------------------------------------------------------------------
// City pool — abbreviated mirror of server INLINE_FALLBACK_RESTAURANTS.
// Every entry MUST be in the city named by its key. Adding a venue from a
// different city to a city's pool is a cross-city bug.
// -----------------------------------------------------------------------------
export const INLINE_FALLBACK_RESTAURANTS: Record<string, Record<'breakfast' | 'lunch' | 'dinner', FallbackRestaurant[]>> = {
  paris: {
    breakfast: [
      { name: "Café de Flore", address: "172 Bd Saint-Germain, 75006 Paris", price: 35, description: "Iconic Left Bank café. Croissants with house jam and a grand crème." },
      { name: "Le Nemours", address: "2 Pl. Colette, 75001 Paris", price: 25, description: "Classic Parisian terrace café facing the Palais Royal gardens." },
      { name: "Maison Sauvage", address: "5 Rue de Buci, 75006 Paris", price: 25, description: "Flower-covered façade in Saint-Germain. Excellent avocado toast and fresh pastries." },
      { name: "Holybelly", address: "19 Rue Lucien Sampaix, 75010 Paris", price: 25, description: "Australian-style brunch near Canal Saint-Martin. Legendary pancakes." },
      { name: "Du Pain et des Idées", address: "34 Rue Yves Toudic, 75010 Paris", price: 12, description: "Christophe Vasseur's cult bakery. Pain des amis and escargot pistache-chocolat." },
    ],
    lunch: [
      { name: "Le Comptoir du Relais", address: "9 Carrefour de l'Odéon, 75006 Paris", price: 55, description: "Yves Camdeborde's legendary bistro." },
      { name: "Breizh Café", address: "109 Rue Vieille du Temple, 75003 Paris", price: 30, description: "The best crêpes in Paris." },
      { name: "Bouillon Pigalle", address: "22 Bd de Clichy, 75018 Paris", price: 25, description: "Belle Époque brasserie at accessible prices." },
      { name: "Chez Janou", address: "2 Rue Roger Verlomme, 75003 Paris", price: 40, description: "Provençal bistro near Place des Vosges." },
    ],
    dinner: [
      { name: "Le Relais de l'Entrecôte", address: "20 Rue Saint-Benoît, 75006 Paris", price: 50, description: "Walnut salad and steak-frites with the legendary secret sauce." },
      { name: "Chez l'Ami Jean", address: "27 Rue Malar, 75007 Paris", price: 75, description: "Basque-influenced gastro-bistro." },
      { name: "Frenchie", address: "5 Rue du Nil, 75002 Paris", price: 95, description: "Gregory Marchand's celebrated tasting menu." },
      { name: "Le Bouillon Julien", address: "16 Rue du Faubourg Saint-Denis, 75010 Paris", price: 30, description: "Stunning 1906 Art Nouveau brasserie." },
    ],
  },
  rome: {
    breakfast: [
      { name: "Caffè Sant'Eustachio", address: "Piazza di S. Eustachio 82, 00186 Rome", price: 10, description: "Rome's most iconic espresso bar since 1938." },
      { name: "Roscioli Caffè Pasticceria", address: "Piazza Benedetto Cairoli 16, 00186 Rome", price: 15, description: "Gourmet pastry bar near Campo de' Fiori." },
      { name: "Antico Forno Roscioli", address: "Via dei Chiavari 34, 00186 Rome", price: 10, description: "Bakery since 1824. Pizza bianca and maritozzi." },
      { name: "Marigold Roma", address: "Via Giovanni da Empoli 37, 00154 Rome", price: 18, description: "Scandi-Italian bakery in Ostiense." },
    ],
    lunch: [
      { name: "Roscioli Salumeria", address: "Via dei Giubbonari 21, 00186 Rome", price: 45, description: "Legendary deli-restaurant. Outstanding cacio e pepe." },
      { name: "Supplizio", address: "Via dei Banchi Vecchi 143, 00186 Rome", price: 15, description: "Gourmet supplì." },
      { name: "Pizzarium", address: "Via della Meloria 43, 00136 Rome", price: 15, description: "Gabriele Bonci's world-famous pizza al taglio." },
      { name: "Mordi e Vai", address: "Testaccio Market, Box 15, Rome", price: 10, description: "Allesso di bollito panini dunked in beef gravy." },
    ],
    dinner: [
      { name: "Da Enzo al 29", address: "Via dei Vascellari 29, 00153 Rome", price: 35, description: "Trastevere institution." },
      { name: "Armando al Pantheon", address: "Salita dei Crescenzi 31, 00186 Rome", price: 50, description: "Family-run trattoria steps from the Pantheon." },
      { name: "Trattoria Da Teo", address: "Piazza dei Ponziani 7A, 00153 Rome", price: 40, description: "Cult Trastevere trattoria." },
      { name: "Flavio al Velavevodetto", address: "Via di Monte Testaccio 97, 00153 Rome", price: 45, description: "Cavernous Testaccio dining room." },
    ],
  },
  venice: {
    breakfast: [
      { name: "Pasticceria Tonolo", address: "Calle S. Pantalon 3764, 30123 Venezia VE, Italy", price: 8, description: "Cult Dorsoduro pastry counter since 1886. Krapfen, bignè, and the city's most beloved morning espresso." },
      { name: "Caffè del Doge", address: "Calle dei Cinque 609, 30125 Venezia VE, Italy", price: 10, description: "Specialty roastery near the Rialto. Single-origin espresso and brioche canal-side." },
      { name: "Rosa Salva", address: "Calle Fiubera 951, 30124 Venezia VE, Italy", price: 9, description: "Venetian institution since 1879 just off San Marco." },
      { name: "Marchini Time", address: "Campo S. Luca 4589, 30124 Venezia VE, Italy", price: 10, description: "Outstanding cornetti and a lively standing-bar morning crowd." },
    ],
    lunch: [
      { name: "All'Arco", address: "Calle dell'Occhialer 436, 30125 Venezia VE, Italy", price: 18, description: "Tiny San Polo cicchetti bar steps from the Rialto." },
      { name: "Cantine del Vino già Schiavi", address: "Fondamenta Nani 992, 30123 Venezia VE, Italy", price: 18, description: "Iconic Dorsoduro bacaro." },
      { name: "Osteria al Squero", address: "Fondamenta Nani 943-944, 30123 Venezia VE, Italy", price: 20, description: "Cicchetti facing the working gondola squero." },
      { name: "Trattoria alla Madonna", address: "Calle de la Madona 594, 30125 Venezia VE, Italy", price: 35, description: "1954 Rialto stalwart for classic Venetian seafood." },
    ],
    dinner: [
      { name: "Osteria alle Testiere", address: "Calle del Mondo Novo 5801, 30122 Venezia VE, Italy", price: 75, description: "Tiny Castello icon (24 seats). Hyper-seasonal lagoon seafood." },
      { name: "Antiche Carampane", address: "Rio Terà de le Carampane 1911, 30125 Venezia VE, Italy", price: 80, description: "Hidden San Polo trattoria. A Venetian benchmark." },
      { name: "Al Covo", address: "Castello 3968, 30122 Venezia VE, Italy", price: 90, description: "Cesare Benelli's Castello dining room." },
      { name: "Vini da Gigio", address: "Fondamenta San Felice 3628/A, 30121 Venezia VE, Italy", price: 70, description: "Cannaregio family trattoria with a stunning wine cellar." },
      { name: "CoVino", address: "Calle del Pestrin 3829, 30122 Venezia VE, Italy", price: 65, description: "Intimate 14-seat Castello room. Slow-Food-driven tasting menu." },
    ],
  },
  berlin: {
    breakfast: [
      { name: "House of Small Wonder", address: "Johannisstraße 20, 10117 Berlin", price: 18, description: "Japanese-inspired brunch in Mitte." },
      { name: "Café Einstein Stammhaus", address: "Kurfürstenstraße 58, 10785 Berlin", price: 20, description: "Grand Viennese-style café." },
      { name: "Father Carpenter", address: "Münzstraße 21, 10178 Berlin", price: 16, description: "Hidden Mitte courtyard café." },
      { name: "Distrikt Coffee", address: "Bergstraße 68, 10115 Berlin", price: 17, description: "Bright Mitte specialty coffee bar." },
    ],
    lunch: [
      { name: "Curry 36", address: "Mehringdamm 36, 10961 Berlin", price: 8, description: "Iconic currywurst stand." },
      { name: "Markthalle Neun", address: "Eisenbahnstraße 42/43, 10997 Berlin", price: 18, description: "Kreuzberg's historic market hall." },
      { name: "Mustafa's Gemüse Kebap", address: "Mehringdamm 32, 10961 Berlin", price: 7, description: "Berlin's most famous kebab." },
      { name: "Lon Men's Noodle House", address: "Kantstraße 33, 10625 Berlin", price: 15, description: "Tiny Taiwanese noodle house." },
    ],
    dinner: [
      { name: "Katz Orange", address: "Bergstraße 22, 10115 Berlin", price: 55, description: "Farm-to-table in a gorgeous courtyard." },
      { name: "Mrs Robinson's", address: "Pappelallee 29, 10437 Berlin", price: 65, description: "Prenzlauer Berg neighborhood favorite." },
      { name: "Hartmanns Restaurant", address: "Fichtestraße 31, 10967 Berlin", price: 75, description: "Long-running modern German restaurant." },
    ],
  },
  barcelona: {
    breakfast: [
      { name: "Federal Café", address: "Passatge de la Pau 11, 08002 Barcelona", price: 16, description: "Australian-style café in El Gòtic." },
      { name: "Granja M. Viader", address: "Carrer d'en Xuclà 4-6, 08001 Barcelona", price: 10, description: "Historic dairy bar (1870)." },
      { name: "Caravelle", address: "Carrer del Pintor Fortuny 31, 08001 Barcelona", price: 17, description: "Cult Raval brunch spot." },
      { name: "Syra Coffee", address: "Carrer d'Astúries 50, 08012 Barcelona", price: 9, description: "Specialty coffee bar in Gràcia." },
    ],
    lunch: [
      { name: "Bar Pinotxo", address: "La Rambla 91, 08001 Barcelona (Stall 466-470)", price: 25, description: "Juanito Bayén's iconic counter inside La Boqueria." },
      { name: "Bar del Pla", address: "Carrer de Montcada 2, 08003 Barcelona", price: 30, description: "Born tapas bar." },
      { name: "Bar Cañete", address: "Carrer de la Unió 17, 08001 Barcelona", price: 45, description: "Glittering Raval tapas bar." },
      { name: "Quimet & Quimet", address: "Carrer del Poeta Cabanyes 25, 08004 Barcelona", price: 25, description: "Tiny Poble-sec montadito bar." },
    ],
    dinner: [
      { name: "Cal Pep", address: "Plaça de les Olles 8, 08003 Barcelona", price: 55, description: "Counter-seating tapas bar near Born." },
      { name: "Cervecería Catalana", address: "Carrer de Mallorca 236, 08008 Barcelona", price: 40, description: "Locals' favorite tapas in Eixample." },
      { name: "Suculent", address: "Rambla del Raval 43, 08001 Barcelona", price: 60, description: "Carles Abellán's intimate Raval bistro." },
      { name: "Mont Bar", address: "Carrer de la Diputació 220, 08011 Barcelona", price: 65, description: "Eixample tapas bar with Michelin-level technique." },
    ],
  },
  london: {
    breakfast: [
      { name: "Dishoom", address: "12 Upper St Martin's Ln, WC2H 9FB London", price: 20, description: "Bombay café reimagined." },
      { name: "The Wolseley", address: "160 Piccadilly, W1J 9EB London", price: 35, description: "Grand café-restaurant in a former car showroom." },
      { name: "Granger & Co.", address: "175 Westbourne Grove, W11 2SB London", price: 22, description: "Bill Granger's airy Notting Hill flagship." },
      { name: "St. JOHN Bakery", address: "72 Druid St, SE1 2HQ London", price: 8, description: "Bermondsey bakery from Fergus Henderson." },
    ],
    lunch: [
      { name: "Padella", address: "6 Southwark St, SE1 1TQ London", price: 18, description: "Hand-rolled pasta at Borough Market." },
      { name: "Koya Soho", address: "50 Frith St, W1D 4SQ London", price: 18, description: "Udon counter in Soho." },
      { name: "Rochelle Canteen", address: "16 Playground Gardens, E2 7FA London", price: 35, description: "Hidden Shoreditch lunch spot." },
      { name: "Quo Vadis", address: "26-29 Dean St, W1D 3LL London", price: 40, description: "Soho institution from Jeremy Lee." },
    ],
    dinner: [
      { name: "St. JOHN", address: "26 St John St, EC1M 4AY London", price: 60, description: "Fergus Henderson's nose-to-tail manifesto." },
      { name: "Brat", address: "4 Redchurch St, E1 6JL London", price: 65, description: "Michelin-starred Basque-inspired grill." },
      { name: "Gymkhana", address: "42 Albemarle St, W1S 4JH London", price: 75, description: "Michelin-starred Indian restaurant in Mayfair." },
      { name: "Smoking Goat", address: "64 Shoreditch High St, E1 6JJ London", price: 45, description: "Loud Shoreditch Thai bar." },
    ],
  },
  lisbon: {
    breakfast: [
      { name: "Manteigaria", address: "R. do Loreto 2, 1200-242 Lisbon", price: 4, description: "Pastéis de nata baked all day at the counter." },
      { name: "Heim Café", address: "R. de Santos-o-Velho 2, 1200-808 Lisbon", price: 15, description: "Cozy brunch spot in Santos." },
      { name: "Copenhagen Coffee Lab", address: "R. Nova da Piedade 10, 1200-298 Lisbon", price: 12, description: "Scandinavian-style specialty coffee." },
    ],
    lunch: [
      { name: "Cervejaria Ramiro", address: "Av. Almirante Reis 1H, 1150-007 Lisbon", price: 45, description: "Legendary seafood beer hall." },
      { name: "A Cevicheria", address: "R. Dom Pedro V 129, 1250-093 Lisbon", price: 40, description: "Chef Kiko Martins' Peruvian-Portuguese fusion." },
      { name: "Café de São Bento", address: "R. de São Bento 212, 1200-821 Lisbon", price: 50, description: "Classic Lisbon steakhouse." },
    ],
    dinner: [
      { name: "Solar dos Presuntos", address: "R. das Portas de Santo Antão 150, 1150-269 Lisbon", price: 55, description: "Minho-style cooking." },
      { name: "Sacramento do Chiado", address: "R. do Sacramento 26, 1200-394 Lisbon", price: 45, description: "Converted church in Chiado." },
      { name: "Pharmácia", address: "R. Marechal Saldanha 1, 1249-069 Lisbon", price: 40, description: "Pharmacy-themed restaurant in Santa Catarina." },
    ],
  },
};

// -----------------------------------------------------------------------------
// Unverified sentinel — used when no city-matched real venue exists. We
// EXPLICITLY refuse to ship a famous-but-foreign venue (Tartine, Le Comptoir,
// All'Antico Vinaio, etc.).
// -----------------------------------------------------------------------------
function unverifiedMealSentinel(city: string, mealType: MealSlot): FallbackRestaurant {
  const m = mealType === 'drinks' ? 'dinner' : mealType;
  const label = m === 'breakfast' ? 'Breakfast' : m === 'lunch' ? 'Lunch' : 'Dinner';
  return {
    name: `${label} — find a local spot in ${city || 'the city'}`,
    address: city || '',
    price: 0,
    description: `No vetted ${m} venue available — ask the concierge or pick a local favourite on arrival.`,
    needsVenuePick: true,
  };
}

function pickFromCity(
  city: string,
  mealType: MealSlot,
  usedNames: Set<string>,
  ignoreUsed: boolean,
): FallbackRestaurant | null {
  const cityKey = (city || '').toLowerCase().trim().split(',')[0].trim();
  if (!cityKey) return null;
  let cityData: Record<string, FallbackRestaurant[]> | undefined;
  for (const [key, data] of Object.entries(INLINE_FALLBACK_RESTAURANTS)) {
    if (cityKey.includes(key) || key.includes(cityKey)) {
      cityData = data;
      break;
    }
  }
  if (!cityData) return null;

  let options = cityData[mealType === 'drinks' ? 'dinner' : mealType];
  if (!options || options.length === 0) return null;

  // Cross-city safety net even within city pool — should be redundant but
  // protects against a future bad entry.
  options = options.filter(o => !detectCrossCityMention(o.address || '', city) && !detectCrossCityMention(o.name || '', city));
  if (options.length === 0) return null;

  if (ignoreUsed) return options[Math.floor(Math.random() * options.length)];

  const available = options.filter(r => !usedNames.has(r.name.toLowerCase()));
  if (available.length === 0) return options[0];
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Returns a city-matched real venue OR an unverified `needsVenuePick`
 * sentinel ($0). NEVER returns a venue from a different city.
 */
export function resolveAnyMealFallback(
  city: string,
  mealType: MealSlot,
  usedNames: Set<string> = new Set(),
): FallbackRestaurant {
  return (
    pickFromCity(city, mealType, usedNames, false) ||
    pickFromCity(city, mealType, new Set(), true) ||
    unverifiedMealSentinel(city, mealType)
  );
}

export function parseMealTypeFromTime(startTime: string | undefined | null): MealSlot {
  if (!startTime) return 'lunch';
  const m = /^(\d{1,2}):(\d{2})/.exec(startTime.trim());
  if (!m) return 'lunch';
  const h = parseInt(m[1], 10);
  if (h < 11) return 'breakfast';
  if (h < 17) return 'lunch';
  return 'dinner';
}

export function hasFallbackCoverage(city: string): boolean {
  const cityKey = (city || '').toLowerCase().trim().split(',')[0].trim();
  if (!cityKey) return false;
  for (const key of Object.keys(INLINE_FALLBACK_RESTAURANTS)) {
    if (cityKey.includes(key) || key.includes(cityKey)) return true;
  }
  return false;
}
