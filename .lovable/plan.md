

# Dynamic Dietary & Preference Enforcement System

## Problem

The current dietary handling is:
1. **Weak prompting** - Line 733-735 only adds a brief mention: `"DIETARY: vegan"` without enforcement
2. **No avoidance rules** - Doesn't tell the AI what cuisine types to avoid for each restriction
3. **Only warnings, not rejections** - Lines 584-602 only issue `warnings` for dietary violations, never `violations`

The proposed fix was **too narrow** - it hardcoded vegan-only logic. You correctly want a **dynamic system** that handles ALL dietary restrictions equally.

---

## Solution: Dynamic Dietary Enforcement Engine

### Core Data Structure

Create a **dietary rules lookup table** that maps any restriction to:
- What to avoid (cuisine types, restaurant categories, ingredients)
- Positive keywords to look for (verified safe options)
- Severity level (how strictly to enforce)

```typescript
const DIETARY_RULES: Record<string, DietaryRule> = {
  'vegan': {
    name: 'Vegan',
    avoidCuisines: ['steakhouse', 'bbq', 'tonkatsu', 'yakiniku', 'seafood', 'ramen (standard)'],
    avoidIngredients: ['meat', 'fish', 'seafood', 'dairy', 'eggs', 'honey'],
    safeKeywords: ['vegan', 'plant-based', 'vegan-friendly'],
    promptSeverity: 'critical'
  },
  'vegetarian': {
    name: 'Vegetarian',
    avoidCuisines: ['steakhouse', 'bbq', 'tonkatsu', 'yakiniku'],
    avoidIngredients: ['meat', 'fish', 'seafood', 'pork', 'beef', 'chicken'],
    safeKeywords: ['vegetarian', 'veggie', 'meat-free'],
    promptSeverity: 'critical'
  },
  'halal': {
    name: 'Halal',
    avoidCuisines: ['pork restaurants', 'izakaya (alcohol-focused)', 'wine bars'],
    avoidIngredients: ['pork', 'bacon', 'ham', 'alcohol in cooking'],
    safeKeywords: ['halal', 'halal-certified', 'muslim-friendly'],
    promptSeverity: 'critical'
  },
  'kosher': {
    name: 'Kosher',
    avoidCuisines: ['seafood restaurants', 'pork-focused venues'],
    avoidIngredients: ['pork', 'shellfish', 'mixed meat-dairy'],
    safeKeywords: ['kosher', 'kosher-certified'],
    promptSeverity: 'critical'
  },
  'gluten-free': {
    name: 'Gluten-Free',
    avoidCuisines: ['ramen shops', 'udon shops', 'bakeries', 'pasta-focused'],
    avoidIngredients: ['wheat', 'barley', 'rye', 'gluten'],
    safeKeywords: ['gluten-free', 'gf', 'celiac-safe'],
    promptSeverity: 'high'
  },
  'dairy-free': {
    name: 'Dairy-Free',
    avoidCuisines: ['cheese-focused restaurants', 'fondue'],
    avoidIngredients: ['milk', 'cheese', 'cream', 'butter', 'yogurt'],
    safeKeywords: ['dairy-free', 'lactose-free', 'non-dairy'],
    promptSeverity: 'high'
  },
  'nut-free': {
    name: 'Nut Allergy',
    avoidCuisines: ['thai (peanut-heavy)', 'indian (cashew-heavy)'],
    avoidIngredients: ['peanuts', 'tree nuts', 'almonds', 'cashews', 'walnuts'],
    safeKeywords: ['nut-free', 'peanut-free', 'allergy-aware'],
    promptSeverity: 'critical' // Life-threatening
  },
  'shellfish-free': {
    name: 'Shellfish Allergy',
    avoidCuisines: ['seafood restaurants', 'sushi', 'crab houses'],
    avoidIngredients: ['shrimp', 'crab', 'lobster', 'oyster', 'mussels'],
    safeKeywords: ['shellfish-free', 'allergy-aware'],
    promptSeverity: 'critical' // Life-threatening
  }
};
```

---

### Implementation Details

#### 1. Dynamic Prompt Builder

In `prompt-library.ts`, create a function that dynamically builds dietary constraints:

```typescript
function buildDietaryEnforcementPrompt(restrictions: string[]): string {
  if (!restrictions.length) return '';
  
  const lines: string[] = [];
  lines.push('\n🚨🚨🚨 CRITICAL DIETARY CONSTRAINTS 🚨🚨🚨');
  lines.push('═'.repeat(60));
  
  for (const restriction of restrictions) {
    const rule = matchDietaryRule(restriction); // Fuzzy match to lookup table
    if (rule) {
      lines.push(`\n▶ ${rule.name.toUpperCase()} RESTRICTION`);
      lines.push(`  ❌ AVOID CUISINES: ${rule.avoidCuisines.join(', ')}`);
      lines.push(`  ❌ AVOID INGREDIENTS: ${rule.avoidIngredients.join(', ')}`);
      lines.push(`  ✅ LOOK FOR: ${rule.safeKeywords.join(', ')}`);
    } else {
      // Custom restriction - still enforce it dynamically
      lines.push(`\n▶ CUSTOM: ${restriction.toUpperCase()}`);
      lines.push(`  Ensure all dining accommodates this requirement`);
    }
  }
  
  lines.push('\n' + '═'.repeat(60));
  lines.push('ALL MEAL RECOMMENDATIONS MUST COMPLY - NO EXCEPTIONS');
  lines.push('═'.repeat(60));
  
  return lines.join('\n');
}
```

