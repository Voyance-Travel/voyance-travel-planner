import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  getDestinationSkipList,
  matchesDestinationSkipList,
  renderSkipListPromptBlock,
} from '../destination-skip-list.ts';

Deno.test('hardcoded seeds resolved for Tokyo', async () => {
  const list = await getDestinationSkipList('Tokyo, Japan');
  assert(list.length > 0);
  assert(list.some(e => e.keyword === 'robot restaurant'));
});

Deno.test('matchesDestinationSkipList flags Robot Restaurant', async () => {
  const list = await getDestinationSkipList('Tokyo');
  const hit = matchesDestinationSkipList('Robot Restaurant Show', 'Famous Shinjuku robot performance', list);
  assert(hit);
  assertEquals(hit?.keyword, 'robot restaurant');
});

Deno.test('matchesDestinationSkipList ignores short keywords', () => {
  const hit = matchesDestinationSkipList('OK', '', [{ keyword: 'ok', source: 'hardcoded' }]);
  assertEquals(hit, null);
});

Deno.test('renderSkipListPromptBlock produces FORBIDDEN block', async () => {
  const list = await getDestinationSkipList('Paris');
  const block = renderSkipListPromptBlock(list);
  assert(block.includes('DESTINATION SKIP LIST'));
  assert(block.includes('FORBIDDEN'));
  assert(block.includes('seine cruise'));
});

Deno.test('empty list returns empty prompt block', () => {
  assertEquals(renderSkipListPromptBlock([]), '');
});

Deno.test('unknown destination yields empty list (no supabase)', async () => {
  const list = await getDestinationSkipList('Atlantis');
  assertEquals(list.length, 0);
});
