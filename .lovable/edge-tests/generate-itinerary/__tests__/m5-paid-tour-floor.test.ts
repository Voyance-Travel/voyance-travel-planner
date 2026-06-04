// M5 — Paid-tour price floor regression
// Verifies that $0/Free on paid-tour subcategories (bike_tour, food_tour,
// cooking_class, wine_tasting, boat_tour) is detected and auto-substituted
// to the category median, while genuinely free categories (museum,
// walking_tour with min=0) are left untouched.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  CATEGORY_PRICE_CEILINGS,
  inferSubcategory,
  shouldSkipPriceSanity,
} from '../_shared/category-price-bounds.ts';

Deno.test('M5: e-Bike tour detected as bike_tour', () => {
  const act = {
    title: 'e-Bike Tour of Retiro Park',
    category: 'activity',
    startTime: '10:00',
  };
  assertEquals(inferSubcategory(act), 'bike_tour');
  const bound = CATEGORY_PRICE_CEILINGS['bike_tour'];
  assertEquals(bound.min > 0, true);
});

Deno.test('M5: tapas food tour detected as food_tour', () => {
  const act = { title: 'Evening Tapas Food Tour', category: 'activity' };
  assertEquals(inferSubcategory(act), 'food_tour');
});

Deno.test('M5: paella cooking class detected as cooking_class', () => {
  const act = { title: 'Paella Cooking Class with Local Chef', category: 'activity' };
  assertEquals(inferSubcategory(act), 'cooking_class');
});

Deno.test('M5: wine tasting detected as wine_tasting', () => {
  const act = { title: 'Rioja Wine Tasting Experience', category: 'activity' };
  assertEquals(inferSubcategory(act), 'wine_tasting');
});

Deno.test('M5: sunset boat tour detected as boat_tour', () => {
  const act = { title: 'Sunset Boat Tour', category: 'activity' };
  assertEquals(inferSubcategory(act), 'boat_tour');
});

Deno.test('M5: museum still allows free (min=0)', () => {
  const act = { title: 'British Museum', category: 'sightseeing' };
  assertEquals(inferSubcategory(act), 'museum');
  assertEquals(CATEGORY_PRICE_CEILINGS['museum'].min, 0);
});

Deno.test('M5: free walking tour still allows $0 (min=0)', () => {
  const act = { title: 'Free Walking Tour of the Old Town', category: 'activity' };
  assertEquals(inferSubcategory(act), 'walking_tour');
  assertEquals(CATEGORY_PRICE_CEILINGS['walking_tour'].min, 0);
});

Deno.test('M5: locked $0 e-bike tour is skipped (Universal Locking)', () => {
  const act = {
    title: 'e-Bike Tour of Retiro Park',
    category: 'activity',
    is_locked: true,
    cost: { amount: 0, currency: 'USD' },
  };
  assertEquals(shouldSkipPriceSanity(act), true);
});

Deno.test('M5: user-overridden $0 paid tour is skipped', () => {
  const act = {
    title: 'e-Bike Tour',
    category: 'activity',
    cost: { amount: 0, currency: 'USD', basis: 'user_override' },
  };
  assertEquals(shouldSkipPriceSanity(act), true);
});

Deno.test('M5: bike_tour median is in expected range (post-luxury bump)', () => {
  const b = CATEGORY_PRICE_CEILINGS['bike_tour'];
  const median = Math.round((b.min + b.max) / 2);
  // Post-bump: min=25, max=200 → median ≈ 113. Window covers reasonable drift.
  assertEquals(median >= 90 && median <= 130, true);
});

// ── Inverse-direction guard (M5 user addendum) ──
// Legitimate luxury private tours must NOT trip PRICE_IMPLAUSIBLE.

Deno.test('M5 inverse: $150 private e-Bike tour is within bike_tour ceiling', () => {
  const ceiling = CATEGORY_PRICE_CEILINGS['bike_tour'].max;
  // $150 covers the Salamanca / private-guide reference case the user flagged.
  assertEquals(150 <= ceiling, true);
});

Deno.test('M5 inverse: $180 private tapas tour is within food_tour ceiling', () => {
  assertEquals(180 <= CATEGORY_PRICE_CEILINGS['food_tour'].max, true);
});

Deno.test('M5 inverse: $175 private cellar wine tasting is within wine_tasting ceiling', () => {
  assertEquals(175 <= CATEGORY_PRICE_CEILINGS['wine_tasting'].max, true);
});

Deno.test('M5 inverse: $300 outlier still flagged (locked rows are the escape hatch)', () => {
  // Documents the deliberate boundary: anything above $200 is still treated
  // as implausible and substituted to median; user-locked / basis=user rows
  // bypass via shouldSkipPriceSanity. Keeps the AI hallucination guard
  // meaningful without permitting unbounded prices.
  assertEquals(300 > CATEGORY_PRICE_CEILINGS['bike_tour'].max, true);
});

// ── Walking-tour bimodal split (M5 addendum) ──

Deno.test('M5 addendum: guided walking tour detected as walking_tour_paid', () => {
  const act = { title: 'Guided Walking Tour of Madrid Old Town', category: 'activity' };
  assertEquals(inferSubcategory(act), 'walking_tour_paid');
  assertEquals(CATEGORY_PRICE_CEILINGS['walking_tour_paid'].min, 15);
});

Deno.test('M5 addendum: free walking tour stays walking_tour (min $0)', () => {
  const act = { title: 'Free Walking Tour of Centre', category: 'activity' };
  assertEquals(inferSubcategory(act), 'walking_tour');
  assertEquals(CATEGORY_PRICE_CEILINGS['walking_tour'].min, 0);
});

Deno.test('M5 addendum: paid food walking tour → walking_tour_paid (paid prefix wins over food)', () => {
  const act = { title: 'Paid food walking tour of La Latina', category: 'activity' };
  assertEquals(inferSubcategory(act), 'walking_tour_paid');
});

Deno.test('M5 addendum: locked premium walking tour at $0 is skipped (Universal Locking)', () => {
  const act = {
    title: 'Premium Walking Tour of Toledo',
    category: 'activity',
    is_locked: true,
    cost: { amount: 0, currency: 'USD' },
  };
  assertEquals(shouldSkipPriceSanity(act), true);
});

Deno.test('M5 addendum: bare "walking tour" still falls back to walking_tour (min $0)', () => {
  const act = { title: 'Walking Tour', category: 'activity' };
  assertEquals(inferSubcategory(act), 'walking_tour');
});
