/**
 * Intelligence Analytics Utility
 * 
 * Analyzes itinerary data to extract and quantify the intelligence layers.
 * This surfaces the "hidden" value that differentiates Voyance from generic guides.
 */

import type { ItineraryValueStats } from '@/components/itinerary/ItineraryValueHeader';
import type { SkippedItem } from '@/components/itinerary/WhyWeSkippedSection';
import type { ActivityIntelligence } from '@/components/itinerary/IntelligenceBadge';

// Known hidden gem neighborhoods/experiences (expandable)
const HIDDEN_GEM_INDICATORS = [
  // Neighborhoods tourists miss
  'yanaka', 'shimokitazawa', 'koenji', 'testaccio', 'pigneto', 'gràcia',
  'el born', 'belleville', 'canal saint-martin', 'bermondsey', 'leadenhall',
  // Off-path experiences
  'local favorite', 'locals only', 'off the beaten', 'hidden', 'secret',
  'undiscovered', 'unknown', 'lesser-known',
];

// Timing indicators that suggest intentional scheduling
const TIMING_HACK_INDICATORS = [
  'before the crowds', 'early morning', 'before 9', 'before 10',
  'avoid crowds', 'skip the line', 'empty', 'peaceful', 'quiet',
  'golden hour', 'sunset', 'after dark', 'late night',
  'locals\' time', 'off-peak',
];

/**
 * Detect if an activity is a hidden gem based on various signals
 */
export function isHiddenGem(
  activityName: string,
  description?: string,
  tips?: string,
  crowdLevel?: string
): boolean {
  const searchText = `${activityName} ${description || ''} ${tips || ''}`.toLowerCase();
  
  // Check for hidden gem indicators
  const hasIndicator = HIDDEN_GEM_INDICATORS.some(indicator => 
    searchText.includes(indicator)
  );
  
  // Low crowd level is a strong signal
  const hasLowCrowd = crowdLevel === 'low';
  
  return hasIndicator || hasLowCrowd;
}

/**
 * Detect if an activity has timing optimization
 */
export function hasTimingOptimization(
  description?: string,
  tips?: string,
  bestTime?: string
): boolean {
  const searchText = `${description || ''} ${tips || ''} ${bestTime || ''}`.toLowerCase();
  
  return TIMING_HACK_INDICATORS.some(indicator => 
    searchText.includes(indicator)
  );
}

/**
 * Extract timing reason from activity data
 */
export function extractTimingReason(
  description?: string,
  tips?: string,
  bestTime?: string
): string | undefined {
  // Check tips first as they're most specific
  if (tips) {
    const timingMatch = tips.match(/arrive (before|early|at).*?[.!]/i) ||
                       tips.match(/(morning|evening|sunset|before \d).*?[.!]/i) ||
                       tips.match(/(avoid|skip|beat).*?crowd.*?[.!]/i);
    if (timingMatch) return timingMatch[0];
  }
  
  if (bestTime) {
    return `Best visited during ${bestTime}`;
  }
  
  return undefined;
}

/**
 * Detect time of day from scheduled time
 */
export function getTimeOfDay(time: string): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = parseInt(time.split(':')[0], 10);
  const isPM = time.toLowerCase().includes('pm');
  const normalizedHour = isPM && hour !== 12 ? hour + 12 : hour;
  
  if (normalizedHour < 12) return 'morning';
  if (normalizedHour < 17) return 'afternoon';
  if (normalizedHour < 21) return 'evening';
  return 'night';
}

/**
 * Analyze a single activity for intelligence signals
 */
export function analyzeActivityIntelligence(activity: {
  name?: string;
  title?: string;
  description?: string;
  tips?: string;
  bestTime?: string;
  crowdLevel?: string;
  personalization?: {
    whyThisFits?: string;
    tags?: string[];
    confidence?: number;
  };
  isHiddenGem?: boolean;
}): ActivityIntelligence {
  const name = activity.name || activity.title || '';
  const description = activity.description || '';
  const tips = activity.tips || '';
  
  // Explicit hidden gem flag from backend
  const hiddenGem = activity.isHiddenGem || isHiddenGem(name, description, tips, activity.crowdLevel);
  
  // Timing optimization
  const timingHack = hasTimingOptimization(description, tips, activity.bestTime);
  const timingReason = timingHack ? extractTimingReason(description, tips, activity.bestTime) : undefined;
  
  // Personalization
  const isPersonalized = !!(activity.personalization?.whyThisFits);
  
  return {
    isHiddenGem: hiddenGem,
    hasTimingHack: timingHack,
    hasInsiderTip: !!tips && tips.length > 10,
    isOffThePath: hiddenGem && activity.crowdLevel === 'low',
    isPersonalized,
    timingReason,
    insiderTip: tips || undefined,
    personalizationReason: activity.personalization?.whyThisFits,
    crowdLevel: activity.crowdLevel as 'low' | 'moderate' | 'high' | undefined,
  };
}

/**
 * Calculate aggregate value stats for an entire itinerary
 */
export function calculateItineraryValueStats(
  days: Array<{
    activities: Array<{
      name?: string;
      title?: string;
      description?: string;
      tips?: string;
      bestTime?: string;
      crowdLevel?: string;
      personalization?: {
        whyThisFits?: string;
        tags?: string[];
      };
      isHiddenGem?: boolean;
    }>;
  }>,
  skippedItems?: SkippedItem[]
): ItineraryValueStats {
  let voyanceFinds = 0;
  let timingOptimizations = 0;
  let insiderTips = 0;

  days.forEach(day => {
    day.activities.forEach(activity => {
      const intelligence = analyzeActivityIntelligence(activity);
      
      if (intelligence.isHiddenGem) voyanceFinds++;
      if (intelligence.hasTimingHack) timingOptimizations++;
      if (intelligence.hasInsiderTip) insiderTips++;
    });
  });

  return {
    voyanceFinds,
    timingOptimizations,
    touristTrapsAvoided: skippedItems?.length || 0,
    insiderTips,
    estimatedSavings: calculateEstimatedSavings(timingOptimizations, skippedItems?.length || 0),
  };
}

