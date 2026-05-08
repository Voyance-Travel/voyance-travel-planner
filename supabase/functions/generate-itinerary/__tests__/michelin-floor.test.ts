import { describe, it, expect } from 'vitest';
import { enforceMichelinPriceFloor, enforceBarNightcapPriceCap } from '../sanitization';

const make = (title: string, price: number, extra: Record<string, any> = {}) => ({
  title,
  category: 'DINING',
  cost: { amount: price, currency: 'EUR' },
  ...extra,
});

describe('enforceMichelinPriceFloor — universal coverage', () => {
  it('floors Quadri (Venice 1-star) at 120/pp', () => {
    const a = make('Dinner at Ristorante Quadri', 26);
    enforceMichelinPriceFloor(a);
    expect(a.cost.amount).toBeGreaterThanOrEqual(120);
  });

  it('floors Glam Enrico Bartolini (Venice 1-star)', () => {
    const a = make('Lunch at Glam Enrico Bartolini', 30);
    enforceMichelinPriceFloor(a);
    expect(a.cost.amount).toBeGreaterThanOrEqual(120);
  });

  it('floors Oro at Belmond Cipriani (2-star)', () => {
    const a = make('Dinner at Oro Restaurant, Belmond Cipriani', 40);
    enforceMichelinPriceFloor(a);
    expect(a.cost.amount).toBeGreaterThanOrEqual(180);
  });

  it('floors La Pergola (Rome 3-star) at 250', () => {
    const a = make('Dinner at La Pergola', 50);
    enforceMichelinPriceFloor(a);
    expect(a.cost.amount).toBeGreaterThanOrEqual(250);
  });

  it('luxury-hotel heuristic floors un-catalogued hotel restaurants at 60', () => {
    const a = make('Dinner at Mandarin Oriental Restaurant', 28);
    enforceMichelinPriceFloor(a);
    expect(a.cost.amount).toBeGreaterThanOrEqual(60);
    expect((a as any).metadata?.cost_floor_reason).toBe('luxury_hotel_dining_heuristic');
  });

  it('does NOT floor casual non-hotel dining', () => {
    const a = make('Lunch at a casual trattoria', 25);
    enforceMichelinPriceFloor(a);
    expect(a.cost.amount).toBe(25);
  });
});
