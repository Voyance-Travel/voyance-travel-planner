// =============================================================================
// DYNAMIC DIETARY ENFORCEMENT ENGINE
// =============================================================================
// This module provides a fully dynamic system for handling ALL dietary
// restrictions equally. It maps any restriction to:
// - What to avoid (cuisine types, restaurant categories, ingredients)
// - Positive keywords to look for (verified safe options)
// - Severity level (how strictly to enforce - critical for allergies)
// =============================================================================

export interface DietaryRule {
  name: string;
  avoidCuisines: string[];
  avoidIngredients: string[];
  safeKeywords: string[];
  promptSeverity: 'critical' | 'high' | 'medium';
}

// =============================================================================
// DIETARY RULES LOOKUP TABLE
// =============================================================================
// This is the single source of truth for all dietary restriction handling.
// Add new restrictions here and they automatically work throughout the system.
// =============================================================================

export const DIETARY_RULES: Record<string, DietaryRule> = {
  'vegan': {
    name: 'Vegan',
    avoidCuisines: ['steakhouse', 'bbq', 'barbecue', 'tonkatsu', 'yakiniku', 'seafood', 'sushi', 'crab house', 'oyster bar', 'churrascaria', 'korean bbq'],
    avoidIngredients: ['meat', 'fish', 'seafood', 'dairy', 'eggs', 'honey', 'beef', 'pork', 'chicken', 'lamb', 'bacon', 'cheese', 'milk', 'butter', 'cream', 'shrimp', 'crab', 'lobster'],
    safeKeywords: ['vegan', 'plant-based', 'vegan-friendly', 'vegan options', '100% vegan'],
    promptSeverity: 'critical'
  },
  'vegetarian': {
    name: 'Vegetarian',
    avoidCuisines: ['steakhouse', 'bbq', 'barbecue', 'tonkatsu', 'yakiniku', 'churrascaria', 'korean bbq'],
    avoidIngredients: ['meat', 'fish', 'seafood', 'pork', 'beef', 'chicken', 'lamb', 'bacon', 'ham', 'shrimp', 'crab', 'lobster'],
    safeKeywords: ['vegetarian', 'veggie', 'meat-free', 'vegetarian-friendly', 'vegetarian options'],
    promptSeverity: 'critical'
  },
  'halal': {
    name: 'Halal',
    avoidCuisines: ['pork restaurant', 'izakaya', 'wine bar', 'beer hall', 'pub', 'bacon house'],
    avoidIngredients: ['pork', 'bacon', 'ham', 'prosciutto', 'salami', 'pepperoni', 'alcohol', 'wine sauce', 'beer-battered', 'lard'],
    safeKeywords: ['halal', 'halal-certified', 'muslim-friendly', 'halal meat'],
    promptSeverity: 'critical'
  },
  'kosher': {
    name: 'Kosher',
    avoidCuisines: ['seafood restaurant', 'crab house', 'oyster bar', 'shellfish', 'pork-focused'],
    avoidIngredients: ['pork', 'shellfish', 'shrimp', 'crab', 'lobster', 'oyster', 'mussels', 'clam', 'bacon', 'ham'],
    safeKeywords: ['kosher', 'kosher-certified', 'glatt kosher'],
    promptSeverity: 'critical'
  },
  'gluten-free': {
    name: 'Gluten-Free',
    avoidCuisines: ['ramen shop', 'udon shop', 'bakery', 'pasta restaurant', 'pizzeria', 'noodle house', 'bread shop'],
    avoidIngredients: ['wheat', 'barley', 'rye', 'gluten', 'bread', 'pasta', 'noodles', 'flour', 'soy sauce'],
    safeKeywords: ['gluten-free', 'gf', 'celiac-safe', 'gluten-free menu', 'gluten-free options'],
    promptSeverity: 'high'
  },
  'dairy-free': {
    name: 'Dairy-Free',
    avoidCuisines: ['cheese restaurant', 'fondue', 'ice cream parlor', 'creamery'],
    avoidIngredients: ['milk', 'cheese', 'cream', 'butter', 'yogurt', 'lactose', 'whey', 'casein', 'ghee'],
    safeKeywords: ['dairy-free', 'lactose-free', 'non-dairy', 'vegan cheese', 'plant milk'],
    promptSeverity: 'high'
  },
  'nut-free': {
    name: 'Nut Allergy',
    avoidCuisines: ['thai', 'peanut-heavy', 'indian', 'cashew-heavy', 'middle eastern'],
    avoidIngredients: ['peanuts', 'tree nuts', 'almonds', 'cashews', 'walnuts', 'pistachios', 'hazelnuts', 'pecans', 'macadamia', 'nut oil', 'peanut sauce', 'satay'],
    safeKeywords: ['nut-free', 'peanut-free', 'allergy-aware', 'tree-nut-free', 'allergen menu'],
    promptSeverity: 'critical' // Life-threatening
  },
  'peanut-free': {
    name: 'Peanut Allergy',
    avoidCuisines: ['thai', 'vietnamese', 'indonesian', 'malaysian'],
    avoidIngredients: ['peanuts', 'peanut oil', 'peanut sauce', 'satay', 'peanut butter', 'groundnut'],
    safeKeywords: ['peanut-free', 'allergy-aware', 'allergen menu'],
    promptSeverity: 'critical' // Life-threatening
  },
  'shellfish-free': {
    name: 'Shellfish Allergy',
    avoidCuisines: ['seafood restaurant', 'sushi', 'crab house', 'oyster bar', 'lobster shack', 'cajun seafood'],
    avoidIngredients: ['shrimp', 'crab', 'lobster', 'oyster', 'mussels', 'clams', 'scallops', 'crawfish', 'prawns'],
    safeKeywords: ['shellfish-free', 'allergy-aware', 'allergen menu'],
    promptSeverity: 'critical' // Life-threatening
  },
  'fish-free': {
    name: 'Fish Allergy',
    avoidCuisines: ['sushi', 'seafood restaurant', 'fish market', 'poke bowl'],
    avoidIngredients: ['fish', 'salmon', 'tuna', 'cod', 'anchovies', 'fish sauce', 'caesar dressing', 'worcestershire'],
    safeKeywords: ['fish-free', 'allergy-aware', 'no fish'],
    promptSeverity: 'critical' // Life-threatening
  },
  'egg-free': {
    name: 'Egg Allergy',
    avoidCuisines: ['bakery', 'breakfast spot', 'brunch place'],
    avoidIngredients: ['eggs', 'egg whites', 'mayonnaise', 'meringue', 'custard', 'hollandaise'],
    safeKeywords: ['egg-free', 'vegan', 'allergy-aware'],
    promptSeverity: 'high'
  },
  'soy-free': {
    name: 'Soy Allergy',
    avoidCuisines: ['japanese', 'chinese', 'korean', 'asian fusion'],
    avoidIngredients: ['soy', 'soy sauce', 'tofu', 'edamame', 'tempeh', 'miso', 'soybean'],
    safeKeywords: ['soy-free', 'allergy-aware', 'no soy'],
    promptSeverity: 'high'
  },
  'pescatarian': {
    name: 'Pescatarian',
    avoidCuisines: ['steakhouse', 'bbq', 'barbecue', 'churrascaria', 'korean bbq'],
    avoidIngredients: ['beef', 'pork', 'chicken', 'lamb', 'bacon', 'ham', 'meat'],
    safeKeywords: ['seafood', 'fish', 'vegetarian', 'pescatarian-friendly'],
    promptSeverity: 'high'
  },
  'low-fodmap': {
    name: 'Low-FODMAP',
    avoidCuisines: ['italian pasta', 'indian', 'mexican'],
    avoidIngredients: ['garlic', 'onion', 'wheat', 'beans', 'lentils', 'chickpeas', 'apples', 'pears', 'honey', 'milk'],
    safeKeywords: ['low-fodmap', 'fodmap-friendly', 'ibs-friendly'],
    promptSeverity: 'high'
  },
  'keto': {
    name: 'Keto/Low-Carb',
    avoidCuisines: ['bakery', 'pasta restaurant', 'pizzeria', 'noodle house', 'dessert shop'],
    avoidIngredients: ['bread', 'pasta', 'rice', 'potatoes', 'sugar', 'flour', 'noodles'],
    safeKeywords: ['keto', 'low-carb', 'keto-friendly', 'high-fat'],
    promptSeverity: 'medium'
  },
  'paleo': {
    name: 'Paleo',
    avoidCuisines: ['bakery', 'pasta restaurant', 'fast food'],
    avoidIngredients: ['grains', 'dairy', 'legumes', 'processed foods', 'sugar', 'bread', 'pasta'],
    safeKeywords: ['paleo', 'paleo-friendly', 'whole30', 'grain-free'],
    promptSeverity: 'medium'
  }
};

