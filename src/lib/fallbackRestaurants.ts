/**
 * Client mirror of the server's INLINE_FALLBACK_RESTAURANTS pool
 * (supabase/functions/generate-itinerary/fix-placeholders.ts).
 *
 * Used by mealGuard, the activity-name sanitizer, and the pre-save sweep
 * so that no client-side path can ever ship a generic
 * "Breakfast — find a local spot" stub. Every chain terminates in a
 * real, named venue.
 *
 * Keep entries in sync with the server pool when adding cities. We
 * intentionally duplicate (not import) because Deno modules cannot be
 * loaded by Vite without a build-time bridge.
 */

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'drinks';

export interface FallbackRestaurant {
  name: string;
  address: string;
  price: number;
  description: string;
}

// -----------------------------------------------------------------------------
// City pool — abbreviated mirror of server INLINE_FALLBACK_RESTAURANTS
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
      { name: "Le Comptoir du Relais", address: "9 Carrefour de l'Odéon, 75006 Paris", price: 55, description: "Yves Camdeborde's legendary bistro. Lunch is a masterclass in French comfort food." },
      { name: "Breizh Café", address: "109 Rue Vieille du Temple, 75003 Paris", price: 30, description: "The best crêpes in Paris. Buckwheat galettes in the heart of Le Marais." },
      { name: "Bouillon Pigalle", address: "22 Bd de Clichy, 75018 Paris", price: 25, description: "Belle Époque brasserie. Classic French dishes at accessible prices." },
      { name: "Chez Janou", address: "2 Rue Roger Verlomme, 75003 Paris", price: 40, description: "Provençal bistro near Place des Vosges. Famous for their giant chocolate mousse." },
    ],
    dinner: [
      { name: "Le Relais de l'Entrecôte", address: "20 Rue Saint-Benoît, 75006 Paris", price: 50, description: "One menu only: walnut salad and steak-frites with a legendary secret sauce." },
      { name: "Chez l'Ami Jean", address: "27 Rue Malar, 75007 Paris", price: 75, description: "Basque-influenced gastro-bistro. The rice pudding dessert is legendary." },
      { name: "Frenchie", address: "5 Rue du Nil, 75002 Paris", price: 95, description: "Gregory Marchand's celebrated tasting menu. Inventive French-global flavors." },
      { name: "Le Bouillon Julien", address: "16 Rue du Faubourg Saint-Denis, 75010 Paris", price: 30, description: "Stunning 1906 Art Nouveau dining room. Classic French brasserie fare." },
    ],
  },
  rome: {
    breakfast: [
      { name: "Caffè Sant'Eustachio", address: "Piazza di S. Eustachio 82, 00186 Rome", price: 10, description: "Rome's most iconic espresso bar since 1938. Order the Gran Caffè standing." },
      { name: "Roscioli Caffè Pasticceria", address: "Piazza Benedetto Cairoli 16, 00186 Rome", price: 15, description: "Gourmet pastry bar near Campo de' Fiori. Incredible cornetti." },
      { name: "Antico Forno Roscioli", address: "Via dei Chiavari 34, 00186 Rome", price: 10, description: "Bakery since 1824. Pizza bianca straight from the oven, maritozzi with cream." },
      { name: "Marigold Roma", address: "Via Giovanni da Empoli 37, 00154 Rome", price: 18, description: "Scandi-Italian bakery in Ostiense. Sourdough cinnamon buns and the best brunch eggs in town." },
    ],
    lunch: [
      { name: "Roscioli Salumeria", address: "Via dei Giubbonari 21, 00186 Rome", price: 45, description: "Legendary deli-restaurant. Outstanding cacio e pepe and curated wine list." },
      { name: "Supplizio", address: "Via dei Banchi Vecchi 143, 00186 Rome", price: 15, description: "Gourmet supplì. The cacio e pepe version is unforgettable." },
      { name: "Pizzarium", address: "Via della Meloria 43, 00136 Rome", price: 15, description: "Gabriele Bonci's world-famous pizza al taglio." },
      { name: "Mordi e Vai", address: "Testaccio Market, Box 15, Rome", price: 10, description: "Allesso di bollito panini dunked in beef gravy — the most Roman lunch you'll have." },
    ],
    dinner: [
      { name: "Da Enzo al 29", address: "Via dei Vascellari 29, 00153 Rome", price: 35, description: "Trastevere institution. Perfect cacio e pepe, carbonara, and seasonal artichokes." },
      { name: "Armando al Pantheon", address: "Salita dei Crescenzi 31, 00186 Rome", price: 50, description: "Family-run trattoria steps from the Pantheon. Classic Roman cuisine." },
      { name: "Trattoria Da Teo", address: "Piazza dei Ponziani 7A, 00153 Rome", price: 40, description: "Cult Trastevere trattoria. The amatriciana and saltimbocca alla romana are perfect." },
      { name: "Flavio al Velavevodetto", address: "Via di Monte Testaccio 97, 00153 Rome", price: 45, description: "Cavernous Testaccio dining room. The rigatoni alla gricia is benchmark." },
    ],
  },
  berlin: {
    breakfast: [
      { name: "House of Small Wonder", address: "Johannisstraße 20, 10117 Berlin", price: 18, description: "Japanese-inspired brunch in Mitte. Matcha lattes and okonomiyaki pancakes." },
      { name: "Café Einstein Stammhaus", address: "Kurfürstenstraße 58, 10785 Berlin", price: 20, description: "Grand Viennese-style café. Excellent Frühstück and apple strudel." },
      { name: "Father Carpenter", address: "Münzstraße 21, 10178 Berlin", price: 16, description: "Hidden Mitte courtyard café. Australian-style flat whites and sourdough toast." },
      { name: "Distrikt Coffee", address: "Bergstraße 68, 10115 Berlin", price: 17, description: "Bright Mitte specialty coffee bar. Excellent eggs Florentine and shakshuka." },
    ],
    lunch: [
      { name: "Curry 36", address: "Mehringdamm 36, 10961 Berlin", price: 8, description: "Iconic currywurst stand at Mehringdamm since 1980." },
      { name: "Markthalle Neun", address: "Eisenbahnstraße 42/43, 10997 Berlin", price: 18, description: "Kreuzberg's historic market hall. Street food stalls and craft beer." },
      { name: "Mustafa's Gemüse Kebap", address: "Mehringdamm 32, 10961 Berlin", price: 7, description: "Berlin's most famous kebab. The queue is part of the ritual." },
      { name: "Lon Men's Noodle House", address: "Kantstraße 33, 10625 Berlin", price: 15, description: "Tiny Taiwanese noodle house. Iconic dan dan noodles." },
    ],
    dinner: [
      { name: "Katz Orange", address: "Bergstraße 22, 10115 Berlin", price: 55, description: "Farm-to-table in a gorgeous courtyard. The 12-hour pulled pork is legendary." },
      { name: "Mrs Robinson's", address: "Pappelallee 29, 10437 Berlin", price: 65, description: "Prenzlauer Berg neighborhood favorite. Asian-inflected small plates." },
      { name: "Hartmanns Restaurant", address: "Fichtestraße 31, 10967 Berlin", price: 75, description: "Long-running modern German restaurant. Refined cooking, prix-fixe driven." },
    ],
  },
  barcelona: {
    breakfast: [
      { name: "Federal Café", address: "Passatge de la Pau 11, 08002 Barcelona", price: 16, description: "Australian-style café in El Gòtic. Excellent flat whites and smashed avo." },
      { name: "Granja M. Viader", address: "Carrer d'en Xuclà 4-6, 08001 Barcelona", price: 10, description: "Historic dairy bar (1870). Birthplace of Cacaolat — order thick hot chocolate with melindros." },
      { name: "Caravelle", address: "Carrer del Pintor Fortuny 31, 08001 Barcelona", price: 17, description: "Cult Raval brunch spot. Huevos rancheros and pulled pork tacos." },
      { name: "Syra Coffee", address: "Carrer d'Astúries 50, 08012 Barcelona", price: 9, description: "Specialty coffee bar in Gràcia. Perfect flat whites." },
    ],
    lunch: [
      { name: "Bar Pinotxo", address: "La Rambla 91, 08001 Barcelona (Stall 466-470)", price: 25, description: "Juanito Bayén's iconic counter inside La Boqueria." },
      { name: "Bar del Pla", address: "Carrer de Montcada 2, 08003 Barcelona", price: 30, description: "Born tapas bar. Modern takes on Catalan classics." },
      { name: "Bar Cañete", address: "Carrer de la Unió 17, 08001 Barcelona", price: 45, description: "Glittering Raval tapas bar. Counter seating, pristine seafood." },
      { name: "Quimet & Quimet", address: "Carrer del Poeta Cabanyes 25, 08004 Barcelona", price: 25, description: "Tiny Poble-sec montadito bar with a stunning vermouth selection." },
    ],
    dinner: [
      { name: "Cal Pep", address: "Plaça de les Olles 8, 08003 Barcelona", price: 55, description: "Counter-seating tapas bar near Born. Chef Pep's seafood is extraordinary." },
      { name: "Cervecería Catalana", address: "Carrer de Mallorca 236, 08008 Barcelona", price: 40, description: "Locals' favorite tapas in Eixample. Outstanding patatas bravas and jamón ibérico." },
      { name: "Suculent", address: "Rambla del Raval 43, 08001 Barcelona", price: 60, description: "Carles Abellán's intimate Raval bistro. Inventive Catalan cooking." },
      { name: "Mont Bar", address: "Carrer de la Diputació 220, 08011 Barcelona", price: 65, description: "Eixample tapas bar with Michelin-level technique." },
    ],
  },
  london: {
    breakfast: [
      { name: "Dishoom", address: "12 Upper St Martin's Ln, WC2H 9FB London", price: 20, description: "Bombay café reimagined. Bacon naan roll and chai are breakfast perfection." },
      { name: "The Wolseley", address: "160 Piccadilly, W1J 9EB London", price: 35, description: "Grand café-restaurant in a former car showroom. Viennese-style breakfast." },
      { name: "Granger & Co.", address: "175 Westbourne Grove, W11 2SB London", price: 22, description: "Bill Granger's airy Notting Hill flagship. The ricotta hotcakes are an institution." },
      { name: "St. JOHN Bakery", address: "72 Druid St, SE1 2HQ London", price: 8, description: "Bermondsey bakery from Fergus Henderson. Warm doughnuts and the best sourdough in town." },
    ],
    lunch: [
      { name: "Padella", address: "6 Southwark St, SE1 1TQ London", price: 18, description: "Hand-rolled pasta at Borough Market. Pici cacio e pepe is essential." },
      { name: "Koya Soho", address: "50 Frith St, W1D 4SQ London", price: 18, description: "Udon counter in Soho. Hot or cold dashi udon and exceptional tempura." },
      { name: "Rochelle Canteen", address: "16 Playground Gardens, E2 7FA London", price: 35, description: "Hidden Shoreditch lunch spot in a former bike shed. Margot Henderson's seasonal British plates." },
      { name: "Quo Vadis", address: "26-29 Dean St, W1D 3LL London", price: 40, description: "Soho institution from Jeremy Lee. The smoked eel sandwich at the bar is perfect." },
    ],
    dinner: [
      { name: "St. JOHN", address: "26 St John St, EC1M 4AY London", price: 60, description: "Fergus Henderson's nose-to-tail manifesto. Roast bone marrow with parsley salad — definitively British." },
      { name: "Brat", address: "4 Redchurch St, E1 6JL London", price: 65, description: "Michelin-starred Basque-inspired grill in Shoreditch. Whole turbot and padron peppers over fire." },
      { name: "Gymkhana", address: "42 Albemarle St, W1S 4JH London", price: 75, description: "Michelin-starred Indian restaurant in Mayfair. Extraordinary modern Indian cuisine." },
      { name: "Smoking Goat", address: "64 Shoreditch High St, E1 6JJ London", price: 45, description: "Loud Shoreditch Thai bar. Fish-sauce wings and lardo fried rice." },
    ],
  },
  lisbon: {
    breakfast: [
      { name: "Manteigaria", address: "R. do Loreto 2, 1200-242 Lisbon", price: 4, description: "Pastéis de nata baked all day at the counter. Warm, perfect, dusted with cinnamon." },
      { name: "Heim Café", address: "R. de Santos-o-Velho 2, 1200-808 Lisbon", price: 15, description: "Cozy brunch spot in Santos. Excellent avocado toast, açaí bowls, specialty coffee." },
      { name: "Copenhagen Coffee Lab", address: "R. Nova da Piedade 10, 1200-298 Lisbon", price: 12, description: "Scandinavian-style specialty coffee roaster in Chiado." },
    ],
    lunch: [
      { name: "Cervejaria Ramiro", address: "Av. Almirante Reis 1H, 1150-007 Lisbon", price: 45, description: "Legendary seafood beer hall. Tiger prawns, percebes, and a prego steak sandwich." },
      { name: "A Cevicheria", address: "R. Dom Pedro V 129, 1250-093 Lisbon", price: 40, description: "Chef Kiko Martins' Peruvian-Portuguese fusion." },
      { name: "Café de São Bento", address: "R. de São Bento 212, 1200-821 Lisbon", price: 50, description: "Classic Lisbon steakhouse. Their prego sandwich and garlic prawns are local institutions." },
    ],
    dinner: [
      { name: "Solar dos Presuntos", address: "R. das Portas de Santo Antão 150, 1150-269 Lisbon", price: 55, description: "Minho-style cooking. Legendary presunto and seafood rice in a lively dining room." },
      { name: "Sacramento do Chiado", address: "R. do Sacramento 26, 1200-394 Lisbon", price: 45, description: "Converted church in Chiado. Modern Portuguese cuisine in a stunning setting." },
      { name: "Pharmácia", address: "R. Marechal Saldanha 1, 1249-069 Lisbon", price: 40, description: "Pharmacy-themed restaurant in Santa Catarina. Creative Portuguese dishes with Tagus views." },
    ],
  },
};

