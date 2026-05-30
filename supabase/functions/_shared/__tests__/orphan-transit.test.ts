import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { pruneOrphanTransits } from '../orphan-transit.ts';

Deno.test('end-of-day "Transfer to JFK Airport" survives (logistics target)', () => {
  const acts = [
    { id: '1', title: 'Lunch at Per Se', category: 'dining' },
    { id: '2', title: 'Transfer to JFK Airport', category: 'transport' },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 0);
  assertEquals(acts.length, 2);
});

Deno.test('end-of-day "Taxi to Stazione Santa Lucia" survives (logistics target)', () => {
  const acts = [
    { id: '1', title: 'Coffee at Quadri', category: 'dining' },
    { id: '2', title: 'Taxi to Stazione Santa Lucia', category: 'transport' },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 0);
});

Deno.test('end-of-day "Walk to Salsify" still dropped (no logistics keyword)', () => {
  const acts = [
    { id: '1', title: 'Tour Kirstenbosch', category: 'sightseeing' },
    { id: '2', title: 'Walk to Salsify at The Roundhouse', category: 'transport' },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 1);
  assertEquals(acts.length, 1);
});

Deno.test('end-of-day "Travel to <restaurant>" dropped (generic verb, no logistics keyword)', () => {
  const acts = [
    { id: '1', title: 'Tour Kirstenbosch', category: 'sightseeing' },
    { id: '2', title: 'Travel to Salsify at The Roundhouse', category: 'transport' },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 1);
  assertEquals(acts.length, 1);
});

Deno.test('orphan target in middle still dropped (Case 2 unchanged)', () => {
  const acts = [
    { id: '1', title: 'Walk to Salsify', category: 'transport' },
    { id: '2', title: 'Lunch at Test Kitchen', category: 'dining' },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 1);
});

Deno.test('end-of-day transit with transportation.kind=departure survives even without keyword', () => {
  const acts = [
    { id: '1', title: 'Last lunch', category: 'dining' },
    { id: '2', title: 'Private car to flight', category: 'transport', transportation: { kind: 'departure' } },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 0);
  assertEquals(acts.length, 2);
});

Deno.test('diacritic match: "Walk to Cafe Chris" survives when day has scheduled "Café Chris"', () => {
  const acts = [
    { id: '1', title: 'Walk to Cafe Chris', category: 'transport' },
    { id: '2', title: 'Drinks at Café Chris', category: 'dining' },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 0);
  assertEquals(acts.length, 2);
});

Deno.test('majority match: "Walk to Anne Frank House" survives when day has "Anne Frank Museum"', () => {
  const acts = [
    { id: '1', title: 'Walk to Anne Frank House', category: 'transport' },
    { id: '2', title: 'Visit Anne Frank Museum', category: 'sightseeing' },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 0);
  assertEquals(acts.length, 2);
});

Deno.test('negative: majority match does not over-trigger on unrelated venues', () => {
  const acts = [
    { id: '1', title: 'Walk to Bo Innovation', category: 'transport' },
    { id: '2', title: 'Lunch at Quay', category: 'dining' },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 1);
  assertEquals(acts.length, 1);
});

