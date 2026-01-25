/**
 * EXPLAINABILITY - Checkable Personalization Citations
 * 
 * Every activity must cite a REAL user input that can be validated.
 * Not "because it matches your vibe" but "You said romantic → candlelit wine bar"
 * 
 * The explanation must reference an actual preference, trait, or intent.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ExplainabilityContext {
  // From preferences
  interests: string[];
  foodLikes: string[];
  foodDislikes: string[];
  dietaryRestrictions: string[];
  travelCompanions: string[];
  accommodationStyle?: string;
  
  // From traits (with values for specificity)
  traits: {
    planning?: { value: number; label: string };
    social?: { value: number; label: string };
    comfort?: { value: number; label: string };
    pace?: { value: number; label: string };
    authenticity?: { value: number; label: string };
    adventure?: { value: number; label: string };
    budget?: { value: number; label: string };
    transformation?: { value: number; label: string };
  };
  
  // From trip intents
  tripIntents: string[];
  
  // From budget
  budgetTier?: string;
  budgetNotes?: string;
  
  // Archetype
  archetype?: string;
}

export interface Explanation {
  whyThisFits: string;        // Human-readable explanation
  matchedInputs: string[];    // List of specific inputs that drove this choice
  citationType: CitationType; // What type of user data this cites
  isCheckable: boolean;       // Can we programmatically verify this explanation?
}

export type CitationType = 
  | 'interest'           // From interests array
  | 'food_preference'    // From food likes/dislikes
  | 'dietary'            // From dietary restrictions
  | 'trait'              // From trait scores
  | 'intent'             // From trip intents
  | 'budget'             // From budget tier/style
  | 'companion'          // From travel companions
  | 'archetype'          // From personality archetype
  | 'constraint'         // From mobility/accessibility
  | 'learned';           // From past trip learnings

// =============================================================================
// CITATION GENERATION
// =============================================================================

/**
 * Generate a checkable explanation for an activity based on user context
 */