// -----------------------------------------------------------------------------
// Regional + global emergency fallback (small, real venues)
// -----------------------------------------------------------------------------
const REGIONAL_EMERGENCY: Record<string, Record<'breakfast' | 'lunch' | 'dinner', FallbackRestaurant>> = {
  italy: {
    breakfast: { name: "Sant'Eustachio Il Caffè", address: "Piazza di S. Eustachio 82, Rome, Italy", price: 10, description: "Italy's most iconic espresso bar." },
    lunch: { name: "All'Antico Vinaio", address: "Via dei Neri 65, Florence, Italy", price: 12, description: "Italy's most-loved schiacciata sandwich shop." },
    dinner: { name: "Trattoria Sostanza", address: "Via del Porcellana 25, Florence, Italy", price: 50, description: "Florentine institution since 1869." },
  },
  france: {
    breakfast: { name: "Du Pain et des Idées", address: "34 Rue Yves Toudic, 75010 Paris, France", price: 12, description: "Christophe Vasseur's cult bakery." },
    lunch: { name: "Bouillon Pigalle", address: "22 Bd de Clichy, 75018 Paris, France", price: 25, description: "Stunning Belle Époque brasserie." },
    dinner: { name: "Le Comptoir du Relais", address: "9 Carrefour de l'Odéon, 75006 Paris, France", price: 65, description: "Yves Camdeborde's iconic bistro." },
  },
  spain: {
    breakfast: { name: "Granja M. Viader", address: "Carrer d'en Xuclà 4, Barcelona, Spain", price: 10, description: "Historic dairy bar (1870). Birthplace of Cacaolat." },
    lunch: { name: "Bar Pinotxo", address: "La Boqueria, La Rambla 91, Barcelona, Spain", price: 25, description: "Juanito Bayén's market counter." },
    dinner: { name: "Casa Lucio", address: "Calle Cava Baja 35, Madrid, Spain", price: 60, description: "Madrid institution famous for huevos rotos." },
  },
  germany: {
    breakfast: { name: "Café Einstein Stammhaus", address: "Kurfürstenstraße 58, 10785 Berlin, Germany", price: 20, description: "Grand Viennese-style café in a historic villa." },
    lunch: { name: "Curry 36", address: "Mehringdamm 36, 10961 Berlin, Germany", price: 8, description: "Iconic Berlin currywurst stand." },
    dinner: { name: "Zur Letzten Instanz", address: "Waisenstraße 14-16, 10179 Berlin, Germany", price: 35, description: "Berlin's oldest restaurant (1621)." },
  },
  uk: {
    breakfast: { name: "Dishoom", address: "12 Upper St Martin's Ln, WC2H 9FB London, UK", price: 20, description: "Bombay café reimagined. The bacon naan roll is a London institution." },
    lunch: { name: "Padella", address: "6 Southwark St, SE1 1TQ London, UK", price: 18, description: "Borough Market hand-rolled pasta." },
    dinner: { name: "St. JOHN", address: "26 St John St, EC1M 4AY London, UK", price: 60, description: "Fergus Henderson's nose-to-tail manifesto." },
  },
  portugal: {
    breakfast: { name: "Manteigaria", address: "R. do Loreto 2, 1200-242 Lisbon, Portugal", price: 4, description: "Pastéis de nata baked all day at the counter." },
    lunch: { name: "Cervejaria Ramiro", address: "Av. Almirante Reis 1H, 1150-007 Lisbon, Portugal", price: 45, description: "Legendary seafood beer hall." },
    dinner: { name: "Solar dos Presuntos", address: "R. das Portas de Santo Antão 150, Lisbon, Portugal", price: 55, description: "Minho-style cooking." },
  },
};

