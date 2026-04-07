/**
 * Sanitization utilities for AI-generated itinerary content.
 * Strips CJK artifacts, schema-leak fragments, and garbled text.
 */

import { extractRestaurantVenueName } from './generation-utils.ts';

// =============================================================================
// ALWAYS-FREE VENUE PATTERNS — shared across sanitization, repair, and generation
// =============================================================================

/**
 * Tier 1: venues that are always free (parks, plazas, viewpoints, etc.).
 * Exported so that action-repair-costs.ts and generation-core.ts use the
 * exact same list instead of maintaining their own copies.
 */
export const ALWAYS_FREE_VENUE_PATTERNS: RegExp[] = [
  // Parks and gardens (multilingual)
  /\b(garden|jardin|garten|giardino|jardim|park|parc|parque|tuin)\b/i,
  // Public squares and plazas
  /\b(plaza|piazza|place\s|platz|praça|praca|square|largo|campo|plein)\b/i,
  // Bridges
  /\b(pont\s|bridge|puente|ponte|br[üu]cke|brug)\b/i,
  // Waterfront walks
  /\b(promenade|esplanade|boardwalk|waterfront|riverside|riverbank|seafront|canal\s+walk|corniche|malec[oó]n|lungomare|lakefront)\b/i,
  // Walks and strolls
  /\b(neighborhood\s+walk|stroll|wander|walking\s+tour|evening\s+(?:walk|stroll)|morning\s+(?:walk|stroll)|historic\s+walk)\b/i,
  // Viewpoints (not observation decks)
  /\b(viewpoint|miradouro|miradouros|mirador|outlook|overlook|belvedere|vista|panoram\w*)\b/i,
  // Religious sites (usually free entry)
  /\b(church|[eé]glise|chiesa|kirche|iglesia|igreja|cathedral|cath[eé]drale|cattedrale|kathedrale|dom|basilica|basilique|basilika|mosque|mosqu[eé]e|moschee|temple|shrine|synagogue|pagoda)\b/i,
  // Markets (entry free, food priced separately)
  /\b(market|march[eé]|mercato|markt|mercado|feira|bazar|bazaar|souk)\b/i,
  // Monuments and memorials
  /\b(monument|memorial|statue|fountain|fontaine|fontana|brunnen|fuente)\b/i,
  // Districts / neighborhoods
  /\b(district|neighborhood|neighbourhood|bairro|quarter|old\s+town|bookstore|bookshop|livraria|library|biblioteca)\b/i,
  // Paseo
  /\b(paseo)\b/i,
  // Paris-specific free venues
  /\b(champs.?[eé]lys[eé]es|montmartre|sacr[eé].?c[oœ]ur|tuileries|champ\s+de\s+mars|palais.?royal.*garden|seine.*walk|walk.*seine|[iî]le\s+saint.?louis)\b/i,
];

/** Tier 2: free only when description says "free" or price is in phantom range */
export const TIER2_FREE_VENUE_PATTERNS = /\b(?:arch|gate|trail|path|pier|dock|wharf|embankment)\b/i;

/** Paid-experience exclusion — don't force-free if any of these match */
const PAID_EXPERIENCE_RE: RegExp[] = [
  /\b(museum|mus[eé]e|museo|muzeum|gallery|galerie|galleria|orangerie)\b/i,
  /\b(observation\s+deck|tower.*ticket|climb.*ticket|rooftop.*ticket|dome.*climb)\b/i,
  /\b(boat|cruise|ferry|gondola|cable\s+car|funicular)\b/i,
  /\b(show|concert|performance|exhibition)\b/i,
  /\b(spa|wellness|treatment|massage|hammam|onsen)\b/i,
  /\b(class|workshop|course|lesson|cooking)\b/i,
  /\b(guided\s+tour|walking\s+tour|food\s+tour)\b/i,
  /\b(tour|guided|ticket|admission|entry)\b/i,
  /\b(botanical|bot[âa]nico|castle|castelo|pal[áa]cio|palace|tower|torre|aquarium|zoo|monastery|mosteiro)\b/i,
  /\b(colosseum|coliseum|amphitheatre|amphitheater|archaeological|ruins|excavation|arena\s+floor)\b/i,
];

// =============================================================================
// MARKET PATTERNS — shared for market dining cap
// =============================================================================
const MARKET_RE = /\b(?:market|march[eé]|mercato|markt|mercado|feira|bazar|bazaar|souk)\b/i;

/**
 * Cap dining-at-market prices to €20/pp instead of zeroing.
 * Markets are free to enter but food costs money.
 */
export function enforceMarketDiningCap(activity: Record<string, any>, label = 'sanitize'): boolean {
  const category = (activity.category || '').toUpperCase();
  if (category !== 'DINING' && category !== 'RESTAURANT') return false;

  const combined = `${activity.title || ''} ${activity.venue_name || ''}`;
  if (!MARKET_RE.test(combined)) return false;

  const price = typeof activity.price_per_person === 'number' ? activity.price_per_person : 0;
  if (price > 20) {
    console.warn(`[MARKET-CAP] [${label}] "${activity.title}" at market capped from €${price} to €20`);
    activity.price_per_person = 20;
    activity.price = 20;
    if (typeof activity.cost === 'number') activity.cost = 20;
    if (activity.cost && typeof activity.cost === 'object') activity.cost.amount = 20;
    return true;
  }
  return false;
}

// =============================================================================
// KNOWN TICKETED ATTRACTIONS — minimum admission prices (EUR/USD) by venue
// =============================================================================

/** Known ticketed attractions that should NEVER be Free. Maps lowercase venue substring → min price per person. */
export const KNOWN_TICKETED_ATTRACTIONS: Record<string, number> = {
  // Rome
  'colosseum arena floor': 24,
  'colosseum arena': 24,
  'colosseum': 16,
  'coliseum': 16,
  'vatican museums': 17,
  'vatican museum': 17,
  'sistine chapel': 17,
  'borghese gallery': 13,
  'galleria borghese': 13,
  "castel sant'angelo": 10,
  'castel sant angelo': 10,
  "st peter's dome": 8,
  'st peters dome': 8,
  'palatine hill': 16,
  'roman forum': 16,
  // Berlin
  'pergamon museum': 12,
  'neues museum': 12,
  'berlin tv tower': 22,
  'fernsehturm': 22,
  'jewish museum berlin': 8,
  'charlottenburg palace': 12,
  // Lisbon
  'jerónimos monastery': 10,
  'jeronimos monastery': 10,
  'belém tower': 8,
  'belem tower': 8,
  'torre de belém': 8,
  'torre de belem': 8,
  // Paris
  'louvre': 17,
  'musée du louvre': 17,
  'eiffel tower': 11,
  'tour eiffel': 11,
  'versailles': 18,
  'palace of versailles': 18,
  "musée d'orsay": 14,
  'musee d orsay': 14,
  'arc de triomphe': 13,
  'sainte-chapelle': 11,
  'sainte chapelle': 11,
  // Barcelona
  'sagrada familia': 26,
  'la sagrada familia': 26,
  'park güell': 10,
  'park guell': 10,
  'casa batlló': 35,
  'casa batllo': 35,
  'casa milà': 25,
  'casa mila': 25,
  'la pedrera': 25,
  // London
  'tower of london': 29,
  'westminster abbey': 25,
  "st paul's cathedral": 21,
  'st pauls cathedral': 21,
  'kew gardens': 15,
  // Amsterdam
  'rijksmuseum': 22,
  'van gogh museum': 20,
  'anne frank house': 16,
  // Prague
  'prague castle': 14,
  'st vitus cathedral': 14,
  // Vienna
  'schönbrunn palace': 22,
  'schonbrunn palace': 22,
  'belvedere palace': 16,
};

// =============================================================================
// MICHELIN / FINE DINING PRICE FLOOR CONSTANTS — shared with action-repair-costs
// =============================================================================

/** Known top-tier Michelin (2-star+) restaurants — floor €180/pp */
export const KNOWN_MICHELIN_HIGH = /\b(belcanto|feitoria|fifty\s*seconds|fortaleza\s*do\s*guincho)\b/i;

/** Known Michelin 1-star restaurants — floor €120/pp */
export const KNOWN_MICHELIN_MID = /\b(alma|eleven|epur|cura|loco|eneko|100\s*maneiras|cem\s*maneiras|casa\s*da\s*comida|pedro\s*lemos|antiqvvm|largo\s*do\s*pa[çc]o|euskalduna|casa\s*de\s*ch[áa]\s*da\s*boa\s*nova|boa\s*nova)\b/i;

/** Known upscale restaurants — floor €60/pp */
export const KNOWN_UPSCALE = /\b(il\s*gallo|ceia|enoteca|sommelier|mini\s*bar|sacramento|solar\s*dos\s*presuntos|the\s*yeatman|yeatman)\b/i;

/** Per-tier Michelin price floors (EUR/pp) */
export const MICHELIN_FLOOR = { high: 180, mid: 120, upscale: 60 } as const;

// =============================================================================
// EXPLICIT STAR MAPPING — canonical restaurant name → Michelin star count
// =============================================================================

