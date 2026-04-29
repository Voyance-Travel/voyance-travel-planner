/**
 * Budget intent derivation, budget constraint blocks, archetype constraints,
 * generation rules formatting, and tourist-trap skip lists.
 */

// =============================================================================
// TOURIST TRAP SKIP LIST
// =============================================================================
interface SkippedItem {
  name: string;
  reason: string;
  preferredAlternative?: string;
  keywords?: string[];
}

const DESTINATION_ALTERNATIVES: Record<string, SkippedItem[]> = {
  paris: [
    { name: 'Seine dinner cruises', reason: 'A sunset walk along the Seine with wine is more authentically Parisian', preferredAlternative: 'Seine-side picnic at sunset', keywords: ['seine cruise', 'river cruise', 'bateaux', 'boat cruise', 'dinner cruise', 'sunset cruise on seine'] },
    { name: 'Champs-Élysées restaurants', reason: 'Le Marais and Canal Saint-Martin have far better dining', preferredAlternative: 'Le Marais or Canal Saint-Martin restaurants', keywords: ['champs-elysees restaurant', 'champs elysees dining'] },
    { name: 'Montmartre portrait artists', reason: "Explore Montmartre's galleries and cafés instead", preferredAlternative: 'Montmartre gallery walk', keywords: ['montmartre portrait', 'place du tertre artists'] },
  ],
  tokyo: [
    { name: 'Robot Restaurant', reason: 'Golden Gai bars offer authentic Tokyo nightlife', preferredAlternative: 'Golden Gai bars in Shinjuku', keywords: ['robot restaurant', 'robot show'] },
    { name: 'Tokyo Skytree', reason: 'Shibuya Sky offers equally stunning views with shorter waits', preferredAlternative: 'Shibuya Sky or Tokyo Tower at sunset', keywords: ['skytree observation', 'tokyo skytree'] },
  ],
  rome: [
    { name: 'Piazza Navona restaurants', reason: "Testaccio and Jewish Ghetto have Rome's best trattorias", preferredAlternative: 'Testaccio or Jewish Ghetto trattorias', keywords: ['piazza navona dining', 'navona restaurants'] },
    { name: 'Via Veneto restaurants', reason: 'Trastevere has more authentic Roman dining', preferredAlternative: 'Trastevere trattorias', keywords: ['via veneto restaurant'] },
  ],
  london: [
    { name: 'Leicester Square restaurants', reason: 'Borough Market and Soho side streets are where Londoners eat', preferredAlternative: 'Borough Market or Soho side streets', keywords: ['leicester square dining', 'leicester square restaurant'] },
    { name: 'Hard Rock Cafe London', reason: "Explore London's incredible independent restaurant scene instead", preferredAlternative: 'Independent restaurants in Shoreditch or Brixton', keywords: ['hard rock cafe'] },
  ],
  barcelona: [
    { name: 'La Rambla restaurants', reason: "El Born and Gràcia have Barcelona's best tapas bars", preferredAlternative: 'El Born or Gràcia tapas bars', keywords: ['rambla restaurant', 'las ramblas dining'] },
    { name: 'Barceloneta beachfront restaurants', reason: 'Local seafood restaurants in El Poblenou are far better', preferredAlternative: 'El Poblenou seafood restaurants', keywords: ['barceloneta restaurant', 'beach paella'] },
  ],
};

