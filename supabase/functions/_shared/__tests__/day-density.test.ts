import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { trimRelaxedDay } from '../day-density.ts';

Deno.test('trims the live 7-stop relaxed day to ~5, dropping the nightcap + latest activity', () => {
  const day = [
    { category: 'dining', title: 'Southern Breakfast at Ria’s Bluebird', startTime: '08:30' },
    { category: 'cultural', title: 'MLK Jr. National Historical Park', startTime: '10:15' },
    { category: 'dining', title: 'Lunch at Sweet Auburn Market', startTime: '12:45' },
    { category: 'cultural', title: 'BeltLine Art Walk', startTime: '14:25' },
    { category: 'activity', title: 'Krog Street Tunnel', startTime: '17:15' },
    { category: 'dining', title: 'Dinner at Murphy’s', startTime: '18:25' },
    { category: 'dining', title: 'Nightcap at Blind Willie’s', startTime: '20:40' },
  ];
  const r = trimRelaxedDay(day, { maxActivities: 2 });
  assertEquals(r.activities.length, 5);
  const titles = r.activities.map((a) => a.title);
  assert(titles.includes('Dinner at Murphy’s'), 'dinner kept');
  assert(!titles.some((t) => /nightcap/i.test(t)), 'nightcap dropped');
  assert(!titles.some((t) => /krog/i.test(t)), 'latest activity dropped');
  assert(titles.includes('MLK Jr. National Historical Park') && titles.includes('BeltLine Art Walk'), 'earliest 2 activities kept');
});

Deno.test('keeps transit + protected (host-city event, must-do, locked)', () => {
  const day = [
    { category: 'dining', title: 'Breakfast', startTime: '08:00' },
    { category: 'activity', title: 'FIFA Fan Festival', source: 'host-city-event', startTime: '15:00' },
    { category: 'activity', title: 'Locked thing', locked: true, startTime: '16:00' },
    { category: 'activity', title: 'Extra A', startTime: '11:00' },
    { category: 'activity', title: 'Extra B', startTime: '13:00' },
    { category: 'activity', title: 'Extra C', startTime: '17:00' },
    { category: 'transport', title: 'Taxi', startTime: '14:00' },
  ];
  const r = trimRelaxedDay(day, { maxActivities: 2 });
  const titles = r.activities.map((a) => a.title);
  assert(titles.includes('FIFA Fan Festival') && titles.includes('Locked thing') && titles.includes('Taxi'));
  assert(!titles.includes('Extra C'), 'a 3rd extra activity is dropped');
});

Deno.test('a day already within budget is untouched', () => {
  const day = [
    { category: 'dining', title: 'Breakfast', startTime: '08:00' },
    { category: 'activity', title: 'A', startTime: '11:00' },
    { category: 'dining', title: 'Dinner', startTime: '19:00' },
  ];
  assertEquals(trimRelaxedDay(day, { maxActivities: 2 }).dropped.length, 0);
});

Deno.test('relaxed World Cup day keeps both event stops + 3 meals = 5 (drops generic)', () => {
  const day = [
    { category: 'dining', title: 'Breakfast', startTime: '08:30' },
    { category: 'activity', title: 'Generic Sight A', startTime: '10:00' },
    { category: 'dining', title: 'Lunch', startTime: '12:30' },
    { category: 'activity', title: 'FIFA Fan Festival', source: 'host-city-event', startTime: '15:30' },
    { category: 'activity', title: 'Generic Sight B', startTime: '16:30' },
    { category: 'activity', title: 'Watch the match at Brewhouse', source: 'host-city-event', startTime: '18:30' },
    { category: 'dining', title: 'Dinner', startTime: '20:00' },
  ];
  const r = trimRelaxedDay(day, { maxActivities: 2 });
  const titles = r.activities.map((a) => a.title);
  assertEquals(r.activities.length, 5);
  assert(titles.includes('FIFA Fan Festival') && titles.includes('Watch the match at Brewhouse'), 'both event stops kept');
  assert(!titles.includes('Generic Sight A') && !titles.includes('Generic Sight B'), 'generic sights dropped to fit the cap');
  assertEquals(titles.filter((t) => /Breakfast|Lunch|Dinner/.test(t)).length, 3, '3 meals kept');
});
