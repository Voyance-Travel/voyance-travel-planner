## RS.L10 — Canonical entity_id normalization

### File: `src/services/behaviorTrackingService.ts`

Three free-text→entity_id derivations currently use inconsistent ad-hoc normalization (some use `_` joiners, none strip diacritics or punctuation), so "New York City", "new york city", and "New-York City" track as different entities and aggregations under-count.

### Changes

**1. Add helper near the top of the file** (after imports, before existing exports):

```ts
/**
 * Canonical normalization for entity IDs in behavior events.
 * "New York City", "new york city", "NEW YORK CITY" → "new-york-city"
 *
 * Use everywhere an entity_id is derived from a free-text name to ensure
 * cross-event aggregation works. Inconsistent normalization tracks the same
 * entity as multiple distinct values, breaking the analytics it's meant to feed.
 */
export function normalizeEntityId(name: string | undefined | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
```

**2. Replace the three ad-hoc derivations:**

- **Line 153** (`trackDestinationSearch`):
  - Before: `entity_id: normalized.replace(/\s+/g, '_'),`
  - After: `entity_id: normalizeEntityId(destination),`
  - Also drop the now-redundant local `normalized` (still need the length guard — keep it as `if (!destination || destination.trim().length < 2) return;`).

- **Line 171** (`trackDestinationInterest`):
  - Before: `const entityId = \`${city.toLowerCase()}_${country.toLowerCase()}\`.replace(/\s+/g, '_');`
  - After: `const entityId = normalizeEntityId(\`${city} ${country}\`);` (single hyphenated id, e.g. `new-york-united-states`).

- **Line 318** (`trackCategoryInteraction`):
  - Before: `const normalizedCategory = category.toLowerCase().replace(/\s+/g, '_');`
  - After: `const normalizedCategory = normalizeEntityId(category);`

**3. Out of scope:**
- Line 355 `${activityCategory}_${newSlot}` — slot is already an internal token (`early_morning` etc.); leaving it alone preserves the time_slot enum format. Not a free-text input.
- Lines 194/215/244/278/300/378 — those receive an `activityId` that is already a stable id (uuid/string), not free text. No change.

### Verification

- `grep -c "normalizeEntityId" src/services/behaviorTrackingService.ts` ≥ 4 (definition + 3 call sites; user threshold ≥ 2).
- TypeScript build clean.

### Note on existing data

This changes the on-the-wire format from `new_york_city` to `new-york-city`. Existing rows in the analytics table keep their old ids; only events emitted after deploy use the new format. Acceptable per the user's stated goal (current data is already broken by inconsistency).