const CITY_COUNTRY_MAP: Record<string, keyof typeof REGIONAL_EMERGENCY> = {
  rome: 'italy', milan: 'italy', florence: 'italy', venice: 'italy', naples: 'italy', bologna: 'italy', turin: 'italy',
  paris: 'france', nice: 'france', lyon: 'france', marseille: 'france', bordeaux: 'france', strasbourg: 'france',
  barcelona: 'spain', madrid: 'spain', seville: 'spain', valencia: 'spain', granada: 'spain', bilbao: 'spain', malaga: 'spain',
  berlin: 'germany', munich: 'germany', hamburg: 'germany', frankfurt: 'germany', cologne: 'germany',
  london: 'uk', manchester: 'uk', edinburgh: 'uk', glasgow: 'uk', dublin: 'uk', liverpool: 'uk', oxford: 'uk',
  lisbon: 'portugal', porto: 'portugal',
};

const GLOBAL_EMERGENCY: Record<'breakfast' | 'lunch' | 'dinner', FallbackRestaurant | null> = {
  breakfast: null,
  lunch: null,
  dinner: null,
};

function regionalEmergencyFallback(city: string, mealType: MealSlot): FallbackRestaurant | null {
  const m = mealType === 'drinks' ? 'dinner' : mealType;
  const cityKey = (city || '').toLowerCase().trim().split(',')[0].trim();
  if (!cityKey) return null;
  for (const [needle, country] of Object.entries(CITY_COUNTRY_MAP)) {
    if (cityKey.includes(needle) || needle.includes(cityKey)) {
      const region = REGIONAL_EMERGENCY[country];
      if (region && region[m]) return region[m];
    }
  }
  return GLOBAL_EMERGENCY[m];
}

