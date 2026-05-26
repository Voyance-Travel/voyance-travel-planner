import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertMustDoCoverage } from "../assert-must-do-coverage.ts";

const days = (acts: any[][]) => acts.map((activities, i) => ({ dayNumber: i + 1, activities }));

Deno.test("BA: transport 'Travel to Teatro Colón' does NOT satisfy Teatro Colón", () => {
  const r = assertMustDoCoverage(
    days([[
      { id: 't1', title: 'Travel to Teatro Colón', category: 'transport', startTime: '13:50', endTime: '14:03' },
    ]]),
    ['Teatro Colón']
  );
  assertEquals(r.scheduled, []);
  assertEquals(r.missing, ['Teatro Colón']);
});

Deno.test("BA: actual 'Guided Tour of Teatro Colón' satisfies coverage", () => {
  const r = assertMustDoCoverage(
    days([[
      { id: 't1', title: 'Travel to Teatro Colón', category: 'transport', startTime: '13:50', endTime: '14:03' },
      { id: 'v1', title: 'Guided Tour of Teatro Colón', category: 'cultural', startTime: '16:15', endTime: '17:15' },
    ]]),
    ['Teatro Colón']
  );
  assertEquals(r.scheduled, ['Teatro Colón']);
  assertEquals(r.matchedActivityIds?.['Teatro Colón'], 'v1');
});

Deno.test("BA: 'Recoleta Neighborhood Walk' does NOT satisfy Recoleta Cemetery", () => {
  const r = assertMustDoCoverage(
    days([[
      { id: 'w1', title: 'Free roam - follow your nose in Recoleta', venue_name: 'Recoleta Neighborhood Walk', category: 'activity', startTime: '10:00', endTime: '11:30' },
    ]]),
    ['Recoleta Cemetery']
  );
  assertEquals(r.scheduled, []);
  assertEquals(r.missing, ['Recoleta Cemetery']);
});

Deno.test("BA: injected card overlapping breakfast is demoted to missing", () => {
  const r = assertMustDoCoverage(
    days([
      [],
      [
        { id: 'a', title: 'Urban Art Bike Exploration', category: 'activity', startTime: '07:10', endTime: '09:25' },
        { id: 'must-do-d2-2-x', title: 'San Telmo Market', venue_name: 'San Telmo Market', category: 'sightseeing', startTime: '10:30', endTime: '12:00' },
        { id: 'b', title: 'Breakfast: Café Tortoni', category: 'dining', startTime: '10:35', endTime: '11:20' },
      ],
    ]),
    ['San Telmo Market']
  );
  // Overlaps breakfast 10:35-11:20 → not viable, no other match → missing.
  assertEquals(r.missing, ['San Telmo Market']);
});

Deno.test("BA: non-overlapping injected card counts as scheduled", () => {
  const r = assertMustDoCoverage(
    days([
      [],
      [
        { id: 'must-do-d2-0-x', title: 'Recoleta Cemetery', venue_name: 'Recoleta Cemetery', category: 'sightseeing', startTime: '14:00', endTime: '15:30' },
      ],
    ]),
    ['Recoleta Cemetery']
  );
  assertEquals(r.missing, []);
  assertEquals(r.matchedActivityIds?.['Recoleta Cemetery'], 'must-do-d2-0-x');
});

Deno.test("BA: full reproduction — 4 selected, partial coverage honestly reported", () => {
  const r = assertMustDoCoverage(
    days([
      // Day 1: transport mentions Teatro Colón, real visit at 16:15
      [
        { id: 't1', title: 'Travel to Teatro Colón', category: 'transport', startTime: '13:50', endTime: '14:03' },
        { id: 'v1', title: 'Guided Tour of Teatro Colón', category: 'cultural', startTime: '16:15', endTime: '17:15' },
        { id: 'w1', title: 'Free roam in Recoleta', venue_name: 'Recoleta Neighborhood Walk', category: 'activity', startTime: '17:33', endTime: '19:33' },
      ],
      // Day 2: injected Recoleta Cemetery overlaps urban bike, San Telmo overlaps breakfast
      [
        { id: 'a', title: 'Urban Art Bike Exploration', category: 'activity', startTime: '07:10', endTime: '09:25' },
        { id: 'must-do-d2-0', title: 'Recoleta Cemetery', venue_name: 'Recoleta Cemetery', category: 'sightseeing', startTime: '09:00', endTime: '10:30' },
        { id: 'must-do-d2-2', title: 'San Telmo Market', venue_name: 'San Telmo Market', category: 'sightseeing', startTime: '10:30', endTime: '12:00' },
        { id: 'b', title: 'Breakfast: Café Tortoni', category: 'dining', startTime: '10:35', endTime: '11:20' },
      ],
      // Day 3: real Caminito card
      [
        { id: 'must-do-d3-1', title: 'Caminito', venue_name: 'Caminito', category: 'sightseeing', startTime: '09:00', endTime: '10:30' },
      ],
    ]),
    ['Teatro Colón', 'Recoleta Cemetery', 'Caminito', 'San Telmo Market']
  );
  assertEquals(r.scheduled.sort(), ['Caminito', 'Teatro Colón'].sort());
  assertEquals(r.missing.sort(), ['Recoleta Cemetery', 'San Telmo Market'].sort());
});