export function generateExplanation(
  activityData: {
    title: string;
    category: string;
    tags: string[];
    description?: string;
    priceLevel?: number;
  },
  context: ExplainabilityContext
): Explanation {
  const matchedInputs: string[] = [];
  const citationTypes: CitationType[] = [];
  const reasonParts: string[] = [];
  
  const titleLower = activityData.title.toLowerCase();
  const descLower = (activityData.description || '').toLowerCase();
  const tagsLower = activityData.tags.map(t => t.toLowerCase());
  const allText = `${titleLower} ${descLower} ${tagsLower.join(' ')}`;
  
  // ==========================================================================
  // 1. CHECK INTERESTS
  // ==========================================================================
  for (const interest of context.interests) {
    const interestLower = interest.toLowerCase();
    if (allText.includes(interestLower) || 
        tagsLower.some(t => t.includes(interestLower))) {
      matchedInputs.push(`interest: ${interest}`);
      citationTypes.push('interest');
      reasonParts.push(`You listed "${interest}" as an interest`);
    }
  }
  
  // ==========================================================================
  // 2. CHECK FOOD PREFERENCES
  // ==========================================================================
  if (activityData.category === 'dining') {
    for (const like of context.foodLikes) {
      if (allText.includes(like.toLowerCase())) {
        matchedInputs.push(`food_like: ${like}`);
        citationTypes.push('food_preference');
        reasonParts.push(`You enjoy ${like}`);
      }
    }
    
    // Also note avoidance for transparency
    for (const dislike of context.foodDislikes) {
      if (!allText.includes(dislike.toLowerCase())) {
        // Good - we avoided it
        matchedInputs.push(`avoided: ${dislike}`);
      }
    }
    
    for (const restriction of context.dietaryRestrictions) {
      matchedInputs.push(`dietary: ${restriction}`);
      citationTypes.push('dietary');
      reasonParts.push(`Accommodates your ${restriction} requirement`);
    }
  }
  
  // ==========================================================================
  // 3. CHECK TRAITS
  // ==========================================================================
  for (const [traitName, traitData] of Object.entries(context.traits)) {
    if (!traitData) continue;
    
    const { value, label } = traitData;
    
    // Match trait to activity characteristics
    const traitMatches = getTraitActivityMatch(traitName, value, activityData, allText);
    if (traitMatches.matched) {
      matchedInputs.push(`trait: ${traitName} (${value > 0 ? '+' : ''}${value})`);
      citationTypes.push('trait');
      reasonParts.push(traitMatches.reason);
    }
  }
  
  // ==========================================================================
  // 4. CHECK TRIP INTENTS
  // ==========================================================================
  for (const intent of context.tripIntents) {
    const intentLower = intent.toLowerCase();
    if (allText.includes(intentLower) ||
        // Common intent mappings
        (intentLower.includes('romantic') && tagsLower.some(t => ['romantic', 'intimate', 'candlelit', 'couples'].includes(t))) ||
        (intentLower.includes('family') && tagsLower.some(t => ['family-friendly', 'kids', 'child'].includes(t))) ||
        (intentLower.includes('quiet') && tagsLower.some(t => ['peaceful', 'serene', 'quiet'].includes(t)))) {
      matchedInputs.push(`intent: ${intent}`);
      citationTypes.push('intent');
      reasonParts.push(`You requested "${intent}"`);
    }
  }
  
  // ==========================================================================
  // 5. CHECK BUDGET
  // ==========================================================================
  if (context.budgetTier && activityData.priceLevel) {
    const tierPriceMap: Record<string, number[]> = {
      'budget': [1],
      'economy': [1, 2],
      'standard': [2, 3],
      'comfort': [2, 3],
      'premium': [3, 4],
      'luxury': [4]
    };
    
    const expectedLevels = tierPriceMap[context.budgetTier.toLowerCase()] || [2, 3];
    if (expectedLevels.includes(activityData.priceLevel)) {
      matchedInputs.push(`budget: ${context.budgetTier}`);
      citationTypes.push('budget');
      if (context.budgetNotes) {
        reasonParts.push(context.budgetNotes);
      } else {
        reasonParts.push(`Matches your ${context.budgetTier} budget`);
      }
    }
  }
  
  // ==========================================================================
  // 6. CHECK COMPANIONS
  // ==========================================================================
  for (const companion of context.travelCompanions) {
    const compLower = companion.toLowerCase();
    if ((compLower.includes('child') || compLower.includes('kid') || compLower.includes('family')) &&
        tagsLower.some(t => ['family-friendly', 'kids', 'stroller'].includes(t))) {
      matchedInputs.push(`companion: ${companion}`);
      citationTypes.push('companion');
      reasonParts.push(`Suitable for traveling with ${companion}`);
    }
    if ((compLower.includes('partner') || compLower.includes('spouse')) &&
        tagsLower.some(t => ['romantic', 'couples', 'intimate'].includes(t))) {
      matchedInputs.push(`companion: ${companion}`);
      citationTypes.push('companion');
      reasonParts.push(`Great for couples`);
    }
  }
  
  // ==========================================================================
  // 7. CHECK ARCHETYPE
  // ==========================================================================
  if (context.archetype) {
    const archetypeMatch = getArchetypeActivityMatch(context.archetype, activityData, tagsLower);
    if (archetypeMatch.matched) {
      matchedInputs.push(`archetype: ${context.archetype}`);
      citationTypes.push('archetype');
      reasonParts.push(archetypeMatch.reason);
    }
  }
  
  // ==========================================================================
  // BUILD FINAL EXPLANATION
  // ==========================================================================
  
  // Deduplicate reason parts
  const uniqueReasons = [...new Set(reasonParts)].slice(0, 3);
  
  const whyThisFits = uniqueReasons.length > 0
    ? uniqueReasons.join('. ') + '.'
    : `Selected for ${activityData.category} based on trip context`;
  
  return {
    whyThisFits,
    matchedInputs: [...new Set(matchedInputs)],
    citationType: citationTypes[0] || 'interest',
    isCheckable: matchedInputs.length > 0
  };
}

// =============================================================================
// TRAIT MATCHING
// =============================================================================

