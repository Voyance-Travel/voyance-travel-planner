import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { enforceFreshenUpPosition } from "../freshen-up-position.ts";

Deno.test("Lisbon-pattern: freshen-up after dinner is dropped", () => {
  const acts = [
    { id: 'a1', title: 'Walk', category: 'transport', startTime: '12:00', endTime: '12:15' },
    { id: 'a2', title: 'Lunch at Ponto Final', category: 'dining', startTime: '12:30', endTime: '13:30' },
    { id: 'a3', title: 'Taxi to Four Seasons', category: 'transport', startTime: '16:48', endTime: '17:03', location: { name: 'Four Seasons Hotel Ritz Lisbon' } },
    { id: 'a4', title: 'Dinner: Belcanto', category: 'dining', startTime: '19:00', endTime: '20:15' },
    { id: 'a5', title: 'Freshen Up at Four Seasons Hotel Ritz Lisbon', category: 'accommodation', startTime: '20:03', endTime: '20:33' },
    { id: 'a6', title: 'Travel to wine bar', category: 'transport', startTime: '20:33', endTime: '20:47' },
  ];
  const res = enforceFreshenUpPosition(acts, { dayNumber: 2 });
  assertEquals(res.droppedIds, ['a5']);
  assertEquals(res.activities.find(a => a.id === 'a5'), undefined);
  assertEquals(res.repairs[0].type, 'dropped_post_dinner');
});

Deno.test("Bruges-pattern: freshen-up overlapping dinner is clamped", () => {
  const acts = [
    { id: 'b1', title: 'Lunch: Pomperlut', category: 'dining', startTime: '12:30', endTime: '13:30' },
    { id: 'b2', title: 'Travel to The Notary', category: 'transport', startTime: '17:00', endTime: '17:10' },
    { id: 'b3', title: 'Freshen Up at The Notary', category: 'accommodation', startTime: '17:10', endTime: '19:10' },
    { id: 'b4', title: 'Dinner: Refter', category: 'dining', startTime: '19:00', endTime: '20:15' },
  ];
  const res = enforceFreshenUpPosition(acts, { dayNumber: 2, hotelToDinnerMin: 15 });
  const b3 = res.activities.find(a => a.id === 'b3')!;
  assertEquals(b3.endTime, '18:45');
  assertEquals(res.repairs[0].type, 'clamped_into_dinner');
});

Deno.test("Happy path: freshen-up before dinner is untouched", () => {
  const acts = [
    { id: 'h1', title: 'Activity', category: 'activity', startTime: '15:00', endTime: '17:30' },
    { id: 'h2', title: 'Freshen Up at Hotel', category: 'accommodation', startTime: '18:15', endTime: '18:45' },
    { id: 'h3', title: 'Dinner: Local', category: 'dining', startTime: '19:00', endTime: '20:15' },
  ];
  const res = enforceFreshenUpPosition(acts, { dayNumber: 1 });
  assertEquals(res.repairs.length, 0);
  assertEquals(res.activities.length, 3);
});

Deno.test("Locked freshen-up after dinner is preserved", () => {
  const acts = [
    { id: 'l1', title: 'Dinner: Local', category: 'dining', startTime: '19:00', endTime: '20:15' },
    { id: 'l2', title: 'Freshen Up at Hotel', category: 'accommodation', startTime: '20:30', endTime: '21:00', isLocked: true },
  ];
  const res = enforceFreshenUpPosition(acts, { dayNumber: 1 });
  assertEquals(res.repairs.length, 0);
  assertEquals(res.activities.length, 2);
});

Deno.test("No dinner card → no-op", () => {
  const acts = [
    { id: 'n1', title: 'Freshen Up at Hotel', category: 'accommodation', startTime: '17:00', endTime: '17:30' },
    { id: 'n2', title: 'Wine Tasting', category: 'activity', startTime: '20:00', endTime: '21:30' },
  ];
  const res = enforceFreshenUpPosition(acts, { dayNumber: 2 });
  assertEquals(res.repairs.length, 0);
  assertEquals(res.activities.length, 2);
});

Deno.test("Squeeze-impossible freshen-up is dropped", () => {
  const acts = [
    { id: 's1', title: 'Activity', category: 'activity', startTime: '17:00', endTime: '18:55' },
    { id: 's2', title: 'Freshen Up at Hotel', category: 'accommodation', startTime: '18:55', endTime: '19:30' },
    { id: 's3', title: 'Dinner', category: 'dining', startTime: '19:00', endTime: '20:30' },
  ];
  // dinnerStart 19:00 - 15 = 18:45; freshen starts 18:55 > 18:45 → remaining < 15
  const res = enforceFreshenUpPosition(acts, { dayNumber: 1 });
  assertEquals(res.droppedIds, ['s2']);
  assertEquals(res.repairs[0].type, 'dropped_overlap_squeezed');
});
