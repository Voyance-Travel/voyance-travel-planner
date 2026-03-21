/**
 * City-to-Country Map
 * Used as a validation/fallback for country resolution when stored data
 * may be null or incorrect (e.g. AI hallucinated "Rome, Spain").
 */

export const CITY_TO_COUNTRY: Record<string, string> = {
  'Barcelona': 'Spain',
  'Madrid': 'Spain',
  'Seville': 'Spain',
  'Tokyo': 'Japan',
  'Kyoto': 'Japan',
  'Osaka': 'Japan',
  'New York': 'USA',
  'Los Angeles': 'USA',
  'San Francisco': 'USA',
  'Chicago': 'USA',
  'Miami': 'USA',
  'Paris': 'France',
  'Nice': 'France',
  'Lyon': 'France',
  'London': 'UK',
  'Edinburgh': 'UK',
  'Rome': 'Italy',
  'Florence': 'Italy',
  'Venice': 'Italy',
  'Milan': 'Italy',
  'Naples': 'Italy',
  'Amalfi': 'Italy',
  'Sydney': 'Australia',
  'Melbourne': 'Australia',
  'Amsterdam': 'Netherlands',
  'Dubai': 'UAE',
  'Abu Dhabi': 'UAE',
  'Singapore': 'Singapore',
  'Hong Kong': 'China',
  'Beijing': 'China',
  'Shanghai': 'China',
  'Bangkok': 'Thailand',
  'Chiang Mai': 'Thailand',
  'Phuket': 'Thailand',
  'Istanbul': 'Turkey',
  'Seoul': 'South Korea',
  'Lisbon': 'Portugal',
  'Porto': 'Portugal',
  'Copenhagen': 'Denmark',
  'Marrakech': 'Morocco',
  'Vancouver': 'Canada',
  'Toronto': 'Canada',
  'Montreal': 'Canada',
  'Cape Town': 'South Africa',
  'Mexico City': 'Mexico',
  'Cancun': 'Mexico',
  'Buenos Aires': 'Argentina',
  'Reykjavik': 'Iceland',
  'Bali': 'Indonesia',
  'Denpasar': 'Indonesia',
  'Berlin': 'Germany',
  'Munich': 'Germany',
  'Vienna': 'Austria',
  'Prague': 'Czech Republic',
  'Athens': 'Greece',
  'Santorini': 'Greece',
  'Rio de Janeiro': 'Brazil',
  'Sao Paulo': 'Brazil',
  'Bogota': 'Colombia',
  'Cartagena': 'Colombia',
  'Lima': 'Peru',
  'Cusco': 'Peru',
  'Hanoi': 'Vietnam',
  'Ho Chi Minh City': 'Vietnam',
  'Petra': 'Jordan',
  'Amman': 'Jordan',
  'Dublin': 'Ireland',
  'Zurich': 'Switzerland',
  'Geneva': 'Switzerland',
  'Stockholm': 'Sweden',
  'Helsinki': 'Finland',
  'Budapest': 'Hungary',
  'Warsaw': 'Poland',
  'Krakow': 'Poland',
  'Dubrovnik': 'Croatia',
  'Split': 'Croatia',
};

/**
 * Resolve country for a city, using stored value with validation,
 * falling back to the hardcoded map.
 */
export function resolveCountry(city: string, storedCountry?: string | null): string | null {
  const knownCountry = CITY_TO_COUNTRY[city];

  // If we have a known mapping, validate stored country against it
  if (knownCountry) {
    if (!storedCountry) return knownCountry;
    // If stored country doesn't match known, prefer known (fixes "Rome, Spain" bug)
    if (storedCountry !== knownCountry) return knownCountry;
    return storedCountry;
  }

  // No known mapping — trust stored value
  return storedCountry || null;
}
