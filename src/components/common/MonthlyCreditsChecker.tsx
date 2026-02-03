/**
 * Monthly Credits Checker Component
 * Silently checks and grants monthly free credits on app load
 */

import { useMonthlyCredits } from '@/hooks/useMonthlyCredits';

export function MonthlyCreditsChecker() {
  useMonthlyCredits();
  return null;
}

export default MonthlyCreditsChecker;
