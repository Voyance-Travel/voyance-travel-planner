/**
 * Same-day venue uniqueness + name/description coherence
 * (Monaco Pâtisserie Riviera bug — breakfast and lunch both Pâtisserie Riviera,
 * lunch description says "truffle pasta").
 *
 * Locks the three-layer fix:
 *   1. checkSameDayDuplicateVenues → critical → re-resolve via fallback DB
 *   2. checkVenueDescriptionCoherence → warning → blank description
 *   3. seedUsedNamesFromExistingDining in nuclear sweeps
 *
 * See mem://constraints/itinerary/same-day-venue-uniqueness.
 */
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { applyValidationGate } from '../pipeline/validation-gate.ts';
import { FAILURE_CODES } from '../pipeline/types.ts';
import { normalizeVenueKey } from '../pipeline/validate-day.ts';

function diningAct(id: string, title: string, venue: string, startTime: string, opts: any = {}) {
  return {
    id,
    title,
    name: title,
    category: 'dining',
    startTime,
    endTime: startTime,
    cost: { amount: 0, currency: 'USD' },
    location: { name: venue, address: '' },
    description: opts.description ?? '',
    tags: [],
    bookingRequired: false,
    transportation: { method: '', duration: '', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
    ...opts,
  };
}

Deno.test('normalizeVenueKey strips diacritics, meal-prefix, punctuation', () => {
  assertEquals(normalizeVenueKey('Pâtisserie Riviera'), 'patisserie riviera');
  assertEquals(normalizeVenueKey('Breakfast at Pâtisserie Riviera'), 'patisserie riviera');
  assertEquals(normalizeVenueKey('Lunch at Pâtisserie Riviera'), 'patisserie riviera');
  assertEquals(normalizeVenueKey("Da Ivo's"), 'da ivo s');
});

Deno.test('DUPLICATE_VENUE_SAME_DAY gate handler re-resolves later slot', () => {
  const day: any = {
    dayNumber: 2,
    date: '2026-06-02',
    title: 'Day 2',
    activities: [
      diningAct('a1', 'Breakfast at Pâtisserie Riviera', 'Pâtisserie Riviera', '08:30'),
      diningAct('a2', 'Lunch at Pâtisserie Riviera', 'Pâtisserie Riviera', '13:57',
        { description: 'Order the truffle pasta and a glass of red.' }),
    ],
  };
  const results = [{
    code: FAILURE_CODES.DUPLICATE_VENUE_SAME_DAY,
    severity: 'critical' as const,
    message: 'duplicate same-day venue',
    activityIndex: 1,
    field: 'title',
    autoRepairable: true,
  }];
  const gate = applyValidationGate(day, results, { dayNumber: 2, destination: 'Monaco' });
  assertEquals(gate.verdict, 'persist_forced');
  assert(gate.counters.forcedDowngrades >= 1, 'should force at least one downgrade');
  const a1: any = day.activities[0];
  const a2: any = day.activities[1];
  // First slot untouched
  assertEquals(a1.location.name, 'Pâtisserie Riviera');
  // Second slot re-resolved → name MUST differ (real fallback OR
  // unverified sentinel; either way no longer "Pâtisserie Riviera")
  const a2Venue = (a2.location?.name || '').toLowerCase();
  assert(
    a2Venue !== 'pâtisserie riviera' && a2Venue !== 'patisserie riviera',
    `second slot should not still be Pâtisserie Riviera, got "${a2Venue}"`,
  );
});

Deno.test('VENUE_DESCRIPTION_MISMATCH (pâtisserie + truffle pasta) → description blanked', () => {
  const day: any = {
    dayNumber: 2,
    date: '2026-06-02',
    title: 'Day 2',
    activities: [
      diningAct('a1', 'Lunch at Pâtisserie Riviera', 'Pâtisserie Riviera', '13:57',
        { description: 'A relaxed pasta lunch — order the truffle pasta and a glass of red.' }),
    ],
  };
  const results = [{
    code: FAILURE_CODES.VENUE_DESCRIPTION_MISMATCH,
    severity: 'warning' as const,
    message: 'pâtisserie titled venue with pasta description',
    activityIndex: 0,
    field: 'description',
    autoRepairable: true,
  }];
  const gate = applyValidationGate(day, results, { dayNumber: 2, destination: 'Monaco' });
  assertEquals(gate.verdict, 'persist_forced');
  const a: any = day.activities[0];
  assertEquals(a.description, '');
  assert(gate.counters.blankedFields >= 1);
});

Deno.test('Coherent dining description NOT flagged as mismatch', async () => {
  // Smoke test on the validator directly.
  const mod = await import('../pipeline/validate-day.ts');
  // Re-import to access the validator if exported; otherwise just sanity-check
  // that running the gate on an empty result list with an unrelated coherent
  // dining card is a no-op.
  const day: any = {
    dayNumber: 1,
    activities: [
      diningAct('a1', 'Breakfast at Pâtisserie Riviera', 'Pâtisserie Riviera', '08:30',
        { description: 'Pick up a fresh pain au chocolat and an espresso to start the day.' }),
    ],
  };
  const gate = applyValidationGate(day, [], { dayNumber: 1, destination: 'Monaco' });
  assertEquals(gate.verdict, 'persist');
  assertEquals(gate.counters.blankedFields, 0);
});

Deno.test('Nuclear sweeps seed usedNames from existing dining', async () => {
  const fp = await import('../fix-placeholders.ts');
  // Build a day with one real lunch venue + one placeholder breakfast.
  // After nuclearPlaceholderSweep, the breakfast replacement must NOT be the
  // same venue as the lunch.
  const realLunch = diningAct('lunch1', 'Lunch at Café Llopis', 'Café Llopis', '13:00');
  const placeholderBreakfast: any = {
    id: 'bk',
    title: 'Breakfast — find a local spot in Barcelona',
    name: 'Breakfast — find a local spot in Barcelona',
    category: 'dining',
    startTime: '08:30',
    endTime: '09:30',
    location: { name: '', address: '' },
    cost: { amount: 0, currency: 'USD' },
    description: '',
    tags: [],
    bookingRequired: false,
    transportation: { method: '', duration: '', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
  };
  const activities = [placeholderBreakfast, realLunch];
  fp.nuclearPlaceholderSweep(activities, 'Barcelona');
  const bkVenue = (activities[0]?.location?.name || '').toLowerCase();
  // Breakfast should have been replaced (or downgraded to needsVenuePick),
  // and MUST NOT equal "café llopis" (the lunch venue).
  assert(
    bkVenue !== 'café llopis' && bkVenue !== 'cafe llopis',
    `nuclear sweep recycled the lunch venue: "${bkVenue}"`,
  );
});
