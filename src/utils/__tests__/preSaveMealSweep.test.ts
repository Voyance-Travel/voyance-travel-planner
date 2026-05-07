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

  it('emits an unverified $0 sentinel (no foreign venue) when destination has no city pool', () => {
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
    // Must NEVER ship a foreign real venue (Tartine SF, Le Comptoir Paris, etc.)
    expect(act.location.name).toBe('');
    expect(act.location.address).toBe('');
    expect(act.cost.amount).toBe(0);
    expect(act.needsVenuePick).toBe(true);
    expect(act.title).toMatch(/find a local spot/i);
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

describe('resolveAnyMealFallback cross-city integrity', () => {
  it('returns a real Paris breakfast for Paris', () => {
    const v = resolveAnyMealFallback('Paris', 'breakfast', new Set());
    expect(v.address.toLowerCase()).toContain('paris');
    expect(v.needsVenuePick).toBeFalsy();
  });

  it('returns Venice-only venues for Venice (never Florence/Paris/SF)', () => {
    for (let i = 0; i < 20; i++) {
      for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
        const v = resolveAnyMealFallback('Venice, Italy', meal, new Set());
        expect(v.needsVenuePick).toBeFalsy();
        const blob = `${v.name} ${v.address}`.toLowerCase();
        expect(blob).not.toMatch(/florence|firenze|paris|san francisco|tartine|antico vinaio|comptoir du relais/);
        expect(blob).toMatch(/vene(zia|ce)/);
      }
    }
  });

  it('returns an unverified sentinel for Italian cities not in the pool (no Florence/Rome leak)', () => {
    const v = resolveAnyMealFallback('Bologna', 'lunch', new Set());
    expect(v.needsVenuePick).toBe(true);
    expect(v.price).toBe(0);
    expect(`${v.name} ${v.address}`.toLowerCase()).not.toMatch(/florence|firenze|rome|roma/);
  });
});
