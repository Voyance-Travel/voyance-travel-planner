import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { classifyIntent } from './resolve-user-intent-venues.ts';

Deno.test('classifyIntent: "sushi lunch" → category', () => {
  const r = classifyIntent('sushi lunch');
  assertEquals(r.kind, 'category');
  assertEquals(r.slot, 'lunch');
  assertEquals(r.cuisine, 'sushi');
});

Deno.test('classifyIntent: "rooftop cocktails on day 3" → category w/ day', () => {
  const r = classifyIntent('rooftop cocktails on day 3');
  assertEquals(r.kind, 'category');
  assertEquals(r.slot, 'drinks');
  assertEquals(r.preferredDay, 3);
});

Deno.test('classifyIntent: "Sukiyabashi Jiro" → named (skipped)', () => {
  const r = classifyIntent('Sukiyabashi Jiro');
  assertEquals(r.kind, 'named');
});

Deno.test('classifyIntent: "wine bar dinner" → category', () => {
  const r = classifyIntent('wine bar dinner');
  assertEquals(r.kind, 'category');
  assertEquals(r.cuisine, 'wine bar');
  assertEquals(r.slot, 'dinner');
});

Deno.test('classifyIntent: cuisine-only "ramen" → category w/ inferred dinner', () => {
  const r = classifyIntent('ramen');
  assertEquals(r.kind, 'category');
  assertEquals(r.cuisine, 'ramen');
  assertEquals(r.slot, 'dinner');
});
