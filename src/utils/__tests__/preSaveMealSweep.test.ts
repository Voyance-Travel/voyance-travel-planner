import { describe, it, expect } from 'vitest';
import { preSaveMealStubSweep } from '../preSaveMealSweep';
import { resolveAnyMealFallback } from '@/lib/fallbackRestaurants';

describe('preSaveMealStubSweep', () => {
  it('replaces "Breakfast at a café near your hotel" with a real Paris venue', () => {
    const days = [
      {
        dayNumber: 2,
        city: 'Paris',
        activities: [
          {
            id: 'a1',
            title: 'Breakfast at a café near your hotel',
            category: 'dining',
            startTime: '08:30',
            location: { name: '', address: '' },
            cost: { amount: 12, currency: 'USD', source: 'meal_guard_client' },
          },
        ],
      },
    ];

    const replaced = preSaveMealStubSweep(days as any);
    expect(replaced).toBe(1);

    const act = days[0].activities[0] as any;
    expect(act.title).not.toMatch(/at a café near your hotel/i);
    expect(act.title).toMatch(/^Breakfast at /);
    expect(act.location.name).toBeTruthy();
    expect(act.location.address).toBeTruthy();
    expect(act.cost.source).toBe('meal_guard_fallback_db');
    expect(act.needsVenuePick).toBeUndefined();
  });

  it('replaces an AI-stub "Café Matinal" with a real venue', () => {
    const days = [
      {
        dayNumber: 2,
        city: 'Rome',
        activities: [
          {
            id: 'b1',
            title: 'Breakfast at Café Matinal',
            category: 'dining',
            startTime: '08:00',
            location: { name: 'Café Matinal', address: '' },
            cost: { amount: 12, currency: 'USD' },
          },
        ],
      },
    ];

    const replaced = preSaveMealStubSweep(days as any);
    expect(replaced).toBe(1);
    const act = days[0].activities[0] as any;
    expect(act.title).not.toMatch(/Café Matinal/i);
    expect(act.location.name).not.toMatch(/Café Matinal/i);
    expect(act.location.address).toBeTruthy();
  });

  it('flags needsVenuePick when no city coverage exists and leaves no fake venue', () => {
    const days = [
      {
        dayNumber: 2,
        city: 'Reykjavik',
        activities: [
          {
            id: 'c1',
            title: 'Lunch at a neighborhood restaurant',
            category: 'dining',
            startTime: '12:30',
            location: { name: '', address: '' },
            cost: { amount: 18, currency: 'USD' },
          },
        ],
      },
    ];

    preSaveMealStubSweep(days as any);
    const act = days[0].activities[0] as any;
    // Either replaced from regional fallback, or flagged for the user to pick.
    if (act.needsVenuePick) {
      expect(act.title).toMatch(/at a neighborhood restaurant|pick a restaurant/i);
    } else {
      expect(act.location.name).toBeTruthy();
    }
  });

  it('does not mutate already-real venues', () => {
    const days = [
      {
        dayNumber: 2,
        city: 'Paris',
        activities: [
          {
            id: 'd1',
            title: 'Dinner at Le Comptoir du Relais',
            category: 'dining',
            startTime: '19:30',
            location: { name: 'Le Comptoir du Relais', address: '9 Carrefour de l\'Odéon' },
            cost: { amount: 65, currency: 'USD', source: 'ai' },
          },
        ],
      },
    ];

    const replaced = preSaveMealStubSweep(days as any);
    expect(replaced).toBe(0);
    expect((days[0].activities[0] as any).title).toBe('Dinner at Le Comptoir du Relais');
  });
});

describe('resolveAnyMealFallback', () => {
  it('returns a real Paris breakfast', () => {
    const v = resolveAnyMealFallback('Paris', 'breakfast', new Set());
    expect(v).toBeTruthy();
    expect(v!.name).toBeTruthy();
    expect(v!.address).toBeTruthy();
    expect(v!.price).toBeGreaterThan(0);
  });

  it('falls back to country pool for an Italian city not in the city pool', () => {
    const v = resolveAnyMealFallback('Bologna', 'lunch', new Set());
    expect(v).toBeTruthy();
    expect(v!.address.toLowerCase()).toMatch(/italy|rome|florence/);
  });
});