export function buildSkipListPrompt(destination: string): string {
  const cityKey = destination.toLowerCase();
  const matchedCity = Object.keys(DESTINATION_ALTERNATIVES).find(key =>
    cityKey.includes(key) || key.includes(cityKey)
  );

  if (!matchedCity) return '';
  const altList = DESTINATION_ALTERNATIVES[matchedCity];
  if (!altList || altList.length === 0) return '';

  const preferItems = altList.map(item => {
    const keywords = item.keywords ? ` (steer away from: ${item.keywords.join(', ')})` : '';
    const alt = item.preferredAlternative ? ` → PREFER: ${item.preferredAlternative}` : '';
    return `  ✦ Instead of ${item.name}${keywords} — ${item.reason}${alt}`;
  }).join('\n');

  return `
╔═══════════════════════════════════════════════════════════════════════╗
║                    LOCAL INSIDER ALTERNATIVES                         ║
╚═══════════════════════════════════════════════════════════════════════╝

IMPORTANT: Prefer these local-favorite alternatives over commonly visited spots.
We highlight these insider picks in our "Better Alternatives" section.
Using the preferred alternatives reinforces trust in our recommendations.

${preferItems}

GUIDANCE:
- If a celebration/birthday suggests a "cruise" → suggest a WALKING tour along the Seine, rooftop bar, or picnic instead
- If the user wants river views → recommend Pont Alexandre III at sunset, a riverside café, or Île Saint-Louis stroll
- Prefer the listed alternatives over the commonly visited spots above
`;
}

// =============================================================================
// BUDGET INTENT
// =============================================================================

// CANONICAL TRAIT POLARITY (matches calculate-travel-dna):
export const BUDGET_TRAIT_POLARITY = 'POSITIVE_IS_FRUGAL' as const;
export const COMFORT_TRAIT_POLARITY = 'POSITIVE_IS_LUXURY' as const;

export type SpendStyle = 'value_focused' | 'balanced' | 'splurge_forward';
export type BudgetTierLevel = 'budget' | 'economy' | 'standard' | 'comfort' | 'premium' | 'luxury';

export interface BudgetIntent {
  tier: BudgetTierLevel;
  spendStyle: SpendStyle;
  splurgeCadence: { dinners: number; experiences: number };
  avoid: string[];
  prioritize: string[];
  priceSensitivity: number;
  notes: string;
  conflict: boolean;
  conflictDetails?: string;
}