function pickFromCity(
  city: string,
  mealType: MealSlot,
  usedNames: Set<string>,
  ignoreUsed: boolean,
): FallbackRestaurant | null {
  const cityKey = (city || '').toLowerCase().trim();
  if (!cityKey) return null;
  let cityData: Record<string, FallbackRestaurant[]> | undefined;
  for (const [key, data] of Object.entries(INLINE_FALLBACK_RESTAURANTS)) {
    if (cityKey.includes(key) || key.includes(cityKey)) {
      cityData = data;
      break;
    }
  }
  if (!cityData) return null;

  let options = cityData[mealType];
  if ((!options || options.length === 0) && mealType === 'drinks') {
    options = cityData['dinner'];
  }
  if (!options || options.length === 0) return null;

  if (ignoreUsed) return options[Math.floor(Math.random() * options.length)];

  const available = options.filter(r => !usedNames.has(r.name.toLowerCase()));
  if (available.length === 0) return options[0];
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * GUARANTEED resolver — returns a real, named venue when one is known
 * for the given city or its country. Returns null only when the city is
 * outside our coverage (caller should mark the slot `needsVenuePick`).
 */
export function resolveAnyMealFallback(
  city: string,
  mealType: MealSlot,
  usedNames: Set<string> = new Set(),
): FallbackRestaurant | null {
  return (
    pickFromCity(city, mealType, usedNames, false) ||
    pickFromCity(city, mealType, new Set(), true) ||
    regionalEmergencyFallback(city, mealType)
  );
}

export function parseMealTypeFromTime(startTime: string | undefined | null): MealSlot {
  if (!startTime) return 'lunch';
  const m = /^(\d{1,2}):(\d{2})/.exec(startTime.trim());
  if (!m) return 'lunch';
  const h = parseInt(m[1], 10);
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 17) return 'lunch';
  return 'dinner';
}

export function hasFallbackCoverage(city: string): boolean {
  const cityKey = (city || '').toLowerCase().trim();
  if (!cityKey) return false;
  for (const key of Object.keys(INLINE_FALLBACK_RESTAURANTS)) {
    if (cityKey.includes(key) || key.includes(cityKey)) return true;
  }
  for (const needle of Object.keys(CITY_COUNTRY_MAP)) {
    if (cityKey.includes(needle) || needle.includes(cityKey)) return true;
  }
  return false;
}
