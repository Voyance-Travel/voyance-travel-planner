/**
 * Regression: the canonical resolver underpins both useTripFinancialSnapshot
 * (Trip Total) and usePayableItems (Payments buckets). Its totalCents must
 * equal the per-row sum it returns, so the two surfaces never disagree.
 */
import { describe, it, expect } from 'vitest';
import { resolveCanonicalCostRows } from '@/services/canonicalCostRows';

describe('resolveCanonicalCostRows', () => {
  it('totalCents equals sum of resolved row cents', () => {
    const live = [
      { id: 'a1', dayNumber: 1, name: 'Lunch at Trattoria',  category: 'dining',  jsonCost: 0 },
      { id: 'a2', dayNumber: 1, name: "Doge's Palace tour",  category: 'activity', jsonCost: 0 },
      { id: 'a3', dayNumber: 2, name: 'Aperitivo',           category: 'dining',  jsonCost: 0 },
    ];
    const costs = [
      { activity_id: 'a1', day_number: 1, category: 'dining',  cost_per_person_usd: 30, num_travelers: 2 },
      { activity_id: 'a2', day_number: 1, category: 'activity',cost_per_person_usd: 25, num_travelers: 2 },
      { activity_id: 'a3', day_number: 2, category: 'dining',  cost_per_person_usd: 20, num_travelers: 2 },
    ];
    const r = resolveCanonicalCostRows({ costs: costs as any, liveActivities: live, includeHotel: true, includeFlight: false });
    const sum = r.rows.reduce((s, x) => s + x.cents, 0);
    expect(sum).toBe(r.totalCents);
    expect(r.totalCents).toBe(15000); // ($30+$25+$20) × 2
  });

  it('drops orphan rows whose activity_id has no live match and no rescue', () => {
    const live = [
      { id: 'live-1', dayNumber: 1, name: 'Real museum', category: 'activity', jsonCost: 0 },
    ];
    const costs = [
      { activity_id: 'live-1', day_number: 1, category: 'activity', cost_per_person_usd: 25, num_travelers: 2 },
      { activity_id: 'orphan', day_number: 5, category: 'shopping', cost_per_person_usd: 99, num_travelers: 2 },
    ];
    const r = resolveCanonicalCostRows({ costs: costs as any, liveActivities: live, includeHotel: true, includeFlight: false });
    expect(r.totalCents).toBe(5000);
    expect(r.rows).toHaveLength(1);
  });

  it('rescues a $0 dining row with the live activity jsonCost', () => {
    const live = [
      { id: 'a1', dayNumber: 1, name: 'Lunch at X', category: 'dining', jsonCost: 18 },
    ];
    const costs = [
      { activity_id: 'a1', day_number: 1, category: 'dining', cost_per_person_usd: 0, num_travelers: 2 },
    ];
    const r = resolveCanonicalCostRows({ costs: costs as any, liveActivities: live, includeHotel: true, includeFlight: false });
    expect(r.totalCents).toBe(3600);
    expect(r.rows[0].rescueTag).toBe('json-zero');
  });

  it('skips walking legs even when the row has cost', () => {
    const live = [
      { id: 'a1', dayNumber: 1, name: 'Walk to lunch in San Polo', category: 'transport', jsonCost: 0 },
    ];
    const costs = [
      { activity_id: 'a1', day_number: 1, category: 'transport', cost_per_person_usd: 10, num_travelers: 2 },
    ];
    const r = resolveCanonicalCostRows({ costs: costs as any, liveActivities: live, includeHotel: true, includeFlight: false });
    expect(r.totalCents).toBe(0);
  });

  it('toggling hotel off excludes day-0 hotel cost from totalCents', () => {
    const live: any[] = [];
    const costs = [
      { activity_id: null, day_number: 0, category: 'hotel', cost_per_person_usd: 200, num_travelers: 2, source: 'logistics-sync' },
    ];
    const on  = resolveCanonicalCostRows({ costs: costs as any, liveActivities: live, includeHotel: true,  includeFlight: false });
    const off = resolveCanonicalCostRows({ costs: costs as any, liveActivities: live, includeHotel: false, includeFlight: false });
    expect(on.totalCents).toBe(40000);
    expect(off.totalCents).toBe(0);
  });
});
