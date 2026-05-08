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

  it('day-level transport row tagged logistics-sync still renders as a payable (non-logistics) row', () => {
    // Regression: previously any source==='logistics-sync' row was treated as
    // a logistics row and dropped from per-row Payments rendering, while still
    // counted in the headline. That mismatch produced the persistent
    // "Totals differ by $X" drift on transit-heavy itineraries.
    const live = [
      { id: 'leg-1', dayNumber: 2, name: 'Vaporetto to San Marco', category: 'transport', jsonCost: 0 },
    ];
    const costs = [
      { activity_id: 'leg-1', day_number: 2, category: 'transport', cost_per_person_usd: 9.5, num_travelers: 2, source: 'logistics-sync' },
    ];
    const r = resolveCanonicalCostRows({ costs: costs as any, liveActivities: live, includeHotel: true, includeFlight: false });
    expect(r.totalCents).toBe(1900);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].isLogisticsRow).toBe(false);
  });

  describe('manual payment fold', () => {
    it('manual hotel OVERRIDES canonical day-0 hotel (no double count)', () => {
      const live: any[] = [];
      const costs = [
        { activity_id: null, day_number: 0, category: 'hotel', cost_per_person_usd: 750, num_travelers: 2, source: 'logistics-sync' },
      ];
      const manualPayments = [
        { item_type: 'hotel', item_id: 'manual-hotel-1', amount_cents: 180000, quantity: 1 },
      ];
      const r = resolveCanonicalCostRows({
        costs: costs as any, liveActivities: live, includeHotel: true, includeFlight: false, manualPayments,
      });
      // Canonical: 750*2 = $1500 = 150000c. Manual: $1800 = 180000c.
      // Effective should equal manual ($1800), not $3300 (sum) or $1500 (canonical).
      expect(r.canonicalDay0HotelCents).toBe(150000);
      expect(r.manualHotelCents).toBe(180000);
      expect(r.manualHotelDelta).toBe(30000);
      expect(r.effectiveTotalCents).toBe(180000);
    });

    it('manual other expenses are additive on top of canonical total', () => {
      const live = [
        { id: 'a1', dayNumber: 1, name: 'Lunch', category: 'dining', jsonCost: 0 },
      ];
      const costs = [
        { activity_id: 'a1', day_number: 1, category: 'dining', cost_per_person_usd: 30, num_travelers: 2 },
      ];
      const manualPayments = [
        { item_type: 'other', item_id: 'manual-souvenir', amount_cents: 5000, quantity: 1 },
        { item_type: 'shopping', item_id: 'manual-shop', amount_cents: 8000, quantity: 1 },
      ];
      const r = resolveCanonicalCostRows({
        costs: costs as any, liveActivities: live, includeHotel: true, includeFlight: false, manualPayments,
      });
      expect(r.totalCents).toBe(6000);
      expect(r.manualOtherCents).toBe(13000);
      expect(r.effectiveTotalCents).toBe(19000);
    });

    it('hotel OFF toggle excludes manual hotel delta from effective total', () => {
      const live: any[] = [];
      const costs = [
        { activity_id: null, day_number: 0, category: 'hotel', cost_per_person_usd: 750, num_travelers: 2, source: 'logistics-sync' },
      ];
      const manualPayments = [
        { item_type: 'hotel', item_id: 'manual-hotel-1', amount_cents: 180000, quantity: 1 },
      ];
      const r = resolveCanonicalCostRows({
        costs: costs as any, liveActivities: live, includeHotel: false, includeFlight: false, manualPayments,
      });
      // Hotel toggle off: canonical hotel excluded from totalCents AND manual hotel delta not added.
      expect(r.totalCents).toBe(0);
      expect(r.effectiveTotalCents).toBe(0);
    });
  });
});
