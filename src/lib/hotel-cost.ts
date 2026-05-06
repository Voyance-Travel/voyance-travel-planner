/**
 * Hotel cost helper — single source of truth for hotel total math.
 *
 * The Flights & Hotels tab, the Payments tab (`usePayableItems`), and the
 * server-side ledger sync (`syncHotelToLedger`) all need to compute the same
 * dollar number from the same hotel selection. When this math diverges, the
 * UI shows different totals in different tabs (e.g. the "Hotel Accommodation
 * $2,850" + manual "Four Seasons $2,400" double-bill that hit production).
 *
 * Keep this pure and dependency-free so it can be reused server-side too.
 */

export interface HotelLike {
  totalPrice?: number | null;
  pricePerNight?: number | null;
  nights?: number | null;
}

export interface CityHotelLike {
  hotel?: HotelLike | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
}

function nightsBetween(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  if (isNaN(a) || isNaN(b) || b <= a) return 0;
  return Math.max(1, Math.ceil((b - a) / (1000 * 60 * 60 * 24)));
}

/**
 * Compute the total hotel cost in USD across all stays.
 *
 * Precedence:
 *  1. Multi-city `allHotels`: sum each hotel's `totalPrice`, falling back to
 *     `pricePerNight × nights(checkIn,checkOut)` per hotel when missing.
 *  2. Legacy single `hotelSelection`: `totalPrice` wins; otherwise
 *     `pricePerNight × (nights ?? Math.max(1, daysCount - 1))`.
 *  3. Otherwise 0.
 */
export function computeHotelCostUsd(
  allHotels: CityHotelLike[] | null | undefined,
  hotelSelection: HotelLike | null | undefined,
  daysCount: number,
): number {
  if (allHotels && allHotels.length > 0) {
    return allHotels.reduce((sum, h) => {
      const hotel = h?.hotel;
      if (!hotel) return sum;
      if (hotel.totalPrice && hotel.totalPrice > 0) return sum + hotel.totalPrice;
      const ppn = hotel.pricePerNight || 0;
      if (ppn > 0) {
        const n = nightsBetween(h.checkInDate, h.checkOutDate);
        if (n > 0) return sum + ppn * n;
      }
      return sum;
    }, 0);
  }

  if (!hotelSelection) return 0;
  if (hotelSelection.totalPrice && hotelSelection.totalPrice > 0) {
    return hotelSelection.totalPrice;
  }
  const ppn = hotelSelection.pricePerNight || 0;
  if (ppn <= 0) return 0;
  const nights = hotelSelection.nights && hotelSelection.nights > 0
    ? hotelSelection.nights
    : Math.max(1, (daysCount || 1) - 1);
  return ppn * nights;
}
