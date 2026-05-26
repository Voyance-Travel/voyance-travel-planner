/**
 * Regression tests for scheduleMustDos overlap-safety.
 *
 * Guarantees:
 *  1. A committed real activity (dining/cultural/museum/etc., even without
 *     an explicit `locked` flag) blocks the must-do from landing on top.
 *  2. The scheduler picks a non-overlapping slot rather than double-booking.
 *  3. Clock ceilings still respected (17:00 museum / 21:00 after-dark).
 *  4. When NO non-overlapping window exists on any day, slot is null
 *     (caller demotes to `MUST_DO_INJECTION_FAILED`, not silent overlap).
 *
 * See mem://constraints/itinerary/must-do-coverage-injection.
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { scheduleMustDos } from "../schedule-must-dos.ts";

Deno.test("overlap: avoids breakfast block (no explicit lock flag)", () => {
  // Breakfast 09:00-10:00 — no `locked:true`, just category=dining.
  // Must-do landmark default duration 90m; should land at 10:00, not 09:00.
  const slots = scheduleMustDos(
    ["Recoleta Cemetery"],
    {
      days: [{
        dayNumber: 1,
        activities: [
          { id: 'b', title: 'Breakfast: Café Tortoni', category: 'dining', startTime: '09:00', endTime: '10:00' },
        ],
      }],
    },
  );
  const s = slots[0]!;
  assertEquals(s.dayNumber, 1);
  // Earliest free slot AFTER breakfast — not 09:00.
  assert(s.startTime >= '10:00', `expected ≥10:00, got ${s.startTime}`);
});

Deno.test("overlap: avoids morning museum block — lands after", () => {
  // Museum 09:00-12:00 blocks the morning. Pantheon (90m) should land at 12:00.
  const slots = scheduleMustDos(
    ["Pantheon"],
    {
      days: [{
        dayNumber: 1,
        activities: [
          { id: 'm', title: 'Galleria Borghese', category: 'museum', startTime: '09:00', endTime: '12:00' },
        ],
      }],
    },
  );
  const s = slots[0]!;
  assertEquals(s.startTime, '12:00');
});

Deno.test("overlap: museum-class venue still respects 17:00 ceiling", () => {
  // Day fully booked 09:00-16:00. Vatican Museums needs 210m → wouldn't fit
  // before 17:00 ceiling → must spill to the next day, not run past 17:00.
  const slots = scheduleMustDos(
    ["Vatican Museums"],
    {
      days: [
        {
          dayNumber: 1,
          activities: [
            { id: 'a', title: 'Tour', category: 'cultural', startTime: '09:00', endTime: '16:00' },
          ],
        },
        { dayNumber: 2, activities: [] },
      ],
    },
  );
  const s = slots[0]!;
  assertEquals(s.dayNumber, 2);
  assert(s.endTime <= '17:00', `museum should end ≤17:00, got ${s.endTime}`);
});

Deno.test("overlap: after-dark-safe venue may use evening window past 17:00", () => {
  // Day fully booked 09:00-17:00; Trevi Fountain (after-dark-safe, 45m)
  // should still fit same day in the 17:00-21:00 evening window.
  const slots = scheduleMustDos(
    ["Trevi Fountain"],
    {
      days: [{
        dayNumber: 1,
        activities: [
          { id: 'a', title: 'Tour', category: 'cultural', startTime: '09:00', endTime: '17:00' },
        ],
      }],
    },
  );
  const s = slots[0]!;
  assertEquals(s.dayNumber, 1);
  assert(s.startTime >= '17:00', `expected ≥17:00, got ${s.startTime}`);
  assert(s.endTime <= '21:00', `after-dark ceiling 21:00, got ${s.endTime}`);
});

Deno.test("overlap: when no day has a non-overlapping window → null", () => {
  // Both days fully booked 09:00-21:00 with committed cultural blocks.
  // No room for a 90m landmark anywhere → slot is null.
  const slots = scheduleMustDos(
    ["Spanish Steps"],
    {
      days: [
        {
          dayNumber: 1,
          activities: [
            { id: 'a', title: 'Tour', category: 'cultural', startTime: '09:00', endTime: '21:00' },
          ],
        },
        {
          dayNumber: 2,
          activities: [
            { id: 'b', title: 'Tour', category: 'cultural', startTime: '09:00', endTime: '21:00' },
          ],
        },
      ],
    },
  );
  assertEquals(slots[0], null);
});

Deno.test("overlap: two must-dos on same day don't pick the same slot", () => {
  // Empty day — both must-dos eligible. Second must-do should NOT pick the
  // same 09:00 start (the scheduler reserves picked slots in-loop).
  const slots = scheduleMustDos(
    ["Recoleta Cemetery", "San Telmo Market"],
    {
      days: [{ dayNumber: 1, activities: [] }],
    },
  );
  const a = slots[0]!;
  const b = slots[1]!;
  // Both should fit on day 1, but with non-overlapping windows.
  assertEquals(a.dayNumber, 1);
  assertEquals(b.dayNumber, 1);
  assert(b.startTime >= a.endTime, `second slot ${b.startTime} should start ≥ first end ${a.endTime}`);
});
