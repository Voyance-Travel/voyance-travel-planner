/**
 * Intelligence Analytics Utility
 * 
 * Analyzes itinerary data to extract and quantify the intelligence layers.
 * Uses a hybrid approach: trusts explicit AI flags when present,
 * but also derives insights from activity metadata (tips, personalization,
 * crowd levels, timing) when explicit flags are missing.
 */

import type { ItineraryValueStats } from '@/components/itinerary/ItineraryValueHeader';
import type { SkippedItem } from '@/components/itinerary/WhyWeSkippedSection';
import type { ActivityIntelligence } from '@/components/itinerary/IntelligenceBadge';
import { parseTimeToMinutes } from '@/utils/timeFormat';

/**
 * Detect time of day from scheduled time
 */
export function getTimeOfDay(time: string): 'morning' | 'afternoon' | 'evening' | 'night' {
  const minutes = parseTimeToMinutes(time);
  const hour = Math.floor(minutes / 60);
  
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

// Keywords indicating a timing optimization
const TIMING_KEYWORDS = [
  'before the crowds', 'avoid the rush', 'golden hour', 'sunrise', 'early morning',
  'before tour buses', 'less crowded', 'off-peak', 'before it gets busy',
  'best time', 'optimal time', 'quiet hours', 'before the lines',
  'at dusk', 'at dawn', 'at sunset', 'at sunrise', 'right when', 'opens at',
  'arrive early', 'beat the', 'ahead of', 'before it fills',
];

// Keywords indicating a hidden gem / unique find
const GEM_KEYWORDS = [
  'hidden', 'secret', 'locals only', 'off the beaten', 'lesser-known',
  'under the radar', 'undiscovered', 'tucked away', 'neighborhood favorite',
  'local favorite', 'insider', "locals' choice", 'boutique',
  'like a local', 'curated', 'unique find', 'only the locals',
  'working-class', 'off-the-tourist', 'zero tourists', 'nobody knows',
  'local haunt', 'neighborhood gem', 'under-the-radar', 'local institution',
];

// Categories that are never "hidden gems" (mainstream logistics)
const NON_GEM_CATEGORIES = ['transport', 'accommodation', 'downtime', 'free_time', 'logistics'];

/**
 * Analyze a single activity for intelligence signals.
 * Hybrid: trusts explicit AI flags first, then derives from metadata.
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
  hasTimingHack?: boolean;
  voyanceInsight?: string;
  category?: string;
}): ActivityIntelligence {
  const tips = activity.tips || '';
  const description = activity.description || '';
  const whyThisFits = activity.personalization?.whyThisFits || '';
  const combinedText = `${tips} ${description} ${whyThisFits} ${activity.voyanceInsight || ''}`.toLowerCase();
  const category = (activity.category || '').toLowerCase();
  
  // === Hidden Gem Detection ===
  // Explicit flag first, then heuristic
  const explicitGem = activity.isHiddenGem === true;
  const heuristicGem = !explicitGem && 
    !NON_GEM_CATEGORIES.includes(category) &&
    GEM_KEYWORDS.some(kw => combinedText.includes(kw));
  const isHiddenGem = explicitGem || heuristicGem;
  
  // === Timing Hack Detection ===
  const explicitTiming = activity.hasTimingHack === true;
  const heuristicTiming = !explicitTiming && 
    TIMING_KEYWORDS.some(kw => combinedText.includes(kw));
  const hasTimingHack = explicitTiming || heuristicTiming;
  
  // === Personalization Detection ===
  const isPersonalized = !!(whyThisFits && whyThisFits.length > 10);
  
  // === Insider Tip Detection ===
  // Substantial, specific tip (not just "enjoy!")
  const hasSubstantialTip = tips.length > 30;
  const hasInsiderTip = hasSubstantialTip;
  
  return {
    isHiddenGem,
    hasTimingHack,
    hasInsiderTip,
    isOffThePath: isHiddenGem && activity.crowdLevel === 'low',
    isPersonalized,
    timingReason: hasTimingHack ? (activity.bestTime || extractTimingReason(combinedText)) : undefined,
    insiderTip: hasSubstantialTip ? tips : undefined,
    personalizationReason: whyThisFits || undefined,
    crowdLevel: activity.crowdLevel as 'low' | 'moderate' | 'high' | undefined,
  };
}

/**
 * Extract a brief timing reason from text
 */
function extractTimingReason(text: string): string | undefined {
  for (const kw of TIMING_KEYWORDS) {
    const idx = text.indexOf(kw);
    if (idx >= 0) {
      // Get ~60 chars of context around the keyword
      const start = Math.max(0, idx - 10);
      const end = Math.min(text.length, idx + kw.length + 50);
      const snippet = text.slice(start, end).trim();
      // Capitalize first letter
      return snippet.charAt(0).toUpperCase() + snippet.slice(1);
    }
  }
  return undefined;
}

/**
 * Calculate aggregate value stats for an entire itinerary.
 * Hybrid: uses explicit AI flags + heuristic analysis for comprehensive coverage.
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
      category?: string;
      personalization?: {
        whyThisFits?: string;
        tags?: string[];
      };
      isHiddenGem?: boolean;
      hasTimingHack?: boolean;
      voyanceInsight?: string;
    }>;
  }>,
  skippedItems?: SkippedItem[]
): ItineraryValueStats {
  let voyanceFinds = 0;
  let timingOptimizations = 0;
  let insiderTips = 0;

  const voyanceFindsDetails: Array<{ title: string; reason?: string }> = [];
  const timingDetails: Array<{ title: string; reason?: string; savingsTime?: string }> = [];
  const insiderTipsDetails: Array<{ title: string; reason?: string }> = [];

  days.forEach(day => {
    day.activities.forEach(activity => {
      const intelligence = analyzeActivityIntelligence(activity);
      const activityName = activity.name || activity.title || 'Activity';
      
      if (intelligence.isHiddenGem) {
        voyanceFinds++;
        voyanceFindsDetails.push({
          title: activityName,
          reason: activity.personalization?.whyThisFits || 
                  activity.voyanceInsight ||
                  'Curated discovery off the typical tourist path',
        });
      }
      
      if (intelligence.hasTimingHack) {
        timingOptimizations++;
        timingDetails.push({
          title: activityName,
          reason: intelligence.timingReason || 'Scheduled to beat crowds',
          // savingsTime intentionally omitted — we don't have a verifiable per-item estimate
        });
      }
      
      if (intelligence.hasInsiderTip) {
        insiderTips++;
        insiderTipsDetails.push({
          title: activityName,
          reason: intelligence.insiderTip,
        });
      }
    });
  });

  // Convert skipped items to detail format (now "Local Picks")
  const trapsAvoidedDetails = skippedItems?.map(item => ({
    title: item.localAlternative || item.betterAlternative || item.name,
    reason: item.reason,
    savingsTime: item.savingsEstimate?.time,
    savingsMoney: item.savingsEstimate?.money,
  })) || [];

  const touristTrapsAvoided = skippedItems?.length || 0;

  return {
    voyanceFinds,
    timingOptimizations,
    touristTrapsAvoided,
    insiderTips,
    // Savings come ONLY from real skippedItems[].savingsEstimate — never fabricated
    estimatedSavings: aggregateSkippedSavings(skippedItems),
    voyanceFindsDetails: voyanceFindsDetails.slice(0, 5),
    timingDetails: timingDetails.slice(0, 5),
    trapsAvoidedDetails: trapsAvoidedDetails.slice(0, 5),
    insiderTipsDetails: insiderTipsDetails.slice(0, 5),
  };
}

/**
 * Parse a money string like "$40", "€25", "$1,200" → number of dollars.
 * Returns 0 for unparseable input. Currency symbol is informational only.
 */
export function parseMoneySavings(s?: string): number {
  if (!s || typeof s !== 'string') return 0;
  const m = s.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

/**
 * Parse a time savings string like "45 min", "3 hours", "1 hour", "2 hrs" → minutes.
 * Returns 0 for unparseable input.
 */
export function parseTimeSavings(s?: string): number {
  if (!s || typeof s !== 'string') return 0;
  const lower = s.toLowerCase();
  const num = lower.match(/(\d+(?:\.\d+)?)/);
  if (!num) return 0;
  const n = parseFloat(num[1]);
  if (/\bhour|\bhr/.test(lower)) return Math.round(n * 60);
  if (/\bday/.test(lower)) return Math.round(n * 60 * 24);
  // default to minutes
  return Math.round(n);
}

/**
 * Aggregate verifiable savings from skipped items only. No multipliers, no
 * fabricated per-category constants. Returns undefined when nothing is real.
 */
function aggregateSkippedSavings(
  skippedItems?: SkippedItem[],
): { time: string; money?: string } | undefined {
  if (!skippedItems || skippedItems.length === 0) return undefined;

  let totalMinutes = 0;
  let totalMoney = 0;
  for (const item of skippedItems) {
    totalMinutes += parseTimeSavings(item.savingsEstimate?.time);
    totalMoney += parseMoneySavings(item.savingsEstimate?.money);
  }

  if (totalMinutes === 0 && totalMoney === 0) return undefined;

  let timeStr: string | undefined;
  if (totalMinutes > 0) {
    const hours = Math.floor(totalMinutes / 60);
    if (hours >= 2) timeStr = `${hours}+ hours`;
    else if (hours === 1) timeStr = `1+ hour`;
    else timeStr = `${Math.round(totalMinutes / 5) * 5}+ min`;
  }

  return {
    time: timeStr || '',
    money: totalMoney > 0 ? `~$${Math.round(totalMoney)}` : undefined,
  };
}

/**
 * Estimate time and money savings — only from verified intelligence items
 */
function calculateEstimatedSavings(
  timingOptimizations: number,
  localPicks: number,
  hiddenGems: number,
): { time: string; money?: string } | undefined {
  const timingMinutes = timingOptimizations * 25;
  const localPickMoney = localPicks * 35;
  const hiddenGemMoney = hiddenGems * 18;
  
  const totalMinutes = timingMinutes;
  const totalMoney = localPickMoney + hiddenGemMoney;
  
  if (totalMinutes === 0 && totalMoney === 0) return undefined;
  
  let timeStr: string | undefined;
  if (totalMinutes > 0) {
    const hours = Math.floor(totalMinutes / 60);
    if (hours >= 2) {
      timeStr = `${hours}+ hours`;
    } else if (hours === 1) {
      timeStr = `${hours}+ hour`;
    } else {
      timeStr = `${Math.round(totalMinutes / 5) * 5}+ min`;
    }
  }
  
  if (!timeStr && totalMoney === 0) return undefined;

  return {
    time: timeStr || 'Smart routing',
    money: totalMoney > 0 ? `~$${totalMoney}` : undefined,
  };
}

/**
 * Get default local alternatives for a destination
 */
export function getDestinationSkippedItems(destination: string): SkippedItem[] {
  const city = destination.toLowerCase();
  
  const localAlternatives: Record<string, SkippedItem[]> = {
    tokyo: [
      {
        name: 'Robot Restaurant',
        reason: 'For a more authentic Tokyo night out, Golden Gai\'s tiny bars offer genuine local atmosphere at a fraction of the cost.',
        category: 'local-favorite',
        savingsEstimate: { money: '$80', time: '3 hours' },
        betterAlternative: 'Golden Gai bars in Shinjuku',
      },
      {
        name: 'Tokyo Skytree',
        reason: 'Shibuya Sky offers equally stunning panoramic views with shorter waits and a more vibrant atmosphere.',
        category: 'better-value',
        savingsEstimate: { money: '$30', time: '90 min' },
        betterAlternative: 'Shibuya Sky or Tokyo Tower at sunset',
      },
      {
        name: 'Tsukiji sit-down restaurants',
        reason: 'Standing sushi at the outer market stalls is fresher, faster, and the way locals actually eat here.',
        category: 'insider-pick',
        betterAlternative: 'Standing sushi at outer market stalls',
      },
    ],
    rome: [
      {
        name: 'Piazza Navona restaurants',
        reason: 'Testaccio and the Jewish Ghetto offer authentic Roman cuisine at honest prices - where Romans actually eat.',
        category: 'local-favorite',
        savingsEstimate: { money: '$40' },
        betterAlternative: 'Trattoria in Testaccio or Jewish Ghetto',
      },
      {
        name: 'Trevi Fountain midday visit',
        reason: 'Visit at 7am or after 10pm for a magical, uncrowded experience with better photo opportunities.',
        category: 'insider-pick',
        savingsEstimate: { time: '45 min' },
        betterAlternative: 'Early morning or late night visit',
      },
      {
        name: 'Spanish Steps cafes',
        reason: 'Sant\'Eustachio Il Caffè serves what many consider Rome\'s best espresso at a fraction of the price.',
        category: 'better-value',
        savingsEstimate: { money: '$20' },
        betterAlternative: 'Sant\'Eustachio Il Caffè',
      },
    ],
    paris: [
      {
        name: 'Champs-Élysées restaurants',
        reason: 'Le Marais and Canal Saint-Martin have Paris\'s best dining scenes - locals flock there for a reason.',
        category: 'local-favorite',
        savingsEstimate: { money: '$30' },
        betterAlternative: 'Le Marais or Canal Saint-Martin',
      },
      {
        name: 'Seine dinner cruises',
        reason: 'A sunset walk along the Seine with wine from a local caviste is more romantic and authentically Parisian.',
        category: 'insider-pick',
        savingsEstimate: { money: '$80' },
        betterAlternative: 'Seine-side picnic at sunset',
      },
    ],
    london: [
      {
        name: 'Leicester Square restaurants',
        reason: 'Borough Market and Soho side streets offer incredible food diversity that Londoners actually love.',
        category: 'local-favorite',
        savingsEstimate: { money: '$25' },
        betterAlternative: 'Borough Market or Soho side streets',
      },
    ],
    barcelona: [
      {
        name: 'La Rambla restaurants',
        reason: 'El Born and Gràcia have Barcelona\'s best tapas bars - more authentic, better food, friendlier vibe.',
        category: 'local-favorite',
        savingsEstimate: { money: '$25' },
        betterAlternative: 'El Born or Gràcia tapas bars',
      },
    ],
    lisbon: [
      {
        name: 'Pastéis de Belém at peak hours',
        reason: 'Visit before 9am for the same legendary tarts with zero wait, or try Manteigaria for equally delicious pastéis.',
        category: 'insider-pick',
        savingsEstimate: { time: '45 min' },
        betterAlternative: 'Visit early morning or try Manteigaria',
      },
      {
        name: 'Tram 28 midday ride',
        reason: 'Walking Alfama\'s winding streets is more rewarding, or catch Tram 28 before 9am for a peaceful ride.',
        category: 'insider-pick',
        savingsEstimate: { time: '30 min' },
        betterAlternative: 'Walk Alfama or take Tram 28 before 9am',
      },
    ],
  };

  const matchedCity = Object.keys(localAlternatives).find(key => 
    city.includes(key) || key.includes(city)
  );

  return matchedCity ? localAlternatives[matchedCity] : [];
}
