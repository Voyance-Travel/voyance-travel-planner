/**
 * FINAL_ORPHAN_TRANSIT — late post-injection repoint/remove net (repair-day §8e).
 *
 * Distinct from §1b ORPHANED_TRANSIT_NODE which is keyed on validate-day output
 * and only removes. §8e runs as a structural scan over the post-injection day
 * shape and prefers repointing the transit destination to the next real
 * activity when one exists.
 *
 * See mem://constraints/itinerary/orphan-transit-late-repair
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { repairDay } from '../pipeline/repair-day.ts';
import { FAILURE_CODES } from '../pipeline/types.ts';

function transit(title: string, extra: Record<string, unknown> = {}) {
  return {
    id: `transit-${title.replace(/\s+/g, '-')}`,
    title,
    category: 'transport',
    startTime: '12:30',
    endTime: '13:30',
    durationMinutes: 60,
    ...extra,
  };
}

function activity(title: string, extra: Record<string, unknown> = {}) {
  return {
    id: `act-${title.replace(/\s+/g, '-')}`,
    title,
    category: 'sightseeing',
    startTime: '13:45',
    endTime: '15:00',
    location: { name: title },
    ...extra,
  };
}

function call(activities: any[]) {
  return repairDay({
    day: { dayNumber: 2, title: 'Day 2', activities } as any,
    validationResults: [],
    dayNumber: 2,
    isFirstDay: false,
    isLastDay: false,
    destination: 'Dublin, Ireland',
  } as any);
}

Deno.test('§8e repoints orphan transit to the next real activity', () => {
  const result = call([
    transit('Taxi to The Shelbourne'),
    activity("Lunch at Hugo's", { category: 'dining', startTime: '13:45', endTime: '15:00' }),
  ]);
  const out = result.day.activities;
  const repointed = out.find((a: any) => /Taxi to/i.test(a.title));
  assert(repointed, 'transit card should be preserved (repointed, not removed)');
  assert(/Hugo'?s/i.test(repointed.title), `expected title to repoint to Hugo's, got "${repointed.title}"`);
  assertEquals((repointed as any).metadata?.transit_unverified, true);
  assertEquals(repointed.source, 'repair-orphan-repoint');
  assert(result.repairs.some(r => r.code === FAILURE_CODES.FINAL_ORPHAN_TRANSIT && r.action === 'repointed_orphan_transit'));
});

Deno.test('§8e removes orphan transit with no next activity', () => {
  const result = call([
    activity('Pastéis de Belém', { startTime: '10:00', endTime: '11:00' }),
    transit('Walk to Cafe Chris', { startTime: '15:00', endTime: '15:30' }),
  ]);
  const out = result.day.activities;
  assert(!out.some((a: any) => /Cafe Chris/i.test(a.title)), 'orphan transit should be removed');
  assert(result.repairs.some(r => r.code === FAILURE_CODES.FINAL_ORPHAN_TRANSIT && r.action === 'removed_orphan_transit_no_target'));
});

Deno.test('§8e exempts hotel/airport-targeted transit (bookend territory)', () => {
  const result = call([
    activity('Trinity College', { startTime: '10:00', endTime: '12:00' }),
    transit('Walk to Hotel', { startTime: '17:00', endTime: '17:15' }),
    transit('Taxi to the airport', { startTime: '18:00', endTime: '18:45' }),
  ]);
  const titles = result.day.activities.map((a: any) => a.title).join('|');
  assert(/Walk to Hotel/.test(titles), 'hotel-bound transit must be left untouched');
  assert(/airport/i.test(titles), 'airport-bound transit must be left untouched');
  assert(!result.repairs.some(r => r.code === FAILURE_CODES.FINAL_ORPHAN_TRANSIT));
});

Deno.test('§8e leaves transit alone when destination already matches a scheduled activity', () => {
  const result = call([
    transit('Walk to Trinity College Library'),
    activity('Trinity College Library', { startTime: '14:00', endTime: '15:30' }),
  ]);
  assert(!result.repairs.some(r => r.code === FAILURE_CODES.FINAL_ORPHAN_TRANSIT));
  assertEquals(result.day.activities.length, 2);
});

Deno.test('§8e exempts locked transit cards', () => {
  const result = call([
    transit('Taxi to The Shelbourne', { isLocked: true, locked: true }),
    activity("Lunch at Hugo's", { startTime: '13:45', endTime: '15:00' }),
  ]);
  const t = result.day.activities.find((a: any) => /The Shelbourne/.test(a.title));
  assert(t, 'locked orphan transit must remain untouched');
  assert(!result.repairs.some(r => r.code === FAILURE_CODES.FINAL_ORPHAN_TRANSIT));
});

Deno.test('§8e removes orphan when next activity is far beyond 90 min', () => {
  const result = call([
    transit('Walk to Cafe Chris', { startTime: '10:00', endTime: '10:15' }),
    activity('Dinner at The Winding Stair', { category: 'dining', startTime: '19:30', endTime: '21:00' }),
  ]);
  assert(!result.day.activities.some((a: any) => /Cafe Chris/i.test(a.title)));
  assert(result.repairs.some(r => r.code === FAILURE_CODES.FINAL_ORPHAN_TRANSIT && r.action === 'removed_orphan_transit_no_target'));
});
