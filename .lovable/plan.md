

## Fix: Merge Rich Fields into Schema-Path Tool Schema

### Problem
The schema-driven path (line 8371) is missing valuable fields that exist in the old tool schema (line 2048):

| Field | Old Schema (2048) | New Schema (8371) |
|-------|:-:|:-:|
| `tags` (5+ keyword tags) | ✅ | ❌ |
| `transportation` (method, duration, cost, instructions) | ✅ | ❌ |
| `contextualTips` (typed array: timing, booking, safety…) | ✅ | ❌ |
| `rating` (value + totalReviews) | ✅ | ❌ |
| `website` | ✅ | ❌ |
| `location.coordinates` | ✅ | ❌ (separate `coordinates` field) |
| `transportComparison` (transition day options) | ✅ | ❌ |
| `selectedTransportId` | ✅ | ❌ |
| `minItems: 3` on activities | ✅ | ❌ |

### Plan

**File: `supabase/functions/generate-itinerary/index.ts`** (lines 8383-8431)

Add the missing rich fields to the schema-path tool schema at line 8371:

1. **`activities` array**: Add `minItems: 3`
2. **`tags`**: `{ type: "array", items: { type: "string" }, minItems: 5 }` — keyword tags for filtering/search
3. **`transportation`**: Full object with `method`, `duration`, `estimatedCost` (amount + currency), `instructions` — with the cost rules description (walk=0, metro=1-5, etc.)
4. **`contextualTips`**: Array of `{ type, text }` with enum `["timing", "booking", "money_saving", "transit", "cultural", "safety", "hidden_gem", "weather", "general"]` — 1-4 typed tips
5. **`rating`**: Object with `value` (number) and `totalReviews` (number)
6. **`website`**: String
7. **`location.coordinates`**: Move `coordinates` inside `location` object (currently a sibling field) to match the old schema's nesting — `{ lat: number, lng: number }`
8. **`transportComparison`** + **`selectedTransportId`**: Add at the day level (same as old schema) for transition days
9. **Update `required` array**: Add `tags` to required fields (matching old schema)

**Also update the prompt** in both copies of `schema-to-prompt.ts` to mention the new fields so the AI knows to populate them:
- Add `tags` (5+ keywords), `transportation` (how to get there from previous activity), `contextualTips` (1-4 typed tips), `rating`, `website` to the output format section

### Files Changed: 3
- `supabase/functions/generate-itinerary/index.ts` — enrich tool schema
- `supabase/functions/generate-itinerary/schema/schema-to-prompt.ts` — update prompt output format
- `src/lib/schema-compiler/schema-to-prompt.ts` — mirror prompt changes

