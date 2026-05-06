/**
 * Slug helpers for archetype permalinks.
 * Slugs are kebab-case versions of narrative ids in ARCHETYPE_NARRATIVES.
 * Example: 'luxury_luminary' <-> 'luxury-luminary'.
 */
import { ARCHETYPE_NARRATIVES } from '@/data/archetypeNarratives';

export function archetypeIdToSlug(id: string): string {
  return id.toLowerCase().replace(/_/g, '-');
}

export function slugToArchetypeId(slug: string | undefined | null): string | null {
  if (!slug) return null;
  const normalized = slug.toLowerCase().replace(/-/g, '_');
  return ARCHETYPE_NARRATIVES[normalized] ? normalized : null;
}