export function deriveBudgetIntent(
  budgetTier: string | undefined,
  budgetTrait: number | undefined,
  comfortTrait: number | undefined
): BudgetIntent {
  const rawTier = (budgetTier?.toLowerCase() || 'standard');
  const tier = ((rawTier === 'moderate' ? 'standard' : rawTier) as BudgetTierLevel);
  const budget = budgetTrait ?? 0;
  const comfort = comfortTrait ?? 0;

  const tierLevels: Record<string, number> = {
    budget: 1, economy: 2, standard: 3, comfort: 4, premium: 5, luxury: 6
  };
  const tierLevel = tierLevels[tier] || 3;

  const isHighTier = tierLevel >= 5;
  const isLowTier = tierLevel <= 2;
  const isFrugal = budget >= 5;
  const isSplurge = budget <= -5;
  const isLuxurySeeker = comfort >= 5;
  const isBudgetConscious = comfort <= -5;

  let conflict = false;
  let conflictDetails: string | undefined;

  if (isHighTier && isFrugal) {
    conflict = true;
    conflictDetails = `Premium tier with strong frugal trait (+${budget}) - value-focused premium traveler`;
  } else if (isLowTier && isLuxurySeeker) {
    conflict = true;
    conflictDetails = `Budget tier with luxury-seeking comfort (+${comfort}) - budget-constrained with quality aspirations`;
  } else if (isHighTier && isBudgetConscious) {
    conflict = true;
    conflictDetails = `Premium tier with budget-conscious comfort (${comfort}) - unusual combination`;
  } else if (isLowTier && isSplurge) {
    conflict = true;
    conflictDetails = `Budget tier with strong splurge trait (${budget}) - aspirational budget traveler, prioritize 1-2 high-ROI splurges`;
  }

  let spendStyle: SpendStyle;
  if (isFrugal || budget > 2) {
    spendStyle = 'value_focused';
  } else if (isSplurge || budget < -2) {
    spendStyle = 'splurge_forward';
  } else {
    spendStyle = 'balanced';
  }

  if (Math.abs(budget) <= 2) {
    if (isLuxurySeeker) spendStyle = 'splurge_forward';
    if (isBudgetConscious) spendStyle = 'value_focused';
  }

  const tierSensitivity: Record<string, number> = {
    luxury: 10, premium: 25, comfort: 40, standard: 55, economy: 70, budget: 85
  };
  let priceSensitivity = tierSensitivity[tier] || 55;
  priceSensitivity += budget * 3;
  priceSensitivity -= comfort * 2;
  priceSensitivity = Math.max(0, Math.min(100, priceSensitivity));

  const splurgeCadence = {
    dinners: spendStyle === 'splurge_forward' ? 4 : spendStyle === 'value_focused' ? 1 : 2,
    experiences: spendStyle === 'splurge_forward' ? 3 : spendStyle === 'value_focused' ? 1 : 2
  };

  if (tierLevel >= 5) {
    splurgeCadence.dinners = Math.min(5, splurgeCadence.dinners + 1);
    splurgeCadence.experiences = Math.min(4, splurgeCadence.experiences + 1);
  } else if (tierLevel <= 2) {
    splurgeCadence.dinners = Math.max(0, splurgeCadence.dinners - 1);
    splurgeCadence.experiences = Math.max(0, splurgeCadence.experiences - 1);
  }

  const avoid: string[] = [];
  const prioritize: string[] = [];

  if (spendStyle === 'value_focused') {
    avoid.push('tourist traps', 'overpriced set menus', 'low-ROI experiences', 'expensive transport when cheaper options exist');
    prioritize.push('high-value experiences', 'local favorites with quality', 'intentional upgrades on signature moments');
  } else if (spendStyle === 'splurge_forward') {
    avoid.push('budget options that compromise experience', 'overcrowded budget alternatives');
    prioritize.push('premium experiences', 'fine dining', 'skip-the-line tickets', 'private tours', 'exclusive access');
  } else {
    avoid.push('obvious tourist traps');
    prioritize.push('balanced mix of upgrades and value options', 'local recommendations at various price points');
  }

  if (tierLevel >= 5) {
    prioritize.push('top-tier accommodations as baseline comfort');
    if (spendStyle === 'value_focused') {
      prioritize.push('1-2 signature splurges per trip where ROI is high');
    }
  }

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const styleLabel = spendStyle.replace('_', '-');
  let notes = `${tierLabel}, ${styleLabel}`;

  if (conflict && spendStyle === 'value_focused' && tierLevel >= 5) {
    notes += ': willing to pay for top-tier comfort + 1-2 signature upgrades; avoids tourist traps and low-ROI spend';
  } else if (spendStyle === 'value_focused') {
    notes += ': seeks best value at every price point; prioritizes quality over quantity; strategic upgrades only';
  } else if (spendStyle === 'splurge_forward') {
    notes += ': embraces premium experiences freely; prioritizes exclusivity and comfort over cost savings';
  } else {
    notes += ': balanced approach to spending; open to both value finds and occasional upgrades';
  }

  if (conflict) {
    console.log(`[BudgetIntent] CONFLICT DETECTED: ${conflictDetails}`);
    console.log(`[BudgetIntent] Resolved to: ${notes}`);
  }

  return { tier: tier as BudgetTierLevel, spendStyle, splurgeCadence, avoid, prioritize, priceSensitivity, notes, conflict, conflictDetails };
}

// =============================================================================
// EXPLICIT BUDGET CONSTRAINTS BLOCK
// =============================================================================

