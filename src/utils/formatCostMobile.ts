/**
 * Abbreviates large costs for mobile display.
 * e.g. 1234 → "$1.2K", 950 → "$950", 15600 → "$15.6K"
 */
export function formatCostMobile(
  amount: number,
  currencySymbol = '$',
): string {
  if (amount >= 1_000_000) {
    const val = amount / 1_000_000;
    return `${currencySymbol}${parseFloat(val.toFixed(1))}M`;
  }
  if (amount >= 1_000) {
    const val = amount / 1_000;
    return `${currencySymbol}${parseFloat(val.toFixed(1))}K`;
  }
  return `${currencySymbol}${Math.round(amount)}`;
}
