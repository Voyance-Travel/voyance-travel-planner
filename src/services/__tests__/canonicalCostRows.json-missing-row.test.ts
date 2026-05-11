/**
 * M6 — JSON-missing-row rescue regression.
 *
 * When activity_costs is empty (legacy trip pre-Phase 4 chain writer) but
 * the live JSON carries priced cards, the resolver synthesizes counted
 * rows so the Budget header reflects the visible itinerary total. Rescue
 * MUST drop out as soon as real DB rows exist (no double counting).
 */
import { describe, it, expect } from 'vitest';
import { resolveCanonicalCostRows } from '@/services/canonicalCostRows';

const live = [
  { id: 'a1', dayNumber: 1, name: 'Lunch at Casa Mono',  category: 'dining',   jsonCost: 60 },
  { id: 'a2', dayNumber: 1, name: 'Prado Museum',        category: 'activity', jsonCost: 25 },
  { id: 'a3', dayNumber: 2, name: 'Tapas tour',          category: 'activity', jsonCost: 95 },
  // walking leg — must stay free even with stored jsonCost
  { id: 'w1', dayNumber: 1, name: 'Walk to Plaza Mayor', category: 'transport', jsonCost: 12 },
];

describe('JSON-missing-row rescue', () => {
  it('synthesizes rows for unmatched live activities with positive jsonCost', () => {
    const r = resolveCanonicalCostRows({
      costs: [], liveActivities: live, includeHotel: true, includeFlight: false, travelers: 2,
    });
    const rescued = r.rows.filter(x => x.rescueTag === 'json-missing-row');
    expect(rescued).toHaveLength(3);
    expect(rescued.map(x => x.cents).sort((a,b) => a-b)).toEqual([5000, 12000, 19000]);
    expect(r.totalCents).toBe(36000); // (60+25+95) * 2 * 100
    expect(r.effectiveTotalCents).toBe(36000);
  });

  it('skips walking legs even when jsonCost > 0', () => {
    const r = resolveCanonicalCostRows({
      costs: [], liveActivities: live, includeHotel: true, includeFlight: false, travelers: 1,
    });
    expect(r.rows.find(x => x.effectiveActivityId === 'w1')).toBeUndefined();
  });

  it('drops out when matching activity_costs row exists (no double-count)', () => {
    const costs = [
      { activity_id: 'a1', day_number: 1, category: 'dining',   cost_per_person_usd: 50, num_travelers: 2 },
      { activity_id: 'a2', day_number: 1, category: 'activity', cost_per_person_usd: 25, num_travelers: 2 },
    ];
    const r = resolveCanonicalCostRows({
      costs: costs as any, liveActivities: live, includeHotel: true, includeFlight: false, travelers: 2,
    });
    // a1 + a2 from direct path, a3 from rescue (still missing).
    const rescued = r.rows.filter(x => x.rescueTag === 'json-missing-row');
    expect(rescued).toHaveLength(1);
    expect(rescued[0].effectiveActivityId).toBe('a3');
    // Direct: 50*2 + 25*2 = 150*100 = 15000; rescue a3: 95*2*100 = 19000 → 34000
    expect(r.totalCents).toBe(34000);
  });

  it('defaults travelers to 1 when not provided', () => {
    const r = resolveCanonicalCostRows({
      costs: [], liveActivities: live, includeHotel: true, includeFlight: false,
    });
    expect(r.totalCents).toBe(18000); // (60+25+95) * 1 * 100
  });
});
