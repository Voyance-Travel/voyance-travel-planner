/**
 * Currency conversion and intelligence field derivation utilities.
 */

// =============================================================================
// CURRENCY CONVERSION - Normalize all costs to USD
// =============================================================================
export const EXCHANGE_RATES_TO_USD: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, CHF: 0.88, CAD: 1.36,
  AUD: 1.53, NZD: 1.64, CNY: 7.24, HKD: 7.82, SGD: 1.34, THB: 35.8,
  MXN: 17.2, BRL: 4.97, INR: 83.1, KRW: 1320, ZAR: 18.9, SEK: 10.45,
  NOK: 10.62, DKK: 6.87, PLN: 4.02, CZK: 23.1, HUF: 358, ILS: 3.65,
  AED: 3.67, TRY: 30.5, PHP: 55.8, IDR: 15650, MYR: 4.72, VND: 24500,
  TWD: 31.5, ARS: 850, COP: 3950, PEN: 3.72, EGP: 30.9, MAD: 10.1,
  QAR: 3.64, SAR: 3.75, KWD: 0.31, BHD: 0.377, OMR: 0.385, JOD: 0.71,
};

export function convertToUSD(amount: number, sourceCurrency: string): number {
  if (!sourceCurrency || sourceCurrency.toUpperCase() === 'USD') {
    return amount;
  }
  const rate = EXCHANGE_RATES_TO_USD[sourceCurrency.toUpperCase()];
  if (!rate || rate === 0) {
    console.log(`[convertToUSD] Unknown currency ${sourceCurrency}, assuming USD`);
    return amount;
  }
  const converted = Math.round(amount / rate * 100) / 100;
  console.log(`[convertToUSD] ${amount} ${sourceCurrency} -> ${converted} USD (rate: ${rate})`);
  return converted;
}

export function normalizeCostToUSD(cost: { amount: number; currency?: string } | undefined): { amount: number; currency: string } {
  if (!cost) {
    return { amount: 0, currency: 'USD' };
  }
  const currency = cost.currency || 'USD';
  const amountInUSD = convertToUSD(cost.amount, currency);
  return { amount: amountInUSD, currency: 'USD' };
}

// =============================================================================
// INTELLIGENCE FIELD DERIVATION
// =============================================================================
const TIMING_KW = ['before the crowds','avoid the rush','golden hour','sunrise','early morning','before tour buses','less crowded','off-peak','before it gets busy','at dusk','at dawn','at sunset','arrive early','beat the','ahead of'];
const GEM_KW = ['hidden','secret','locals only','off the beaten','lesser-known','under the radar','undiscovered','tucked away','neighborhood favorite','local favorite','insider','like a local','curated','unique find','zero tourists','nobody knows','local haunt','local institution'];
const NON_GEM_CAT = ['transport','accommodation','downtime','free_time','logistics'];

export function deriveIntelligenceFields(act: any): any {
  const text = `${act.description || ''} ${act.tips || ''} ${act.personalization?.whyThisFits || ''} ${act.voyanceInsight || ''}`.toLowerCase();
  const category = (act.category || '').toLowerCase();

  if (act.isHiddenGem == null) {
    act.isHiddenGem = !NON_GEM_CAT.includes(category) && GEM_KW.some(kw => text.includes(kw));
  }

  if (act.hasTimingHack == null) {
    act.hasTimingHack = TIMING_KW.some(kw => text.includes(kw));
  }

  if (!act.crowdLevel) {
    if (text.includes('crowded') || text.includes('busy') || text.includes('popular') || text.includes('lines') || text.includes('queue')) {
      act.crowdLevel = 'high';
    } else if (text.includes('quiet') || text.includes('peaceful') || text.includes('uncrowded') || text.includes('serene') || text.includes('zero tourists')) {
      act.crowdLevel = 'low';
    } else {
      act.crowdLevel = 'moderate';
    }
  }

  if (!act.tips || act.tips.length < 30) {
    const desc = act.description || '';
    if (desc.length > 40) {
      act.tips = desc.length > 120 ? desc.substring(0, 120) + '…' : desc;
    }
  }

  return act;
}

// =============================================================================
// RECURRING EVENT DETECTION
// =============================================================================
export function isRecurringEvent(activity: { title?: string; description?: string; duration?: number; isAllDay?: boolean }, userActivities: string[] = []): boolean {
  const title = (activity.title || '').toLowerCase();
  const desc = (activity.description || '').toLowerCase();
  const combined = `${title} ${desc}`;

  const logisticalPattern = /\b(transfer|transit|taxi|uber|rideshare|check.?in|check.?out|airport|depart|arrival|shuttle|car service|pick.?up|drop.?off)\b/i;
  if (logisticalPattern.test(title)) {
    return false;
  }

  const sportingEvents = [
    'us open', 'u.s. open', 'wimbledon', 'french open', 'australian open',
    'world cup', 'olympics', 'olympic games', 'formula 1', 'f1 grand prix',
    'tour de france', 'masters tournament', 'super bowl week',
    'world series', 'nba finals', 'stanley cup', 'ryder cup',
    'cricket world cup', 'rugby world cup', 'copa america',
  ];

  const festivals = [
    'coachella', 'glastonbury', 'burning man', 'tomorrowland', 'lollapalooza',
    'bonnaroo', 'primavera sound', 'reading festival', 'leeds festival',
    'mardi gras', 'carnival', 'oktoberfest', 'day of the dead', 'dia de los muertos',
    'diwali', 'holi', 'chinese new year', 'lunar new year', 'la tomatina',
    'rio carnival', 'venice carnival', 'edinburgh fringe', 'cannes film festival',
    'sundance', 'sxsw', 'art basel', 'comic-con', 'comic con',
    'fashion week', 'film festival', 'music festival', 'food festival',
  ];

  for (const event of [...sportingEvents, ...festivals]) {
    if (combined.includes(event)) return true;
  }

  for (const userAct of userActivities) {
    const userActLower = userAct.toLowerCase().trim();
    if (userActLower.length > 3 && (title.includes(userActLower) || userActLower.includes(title.substring(0, 20)))) {
      return true;
    }
  }

  if (activity.isAllDay) return true;
  if (activity.duration && activity.duration >= 300) return true;

  return false;
}
