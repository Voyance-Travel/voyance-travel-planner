// src/lib/costDna.ts  (C-CRED-4)
//
// SINGLE source for the {dietary, budget, specialOccasion} object used for BOTH
// the displayed trip-generation estimate AND the trips.cost_dna snapshot written
// at creation. Parity rule: whatever this returns is fed to calculateTripCredits
// (display) AND persisted to trips.cost_dna, so the server recompute matches what
// the user was shown.
//
// Maps the messy product vocabulary onto the formula's complexity enums. Only the
// factors actually collected in-product are derivable (dietary free-text,
// specialOccasion). budget='strict' is dead vocabulary today (the app produces
// budget/moderate/premium/luxury) so that factor stays absent until a 'strict'
// tier is introduced.
import type { TravelDNA } from '@/lib/tripCostCalculator';

export interface CostDnaSources {
  dietaryRestrictions?: string[] | string | null; // user_preferences.dietary_restrictions (free text)
  budgetTier?: string | null;                      // trips.budget_tier
  celebrationDay?: string | number | null;         // metadata.celebrationDay
  specialRequests?: string | null;                 // quiz specialRequests free text
}

const COMPLEX_DIETARY = ['vegan', 'allergy', 'halal', 'kosher'];

/** Map product fields onto the formula's complexity enums. */
export function buildCostDna(src: CostDnaSources): TravelDNA {
  // dietary: scan free text for a complex-diet keyword; 'allergy' if an allergy is mentioned.
  const raw = Array.isArray(src.dietaryRestrictions)
    ? src.dietaryRestrictions.join(' ')
    : (src.dietaryRestrictions || '');
  const low = raw.toLowerCase();
  let dietary: string | undefined;
  if (/\ballerg/.test(low)) dietary = 'allergy';
  else dietary = COMPLEX_DIETARY.find((k) => low.includes(k));

  // budget: the formula only recognizes 'strict'. No product value maps to it today.
  const budget = src.budgetTier === 'strict' ? 'strict' : undefined;

  const specialOccasion =
    (src.celebrationDay ? String(src.celebrationDay) : undefined) ||
    (src.specialRequests?.trim() || undefined);

  return { dietary, budget, specialOccasion: specialOccasion ?? null };
}
