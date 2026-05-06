import { describe, it, expect } from 'vitest';
import { ARCHETYPE_NARRATIVES } from '@/data/archetypeNarratives';
import { archetypeIdToSlug, slugToArchetypeId } from '@/utils/archetypeSlug';

describe('archetypeSlug', () => {
  it('round-trips every narrative id', () => {
    for (const id of Object.keys(ARCHETYPE_NARRATIVES)) {
      const slug = archetypeIdToSlug(id);
      expect(slug).not.toContain('_');
      expect(slugToArchetypeId(slug)).toBe(id);
    }
  });

  it('returns null for unknown slugs', () => {
    expect(slugToArchetypeId('not-a-real-archetype')).toBeNull();
    expect(slugToArchetypeId('')).toBeNull();
    expect(slugToArchetypeId(undefined)).toBeNull();
  });

  it('is case-insensitive', () => {
    const anyId = Object.keys(ARCHETYPE_NARRATIVES)[0];
    const slug = archetypeIdToSlug(anyId).toUpperCase();
    expect(slugToArchetypeId(slug)).toBe(anyId);
  });
});
