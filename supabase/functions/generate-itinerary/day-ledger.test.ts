import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildDayLedger, renderDayLedgerPrompt } from './day-ledger.ts';
import { ledgerCheck } from './ledger-check.ts';

Deno.test('buildDayLedger captures user intent and computes free slots', () => {
  const ledger = buildDayLedger({
    dayNumber: 2,
    date: '2026-04-18', // Saturday
    city: 'Lisbon',
    country: 'Portugal',
    hardFacts: { isFirstDay: false, isLastDay: false, isHotelChange: false, hotel: { name: 'Memmo Príncipe Real' } },
    anchors: [
      { title: 'Belcanto', startTime: '13:30', source: 'manual_paste', category: 'lunch' },
      { title: 'Serenity Spa Lisbon', startTime: '15:30', source: 'manual_paste', category: 'spa' },
      { title: 'Peixola', startTime: '19:30', source: 'manual_paste', category: 'dinner' },
    ],
    priorDayActivities: [{ title: 'JNcQUOI Table', dayNumber: 1 }],
  });

  assertEquals(ledger.dayOfWeek, 'Saturday');
  assertEquals(ledger.userIntent.length, 3);
  assertEquals(ledger.userIntent[0].kind, 'lunch');
  assertEquals(ledger.userIntent[2].kind, 'dinner');
  assertEquals(ledger.alreadyDone[0].title, 'JNcQUOI Table');
  // Free slots should exist before lunch and after dinner
  assert(ledger.freeSlots.length >= 1);
  assert(ledger.freeSlots.some((s) => s.from === '08:00'));
});

Deno.test('renderDayLedgerPrompt emits fenced sections', () => {
  const ledger = buildDayLedger({
    dayNumber: 1,
    date: '2026-04-17',
    city: 'Lisbon',
    country: 'Portugal',
    hardFacts: { isFirstDay: true, isLastDay: false, isHotelChange: false, hotel: { name: 'Memmo' } },
    anchors: [{ title: 'JNcQUOI Table', startTime: '19:00', source: 'manual_paste' }],
  });
  const out = renderDayLedgerPrompt(ledger);
  assert(out.includes('DAY TRUTH LEDGER'));
  assert(out.includes('USER LOCKED'));
  assert(out.includes('JNcQUOI Table'));
  assert(out.includes('First day in city'));
});

Deno.test('ledgerCheck removes repeats of alreadyDone and warns on missing intent', () => {
  const ledgers = [
    buildDayLedger({
      dayNumber: 2,
      date: '2026-04-18',
      city: 'Lisbon',
      country: 'Portugal',
      hardFacts: { isFirstDay: false, isLastDay: false, isHotelChange: false },
      anchors: [{ title: 'Peixola', startTime: '19:30', source: 'manual_paste' }],
      priorDayActivities: [{ title: 'JNcQUOI Table', dayNumber: 1 }],
    }),
  ];
  const days = [
    {
      dayNumber: 2,
      activities: [
        { title: 'JNcQUOI Table', startTime: '19:00' }, // repeat — should be removed
        { title: 'Some other lunch', startTime: '13:00' },
        // Peixola missing — should warn
      ],
    },
  ];
  const res = ledgerCheck(days, ledgers);
  assertEquals(res.removed, 1);
  assert(res.warnings.some((w) => w.kind === 'repeat_already_done'));
  assert(res.warnings.some((w) => w.kind === 'missing_user_intent'));
});

Deno.test('ledgerCheck respects locked activities (does not remove them)', () => {
  const ledgers = [
    buildDayLedger({
      dayNumber: 2,
      date: '2026-04-18',
      city: 'Lisbon',
      country: 'Portugal',
      hardFacts: { isFirstDay: false, isLastDay: false, isHotelChange: false },
      anchors: [],
      priorDayActivities: [{ title: 'JNcQUOI Table', dayNumber: 1 }],
    }),
  ];
  const days = [
    { dayNumber: 2, activities: [{ title: 'JNcQUOI Table', locked: true, lockedSource: 'manual_paste' }] },
  ];
  const res = ledgerCheck(days, ledgers);
  assertEquals(res.removed, 0);
});

Deno.test('Lisbon dinner regression: all 13 user intents survive a check', () => {
  // Simulates the user's Lisbon paste — every dinner/lunch should remain locked.
  const lisbonAnchors: Array<{ day: number; title: string; time: string; kind: string }> = [
    { day: 1, title: 'JNcQUOI Table', time: '19:00', kind: 'dinner' },
    { day: 2, title: 'Belcanto', time: '13:30', kind: 'lunch' },
    { day: 2, title: 'Serenity Spa Lisbon', time: '15:30', kind: 'spa' },
    { day: 2, title: 'Peixola', time: '19:30', kind: 'dinner' },
    { day: 3, title: 'JNcQUOI Asia', time: '20:15', kind: 'dinner' },
    { day: 4, title: 'SEEN Sky Bar', time: '18:30', kind: 'drinks' },
    { day: 4, title: 'SEEN Lisboa', time: '19:00', kind: 'dinner' },
    { day: 5, title: 'Prado', time: '20:00', kind: 'dinner' },
    { day: 6, title: 'Oficina do Duque', time: '13:30', kind: 'lunch' },
    { day: 6, title: 'Farewell Dinner', time: '19:30', kind: 'dinner' },
    { day: 7, title: 'Cervejaria Ramiro', time: '13:00', kind: 'lunch' },
    { day: 7, title: 'Rocco', time: '20:15', kind: 'dinner' },
    { day: 9, title: 'JNcQUOI Avenida', time: '19:00', kind: 'dinner' },
  ];

  const ledgers = lisbonAnchors.map((a) =>
    buildDayLedger({
      dayNumber: a.day,
      date: '2026-04-17', // dummy — date math not under test here
      city: 'Lisbon',
      country: 'Portugal',
      hardFacts: { isFirstDay: a.day === 1, isLastDay: false, isHotelChange: false },
      anchors: [{ title: a.title, startTime: a.time, source: 'manual_paste', category: a.kind }],
    })
  );

  const days = lisbonAnchors.map((a) => ({
    dayNumber: a.day,
    activities: [{ title: a.title, startTime: a.time, locked: true, lockedSource: 'manual_paste' }],
  }));

  const res = ledgerCheck(days, ledgers);
  // None of the locked items should generate "missing user intent" warnings.
  assertEquals(res.warnings.filter((w) => w.kind === 'missing_user_intent').length, 0);
  // Every user-locked title should still be present in the resulting days.
  for (const a of lisbonAnchors) {
    const day = res.days.find((d) => d.dayNumber === a.day);
    assert(day, `day ${a.day} should still exist`);
    assert(
      (day!.activities as any[]).some((x) => (x.title || x.name || '').toLowerCase().includes(a.title.toLowerCase().split(' ')[0])),
      `"${a.title}" should still be on day ${a.day}`,
    );
  }
});