export function buildBudgetConstraintsBlock(budgetTier: string, budgetScore: number): string {
  const tier = (budgetTier || 'moderate').toLowerCase();
  const normalizedTier = tier === 'moderate' ? 'standard' : tier;

  const constraints: Record<string, string> = {
    budget: `
${'='.repeat(70)}
🚫 BUDGET CONSTRAINTS (STRICT - BUDGET TIER)
${'='.repeat(70)}

DO NOT INCLUDE:
- Michelin-starred restaurants
- Hotel restaurants or rooftop bars at luxury hotels (Hassler, Waldorf, Four Seasons, etc.)
- Private tours or VIP experiences
- Spa treatments or wellness packages
- Anything described as "luxury", "exclusive", or "premium"
- Restaurants over €40 per person
- Activities over €30 per person
- Wine pairings or tasting menus

DO INCLUDE:
- Local trattorias and osterias
- Street food and markets
- Free attractions and landmarks
- Self-guided walks and neighborhood exploration
- Restaurants where locals eat (not tourist hotspots)
- Aperitivo spots with free snacks

Price is a feature, not a constraint to work around.
`,
    economy: `
${'='.repeat(70)}
💰 BUDGET CONSTRAINTS (ECONOMY TIER)
${'='.repeat(70)}

AVOID:
- Michelin-starred restaurants
- Private tours
- VIP/skip-the-line packages
- Hotel restaurants at luxury properties
- Anything over €50 per person for dining
- Activities over €40 per person

PREFER:
- Well-reviewed local restaurants (€15-35 per person)
- Free and low-cost attractions
- Self-guided exploration
- Markets and street food
`,
    standard: `
${'='.repeat(70)}
💰 BUDGET CONSTRAINTS (MODERATE/STANDARD TIER)
${'='.repeat(70)}

LIMIT:
- Maximum 1 "splurge" meal per trip (€80+ per person)
- No Michelin-starred restaurants unless it's the designated signature_meal slot
- No hotel restaurants at 5-star properties (Hassler, St. Regis, Four Seasons, etc.)
- No private tours unless specifically requested
- No spa treatments unless specifically requested

PREFER:
- Well-reviewed local restaurants (€25-50 per person)
- Highly-rated affordable experiences
- Quality over flash
- Local favorites over tourist magnets

WORD CHOICE:
- Do NOT use "luxury" in activity titles or descriptions
- Do NOT use "exclusive" or "VIP" framing
- Do NOT describe as "splurge-forward" - this user is value-conscious
`,
    comfort: `
${'='.repeat(70)}
💰 BUDGET CONSTRAINTS (COMFORT TIER)
${'='.repeat(70)}

ALLOWED:
- Higher-end restaurants (€50-80 per person)
- 1-2 "special occasion" meals per trip
- Quality-focused experiences
- Skip-the-line tickets (not VIP, just convenience)

AVOID:
- Private tours (prefer small group)
- Hotel spa packages at ultra-luxury properties
- Michelin 2-3 star (1 star OK if booked as signature meal)
`,
    premium: `
${'='.repeat(70)}
💫 BUDGET TIER: PREMIUM
${'='.repeat(70)}

ALLOWED:
- Elevated dining experiences
- Private tours for special interests
- VIP access where it adds value
- Michelin-starred restaurants (1 per trip max unless requested)

MAINTAIN BALANCE:
- Still mix high-end with authentic local spots
- Not every meal needs to be expensive
`,
    luxury: `
${'='.repeat(70)}
👑 BUDGET TIER: LUXURY
${'='.repeat(70)}

Premium experiences expected. Michelin dining, VIP access, and exclusive experiences are appropriate.
Prioritize exclusivity and unique access over price considerations.
`
  };

  return constraints[normalizedTier] || constraints.standard;
}

// =============================================================================
// ARCHETYPE-SPECIFIC CONSTRAINTS
// =============================================================================

