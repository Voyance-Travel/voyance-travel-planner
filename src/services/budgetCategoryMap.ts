/**
 * Shared mapping from raw `activity_costs.category` strings to the canonical
 * BudgetCategory used by Budget by Category and Payments tab.
 *
 * Single source of truth — used by both `tripBudgetService.ts` (Budget) and
 * `usePayableItems.ts` (Payments) so the two surfaces never disagree on which
 * bucket a row belongs to.
 */

export type BudgetCategoryKey = 'hotel' | 'flight' | 'food' | 'activities' | 'transit' | 'misc';

export function toBudgetCategory(raw: string | null | undefined): BudgetCategoryKey {
  const cat = (raw || '').toLowerCase();
  if (cat === 'hotel' || cat === 'accommodation') return 'hotel';
  if (cat === 'flight') return 'flight';
  if (['food', 'dining', 'restaurant', 'meal', 'breakfast', 'lunch', 'dinner', 'cafe', 'coffee'].includes(cat)) return 'food';
  if (['transport', 'transportation', 'transit', 'transfer', 'taxi', 'metro'].includes(cat)) return 'transit';
  if (['nightlife', 'bar', 'club', 'shopping', 'misc'].includes(cat)) return 'misc';
  return 'activities';
}