// =============================================================================
// FUZZY MATCHING - Match user input to rule key
// =============================================================================

/**
 * Fuzzy match a user's dietary restriction input to our rule lookup.
 * Handles variations like "gluten free", "gluten-free", "no gluten", etc.
 */
export function matchDietaryRule(restriction: string): DietaryRule | null {
  if (!restriction || restriction.trim().length === 0) return null;
  
  const normalized = restriction.toLowerCase().trim()
    .replace(/^i'?m /, '')              // "i'm allergic to..."
    .replace(/^i (have|am) (a |an )?/, '') // "i have a peanut allergy"
    .replace(/^a /, '')                 // "a peanut allergy"
    .replace(/allergic to /g, '')       // anywhere, not just prefix
    .replace(/intolerant to /g, '')
    .replace(/ allergy$/, '')           // "peanut allergy" (with space)
    .replace(/allergy$/, '')
    .replace(/ intolerance$/, '')
    .replace(/intolerance$/, '')
    .replace(/-free$/, '')
    .replace(/_free$/, '')
    .replace(/ free$/, '')
    .replace(/^no /, '')
    .replace(/^no-/, '')
    .trim();
  
  // Direct match
  if (DIETARY_RULES[normalized]) return DIETARY_RULES[normalized];
  
  // Check with -free suffix
  if (DIETARY_RULES[`${normalized}-free`]) return DIETARY_RULES[`${normalized}-free`];

  // Singularized direct/-free match (e.g. "peanuts" → "peanut" → "peanut-free")
  const singular = normalized.replace(/s$/, '');
  if (singular !== normalized) {
    if (DIETARY_RULES[singular]) return DIETARY_RULES[singular];
    if (DIETARY_RULES[`${singular}-free`]) return DIETARY_RULES[`${singular}-free`];
  }

  // Allergen / canonical aliases — checked BEFORE permissive substring loop
  // so canonical matches win over loose substring hits.
  const allergenAliases: Record<string, string> = {
    'peanut': 'peanut-free',
    'peanuts': 'peanut-free',
    'tree nut': 'nut-free',
    'tree nuts': 'nut-free',
    'nut': 'nut-free',
    'nuts': 'nut-free',
    'shellfish': 'shellfish-free',
    'fish': 'fish-free',
    'egg': 'egg-free',
    'eggs': 'egg-free',
    'soy': 'soy-free',
    'wheat': 'gluten-free',
    'gluten': 'gluten-free',
    'dairy': 'dairy-free',
    'milk': 'dairy-free',
    'lactose': 'dairy-free',
    'lactose intolerant': 'dairy-free',
    'celiac': 'gluten-free',
    'coeliac': 'gluten-free',
    'plant-based': 'vegan',
    'plant based': 'vegan',
    'no meat': 'vegetarian',
    'muslim': 'halal',
    'jewish': 'kosher',
  };
  if (allergenAliases[normalized] && DIETARY_RULES[allergenAliases[normalized]]) {
    return DIETARY_RULES[allergenAliases[normalized]];
  }
  for (const [alias, key] of Object.entries(allergenAliases)) {
    if (normalized.includes(alias)) {
      return DIETARY_RULES[key] || null;
    }
  }
  
  // Fuzzy match - check if normalized includes key or vice versa (last resort)
  for (const [key, rule] of Object.entries(DIETARY_RULES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return rule;
    }
  }
  
  return null;
}

// =============================================================================
// PROMPT BUILDER - Dynamic dietary constraint prompt
// =============================================================================

/**
 * Build a dynamic dietary enforcement prompt section for the AI.
 * This creates highly visible, non-negotiable constraints.
 */
export function buildDietaryEnforcementPrompt(restrictions: string[]): string {
  if (!restrictions || restrictions.length === 0) return '';
  
  const lines: string[] = [];
  lines.push('');
  lines.push('🚨🚨🚨 CRITICAL DIETARY CONSTRAINTS 🚨🚨🚨');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push('THE FOLLOWING DIETARY RESTRICTIONS ARE NON-NEGOTIABLE.');
  lines.push('EVERY DINING RECOMMENDATION MUST FULLY COMPLY.');
  lines.push('VIOLATIONS WILL CAUSE THE ITINERARY TO BE REJECTED.');
  lines.push('');
  
  let hasAnyRule = false;
  
  for (const restriction of restrictions) {
    const rule = matchDietaryRule(restriction);
    if (rule) {
      hasAnyRule = true;
      const severityEmoji = rule.promptSeverity === 'critical' ? '⛔' : rule.promptSeverity === 'high' ? '🔴' : '🟡';
      
      lines.push(`${severityEmoji} ${rule.name.toUpperCase()} RESTRICTION`);
      lines.push(`   Severity: ${rule.promptSeverity.toUpperCase()}${rule.promptSeverity === 'critical' ? ' (may be life-threatening)' : ''}`);
      lines.push(`   ❌ AVOID CUISINES: ${rule.avoidCuisines.join(', ')}`);
      lines.push(`   ❌ AVOID INGREDIENTS: ${rule.avoidIngredients.join(', ')}`);
      lines.push(`   ✅ LOOK FOR: ${rule.safeKeywords.join(', ')}`);
      lines.push('');
    } else {
      // Custom restriction not in our lookup - still enforce it
      hasAnyRule = true;
      lines.push(`⚠️ CUSTOM RESTRICTION: ${restriction.toUpperCase()}`);
      lines.push(`   Ensure ALL dining recommendations accommodate this requirement`);
      lines.push(`   When in doubt, choose venues with diverse menu options`);
      lines.push('');
    }
  }
  
  if (!hasAnyRule) return '';
  
  lines.push('═'.repeat(60));
  lines.push('ENFORCEMENT RULES:');
  lines.push('1. NEVER recommend venues that specialize in avoided cuisines');
  lines.push('2. ALWAYS verify menu can accommodate restrictions before recommending');
  lines.push('3. PREFER venues with explicit dietary-friendly labeling');
  lines.push('4. Include dietary accommodation notes in activity descriptions');
  lines.push('5. For critical allergies, recommend venues with allergen awareness');
  lines.push('═'.repeat(60));
  lines.push('');
  
  return lines.join('\n');
}

// =============================================================================
// AVOID LIST EXPANSION - For automatic exclusion
// =============================================================================

/**
 * Expand a list of dietary restrictions into a comprehensive avoid list.
 * This is used to automatically add cuisines/ingredients to the skip list.
 */
export function expandDietaryAvoidList(restrictions: string[]): string[] {
  if (!restrictions || restrictions.length === 0) return [];
  
  const avoids: string[] = [];
  
  for (const restriction of restrictions) {
    const rule = matchDietaryRule(restriction);
    if (rule) {
      avoids.push(...rule.avoidCuisines);
      avoids.push(...rule.avoidIngredients);
    }
  }
  
  // Deduplicate and return
  return [...new Set(avoids)];
}

/**
 * Get the maximum severity level from a list of restrictions.
 * Used to determine how strict validation should be.
 */
export function getMaxDietarySeverity(restrictions: string[]): 'critical' | 'high' | 'medium' | 'none' {
  if (!restrictions || restrictions.length === 0) return 'none';
  
  let maxSeverity: 'critical' | 'high' | 'medium' | 'none' = 'none';
  const severityOrder = { 'none': 0, 'medium': 1, 'high': 2, 'critical': 3 };
  
  for (const restriction of restrictions) {
    const rule = matchDietaryRule(restriction);
    if (rule && severityOrder[rule.promptSeverity] > severityOrder[maxSeverity]) {
      maxSeverity = rule.promptSeverity;
    }
  }
  
  return maxSeverity;
}

// =============================================================================
// VALIDATION HELPERS - For checking generated content
// =============================================================================

export interface DietaryViolation {
  restriction: string;
  ruleName: string;
  violationType: 'cuisine' | 'ingredient';
  violatedTerm: string;
  severity: 'critical' | 'high' | 'medium';
}

/**
 * Check if a dining activity violates any dietary restrictions.
 * Returns all violations found.
 */
export function checkDietaryViolations(
  activityTitle: string,
  activityDescription: string,
  activityTags: string[],
  restrictions: string[]
): DietaryViolation[] {
  if (!restrictions || restrictions.length === 0) return [];
  
  const violations: DietaryViolation[] = [];
  const titleLower = activityTitle.toLowerCase();
  const descLower = activityDescription.toLowerCase();
  const tagsLower = activityTags.map(t => t.toLowerCase());
  const allText = `${titleLower} ${descLower} ${tagsLower.join(' ')}`;
  
  for (const restriction of restrictions) {
    const rule = matchDietaryRule(restriction);
    if (!rule) continue;
    
    // Check cuisine violations
    for (const cuisine of rule.avoidCuisines) {
      const cuisineLower = cuisine.toLowerCase();
      if (allText.includes(cuisineLower)) {
        violations.push({
          restriction,
          ruleName: rule.name,
          violationType: 'cuisine',
          violatedTerm: cuisine,
          severity: rule.promptSeverity
        });
      }
    }
    
    // Check ingredient violations
    for (const ingredient of rule.avoidIngredients) {
      const ingredientLower = ingredient.toLowerCase();
      // Be more careful with short terms - require word boundaries
      if (ingredientLower.length <= 3) {
        const regex = new RegExp(`\\b${ingredientLower}\\b`, 'i');
        if (regex.test(allText)) {
          violations.push({
            restriction,
            ruleName: rule.name,
            violationType: 'ingredient',
            violatedTerm: ingredient,
            severity: rule.promptSeverity
          });
        }
      } else if (allText.includes(ingredientLower)) {
        violations.push({
          restriction,
          ruleName: rule.name,
          violationType: 'ingredient',
          violatedTerm: ingredient,
          severity: rule.promptSeverity
        });
      }
    }
  }
  
  return violations;
}

/**
 * Check if a dining activity mentions safe keywords for the restrictions.
 * Positive indicator that the venue can accommodate.
 */
export function hasDietarySafeKeywords(
  activityTitle: string,
  activityDescription: string,
  activityTags: string[],
  restrictions: string[]
): boolean {
  if (!restrictions || restrictions.length === 0) return true;
  
  const allText = `${activityTitle} ${activityDescription} ${activityTags.join(' ')}`.toLowerCase();
  
  for (const restriction of restrictions) {
    const rule = matchDietaryRule(restriction);
    if (!rule) continue;
    
    // Check if ANY safe keyword is present
    for (const keyword of rule.safeKeywords) {
      if (allText.includes(keyword.toLowerCase())) {
        return true;
      }
    }
  }
  
  return false;
}