export function buildArchetypeConstraintsBlock(archetype?: string): string {
  if (!archetype) return '';

  const normalizedArchetype = archetype.toLowerCase().replace(/\s+/g, '_');

  const archetypeAvoid: Record<string, string[]> = {
    'flexible_wanderer': ['structured group tours', 'luxury dining establishments', 'spa treatments or wellness packages', 'VIP or exclusive experiences', 'hotel restaurants at luxury properties', 'anything requiring reservations weeks in advance', 'Michelin-starred restaurants', 'private tours'],
    'beach_therapist': ['spa packages (they want beach relaxation, not spa treatments)', 'luxury resorts dining', 'fine dining with dress codes', 'packed itineraries', 'early morning activities', 'high-energy adventure sports'],
    'slow_traveler': ['rushed experiences', 'tourist hotspots at peak times', 'back-to-back activities', 'anything described as "must-see"', 'group tours', 'activities before 10am'],
    'cultural_curator': ['tourist traps', 'chain restaurants', 'generic shopping malls', 'beach lounging', 'nightclub activities'],
    'culinary_cartographer': ['chain restaurants', 'hotel buffets', 'tourist-trap restaurants', 'fast food', 'meals without local character'],
    'adrenaline_architect': ['spa and relaxation', 'slow-paced activities', 'museum-heavy itineraries', 'shopping trips', 'leisurely lunches'],
    'luxury_luminary': ['budget options', 'street food as main meals', 'hostels', 'public transit', 'self-guided tours'],
    'mindful_explorer': ['crowded tourist spots', 'loud nightlife', 'rushed activities', 'group tours over 8 people', 'aggressive shopping areas'],
    'sanctuary_seeker': ['group activities', 'social dining experiences', 'crowded attractions', 'nightlife', 'high-energy activities'],
  };

  const archetypeInclude: Record<string, string[]> = {
    'flexible_wanderer': ['self-guided neighborhood walks', 'local cafés and bakeries', 'hidden viewpoints', 'afternoon lingering spots', 'authentic local restaurants (not tourist-facing)'],
    'beach_therapist': ['beach time', 'sunset viewing spots', 'waterfront cafés', 'relaxed outdoor dining', 'coastal walks'],
    'slow_traveler': ['extended café breaks', 'park visits', 'local markets', 'long leisurely lunches', 'neighborhood exploration'],
  };

  const avoid = archetypeAvoid[normalizedArchetype];
  const include = archetypeInclude[normalizedArchetype];

  if (!avoid && !include) return '';

  const formattedArchetype = archetype.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  let block = `
${'='.repeat(70)}
🎭 ARCHETYPE CONSTRAINTS: ${formattedArchetype}
${'='.repeat(70)}
`;

  if (avoid && avoid.length > 0) {
    block += `
This traveler specifically DOES NOT want:
${avoid.map(a => `  ❌ ${a}`).join('\n')}
`;
  }

  if (include && include.length > 0) {
    block += `
This traveler LOVES:
${include.map(a => `  ✅ ${a}`).join('\n')}
`;
  }

  block += `
Respect their travel identity. These are not suggestions — they are requirements.
`;

  return block;
}

// =============================================================================
// GENERATION RULES FORMATTING
// =============================================================================

