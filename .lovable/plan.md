

## Fix: Cost-Only Strings Treated as Must-Do Activities in Smart Finish

### Problem
When Smart Finish processes a manually-built itinerary, `buildResearchContext()` serializes every activity title — including cost-only entries like "~€15pp", "€16pp", "~€45pp", "Dinner At A Restaurant" — into the `mustDoActivities` string. The `parseItem()` function in `must-do-priorities.ts` has no filter for pure price/cost strings, so these become mandatory must-do activities with `priority: 'must'`. The validation gate then blocks generation because the AI (correctly) doesn't produce activities titled "€16pp".

The error "CRITICAL: The user's NON-NEGOTIABLE must-do activities are MISSING from Day 1: '~€15pp', '€16pp', '~€45pp'" confirms this.

### Root Cause
Two missing filters:

1. **`buildResearchContext()`** (enrich-manual-trip) includes all activities without filtering out cost-annotation entries
2. **`parseItem()`** (must-do-priorities.ts) accepts any string ≥2 chars as a valid must-do — no check for pure price/currency patterns

### Fix (2 files)

**File 1: `supabase/functions/generate-itinerary/must-do-priorities.ts` — `parseItem()` (~line 429)**

Add a filter after `activityName` is cleaned, before returning. If the remaining name is purely a cost/price string, return `null`:

```typescript
// After: if (!activityName) return null;
// Add:
// Skip pure cost/price annotations (e.g. "€16pp", "~€45pp", "$25/person", "£10")
if (/^[~≈]?\s*[€$£¥₹]?\s*\d+[\d.,]*\s*(?:\/?\s*(?:pp|person|pax|each|per\s*person))?\s*[€$£¥₹]?\s*$/i.test(activityName)) {
  return null;
}
```

This catches patterns like `€16pp`, `~€45pp`, `$25/person`, `~€15pp`, `£10`, etc.

**File 2: `supabase/functions/enrich-manual-trip/index.ts` — `buildResearchContext()` (~line 69)**

Add a pre-filter when iterating activities to skip cost-only titles:

```typescript
// After: const name = activity.title || activity.name || "";
// Add:
if (/^[~≈]?\s*[€$£¥₹]?\s*\d+[\d.,]*\s*(?:\/?\s*(?:pp|person|pax|each))?\s*[€$£¥₹]?\s*$/i.test(name.trim())) continue;
```

Also filter out generic filler titles like "Dinner At A Restaurant" which are category placeholders, not specific venues. Add after the cost check:

```typescript
// Skip generic category placeholders (not specific venues)
const genericTitles = ['dinner at a restaurant', 'lunch at a restaurant', 'breakfast at a café', 'breakfast at a cafe'];
if (genericTitles.includes(name.trim().toLowerCase())) continue;
```

### Scope
2 edge function files, ~10 lines added total. No client-side changes. No database changes.