function getTraitActivityMatch(
  traitName: string,
  value: number,
  activity: { title: string; category: string; tags: string[] },
  allText: string
): { matched: boolean; reason: string } {
  const tagsLower = activity.tags.map(t => t.toLowerCase());
  
  switch (traitName) {
    case 'pace':
      if (value <= -3 && tagsLower.some(t => ['relaxation', 'slow-pace', 'leisure', 'spa'].includes(t))) {
        return { matched: true, reason: 'Your relaxed pace preference' };
      }
      if (value >= 3 && tagsLower.some(t => ['adventure', 'active', 'packed', 'tour'].includes(t))) {
        return { matched: true, reason: 'Your active pace preference' };
      }
      break;
      
    case 'adventure':
      if (value >= 4 && tagsLower.some(t => ['adventure', 'outdoor', 'extreme', 'unique', 'bold'].includes(t))) {
        return { matched: true, reason: `Your adventure trait (+${value})` };
      }
      if (value <= -4 && tagsLower.some(t => ['safe', 'comfortable', 'classic', 'traditional'].includes(t))) {
        return { matched: true, reason: 'Your preference for familiar experiences' };
      }
      break;
      
    case 'authenticity':
      if (value >= 4 && tagsLower.some(t => ['local', 'authentic', 'hidden-gem', 'off-beaten-path', 'traditional'].includes(t))) {
        return { matched: true, reason: `Your authenticity score (+${value}) → local over touristy` };
      }
      break;
      
    case 'social':
      if (value >= 4 && tagsLower.some(t => ['group', 'social', 'tour', 'class', 'workshop'].includes(t))) {
        return { matched: true, reason: 'Your social, group-friendly preference' };
      }
      if (value <= -4 && tagsLower.some(t => ['quiet', 'solo', 'peaceful', 'intimate', 'private'].includes(t))) {
        return { matched: true, reason: 'Your preference for quieter, intimate experiences' };
      }
      break;
      
    case 'comfort':
      if (value >= 4 && tagsLower.some(t => ['luxury', 'premium', 'upscale', 'fine-dining'].includes(t))) {
        return { matched: true, reason: 'Your high comfort expectations' };
      }
      if (value <= -4 && tagsLower.some(t => ['budget', 'casual', 'local', 'simple'].includes(t))) {
        return { matched: true, reason: 'Your value-conscious comfort style' };
      }
      break;
      
    case 'transformation':
      if (value >= 4 && tagsLower.some(t => ['wellness', 'meditation', 'yoga', 'learning', 'cultural'].includes(t))) {
        return { matched: true, reason: 'Your growth/transformation focus' };
      }
      break;
      
    case 'budget':
      // Positive = frugal, negative = splurge
      if (value >= 5 && tagsLower.some(t => ['free', 'budget', 'value', 'affordable'].includes(t))) {
        return { matched: true, reason: 'Your value-focused spending style' };
      }
      if (value <= -5 && tagsLower.some(t => ['luxury', 'premium', 'splurge', 'exclusive'].includes(t))) {
        return { matched: true, reason: 'Your splurge-forward spending style' };
      }
      break;
  }
  
  return { matched: false, reason: '' };
}

// =============================================================================
// ARCHETYPE MATCHING
// =============================================================================

