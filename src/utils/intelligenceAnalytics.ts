/**
 * Intelligence Analytics Utility
 * 
 * Analyzes itinerary data to extract and quantify the intelligence layers.
 * Only counts genuine intelligence signals from the AI generation pipeline —
 * NOT text-pattern heuristics that produce false positives.
 */

import type { ItineraryValueStats } from '@/components/itinerary/ItineraryValueHeader';
import type { SkippedItem } from '@/components/itinerary/WhyWeSkippedSection';
import type { ActivityIntelligence } from '@/components/itinerary/IntelligenceBadge';

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
 * Analyze a single activity for intelligence signals.
 * Only trusts explicit flags from the AI, not text matching.
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
}): ActivityIntelligence {
  const tips = activity.tips || '';
  
  // Only trust explicit AI flags — no text-matching heuristics
  const hiddenGem = activity.isHiddenGem === true;
  const timingHack = activity.hasTimingHack === true;
  const isPersonalized = !!(activity.personalization?.whyThisFits);
  const hasSubstantialTip = !!tips && tips.length > 30; // Must be a real tip, not filler
  
  return {
    isHiddenGem: hiddenGem,
    hasTimingHack: timingHack,
    hasInsiderTip: hasSubstantialTip && isPersonalized, // Only count tips that are personalized
    isOffThePath: hiddenGem && activity.crowdLevel === 'low',
    isPersonalized,
    timingReason: timingHack ? (activity.bestTime || undefined) : undefined,
    insiderTip: hasSubstantialTip ? tips : undefined,
    personalizationReason: activity.personalization?.whyThisFits,
    crowdLevel: activity.crowdLevel as 'low' | 'moderate' | 'high' | undefined,
  };
}

/**
 * Calculate aggregate value stats for an entire itinerary.
 * Conservative: only counts items with explicit AI-generated intelligence flags.
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
          reason: intelligence.timingReason || 'Scheduled to avoid peak crowds',
          savingsTime: '20-30 min',
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

  // Convert skipped items to detail format
  const trapsAvoidedDetails = skippedItems?.map(item => ({
    title: item.name,
    reason: item.reason,
    savingsTime: item.savingsEstimate?.time,
    savingsMoney: item.savingsEstimate?.money,
  })) || [];

  const touristTrapsAvoided = skippedItems?.length || 0;

  // Only show savings if we have real data to back it up
  const hasRealIntelligence = voyanceFinds > 0 || timingOptimizations > 0 || touristTrapsAvoided > 0 || insiderTips > 0;

  return {
    voyanceFinds,
    timingOptimizations,
    touristTrapsAvoided,
    insiderTips,
    estimatedSavings: hasRealIntelligence 
      ? calculateEstimatedSavings(timingOptimizations, touristTrapsAvoided, voyanceFinds)
      : undefined,
    voyanceFindsDetails: voyanceFindsDetails.slice(0, 5),
    timingDetails: timingDetails.slice(0, 5),
    trapsAvoidedDetails: trapsAvoidedDetails.slice(0, 5),
    insiderTipsDetails: insiderTipsDetails.slice(0, 5),
  };
}

/**
 * Estimate time and money savings — only from verified intelligence items
 */
function calculateEstimatedSavings(
  timingOptimizations: number,
  trapsAvoided: number,
  hiddenGems: number,
): { time: string; money?: string } | undefined {
  const timingMinutes = timingOptimizations * 25;
  const trapMoney = trapsAvoided * 35;
  const hiddenGemMoney = hiddenGems * 18;
  
  const totalMinutes = timingMinutes;
  const totalMoney = trapMoney + hiddenGemMoney;
  
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
 * Get default skipped items for a destination
 */
export function getDestinationSkippedItems(destination: string): SkippedItem[] {
  const city = destination.toLowerCase();
  
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
        reason: 'Triple the price for half the quality. No Roman would eat here.',
        category: 'tourist-trap',
        savingsEstimate: { money: '$40' },
        betterAlternative: 'Trattoria in Testaccio or Jewish Ghetto',
      },
      {
        name: 'Trevi Fountain selfie crowd (midday)',
        reason: 'Packed 10am-6pm with selfie sticks and tour groups. Visit at 7am or after 10pm.',
        category: 'overcrowded',
        savingsEstimate: { time: '45 min' },
        betterAlternative: 'Early morning or late night visit',
      },
      {
        name: 'Cafes on Spanish Steps',
        reason: 'You\'re paying for the view, not the coffee. A €2 espresso becomes €8.',
        category: 'overpriced',
        savingsEstimate: { money: '$20' },
        betterAlternative: 'Sant\'Eustachio Il Caffè',
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
        name: 'Seine dinner cruises',
        reason: 'Mediocre buffet food, crowded boats, expensive. Better to walk the Seine at sunset.',
        category: 'overhyped',
        savingsEstimate: { money: '$80' },
      },
    ],
    london: [
      {
        name: 'Leicester Square restaurants',
        reason: 'Tourist trap central. Overpriced chains, aggressive touts.',
        category: 'tourist-trap',
        savingsEstimate: { money: '$25' },
        betterAlternative: 'Borough Market or Soho side streets',
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
    ],
    lisbon: [
      {
        name: 'Pastéis de Belém line (peak hours)',
        reason: 'Hour-long waits midday for custard tarts. Go before 9am or after 8pm — same tart, no line.',
        category: 'overcrowded',
        savingsEstimate: { time: '45 min' },
        betterAlternative: 'Visit early morning or try Manteigaria',
      },
      {
        name: 'Tram 28 midday ride',
        reason: 'Packed with tourists and pickpockets from 10am-5pm. Take it at 8am or walk the route instead.',
        category: 'overcrowded',
        savingsEstimate: { time: '30 min' },
        betterAlternative: 'Walk Alfama or take Tram 28 before 9am',
      },
    ],
  };

  const matchedCity = Object.keys(skipLists).find(key => 
    city.includes(key) || key.includes(city)
  );

  return matchedCity ? skipLists[matchedCity] : [];
}
