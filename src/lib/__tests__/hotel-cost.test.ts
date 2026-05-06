import { describe, it, expect } from 'vitest';
import { computeHotelCostUsd } from '../hotel-cost';

describe('computeHotelCostUsd', () => {
  it('returns 0 when no hotels and no selection', () => {
    expect(computeHotelCostUsd(null, null, 5)).toBe(0);
    expect(computeHotelCostUsd([], undefined, 5)).toBe(0);
  });

  it('multi-city: sums totalPrice across hotels', () => {
    const result = computeHotelCostUsd(
      [
        { hotel: { totalPrice: 1200 } },
        { hotel: { totalPrice: 800 } },
      ],
      null,
      6,
    );
    expect(result).toBe(2000);
  });

  it('multi-city: falls back to pricePerNight x nights via dates', () => {
    const result = computeHotelCostUsd(
      [
        { hotel: { pricePerNight: 600 }, checkInDate: '2026-05-10', checkOutDate: '2026-05-14' },
      ],
      null,
      5,
    );
    expect(result).toBe(2400);
  });

  it('single hotel: totalPrice wins over pricePerNight', () => {
    expect(
      computeHotelCostUsd(null, { totalPrice: 2400, pricePerNight: 999 }, 5),
    ).toBe(2400);
  });

  it('single hotel: falls back to pricePerNight x (days - 1) when no nights', () => {
    expect(computeHotelCostUsd(null, { pricePerNight: 600 }, 5)).toBe(2400);
  });

  it('single hotel: respects explicit nights field', () => {
    expect(
      computeHotelCostUsd(null, { pricePerNight: 600, nights: 3 }, 10),
    ).toBe(1800);
  });

  it('single hotel: zero when no price information', () => {
    expect(computeHotelCostUsd(null, { nights: 3 }, 5)).toBe(0);
  });

  it('multi-city beats legacy selection', () => {
    expect(
      computeHotelCostUsd(
        [{ hotel: { totalPrice: 500 } }],
        { totalPrice: 9999 },
        5,
      ),
    ).toBe(500);
  });
});