export function formatGenerationRules(rules: Array<{type: string; days?: string[]; from?: string; to?: string; reason?: string; date?: string; description?: string; hotelName?: string; additionalGuests?: number; note?: string; text?: string; time?: string; duration?: number; day?: number | string}>): string {
  if (!rules || rules.length === 0) return '';
  const dayMap: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
  const lines: string[] = ['\n## 🚨 RULES THE ITINERARY MUST FOLLOW\n', 'The traveler has set the following constraints. These are NON-NEGOTIABLE.\n'];
  rules.forEach((rule, i) => {
    const num = i + 1;
    switch (rule.type) {
      case 'blocked_time': {
        const dayNames = (rule.days || []).map(d => dayMap[d] || d).join(', ');
        // Sanitize NaN times — skip malformed rules entirely
        const fromTime = String(rule.from || '');
        let toTime = String(rule.to || '');
        if (fromTime.includes('NaN') || toTime.includes('NaN') || !fromTime || !toTime) {
          console.warn(`[formatGenerationRules] Skipping malformed blocked_time rule: from="${fromTime}", to="${toTime}", reason="${rule.reason}"`);
          break;
        }
        // Self-correct truncated blocked windows from reason/description text
        // e.g. reason="US Open tennis tournament from 9am to 5pm" but to="11:00" (wrong default)
        const reasonText = rule.reason || rule.description || '';
        const timeRangeMatch = reasonText.match(
          /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:to|[-–—])\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i
        );
        if (timeRangeMatch) {
          let endH = parseInt(timeRangeMatch[4], 10);
          const endM = timeRangeMatch[5] ? parseInt(timeRangeMatch[5], 10) : 0;
          const endMeridiem = timeRangeMatch[6].toLowerCase();
          if (endMeridiem === 'pm' && endH < 12) endH += 12;
          if (endMeridiem === 'am' && endH === 12) endH = 0;
          const parsedEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
          // Only override if parsed end is later than current to (fixes truncated defaults)
          if (parsedEnd > toTime) {
            console.log(`[formatGenerationRules] Correcting blocked_time to: "${toTime}" → "${parsedEnd}" (parsed from reason: "${reasonText}")`);
            toTime = parsedEnd;
          }
        }
        lines.push(`${num}. BLOCKED TIME: On ${dayNames}, do NOT schedule any activities between ${fromTime} and ${toTime}.${rule.reason ? ` Reason: ${rule.reason}.` : ''} Leave these hours completely free.`);
        break;
      }
      case 'special_event':
        lines.push(`${num}. SPECIAL EVENT on ${rule.date}: ${rule.description}. Adjust the day's plan accordingly.`);
        break;
      case 'hotel_change':
        lines.push(`${num}. HOTEL CHANGE on ${rule.date}: The traveler is changing hotels${rule.hotelName ? ` to ${rule.hotelName}` : ''}.${rule.note ? ` ${rule.note}.` : ''} Plan check-out from old hotel and check-in at new hotel.`);
        break;
      case 'guest_change': {
        const direction = (rule.additionalGuests || 0) > 0 ? 'joining' : 'leaving';
        const count = Math.abs(rule.additionalGuests || 0);
        lines.push(`${num}. GROUP CHANGE on ${rule.date}: ${count} traveler${count !== 1 ? 's' : ''} ${direction}.${rule.note ? ` (${rule.note})` : ''} From this date onward, plan for the new group size.`);
        break;
      }
      case 'free_text':
        lines.push(`${num}. USER CONSTRAINT: ${rule.text}`);
        break;
      case 'avoid':
        lines.push(`${num}. 🚫 AVOID: "${rule.reason || rule.description || rule.text}". Do NOT include anything matching this in any day.`);
        break;
      case 'preference':
        lines.push(`${num}. ✨ PREFERENCE: "${rule.reason || rule.description || rule.text}". Incorporate this into venue/activity selection across ALL days.`);
        break;
      case 'time_preference':
        lines.push(`${num}. 🕐 TIME PREFERENCE: "${rule.reason || rule.description || rule.text}" → preferred time: ${rule.time || 'flexible'} (duration: ${rule.duration || 120} min). Schedule at this time on the best available day.`);
        break;
      case 'full_day_event':
        lines.push(`${num}. 📅 FULL-DAY EVENT${rule.day ? ` (Day ${rule.day})` : ''}: "${rule.reason || rule.description || rule.text}". This event consumes the ENTIRE day — do NOT add other activities.`);
        break;
      case 'flight_constraint': {
        const dayStr = rule.day ? ` (Day ${rule.day})` : '';
        const timeStr = rule.time ? ` at ${rule.time}` : '';
        lines.push(`${num}. ✈️ FLIGHT${dayStr}${timeStr}: "${rule.reason || rule.description || rule.text}". Account for airport transit time.`);
        break;
      }
    }
  });
  lines.push('\nIMPORTANT: If ANY activity conflicts with the above rules, remove or reschedule it.\n');
  return lines.join('\n');
}
