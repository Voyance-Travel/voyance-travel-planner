

## Fix: Sensible, Non-Redundant Transport Cards

### Current Issues

1. **Back-to-back transports can survive**: The consolidation (step 4) merges consecutive transport cards but uses the *last* card's destination and discards intermediate context. If 3 transports appear in a row, the merged card may reference a nonsensical "from".

2. **Transport titles/descriptions don't always match actual A→B flow**: `makeTransCard` sets `title: "Travel to ${to}"` and `location.name: to` (destination only). The `from` is only in the `description` field. When the AI generates transport cards, their `from`/`to` may not match the surrounding activities.

3. **AI-generated transports aren't validated against neighbors**: Step 3 only injects *missing* transports. It skips pairs where either is already transport (`if (isTransport(curr) || isTransport(next)) continue`). But it never checks if an *existing* AI-generated transport actually connects the right activities. A transport saying "Travel to Eiffel Tower" between the Louvre and a restaurant would pass through unchecked.

4. **Consolidation loses "from" context**: When merging consecutive transports, the merged card takes `last.location` and `last.title` but `first.startTime`. The description is overwritten to a generic `Transit to ${last.location}` — no "from" info.

### Plan

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

#### A. Add a pre-injection transport validation pass (new Step 2.5)

Before injecting missing transits (Step 3), validate all *existing* AI-generated transport cards:

- For each transport card at position `i`, find the preceding non-transport activity and the following non-transport activity
- Check if the transport's destination (`location.name`) matches the *next* non-transport activity's location (fuzzy match)
- If it doesn't match, **rewrite** the transport card's title, description, and location to correctly bridge the actual predecessor → successor
- If the transport's origin claim (in description) doesn't match the preceding activity, fix the description

#### B. Strengthen consolidation to preserve A→B semantics (Step 4)

When merging consecutive transports:
- Set `from` = first transport's origin (the preceding non-transport activity's location)
- Set `to` = last transport's destination
- Title: `Travel to ${to}` (keep current)
- Description: `Transit from ${from} to ${to}` (use real endpoints)
- Use coordinate-based estimate between the *actual* endpoints, not the intermediate ones

#### C. Add post-consolidation back-to-back guard (Step 4c)

After dedup (Step 4b), do a final scan:
- If two consecutive transport cards still exist (edge case from injection ordering), merge them using the same A→B logic
- This is a safety net — should rarely trigger

#### D. Enrich `makeTransCard` with `fromLocation` on the card

Add a `fromLocation` field to transport cards so the UI can display "From X → To Y" if desired:
```
fromLocation: { name: from, address: '' }
```
This makes transport cards self-documenting about their actual route.

### Expected behavior

| Before | After |
|---|---|
| Transport → Transport → Activity | Single transport from previous activity to that activity |
| "Travel to Eiffel Tower" between Louvre and Restaurant | Rewritten to "Travel to Restaurant" |
| Transport with no "from" context | `fromLocation` field + accurate description |
| Merged transport with generic description | `Transit from Louvre to Hotel` with correct duration |

### Files changed
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — transport validation pass, consolidation fix, back-to-back guard, `fromLocation` field

