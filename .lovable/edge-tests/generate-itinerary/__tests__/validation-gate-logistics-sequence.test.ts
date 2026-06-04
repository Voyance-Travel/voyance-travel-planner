/**
 * Regression: Validation Gate must DROP a post-checkout dining card on a
 * departure day, not blank its `startTime` (which manufactured the recurring
 * "floating Lunch after airport transfer" card across Kyoto / Bali / HK /
 * Bruges / CDMX / Montreal trips).
 *
 * Root cause was the default critical handler in `applyValidationGate`
 * treating `LOGISTICS_SEQUENCE` like a punctuation-only field problem and
 * blanking `field: 'startTime'`. We now have an explicit drop branch.
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { applyValidationGate } from '../pipeline/validation-gate.ts';
import { FAILURE_CODES } from '../pipeline/types.ts';

Deno.test('LOGISTICS_SEQUENCE critical drops the activity (no floating card)', () => {
  const day: any = {
    dayNumber: 3,
    date: '2026-05-22',
    activities: [
      { id: 'breakfast', title: 'Breakfast at hotel', startTime: '08:30', endTime: '09:30', category: 'dining' },
      { id: 'checkout',  title: 'Checkout from hotel', startTime: '11:00', endTime: '11:30', category: 'accommodation' },
      { id: 'transfer',  title: 'Transfer to Airport', startTime: '12:30', endTime: '13:15', category: 'transport' },
      { id: 'lunch',     title: 'Lunch: Sobanomi Yoshimura', startTime: '12:30', endTime: '13:30', category: 'dining' },
    ],
  };

  const results = [
    {
      code: FAILURE_CODES.LOGISTICS_SEQUENCE,
      severity: 'critical' as const,
      message: 'Activity "Lunch: Sobanomi Yoshimura" is scheduled after final checkout',
      activityIndex: 3,
      field: 'startTime',
      autoRepairable: true,
    },
  ];

  const gate = applyValidationGate(day, results, { dayNumber: 3, destination: 'Kyoto' });

  // The lunch must be dropped, not blanked.
  assertEquals(gate.day.activities.length, 3);
  assertEquals(gate.day.activities.some((a: any) => a.id === 'lunch'), false);
  assertEquals(gate.counters.droppedActivities, 1);
  assertEquals(gate.counters.blankedFields, 0);
  // Other activities must keep their startTime.
  for (const a of gate.day.activities as any[]) {
    assertEquals(typeof a.startTime, 'string');
    assertEquals(a.startTime.length > 0, true);
  }
});