/**
 * Estimate time and money savings based on optimizations
 */
function calculateEstimatedSavings(
  timingOptimizations: number,
  trapsAvoided: number
): { time: string; money?: string } | undefined {
  if (timingOptimizations === 0 && trapsAvoided === 0) return undefined;
  
  // Rough estimates: 15-30 min saved per timing optimization, $20-50 per trap avoided
  const minutesSaved = timingOptimizations * 20;
  const moneySaved = trapsAvoided * 30;
  
  const hours = Math.floor(minutesSaved / 60);
  const timeStr = hours > 0 ? `${hours}+ hours` : `${minutesSaved}+ minutes`;
  
  return {
    time: timeStr,
    money: moneySaved > 0 ? `$${moneySaved}` : undefined,
  };
}

/**
 * Get default skipped items for a destination
 */
export function getDestinationSkippedItems(destination: string): SkippedItem[] {
  const city = destination.toLowerCase();
  
  // Curated skip lists per destination
  const skipLists: Record<string, SkippedItem[]> = {
    tokyo: [
      {
        name: 'Robot Restaurant',
        reason: 'Overpriced gimmick at $80+. The "robots" are people in costumes, the food is terrible, and locals never go.',
        category: 'tourist-trap',
        savingsEstimate: { money: '$80', time: '3 hours' },
      },
      {
        name: 'Tokyo Skytree',
        reason: 'Expensive ticket ($30), always crowded, and the view isn\'t better than free alternatives.',
        category: 'overpriced',
        savingsEstimate: { money: '$30', time: '90 min' },
        betterAlternative: 'Shibuya Sky or Tokyo Tower at sunset',
      },
      {
        name: 'Tsukiji sushi sit-down restaurants',
        reason: 'The wholesale market moved to Toyosu in 2018. Tourist-facing restaurants now cater to visitors with inflated prices.',
        category: 'overhyped',
        betterAlternative: 'Standing sushi at outer market stalls',
      },
    ],
    rome: [
      {
        name: 'Restaurants on Piazza Navona',
        reason: 'Triple the price for half the quality. No Roman would eat here. Beautiful square, terrible food.',
        category: 'tourist-trap',
        savingsEstimate: { money: '$40' },
        betterAlternative: 'Trattoria in Testaccio or Jewish Ghetto',
      },
      {
        name: 'Street vendors selling "leather"',
        reason: 'Fake leather products at inflated prices. Real Italian leather shops don\'t hawk on streets.',
        category: 'tourist-trap',
      },
      {
        name: 'Cafes on Spanish Steps',
        reason: 'You\'re paying for the view, not the coffee. A €2 espresso becomes €8.',
        category: 'overpriced',
        savingsEstimate: { money: '$20' },
      },
    ],
    paris: [
      {
        name: 'Champs-Élysées restaurants',
        reason: 'Chain restaurants with frozen food at premium prices. The avenue is for walking, not eating.',
        category: 'tourist-trap',
        savingsEstimate: { money: '$30' },
        betterAlternative: 'Le Marais or Canal Saint-Martin',
      },
      {
        name: 'Montmartre portrait artists',
        reason: 'Overpriced and often pushy. €50+ for a quick sketch. Watch but don\'t buy.',
        category: 'overpriced',
      },
      {
        name: 'Seine dinner cruises',
        reason: 'Mediocre buffet food, crowded boats, expensive. Better to walk the Seine at sunset.',
        category: 'overhyped',
        savingsEstimate: { money: '$80' },
      },
    ],
    london: [
      {
        name: 'Leicester Square restaurants',
        reason: 'Tourist trap central. Overpriced chains, aggressive touts, and no character.',
        category: 'tourist-trap',
        savingsEstimate: { money: '$25' },
        betterAlternative: 'Borough Market or Soho side streets',
      },
      {
        name: 'Oxford Street shopping',
        reason: 'Same stores as every other city. Overcrowded. London has unique boutiques elsewhere.',
        category: 'overcrowded',
        betterAlternative: 'Carnaby Street or Shoreditch',
      },
      {
        name: 'Hard Rock Cafe',
        reason: 'You didn\'t fly to London to eat American burgers. The line is for tourists only.',
        category: 'tourist-trap',
      },
    ],
    barcelona: [
      {
        name: 'La Rambla restaurants',
        reason: 'Terrible food, aggressive waiters, pickpocket central. Walk it, don\'t eat on it.',
        category: 'tourist-trap',
        savingsEstimate: { money: '$25' },
        betterAlternative: 'El Born or Gràcia tapas bars',
      },
      {
        name: 'Front stalls at La Boqueria',
        reason: 'Overpriced fruit cups and tourist-priced smoothies. Go deeper into the market or skip.',
        category: 'overpriced',
        betterAlternative: 'Sant Antoni Market',
      },
      {
        name: 'Barceloneta beachfront restaurants',
        reason: 'Paella made for tourists, not Spaniards. Frozen seafood at beach prices.',
        category: 'overhyped',
        betterAlternative: 'Barceloneta side streets or port area',
      },
    ],
  };

  // Find matching city
  const matchedCity = Object.keys(skipLists).find(key => 
    city.includes(key) || key.includes(city)
  );

  return matchedCity ? skipLists[matchedCity] : [];
}
