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

    // Regression: header strip showed "Days MAD 14,288 + Hotel MAD 5,224 =
    // Trip Total MAD 14,288" because the override branch fired even with
    // no manual hotel payment, computing delta = 0 − canonical = −canonical
    // and silently subtracting the Day-0 hotel back out of effectiveTotalCents.
    // See mem://constraints/finance/header-strip-mirrors-snapshot.
    it('Day-0 hotel row + NO manual hotel payment → delta=0, effectiveTotalCents includes hotel', () => {
      const live = [
        { id: 'a1', dayNumber: 1, name: 'Museum', category: 'activity', jsonCost: 0 },
      ];
      const costs = [
        { activity_id: null,  day_number: 0, category: 'hotel',    cost_per_person_usd: 261, num_travelers: 2, source: 'logistics-sync' },
        { activity_id: 'a1',  day_number: 1, category: 'activity', cost_per_person_usd: 100, num_travelers: 2 },
      ];
      const r = resolveCanonicalCostRows({
        costs: costs as any, liveActivities: live, includeHotel: true, includeFlight: false, manualPayments: [],
      });
      // Hotel: 261*2=$522=52,200c. Activity: 100*2=$200=20,000c. Total $722=72,200c.
      expect(r.canonicalDay0HotelCents).toBe(52200);
      expect(r.manualHotelCents).toBe(0);
      expect(r.manualHotelDelta).toBe(0); // ← was −52200 before fix
      expect(r.totalCents).toBe(72200);
      expect(r.effectiveTotalCents).toBe(72200); // ← was 20000 before fix (days only)
    });

    it('Day-0 flight row + NO manual flight payment → delta=0, effectiveTotalCents includes flight when toggle on', () => {
      const live: any[] = [];
      const costs = [
        { activity_id: null, day_number: 0, category: 'flight', cost_per_person_usd: 600, num_travelers: 2, source: 'logistics-sync' },
      ];
      const r = resolveCanonicalCostRows({
        costs: costs as any, liveActivities: live, includeHotel: false, includeFlight: true, manualPayments: [],
      });
      expect(r.canonicalDay0FlightCents).toBe(120000);
      expect(r.manualFlightCents).toBe(0);
      expect(r.manualFlightDelta).toBe(0);
      expect(r.totalCents).toBe(120000);
      expect(r.effectiveTotalCents).toBe(120000);
    });
  });

  // Regression: archive_orphan_trip_payments was archiving manual-* rows
  // because their item_id never matches any itinerary activity_id. Manual
  // rows are by design "orphan-immune" — their amounts must survive into
  // effectiveTotalCents via the manual fold. If a future change deletes
  // them via orphan archival, this test catches the silent $-loss that
  // surfaces as the phantom "Trip total changed by -$X" toast on Payments
  // tab mount. See mem://constraints/payments/manual-rows-orphan-immune.
  it('manual-* trip_payments survive into effectiveTotalCents (manual fold)', () => {
    const live = [
      { id: 'live-1', dayNumber: 1, name: 'Real museum', category: 'activity', jsonCost: 0 },
    ];
    const costs = [
      { activity_id: 'live-1', day_number: 1, category: 'activity', cost_per_person_usd: 50, num_travelers: 2 },
    ];
    const manualPayments = [
      { item_id: 'manual-abc', item_type: 'hotel',  amount_cents: 40000, quantity: 1 },
      { item_id: 'manual-def', item_type: 'other',  amount_cents: 24400, quantity: 1 },
    ];
    const r = resolveCanonicalCostRows({
      costs: costs as any,
      liveActivities: live,
      includeHotel: true,
      includeFlight: false,
      manualPayments: manualPayments as any,
    });
    // Activity rows: $50 × 2 = $100. Manual hotel adds $400, manual other adds $244.
    expect(r.totalCents).toBe(10000);
    expect(r.effectiveTotalCents).toBe(10000 + 40000 + 24400);
  });

  it('Casablanca: Day-0 hotel logistics row with synthetic activity_id is counted into effectiveTotalCents (includeHotel=true, no manual payment)', () => {
    // Mirrors trip fce9c4ba-… exactly: hotel row has day_number=0,
    // source='logistics-sync', synthetic activity_id NOT present in
    // liveActivities, no trip_payments. Pre-fix the orphan branch silently
    // dropped this row when it ever fell into the !isLogisticsRow path,
    // producing "Total from itinerary $812" while the per-row Hotel chip
    // showed $525.
    const live = [
      { id: 'a1', dayNumber: 1, name: 'Hassan II Mosque', category: 'activity', jsonCost: 0 },
      { id: 'a2', dayNumber: 1, name: 'Lunch at La Sqala', category: 'dining',  jsonCost: 0 },
    ];
    const costs = [
      { id: 'h',  activity_id: 'synthetic-hotel-id', day_number: 0, category: 'hotel',    cost_per_person_usd: 525, num_travelers: 1, source: 'logistics-sync' },
      { id: 'a1', activity_id: 'a1',                  day_number: 1, category: 'activity', cost_per_person_usd: 120, num_travelers: 2, source: 'reference' },
      { id: 'a2', activity_id: 'a2',                  day_number: 1, category: 'dining',   cost_per_person_usd: 10,  num_travelers: 2, source: 'reference' },
    ];
    const r = resolveCanonicalCostRows({
      costs: costs as any,
      liveActivities: live,
      includeHotel: true,
      includeFlight: false,
      manualPayments: [],
      travelers: 2,
    });
    // Hotel: $525, Activity: $120 × 2 = $240, Dining: $10 × 2 = $20 → $785 total.
    expect(r.totalCents).toBe(78500);
    expect(r.effectiveTotalCents).toBe(78500);
    expect(r.hotelCents).toBe(52500);
    expect(r.manualHotelDelta).toBe(0);
  });

  it('Casablanca: same fixture with includeHotel=false correctly excludes hotel from totalCents', () => {
    const live = [
      { id: 'a1', dayNumber: 1, name: 'Hassan II Mosque', category: 'activity', jsonCost: 0 },
    ];
    const costs = [
      { id: 'h',  activity_id: 'synthetic-hotel-id', day_number: 0, category: 'hotel',    cost_per_person_usd: 525, num_travelers: 1, source: 'logistics-sync' },
      { id: 'a1', activity_id: 'a1',                  day_number: 1, category: 'activity', cost_per_person_usd: 120, num_travelers: 2, source: 'reference' },
    ];
    const r = resolveCanonicalCostRows({
      costs: costs as any,
      liveActivities: live,
      includeHotel: false,
      includeFlight: false,
      manualPayments: [],
      travelers: 2,
    });
    expect(r.totalCents).toBe(24000); // activities only
    expect(r.hotelCents).toBe(52500); // bookkeeping still tracked for reserve math
  });

  // Tokyo recurrence guard — Days + Hotel = Days symptom.
  // See mem://constraints/finance/header-strip-mirrors-snapshot.
  it('Day-0 hotel ¥167,200 + includeHotel=true folds into effectiveTotalCents', () => {
    const live = [
      { id: 'd1a', dayNumber: 1, name: 'Lunch', category: 'dining', jsonCost: 0 },
    ];
    const costs = [
      { activity_id: 'd1a', day_number: 1, category: 'dining', cost_per_person_usd: 50, num_travelers: 2 },
      // Day-0 hotel row — note: cost_per_person_usd here is the per-person USD value
      { activity_id: null, day_number: 0, category: 'hotel', cost_per_person_usd: 836, num_travelers: 2 },
    ];
    const r = resolveCanonicalCostRows({
      costs: costs as any,
      liveActivities: live,
      includeHotel: true,
      includeFlight: false,
      manualPayments: [],
      travelers: 2,
    });
    expect(r.canonicalDay0HotelCents).toBe(167200);
    expect(r.hotelCents).toBe(167200);
    // Days (10000) + Hotel (167200) = 177200; manual delta is 0
    expect(r.effectiveTotalCents).toBe(177200);
    expect(r.manualHotelDelta).toBe(0);
  });

  it('manual hotel ¥167,200 with no Day-0 row folds into effectiveTotalCents', () => {
    const live = [
      { id: 'd1a', dayNumber: 1, name: 'Lunch', category: 'dining', jsonCost: 0 },
    ];
    const costs = [
      { activity_id: 'd1a', day_number: 1, category: 'dining', cost_per_person_usd: 50, num_travelers: 2 },
    ];
    const manualPayments = [
      { item_type: 'hotel', item_id: 'manual-hotel-1', amount_cents: 167200, quantity: 1 },
    ];
    const r = resolveCanonicalCostRows({
      costs: costs as any,
      liveActivities: live,
      includeHotel: true,
      includeFlight: false,
      manualPayments: manualPayments as any,
      travelers: 2,
    });
    expect(r.canonicalDay0HotelCents).toBe(0);
    expect(r.manualHotelCents).toBe(167200);
    expect(r.manualHotelDelta).toBe(167200);
    // Days (10000) + manual hotel delta (167200) = 177200
    expect(r.effectiveTotalCents).toBe(177200);
  });

  // Osaka regression: hotel sits on Day N (≥1), not Day 0, and there is no
  // manual payment. The header-strip Hotel chip reads canonicalDay0HotelCents
  // (NOT canonical.hotelCents) so a Day-N hotel — already counted inside the
  // day badge via useTripDayBreakdown — is not duplicated as a top-level chip.
  // See mem://constraints/finance/header-strip-mirrors-snapshot.
  it('Day-N hotel (no Day-0 row, no manual): canonicalDay0HotelCents stays 0', () => {
    const live = [
      { id: 'h1', dayNumber: 1, name: 'Four Seasons Osaka', category: 'hotel',  jsonCost: 0 },
      { id: 'd1', dayNumber: 1, name: 'Lunch',              category: 'dining', jsonCost: 0 },
    ];
    const costs = [
      { activity_id: 'h1', day_number: 1, category: 'hotel',  cost_per_person_usd: 1034, num_travelers: 2 },
      { activity_id: 'd1', day_number: 1, category: 'dining', cost_per_person_usd: 50,   num_travelers: 2 },
    ];
    const r = resolveCanonicalCostRows({
      costs: costs as any,
      liveActivities: live,
      includeHotel: true,
      includeFlight: false,
      manualPayments: [],
      travelers: 2,
    });
    expect(r.canonicalDay0HotelCents).toBe(0);
    // canonical.hotelCents still aggregates ALL hotel rows (truth) — only the
    // header strip narrows to Day-0 via canonicalDay0HotelCents.
    expect(r.hotelCents).toBe(206800);
    // Trip total counts the Day-N hotel exactly once (no double-fold).
    expect(r.totalCents).toBe(216800);          // (1034 + 50) * 2 * 100
    expect(r.effectiveTotalCents).toBe(216800); // delta is 0 (no manual)
    expect(r.manualHotelDelta).toBe(0);
  });
});