function getArchetypeActivityMatch(
  archetype: string,
  activity: { title: string; category: string },
  tags: string[]
): { matched: boolean; reason: string } {
  const archetypeLower = archetype.toLowerCase().replace(/[_-]/g, ' ');
  
  // Map archetypes to expected activity characteristics
  const archetypeMatchers: Record<string, { tags: string[]; reason: string }> = {
    'luxury planner': {
      tags: ['luxury', 'premium', 'upscale', 'fine-dining', 'exclusive'],
      reason: 'Fits your Luxury Planner style'
    },
    'adventure seeker': {
      tags: ['adventure', 'outdoor', 'active', 'extreme', 'thrill'],
      reason: 'Matches your Adventure Seeker personality'
    },
    'cultural immersionist': {
      tags: ['cultural', 'museum', 'historical', 'local', 'authentic'],
      reason: 'Aligns with your Cultural Immersionist archetype'
    },
    'sanctuary seeker': {
      tags: ['quiet', 'peaceful', 'spa', 'wellness', 'serene', 'private'],
      reason: 'Supports your Sanctuary Seeker need for peace'
    },
    'foodie explorer': {
      tags: ['culinary', 'foodie', 'local-cuisine', 'market', 'tasting'],
      reason: 'Perfect for your Foodie Explorer archetype'
    },
    'budget backpacker': {
      tags: ['budget', 'free', 'local', 'hostel', 'walking'],
      reason: 'Budget-friendly for your Backpacker style'
    }
  };
  
  for (const [archetypeKey, matcher] of Object.entries(archetypeMatchers)) {
    if (archetypeLower.includes(archetypeKey) || archetypeKey.includes(archetypeLower.split(' ')[0])) {
      if (tags.some(t => matcher.tags.includes(t))) {
        return { matched: true, reason: matcher.reason };
      }
    }
  }
  
  return { matched: false, reason: '' };
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate that an explanation actually references user inputs
 */
export function validateExplanation(
  explanation: Explanation,
  context: ExplainabilityContext
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Must have at least one matched input
  if (explanation.matchedInputs.length === 0) {
    issues.push('No matched inputs - explanation is not checkable');
  }
  
  // Check that matched inputs are actually in context
  for (const input of explanation.matchedInputs) {
    const [type, ...rest] = input.split(': ');
    const value = rest.join(': ');
    
    switch (type) {
      case 'interest':
        if (!context.interests.some(i => i.toLowerCase() === value.toLowerCase())) {
          issues.push(`Referenced interest "${value}" not found in user interests`);
        }
        break;
      case 'intent':
        if (!context.tripIntents.some(i => i.toLowerCase().includes(value.toLowerCase()))) {
          issues.push(`Referenced intent "${value}" not found in trip intents`);
        }
        break;
      case 'trait':
        const traitName = value.split(' ')[0];
        if (!context.traits[traitName as keyof typeof context.traits]) {
          issues.push(`Referenced trait "${traitName}" not found in user traits`);
        }
        break;
    }
  }
  
  // whyThisFits should not be generic
  const genericPhrases = [
    'matches your vibe',
    'fits your style',
    'you might like',
    'popular choice',
    'recommended for you'
  ];
  const whyLower = explanation.whyThisFits.toLowerCase();
  for (const phrase of genericPhrases) {
    if (whyLower.includes(phrase) && explanation.matchedInputs.length === 0) {
      issues.push(`Generic explanation phrase "${phrase}" without specific citation`);
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

// =============================================================================
// PROMPT GENERATION
// =============================================================================

/**
 * Generate explainability requirements for AI prompt
 */
export function buildExplainabilityPrompt(context: ExplainabilityContext): string {
  const interestsList = context.interests.length > 0 
    ? context.interests.slice(0, 5).join(', ') 
    : 'none specified';
  
  const traitsList = Object.entries(context.traits)
    .filter(([_, v]) => v && Math.abs(v.value) >= 3)
    .map(([k, v]) => `${k}: ${v!.value > 0 ? '+' : ''}${v!.value}`)
    .join(', ') || 'balanced';
  
  const intentsList = context.tripIntents.length > 0
    ? context.tripIntents.join(', ')
    : 'none';
  
  return `
## EXPLAINABILITY - CHECKABLE CITATIONS REQUIRED
Every activity MUST cite a REAL user input. Generic explanations will be REJECTED.

USER INPUTS AVAILABLE FOR CITATION:
- Interests: ${interestsList}
- Traits: ${traitsList}
- Trip intents: ${intentsList}
- Budget: ${context.budgetTier || 'standard'} ${context.budgetNotes ? `(${context.budgetNotes})` : ''}
- Companions: ${context.travelCompanions.join(', ') || 'not specified'}
${context.archetype ? `- Archetype: ${context.archetype}` : ''}

FOR EACH ACTIVITY, you MUST provide:
\`\`\`json
"personalization": {
  "whyThisFits": "You said romantic → candlelit wine bar with harbor views",
  "matchedInputs": ["intent: romantic", "food_like: seafood", "trait: comfort +6"],
  "tags": ["romantic", "seafood", "candlelit", "harbor-view"]
}
\`\`\`

VALID CITATION FORMATS:
- "You listed 'history' as an interest → museum with Roman artifacts"
- "Your adventure trait (+7) → zip-lining through rainforest"
- "You requested 'quiet getaway' → secluded beach with no crowds"
- "Your authenticity score (+5) → family-run trattoria off the tourist path"
- "Accommodates your vegetarian requirement"

INVALID (will be rejected):
- "Because it matches your vibe"
- "Popular with travelers"
- "Highly recommended"
- "You might enjoy this"

Each matchedInputs item must reference data from the USER INPUTS section above.`;
}