/** Explicit restaurant → star count map. Keys must be lowercase. */
export const KNOWN_FINE_DINING_STARS: Record<string, number> = {
  // === LISBON / PORTUGAL ===
  'belcanto': 2,
  'alma': 2,
  'ocean': 2,
  'vila joya': 2,
  'the yeatman': 2,
  'eleven': 1,
  'eleven restaurant': 1,
  'eleven restaurante': 1,
  'feitoria': 1,
  'feitoria restaurant': 1,
  'cura': 1,
  'loco': 1,
  'fifty seconds': 1,
  'eneko': 1,
  "il gallo d'oro": 1,
  'epur': 1,
  '100 maneiras': 1,
  'cem maneiras': 1,
  'casa da comida': 1,
  'pedro lemos': 1,
  'antiqvvm': 1,
  'largo do paço': 1,
  'euskalduna': 1,
  'casa de chá da boa nova': 1,
  'boa nova': 1,
  'fortaleza do guincho': 2,

  // === PARIS ===
  'le cinq': 3,
  'arpège': 3,
  'arpege': 3,
  "l'ambroisie": 3,
  'lambroisie': 3,
  "l\u2019ambroisie": 3,
  'le pré catelan': 3,
  'le pre catelan': 3,
  'epicure': 3,
  'epicure le bristol': 3,
  'le bristol - epicure': 3,
  'le bristol epicure': 3,
  'guy savoy': 3,
  'le meurice': 2,
  'le meurice alain ducasse': 2,
  'alain ducasse au meurice': 2,
  'le jules verne': 1,
  'le grand véfour': 2,
  'le grand vefour': 2,
  'le clarence': 2,
  'passage 53': 2,
  'kei': 2,
  'kei restaurant': 2,
  'david toutain': 1,
  'septime': 1,
  "l'atelier de joël robuchon": 2,
  'le chateaubriand': 1,
  'frenchie': 1,
  'contraste': 1,
  'contraste restaurant': 1,
  'table - bruno verjus': 2,
  'plénitude': 3,
  'plenitude': 3,

  // === BERLIN ===
  'facil': 2,
  'rutz': 2,
  'rutz restaurant': 2,
  'horváth': 1,
  'horvath': 1,
  'ernst': 3,
  'lorenz adlon esszimmer': 2,
  'coda': 1,
  'coda dessert bar': 1,
  'tulus lotrek': 1,
  'bieberbau': 1,
  'einsunternull': 1,
  'skykitchen': 1,
  'hugos': 1,
  'hugos restaurant': 1,
  'kin dee': 1,
  'bandol sur mer': 1,
  'nobelhart & schmutzig': 1,
  'prism': 1,
  'orania.berlin': 1,

  // === ROME ===
  'la pergola': 3,
  'il pagliaccio': 2,
  'imàgo': 1,
  'imago': 1,
  'aroma': 1,
  'aroma restaurant': 1,
  'pipero': 1,
  'enoteca la torre': 1,

  // === BARCELONA ===
  'abac': 2,
  'abac restaurant': 2,
  'lasarte': 3,
  'lasarte restaurant': 3,
  'moments': 2,
  'moments restaurant': 2,
  'disfrutar': 3,
  'cinc sentits': 1,
  'enigma': 1,
  'alkimia': 1,
  'cocina hermanos torres': 2,
  'enoteca paco pérez': 1,

  // === LONDON ===
  'the fat duck': 3,
  'alain ducasse at the dorchester': 3,
  'core by clare smyth': 3,
  'sketch': 3,
  'sketch lecture room': 3,
  'dinner by heston': 2,
  'dinner by heston blumenthal': 2,
  'le gavroche': 2,
  'marcus': 1,
  'the ledbury': 2,
  'ikoyi': 2,
  'da terra': 2,
  'the clove club': 1,
  "lyle's": 1,
  'lyles': 1,
  'brat': 1,

  // === AMSTERDAM ===
  "librije's zusje": 2,
  "librije's zusje amsterdam": 2,
  'ciel bleu': 2,
  'spectrum': 1,
  "bord'eau": 1,
  'rijks': 1,
  'vinkeles': 1,

  // === VIENNA ===
  'steirereck': 2,
  'amador': 2,
  'silvio nickol': 2,
  'konstantin filippou': 1,
  'edvard': 1,
  'mraz & sohn': 2,

  // === MADRID ===
  'diverxo': 3,
  'coque': 2,
  'smoked room': 2,
  'santceloni': 2,
  'ramon freixa madrid': 1,
  'ramon freixa': 1,

  // === MILAN ===
  'enrico bartolini': 3,
  'seta': 2,
  'vun andrea aprea': 2,
  'berton': 1,
  'tokuyoshi': 1,
  'joia': 1,

  // === COPENHAGEN ===
  'noma': 3,
  'geranium': 3,
  'alchemist': 3,
  'kadeau': 1,
  'aoc': 1,
  'jordnær': 2,

  // === MUNICH ===
  'atelier': 3,
  'tantris': 2,
  'tantris restaurant': 2,
  'werneckhof by geisel': 2,
  'esszimmer': 2,

  // === ISTANBUL ===
  'turk fatih tutak': 2,
  'mikla': 1,
  'neolokal': 1,
};

/** Per-star price floors (EUR/pp) */
export const FINE_DINING_MIN_PRICE_BY_STARS: Record<number, number> = {
  1: 120,
  2: 180,
  3: 250,
};

/** Default floor for known fine dining without star info */
export const FINE_DINING_MIN_PRICE_DEFAULT = 120;

// =============================================================================
// SHARED HELPER: enforceMichelinPriceFloor
// =============================================================================

/**
 * Enforce Michelin price floors on a single activity object.
 * Matches against KNOWN_FINE_DINING_STARS map, then falls back to keyword detection.
 * Writes corrected price to ALL cost field shapes on the activity.
 *
 * Call this as the LAST pricing step so no subsequent logic can overwrite it.
 */
export function enforceMichelinPriceFloor(activity: Record<string, any>, logPrefix = 'FINAL'): boolean {
  const category = (activity.category || '').toUpperCase();
  const title = (activity.title || activity.name || '').toLowerCase();

  // Only check dining-related activities
  const isDining = /DINING|RESTAURANT/i.test(category) ||
    /\b(breakfast|lunch|dinner|brunch|restaurant|dining)\b/i.test(title);
  if (!isDining) return false;

  // Resolve current price from all field shapes
  const resolvePrice = (): number => {
    if (activity.cost && typeof activity.cost === 'object' && typeof activity.cost.amount === 'number') return activity.cost.amount;
    if (typeof activity.cost === 'number') return activity.cost;
    if (activity.estimatedCost && typeof activity.estimatedCost === 'object' && typeof activity.estimatedCost.amount === 'number') return activity.estimatedCost.amount;
    if (typeof activity.estimatedCost === 'number') return activity.estimatedCost;
    if (typeof activity.estimated_cost === 'number') return activity.estimated_cost;
    if (typeof activity.price_per_person === 'number') return activity.price_per_person;
    if (typeof activity.estimated_price_per_person === 'number') return activity.estimated_price_per_person;
    if (typeof activity.price === 'number') return activity.price;
    return 0;
  };

  const currentPrice = resolvePrice();

  console.log(`MICHELIN FLOOR CHECK [${logPrefix}]: "${activity.title}" price=${currentPrice} category=${activity.category}`);

  // Build combined text for matching
  const venueName = (activity.venue_name || activity.restaurant?.name || '').toLowerCase();
  const combined = [title, venueName, (activity.description || '').toLowerCase(), (activity.restaurant?.description || '').toLowerCase()].join(' ');

  // Strategy 1: Match against explicit star map
  let matchedKey: string | null = null;
  let starRating = 0;

  // Strip meal-type prefixes for matching: "Dinner at Eleven Restaurant" → "eleven restaurant"
  const strippedTitle = title.replace(/^(breakfast|lunch|dinner|brunch|meal)\s*(at|:|-|–)\s*/i, '').trim();

  for (const [key, stars] of Object.entries(KNOWN_FINE_DINING_STARS)) {
    if (
      title.includes(key) ||
      strippedTitle.includes(key) ||
      venueName.includes(key) ||
      (key.length >= 4 && strippedTitle === key) ||
      (key.length >= 4 && venueName === key)
    ) {
      matchedKey = key;
      starRating = stars;
      break;
    }
  }

  // Strategy 2: Fall back to Michelin keywords in text
  if (!matchedKey) {
    if (/michelin\s*3|3[\s-]*star/i.test(combined)) {
      starRating = 3; matchedKey = '[keyword: 3-star]';
    } else if (/michelin\s*2|2[\s-]*star/i.test(combined)) {
      starRating = 2; matchedKey = '[keyword: 2-star]';
    } else if (/michelin\s*1|1[\s-]*star|michelin[\s-]*starred/i.test(combined)) {
      starRating = 1; matchedKey = '[keyword: 1-star]';
    } else if (/tasting menu|fine dining|haute cuisine|degustation|omakase/i.test(combined)) {
      starRating = 1; matchedKey = '[keyword: fine dining]';
    }
  }

  // Strategy 3: Fall back to regex buckets (existing constants)
  if (!matchedKey) {
    if (KNOWN_MICHELIN_HIGH.test(combined)) {
      starRating = 2; matchedKey = '[regex: KNOWN_MICHELIN_HIGH]';
    } else if (KNOWN_MICHELIN_MID.test(combined)) {
      starRating = 1; matchedKey = '[regex: KNOWN_MICHELIN_MID]';
    } else if (KNOWN_UPSCALE.test(combined)) {
      // Upscale but not starred — use upscale floor
      const minPrice = MICHELIN_FLOOR.upscale;
      if (currentPrice > 0 && currentPrice < minPrice) {
        console.warn(`MICHELIN PRICE FLOOR ENFORCED [${logPrefix}]: "${activity.title}" was €${currentPrice}/pp → raised to €${minPrice}/pp (Known upscale restaurant)`);
        writePriceToAllFields(activity, minPrice);
        return true;
      }
      return false;
    }
  }

  if (!matchedKey) return false;

  const minPrice = starRating > 0
    ? (FINE_DINING_MIN_PRICE_BY_STARS[starRating] || FINE_DINING_MIN_PRICE_DEFAULT)
    : FINE_DINING_MIN_PRICE_DEFAULT;

  console.log(`MICHELIN FLOOR MATCH [${logPrefix}]: "${activity.title}" matched="${matchedKey}" stars=${starRating} price=${currentPrice} minPrice=${minPrice}`);

  if (currentPrice > 0 && currentPrice < minPrice) {
    console.warn(`MICHELIN PRICE FLOOR ENFORCED [${logPrefix}]: "${activity.title}" was €${currentPrice}/pp → raised to €${minPrice}/pp (${starRating}-star minimum)`);
    writePriceToAllFields(activity, minPrice);
    return true;
  }

  return false;
}

/** Write a corrected price to every cost field shape present on an activity. */
function writePriceToAllFields(activity: Record<string, any>, price: number): void {
  if (activity.cost && typeof activity.cost === 'object') activity.cost.amount = price;
  else if (typeof activity.cost === 'number') activity.cost = price;
  else activity.cost = { amount: price, currency: 'EUR' };

  if (activity.estimatedCost && typeof activity.estimatedCost === 'object') activity.estimatedCost.amount = price;
  else if (typeof activity.estimatedCost === 'number') activity.estimatedCost = price;

  if (typeof activity.estimated_cost === 'number') activity.estimated_cost = price;
  if (activity.price_per_person !== undefined) activity.price_per_person = price;
  if (activity.estimated_price_per_person !== undefined) activity.estimated_price_per_person = price;
  if (activity.price !== undefined) activity.price = price;
  if (activity.estimated_price !== undefined) activity.estimated_price = price;
}

/**
 * Check whether an activity should be forced free.
 * Returns true if the activity matched a free-venue pattern and was zeroed.
 * Emits FREE VENUE CHECK / PHANTOM PRICING FIX logs for debugging.
 */
