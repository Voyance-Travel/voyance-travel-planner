/**
 * Client-side mirror of the server's AI_STUB_VENUE_PATTERNS
 * (supabase/functions/generate-itinerary/fix-placeholders.ts).
 *
 * Catches French/Italian-styled stub names the AI invents for dining slots
 * (e.g. "Café Matinal", "Table du Quartier", "Bistrot du Marché",
 * "Le Comptoir du Midi", "Brasserie de la Gare", "Boulangerie du Quartier").
 *
 * Per the Meal Rules core memory these are BANNED — never display them.
 */

const AI_STUB_VENUE_PATTERNS: RegExp[] = [
  // <Venue-noun> (du|de la|des|de|del|della) <generic filler>
  /^(le |la |il |el )?(table|bistrot|brasserie|caf[eé]|comptoir|boulangerie|p[âa]tisserie|trattoria|osteria|taverna|restaurant|maison|petit|grand|bar|cave)\s+(du|de la|des|de|del|della|dei)\s+(quartier|march[ée]|coin|place|soir|midi|matin|gare|arts|jardin|vins|coeur|nord|sud|est|ouest|centre|village|port|pont)\b/i,
  // "Café Matinal" / "Le Petit Matin" / "La Petite Place"
  /^(le |la )?(petit|petite|grand|grande|caf[eé])\s+(matin|matinal|matinale|soir|midi|jardin|comptoir|march[ée]|place|coin)\b/i,
  // Catch-all for the legacy template strings (case-insensitive exact)
  /^(caf[eé] matinal|boulangerie du quartier|le petit matin|caf[eé] des arts|p[âa]tisserie du coin|bistrot du march[ée]|le comptoir du midi|brasserie du coin|caf[eé] de la place|table du quartier|restaurant le jardin|la table du soir|le petit comptoir|brasserie de la gare|restaurant du march[ée]|le bar du coin|comptoir des vins|le petit bar|bar de la place|cave [àa] vins)$/i,
];

const MEAL_LABEL_RE = /^(breakfast|brunch|lunch|dinner|supper|drinks|meal)\s*[:\-—–]?\s*(at\s+)?/i;

export function isAIStubVenueName(name: string | undefined | null): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (AI_STUB_VENUE_PATTERNS.some((re) => re.test(trimmed))) return true;
  // Strip leading meal label ("Lunch at Table du Quartier") and re-test
  const stripped = trimmed.replace(MEAL_LABEL_RE, '').trim();
  if (stripped && stripped !== trimmed && AI_STUB_VENUE_PATTERNS.some((re) => re.test(stripped))) {
    return true;
  }
  return false;
}

export type MealType = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'drinks' | 'meal';

export function inferMealTypeFromTitle(title: string | undefined | null): MealType | null {
  if (!title) return null;
  const m = MEAL_LABEL_RE.exec(title.trim());
  if (!m) return null;
  const k = m[1].toLowerCase();
  if (k === 'supper') return 'dinner';
  return k as MealType;
}

export function inferMealTypeFromTime(startTime: string | undefined | null): MealType | null {
  if (!startTime) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(startTime.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 17) return 'meal';
  return 'dinner';
}

export function stubFallbackLabel(meal: MealType | null | undefined): string {
  switch (meal) {
    case 'breakfast': return 'Breakfast — tap to choose a venue';
    case 'brunch': return 'Brunch — tap to choose a venue';
    case 'lunch': return 'Lunch — tap to choose a venue';
    case 'dinner': return 'Dinner — tap to choose a venue';
    case 'drinks': return 'Drinks — tap to choose a venue';
    default: return 'Meal — tap to choose a venue';
  }
}

export const STUB_VENUE_DISPLAY = 'Tap to choose a venue';