#### 2. Dynamic Avoid List Expansion

In `generate-itinerary/index.ts`, expand the avoid list based on dietary rules:

```typescript
function expandDietaryAvoidList(restrictions: string[]): string[] {
  const avoids: string[] = [];
  
  for (const restriction of restrictions) {
    const rule = matchDietaryRule(restriction);
    if (rule) {
      avoids.push(...rule.avoidCuisines);
      avoids.push(...rule.avoidIngredients);
    }
  }
  
  return [...new Set(avoids)]; // Deduplicate
}
```

#### 3. Upgraded Validation with Dynamic Checking

Replace the current weak warning with a **violation-level check**:

```typescript
// In validateItineraryPersonalization
if (activity.category === 'dining') {
  for (const restriction of ctx.dietaryRestrictions) {
    const rule = matchDietaryRule(restriction);
    if (!rule) continue;
    
    // Check for avoid list violations
    for (const avoid of rule.avoidCuisines) {
      if (titleLower.includes(avoid.toLowerCase()) || 
          descLower.includes(avoid.toLowerCase())) {
        violations.push({
          type: 'dietary',
          activityId: activity.id,
          activityTitle: activity.title,
          dayNumber: day.dayNumber,
          details: `"${activity.title}" is a ${avoid} venue - incompatible with ${rule.name}`,
          severity: rule.promptSeverity === 'critical' ? 'critical' : 'major'
        });
      }
    }
    
    // Check for ingredient violations
    for (const ingredient of rule.avoidIngredients) {
      if (descLower.includes(ingredient.toLowerCase())) {
        violations.push({
          type: 'dietary',
          activityId: activity.id,
          activityTitle: activity.title,
          dayNumber: day.dayNumber,
          details: `"${activity.title}" mentions "${ingredient}" - violates ${rule.name}`,
          severity: rule.promptSeverity === 'critical' ? 'critical' : 'major'
        });
      }
    }
  }
}
```

---

### Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/dietary-rules.ts` | **NEW** - Dietary rules lookup table and helper functions |
| `supabase/functions/generate-itinerary/prompt-library.ts` | Replace hardcoded dietary section with `buildDietaryEnforcementPrompt()` |
| `supabase/functions/generate-itinerary/index.ts` | 1. Import dietary rules, 2. Expand avoid list dynamically, 3. Upgrade validation to check against rules |

---

### Key Benefits

1. **Fully Dynamic** - Any new restriction added to the lookup table works automatically
2. **Custom Support** - Restrictions not in the lookup still get enforced with generic language
3. **Severity Aware** - Allergies (life-threatening) get `critical` violations, preferences get `major`
4. **Expandable** - Can add destination-specific rules (e.g., Japan-specific avoids for halal)
5. **Validates Both Ways** - Checks for bad cuisines AND bad ingredient mentions

---

## Technical Implementation

### New File: `dietary-rules.ts`

```typescript
// supabase/functions/generate-itinerary/dietary-rules.ts

export interface DietaryRule {
  name: string;
  avoidCuisines: string[];
  avoidIngredients: string[];
  safeKeywords: string[];
  promptSeverity: 'critical' | 'high' | 'medium';
}

export const DIETARY_RULES: Record<string, DietaryRule> = {
  // ... all rules as shown above
};

// Fuzzy match restriction to rule key
export function matchDietaryRule(restriction: string): DietaryRule | null {
  const normalized = restriction.toLowerCase().trim()
    .replace('-free', '')
    .replace('_free', '')
    .replace(' free', '');
  
  // Direct match
  if (DIETARY_RULES[normalized]) return DIETARY_RULES[normalized];
  
  // Fuzzy match
  for (const [key, rule] of Object.entries(DIETARY_RULES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return rule;
    }
  }
  
  return null;
}

export function buildDietaryEnforcementPrompt(restrictions: string[]): string {
  // Implementation as above
}

export function expandDietaryAvoidList(restrictions: string[]): string[] {
  // Implementation as above
}
```

---

## Expected Outcome

After implementation:
- **Vegan user** → All meat, dairy, seafood restaurants auto-avoided
- **Halal user** → Pork venues and alcohol-focused bars excluded
- **Nut allergy user** → Critical violation if any nut mention detected
- **Custom "no spicy food"** → Generic enforcement via prompt

All dietary types treated equally with the same dynamic system.