export function checkAndApplyFreeVenue(activity: Record<string, any>, label = 'sanitize'): boolean {
  const title = activity.title || '';
  const venueName = activity.venue_name || activity.restaurant?.name || '';
  const allTextFields = [
    title,
    venueName,
    activity.description || '',
    activity.location?.name || activity.place_name || '',
    activity.address || '',
    typeof activity.place === 'string' ? activity.place : (activity.place?.name || ''),
    activity.venue || '',
    activity.restaurant?.description || '',
  ].join(' ');

  // Resolve cost from all supported shapes — handle objects and numbers uniformly
  const resolveCostField = (v: unknown): number => {
    if (typeof v === 'number' && !isNaN(v)) return v;
    if (v && typeof v === 'object' && 'amount' in (v as any)) {
      const amt = (v as any).amount;
      return typeof amt === 'number' && !isNaN(amt) ? amt : 0;
    }
    return 0;
  };

  const effectiveCost = Math.max(
    resolveCostField(activity.cost),
    resolveCostField(activity.estimatedCost),
    resolveCostField(activity.estimated_cost),
    typeof activity.estimated_price_per_person === 'number' ? activity.estimated_price_per_person : 0,
    typeof activity.price === 'number' ? activity.price : 0,
    typeof activity.price_per_person === 'number' ? activity.price_per_person : 0,
  );

  if (effectiveCost <= 0) return false;

  const matchesTier1 = ALWAYS_FREE_VENUE_PATTERNS.test(allTextFields);
  const matchesTier2 = TIER2_FREE_VENUE_PATTERNS.test(allTextFields);

  if (!matchesTier1 && !matchesTier2) return false;

  // Log diagnostic
  console.log(`FREE VENUE CHECK: title="${title}", venue="${venueName}", category="${activity.category}", booking_required=${activity.booking_required}, price=${effectiveCost}`);

  const isPaidExperience = activity.booking_required || PAID_EXPERIENCE_RE.test(allTextFields);

  if (matchesTier1 && !isPaidExperience) {
    console.log(`PHANTOM PRICING FIX [${label}]: "${title}" venue="${venueName}" (${activity.category}) matches free venue pattern. Was $${effectiveCost}/pp → Free`);
    zeroActivityCostFields(activity);
    return true;
  }

  if (matchesTier2 && !isPaidExperience && effectiveCost <= 50) {
    const descSaysFree = /\bfree\b/i.test(activity.description || '');
    const isPhantomPrice = effectiveCost >= 20 && effectiveCost <= 25;
    if (descSaysFree || isPhantomPrice) {
      console.log(`PHANTOM PRICING FIX [${label}]: "${title}" (tier2) Was $${effectiveCost}/pp → Free`);
      zeroActivityCostFields(activity);
      return true;
    }
  }

  // --- Tier 3: Known free viewpoints (external viewing of landmarks) ---
  const KNOWN_FREE_VIEWPOINT_RE = /(?:eiffel tower.*(?:sparkle|illumination|viewing|light show)|colosseum.*(?:view(?:ing|point)?|night.*view)|acropolis.*(?:view(?:ing|point)?|sunset)|sagrada.*(?:view(?:ing)?|exterior)|big ben.*(?:view(?:ing)?|night)|trevi fountain.*(?:view|visit)|brandenburg gate.*(?:view|night)|(?:sparkle|illumination|light show).*eiffel tower)/i;
  const PAID_ENTRY_RE = /\b(?:ticket|entry|climb|ascend|summit|elevator|lift|tour|skip.?the.?line|reserved|admission|guided)\b/i;
  const FREE_VIEWING_RE = /\b(?:from|stroll|viewing|watch|admire|gaze|see|photograph|walk.*(?:past|by|to)|outside|exterior|across|champ de mars|trocad[eé]ro)\b/i;

  if (KNOWN_FREE_VIEWPOINT_RE.test(title) || KNOWN_FREE_VIEWPOINT_RE.test(venueName)) {
    const hasPaidIndicator = PAID_ENTRY_RE.test(allTextFields);
    const hasFreeIndicator = FREE_VIEWING_RE.test(allTextFields);
    if (!hasPaidIndicator && hasFreeIndicator) {
      console.log(`PHANTOM PRICING FIX [${label}]: "${title}" is a free external viewpoint. Was $${effectiveCost}/pp → Free`);
      zeroActivityCostFields(activity);
      return true;
    }
  }

  return false;
}

/** Zero out all known cost fields on an activity object */
function zeroActivityCostFields(act: Record<string, any>): void {
  if (act.cost && typeof act.cost === 'object') act.cost.amount = 0;
  if (typeof act.cost === 'number') act.cost = 0;
  act.estimatedCost = 0;
  act.estimated_cost = 0;
  act.estimated_price_per_person = 0;
  act.price = 0;
  act.price_per_person = 0;
  act.is_free = true;
}

// =============================================================================
// TICKETED ATTRACTION PRICING ENFORCEMENT
// =============================================================================

/**
 * Enforce minimum pricing for known ticketed attractions.
 * Call AFTER checkAndApplyFreeVenue (to restore incorrectly zeroed prices)
 * and BEFORE enforceMichelinPriceFloor (which handles dining only).
 * Returns true if a price was restored.
 */
export function enforceTicketedAttractionPricing(activity: Record<string, any>, logPrefix = 'SANITIZE'): boolean {
  // Resolve current price from all field shapes
  const resolvePrice = (): number => {
    if (activity.cost && typeof activity.cost === 'object' && typeof activity.cost.amount === 'number') return activity.cost.amount;
    if (typeof activity.cost === 'number') return activity.cost;
    if (activity.estimatedCost && typeof activity.estimatedCost === 'object' && typeof activity.estimatedCost.amount === 'number') return activity.estimatedCost.amount;
    if (typeof activity.estimatedCost === 'number') return activity.estimatedCost;
    if (typeof activity.estimated_cost === 'number') return activity.estimated_cost;
    if (typeof activity.price_per_person === 'number') return activity.price_per_person;
    if (typeof activity.estimated_price_per_person === 'number') return activity.estimated_price_per_person;
    if (typeof activity.price === 'number') return activity.price;
    return 0;
  };

  const currentPrice = resolvePrice();
  if (currentPrice > 0) return false; // Already has a price, don't override

  const title = (activity.title || activity.name || '').toLowerCase();
  const venueName = (activity.venue_name || activity.restaurant?.name || '').toLowerCase();

  // Check against known ticketed attractions (longest keys first for greedy match)
  const sortedKeys = Object.keys(KNOWN_TICKETED_ATTRACTIONS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (title.includes(key) || venueName.includes(key)) {
      const minPrice = KNOWN_TICKETED_ATTRACTIONS[key];
      console.warn(`TICKETED ATTRACTION FIX [${logPrefix}]: "${activity.title}" was Free but "${key}" is a ticketed attraction (min €${minPrice}). Restoring price.`);
      writePriceToAllFields(activity, minPrice);
      activity.is_free = false;
      return true;
    }
  }

  // Heuristic warning: booking_required + free = suspicious
  const bookingRequired = activity.booking_required ||
    /booking required/i.test(activity.description || '');
  if (bookingRequired && currentPrice === 0) {
    const cat = (activity.category || '').toUpperCase();
    if (['EXPLORE', 'ACTIVITY', 'SIGHTSEEING', 'CULTURAL'].includes(cat)) {
      console.warn(`TICKETED ATTRACTION WARNING [${logPrefix}]: "${activity.title}" has booking_required=true but is Free. Likely needs a price.`);
    }
  }

  return false;
}

// =============================================================================
// BAR / NIGHTCAP PRICE CAP
// =============================================================================

const BAR_KEYWORDS = /\b(nightcap|cocktail|aperitif|drinks?\s+at|wine\s+bar|rooftop\s+bar|hotel\s+bar|speakeasy)\b/i;
const BAR_TITLE_BAR = /\bbar\b/i;
const BAR_EXCLUDE = /\b(barbecue|barista|bar\s+restaurant|sushi\s+bar)\b/i;
const MAX_BAR_PRICE = 50;
const DEFAULT_BAR_PRICE = 35;

/**
 * Cap bar/nightcap activities to a sensible price ceiling.
 * Skips activities that match KNOWN_FINE_DINING_STARS (e.g. a hotel with a Michelin restaurant).
 */
export function enforceBarNightcapPriceCap(activity: Record<string, any>, logPrefix = 'SANITIZE'): boolean {
  const title = (activity.title || activity.name || '').toLowerCase();
  const venueName = (activity.venue_name || activity.restaurant?.name || '').toLowerCase();
  const combined = `${title} ${venueName}`;

  const isBarActivity =
    BAR_KEYWORDS.test(combined) ||
    (BAR_TITLE_BAR.test(combined) && !BAR_EXCLUDE.test(combined));

  if (!isBarActivity) return false;

  // Don't cap if venue is a known Michelin restaurant
  for (const key of Object.keys(KNOWN_FINE_DINING_STARS)) {
    if (title.includes(key) || venueName.includes(key)) return false;
  }

  const currentPrice = resolveActivityPrice(activity);
  if (currentPrice <= MAX_BAR_PRICE) return false;

  console.warn(`BAR PRICING CAP [${logPrefix}]: "${activity.title}" was €${currentPrice}/pp → capped at €${DEFAULT_BAR_PRICE}/pp (bar/cocktail activity)`);
  writePriceToAllFields(activity, DEFAULT_BAR_PRICE);
  return true;
}

// =============================================================================
// CASUAL / STREET FOOD VENUE PRICE CAP
// =============================================================================

/** Known casual/street food venues — max price per person in EUR */
const KNOWN_CASUAL_VENUES: Record<string, number> = {
  // Street food
  'trapizzino': 15,
  'bao': 20,
  'five guys': 20,
  'shake shack': 20,
  'good bank': 20,
  'cocolo ramen': 25,
  'currywurst': 12,
  'döner': 12,
  'doner': 12,
  'kebab': 15,
  'pizza al taglio': 12,
  'supplizio': 15,

  // Bookstore cafés
  'shakespeare and company café': 25,
  'shakespeare and company cafe': 25,
  'shakespeare and company': 25,

  // Markets (entry free, food stalls cheap)
  'marché des enfants rouges': 20,
  'marche des enfants rouges': 20,
  'marché aux puces': 15,
  'marché bastille': 15,
  'marché d\'aligre': 15,
  "marche d'aligre": 15,
  'borough market': 20,
  'mercato centrale': 20,
  'mercato testaccio': 15,
  'markthalle neun': 20,

  // Famous cafés (not fine dining)
  'café de flore': 45,
  'cafe de flore': 45,
  'les deux magots': 40,
  'ladurée': 50,
  'laduree': 50,
  'angelina': 50,
  'carette': 40,
  'stohrer': 30,

  // Montmartre casual restaurants
  'le moulin de la galette': 50,
  'le consulat': 40,
  'la maison rose': 45,

  // Other commonly overpriced Paris venues
  'le petit journal': 50,
  'bouillon chartier': 30,
  'bouillon pigalle': 30,
  'bouillon julien': 35,
  "le relais de l'entrecôte": 55,
  "le relais de l'entrecote": 55,
  'pink mamma': 40,
  'breizh café': 35,
  'breizh cafe': 35,
};

/**
 * Cap known casual / street-food venues that the AI over-prices.
 */
export function enforceCasualVenuePriceCap(activity: Record<string, any>, logPrefix = 'SANITIZE'): boolean {
  const title = (activity.title || activity.name || '').toLowerCase();
  const venueName = (activity.venue_name || activity.restaurant?.name || '').toLowerCase();

  for (const [key, maxPrice] of Object.entries(KNOWN_CASUAL_VENUES)) {
    if (title.includes(key) || venueName.includes(key)) {
      const currentPrice = resolveActivityPrice(activity);
      if (currentPrice > maxPrice) {
        console.warn(`CASUAL VENUE CAP [${logPrefix}]: "${activity.title}" was €${currentPrice}/pp → capped at €${maxPrice}/pp (casual/street food)`);
        writePriceToAllFields(activity, maxPrice);
        return true;
      }
      return false;
    }
  }
  return false;
}

// =============================================================================
// VENUE-TYPE PATTERN PRICE CAP (regex-based fallback for uncatalogued venues)
// =============================================================================

const CASUAL_VENUE_TYPE_PATTERNS: Array<{ pattern: RegExp; maxPrice: number }> = [
  { pattern: /\b(?:march[eé]|market|mercato|markt|mercado|feira|bazar|bazaar|souk)\b/i, maxPrice: 20 },
  { pattern: /\b(?:bookshop|bookstore|librairie|librer[ií]a)\b/i, maxPrice: 25 },
  { pattern: /\b(?:boulangerie|bakery|bäckerei|backerei|patisserie|pâtisserie|panader[ií]a|padaria)\b/i, maxPrice: 25 },
  { pattern: /\b(?:street food|food stall|food truck|food cart|hawker|vendor)\b/i, maxPrice: 15 },
  { pattern: /\bcaf[eé]\b.*\b(?:bookshop|literary|book)\b/i, maxPrice: 25 },
  { pattern: /\b(?:bookshop|literary|book)\b.*\bcaf[eé]\b/i, maxPrice: 25 },
  // Ice cream and dessert shops
  { pattern: /\b(?:gelato|ice cream|gelateria|glacier|frozen yogurt|dessert shop)\b/i, maxPrice: 15 },
  // Fast casual / quick service
  { pattern: /\b(?:fast casual|quick bite|grab and go|take.?away|to go)\b/i, maxPrice: 20 },
  // Casual unnamed café pattern: "Breakfast at a casual..."
  { pattern: /^(?:breakfast|lunch|brunch)\s+at\s+a\s+(?:casual|simple|small|corner|local|neighborhood)\b/i, maxPrice: 25 },
];

