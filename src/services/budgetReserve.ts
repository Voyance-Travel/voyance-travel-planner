/**
 * Shared "Spending Money & Tips" reserve math.
 *
 * The misc allocation is a committed cash reserve — the itinerary never
 * auto-fills it, but it MUST count against the budget total. Otherwise users
 * see phantom headroom equal to the entire reserve. Once the user logs real
 * misc expenses, those expenses consume the reserve (they don't stack on top).
 *
 * All three call sites (snapshot hook, BudgetSummary, getCategoryAllocations)
 * route through here so the numbers can never disagree.
 */

export interface ReserveInputs {
  budgetTotalCents: number;
  miscPercent: number;          // 0..100
  committedHotelCents: number;
  committedFlightCents: number;
  includeHotel: boolean;
  includeFlight: boolean;
  loggedMiscCents: number;      // sum of activity_costs rows with category='misc'
}

export interface ReserveResult {
  /** What the user planned to set aside (the slider × discretionary base). */
  reserveCents: number;
  /** What the user has actually logged so far (capped at reserve in display). */
  loggedCents: number;
  /** Reserve minus logged, floored at 0 — the unspent cash still earmarked. */
  unspentReserveCents: number;
  /** Amount that should be added to the trip total beyond logged misc rows. */
  contributionToTotalCents: number;
}

export function computeMiscReserve(inputs: ReserveInputs): ReserveResult {
  const {
    budgetTotalCents,
    miscPercent,
    committedHotelCents,
    committedFlightCents,
    includeHotel,
    includeFlight,
    loggedMiscCents,
  } = inputs;

  const fixed =
    (includeHotel ? committedHotelCents : 0) +
    (includeFlight ? committedFlightCents : 0);
  const discretionaryRemainder = Math.max(budgetTotalCents - fixed, 0);

  // Mirror getCategoryAllocations: when fixed cost has swallowed everything,
  // fall back to the full budget total so the slider % still has meaning.
  const allocBase = discretionaryRemainder === 0 && budgetTotalCents > 0
    ? budgetTotalCents
    : discretionaryRemainder;

  const reserveCents = Math.max(0, Math.round(allocBase * (miscPercent / 100)));
  const logged = Math.max(0, loggedMiscCents);
  const unspentReserveCents = Math.max(0, reserveCents - logged);

  // Logged rows are already in activity_costs / trip total. The "extra" we
  // contribute is only the still-unspent portion of the reserve.
  return {
    reserveCents,
    loggedCents: logged,
    unspentReserveCents,
    contributionToTotalCents: unspentReserveCents,
  };
}
