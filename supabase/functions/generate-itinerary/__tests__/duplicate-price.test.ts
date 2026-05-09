import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { applyValidationGate } from '../pipeline/validation-gate.ts';
import { FAILURE_CODES } from '../pipeline/types.ts';

Deno.test('SUSPICIOUS_DUPLICATE_PRICE gate handler blanks duplicated cost', () => {
  const day: any = {
    dayNumber: 2,
    date: '2026-06-02',
    title: 'Day 2',
    activities: [
      { id: 'a1', title: 'Lunch at Da Ivo', category: 'dining',
        startTime: '13:00', endTime: '14:30',
        cost: { amount: 80, currency: 'EUR' },
        location: { name: 'Da Ivo', address: '' },
        description: '', tags: [],
        bookingRequired: false,
        transportation: { method: '', duration: '', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
      },
      { id: 'a2', title: 'Dinner at Quadri', category: 'dining',
        startTime: '20:00', endTime: '22:00',
        cost: { amount: 80, currency: 'EUR' },
        estimatedCost: { amount: 80, currency: 'EUR' },
        price_per_person: 80,
        location: { name: 'Quadri', address: '' },
        description: '', tags: [],
        bookingRequired: false,
        transportation: { method: '', duration: '', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
      },
    ],
  };
  const results = [{
    code: FAILURE_CODES.SUSPICIOUS_DUPLICATE_PRICE,
    severity: 'critical' as const,
    message: 'duplicate price',
    activityIndex: 1,
    field: 'cost.amount',
    autoRepairable: true,
  }];
  const gate = applyValidationGate(day, results, { dayNumber: 2, destination: 'Venice' });
  assertEquals(gate.verdict, 'persist_forced');
  assertEquals(gate.counters.blankedFields, 1);
  assertEquals(gate.counters.forcedDowngrades, 1);
  const a2: any = day.activities[1];
  assertEquals(a2.cost.amount, 0);
  assertEquals(a2.estimatedCost.amount, 0);
  assertEquals(a2.price_per_person, 0);
  // First activity untouched
  const a1: any = day.activities[0];
  assertEquals(a1.cost.amount, 80);
});

Deno.test('No SUSPICIOUS_DUPLICATE_PRICE → gate persists clean', () => {
  const day: any = { dayNumber: 1, date: '', title: '', activities: [] };
  const gate = applyValidationGate(day, [], { dayNumber: 1 });
  assertEquals(gate.verdict, 'persist');
  assertEquals(gate.counters.blankedFields, 0);
});