/**
 * Cap venue prices based on venue-type patterns (markets, bakeries, bookshop cafés, etc.).
 * This catches venues NOT in the explicit KNOWN_CASUAL_VENUES map.
 */
export function enforceVenueTypePriceCap(activity: Record<string, any>, logPrefix = 'SANITIZE'): boolean {
  const title = (activity.title || activity.name || '').toLowerCase();
  const venueName = (activity.venue_name || activity.restaurant?.name || '').toLowerCase();
  const combined = `${title} ${venueName}`;

  // Don't cap Michelin restaurants
  for (const key of Object.keys(KNOWN_FINE_DINING_STARS)) {
    if (title.includes(key) || venueName.includes(key)) return false;
  }

  const currentPrice = resolveActivityPrice(activity);
  if (currentPrice <= 0) return false;

  for (const { pattern, maxPrice } of CASUAL_VENUE_TYPE_PATTERNS) {
    if (pattern.test(combined) && currentPrice > maxPrice) {
      console.warn(`VENUE TYPE CAP [${logPrefix}]: "${activity.title}" at "${activity.venue_name || ''}" capped from €${currentPrice} to €${maxPrice} (venue type pattern)`);
      writePriceToAllFields(activity, maxPrice);
      return true;
    }
  }

  return false;
}

/** Resolve the effective price from all supported field shapes */
function resolveActivityPrice(activity: Record<string, any>): number {
  if (activity.cost && typeof activity.cost === 'object' && typeof activity.cost.amount === 'number') return activity.cost.amount;
  if (typeof activity.cost === 'number') return activity.cost;
  if (activity.estimatedCost && typeof activity.estimatedCost === 'object' && typeof activity.estimatedCost.amount === 'number') return activity.estimatedCost.amount;
  if (typeof activity.estimatedCost === 'number') return activity.estimatedCost;
  if (typeof activity.estimated_cost === 'number') return activity.estimated_cost;
  if (typeof activity.price_per_person === 'number') return activity.price_per_person;
  if (typeof activity.estimated_price_per_person === 'number') return activity.estimated_price_per_person;
  if (typeof activity.price === 'number') return activity.price;
  return 0;
}

// =============================================================================
// DATE SANITIZATION — Strip non-ASCII chars that leak from CJK locale prompts
// =============================================================================
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Sanitize a single date string: extract the YYYY-MM-DD portion and discard
 * any trailing garbage (e.g. Chinese characters like "控制").
 * Returns the cleaned date or the provided fallback.
 */
export function sanitizeDateString(raw: unknown, fallback?: string): string {
  if (typeof raw !== 'string') return fallback || '';
  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (match && DATE_REGEX.test(match[0])) return match[0];
  if (fallback && DATE_REGEX.test(fallback)) return fallback;
  console.warn(`[sanitizeDateString] Could not extract valid date from: "${raw}"`);
  return fallback || '';
}

/**
 * Strip isOption/optionGroup fields from AI response and deduplicate
 * activities that share an optionGroup (keep only the first per group).
 */
export function sanitizeOptionFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj.activities)) {
    const seenGroups = new Set<string>();
    obj.activities = obj.activities.filter((act: any) => {
      if (act && typeof act === 'object') {
        if (act.optionGroup) {
          if (seenGroups.has(act.optionGroup)) return false;
          seenGroups.add(act.optionGroup);
        }
        delete act.isOption;
        delete act.optionGroup;
      }
      return true;
    });
  }

  if (Array.isArray(obj.days)) {
    for (const day of obj.days) {
      sanitizeOptionFields(day);
    }
  }

  return obj;
}

/**
 * Strip action-verb prefixes from transit destination names.
 * E.g. "Return to Four Seasons" → "Four Seasons"
 */
export function sanitizeTransitDestination(name: string): string {
  if (!name) return name;
  return name
    .replace(/^Return\s+to\s+/i, '')
    .replace(/^Freshen\s+[Uu]p\s+at\s+/i, '')
    .replace(/^Check[\s-]?in\s+at\s+/i, '')
    .replace(/^Check[\s-]?out\s+(?:from|at)\s+/i, '')
    .replace(/^(?:Breakfast|Lunch|Dinner|Brunch|Nightcap|Supper)\s+at\s+/i, '')
    .replace(/^End\s+of\s+Day\s+at\s+/i, '')
    .replace(/^Settle\s+(?:in|into)\s+(?:at\s+)?/i, '')
    .replace(/^Wind\s+Down\s+at\s+/i, '')
    .replace(/^Rest\s+(?:&|and)\s+Recharge\s+at\s+/i, '')
    .trim();
}

// =============================================================================
// DEEP TEXT SANITIZATION — Strip CJK artifacts & schema-leak fragments
// =============================================================================
const CJK_ARTIFACTS = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F]+/g;
const TEXT_SCHEMA_LEAK = /[,;|]*\s*(?:title|name|duration|practicalTips|accommodationNotes|tripVibe|tripPriorities|theme|dayNumber|activities|unparsed|dates|travelers|tripType|startTime|endTime|category|description|location|tags|bookingRequired|transportation|cost|estimatedCost|metadata|narrative|highlights|city|country|isTransitionDay|type|slot|isVoyancePick|optionGroup|isOption)(?:\s*[:;|]\s*[^,;|]*)?/gi;
const SYSTEM_PREFIXES_RE = /\b(?:EDGE_ACTIVITY|SIGNATURE_MEAL|LINGER_BLOCK|WELLNESS_MOMENT|AUTHENTIC_ENCOUNTER|SOCIAL_EXPERIENCE|SOLO_RETREAT|DEEP_CONTEXT|SPLURGE_EXPERIENCE|VIP_EXPERIENCE|COUPLES_MOMENT|CONNECTIVITY_SPOT|FAMILY_ACTIVITY)\s*:?\s*/gi;
const AI_QUALIFIER_RE = /\s*\((?:[^)]*?\b(?:alternative|satellite|or\s+high.end|similar|equivalent|comparable)\b[^)]*?)\)/gi;
const TRAILING_OR_QUALIFIER_RE = /\s+or\s+(?:high.end|similar|equivalent|comparable)\b[^,.]*/gi;
const SLOT_PREFIX_RE = /^slot:\s*/i;
const FULFILLS_RE = /\.?\s*Fulfills the\s+[^.]*?(?:slot|requirement|block)\.\s*/gi;
const META_DISTANCE_COST_RE = /\((?:[^)]*?~\d+(?:\.\d+)?(?:km|mi|m)\b[^)]*?)\)/gi;
const INLINE_META_RE = /,?\s*~\d+(?:\.\d+)?(?:km|mi|m)\b,?\s*~?\$?\d+/gi;
const FORWARD_REF_RE = /\.?\s*(?:rest|recharge|prepare|get ready)\s+for\s+tomorrow'?s?\s+[^.]+(?:adventure|day|exploration|experience|excursion)[^.]*\.?/gi;
const TOMORROW_REF_RE = /\b(?:for |before )?tomorrow'?s?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:adventure|exploration|experience|excursion|day|visit)\b[^.]*/gi;

