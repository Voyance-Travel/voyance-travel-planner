

## Fix: Discover Drawer Maps Most Categories to "dining"

### Root Cause

In `DiscoverDrawer.tsx` line 282, the `handleAdd` function has a broken category mapping:

```typescript
const cat = suggestion.category === 'coffee' ? 'dining' 
  : suggestion.category === 'wander' ? 'sightseeing' 
  : suggestion.category === 'drinks' ? 'nightlife' 
  : 'dining'; // ← everything else falls through to 'dining'
```

Categories like `food`, `attractions`, `events`, `snacks`, `nightlife` all hit the final fallback `'dining'`. So "Uncover Marais Street Art" (likely categorized as `wander` or `attractions` from the AI) gets mapped to `dining`.

### Fix — 1 file: `src/components/itinerary/DiscoverDrawer.tsx`

Replace the broken ternary chain on line 282 with a proper mapping that covers all `Category` values from `CategoryBrowse.tsx`:

```typescript
const CATEGORY_MAP: Record<string, string> = {
  coffee: 'dining',
  food: 'dining',
  snacks: 'dining',
  wander: 'sightseeing',
  attractions: 'sightseeing',
  drinks: 'nightlife',
  nightlife: 'nightlife',
  events: 'activity',
};

const cat = CATEGORY_MAP[suggestion.category] || suggestion.category || 'activity';
```

This ensures:
- Street art / explore / attractions → `sightseeing` (not `dining`)
- Food/coffee/snacks → `dining` (correct)
- Drinks/nightlife → `nightlife` (correct)
- Events and unknown categories → `activity` (safe default)
- Any AI-returned category not in the map passes through as-is rather than defaulting to `dining`

