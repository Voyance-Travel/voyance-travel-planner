

## Fix Cross-Day Venue Dedup for Multilingual Name Variants

### Root Cause

The fuzzy matcher `venueNamesMatch` uses 80% word-overlap, which fails for bilingual pairs like:
- "Tuileries Garden" vs "Jardin des Tuileries" → only 1/2 words match (50%) → **not caught**
- "Champ de Mars" vs "Champ de Mars Park" → works (75%+ overlap)

The AI prompt already tells the model "DO NOT use these venues" but the model sometimes ignores it. The post-generation dedup should be the safety net, but the fuzzy matching misses cross-language synonyms.

### Fix: Two-Pronged Approach

#### 1. Add a canonical alias map for known multilingual venue pairs

**File: `supabase/functions/generate-itinerary/generation-utils.ts`**

Add a `VENUE_ALIASES` map that maps normalized venue fragments to a canonical key. Before comparing, check if both names resolve to the same canonical key.

```typescript
const VENUE_ALIASES: Record<string, string> = {
  'tuileries garden': 'tuileries',
  'jardin des tuileries': 'tuileries',
  'tuileries': 'tuileries',
  'champs elysees': 'champs-elysees',
  'avenue des champs elysees': 'champs-elysees',
  'champs-elysees': 'champs-elysees',
  'sacre coeur': 'sacre-coeur',
  'sacre-coeur basilica': 'sacre-coeur',
  'basilique du sacre coeur': 'sacre-coeur',
  'eiffel tower': 'eiffel-tower',
  'tour eiffel': 'eiffel-tower',
  'notre dame': 'notre-dame',
  'notre-dame cathedral': 'notre-dame',
  'cathedrale notre-dame': 'notre-dame',
  'arc de triomphe': 'arc-de-triomphe',
  'arc de triomphe de l\'etoile': 'arc-de-triomphe',
  'luxembourg garden': 'luxembourg',
  'jardin du luxembourg': 'luxembourg',
  'luxembourg gardens': 'luxembourg',
  'palais royal': 'palais-royal',
  'palais-royal gardens': 'palais-royal',
  'jardin du palais royal': 'palais-royal',
  'champ de mars': 'champ-de-mars',
  'parc du champ de mars': 'champ-de-mars',
  'musee d\'orsay': 'orsay',
  'orsay museum': 'orsay',
  'musee du louvre': 'louvre',
  'louvre museum': 'louvre',
  'the louvre': 'louvre',
  'palace of versailles': 'versailles',
  'chateau de versailles': 'versailles',
  'versailles palace': 'versailles',
  'place de la concorde': 'concorde',
  'pont alexandre iii': 'pont-alexandre-iii',
  'pont alexandre': 'pont-alexandre-iii',
  'ile saint louis': 'ile-saint-louis',
  'ile saint-louis': 'ile-saint-louis',
  'ile de la cite': 'ile-de-la-cite',
  'montmartre': 'montmartre',
  'place du tertre': 'place-du-tertre',
};
```

Then update `venueNamesMatch` to check alias resolution before the word-overlap test:

```typescript
export function venueNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  // Alias resolution — catches bilingual name pairs
  const aliasA = resolveVenueAlias(a);
  const aliasB = resolveVenueAlias(b);
  if (aliasA && aliasB && aliasA === aliasB) return true;
  // Substring containment
  if (a.includes(b) || b.includes(a)) return true;
  // Word-overlap (existing logic)
  ...
}
```

The `resolveVenueAlias` function checks both exact and substring match against alias keys.

#### 2. Lower word-overlap threshold for short names

For venue names with ≤ 2 words, the 80% threshold is too strict (requires exact match). Lower to 50% for names with ≤ 2 words in the shorter name:

```typescript
const threshold = smaller <= 2 ? 0.5 : 0.8;
return smaller > 0 && intersection / smaller >= threshold;
```

This catches "Tuileries Garden" vs "Tuileries Promenade" even without aliases.

#### 3. Extract core venue word from title prefixes more aggressively

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`** (lines 424-427)

Add more prefix patterns to strip from titles before adding to `usedVenues`:

```typescript
const stripped = titleName
  .replace(/^(?:morning|afternoon|evening|final|early|late|leisurely|scenic|guided)\s+(?:at|in|visit\s+to|stroll\s+(?:at|in|through)|walk\s+(?:at|in|through|around))\s+/i, '')
  .replace(/^(?:visit|explore|discover|stroll|walk|wander|tour|enjoy)\s+(?:at|in|through|around|along)?\s*/i, '')
  .replace(/\s+(?:stroll|walk|tour|visit|exploration)$/i, '')  // strip trailing action words
  .trim();
```

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/generation-utils.ts` | Add `VENUE_ALIASES` map, `resolveVenueAlias()` helper, update `venueNamesMatch()` with alias check + lower threshold for short names |
| `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | Expand title-stripping patterns at lines 424-427 |

### What We're NOT Changing
- `compile-prompt.ts` — prompt injection already works, this is about the post-gen safety net
- `validate-day.ts` — its own cross-day check is additive
- The 80% threshold for 3+ word names — that works well for longer names

