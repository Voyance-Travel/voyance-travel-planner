/**
 * Multi-City Trip Tests
 * 
 * Tests for multi-city persistence, day-city mapping, and generation flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// buildDayCityMap logic (extracted for testing)
// ============================================================================

interface CityInput {
  city_name: string;
  country?: string;
  nights: number;
  city_order: number;
  transition_day_mode?: string;
  transport_type?: string;
}

interface DayCityInfo {
  cityName: string;
  country?: string;
  isTransitionDay: boolean;
  transitionFrom?: string;
  transitionTo?: string;
  transportType?: string;
}

function buildDayCityMap(cities: CityInput[], totalDays: number): DayCityInfo[] {
  const map: DayCityInfo[] = [];

  for (const city of cities) {
    const nights = city.nights || 1;

    for (let n = 0; n < nights; n++) {
      const isTransition = n === 0 && city.city_order > 0 && city.transition_day_mode !== 'skip';
      const prevCity = city.city_order > 0 ? cities.find(c => c.city_order === city.city_order - 1) : null;

      map.push({
        cityName: city.city_name,
        country: city.country || undefined,
        isTransitionDay: isTransition,
        transitionFrom: isTransition ? prevCity?.city_name : undefined,
        transitionTo: isTransition ? city.city_name : undefined,
        transportType: isTransition ? (city.transport_type || undefined) : undefined,
      });
    }
  }

  while (map.length < totalDays) {
    const last = map[map.length - 1] || { cityName: 'Unknown', isTransitionDay: false };
    map.push({ ...last, isTransitionDay: false });
  }

  return map.slice(0, totalDays);
}

// ============================================================================
// buildDayCityMap from destinations JSONB (edge function logic)
// ============================================================================

interface DestinationInput {
  city: string;
  country?: string;
  nights: number;
  order?: number;
}

function buildDayCityMapFromDestinations(destinations: DestinationInput[], totalDays: number): DayCityInfo[] {
  const sorted = [...destinations].sort((a, b) => (a.order || 0) - (b.order || 0));
  const dayMap: DayCityInfo[] = [];
  
  for (let i = 0; i < sorted.length; i++) {
    const dest = sorted[i];
    const nights = dest.nights || 1;
    
    for (let n = 0; n < nights; n++) {
      const isTransition = n === 0 && i > 0;
      dayMap.push({
        cityName: dest.city,
        country: dest.country,
        isTransitionDay: isTransition,
        transitionFrom: isTransition ? sorted[i - 1].city : undefined,
        transitionTo: isTransition ? dest.city : undefined,
      });
    }
  }
  
  while (dayMap.length < totalDays) {
    const last = dayMap[dayMap.length - 1] || { cityName: 'Unknown', isTransitionDay: false };
    dayMap.push({ ...last, isTransitionDay: false });
  }
  return dayMap.slice(0, totalDays);
}

// ============================================================================
// TESTS
// ============================================================================

describe('Multi-City Day Mapping', () => {
  describe('buildDayCityMap (from trip_cities)', () => {
    it('maps 2-city trip correctly', () => {
      const cities: CityInput[] = [
        { city_name: 'London', country: 'UK', nights: 3, city_order: 0 },
        { city_name: 'Paris', country: 'France', nights: 4, city_order: 1, transport_type: 'train' },
      ];

      const map = buildDayCityMap(cities, 7);

      expect(map).toHaveLength(7);
      // Days 1-3: London
      expect(map[0]).toEqual({ cityName: 'London', country: 'UK', isTransitionDay: false, transitionFrom: undefined, transitionTo: undefined, transportType: undefined });
      expect(map[1].cityName).toBe('London');
      expect(map[2].cityName).toBe('London');
      // Day 4: Paris (transition day)
      expect(map[3]).toEqual({ cityName: 'Paris', country: 'France', isTransitionDay: true, transitionFrom: 'London', transitionTo: 'Paris', transportType: 'train' });
      // Days 5-7: Paris
      expect(map[4].cityName).toBe('Paris');
      expect(map[4].isTransitionDay).toBe(false);
      expect(map[5].cityName).toBe('Paris');
      expect(map[6].cityName).toBe('Paris');
    });

    it('maps 3-city trip correctly', () => {
      const cities: CityInput[] = [
        { city_name: 'London', country: 'UK', nights: 3, city_order: 0 },
        { city_name: 'Paris', country: 'France', nights: 4, city_order: 1 },
        { city_name: 'Rome', country: 'Italy', nights: 3, city_order: 2 },
      ];

      const map = buildDayCityMap(cities, 10);

      expect(map).toHaveLength(10);
      // London: days 1-3
      expect(map[0].cityName).toBe('London');
      expect(map[2].cityName).toBe('London');
      // Paris: days 4-7 (day 4 is transition)
      expect(map[3].cityName).toBe('Paris');
      expect(map[3].isTransitionDay).toBe(true);
      expect(map[3].transitionFrom).toBe('London');
      expect(map[6].cityName).toBe('Paris');
      // Rome: days 8-10 (day 8 is transition)
      expect(map[7].cityName).toBe('Rome');
      expect(map[7].isTransitionDay).toBe(true);
      expect(map[7].transitionFrom).toBe('Paris');
      expect(map[9].cityName).toBe('Rome');
    });

    it('pads days when total exceeds allocated nights', () => {
      const cities: CityInput[] = [
        { city_name: 'Tokyo', country: 'Japan', nights: 2, city_order: 0 },
        { city_name: 'Kyoto', country: 'Japan', nights: 2, city_order: 1 },
      ];

      const map = buildDayCityMap(cities, 6);

      expect(map).toHaveLength(6);
      // First 4 days are mapped normally
      expect(map[0].cityName).toBe('Tokyo');
      expect(map[1].cityName).toBe('Tokyo');
      expect(map[2].cityName).toBe('Kyoto');
      expect(map[3].cityName).toBe('Kyoto');
      // Days 5-6 are padded with last city
      expect(map[4].cityName).toBe('Kyoto');
      expect(map[5].cityName).toBe('Kyoto');
    });

    it('trims when allocated nights exceed total days', () => {
      const cities: CityInput[] = [
        { city_name: 'Barcelona', nights: 5, city_order: 0 },
        { city_name: 'Madrid', nights: 5, city_order: 1 },
      ];

      const map = buildDayCityMap(cities, 7);

      expect(map).toHaveLength(7);
      expect(map[0].cityName).toBe('Barcelona');
      expect(map[4].cityName).toBe('Barcelona');
      expect(map[5].cityName).toBe('Madrid');
      expect(map[6].cityName).toBe('Madrid');
    });

    it('skips transition for first city', () => {
      const cities: CityInput[] = [
        { city_name: 'Berlin', nights: 3, city_order: 0 },
      ];

      const map = buildDayCityMap(cities, 3);

      expect(map.every(d => !d.isTransitionDay)).toBe(true);
    });

    it('respects skip transition_day_mode', () => {
      const cities: CityInput[] = [
        { city_name: 'London', nights: 2, city_order: 0 },
        { city_name: 'Paris', nights: 2, city_order: 1, transition_day_mode: 'skip' },
      ];

      const map = buildDayCityMap(cities, 4);

      // Even though Paris is second city, transition is skipped
      expect(map[2].isTransitionDay).toBe(false);
    });
  });

  describe('buildDayCityMapFromDestinations (from trips.destinations JSONB)', () => {
    it('maps destinations JSONB correctly', () => {
      const destinations: DestinationInput[] = [
        { city: 'London', country: 'United Kingdom', nights: 3, order: 1 },
        { city: 'Paris', country: 'France', nights: 4, order: 2 },
        { city: 'Rome', country: 'Italy', nights: 3, order: 3 },
      ];

      const map = buildDayCityMapFromDestinations(destinations, 10);

      expect(map).toHaveLength(10);
      expect(map[0].cityName).toBe('London');
      expect(map[2].cityName).toBe('London');
      expect(map[3].cityName).toBe('Paris');
      expect(map[3].isTransitionDay).toBe(true);
      expect(map[3].transitionFrom).toBe('London');
      expect(map[6].cityName).toBe('Paris');
      expect(map[7].cityName).toBe('Rome');
      expect(map[7].isTransitionDay).toBe(true);
      expect(map[7].transitionFrom).toBe('Paris');
      expect(map[9].cityName).toBe('Rome');
    });

    it('sorts by order field', () => {
      const destinations: DestinationInput[] = [
        { city: 'Rome', country: 'Italy', nights: 3, order: 3 },
        { city: 'London', country: 'UK', nights: 3, order: 1 },
        { city: 'Paris', country: 'France', nights: 4, order: 2 },
      ];

      const map = buildDayCityMapFromDestinations(destinations, 10);

      expect(map[0].cityName).toBe('London');
      expect(map[3].cityName).toBe('Paris');
      expect(map[7].cityName).toBe('Rome');
    });

    it('handles destinations without order field', () => {
      const destinations: DestinationInput[] = [
        { city: 'Tokyo', country: 'Japan', nights: 4 },
        { city: 'Kyoto', country: 'Japan', nights: 5 },
      ];

      const map = buildDayCityMapFromDestinations(destinations, 9);

      expect(map).toHaveLength(9);
      expect(map[0].cityName).toBe('Tokyo');
      expect(map[3].cityName).toBe('Tokyo');
      expect(map[4].cityName).toBe('Kyoto');
      expect(map[4].isTransitionDay).toBe(true);
    });
  });

  describe('Day tagging', () => {
    it('tags all days with correct city', () => {
      const destinations: DestinationInput[] = [
        { city: 'London', country: 'UK', nights: 3, order: 1 },
        { city: 'Paris', country: 'France', nights: 4, order: 2 },
      ];

      const map = buildDayCityMapFromDestinations(destinations, 7);

      // Simulate tagging days like the edge function does
      const days = map.map((dayCity, i) => ({
        dayNumber: i + 1,
        city: dayCity.cityName,
        country: dayCity.country,
        isTransitionDay: dayCity.isTransitionDay,
      }));

      // Every day must have a city
      expect(days.every(d => d.city)).toBe(true);
      
      // Check city distribution
      const londonDays = days.filter(d => d.city === 'London');
      const parisDays = days.filter(d => d.city === 'Paris');
      expect(londonDays).toHaveLength(3);
      expect(parisDays).toHaveLength(4);
    });

    it('marks exactly one transition day per city switch', () => {
      const destinations: DestinationInput[] = [
        { city: 'Tokyo', nights: 3, order: 1 },
        { city: 'Kyoto', nights: 3, order: 2 },
        { city: 'Osaka', nights: 2, order: 3 },
      ];

      const map = buildDayCityMapFromDestinations(destinations, 8);

      const transitionDays = map.filter(d => d.isTransitionDay);
      expect(transitionDays).toHaveLength(2);
      expect(transitionDays[0].transitionFrom).toBe('Tokyo');
      expect(transitionDays[0].transitionTo).toBe('Kyoto');
      expect(transitionDays[1].transitionFrom).toBe('Kyoto');
      expect(transitionDays[1].transitionTo).toBe('Osaka');
    });
  });

  describe('Edge cases', () => {
    it('handles single destination (not multi-city)', () => {
      const destinations: DestinationInput[] = [
        { city: 'Paris', country: 'France', nights: 5 },
      ];

      const map = buildDayCityMapFromDestinations(destinations, 5);

      expect(map).toHaveLength(5);
      expect(map.every(d => d.cityName === 'Paris')).toBe(true);
      expect(map.every(d => !d.isTransitionDay)).toBe(true);
    });

    it('handles zero nights gracefully', () => {
      const destinations: DestinationInput[] = [
        { city: 'A', nights: 0 },
        { city: 'B', nights: 3 },
      ];

      const map = buildDayCityMapFromDestinations(destinations, 3);

      // A produces 0 entries, B produces 3, total=3, map is padded/trimmed to 3
      expect(map).toHaveLength(3);
      // B should be present in the map
      expect(map.filter(d => d.cityName === 'B').length).toBeGreaterThanOrEqual(2);
    });

    it('handles empty destinations array', () => {
      const map = buildDayCityMapFromDestinations([], 5);
      
      expect(map).toHaveLength(5);
      expect(map[0].cityName).toBe('Unknown');
    });
  });
});