export function sanitizeAITextField(text: string | undefined | null, destination?: string): string {
  if (!text || typeof text !== 'string') return '';
  let result = text
    .replace(CJK_ARTIFACTS, '')
    .replace(TEXT_SCHEMA_LEAK, '')
    .replace(SYSTEM_PREFIXES_RE, '')
    .replace(AI_QUALIFIER_RE, '')
    .replace(TRAILING_OR_QUALIFIER_RE, '')
    .replace(SLOT_PREFIX_RE, '')
    .replace(FULFILLS_RE, ' ')
    .replace(META_DISTANCE_COST_RE, '')
    .replace(INLINE_META_RE, '')
    .replace(FORWARD_REF_RE, '')
    .replace(TOMORROW_REF_RE, '')
    // Strip parenthetical archetype labels: "(Deep Context)", "(Solo Retreat)", etc.
    .replace(/\s*\((?:Deep\s+Context|Solo\s+Retreat|Authentic\s+Encounter|Cultural\s+Highlight|Group\s+Activity|Hidden\s+Gem|Family\s+Stop|Romance\s+Stop|Luxury\s+Stop|Budget\s+Stop|Adventure\s+Stop|Wellness\s+Stop)\)\s*/gi, '')
    // Strip ALL-CAPS archetype labels with explanations: "(DEEP CONTEXT - Historical significance...)"
    .replace(/\s*\((?:DEEP\s+CONTEXT|SOLO\s+RETREAT|AUTHENTIC\s+ENCOUNTER|CULTURAL\s+HIGHLIGHT)\s*[-–—]?\s*[^)]*\)\s*/g, '')
    // Strip "(SOLO RETREAT moment)" and similar
    .replace(/\s*\(\s*(?:SOLO\s+RETREAT|DEEP\s+CONTEXT)\s+\w+\s*\)\s*/gi, '')
    // Strip archetype/category label suffixes: "Name: The Deep Context Stop"
    .replace(/\s*[:–—-]\s*(?:The\s+)?(?:Deep\s+Context|Solo\s+Retreat|Cultural\s+Highlight|Group\s+Activity|Wellness|Food|Shopping|Adventure|Family|Romance|Luxury|Budget|Hidden\s+Gem|Authentic\s+Encounter)(?:\s+Stop)?\s*$/gi, '')
    // Strip label as description prefix: "Solo Retreat: A peaceful..."
    .replace(/^(?:Solo\s+Retreat|Deep\s+Context|The\s+Deep\s+Context\s+Stop|Cultural\s+Highlight|Group\s+Activity|Authentic\s+Encounter|Wellness|Food\s+Stop|Hidden\s+Gem|Adventure|Shopping|Romance|Luxury|Budget)\s*:\s*/gi, '')
    // Catch remaining "... Stop" suffixed labels at end
    .replace(/\s*[:–—-]\s*(?:The\s+)?\w+(?:\s+\w+){0,2}\s+Stop\s*$/gi, '')
    // Strip ALL-CAPS "DISTRICT" from transit/location names
    .replace(/\s+DISTRICT\b/g, '')
    // Strip truncated orphan archetype fragments at start of descriptions
    // "A moment." / "An interest." / "A stop." etc.
    .replace(/^(?:A|An)\s+(?:moment|interest|stop|experience|encounter|retreat|highlight)\.\s*/gi, '')
    // Strip archetype labels in quotes within prose: "your 'Solo Retreat' moment" → ""
    .replace(/\b(?:your|a|an|the|this)\s+['"][A-Za-z\s]+['"]\s+(?:moment|stop|experience|encounter|highlight|retreat)\b\s*/gi, '')
    // Strip full "This is your/a 'Archetype' moment..." sentences
    .replace(/(?:^|\.\s*)This\s+is\s+(?:your|a|an)\s+['"]?(?:Solo\s+Retreat|Deep\s+Context|Authentic\s+Encounter|Cultural\s+Highlight|Hidden\s+Gem|Wellness|Romance|Adventure|Family|Budget|Luxury)['"]?\s+(?:moment|stop|experience|encounter)\b[^.]*\.?\s*/gi, '')
    // Strip "This is a stop/moment/experience focusing/centered/based on..." template language
    .replace(/(?:^|\.\s*)This\s+is\s+a\s+(?:stop|moment|experience)\s+(?:focusing|centered|based)\s+on\s+/gi, '')
    // Strip internal day title prefixes: "Short Trip Berlin Day 3:" etc.
    .replace(/^(?:Short\s+Trip|City\s+Trip|Long\s+Trip|Weekend\s+Trip|Extended\s+Trip)\s+\w+(?:\s+\w+)*\s+Day\s+\d+\s*[:–—-]\s*/i, '')
    // Strip bare "Day N:" prefix
    .replace(/^Day\s+\d+\s*[:–—-]\s*/i, '')
    .replace(/\b(?:BOOK|RESERVE|SECURE)\s+\d[\d-]*\s*(?:WEEKS?|MONTHS?|DAYS?)\s*(?:AHEAD|IN ADVANCE|BEFORE|OUT|EARLY)?\b/gi, '')
    .replace(/[🔴🟡🟢🔵]\s*(?:Book|Reserve|BOOK|RESERVE)[^.]*\.?\s*/g, '')
    .replace(/\b(?:book_now|book_soon|book_early|reserve_early|reserve_now)\b/gi, '')
    .replace(/(?:^|\.\s*)\s*(?:Reservation\s*)?[Uu]rgency[:\s]+\w+\.?\s*/gi, '')
    .replace(/\b(?:BOOK|RESERVE|SECURE)\s+(?:ASAP|IMMEDIATELY|NOW|IN ADVANCE|WELL AHEAD|EARLY)\b/gi, '')
    .replace(/\b(?:Advance|advance)\s+(?:booking|reservation)\s+(?:required|recommended|essential|necessary)\b/gi, '')
    // AI self-referential commentary
    .replace(/(?:^|\.\s*)This\s+(?:addresses|fulfills|satisfies|aligns with|caters to|speaks to|reflects)\s+(?:the|your|their)\s+\w+\s+(?:interest|preference|request|need|requirement)\b[^.]*\.?/gi, '')
    // "Since the traveler/user/guest loves/prefers..." reasoning sentences
    .replace(/(?:^|\.\s*)Since\s+(?:the|this|your)\s+(?:traveler|user|guest|visitor|group)\s+[^.]*\./gi, '')
    // Parenthetical notes containing AI-indicator language (broad catch-all)
    .replace(/\s*\((?:Note|NB|Scheduled|Adjusted|Adjusting|Selected|Chosen|Added|Included|Placed|Moved|Reason|Context|Rationale|Per|As per|Based on|Due to|Reflecting|To reflect|To match|To align|To satisfy|To address|This is a|This serves|This provides|This fulfills)\b[^)]*\)/gi, '')
    // Parenthetical notes referencing user preferences/interests/system terms
    .replace(/\s*\([^)]*(?:user's|user preference|archetype|arche\b|interest\b|hard block|soft block|constraint|slot\s+logic|post-process|as per)\b[^)]*\)/gi, '')
    // "providing/offering a necessary bridge/transition/balance between..."
    .replace(/,?\s*providing\s+a\s+(?:necessary|needed|important|useful|natural)\s+(?:bridge|transition|balance|buffer|counterpoint)\s+[^.]*\.?/gi, '')
    // "This focuses on/ensures/provides/creates..." meta-commentary
    .replace(/(?:^|\.\s*)This\s+(?:focuses on|ensures|provides|creates|offers|gives|delivers|serves as)\s+[^.]*\.?/gi, '')
    // Any sentence mentioning internal system terms
    .replace(/(?:^|\.\s*)[^.]*\b(?:archetype|hard\s+block|soft\s+block|generation\s+rule|as per arche)\b[^.]*\.?/gi, '')
    // Strip "Voyance Pick" / "Hotel Pick" and variant internal labels
    .replace(/\s*(?:Voyance\s+(?:Pick|Recommendation|Choice)|Hotel\s+Pick|Staff\s+Pick)\s*/gi, '')
    // Strip any Voyance branding text that leaks into descriptions
    .replace(/\s*(?:Thank you for (?:choosing|using) Voyance|Powered by Voyance|Generated by Voyance|Voyance recommends|A Voyance recommendation|Curated by Voyance|Brought to you by Voyance)\.?\s*/gi, '')
    // Catch any sentence containing "choosing/using/by Voyance"
    .replace(/[^.]*\b(?:choosing|using|by)\s+Voyance\b[^.]*\.?\s*/gi, '')
    // Strip ALL variants of "check/confirm/verify hours/opening times" notes
    .replace(/\s*[-–—]\s*(?:we\s+)?(?:recommend\s+)?(?:check|confirm|verify|confirming|checking|verifying)\s+(?:the\s+)?(?:opening\s+)?(?:hours|times)\b[^.]*\.?\s*/gi, '')
    // Strip "Popular/A local favorite - check/confirm..." combined sentences
    .replace(/(?:^|\.\s*)(?:Popular|A local favorite)\s*(?:with locals\s*)?[-–—]\s*(?:check|confirm|we recommend)[^.]*\.?\s*/gi, '')
    // Strip any sentence containing both confirm/check/verify AND hours/times AND visit/before
    .replace(/\s*[-–—]?\s*[^.]*\b(?:confirm|check|verify)\b[^.]*\b(?:hours|times)\b[^.]*\b(?:visit|before)\b[^.]*\.?\s*/gi, '')
    // Strip sourced/verified from venue database
    .replace(/(?:^|[.]\s*)(?:Recommended|Sourced|Verified|Confirmed)\s+(?:by|from|via)\s+(?:our|the)\s+(?:venue|restaurant|local)\s+database[^.]*\.?\s*/gi, '')
    // Strip "Popular with locals" and similar database stub phrases when embedded inline
    .replace(/\s*[-–—]\s*(?:Popular with locals|A local favou?rite|Great for (?:families|groups|couples)|Tourist (?:hotspot|favorite)|Hidden gem|Must[- ]visit|Highly recommended|Local institution)\.?\s*/gi, '')
    // Strip garbled hyphenated suffixes (archetype/mood tag leakage)
    // Known wellness/mood tags
    .replace(/\s+(?:maternal-retreat|self-care|mind-body|soul-search|inner-peace|life-hack|well-being|self-help|mind-set|heart-felt|culture-deep-dive|culture-immersion|food-journey|art-walk|nature-escape)\s*$/i, (m) => { console.warn(`GARBLED SUFFIX REMOVED: "${m.trim()}"`); return ''; })
    // General pattern: trailing hyphenated word ending in common AI tag suffixes
    .replace(/\s+[a-z]+-(?:retreat|journey|quest|path|way|mode|state|zone|vibe|flow|core|soul|self|mind|life|hack|tip|fix|dive|escape|immersion|walk)\s*$/i, (m) => { console.warn(`GARBLED SUFFIX REMOVED: "${m.trim()}"`); return ''; })
    // Category/tag leakage: trailing "category-xxx", "type-xxx", etc.
    .replace(/\s+(?:category|type|mode|style|class|kind|sort|form|variant|version)[-:]\w+\s*$/i, (m) => { console.warn(`GARBLED SUFFIX REMOVED: "${m.trim()}"`); return ''; })
    // Deduplicate consecutive repeated words: "Pantheon Pantheon" → "Pantheon"
    .replace(/\b(\w{3,})\s+\1\b/gi, '$1')
    // Catch comma-prefixed schema field names at end of text
    .replace(/,\s*(?:type|category|slot|isVoyancePick|optionGroup|isOption|tags|bookingRequired)\b[^,.]*/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,;|:\s-]+|[,;|:\s-]+$/g, '');

  // Replace generic "the destination" with actual city name
  if (destination) {
    result = result.replace(/\b(?:the destination|the city|this destination|this city)\b/gi, destination);

    // Fix orphaned articles where city name was dropped
    // "the's" → "Lisbon's"
    result = result.replace(/\bthe's\b/gi, destination + "'s");

    // "in the of [Noun]" title pattern → "in Lisbon, the City of [Noun]"
    // ", the of [Noun]" → ", the City of [Noun]" (comma-prefixed variant)
    result = result.replace(/,\s*the\s+of\b/gi, ', the City of');
    // "in the of [Noun]" → "in Lisbon, the City of [Noun]"
    result = result.replace(/\bin the of\b/gi, 'in ' + destination + ', the City of');

    // "in the." / "to the." / "of the!" / "of the?" — orphaned article before sentence-end punctuation
    result = result.replace(/\b(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near)\s+the([.!?])\s*/gi, '$1 ' + destination + '$2 ');

    // "of the," / "to the;" — orphaned article before comma/semicolon
    result = result.replace(/\b(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near)\s+the([,;]\s)/gi, '$1 ' + destination + '$2');

    // "the [adjective]." — dangling adjective before period (e.g. "the illuminated.")
    result = result.replace(/\b(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near)\s+the\s+(\w+(?:ed|ful|ous|ic|al|ive|ant|ent))\.\s*/gi, '$1 ' + destination + "'s $2 landscape. ");

    // "to the of" / "of the at" / "of the and" — orphaned article before following preposition/connector
    result = result.replace(/\b(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near)\s+the\s+(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near|and|or|but|at|with|by|on|where|while|this|that|a|an)\b/gi, '$1 ' + destination + ' $2');

    // "in the" at end of string
    result = result.replace(/\b(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near)\s+the$/gi, '$1 ' + destination);
  }

  return result.trim();
}

/**
 * Remove duplicated postal-code+city or city-name segments from addresses.
 */
function sanitizeAddress(address: string): string {
  if (!address) return address;
  let result = address.replace(
    /(\d{4,5}[-\s]?\d{3}\s+[A-Za-zÀ-ÿ\s]+),\s*\1/g,
    '$1'
  );
  result = result.replace(
    /\b([A-Za-zÀ-ÿ]{3,}),\s*\1\b/g,
    '$1'
  );
  return result;
}

// MEAL-TYPE LEAKAGE IN VENUE NAMES
// The AI sometimes appends meal categories to venue names
// e.g., "Pavilhão Carlos Lopes Breakfast", "Cervejaria Ramiro Dinner"
const MEAL_TYPE_SUFFIX_RE = /\s+(?:Breakfast|Lunch|Dinner|Brunch|Supper|Dessert|Snack)\s*$/i;

function cleanVenueNameMealLeakage(name: string): string {
  if (!name || !MEAL_TYPE_SUFFIX_RE.test(name)) return name;
  const cleaned = name.replace(MEAL_TYPE_SUFFIX_RE, '').trim();
  // Don't strip if it would leave a very short name (likely part of real name, e.g. "Dear Breakfast")
  if (cleaned.length < 3) return name;
  console.warn(`VENUE NAME LEAKAGE FIX: "${name}" → "${cleaned}"`);
  return cleaned;
}

// =============================================================================
// GARBLED VENUE NAME DETECTION & REPAIR
// =============================================================================

/** Words that should never appear in a venue name — indicate AI word substitution */
const GARBLED_VENUE_WORDS_RE = /\b(?:Alphabetical|Sequential|Numerical|Categorical|Grammatical|Chronological|Geographical|Metaphorical|Hypothetical|Rhetorical|Theological|Philosophical|Symmetrical|Analytical|Botanical)\b/i;

/**
 * Detect if a venue name contains known garbled English adjectives
 * that the AI substituted for proper nouns.
 */
function detectGarbledVenueWords(venueName: string): boolean {
  return GARBLED_VENUE_WORDS_RE.test(venueName);
}

/**
 * Extract a location/place name from an activity title.
 * Patterns: "through X District", "in X", "at X", "of X", "around X"
 */
function extractLocationFromTitle(title: string): string | null {
  if (!title) return null;
  const patterns = [
    /\bthrough\s+(.+?)\s+District\b/i,
    /\bin\s+(.+?)\s+District\b/i,
    /\baround\s+(.+?)\s+District\b/i,
    /\bof\s+(.+?)\s+District\b/i,
    /\bthrough\s+([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)*)\b/,
    /\bin\s+([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)*)\b/,
    /\bat\s+([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)*)\b/,
  ];
  for (const p of patterns) {
    const m = title.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * Cross-validate venue_name against the activity title.
 * If the venue_name references a district/walk/stroll but uses a garbled word
 * where the title has the correct location, fix it.
 */
function validateVenueNameConsistency(title: string, venueName: string): string {
  if (!title || !venueName) return venueName;

  const titleLocation = extractLocationFromTitle(title);
  if (!titleLocation) return venueName;

  // Check if venue_name has context words (District, Walk, Stroll, Tour, Heritage)
  // but does NOT contain the location from the title
  if (/\b(?:District|Walk|Stroll|Tour|Heritage|Historic|Quarter)\b/i.test(venueName) &&
      !venueName.includes(titleLocation)) {
    // Try to find the garbled word and replace it
    const venuePatterns = [
      /^(\w+)\s+(Heritage|Historic|District|Walk|Stroll|Quarter)/i,
      /\bthrough\s+(\w+)\s+District\b/i,
      /\bin\s+(\w+)\s+District\b/i,
      /^(\w+)\s+District\b/i,
    ];
    for (const vp of venuePatterns) {
      const vm = venueName.match(vp);
      if (vm) {
        const garbledWord = vm[1];
        if (garbledWord.toLowerCase() !== titleLocation.toLowerCase()) {
          const fixed = venueName.replace(garbledWord, titleLocation);
          console.warn(`GARBLED VENUE NAME FIX: "${venueName}" → "${fixed}" (matched title location "${titleLocation}")`);
          return fixed;
        }
      }
    }
  }

  return venueName;
}

/**
 * Deep-sanitize all user-facing text fields in a generated day object.
 * @param usedRestaurants - Optional list of restaurant names used on previous days for repeat detection.
 */
export function sanitizeGeneratedDay(day: any, dayNumber: number, destination?: string, usedRestaurants?: string[]): any {
  if (!day || typeof day !== 'object') return day;

  const cleanTitle = sanitizeAITextField(day.title, destination);
  const cleanTheme = sanitizeAITextField(day.theme, destination);
  day.title = cleanTitle || cleanTheme || `Day ${dayNumber}`;
  day.theme = cleanTheme || cleanTitle || day.title;

  // Garbled day title detection and cleanup
  const GARBLED_TITLE_PATTERNS = [
    /\bthe\s+of\b/i,
    /\ba\s+of\b/i,
    /\ban\s+of\b/i,
    /\s{2,}/,
    /,\s*$/,
    /^,/,
  ];
  const titleToCheck = day.title;
  for (const p of GARBLED_TITLE_PATTERNS) {
    if (p.test(titleToCheck)) {
      console.warn(`GARBLED DAY TITLE: "${titleToCheck}" matched ${p}`);
      break;
    }
  }
  day.title = day.title.replace(/\s{2,}/g, ' ').replace(/,\s*$/, '').replace(/^,\s*/, '').trim();

  if (day.name) {
    day.name = sanitizeAITextField(day.name, destination);
  }

  if (day.narrative && typeof day.narrative === 'object') {
    if (day.narrative.theme) day.narrative.theme = sanitizeAITextField(day.narrative.theme, destination) || day.theme;
    if (Array.isArray(day.narrative.highlights)) {
      day.narrative.highlights = day.narrative.highlights
        .map((h: string) => sanitizeAITextField(h, destination))
        .filter((h: string) => h.length > 0);
    }
  }

  if (Array.isArray(day.accommodationNotes)) {
    day.accommodationNotes = day.accommodationNotes
      .map((n: string) => sanitizeAITextField(n, destination))
      .filter((n: string) => n.length > 0);
  }
  if (Array.isArray(day.practicalTips)) {
    day.practicalTips = day.practicalTips
      .map((t: string) => sanitizeAITextField(t, destination))
      .filter((t: string) => t.length > 0);
  }

  if (Array.isArray(day.activities)) {
    day.activities = day.activities.map((act: any, idx: number) => {
      if (!act || typeof act !== 'object') return act;
      const cleanActTitle = sanitizeAITextField(act.title, destination);
      const cleanActName = sanitizeAITextField(act.name, destination);
      act.title = cleanActTitle || cleanActName || `Activity ${idx + 1}`;
      act.name = act.title;
      if (act.description) act.description = sanitizeAITextField(act.description, destination) || undefined;
      if (typeof act.tips === 'string') act.tips = sanitizeAITextField(act.tips, destination) || undefined;
      if (act.location && typeof act.location === 'object') {
        if (act.location.name) act.location.name = sanitizeAddress(sanitizeAITextField(act.location.name, destination) || act.location.name);
        if (act.location.address) act.location.address = sanitizeAddress(sanitizeAITextField(act.location.address, destination) || act.location.address);
      }
      if (act.venue_address) act.venue_address = sanitizeAddress(act.venue_address);
      if (act.venue_name) {
        act.venue_name = cleanVenueNameMealLeakage(act.venue_name);
        act.venue_name = validateVenueNameConsistency(act.title, act.venue_name);
        if (detectGarbledVenueWords(act.venue_name)) {
          const titleLoc = extractLocationFromTitle(act.title);
          if (titleLoc) {
            console.warn(`GARBLED VENUE WORD DETECTED: "${act.venue_name}" — falling back to title location "${titleLoc}"`);
            act.venue_name = titleLoc;
          } else {
            console.warn(`GARBLED VENUE WORD DETECTED: "${act.venue_name}" — no title location available`);
          }
        }
      }
      if (act.restaurant?.name) {
        act.restaurant.name = cleanVenueNameMealLeakage(act.restaurant.name);
        act.restaurant.name = validateVenueNameConsistency(act.title, act.restaurant.name);
        if (detectGarbledVenueWords(act.restaurant.name)) {
          const titleLoc = extractLocationFromTitle(act.title);
          if (titleLoc) {
            console.warn(`GARBLED VENUE WORD DETECTED (restaurant.name): "${act.restaurant.name}" — falling back to "${titleLoc}"`);
            act.restaurant.name = titleLoc;
          }
        }
      }
      if (act.transportation && typeof act.transportation === 'object') {
        if (act.transportation.instructions) act.transportation.instructions = sanitizeAITextField(act.transportation.instructions, destination) || undefined;
        const method = (act.transportation.method || '').toLowerCase();
        if (method === 'walk' || method === 'walking') {
          act.transportation.estimatedCost = { amount: 0, currency: act.transportation.estimatedCost?.currency || 'USD' };
        }
      }
      if (act.voyanceInsight) act.voyanceInsight = sanitizeAITextField(act.voyanceInsight, destination) || undefined;
      if (act.bestTime) act.bestTime = sanitizeAITextField(act.bestTime, destination) || undefined;
      if (act.personalization && typeof act.personalization === 'object') {
        if (act.personalization.whyThisFits) act.personalization.whyThisFits = sanitizeAITextField(act.personalization.whyThisFits, destination) || undefined;
      }
      // Safety net: clean transit titles that include embedded action verbs
      // Use title pattern instead of category to catch all transit entries
      const TRANSIT_TITLE_RE = /^(?:Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+/i;
      if (act.title && TRANSIT_TITLE_RE.test(act.title)) {
        act.title = act.title
          .replace(/^Travel\s+to\s+(Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry|Uber)\s+to\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Return\s+to\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Freshen\s+[Uu]p\s+at\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Check[\s-]?in\s+at\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Check[\s-]?out\s+(?:from|at)\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+(?:Breakfast|Lunch|Dinner|Brunch|Nightcap|Supper)\s+at\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+End\s+of\s+Day\s+at\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Settle\s+(?:in|into)\s+(?:at\s+)?/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Wind\s+Down\s+at\s+/i, '$1 to ')
          .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Rest\s+(?:&|and)\s+Recharge\s+at\s+/i, '$1 to ');
        // Strip trailing meal-type from transit destinations (e.g. "Travel to Pavilhão Carlos Lopes Breakfast")
        act.title = act.title.replace(/^((?:Travel|Walk|Metro|Bus|Tram|Taxi|Train|Drive|Ride|Ferry)\s+to\s+.+?)\s+(?:Breakfast|Lunch|Dinner|Brunch)\s*$/i, '$1');
        act.name = act.title;
      }
      // Helper: resolve effective cost from whichever field the AI populated
      const effectiveCost =
        (act.cost && typeof act.cost === 'object' ? act.cost.amount : 0) ||
        (act.estimatedCost && typeof act.estimatedCost === 'object' ? act.estimatedCost.amount : 0) ||
        (act as any).estimated_price_per_person ||
        (act as any).price ||
        0;
      const effectiveCurrency =
        (act.cost && typeof act.cost === 'object' ? act.cost.currency : null) ||
        (act.estimatedCost && typeof act.estimatedCost === 'object' ? act.estimatedCost.currency : null) ||
        'USD';

      // Helper: zero ALL cost fields on the activity
      const zeroAllCostFields = () => {
        act.cost = { amount: 0, currency: effectiveCurrency };
        if (act.estimatedCost) act.estimatedCost = { amount: 0, currency: effectiveCurrency };
        if ((act as any).estimated_price_per_person !== undefined) (act as any).estimated_price_per_person = 0;
        if ((act as any).price !== undefined) (act as any).price = 0;
      };

      // Always-free activities: arrivals, departures, hotel logistics
      const alwaysFreeActivity = /\b(?:arrival|departure|check[\s-]?in|check[\s-]?out|return\s+to|freshen\s+up|settle\s+in)\b/i;
      if (alwaysFreeActivity.test(act.title || '') && effectiveCost > 0) {
        console.log(`[sanitize] Zeroed cost on always-free activity: ${act.title}`);
        zeroAllCostFields();
      }

      // Zero out pricing for obviously free activity types — uses shared helper
      checkAndApplyFreeVenue(act as any, 'sanitize');

      // Restore pricing for known ticketed attractions incorrectly zeroed
      enforceTicketedAttractionPricing(act as any, 'SANITIZE');

      // ---- Dining underpricing floor ----
      const isDining = /dining|restaurant|breakfast|lunch|dinner|brunch/i.test((act.category || '') + ' ' + (act.title || ''));
      if (isDining) {
        // Resolve current cost from all possible field shapes
        const currentCost = (() => {
          if (act.cost && typeof act.cost === 'object' && typeof act.cost.amount === 'number') return act.cost.amount;
          if (typeof act.cost === 'number') return act.cost;
          if (act.estimatedCost && typeof act.estimatedCost === 'object' && typeof act.estimatedCost.amount === 'number') return act.estimatedCost.amount;
          if (typeof act.estimatedCost === 'number') return act.estimatedCost;
          if (typeof (act as any).price_per_person === 'number') return (act as any).price_per_person;
          if (typeof (act as any).estimated_price_per_person === 'number') return (act as any).estimated_price_per_person;
          if (typeof (act as any).price === 'number') return (act as any).price;
          return 0;
        })();

        if (currentCost > 0) {
        const combined = ((act.title || '') + ' ' + (act.venue_name || '') + ' ' + (act.description || '') + ' ' + ((act as any).restaurant?.name || '') + ' ' + ((act as any).restaurant?.description || '')).toLowerCase();
        let floor = 0;
        let reason = '';

        // Michelin / fine dining indicators — raised per-star minimums
        if (/michelin\s*3|3[\s-]*star/i.test(combined)) {
          floor = 250; reason = 'Michelin 3-star';
        } else if (/michelin\s*2|2[\s-]*star/i.test(combined)) {
          floor = 180; reason = 'Michelin 2-star';
        } else if (/michelin\s*1|1[\s-]*star|michelin[\s-]*starred/i.test(combined)) {
          floor = 120; reason = 'Michelin 1-star';
        } else if (/tasting menu|fine dining|haute cuisine|degustation|omakase/i.test(combined)) {
          floor = 120; reason = 'Fine dining / tasting menu';
        }

        // Known Michelin-starred / fine dining — use shared constants
        if (floor < MICHELIN_FLOOR.high && KNOWN_MICHELIN_HIGH.test(combined)) {
          floor = MICHELIN_FLOOR.high; reason = 'Known top-tier Michelin restaurant';
        } else if (floor < MICHELIN_FLOOR.mid && KNOWN_MICHELIN_MID.test(combined)) {
          floor = MICHELIN_FLOOR.mid; reason = 'Known Michelin-starred restaurant';
        } else if (floor < MICHELIN_FLOOR.upscale && KNOWN_UPSCALE.test(combined)) {
          floor = MICHELIN_FLOOR.upscale; reason = 'Known upscale restaurant';
        }

        // Famous seafood
        if (floor < 40 && /\b(cervejaria|marisqueira|marisquer[ií]a|seafood house)\b/i.test(combined)) {
          floor = 40; reason = 'Famous seafood restaurant';
        }

        // Generic dinner floor
        if (floor < 15 && /dinner/i.test(act.title || '') && currentCost < 15) {
          floor = 15; reason = 'Dinner at named restaurant';
        }

        if (floor > 0 && currentCost < floor) {
          console.warn(`[UNDERPRICED] "${act.title}" at ${currentCost}/pp → corrected to ${floor}/pp (${reason})`);
          // Write floor to all cost field shapes present on the activity
          if (act.cost && typeof act.cost === 'object') act.cost.amount = floor;
          else act.cost = { amount: floor, currency: effectiveCurrency };
          if (act.estimatedCost && typeof act.estimatedCost === 'object') act.estimatedCost.amount = floor;
          else if (typeof act.estimatedCost === 'number') act.estimatedCost = floor;
          if ((act as any).price_per_person !== undefined) (act as any).price_per_person = floor;
          if ((act as any).estimated_price_per_person !== undefined) (act as any).estimated_price_per_person = floor;
          if ((act as any).price !== undefined) (act as any).price = floor;
        }
        }
      }

      return act;
    });
  }

  // Clean meal-type leakage from travel routing destinations
  if (Array.isArray(day.travelRouting)) {
    day.travelRouting.forEach((route: any) => {
      if (route.destination) route.destination = cleanVenueNameMealLeakage(route.destination);
      if (route.to) route.to = cleanVenueNameMealLeakage(route.to);
    });
  }

  // ---- Meal time validation: fix misplaced meals ----
  if (day.activities && Array.isArray(day.activities)) {
    for (const act of day.activities) {
      const titleLower = (act.title || '').toLowerCase();
      const categoryLower = (act.category || '').toLowerCase();
      const hour = parseInt((act.startTime || '00:00').split(':')[0], 10);

      if ((titleLower.includes('lunch') || categoryLower === 'lunch') && hour >= 17) {
        act.startTime = '12:30';
        act.endTime = '13:30';
      } else if ((titleLower.includes('breakfast') || categoryLower === 'breakfast') && hour >= 14) {
        act.startTime = '08:00';
        act.endTime = '09:00';
      } else if ((titleLower.includes('dinner') || categoryLower === 'dinner') && hour < 11) {
        act.startTime = '19:00';
        act.endTime = '20:15';
      }
    }

    // Re-sort activities chronologically after meal time corrections
    day.activities.sort((a: any, b: any) => {
      const tA = a.startTime || '00:00';
      const tB = b.startTime || '00:00';
      return tA.localeCompare(tB);
    });
  }

  // ---- Evening fine-dining deduplication ----
  // Prevent two fine dining / Michelin restaurants in the same evening
  if (day.activities && Array.isArray(day.activities)) {
    const eveningFineDining: { index: number; price: number; title: string }[] = [];

    day.activities.forEach((activity: any, index: number) => {
      const timeStr = activity.startTime || activity.start_time || activity.time || '';
      const hour = parseInt((timeStr || '12:00').split(':')[0], 10);
      if (isNaN(hour) || hour < 18) return; // only evening (6 PM+)

      const title = (activity.title || '').toLowerCase();
      const category = (activity.category || '').toUpperCase();

      // Resolve price from all field shapes
      let price = 0;
      if (activity.cost && typeof activity.cost === 'object' && typeof activity.cost.amount === 'number') price = activity.cost.amount;
      else if (typeof activity.cost === 'number') price = activity.cost;
      else if (typeof activity.price_per_person === 'number') price = activity.price_per_person;
      else if (typeof activity.estimated_price_per_person === 'number') price = activity.estimated_price_per_person;

      const isFineDining =
        (category === 'DINING' || /dining|restaurant|dinner/i.test(category)) &&
        (activity.booking_required ||
         price >= 80 ||
         /\b(michelin|tasting|fine dining|starred)\b/i.test(title));

      if (isFineDining) {
        eveningFineDining.push({ index, price, title: activity.title || '' });
      }
    });

    if (eveningFineDining.length >= 2) {
      console.warn(`DOUBLE FINE DINING: Found ${eveningFineDining.length} fine dining activities in evening: ${eveningFineDining.map(f => `"${f.title}" €${f.price}`).join(', ')}. Keeping most expensive.`);

      // Sort by price descending — keep the first (most expensive)
      eveningFineDining.sort((a, b) => b.price - a.price);
      const indicesToRemove = new Set(eveningFineDining.slice(1).map(f => f.index));

      day.activities = day.activities.filter((_: any, index: number) => !indicesToRemove.has(index));
    }
  }


  // These are spillover from the previous day or AI hallucinations (e.g. "Return to Hotel" at 12:05 AM on Day 1)
  // Strategy: walk from the start, removing pre-dawn (00:00-04:59) hotel entries until we hit a real activity
  if (day.activities.length > 0) {
    const HOTEL_TITLE_RE = /\b(?:return to|check.?in|check.?out|hotel|freshen up|rest and refresh|retire|settle|wind down|end.?of.?day|back to)\b/i;
    let stripCount = 0;
    day.activities = day.activities.filter((activity: any) => {
      // Once we've found a real activity, keep everything after it
      if (stripCount === -1) return true;

      const timeStr = activity.startTime || activity.start_time || activity.time || '';
      const hour = parseInt((timeStr || '12:00').split(':')[0], 10);
      const isMidnightHour = !isNaN(hour) && hour >= 0 && hour < 5;

      if (!isMidnightHour) {
        stripCount = -1; // Mark: done stripping
        return true;
      }

      const title = (activity.title || activity.name || '').toLowerCase();
      const cat = (activity.category || '').toLowerCase();
      const type = (activity.type || '').toLowerCase();
      const isHotelEntry = HOTEL_TITLE_RE.test(title) || cat === 'accommodation' || cat === 'stay' || type === 'stay';

      if (isHotelEntry) {
        console.warn(`[sanitizeGeneratedDay] MIDNIGHT ENTRY REMOVED from day ${dayNumber}: "${activity.title}" at ${timeStr}`);
        stripCount++;
        return false;
      }

      // Pre-dawn but NOT hotel-related — stop stripping, keep this and everything after
      stripCount = -1;
      return true;
    });
  }

  // Deduplicate consecutive hotel return activities (e.g., two back-to-back "Return to Four Seasons Ritz")
  if (day.activities && day.activities.length >= 2) {
    const HOTEL_RETURN_RE = /\b(return to|retire to|back to|freshen up|settle in)\b/i;
    const indicesToRemove: number[] = [];

    for (let i = 1; i < day.activities.length; i++) {
      const prev = day.activities[i - 1];
      const curr = day.activities[i];

      const prevCat = (prev.category || '').toLowerCase();
      const currCat = (curr.category || '').toLowerCase();
      const stayCategories = ['stay', 'accommodation', 'hotel'];

      if (!stayCategories.includes(prevCat) || !stayCategories.includes(currCat)) continue;

      const prevTitle = (prev.title || prev.name || '').toLowerCase();
      const currTitle = (curr.title || curr.name || '').toLowerCase();

      if (HOTEL_RETURN_RE.test(prevTitle) && HOTEL_RETURN_RE.test(currTitle)) {
        const prevVenue = (prev.venue_name || '').toLowerCase();
        const currVenue = (curr.venue_name || '').toLowerCase();
        const sameHotel = prevVenue && currVenue && prevVenue === currVenue;
        const sameTitle = prevTitle === currTitle;

        if (sameHotel || sameTitle) {
          console.warn(`[sanitizeGeneratedDay] DUPLICATE HOTEL RETURN: Removing duplicate "${curr.title}" at index ${i} on day ${dayNumber}. Previous "${prev.title}" already covers this.`);
          indicesToRemove.push(i);
        }
      }
    }

    if (indicesToRemove.length > 0) {
      day.activities = day.activities.filter((_: unknown, idx: number) => !indicesToRemove.includes(idx));
    }
  }

  // Fix hotel name mismatches in "Return to" entries
  for (const act of day.activities) {
    if (/^Return to /i.test(act.title || '') && act.venue_name) {
      const titleHotel = (act.title || '').replace(/^Return to /i, '').trim();
      if (titleHotel !== act.venue_name && act.venue_name.length > 0) {
        act.title = 'Return to ' + act.venue_name;
        act.name = act.title;
      }
    }
  }

  // Detect and clear stub descriptions that are just database descriptor notes
  const STUB_DESC_RE = /^(?:Popular with locals|A local favou?rite|Great for (?:families|groups|couples)|Tourist (?:hotspot|favorite)|Well[- ]known (?:locally|spot)|Hidden gem|Must[- ]visit|Highly recommended|A must[- ]try|Local institution|Neighborhood favou?rite|A true gem|Worth (?:a|the) visit)\.?$/i;

  // Inline regex for stripping stub phrases embedded in longer text
  const STUB_INLINE_RE = /\s*[-–—]?\s*(?:Popular with locals|A local favou?rite|Great for (?:families|groups|couples)|Tourist (?:hotspot|favorite)|Well[- ]known (?:locally|spot)|Hidden gem|Must[- ]visit|Highly recommended|A must[- ]try|Local institution|Neighborhood favou?rite|A true gem|Worth (?:a|the) visit)\.?\s*/gi;

  /** Strip stub text from a string: clear if entire value is stub, else strip inline */
  function stripStubField(val: string | undefined | null): string {
    if (!val) return '';
    const trimmed = val.trim();
    if (trimmed.length > 0 && trimmed.length < 80 && STUB_DESC_RE.test(trimmed)) return '';
    return val.replace(STUB_INLINE_RE, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  if (day.activities) {
    for (const act of day.activities) {
      // Debug: log which field contains the stub text
      const actJson = JSON.stringify(act);
      if (/popular with locals/i.test(actJson)) {
        console.warn(`[STUB_DEBUG] "Popular with locals" found in activity "${act.title}". Keys with match:`,
          Object.keys(act).filter(k => typeof (act as any)[k] === 'string' && /popular with locals/i.test((act as any)[k])));
      }

      // Walk all top-level string properties
      for (const key of Object.keys(act)) {
        if (typeof (act as any)[key] === 'string') {
          (act as any)[key] = stripStubField((act as any)[key]);
        }
      }

      // Walk nested objects: restaurant, venue, place
      for (const nestedKey of ['restaurant', 'venue', 'place']) {
        const nested = (act as any)[nestedKey];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          for (const key of Object.keys(nested)) {
            if (typeof nested[key] === 'string') {
              nested[key] = stripStubField(nested[key]);
            }
          }
        }
      }
    }
  }

  // ── City-mismatch detection: flag restaurants with addresses outside destination ──
  if (destination && day.activities) {
    const dest = destination.toLowerCase().trim();
    const cityGroups: Record<string, string[]> = {
      portugal: ['lisbon', 'lisboa', 'porto', 'faro', 'algarve', 'coimbra', 'braga', 'funchal', 'sintra', 'cascais', 'estoril', 'albufeira', 'alporchinhos', 'portimão', 'portimao'],
      italy: ['rome', 'roma', 'milan', 'milano', 'florence', 'firenze', 'venice', 'venezia', 'naples', 'napoli', 'turin', 'torino', 'bologna', 'palermo'],
      spain: ['madrid', 'barcelona', 'seville', 'sevilla', 'valencia', 'malaga', 'bilbao', 'granada'],
      france: ['paris', 'lyon', 'marseille', 'nice', 'bordeaux', 'toulouse', 'strasbourg'],
      germany: ['berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln', 'düsseldorf'],
      uk: ['london', 'edinburgh', 'manchester', 'birmingham', 'glasgow', 'liverpool'],
      japan: ['tokyo', 'kyoto', 'osaka', 'hiroshima', 'yokohama', 'nara', 'fukuoka', 'sapporo'],
    };

    let otherCities: string[] = [];
    for (const cities of Object.values(cityGroups)) {
      if (cities.some(c => dest.includes(c) || c.includes(dest))) {
        otherCities = cities.filter(c => !dest.includes(c) && !c.includes(dest));
        break;
      }
    }

    if (otherCities.length > 0) {
      for (const act of day.activities) {
        const address = ((act.address || (act.location as any)?.address || '') as string).toLowerCase();
        if (!address) continue;

        const mentionsOther = otherCities.some(c => address.includes(c));
        const mentionsDest = address.includes(dest) ||
          (dest === 'lisbon' && address.includes('lisboa')) ||
          (dest === 'lisboa' && address.includes('lisbon'));

        if (mentionsOther && !mentionsDest) {
          console.warn(`[sanitize] Restaurant "${act.title}" address mentions another city: ${address}`);
          if (act.cost && typeof act.cost === 'object') {
            (act.cost as any).amount = 0;
          }
        }
      }
    }
  }

  // ── HARD Post-generation restaurant repeat removal ──
  if (usedRestaurants && usedRestaurants.length > 0 && day.activities) {
    const usedNormalized = new Set(usedRestaurants.map(n => extractRestaurantVenueName(n)));
    const DINING_RE = /\b(?:breakfast|brunch|lunch|dinner|supper|cocktails|tapas|nightcap)\b/i;
    const beforeCount = day.activities.length;

    day.activities = day.activities.filter((act: any) => {
      const isDining = (act.category || '').toLowerCase() === 'dining' ||
        (act.type || '').toLowerCase() === 'dining' ||
        DINING_RE.test(act.title || '');
      if (!isDining) return true;

      const venueFromTitle = extractRestaurantVenueName(act.title || '');
      const venueFromVenue = act.venue_name ? extractRestaurantVenueName(act.venue_name) : '';
      const venueFromRestaurant = act.restaurant?.name ? extractRestaurantVenueName(act.restaurant.name) : '';
      const venueFromLocation = act.location?.name ? extractRestaurantVenueName(act.location.name) : '';

      const candidates = [venueFromTitle, venueFromVenue, venueFromRestaurant, venueFromLocation].filter(Boolean);

      const isRepeat = candidates.some(c => {
        if (usedNormalized.has(c)) return true;
        // Substring containment fallback for partial matches
        for (const used of usedNormalized) {
          if (used.length >= 3 && c.length >= 3 && (c.includes(used) || used.includes(c))) return true;
        }
        return false;
      });

      if (isRepeat) {
        console.warn(`[sanitize] RESTAURANT REPEAT BLOCKED: "${act.title}" (venues: [${candidates.join(', ')}]) was already used on a previous day — REMOVED`);
        return false; // Hard remove
      }
      return true;
    });

    const removed = beforeCount - day.activities.length;
    if (removed > 0) {
      console.log(`[sanitize] Hard dedup removed ${removed} repeated dining activit${removed === 1 ? 'y' : 'ies'} from day ${dayNumber}`);
    }
  }

  return day;
}

// =============================================================================
// DURATION NORMALIZATION — Render all duration strings consistently
// =============================================================================

/**
 * Normalize a duration string to a consistent format: "X min" or "Xh Y min".
 * Handles: "0:25", "15m", "15 min", "~15 min", "1h 30m", "1h30m", etc.
 */
export function normalizeDurationString(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw.replace(/^~\s*/, '').trim();
  if (!cleaned) return '';

  // Parse "H:MM" format (e.g., "0:25", "1:30")
  const hmMatch = cleaned.match(/^(\d+):(\d{2})$/);
  if (hmMatch) {
    const h = parseInt(hmMatch[1], 10);
    const m = parseInt(hmMatch[2], 10);
    const total = h * 60 + m;
    if (total <= 0) return '';
    if (total < 60) return `${total} min`;
    if (total % 60 === 0) return `${total / 60}h`;
    return `${h}h ${m} min`;
  }

  // Parse existing "Xh Ym" / "X min" / "Xm" formats → re-render consistently
  let totalMins = 0;
  const hMatch = cleaned.match(/(\d+)\s*h/i);
  const mMatch = cleaned.match(/(\d+)\s*m(?:in(?:ute)?s?)?/i);
  if (hMatch) totalMins += parseInt(hMatch[1], 10) * 60;
  if (mMatch) totalMins += parseInt(mMatch[1], 10);

  if (totalMins > 0) {
    if (totalMins < 60) return `${totalMins} min`;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m} min`;
  }

  return raw; // Unparseable — pass through
}

// =============================================================================
// PHANTOM HOTEL STRIPPING — Remove fabricated hotel activities when no hotel booked
// =============================================================================

const PHANTOM_HOTEL_TITLE_PATTERNS = [
  /\bcheck[\s-]?in\b/i,
  /\bcheck[\s-]?out\b/i,
  /\breturn to (?:the )?hotel\b/i,
  /\bhotel breakfast\b/i,
  /\bbreakfast at\b.*\bhotel\b/i,
  /\bsettle into\b.*\bhotel\b/i,
  /\bfreshen up\b.*\bhotel\b/i,
  /\brest (?:&|and) recharge\b.*\bhotel\b/i,
  /\bwind down\b.*\bhotel\b/i,
  /\btaxi to (?:the )?hotel\b/i,
  /\btransfer to (?:the )?hotel\b/i,
  /\bback to (?:the )?hotel\b/i,
  /\bnear your hotel\b/i,
  /\bat your hotel\b/i,
  /\bcaf[ée] near.*hotel\b/i,
  /\bsettle in\b/i,
];

const PHANTOM_HOTEL_CATEGORIES = ['hotel_checkin', 'hotel_checkout', 'accommodation'];

// Known luxury hotel brand patterns the AI fabricates
const FABRICATED_HOTEL_RE = /\b(?:Hotel\s+Le\s+\w+|Le\s+Meurice|The\s+Peninsula|Ritz\s+\w+|Four\s+Seasons|Mandarin\s+Oriental|St\.\s*Regis|Park\s+Hyatt|Aman\w*|Rosewood|Waldorf\s+Astoria|W\s+Hotel|Shangri[\s-]La|InterContinental|Sofitel|Fairmont|The\s+Langham|Belmond|Raffles|Oberoi|Taj\s+\w+|Peninsula\s+\w+|Iconic\s+\w+\s+Hotel|The\s+\w+\s+Iconic\b)\b/gi;

// Broad pattern: any proper-noun hotel name that isn't "Your Hotel" / "The Hotel"
// Matches e.g. "The Pantheon Iconic Rome Hotel", "Grand Hotel Europa", "Villa Medici Resort"
const BROAD_HOTEL_NAME_RE = /(?:The\s+)?(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Hotel|Resort|Inn|Suites?|Lodge|Palace|Boutique\s+Hotel)\b/g;

/**
 * Replace fabricated hotel names with "Your Hotel" when no hotel is booked.
 * When hasHotel is true, activities are kept as-is.
 *
 * IMPORTANT: Generic placeholder activities like "Check-in at Your Hotel",
 * "Freshen up at Your Hotel", "Return to Your Hotel" are PRESERVED.
 * These are valid structural cards that get patched with real hotel names
 * later via patchItineraryWithHotel. Only activities referencing
 * fabricated specific hotel names are replaced with "Your Hotel".
 */
export function stripPhantomHotelActivities(day: any, hasHotel: boolean): any {
  if (!day || hasHotel || !Array.isArray(day.activities)) return day;

  // Generic placeholder patterns we MUST keep untouched
  const GENERIC_PLACEHOLDERS = [
    /\byour hotel\b/i,
    /\bthe hotel\b/i,
    /\bhotel check-?in\b/i,
    /\bcheck-?in\s*&\s*refresh\b/i,
    /\bfreshen up\b/i,
    /\breturn to\b/i,
    /\bsettle in\b/i,
    /\bback to\b.*\bhotel\b/i,
    /\bhotel checkout\b/i,
    /\bcheck-?out\b/i,
    /\brest\s*(?:&|and)\s*recharge\b/i,
    /\bwind down\b/i,
  ];

  const isGenericPlaceholder = (title: string): boolean => {
    return GENERIC_PLACEHOLDERS.some(re => re.test(title));
  };

  let replacements = 0;
  for (const act of day.activities) {
    if (!act) continue;
    const title = act.title || act.name || '';
    // Skip already-generic placeholders — they're intended
    if (isGenericPlaceholder(title)) continue;

    // Replace fabricated hotel names in all text fields
    for (const field of ['title', 'name', 'description', 'location'] as const) {
      if (typeof act[field] !== 'string') continue;
      // Reset lastIndex for global regexes
      FABRICATED_HOTEL_RE.lastIndex = 0;
      BROAD_HOTEL_NAME_RE.lastIndex = 0;
      const hasFabricated = FABRICATED_HOTEL_RE.test(act[field]);
      BROAD_HOTEL_NAME_RE.lastIndex = 0;
      const hasBroad = BROAD_HOTEL_NAME_RE.test(act[field]);
      if (hasFabricated || hasBroad) {
        FABRICATED_HOTEL_RE.lastIndex = 0;
        BROAD_HOTEL_NAME_RE.lastIndex = 0;
        act[field] = act[field]
          .replace(FABRICATED_HOTEL_RE, 'Your Hotel')
          .replace(BROAD_HOTEL_NAME_RE, 'Your Hotel');
        replacements++;
      }
    }
  }

  if (replacements > 0) {
    console.log(`[stripPhantomHotelActivities] Replaced fabricated hotel names in ${replacements} fields with "Your Hotel"`);
  }
  return day;
}

export function sanitizeDateFields(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDateFields);
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string' && /date/i.test(key)) {
        const cleaned = sanitizeDateString(obj[key]);
        if (cleaned !== obj[key]) {
          console.warn(`[sanitizeDateFields] Cleaned "${key}": "${obj[key]}" → "${cleaned}"`);
          obj[key] = cleaned;
        }
      } else if (typeof obj[key] === 'object') {
        obj[key] = sanitizeDateFields(obj[key]);
      }
    }
  }
  return obj;
}
