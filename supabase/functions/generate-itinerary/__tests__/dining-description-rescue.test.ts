// Dining description rescue: when sanitizeAITextField over-strips a restaurant
// description into <15 chars, the day-walker injects a meal+venue template so
// the card never renders blank.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { sanitizeNarrativeFields } from '../sanitization.ts';

function mkDay(activities: any[]) {
  return { title: 'Day 1', theme: '', activities };
}

Deno.test('dining card: over-stripped description gets template fallback', () => {
  const day = mkDay([
    {
      title: 'Dinner at Da Ivo',
      category: 'dining',
      venue_name: 'Da Ivo',
      description: 'A local favorite. Popular with locals. Hidden gem with great food.',
    },
  ]);
  sanitizeNarrativeFields(day, 'Venice');
  const desc = String(day.activities[0].description || '');
  assert(desc.length >= 30, `expected template fallback (>=30 chars), got: "${desc}"`);
  assert(/Dinner at Da Ivo/i.test(desc), `expected venue+meal in template, got: "${desc}"`);
});

Deno.test('dining card: real prose description preserved (no template)', () => {
  const original = 'Wood-fired Roman pizza in Trastevere with thin crust, blistered edges, and seasonal toppings sourced from nearby markets.';
  const day = mkDay([
    {
      title: 'Lunch at Pizzeria ai Marmi',
      category: 'dining',
      venue_name: 'Pizzeria ai Marmi',
      description: original,
    },
  ]);
  sanitizeNarrativeFields(day, 'Rome');
  const desc = String(day.activities[0].description || '');
  assert(/Wood-fired Roman pizza/i.test(desc), `expected prose preserved, got: "${desc}"`);
  assert(!/Check opening hours before heading over/i.test(desc), 'template should not have fired');
});

Deno.test('non-dining card: over-stripped description stays undefined (no template)', () => {
  const day = mkDay([
    {
      title: 'Visit the Uffizi',
      category: 'museum',
      description: 'A local favorite. Popular with locals. Hidden gem.',
    },
  ]);
  sanitizeNarrativeFields(day, 'Florence');
  // template only fires for dining; non-dining gets undefined
  assertEquals(day.activities[0].description, undefined);
});
