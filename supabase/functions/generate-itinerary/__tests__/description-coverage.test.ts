/**
 * Description Coverage validator tests.
 *
 * Closes Madrid intermittent blank-restaurant-blurb pattern:
 *   Café Comercial: "Order the chocolate con churros" ← OK
 *   Next restaurant on same trip: blank ← was silently empty
 *
 * The validator emits MISSING_DESCRIPTION (error), GENERIC_DESCRIPTION (warning),
 * and RESTAURANT_MISSING_RECOMMENDATION (warning). Skips locked, transit,
 * bookend, and ghost rows.
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { validateDay } from '../pipeline/validate-day.ts';
import { FAILURE_CODES } from '../pipeline/types.ts';

function mkDay(activities: any[]): any {
  return { dayNumber: 1, theme: '', activities };
}

const baseInput = {
  dayNumber: 1, isFirstDay: false, isLastDay: false, totalDays: 3,
  hasHotel: true, hotelName: 'Hotel Test',
  arrivalTime24: '10:00', returnDepartureTime24: undefined,
  requiredMeals: [], previousDays: [],
  destination: 'Madrid',
};

function codeCount(results: any[], code: string): number {
  return results.filter(r => r.code === code).length;
}

Deno.test('MISSING_DESCRIPTION: empty restaurant description', () => {
  const day = mkDay([
    {
      id: 'a1', title: 'Dinner at Botín', startTime: '20:00', endTime: '22:00',
      category: 'dining', description: '',
    },
  ]);
  const r = validateDay({ ...baseInput, day } as any);
  assertEquals(codeCount(r, FAILURE_CODES.MISSING_DESCRIPTION), 1);
});

Deno.test('MISSING_DESCRIPTION: 25-char description fails length floor', () => {
  const day = mkDay([
    {
      id: 'a1', title: 'Lunch at Casa Lucio', startTime: '13:00', endTime: '14:30',
      category: 'dining', description: 'Order the cocido madrileño',
    },
  ]);
  const r = validateDay({ ...baseInput, day } as any);
  assertEquals(codeCount(r, FAILURE_CODES.MISSING_DESCRIPTION), 1);
});

Deno.test('GENERIC_DESCRIPTION: "This is a great spot" flagged', () => {
  const day = mkDay([
    {
      id: 'a1', title: 'Visit Reina Sofía', startTime: '11:00', endTime: '13:00',
      category: 'museum', description: 'This is a great place to visit.',
    },
  ]);
  const r = validateDay({ ...baseInput, day } as any);
  assertEquals(codeCount(r, FAILURE_CODES.GENERIC_DESCRIPTION), 1);
});

Deno.test('Restaurant with actionable recommendation passes', () => {
  const day = mkDay([
    {
      id: 'a1', title: 'Dinner at Botín', startTime: '20:00', endTime: '22:00',
      category: 'dining',
      description: 'Request a table in the 16th-century cellar and order the cochinillo asado — the wood-fired oven is the oldest in the world.',
    },
  ]);
  const r = validateDay({ ...baseInput, day } as any);
  assertEquals(codeCount(r, FAILURE_CODES.MISSING_DESCRIPTION), 0);
  assertEquals(codeCount(r, FAILURE_CODES.RESTAURANT_MISSING_RECOMMENDATION), 0);
});

Deno.test('RESTAURANT_MISSING_RECOMMENDATION: descriptive but no actionable verb', () => {
  const day = mkDay([
    {
      id: 'a1', title: 'Lunch at Casa Lucio', startTime: '13:00', endTime: '14:30',
      category: 'dining',
      description: 'Authentic Spanish cuisine in the historic centre of Madrid, popular with locals and visitors alike.',
    },
  ]);
  const r = validateDay({ ...baseInput, day } as any);
  assertEquals(codeCount(r, FAILURE_CODES.RESTAURANT_MISSING_RECOMMENDATION), 1);
});

Deno.test('Skips: transit / bookend / locked rows', () => {
  const day = mkDay([
    { id: 't1', title: 'Walk to Plaza Mayor', startTime: '10:00', endTime: '10:10', category: 'transport', description: '' },
    { id: 't2', title: 'Return to Hotel', startTime: '23:00', endTime: '23:30', category: 'accommodation', description: '' },
    { id: 't3', title: 'Hotel Check-in', startTime: '15:00', endTime: '15:30', category: 'accommodation', description: '' },
    { id: 't4', title: 'Locked Activity', startTime: '12:00', endTime: '13:00', category: 'museum', description: '', isLocked: true },
  ]);
  const r = validateDay({ ...baseInput, day } as any);
  assertEquals(codeCount(r, FAILURE_CODES.MISSING_DESCRIPTION), 0);
});

Deno.test('Regression: phantom-ref scrub blanks restaurant description → caught', () => {
  // Simulates state after scrubPhantomEventRefs cleared the only sentence.
  const day = mkDay([
    {
      id: 'a1', title: 'Dinner at DiverXO', startTime: '20:30', endTime: '22:30',
      category: 'dining', description: '',
    },
  ]);
  const r = validateDay({ ...baseInput, day } as any);
  assertEquals(codeCount(r, FAILURE_CODES.MISSING_DESCRIPTION), 1);
});
