/**
 * public-holidays.ts — Hand-curated 2026 public holidays for the countries we
 * see most often. Used by the Day Truth Ledger so the AI knows when banks,
 * markets, and many shops/museums will be closed or running reduced hours.
 *
 * Format: ISO date (YYYY-MM-DD) → label.
 */

export interface PublicHoliday {
  date: string;       // YYYY-MM-DD
  name: string;
  impact?: string;    // Short hint for the prompt, e.g. "banks/markets closed"
}

const PT_2026: PublicHoliday[] = [
  { date: '2026-01-01', name: 'New Year\'s Day', impact: 'most attractions and shops closed' },
  { date: '2026-02-17', name: 'Carnival (Shrove Tuesday)', impact: 'reduced hours, parades' },
  { date: '2026-04-03', name: 'Good Friday', impact: 'banks and many museums closed' },
  { date: '2026-04-05', name: 'Easter Sunday', impact: 'reduced hours' },
  { date: '2026-04-25', name: 'Liberation Day (Dia da Liberdade)', impact: 'banks/markets closed, parades in Lisbon' },
  { date: '2026-05-01', name: 'Labour Day', impact: 'most shops and banks closed' },
  { date: '2026-06-04', name: 'Corpus Christi', impact: 'banks and many shops closed' },
  { date: '2026-06-10', name: 'Portugal Day', impact: 'banks/markets closed' },
  { date: '2026-06-13', name: 'St. Anthony (Lisbon municipal)', impact: 'street parties, Alfama crowded' },
  { date: '2026-08-15', name: 'Assumption Day', impact: 'banks closed' },
  { date: '2026-10-05', name: 'Republic Day', impact: 'banks/markets closed' },
  { date: '2026-11-01', name: 'All Saints\' Day', impact: 'banks closed' },
  { date: '2026-12-01', name: 'Restoration of Independence', impact: 'banks closed' },
  { date: '2026-12-08', name: 'Immaculate Conception', impact: 'banks closed' },
  { date: '2026-12-25', name: 'Christmas Day', impact: 'almost everything closed' },
];

const ES_2026: PublicHoliday[] = [
  { date: '2026-01-01', name: 'New Year\'s Day' },
  { date: '2026-01-06', name: 'Epiphany (Three Kings Day)' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-08-15', name: 'Assumption Day' },
  { date: '2026-10-12', name: 'National Day of Spain' },
  { date: '2026-11-01', name: 'All Saints\' Day' },
  { date: '2026-12-06', name: 'Constitution Day' },
  { date: '2026-12-08', name: 'Immaculate Conception' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

const FR_2026: PublicHoliday[] = [
  { date: '2026-01-01', name: 'New Year\'s Day' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-05-08', name: 'Victory in Europe Day' },
  { date: '2026-05-14', name: 'Ascension Day' },
  { date: '2026-05-25', name: 'Whit Monday' },
  { date: '2026-07-14', name: 'Bastille Day' },
  { date: '2026-08-15', name: 'Assumption Day' },
  { date: '2026-11-01', name: 'All Saints\' Day' },
  { date: '2026-11-11', name: 'Armistice Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

const IT_2026: PublicHoliday[] = [
  { date: '2026-01-01', name: 'New Year\'s Day' },
  { date: '2026-01-06', name: 'Epiphany' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-04-25', name: 'Liberation Day' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-06-02', name: 'Republic Day' },
  { date: '2026-08-15', name: 'Ferragosto (Assumption)' },
  { date: '2026-11-01', name: 'All Saints\' Day' },
  { date: '2026-12-08', name: 'Immaculate Conception' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-26', name: 'St. Stephen\'s Day' },
];

const US_2026: PublicHoliday[] = [
  { date: '2026-01-01', name: 'New Year\'s Day' },
  { date: '2026-01-19', name: 'Martin Luther King Jr. Day' },
  { date: '2026-02-16', name: 'Presidents\' Day' },
  { date: '2026-05-25', name: 'Memorial Day' },
  { date: '2026-07-04', name: 'Independence Day' },
  { date: '2026-09-07', name: 'Labor Day' },
  { date: '2026-11-26', name: 'Thanksgiving Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

const UK_2026: PublicHoliday[] = [
  { date: '2026-01-01', name: 'New Year\'s Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-05-04', name: 'Early May Bank Holiday' },
  { date: '2026-05-25', name: 'Spring Bank Holiday' },
  { date: '2026-08-31', name: 'Summer Bank Holiday' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-28', name: 'Boxing Day (substitute)' },
];

const JP_2026: PublicHoliday[] = [
  { date: '2026-01-01', name: 'New Year\'s Day' },
  { date: '2026-01-12', name: 'Coming of Age Day' },
  { date: '2026-02-11', name: 'National Foundation Day' },
  { date: '2026-04-29', name: 'Showa Day' },
  { date: '2026-05-03', name: 'Constitution Memorial Day' },
  { date: '2026-05-04', name: 'Greenery Day' },
  { date: '2026-05-05', name: 'Children\'s Day' },
  { date: '2026-11-03', name: 'Culture Day' },
  { date: '2026-11-23', name: 'Labour Thanksgiving Day' },
];

const COUNTRY_MAP: Record<string, PublicHoliday[]> = {
  portugal: PT_2026, pt: PT_2026,
  spain: ES_2026, es: ES_2026,
  france: FR_2026, fr: FR_2026,
  italy: IT_2026, it: IT_2026,
  'united states': US_2026, usa: US_2026, us: US_2026,
  'united kingdom': UK_2026, uk: UK_2026, gb: UK_2026, england: UK_2026,
  japan: JP_2026, jp: JP_2026,
};

export function getPublicHolidayForDate(country: string | undefined, isoDate: string): PublicHoliday | null {
  if (!country || !isoDate) return null;
  const key = country.trim().toLowerCase();
  const list = COUNTRY_MAP[key];
  if (!list) return null;
  const datePart = isoDate.length > 10 ? isoDate.slice(0, 10) : isoDate;
  return list.find((h) => h.date === datePart) || null;
}
