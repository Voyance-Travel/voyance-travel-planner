import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  canonicalActivityVenueName,
  crossDayVenueDuplicate,
} from './generation-utils.ts';
import { ledgerCheck } from './ledger-check.ts';
import type { DayLedger } from './day-ledger.ts';

Deno.test('canonicalActivityVenueName collapses Louvre activity variants', () => {
  const a = canonicalActivityVenueName('Louvre Museum Exploration');
  const b = canonicalActivityVenueName('Louvre Museum Priority Visit');
  const c = canonicalActivityVenueName('Skip-the-Line Louvre Tour');
  // All three should reduce to a Louvre-bearing canonical form
  assert(a.includes('louvre'), `expected louvre token in "${a}"`);
  assert(b.includes('louvre'), `expected louvre token in "${b}"`);
  assert(c.includes('louvre'), `expected louvre token in "${c}"`);
  // Activity-prefix removal
  assertEquals(canonicalActivityVenueName('Morning at Louvre Museum'), 'louvre museum');
});

Deno.test('crossDayVenueDuplicate flags qualifier variants of the same venue', () => {
  const r = crossDayVenueDuplicate(
    ['Louvre Museum Priority Visit'],
    ['Louvre Museum Exploration'],
  );
  assertEquals(r.isDuplicate, true);
});

Deno.test('crossDayVenueDuplicate flags bilingual aliases (Musée du Louvre ↔ Louvre)', () => {
  const r = crossDayVenueDuplicate(
    ['Skip-the-Line Louvre Tour'],
    ['Musée du Louvre'],
  );
  assertEquals(r.isDuplicate, true);
});

Deno.test('crossDayVenueDuplicate does NOT flag distinct museums', () => {
  const r = crossDayVenueDuplicate(
    ["Musée d'Orsay Visit"],
    ['Louvre Museum Exploration'],
  );
  assertEquals(r.isDuplicate, false);
});

Deno.test('crossDayVenueDuplicate does NOT flag a restaurant near a duplicated landmark', () => {
  // Café Marly is physically inside the Louvre but is a distinct venue.
  // The canonicalizer compares names, not coordinates; a restaurant title
  // should not collapse to "louvre".
  const r = crossDayVenueDuplicate(
    ['Café Marly'],
    ['Louvre Museum Exploration'],
  );
  assertEquals(r.isDuplicate, false);
});

Deno.test('ledger-check repeat_already_done catches Louvre qualifier variant via canonicalizer', () => {
  const ledger: DayLedger = {
    dayNumber: 2,
    date: '2025-06-02',
    dayOfWeek: 'Monday',
    city: 'Paris',
    country: 'France',
    hardFacts: { isFirstDay: false, isLastDay: false, isHotelChange: false, hotel: null },
    userIntent: [],
    alreadyDone: [{ title: 'Louvre Museum Exploration', dayNumber: 1 }],
    closures: [],
    freeSlots: [],
  };
  const days = [
    {
      dayNumber: 2,
      activities: [
        { title: 'Louvre Museum Priority Visit', category: 'sightseeing' },
        { title: 'Seine River Cruise', category: 'sightseeing' },
      ],
    },
  ];
  const result = await ledgerCheck(days, [ledger]);
  assertEquals(result.removed, 1);
  const warning = result.warnings.find((w) => w.kind === 'repeat_already_done');
  assert(warning, 'expected repeat_already_done warning');
  assertEquals(result.days[0].activities.length, 1);
  assertEquals(result.days[0].activities[0].title, 'Seine River Cruise');
});
