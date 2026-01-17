/**
 * Destination Search Utility
 * Handles searching for destinations with flag emojis
 */

export interface SearchableDestination {
  id: string;
  name: string;
  city: string;
  country: string;
  code: string;
  popularity: number;
}

export interface DestinationSearchResult {
  value: string;
  label: string;
  secondaryText: string;
  icon: string;
}

/**
 * Get flag emoji for a country
 */
export const getCountryFlag = (country: string): string => {
  const countryToFlag: Record<string, string> = {
    USA: '🇺🇸',
    'United States': '🇺🇸',
    Spain: '🇪🇸',
    Japan: '🇯🇵',
    France: '🇫🇷',
    UK: '🇬🇧',
    'United Kingdom': '🇬🇧',
    Italy: '🇮🇹',
    Australia: '🇦🇺',
    Netherlands: '🇳🇱',
    UAE: '🇦🇪',
    Singapore: '🇸🇬',
    China: '🇨🇳',
    Thailand: '🇹🇭',
    Turkey: '🇹🇷',
    'South Korea': '🇰🇷',
    Germany: '🇩🇪',
    Austria: '🇦🇹',
    Greece: '🇬🇷',
    Canada: '🇨🇦',
    Indonesia: '🇮🇩',
    'Czech Republic': '🇨🇿',
    'South Africa': '🇿🇦',
    Brazil: '🇧🇷',
    Portugal: '🇵🇹',
    Denmark: '🇩🇰',
    Morocco: '🇲🇦',
    Colombia: '🇨🇴',
    Argentina: '🇦🇷',
    Iceland: '🇮🇸',
    Vietnam: '🇻🇳',
    Jordan: '🇯🇴',
    Peru: '🇵🇪',
    Mexico: '🇲🇽',
  };
  return countryToFlag[country] || '🌍';
};

/**
 * Popular destinations with airport codes
 */
const popularDestinations: SearchableDestination[] = [
  { id: '1', name: 'Barcelona', city: 'Barcelona', country: 'Spain', code: 'BCN', popularity: 98 },
  { id: '2', name: 'Tokyo', city: 'Tokyo', country: 'Japan', code: 'HND', popularity: 97 },
  { id: '3', name: 'New York', city: 'New York', country: 'USA', code: 'JFK', popularity: 99 },
  { id: '4', name: 'Paris', city: 'Paris', country: 'France', code: 'CDG', popularity: 96 },
  { id: '5', name: 'London', city: 'London', country: 'UK', code: 'LHR', popularity: 95 },
  { id: '6', name: 'Rome', city: 'Rome', country: 'Italy', code: 'FCO', popularity: 94 },
  { id: '7', name: 'Sydney', city: 'Sydney', country: 'Australia', code: 'SYD', popularity: 93 },
  { id: '8', name: 'Amsterdam', city: 'Amsterdam', country: 'Netherlands', code: 'AMS', popularity: 92 },
  { id: '9', name: 'Dubai', city: 'Dubai', country: 'UAE', code: 'DXB', popularity: 91 },
  { id: '10', name: 'Singapore', city: 'Singapore', country: 'Singapore', code: 'SIN', popularity: 90 },
  { id: '11', name: 'Hong Kong', city: 'Hong Kong', country: 'China', code: 'HKG', popularity: 89 },
  { id: '12', name: 'Bangkok', city: 'Bangkok', country: 'Thailand', code: 'BKK', popularity: 88 },
  { id: '13', name: 'Istanbul', city: 'Istanbul', country: 'Turkey', code: 'IST', popularity: 87 },
  { id: '14', name: 'Seoul', city: 'Seoul', country: 'South Korea', code: 'ICN', popularity: 86 },
  { id: '15', name: 'Kyoto', city: 'Kyoto', country: 'Japan', code: 'KIX', popularity: 85 },
  { id: '16', name: 'Lisbon', city: 'Lisbon', country: 'Portugal', code: 'LIS', popularity: 84 },
  { id: '17', name: 'Copenhagen', city: 'Copenhagen', country: 'Denmark', code: 'CPH', popularity: 83 },
  { id: '18', name: 'Marrakech', city: 'Marrakech', country: 'Morocco', code: 'RAK', popularity: 82 },
  { id: '19', name: 'Vancouver', city: 'Vancouver', country: 'Canada', code: 'YVR', popularity: 81 },
  { id: '20', name: 'Cape Town', city: 'Cape Town', country: 'South Africa', code: 'CPT', popularity: 80 },
  { id: '21', name: 'Mexico City', city: 'Mexico City', country: 'Mexico', code: 'MEX', popularity: 79 },
  { id: '22', name: 'Buenos Aires', city: 'Buenos Aires', country: 'Argentina', code: 'EZE', popularity: 78 },
  { id: '23', name: 'Reykjavik', city: 'Reykjavik', country: 'Iceland', code: 'KEF', popularity: 77 },
  { id: '24', name: 'Florence', city: 'Florence', country: 'Italy', code: 'FLR', popularity: 76 },
  { id: '25', name: 'Bali', city: 'Denpasar', country: 'Indonesia', code: 'DPS', popularity: 75 },
];

/**
 * Search destinations with simulated API delay
 */
export const searchDestinations = async (query: string): Promise<DestinationSearchResult[]> => {
  await new Promise((resolve) => setTimeout(resolve, 200));

  if (!query.trim()) {
    return popularDestinations
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 6)
      .map(destinationToResult);
  }

  const lowerQuery = query.toLowerCase();
  const filtered = popularDestinations.filter((dest) => {
    const searchString = `${dest.name} ${dest.city} ${dest.country} ${dest.code}`.toLowerCase();
    return searchString.includes(lowerQuery);
  });

  return filtered
    .sort((a, b) => {
      // Exact matches first
      const aExact = a.name.toLowerCase() === lowerQuery || a.code.toLowerCase() === lowerQuery;
      const bExact = b.name.toLowerCase() === lowerQuery || b.code.toLowerCase() === lowerQuery;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Then starts with
      const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
      const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Then by popularity
      return b.popularity - a.popularity;
    })
    .slice(0, 10)
    .map(destinationToResult);
};

/**
 * Get popular destinations
 */
export const getPopularDestinations = async (): Promise<DestinationSearchResult[]> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  
  return popularDestinations
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 6)
    .map(destinationToResult);
};

/**
 * Get destination by ID
 */
export const getDestinationById = (id: string): DestinationSearchResult | null => {
  const destination = popularDestinations.find((d) => d.id === id);
  if (!destination) return null;
  return destinationToResult(destination);
};

/**
 * Convert destination to search result format
 */
function destinationToResult(dest: SearchableDestination): DestinationSearchResult {
  return {
    value: dest.id,
    label: `${dest.name}, ${dest.country}`,
    secondaryText: dest.code,
    icon: getCountryFlag(dest.country),
  };
}
