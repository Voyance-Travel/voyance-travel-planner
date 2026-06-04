import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { loadTravelerProfile } from './profile-loader.ts';

/**
 * Mock supabase client for profile-loader tests.
 * Routes select() calls per table to predefined fixtures.
 */
function makeMockSupabase(fixtures: Record<string, unknown>) {
  return {
    from(table: string) {
      const data = (fixtures as Record<string, unknown>)[table] ?? null;
      const builder: any = {
        _data: data,
        select() { return builder; },
        eq() { return builder; },
        maybeSingle: () => Promise.resolve({ data: builder._data, error: null }),
      };
      return builder;
    },
  };
}

Deno.test('profile-loader merges Fine-Tune trait overrides on top of base trait scores', async () => {
  const supabase = makeMockSupabase({
    travel_dna_profiles: {
      trait_scores: { adventure: 0, authenticity: 0, planning: 5 },
      primary_archetype_name: 'curator',
    },
    profiles: {
      travel_dna_overrides: { adventure: 9, planning: -7, bogus: 'nope' },
    },
    trips: { budget_tier: 'moderate', trip_type: null, metadata: null },
    user_preferences: null,
  });

  const profile = await loadTravelerProfile(supabase as any, 'user-1', 'trip-1', 'Paris');

  assertEquals(profile.traitScores.adventure, 9, 'adventure override should win');
  assertEquals(profile.traitScores.planning, -7, 'planning override should win (negative)');
  assertEquals(profile.traitScores.authenticity, 0, 'untouched traits stay at base');
  assert(
    profile.warnings.some(w => w.startsWith('Trait overrides applied:')),
    'warnings should record which traits were overridden',
  );
});

Deno.test('profile-loader clamps out-of-range overrides to [-10, 10]', async () => {
  const supabase = makeMockSupabase({
    travel_dna_profiles: { trait_scores: { adventure: 1 } },
    profiles: { travel_dna_overrides: { adventure: 99, social: -50 } },
    trips: null,
    user_preferences: null,
  });

  const profile = await loadTravelerProfile(supabase as any, 'user-2', 'trip-2');
  assertEquals(profile.traitScores.adventure, 10);
  assertEquals(profile.traitScores.social, -10);
});

Deno.test('profile-loader leaves trait scores untouched when no overrides exist', async () => {
  const supabase = makeMockSupabase({
    travel_dna_profiles: { trait_scores: { adventure: 3, planning: 2 } },
    profiles: { travel_dna_overrides: null },
    trips: null,
    user_preferences: null,
  });

  const profile = await loadTravelerProfile(supabase as any, 'user-3', 'trip-3');
  assertEquals(profile.traitScores.adventure, 3);
  assertEquals(profile.traitScores.planning, 2);
  assert(!profile.warnings.some(w => w.startsWith('Trait overrides applied')));
});
