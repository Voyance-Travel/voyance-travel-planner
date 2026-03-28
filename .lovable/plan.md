

## Fix: Strip Leaked AI Reasoning from User-Facing Text

### Problem
Internal AI reasoning text is leaking into itinerary cards in three patterns:
1. **Location names** contain search qualifiers: `"Kagurazaka Ishikawa (Satellite or High-End alternative in Chiyoda/Minato)"`
2. **Descriptions** contain slot/requirement references: `"slot: A traditional..."`, `"Fulfills the solo retreat slot."`, `"Fulfills the accommodation requirement."`
3. **Tips** contain raw metadata: `"Tomorrow: Wake 08:00. Breakfast at The Lounge (Level 39 of Hotel, ~0.1km, ~$40)..."`

### Root Cause
The existing sanitizers (`sanitizeActivityText`, `sanitizeActivityName`, `sanitizeAITextField`) strip system label prefixes (EDGE_ACTIVITY, etc.) and CJK artifacts, but have no rules for:
- Parenthetical search qualifiers with "or", "alternative", "Satellite"
- "slot:" prefixes or "Fulfills the...slot/requirement" sentences
- Distance/cost metadata like `~0.1km, ~$40`

### Fix — Two Files

**File 1: `src/utils/activityNameSanitizer.ts`**

Add new regex patterns to `sanitizeActivityText()` and `sanitizeActivityName()`:

```typescript
// Strip AI search qualifiers from names/locations
// e.g. "(Satellite or High-End alternative in Chiyoda/Minato)"
// e.g. "(or high-end Kaiseki alternative)"
const AI_QUALIFIER_RE = /\s*\((?:[^)]*?\b(?:alternative|satellite|or\s+high.end|similar|equivalent|comparable)\b[^)]*?)\)/gi;

// Strip "slot: " prefix from descriptions
const SLOT_PREFIX_RE = /^slot:\s*/i;

// Strip "Fulfills the ... slot/requirement." sentences
const FULFILLS_RE = /\.?\s*Fulfills the\s+[^.]*?(?:slot|requirement|block)\.\s*/gi;

// Strip distance/cost metadata in tips: "(Level 39 of Hotel, ~0.1km, ~$40)"
// and "~0.1km" / "~$40" standalone fragments
const META_DISTANCE_COST_RE = /\((?:[^)]*?~\d+(?:\.\d+)?(?:km|mi|m)\b[^)]*?)\)/gi;
const INLINE_META_RE = /,?\s*~\d+(?:\.\d+)?(?:km|mi|m)\b,?\s*~?\$?\d+/gi;
```

Add these to `sanitizeActivityText()`:
```typescript
export function sanitizeActivityText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(SYSTEM_LABEL_RE, '')
    .replace(AI_QUALIFIER_RE, '')
    .replace(SLOT_PREFIX_RE, '')
    .replace(FULFILLS_RE, ' ')
    .replace(META_DISTANCE_COST_RE, '')
    .replace(INLINE_META_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
```

Add `AI_QUALIFIER_RE` to `sanitizeActivityName()` after the system prefix strip:
```typescript
sanitized = sanitized.replace(AI_QUALIFIER_RE, '').trim();
```

**File 2: `src/components/itinerary/EditorialItinerary.tsx`**

Apply sanitization to three currently-unsanitized render points:

1. **`locationText`** (~line 10055-10057) — wrap in `sanitizeActivityText`:
```typescript
const rawLocationName = sanitizeActivityText(activity.location?.name?.trim());
```

2. **`activity.tips`** (~line 10118-10120) — wrap in `sanitizeActivityText`:
```typescript
{sanitizeActivityText(activity.tips)}
```

3. **Transport card titles** — the transport title inherits the destination's location name (e.g., "Travel to Yoyogi Park West Spa or High-End Boutique Wellness"). Since titles go through `sanitizeActivityName`, adding `AI_QUALIFIER_RE` there covers this case automatically.

### Result
| Before | After |
|--------|-------|
| `Kagurazaka Ishikawa (Satellite or High-End alternative in Chiyoda/Minato)` | `Kagurazaka Ishikawa` |
| `Sushi Kanesaka (or high-end Kaiseki alternative)` | `Sushi Kanesaka` |
| `Yoyogi Park West Spa or High-End Boutique Wellness` | `Yoyogi Park West Spa` |
| `slot: A traditional Japanese head spa...` | `A traditional Japanese head spa...` |
| `Rest and enjoy... Fulfills the accommodation requirement.` | `Rest and enjoy...` |
| `Tomorrow: Wake 08:00. Breakfast at The Lounge (Level 39 of Hotel, ~0.1km, ~$40)` | `Tomorrow: Wake 08:00. Breakfast at The Lounge` |

### Files Changed
| File | Changes |
|------|---------|
| `src/utils/activityNameSanitizer.ts` | Add AI qualifier, slot, fulfills, and metadata regexes to both sanitize functions |
| `src/components/itinerary/EditorialItinerary.tsx` | Wrap locationText, tips, and location name renders in sanitization |

