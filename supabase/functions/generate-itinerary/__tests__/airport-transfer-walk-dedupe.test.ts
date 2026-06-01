/**
 * §3b — airport-transfer reconcile/inject must not leave a stray "Walk to
 * <hotel-short-name>" card with the LLM's bogus 2h+ duration alongside the
 * authoritative 35-min transfer.
 *
 * Root cause: matchesHotelDestination required a substring match against the
 * full lowercased hotelName. When the LLM emitted "Walk to Balmoral" against
 * a hotelName of "The Balmoral, a Rocco Forte hotel" the substring check
 * failed → INJECT path ran → both cards survived.
 *
 * Fix: token-level partial-match fallback + symmetric dedupe sweep in the
 * INJECT branch.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { repairDay } from '../pipeline/repair-day.ts';

function walk(title: string, extra: Record<string, unknown> = {}) {
  return {
    id: `walk-${title.replace(/\s+/g, '-')}`,
    title,
    category: 'transport',
    startTime: '15:55',
    endTime: '18:54',
    durationMinutes: 179, // 2h 59m
    transportation: { method: 'walk', duration: '179 min' },
    ...extra,
  };
}

function sightseeing(title: string, extra: Record<string, unknown> = {}) {
  return {
    id: `act-${title.replace(/\s+/g, '-')}`,
    title,
    category: 'sightseeing',
    startTime: '19:30',
    endTime: '20:30',
    location: { name: title },
    ...extra,
  };
}

function call(activities: any[], opts: { hotelName: string; airportTransferMinutes?: number }) {
  return repairDay({
    day: { dayNumber: 1, title: 'Day 1', activities } as any,
    validationResults: [],
    dayNumber: 1,
    isFirstDay: true,
    isLastDay: false,
    destination: 'Edinburgh, UK',
    arrivalTime24: '15:10',
    arrivalAirport: 'Edinburgh Airport (EDI)',
    airportTransferMinutes: opts.airportTransferMinutes ?? 35,
    hotelName: opts.hotelName,
    hasHotel: true,
  } as any);
}

Deno.test('partial hotel-name match: "Walk to Balmoral" is reconciled, not duplicated', () => {
  const out = call(
    [walk('Walk to Balmoral'), sightseeing('Royal Mile Stroll')],
    { hotelName: 'The Balmoral, a Rocco Forte hotel' },
  ).day.activities;

  const transferCards = out.filter((a: any) =>
    /^(walk|taxi|transfer|travel)\s+to\b/i.test(String(a.title || '')),
  );
  assertEquals(transferCards.length, 1, `expected exactly 1 transfer card, got ${transferCards.length}: ${transferCards.map((c: any) => c.title).join(' | ')}`);
  const card = transferCards[0];
  assertEquals(card.durationMinutes, 35);
  assertEquals(card.anchorSource, 'airport-transfer');
  assert(!/walk\b/i.test(String(card.title)), `transfer card should not be a "Walk to…": "${card.title}"`);
});

Deno.test('non-hotel POI walk ("Walk to Old Town") is NOT consumed by airport-transfer inject', () => {
  // Pair the POI walk with a real destination activity so other repair passes
  // (orphan-transit) don't strip the walk for unrelated reasons.
  const out = call(
    [
      walk('Walk to Old Town', { startTime: '17:00', endTime: '17:15', durationMinutes: 15 }),
      sightseeing('Royal Mile Stroll', { startTime: '17:15', endTime: '18:30' }),
    ],
    { hotelName: 'The Balmoral' },
  ).day.activities;

  // POI walk must not be relabeled as the authoritative airport transfer.
  const poiCandidate = out.find((a: any) => /old town/i.test(String(a.title || '')));
  if (poiCandidate) {
    assert(
      poiCandidate.anchorSource !== 'airport-transfer',
      `POI walk should not be tagged as airport-transfer: ${JSON.stringify(poiCandidate)}`,
    );
  }

  // Exactly one authoritative airport-transfer anchor injected.
  const anchors = out.filter((a: any) => a.anchorSource === 'airport-transfer');
  assertEquals(anchors.length, 1);
  assert(/^Transfer to /i.test(String(anchors[0].title || '')));
});

Deno.test('explicit "Walk to Hotel" still reconciles via legacy generic-noun path', () => {
  const out = call(
    [walk('Walk to Hotel')],
    { hotelName: 'The Balmoral' },
  ).day.activities;
  const anchors = out.filter((a: any) => a.anchorSource === 'airport-transfer');
  assertEquals(anchors.length, 1);
  assertEquals(anchors[0].durationMinutes, 35);
});

