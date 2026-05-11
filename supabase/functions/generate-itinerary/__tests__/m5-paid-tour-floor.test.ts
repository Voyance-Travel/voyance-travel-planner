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

Deno.test('M5: bike_tour median is in expected range', () => {
  const b = CATEGORY_PRICE_CEILINGS['bike_tour'];
  const median = Math.round((b.min + b.max) / 2);
  assertEquals(median >= 50 && median <= 65, true);
});
